import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { AI_RANK_SETTINGS, AI_TIER_ORDER } from "../js/ai.js";
import { playDeterministicAiMatch, seededRandom } from "./lib/ai-match.mjs";
import { decidePromotionGate } from "./lib/promotion-gate.mjs";

function optionValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function numberOption(name, fallback) {
  const value = Number(optionValue(name, fallback));
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
}

function settingsSnapshot(tier, pathValue) {
  const base = structuredClone(AI_RANK_SETTINGS[tier]);
  if (!pathValue) return base;
  const override = JSON.parse(readFileSync(resolve(pathValue), "utf8"));
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    throw new Error(`${pathValue} must contain a JSON object`);
  }
  return {
    ...base,
    ...override,
    typeWeights: { ...base.typeWeights, ...(override.typeWeights || {}) },
    score: { ...base.score, ...(override.score || {}) },
  };
}

if (process.argv.includes("--help")) {
  process.stdout.write(`Usage: node scripts/ai-promotion-gate.mjs [options]\n\n\
  --candidate <tier>       Candidate tier (default: grandmaster)\n\
  --baseline <tier>        Baseline tier (default: expert)\n\
  --candidate-settings <p> Candidate JSON settings override\n\
  --baseline-settings <p>  Baseline JSON settings override\n\
  --pairs <n>              Maximum color-swapped pairs (default: 50)\n\
  --min-pairs <n>          Pairs before confidence decisions (default: 10)\n\
  --threshold <rate>       Required candidate score rate (default: 0.55)\n\
  --confidence <rate>      Two-sided Wilson confidence (default: 0.95)\n\
  --max-deployments <n>    Per-game deployment cap (default: 180)\n\
  --seed <n>               Evaluation seed (default: 20260821)\n\
  --journal-dir <path>     Stream every game to a separate JSONL journal\n\
  --output <path>          Write the final JSON summary\n\
  --require-promotion      Exit with code 2 unless the candidate is promoted\n`);
  process.exit(0);
}

const candidate = optionValue("--candidate", "grandmaster");
const baseline = optionValue("--baseline", "expert");
const candidateSettingsPath = optionValue("--candidate-settings");
const baselineSettingsPath = optionValue("--baseline-settings");
const maxPairs = Math.floor(numberOption("--pairs", 50));
const minPairs = Math.floor(numberOption("--min-pairs", 10));
const threshold = numberOption("--threshold", 0.55);
const confidence = numberOption("--confidence", 0.95);
const maxDeployments = Math.floor(numberOption("--max-deployments", 180));
const seed = Math.floor(numberOption("--seed", 20260821)) >>> 0;
const journalDirValue = optionValue("--journal-dir");
const journalDir = journalDirValue ? resolve(journalDirValue) : null;
const outputValue = optionValue("--output");
const outputPath = outputValue ? resolve(outputValue) : null;

if (!AI_TIER_ORDER.includes(candidate) || !AI_TIER_ORDER.includes(baseline)) {
  throw new Error(`Candidate and baseline must be one of: ${AI_TIER_ORDER.join(", ")}`);
}
if (maxPairs < 1 || minPairs < 1 || minPairs > maxPairs) {
  throw new Error("--min-pairs and --pairs must satisfy 1 <= min-pairs <= pairs");
}
if (!(threshold >= 0 && threshold <= 1)) throw new Error("--threshold must be between 0 and 1");
if (!(confidence > 0 && confidence < 1)) throw new Error("--confidence must be between 0 and 1");
if (maxDeployments < 1) throw new Error("--max-deployments must be positive");
if (journalDir) mkdirSync(journalDir, { recursive: true });
const candidateSettings = settingsSnapshot(candidate, candidateSettingsPath);
const baselineSettings = settingsSnapshot(baseline, baselineSettingsPath);

const results = [];
const colorStats = {
  red: { games: 0, points: 0 },
  blue: { games: 0, points: 0 },
};
let points = 0;
let decision = decidePromotionGate({
  points,
  games: 0,
  minGames: minPairs * 2,
  maxGames: maxPairs * 2,
  threshold,
  confidence,
});

for (let pair = 1; pair <= maxPairs && decision.status === "continue"; pair += 1) {
  const pairSeed = (seed + Math.imul(pair, 0x9E3779B9)) >>> 0;
  const candidateColors = seededRandom(pairSeed)() < 0.5 ? ["red", "blue"] : ["blue", "red"];

  for (const candidateColor of candidateColors) {
    const redTier = candidateColor === "red" ? candidate : baseline;
    const blueTier = candidateColor === "blue" ? candidate : baseline;
    const redSettings = candidateColor === "red" ? candidateSettings : baselineSettings;
    const blueSettings = candidateColor === "blue" ? candidateSettings : baselineSettings;
    const gameId = `pair-${String(pair).padStart(3, "0")}-candidate-${candidateColor}`;
    const journalPath = journalDir ? join(journalDir, `${gameId}.jsonl`) : null;
    const result = playDeterministicAiMatch({
      redTier,
      blueTier,
      seed: pairSeed,
      gameId,
      maxDeployments,
      journalPath,
      redSettings,
      blueSettings,
    });
    const gamePoints = result.winner === "draw" ? 0.5 : result.winner === candidateColor ? 1 : 0;
    points += gamePoints;
    colorStats[candidateColor].games += 1;
    colorStats[candidateColor].points += gamePoints;
    results.push({ pair, candidateColor, candidatePoints: gamePoints, ...result });
    process.stderr.write(
      `[pair ${pair}/${maxPairs}] candidate(${candidateColor}) ${result.winner === candidateColor ? "win" : result.winner === "draw" ? "draw" : "loss"}`
      + ` · ${result.deployments} deployments · ${result.finalDigest}\n`,
    );
  }

  decision = decidePromotionGate({
    points,
    games: results.length,
    minGames: minPairs * 2,
    maxGames: maxPairs * 2,
    threshold,
    confidence,
  });
  process.stderr.write(
    `  score ${(decision.rate * 100).toFixed(1)}% · CI ${(decision.lower * 100).toFixed(1)}–${(decision.upper * 100).toFixed(1)}% · ${decision.status}\n`,
  );
}

const summary = {
  schemaVersion: 1,
  candidate,
  baseline,
  config: {
    maxPairs,
    minPairs,
    threshold,
    confidence,
    maxDeployments,
    seed,
    pairedSeeds: true,
    colorSwapped: true,
    journalDir,
    candidateSettingsPath: candidateSettingsPath ? resolve(candidateSettingsPath) : null,
    baselineSettingsPath: baselineSettingsPath ? resolve(baselineSettingsPath) : null,
    candidateSettings,
    baselineSettings,
  },
  decision,
  score: {
    games: results.length,
    pairs: results.length / 2,
    points,
    rate: results.length ? points / results.length : 0,
    byCandidateColor: colorStats,
  },
  results,
};
const serialized = `${JSON.stringify(summary, null, 2)}\n`;
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized, "utf8");
}
process.stdout.write(serialized);
if (process.argv.includes("--require-promotion") && decision.status !== "promoted") process.exitCode = 2;
