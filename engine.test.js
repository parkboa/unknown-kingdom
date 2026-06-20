import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, createGameState, stateForPlayer } from "./engine.js";

test("requires the King as each player's first deployment", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 0, col: 0 }), false);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 0 }), true);
  assert.equal(state.turn, "blue");
});

test("hides unrevealed enemy special identities", () => {
  const state = createGameState();
  state.board[0][0] = {
    id: "secret-general",
    owner: "red",
    type: "general",
    originalType: "general",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  const blueView = stateForPlayer(state, "blue");
  const redView = stateForPlayer(state, "red");
  assert.equal(blueView.board[0][0].type, "soldier");
  assert.equal(redView.board[0][0].type, "general");
});

test("rejects actions from the wrong player", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), false);
});
