import test from "node:test";
import assert from "node:assert/strict";
import { createGameState } from "../src/index.js";
import {
  evaluateState,
  evaluateStateDetailed,
  evaluateStateTransition,
  TERMINAL_STATE_VALUE,
} from "../../../js/state-evaluation.js";

function piece(owner, type, id) {
  return {
    id,
    owner,
    type,
    originalType: type,
    revealed: type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

const settings = {
  score: {
    center: 2,
    home: 1,
    capture: 10,
    kingPressure: 12,
    kingSafety: 12,
    defense: 3,
    influence: 4,
    groupTactics: 5,
  },
};

test("common state evaluation is exactly zero-sum between colors", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.board[0][4] = piece("red", "king", "red-king");
  state.board[8][4] = piece("blue", "king", "blue-king");
  state.board[3][4] = piece("red", "soldier", "red-soldier");
  state.board[6][5] = piece("blue", "soldier", "blue-soldier");
  state.stats.captures = { red: 2, blue: 1 };

  assert.equal(evaluateState(state, "red", settings), -evaluateState(state, "blue", settings));
});

test("terminal wins and losses have fixed opposite values", () => {
  const state = createGameState();
  state.winner = "red";
  assert.equal(evaluateState(state, "red", settings), TERMINAL_STATE_VALUE);
  assert.equal(evaluateState(state, "blue", settings), -TERMINAL_STATE_VALUE);
});

test("state transition value uses the same common state evaluation", () => {
  const before = createGameState();
  before.firstDeployDone = { red: true, blue: true };
  before.board[0][4] = piece("red", "king", "red-king");
  before.board[8][4] = piece("blue", "king", "blue-king");
  const after = structuredClone(before);
  after.board[4][4] = piece("red", "soldier", "red-center");

  const delta = evaluateStateTransition(before, after, "red", settings);
  assert.equal(delta, evaluateState(after, "red", settings) - evaluateState(before, "red", settings));
  assert.equal(delta, -evaluateStateTransition(before, after, "blue", settings));
  assert.ok(evaluateStateDetailed(after, "red", settings).weighted.material > 0);
});

test("common evaluation respects explicit zero-weight ablations", () => {
  const state = createGameState();
  state.board[4][4] = piece("red", "soldier", "red-center");
  const result = evaluateStateDetailed(state, "red", {
    score: {
      capture: 0,
      kingSafety: 0,
      kingPressure: 0,
      groupTactics: 0,
      influence: 0,
      center: 0,
      home: 0,
    },
  });

  assert.equal(result.value, 0);
});
