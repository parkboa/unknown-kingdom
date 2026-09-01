import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createGameState,
  dispatchAction,
  parseGameJournalJsonl,
  stateForPlayer,
} from "../src/index.js";
import { findIsMctsAction } from "../../../js/is-mcts.js";

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(value, 1664525) + 1013904223;
    return (value >>> 0) / 4294967296;
  };
}

const PROACTIVE_WIZARD_TRAP_HISTORY = [
  ["black", ["king", 4, 4]], ["white", ["king", 7, 2]],
  ["black", ["soldier", 3, 4]], ["white", ["soldier", 6, 2]],
  ["black", ["soldier", 5, 4]], ["white", ["soldier", 7, 3]],
  ["black", ["soldier", 4, 5]], ["white", ["soldier", 8, 2]],
  ["black", ["soldier", 4, 3]], ["white", ["soldier", 5, 5]],
  ["black", ["wizard", 7, 1]], ["white", ["general", 6, 1]],
  ["black", ["general", 5, 6]], ["white", ["wizard", 4, 2]],
  ["black", ["diplomat", 8, 3]], ["white", ["soldier", 8, 1]],
  ["black", ["soldier", 8, 0]], ["white", ["diplomat", 5, 2]],
  ["black", ["soldier", 6, 5]], ["white", ["soldier", 7, 4]],
  ["black", ["soldier", 6, 3]], ["white", ["soldier", 4, 1]],
  ["black", ["soldier", 3, 2]], ["white", ["soldier", 5, 1]],
  ["black", ["soldier", 5, 0]], ["white", ["soldier", 4, 0]],
  ["black", ["soldier", 6, 0]],
];

function actionKey(action) {
  return action.type === "deploy"
    ? `${action.type}:${action.unitType}:${action.row}:${action.col}`
    : action.type;
}

function historicalTacticalPosition(filename, actionIndex) {
  const url = new URL(`../../../experiments/is-mcts-loss-replays/${filename}`, import.meta.url);
  const { journal } = parseGameJournalJsonl(readFileSync(url, "utf8"));
  const state = structuredClone(journal.initialState);
  for (const entry of journal.actions.slice(0, actionIndex)) {
    const result = dispatchAction(state, entry.player, structuredClone(entry.action), entry.options || {});
    assert.equal(result.accepted, entry.accepted);
  }
  return { state, loss: journal.actions[actionIndex] };
}

for (const scenario of [
  { name: "General reaction loss", filename: "pair-002-candidate-blue.jsonl", actionIndex: 19 },
  { name: "Wizard reaction loss", filename: "pair-008-candidate-red.jsonl", actionIndex: 24 },
]) {
  test(`risk-aware IS-MCTS rejects the historical ${scenario.name}`, () => {
    const { state, loss } = historicalTacticalPosition(scenario.filename, scenario.actionIndex);
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
    const dangerousEdge = result.root.find(({ action }) => actionKey(action) === actionKey(loss.action));

    assert.ok(dangerousEdge, "historical losing move must remain in the evaluated root candidates");
    assert.equal(dangerousEdge.cvar, -1);
    assert.ok(dangerousEdge.selectionScore < dangerousEdge.meanValue);
    assert.notEqual(actionKey(result.action), actionKey(loss.action));
  });
}

test("risk-aware IS-MCTS defends against the opponent's next-turn Wizard trap", () => {
  const state = createGameState("pve");
  for (const [player, [unitType, row, col]] of PROACTIVE_WIZARD_TRAP_HISTORY) {
    assert.equal(dispatchAction(state, player, {
      type: "deploy", unitType, row, col,
    }).accepted, true);
  }
  const historicalLosingAction = { type: "deploy", unitType: "soldier", row: 3, col: 1 };
  const result = findIsMctsAction(stateForPlayer(state, "white"), {
    aiPlayer: "white",
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
    random: seededRandom(12372),
  });
  const selectedEdge = result.root.find(({ action }) => actionKey(action) === actionKey(result.action));

  assert.notEqual(actionKey(result.action), actionKey(historicalLosingAction));
  assert.ok(selectedEdge.riskSamples > 0, "risk-aware selection must come from the probed candidate pool");
});
