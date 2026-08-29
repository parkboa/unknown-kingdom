import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AI_TIER_ORDER } from "../js/ai.js";
import { AI_CANDIDATE_CATALOG, candidateActionKey } from "../js/ai-catalog.js";
import { playDeterministicAiMatch } from "./lib/ai-match.mjs";

const SPECIAL_TYPES = new Set(["general", "wizard", "diplomat"]);

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function integerOption(name, fallback) {
  const value = Number.parseInt(optionValue(name, String(fallback)), 10);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function parsePairs(value) {
  const pairs = String(value).split(",").filter(Boolean).map((entry) => entry.split(":"));
  for (const pair of pairs) {
    if (pair.length !== 2 || pair[0] === pair[1] || pair.some((tier) => !AI_TIER_ORDER.includes(tier))) {
      throw new Error(`Invalid tier pair: ${pair.join(":")}`);
    }
  }
  if (!pairs.length) throw new Error("--pairs must include at least one red:blue pair");
  return pairs;
}

if (process.argv.includes("--help")) {
  process.stdout.write(`Usage: node scripts/analyze-ai-special-planting.mjs [options]\n\n\
  --pairs <a:b,c:d>       Tier pairs; both colors are played\n\
  --max-deployments <n>   Per-game deployment cap (default: 50)\n\
  --seed <n>              Base deterministic seed (default: 20260828)\n\
  --output <path>         JSON report path\n`);
  process.exit(0);
}

const pairs = parsePairs(optionValue(
  "--pairs",
  "novice:intermediate,advanced:expert,grandmaster:intermediate",
));
const maxDeployments = integerOption("--max-deployments", 50);
const baseSeed = integerOption("--seed", 20260828) >>> 0;
const outputPath = resolve(optionValue(
  "--output",
  "experiments/ai-special-planting.json",
));

function emptyOpportunity() {
  return {
    decisions: 0,
    candidateDecisions: 0,
    collected: 0,
    searchObserved: 0,
    searchKept: 0,
    riskObserved: 0,
    riskKept: 0,
    selected: 0,
    stopReasons: {},
  };
}

function emptyTierMetrics() {
  return {
    eligibleDecisions: 0,
    candidateDecisions: 0,
    selectedSpecials: 0,
    selectedTypes: {},
    selectedSignals: {},
    opportunities: Object.fromEntries(["0", "1", "2", "3", "4", "5+"].map(
      (bucket) => [bucket, emptyOpportunity()],
    )),
  };
}

const byTier = Object.fromEntries(AI_TIER_ORDER.map((tier) => [tier, emptyTierMetrics()]));
const runs = new Map();
const placements = [];

function percentage(numerator, denominator) {
  return denominator ? Number((numerator / denominator * 100).toFixed(1)) : null;
}

function average(values) {
  return values.length
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
    : null;
}

function increment(object, key) {
  object[key] = (object[key] || 0) + 1;
}

function offsetBucket(ownDeploymentCount) {
  const offset = Math.max(0, ownDeploymentCount - 5);
  return offset >= 5 ? "5+" : String(offset);
}

function candidateEvent(candidate, stage) {
  return candidate.path.find((event) => event.stage === stage);
}

function observeDecision(gameId, decision) {
  const context = decision.decisionContext;
  const diagnostics = decision.diagnostics;
  const tierMetrics = byTier[decision.tier];
  if (!context || !diagnostics?.candidates || !tierMetrics) return;

  const remaining = Object.values(context.remainingSpecials).reduce((sum, count) => sum + count, 0);
  if (context.ownDeploymentCount < 5 || remaining === 0) return;

  const opportunity = tierMetrics.opportunities[offsetBucket(context.ownDeploymentCount)];
  tierMetrics.eligibleDecisions += 1;
  opportunity.decisions += 1;

  const specialCandidates = diagnostics.candidates.filter(
    ({ catalog }) => catalog?.primary === AI_CANDIDATE_CATALOG.SPECIAL,
  );
  if (specialCandidates.length) {
    tierMetrics.candidateDecisions += 1;
    opportunity.candidateDecisions += 1;
  }
  for (const candidate of specialCandidates) {
    if (candidateEvent(candidate, "candidate_collection")?.outcome === "kept") {
      opportunity.collected += 1;
    }
    const search = candidateEvent(candidate, "search_pool");
    if (search) {
      opportunity.searchObserved += 1;
      if (search.outcome === "kept") opportunity.searchKept += 1;
      else increment(opportunity.stopReasons, search.reason);
    }
    const risk = candidateEvent(candidate, "risk_pool");
    if (risk) {
      opportunity.riskObserved += 1;
      if (risk.outcome === "kept") opportunity.riskKept += 1;
      else increment(opportunity.stopReasons, risk.reason);
    }
  }

  if (!SPECIAL_TYPES.has(decision.action.unitType)) return;
  tierMetrics.selectedSpecials += 1;
  opportunity.selected += 1;
  increment(tierMetrics.selectedTypes, decision.action.unitType);

  const selectedKey = candidateActionKey({
    type: decision.action.unitType,
    row: decision.action.row,
    col: decision.action.col,
  });
  const selectedCandidate = diagnostics.candidates.find(({ action }) => candidateActionKey({
    type: action.unitType,
    row: action.row,
    col: action.col,
  }) === selectedKey);
  const selectedSignals = selectedCandidate?.catalog?.signals || {};
  for (const [catalog, signals] of Object.entries(selectedSignals)) {
    for (const signal of signals) increment(tierMetrics.selectedSignals, `${catalog}.${signal}`);
  }

  const specialOrdinal = 4 - remaining;
  const ownDeploymentNumber = context.ownDeploymentCount + 1;
  const placement = {
    gameId,
    player: decision.player,
    tier: decision.tier,
    type: decision.action.unitType,
    row: decision.action.row,
    col: decision.action.col,
    globalDeploymentNumber: decision.deployments + 1,
    ownDeploymentNumber,
    specialOrdinal,
    delayBeyondEarliest: ownDeploymentNumber - (5 + specialOrdinal),
    occupiedBefore: context.occupiedCount,
    boardFillPercent: Number((context.occupiedCount / 81 * 100).toFixed(1)),
    signals: selectedSignals,
  };
  placements.push(placement);
  runs.get(`${gameId}:${decision.player}`)?.placements.push(placement);
}

function summarizeOpportunity(metrics) {
  return {
    ...metrics,
    candidateDecisionRate: percentage(metrics.candidateDecisions, metrics.decisions),
    searchSurvivalRate: percentage(metrics.searchKept, metrics.searchObserved),
    riskSurvivalRate: percentage(metrics.riskKept, metrics.riskObserved),
    specialSelectionRate: percentage(metrics.selected, metrics.decisions),
  };
}

const games = [];
let gameIndex = 0;
for (const pair of pairs) {
  for (const [redTier, blueTier] of [pair, [pair[1], pair[0]]]) {
    gameIndex += 1;
    const gameId = `special-planting-${gameIndex}`;
    runs.set(`${gameId}:red`, { gameId, player: "red", tier: redTier, placements: [] });
    runs.set(`${gameId}:blue`, { gameId, player: "blue", tier: blueTier, placements: [] });
    const result = playDeterministicAiMatch({
      redTier,
      blueTier,
      seed: (baseSeed + gameIndex - 1) >>> 0,
      gameId,
      maxDeployments,
      collectDecisionDiagnostics: true,
      onDecision: (decision) => observeDecision(gameId, decision),
    });
    games.push(result);
    process.stderr.write(
      `[${gameIndex}/${pairs.length * 2}] ${redTier}(B) vs ${blueTier}(W): `
      + `${result.winner} in ${result.deployments} deployments\n`,
    );
  }
}

const runSummaries = [...runs.values()].map((run) => ({
  ...run,
  firstSpecialOwnDeployment: run.placements[0]?.ownDeploymentNumber ?? null,
  firstSpecialDelay: run.placements[0]?.delayBeyondEarliest ?? null,
  plantedAllThree: run.placements.length === 3,
}));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  config: { pairs, games: games.length, maxDeployments, baseSeed },
  interpretation: {
    earliestFirstSpecialOwnDeployment: 6,
    delayBeyondEarliest: "own deployment number minus (5 + special ordinal)",
    opportunityOffset: "own deployments already made minus 5; 0 is the first legal special turn",
  },
  byTier: Object.fromEntries(AI_TIER_ORDER.map((tier) => {
    const metrics = byTier[tier];
    const tierRuns = runSummaries.filter((run) => run.tier === tier);
    const firstDelays = tierRuns.map((run) => run.firstSpecialDelay).filter(Number.isFinite);
    const placementDelays = tierRuns.flatMap((run) => run.placements.map(
      ({ delayBeyondEarliest }) => delayBeyondEarliest,
    ));
    return [tier, {
      runs: tierRuns.length,
      runsWithFirstSpecial: tierRuns.filter((run) => run.placements.length > 0).length,
      immediateFirstSpecialRuns: tierRuns.filter((run) => run.firstSpecialDelay === 0).length,
      plantedAllThreeRuns: tierRuns.filter((run) => run.plantedAllThree).length,
      averageFirstSpecialDelay: average(firstDelays),
      averagePlacementDelay: average(placementDelays),
      eligibleDecisions: metrics.eligibleDecisions,
      candidateDecisionRate: percentage(metrics.candidateDecisions, metrics.eligibleDecisions),
      selectedSpecials: metrics.selectedSpecials,
      selectedTypes: metrics.selectedTypes,
      selectedSignals: metrics.selectedSignals,
      opportunities: Object.fromEntries(Object.entries(metrics.opportunities).map(
        ([bucket, opportunity]) => [bucket, summarizeOpportunity(opportunity)],
      )),
    }];
  })),
  runs: runSummaries,
  placements,
  games,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
