import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AI_TIER_ORDER } from "../js/ai.js";
import { AI_CANDIDATE_CATALOG } from "../js/ai-catalog.js";
import { playDeterministicAiMatch } from "./lib/ai-match.mjs";

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
  if (!pairs.length) throw new Error("--pairs must include at least one black:white pair");
  return pairs;
}

if (process.argv.includes("--help")) {
  process.stdout.write(`Usage: node scripts/analyze-ai-catalog-survival.mjs [options]\n\n\
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
  "experiments/ai-catalog-survival.json",
));
const catalogs = Object.values(AI_CANDIDATE_CATALOG);

function emptyMetrics() {
  return {
    collected: 0,
    searchObserved: 0,
    searchKept: 0,
    riskObserved: 0,
    riskKept: 0,
    riskVetoed: 0,
    selected: 0,
    stopReasons: {},
  };
}

const aggregate = Object.fromEntries(catalogs.map((catalog) => [catalog, emptyMetrics()]));
const catalogStageAggregate = Object.fromEntries(catalogs.map((catalog) => [catalog, emptyMetrics()]));
const byTier = Object.fromEntries(AI_TIER_ORDER.map((tier) => [
  tier,
  {
    decisions: 0,
    catalogStageDecisions: 0,
    catalogs: Object.fromEntries(catalogs.map((catalog) => [catalog, emptyMetrics()])),
    catalogStage: Object.fromEntries(catalogs.map((catalog) => [catalog, emptyMetrics()])),
  },
]));

function incrementReason(metrics, event) {
  if (event.outcome !== "stopped" && event.outcome !== "vetoed") return;
  metrics.stopReasons[event.reason] = (metrics.stopReasons[event.reason] || 0) + 1;
}

function observeCandidate(metrics, candidate) {
  const collected = candidate.path.find(({ stage }) => stage === "candidate_collection");
  if (collected?.outcome === "kept") metrics.collected += 1;
  const search = candidate.path.find(({ stage }) => stage === "search_pool");
  if (search) {
    metrics.searchObserved += 1;
    if (search.outcome === "kept") metrics.searchKept += 1;
    incrementReason(metrics, search);
  }
  const risk = candidate.path.find(({ stage }) => stage === "risk_pool");
  if (risk) {
    metrics.riskObserved += 1;
    if (risk.outcome === "kept") metrics.riskKept += 1;
    incrementReason(metrics, risk);
  }
  const hiddenRisk = candidate.path.find(({ stage }) => stage === "hidden_special_risk");
  if (hiddenRisk?.outcome === "vetoed") metrics.riskVetoed += 1;
  if (candidate.path.some(({ stage, outcome }) => stage === "selection" && outcome === "selected")) {
    metrics.selected += 1;
  }
}

function observeDecision(decision) {
  if (!decision.diagnostics?.candidates || !byTier[decision.tier]) return;
  byTier[decision.tier].decisions += 1;
  const afterSanctuary = decision.decisionStage === "catalog";
  if (afterSanctuary) byTier[decision.tier].catalogStageDecisions += 1;
  for (const candidate of decision.diagnostics.candidates) {
    const catalog = candidate.catalog?.primary;
    if (!catalogs.includes(catalog)) continue;
    observeCandidate(aggregate[catalog], candidate);
    observeCandidate(byTier[decision.tier].catalogs[catalog], candidate);
    if (afterSanctuary) {
      observeCandidate(catalogStageAggregate[catalog], candidate);
      observeCandidate(byTier[decision.tier].catalogStage[catalog], candidate);
    }
  }
}

function percentage(numerator, denominator) {
  return denominator ? Number((numerator / denominator * 100).toFixed(1)) : null;
}

function summarizeMetrics(metrics) {
  return {
    ...metrics,
    searchSurvivalRate: percentage(metrics.searchKept, metrics.searchObserved),
    riskSurvivalRate: percentage(metrics.riskKept, metrics.riskObserved),
    selectionRate: percentage(metrics.selected, metrics.collected),
  };
}

function summarizeCatalogs(source) {
  return Object.fromEntries(catalogs.map((catalog) => [catalog, summarizeMetrics(source[catalog])]));
}

const games = [];
let gameIndex = 0;
for (const pair of pairs) {
  for (const [blackTier, whiteTier] of [pair, [pair[1], pair[0]]]) {
    gameIndex += 1;
    const seed = (baseSeed + gameIndex - 1) >>> 0;
    const result = playDeterministicAiMatch({
      blackTier,
      whiteTier,
      seed,
      gameId: `catalog-${gameIndex}`,
      maxDeployments,
      collectDecisionDiagnostics: true,
      onDecision: observeDecision,
    });
    games.push(result);
    process.stderr.write(
      `[${gameIndex}/${pairs.length * 2}] ${blackTier}(B) vs ${whiteTier}(W): `
      + `${result.winner} in ${result.deployments} deployments\n`,
    );
  }
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  config: { pairs, games: games.length, maxDeployments, baseSeed },
  aggregate: summarizeCatalogs(aggregate),
  catalogStage: summarizeCatalogs(catalogStageAggregate),
  byTier: Object.fromEntries(AI_TIER_ORDER.map((tier) => [tier, {
    decisions: byTier[tier].decisions,
    catalogStageDecisions: byTier[tier].catalogStageDecisions,
    catalogs: summarizeCatalogs(byTier[tier].catalogs),
    catalogStage: summarizeCatalogs(byTier[tier].catalogStage),
  }])),
  games,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
