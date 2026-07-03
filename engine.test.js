import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, chooseBotAction, createGameState, isSuicideDeployment, stateForPlayer } from "./engine.js";

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

test("ends the match when a King is captured once", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");
  state.turn = "blue";

  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.winner, "blue");
  assert.match(state.resultReason, /King was captured/);
  assert.equal(state.pendingKingSwap, null);
});

test("grants one taunt when a King starts against its own wall", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.deepEqual(state.tauntChances.blue, {
    targetOwner: "red",
    row: 0,
    col: 4,
  });
  assert.equal(applyAction(state, "blue", { type: "taunt" }), false);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "taunt" }), true);
  assert.equal(state.tauntChances.blue, null);
  assert.deepEqual(state.tauntEvent, {
    id: 1,
    speakerOwner: "blue",
    targetOwner: "red",
    row: 8,
    col: 4,
  });
  assert.equal(applyAction(state, "blue", { type: "taunt" }), false);
});

test("does not grant a taunt for a King away from its own wall", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);
  assert.equal(state.tauntChances.blue, null);
});

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
  state.turn = "blue";

  const action = chooseBotAction(state, "blue");
  assert.equal(action.type, "deploy");
  assert.equal(action.row, 4);
  assert.equal(action.col, 5);
  assert.equal(applyAction(state, "blue", action), true);
  assert.equal(state.winner, "blue");
});

test("allows a suicidal soldier and removes it immediately", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");
  state.board[4][5] = soldier("blue", "east");
  state.turn = "red";

  assert.equal(isSuicideDeployment(state, "red", "soldier", 4, 4), true);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 4, col: 4 }), true);
  assert.equal(state.board[4][4].owner, "blue");
  assert.equal(state.board[4][4].type, "soldier");
});

test("does not leak a hidden special through the suicide warning", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.turn = "blue";
  state.board[4][4] = {
    id: "hidden-general",
    owner: "red",
    type: "general",
    originalType: "general",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");

  assert.equal(isSuicideDeployment(state, "blue", "soldier", 4, 5), true);
  const publicState = stateForPlayer(state, "blue");
  assert.equal(publicState.board[4][4].type, "soldier");
  assert.equal(isSuicideDeployment(publicState, "blue", "soldier", 4, 5), false);
});

test("ends by territory when the next player has no deployable units", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  for (const type of ["soldier", "general", "diplomat", "wizard", "king"]) state.stock.blue[type] = 0;
  state.turn = "red";

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 1, col: 4 }), true);
  assert.notEqual(state.winner, null);
  assert.match(state.resultReason, /no legal deployment/);
});
