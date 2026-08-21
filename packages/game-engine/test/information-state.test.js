import test from "node:test";
import assert from "node:assert/strict";
import {
  createGameState,
  dispatchAction,
  informationStateForPlayer,
  informationStateKey,
  resampleFromInformationState,
} from "../src/index.js";

function hiddenPiece(owner, type, id) {
  return {
    id,
    owner,
    type,
    originalType: type,
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

test("information-state keys ignore hidden identities and presentation-only fields", () => {
  const first = createGameState("pve");
  first.firstDeployDone = { red: true, blue: true };
  first.deploymentCount = { red: 6, blue: 6 };
  first.board[2][2] = hiddenPiece("red", "general", "red-hidden");
  const second = structuredClone(first);
  second.board[2][2].type = "wizard";
  second.board[2][2].originalType = "wizard";
  second.log.push("presentation text that is not game information");
  second.aiThinking = true;
  second.aiSettings = { arbitrary: true };

  assert.equal(informationStateKey(first, "blue"), informationStateKey(second, "blue"));
  assert.notEqual(informationStateKey(first, "red"), informationStateKey(second, "red"));
});

test("information-state projection retains observations but removes UI state", () => {
  const state = createGameState("pve");
  state.selected = { row: 1, col: 2 };
  state.aiThinking = true;
  state.aiRank = "grandmaster";
  const informationState = informationStateForPlayer(state, "red");

  assert.equal(informationState.turn, "red");
  assert.deepEqual(informationState.stock.red, state.stock.red);
  assert.equal(informationState.stock.blue, null);
  assert.equal(Object.hasOwn(informationState, "selected"), false);
  assert.equal(Object.hasOwn(informationState, "aiThinking"), false);
  assert.equal(Object.hasOwn(informationState, "aiRank"), false);
  assert.equal(Object.hasOwn(informationState, "log"), false);
});

test("information-state keys preserve a player's own action and observation history", () => {
  const first = createGameState("pve");
  const second = structuredClone(first);
  assert.equal(dispatchAction(first, "red", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  }).accepted, true);
  assert.equal(dispatchAction(second, "red", {
    type: "deploy", unitType: "king", row: 0, col: 3,
  }).accepted, true);

  // Make the current observations equal while retaining different remembered actions.
  second.board[0][4] = second.board[0][3];
  second.board[0][3] = null;
  second.lastMove = structuredClone(first.lastMove);
  assert.notEqual(informationStateKey(first, "red"), informationStateKey(second, "red"));
});

test("player views never expose the opponent's private information history", () => {
  const state = createGameState("pve");
  assert.equal(dispatchAction(state, "red", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  }).accepted, true);
  const redView = informationStateForPlayer(state, "red");

  assert.deepEqual(Object.keys(redView.informationHistory).sort(), ["red", "schemaVersion"]);
  assert.equal(redView.informationHistory.red[0].ownAction.unitType, "king");
});

test("perfect-recall observations mask an opponent's hidden deployment identity", () => {
  const state = createGameState("pve");
  state.firstDeployDone.red = true;
  state.deploymentCount.red = 5;
  state.stock.red.king = 0;
  assert.equal(dispatchAction(state, "red", {
    type: "deploy", unitType: "general", row: 4, col: 4,
  }).accepted, true);

  assert.equal(state.informationHistory.red[0].ownAction.unitType, "general");
  assert.equal(state.informationHistory.blue[0].ownAction, null);
  assert.equal(state.informationHistory.blue[0].events[0].unitType, "soldier");
});

test("rejected actions do not enter perfect-recall history", () => {
  const state = createGameState("pve");
  assert.equal(dispatchAction(state, "blue", {
    type: "deploy", unitType: "king", row: 8, col: 4,
  }).accepted, false);
  assert.equal(state.informationHistory.red.length, 0);
  assert.equal(state.informationHistory.blue.length, 0);
});

test("resampled worlds preserve the source information state", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 6, blue: 6 };
  state.board[2][2] = hiddenPiece("red", "soldier", "red-hidden-1");
  state.board[3][3] = hiddenPiece("red", "soldier", "red-hidden-2");
  const sourceKey = informationStateKey(state, "blue");
  const world = resampleFromInformationState(state, "blue", () => 0.01);

  assert.equal(informationStateKey(world, "blue"), sourceKey);
  assert.notEqual(world.stock.red, null);
  assert.equal(state.board[2][2].type, "soldier");
  assert.equal(state.stock.red.general, 1);
});

test("resampled worlds remain executable engine states", () => {
  const state = createGameState("pve");
  state.turn = "blue";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 6, blue: 6 };
  state.board[4][4] = hiddenPiece("red", "soldier", "red-hidden");
  state.board[3][4] = hiddenPiece("blue", "soldier", "north");
  state.board[5][4] = hiddenPiece("blue", "soldier", "south");
  state.board[4][3] = hiddenPiece("blue", "soldier", "west");
  const world = resampleFromInformationState(state, "blue", () => 0.01);

  const result = dispatchAction(world, "blue", {
    type: "deploy", unitType: "soldier", row: 4, col: 5,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.events.some(({ type }) => type === "special_revealed"), true);
});

test("resampling can force a rule-consistent tactical hidden-special hypothesis", () => {
  const state = createGameState("pve");
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 6, blue: 6 };
  state.board[4][4] = hiddenPiece("red", "soldier", "red-hidden");

  const world = resampleFromInformationState(state, "blue", () => 0.5, {
    forcedAssignment: { row: 4, col: 4, type: "general" },
  });
  assert.equal(world.board[4][4].type, "general");
  assert.equal(world.stock.red.general, 0);
  assert.equal(informationStateKey(world, "blue"), informationStateKey(state, "blue"));
});

test("resampling honors a configured hidden-special type prior", () => {
  const state = createGameState("pve");
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 6, blue: 6 };
  state.board[4][4] = hiddenPiece("red", "soldier", "red-hidden");

  const world = resampleFromInformationState(state, "blue", () => 0.1, {
    specialDeploymentProbability: 1,
    specialTypeWeights: { general: 0, wizard: 1, diplomat: 0 },
  });
  assert.equal(world.board[4][4].type, "wizard");
});
