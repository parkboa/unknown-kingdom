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
  first.firstDeployDone = { black: true, white: true };
  first.deploymentCount = { black: 6, white: 6 };
  first.board[2][2] = hiddenPiece("black", "general", "black-hidden");
  const second = structuredClone(first);
  second.board[2][2].type = "wizard";
  second.board[2][2].originalType = "wizard";
  second.log.push("presentation text that is not game information");
  second.aiThinking = true;
  second.aiSettings = { arbitrary: true };

  assert.equal(informationStateKey(first, "white"), informationStateKey(second, "white"));
  assert.notEqual(informationStateKey(first, "black"), informationStateKey(second, "black"));
});

test("information-state projection retains observations but removes UI state", () => {
  const state = createGameState("pve");
  state.selected = { row: 1, col: 2 };
  state.aiThinking = true;
  state.aiRank = "grandmaster";
  const informationState = informationStateForPlayer(state, "black");

  assert.equal(informationState.turn, "black");
  assert.deepEqual(informationState.stock.black, state.stock.black);
  assert.equal(informationState.stock.white, null);
  assert.equal(Object.hasOwn(informationState, "selected"), false);
  assert.equal(Object.hasOwn(informationState, "aiThinking"), false);
  assert.equal(Object.hasOwn(informationState, "aiRank"), false);
  assert.equal(Object.hasOwn(informationState, "log"), false);
});

test("information-state keys preserve a player's own action and observation history", () => {
  const first = createGameState("pve");
  const second = structuredClone(first);
  assert.equal(dispatchAction(first, "black", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  }).accepted, true);
  assert.equal(dispatchAction(second, "black", {
    type: "deploy", unitType: "king", row: 0, col: 3,
  }).accepted, true);

  // Make the current observations equal while retaining different remembered actions.
  second.board[0][4] = second.board[0][3];
  second.board[0][3] = null;
  second.lastMove = structuredClone(first.lastMove);
  assert.notEqual(informationStateKey(first, "black"), informationStateKey(second, "black"));
});

test("player views never expose the opponent's private information history", () => {
  const state = createGameState("pve");
  assert.equal(dispatchAction(state, "black", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  }).accepted, true);
  const blackView = informationStateForPlayer(state, "black");

  assert.deepEqual(Object.keys(blackView.informationHistory).sort(), ["black", "schemaVersion"]);
  assert.equal(blackView.informationHistory.black[0].ownAction.unitType, "king");
});

test("perfect-recall observations mask an opponent's hidden deployment identity", () => {
  const state = createGameState("pve");
  state.firstDeployDone.black = true;
  state.deploymentCount.black = 5;
  state.stock.black.king = 0;
  assert.equal(dispatchAction(state, "black", {
    type: "deploy", unitType: "general", row: 4, col: 4,
  }).accepted, true);

  assert.equal(state.informationHistory.black[0].ownAction.unitType, "general");
  assert.equal(state.informationHistory.white[0].ownAction, null);
  assert.equal(state.informationHistory.white[0].events[0].unitType, "soldier");
});

test("rejected actions do not enter perfect-recall history", () => {
  const state = createGameState("pve");
  assert.equal(dispatchAction(state, "white", {
    type: "deploy", unitType: "king", row: 8, col: 4,
  }).accepted, false);
  assert.equal(state.informationHistory.black.length, 0);
  assert.equal(state.informationHistory.white.length, 0);
});

test("resampled worlds preserve the source information state", () => {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 6, white: 6 };
  state.board[2][2] = hiddenPiece("black", "soldier", "black-hidden-1");
  state.board[3][3] = hiddenPiece("black", "soldier", "black-hidden-2");
  const sourceKey = informationStateKey(state, "white");
  const world = resampleFromInformationState(state, "white", () => 0.01);

  assert.equal(informationStateKey(world, "white"), sourceKey);
  assert.notEqual(world.stock.black, null);
  assert.equal(state.board[2][2].type, "soldier");
  assert.equal(state.stock.black.general, 1);
});

test("resampled worlds remain executable engine states", () => {
  const state = createGameState("pve");
  state.turn = "white";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 6, white: 6 };
  state.board[4][4] = hiddenPiece("black", "soldier", "black-hidden");
  state.board[3][4] = hiddenPiece("white", "soldier", "north");
  state.board[5][4] = hiddenPiece("white", "soldier", "south");
  state.board[4][3] = hiddenPiece("white", "soldier", "west");
  const world = resampleFromInformationState(state, "white", () => 0.01);

  const result = dispatchAction(world, "white", {
    type: "deploy", unitType: "soldier", row: 4, col: 5,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.events.some(({ type }) => type === "special_revealed"), true);
});

test("resampling can force a rule-consistent tactical hidden-special hypothesis", () => {
  const state = createGameState("pve");
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 6, white: 6 };
  state.board[4][4] = hiddenPiece("black", "soldier", "black-hidden");

  const world = resampleFromInformationState(state, "white", () => 0.5, {
    forcedAssignment: { row: 4, col: 4, type: "general" },
  });
  assert.equal(world.board[4][4].type, "general");
  assert.equal(world.stock.black.general, 0);
  assert.equal(informationStateKey(world, "white"), informationStateKey(state, "white"));
});

test("resampling honors a configured hidden-special type prior", () => {
  const state = createGameState("pve");
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 6, white: 6 };
  state.board[4][4] = hiddenPiece("black", "soldier", "black-hidden");

  const world = resampleFromInformationState(state, "white", () => 0.1, {
    specialDeploymentProbability: 1,
    specialTypeWeights: { general: 0, wizard: 1, diplomat: 0 },
  });
  assert.equal(world.board[4][4].type, "wizard");
});
