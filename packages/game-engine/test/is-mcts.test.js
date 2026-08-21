import test from "node:test";
import assert from "node:assert/strict";
import {
  canDeploy,
  createGameState,
  informationStateKey,
  resampleFromInformationState,
  stateForPlayer,
} from "../src/index.js";
import { findIsMctsAction } from "../../../js/is-mcts.js";

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

test("information-state resampling samples hidden specials without changing public state", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 6, blue: 6 };
  state.board[2][2] = hiddenSoldier("red", "red-hidden-1");
  state.board[3][3] = hiddenSoldier("red", "red-hidden-2");
  const publicState = stateForPlayer(state, "blue");
  const world = resampleFromInformationState(publicState, "blue", () => 0.01);

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
  const first = resampleFromInformationState(stateForPlayer(state, "blue"), "blue", () => 0.01);
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
  assert.ok(result.root.every((edge) => edge.visits <= edge.availability));
});

test("IS-MCTS rejects a resampled world outside the root information state", () => {
  const state = createGameState("pve");
  assert.throws(() => findIsMctsAction(state, {
    aiPlayer: "red",
    iterations: 1,
    resampleWorld(publicState) {
      const inconsistent = structuredClone(publicState);
      inconsistent.turn = "blue";
      return inconsistent;
    },
  }), /outside the root information state/);
});

test("IS-MCTS tracks action availability across inconsistent determinizations", () => {
  const state = createGameState("pve");
  state.turn = "blue";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 6, blue: 6 };
  state.stock.red.king = 0;
  state.stock.blue.king = 0;
  state.board[0][0] = { ...hiddenSoldier("red", "red-king"), type: "king", originalType: "king", revealed: true };
  state.board[8][8] = { ...hiddenSoldier("blue", "blue-king"), type: "king", originalType: "king", revealed: true };
  state.board[4][4] = hiddenSoldier("red", "red-hidden");
  state.board[3][4] = hiddenSoldier("blue", "north");
  state.board[5][4] = hiddenSoldier("blue", "south");
  state.board[4][3] = hiddenSoldier("blue", "west");
  let sample = 0;

  const result = findIsMctsAction(state, {
    aiPlayer: "blue",
    settings: { score: { capture: 10, kingSafety: 10, kingPressure: 10, center: 2, home: 1 } },
    iterations: 6,
    rootCandidateLimit: 1,
    rootEvaluationLimit: 30,
    treeCandidateLimit: 1,
    rolloutDepth: 1,
    random: () => 0.5,
    resampleWorld(publicState, player) {
      const sampledRandom = sample % 2 === 0 ? () => 0.99 : () => 0.01;
      sample += 1;
      return resampleFromInformationState(publicState, player, sampledRandom);
    },
  });

  assert.equal(result.root.length, 2);
  assert.deepEqual(result.root.map(({ availability }) => availability), [3, 3]);
  assert.equal(result.root.reduce((sum, edge) => sum + edge.visits, 0), 6);
  assert.ok(result.root.every((edge) => edge.visits <= edge.availability));
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
