import test from "node:test";
import assert from "node:assert/strict";
import { canDeploy, createGameState, stateForPlayer } from "../src/index.js";
import {
  findIsMctsAction,
  informationStateKey,
  sampleInformationSetWorld,
} from "../../../js/is-mcts.js";

function hiddenSoldier(owner, id) {
  return {
    id,
    owner,
    type: "soldier",
    originalType: "soldier",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = Math.imul(value, 1664525) + 1013904223;
    return (value >>> 0) / 4294967296;
  };
}

test("IS-MCTS determinization samples hidden specials without changing public state", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 6, blue: 6 };
  state.board[2][2] = hiddenSoldier("red", "red-hidden-1");
  state.board[3][3] = hiddenSoldier("red", "red-hidden-2");
  const publicState = stateForPlayer(state, "blue");
  const world = sampleInformationSetWorld(publicState, "blue", () => 0.99);

  const sampled = [world.board[2][2], world.board[3][3]]
    .filter((piece) => ["general", "wizard", "diplomat"].includes(piece.type));
  assert.equal(sampled.length, 1);
  assert.notEqual(world.stock.red, null);
  assert.equal(publicState.stock.red, null);
  assert.equal(publicState.board[2][2].type, "soldier");
});

test("information-state keys merge worlds that differ only in hidden identities", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 6, blue: 6 };
  state.board[2][2] = hiddenSoldier("red", "red-hidden");
  const first = sampleInformationSetWorld(stateForPlayer(state, "blue"), "blue", () => 0.99);
  const second = structuredClone(first);
  second.board[2][2].type = "wizard";
  second.board[2][2].originalType = "wizard";

  assert.equal(informationStateKey(first, "blue"), informationStateKey(second, "blue"));
});

test("IS-MCTS returns an authoritative legal opening action", () => {
  const state = createGameState("pve");
  const result = findIsMctsAction(state, {
    aiPlayer: "red",
    settings: { score: { capture: 10, kingSafety: 10, kingPressure: 10, center: 2, home: 1 } },
    iterations: 8,
    rootCandidateLimit: 8,
    treeCandidateLimit: 4,
    rolloutCandidateLimit: 3,
    rolloutDepth: 3,
    random: seededRandom(12345),
  });

  assert.equal(result.action.type, "deploy");
  assert.equal(result.action.unitType, "king");
  assert.equal(canDeploy(state, "red", "king", result.action.row, result.action.col), true);
  assert.equal(result.root.reduce((sum, edge) => sum + edge.visits, 0), 8);
});

test("IS-MCTS returns the same search result for the same state and seed", () => {
  const state = createGameState("pve");
  const options = {
    aiPlayer: "red",
    settings: { score: { capture: 10, kingSafety: 10, kingPressure: 10, center: 2, home: 1 } },
    iterations: 8,
    rootCandidateLimit: 8,
    treeCandidateLimit: 4,
    rolloutCandidateLimit: 3,
    rolloutDepth: 3,
  };

  const first = findIsMctsAction(state, { ...options, random: seededRandom(98765) });
  const second = findIsMctsAction(state, { ...options, random: seededRandom(98765) });

  assert.deepEqual(second, first);
});
