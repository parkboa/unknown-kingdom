import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  dispatchAction,
  parseGameJournalJsonl,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";
import { findIsMctsAction } from "../js/is-mcts.js";

const scenarios = [
  { name: "general", filename: "pair-002-candidate-blue.jsonl", actionIndex: 19 },
  { name: "wizard", filename: "pair-008-candidate-red.jsonl", actionIndex: 24 },
];

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(value, 1664525) + 1013904223;
    return (value >>> 0) / 4294967296;
  };
}

function actionKey(action) {
  return action.type === "deploy"
    ? `${action.type}:${action.unitType}:${action.row}:${action.col}`
    : action.type;
}

function historicalPosition(filename, actionIndex) {
  const parsed = parseGameJournalJsonl(readFileSync(
    resolve("experiments/is-mcts-loss-replays", filename),
    "utf8",
  ));
  const state = structuredClone(parsed.journal.initialState);
  for (const entry of parsed.journal.actions.slice(0, actionIndex)) {
    const result = dispatchAction(state, entry.player, structuredClone(entry.action), entry.options || {});
    if (result.accepted !== entry.accepted) throw new Error(`Replay diverged before action ${actionIndex}`);
  }
  return { state, loss: parsed.journal.actions[actionIndex] };
}

const engineScenarios = scenarios.map((scenario) => {
  const { state, loss } = historicalPosition(scenario.filename, scenario.actionIndex);
  const result = findIsMctsAction(stateForPlayer(state, loss.player), {
    aiPlayer: loss.player,
    iterations: 24,
    rootCandidateLimit: 8,
    treeCandidateLimit: 6,
    rolloutCandidateLimit: 4,
    rootEvaluationLimit: 32,
    treeEvaluationLimit: 12,
    rolloutEvaluationLimit: 8,
    rolloutDepth: 6,
    riskWeight: 0.75,
    riskQuantile: 0.25,
    riskCandidateLimit: 8,
    riskWorldLimit: 6,
    riskRolloutDepth: 2,
    random: seededRandom(12345 + scenario.actionIndex),
  });
  const losingKey = actionKey(loss.action);
  const dangerousEdge = result.root.find(({ action }) => actionKey(action) === losingKey);
  if (!dangerousEdge || dangerousEdge.cvar !== -1 || actionKey(result.action) === losingKey) {
    throw new Error(`${scenario.name} suitability check failed`);
  }
  return {
    name: scenario.name,
    sourceJournal: `experiments/is-mcts-loss-replays/${scenario.filename}`,
    losingAction: loss.action,
    selectedAction: result.action,
    dangerousEdge,
    avoidedHistoricalLoss: true,
  };
});

const python = process.env.OPEN_SPIEL_PYTHON || "python3";
const openSpielRun = spawnSync(python, ["scripts/open-spiel-tactical-model.py"], {
  cwd: process.cwd(),
  encoding: "utf8",
});
if (openSpielRun.error) {
  throw new Error(`Could not run OpenSpiel Python: ${openSpielRun.error.message}`);
}
if (openSpielRun.status !== 0) {
  throw new Error(`OpenSpiel tactical model failed:\n${openSpielRun.stderr}`);
}
const openSpiel = JSON.parse(openSpielRun.stdout);
if (!openSpiel.sameInformationState || !openSpiel.variableActionSets || openSpiel.selectedActionName !== "safe") {
  throw new Error("OpenSpiel contract cross-check did not produce the expected result");
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  openSpiel,
  engineScenarios,
  crossCheck: {
    informationStateContract: openSpiel.sameInformationState,
    variableActionSetContract: openSpiel.variableActionSets,
    openSpielSelectedSafeAction: openSpiel.selectedActionName === "safe",
    engineAvoidedBothHistoricalLosses: engineScenarios.every(({ avoidedHistoricalLoss }) => avoidedHistoricalLoss),
    passed: true,
  },
};
const outputPath = resolve("experiments/open-spiel-tactical-crosscheck.json");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
