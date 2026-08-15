import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, createGameState } from "../src/index.js";
import { chooseBotAction } from "../src/bot.js";

function soldier(owner, id) {
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

test("online bot chooses the required King as its first move", () => {
  const state = createGameState();
  const action = chooseBotAction(state, "red");
  assert.equal(action.type, "deploy");
  assert.equal(action.unitType, "king");
  assert.equal(applyAction(state, "red", action), true);
});

test("online bot uses an available taunt", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  assert.deepEqual(chooseBotAction(state, "blue"), { type: "taunt" });
});

test("online bot takes an immediate King capture", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");
  state.deploymentCount.red = 5;
  state.turn = "blue";

  const action = chooseBotAction(state, "blue");
  assert.equal(action.type, "deploy");
  assert.equal(action.row, 4);
  assert.equal(action.col, 5);
  assert.equal(applyAction(state, "blue", action), true);
  assert.equal(state.winner, "blue");
});

test("online bot explicitly passes when no deployment is legal", () => {
  const state = createGameState();
  state.turn = "blue";
  state.firstDeployDone = { red: true, blue: true };
  state.stock.blue = { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.board[0][0] = soldier("red", "red-1");
  state.board[8][4] = { ...soldier("blue", "blue-king"), type: "king", originalType: "king", revealed: true };

  assert.deepEqual(chooseBotAction(state, "blue"), { type: "pass" });
});
