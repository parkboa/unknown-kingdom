import test from "node:test";
import assert from "node:assert/strict";
import { createGameState } from "../src/index.js";
import {
  dispatchSharedLocalAction,
  dispatchSharedPveAction,
  isSharedLocalSuicideDeployment,
  isSharedPveSuicideDeployment,
  previewSharedPveDeployment,
} from "../../../js/shared-engine-adapter.mjs";

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

test("browser PvE adapter adopts ordinary shared-engine deployment and capture transitions", () => {
  const state = createGameState();
  state.mode = "pve";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "blue";
  state.board[0][0] = soldier("red", "survivor");
  state.board[4][4] = soldier("red", "target");
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");

  const result = previewSharedPveDeployment(state, "blue", "soldier", 4, 5);

  assert.equal(result.status, "accepted");
  assert.deepEqual(result.events.map(({ type }) => type), [
    "piece_deployed",
    "group_captured",
    "turn_changed",
  ]);
  assert.equal(result.state.board[4][4].owner, "blue");
  assert.equal(result.state.turn, "red");
  assert.equal(state.board[4][4].owner, "red");
});

function surroundedSpecialState(type, turn = "blue") {
  const state = createGameState();
  state.mode = "pve";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = turn;
  state.board[4][4] = {
    ...soldier("red", `hidden-${type}`),
    type,
    originalType: type,
  };
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");
  return state;
}

test("browser PvE adapter adopts General and Diplomat reaction actions", () => {
  for (const type of ["general", "diplomat"]) {
    const state = surroundedSpecialState(type);
    const surrounded = previewSharedPveDeployment(state, "blue", "soldier", 4, 5, "blue");

    assert.equal(surrounded.status, "accepted");
    assert.equal(surrounded.events.some((event) => event.type === "special_revealed"), true);
    assert.equal(surrounded.state.pendingSpecial.type, type);
    assert.equal(state.pendingSpecial, null);

    const activated = dispatchSharedPveAction(
      surrounded.state,
      "red",
      { type: "activate_special" },
      "blue",
    );
    assert.equal(activated.status, "accepted");
    assert.equal(activated.events[0].type, "special_activated");
    assert.equal(activated.state.pendingSpecial, null);
    assert.equal(activated.state.turn, "red");
    assert.equal(activated.state.board[4][4].type, "soldier");
  }
});

test("browser PvE adapter adopts Wizard move and stay decisions", () => {
  for (const action of [
    { type: "wizard_teleport", row: 0, col: 0 },
    { type: "wizard_stay" },
  ]) {
    const state = surroundedSpecialState("wizard");
    const surrounded = previewSharedPveDeployment(state, "blue", "soldier", 4, 5, "blue");
    const activated = dispatchSharedPveAction(surrounded.state, "red", { type: "activate_special" }, "blue");

    assert.equal(activated.status, "accepted");
    assert.equal(activated.events.at(-1).type, "wizard_move_required");
    const decided = dispatchSharedPveAction(activated.state, "red", action, "blue");
    assert.equal(decided.status, "accepted");
    assert.equal(decided.events[0].type, action.type === "wizard_stay" ? "wizard_stayed" : "wizard_moved");
    assert.equal(decided.state.teleporting, null);
    assert.equal(decided.state.turn, "red");
  }
});

test("browser PvE adapter adopts shared match completion", () => {
  const state = createGameState();
  state.mode = "pve";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "blue";
  state.board[4][4] = { ...soldier("red", "red-king"), type: "king", originalType: "king", revealed: true };
  state.board[8][4] = { ...soldier("blue", "blue-king"), type: "king", originalType: "king", revealed: true };
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");

  const result = previewSharedPveDeployment(state, "blue", "soldier", 4, 5, "blue");

  assert.equal(result.status, "accepted");
  assert.equal(result.events.at(-1).type, "match_ended");
  assert.equal(result.events.at(-1).reason, "king_captured");
  assert.equal(result.state.winner, "blue");
  assert.equal(state.winner, null);
});

test("browser PvE suicide checks use the player-filtered shared state", () => {
  const state = createGameState();
  state.mode = "pve";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "red";
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");
  state.board[4][5] = soldier("blue", "east");

  assert.equal(isSharedPveSuicideDeployment(state, "red", "soldier", 4, 4), true);
  assert.equal(state.board[4][4], null);
});

test("scenario actions resolve captures without advancing the normal match turn", () => {
  const state = createGameState();
  state.mode = "puzzle";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "blue";
  state.board[4][4] = soldier("red", "target");
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");

  const result = dispatchSharedLocalAction(
    state,
    "blue",
    { type: "deploy", unitType: "soldier", row: 4, col: 5 },
    "blue",
    { advanceTurn: false },
  );

  assert.equal(result.status, "accepted");
  assert.equal(result.state.turn, "blue");
  assert.equal(result.state.winner, null);
  assert.equal(result.state.board[4][4].owner, "blue");
  assert.equal(result.events.some(({ type }) => type === "turn_changed"), false);
});

test("scenario special reactions restore resumeTurn without running match completion", () => {
  const state = surroundedSpecialState("general");
  state.mode = "tutorial";
  const surrounded = dispatchSharedLocalAction(
    state,
    "blue",
    { type: "deploy", unitType: "soldier", row: 4, col: 5 },
    "blue",
    { advanceTurn: false },
  );
  const activated = dispatchSharedLocalAction(
    surrounded.state,
    "red",
    { type: "activate_special" },
    "blue",
    { advanceTurn: false },
  );

  assert.equal(activated.status, "accepted");
  assert.equal(activated.state.turn, "red");
  assert.equal(activated.state.resumeTurn, null);
  assert.equal(activated.state.winner, null);
});

test("Challenge king capture keeps the scenario turn policy while reporting the real winner", () => {
  const state = createGameState();
  state.mode = "puzzle";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "blue";
  state.board[4][4] = { ...soldier("red", "red-king"), type: "king", originalType: "king", revealed: true };
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");

  const result = dispatchSharedLocalAction(
    state,
    "blue",
    { type: "deploy", unitType: "soldier", row: 4, col: 5 },
    "blue",
    { advanceTurn: false },
  );

  assert.equal(result.status, "accepted");
  assert.equal(result.state.winner, "blue");
  assert.equal(result.events.at(-1).type, "match_ended");
  assert.equal(result.events.some(({ type }) => type === "turn_changed"), false);
});

test("tutorial scripted surround and General activation are both shared-engine actions", () => {
  const state = createGameState();
  state.mode = "tutorial";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "blue";
  state.board[3][4] = soldier("red", "north");
  state.board[5][4] = soldier("red", "south");
  state.board[4][3] = soldier("red", "west");

  assert.equal(isSharedLocalSuicideDeployment(state, "blue", "general", 4, 4), false);
  const placed = dispatchSharedLocalAction(
    state,
    "blue",
    { type: "deploy", unitType: "general", row: 4, col: 4 },
    "blue",
    { advanceTurn: false },
  );
  placed.state.turn = "red";
  const surrounded = dispatchSharedLocalAction(
    placed.state,
    "red",
    { type: "deploy", unitType: "soldier", row: 4, col: 5 },
    "blue",
    { advanceTurn: false },
  );
  const activated = dispatchSharedLocalAction(
    surrounded.state,
    "blue",
    { type: "activate_special" },
    "blue",
    { advanceTurn: false },
  );

  assert.equal(surrounded.state.pendingSpecial?.type, "general");
  assert.equal(activated.status, "accepted");
  assert.equal(activated.state.pendingSpecial, null);
  assert.equal(activated.state.turn, "blue");
  assert.equal(activated.state.winner, null);
  assert.equal(activated.state.stats.captures.blue, 4);
  assert.equal(activated.events.some(({ type }) => type === "special_activated"), true);
});

test("browser adapter adopts explicit no-move pass and territory completion", () => {
  const state = createGameState();
  state.mode = "pve";
  state.turn = "blue";
  state.firstDeployDone = { red: true, blue: true };
  state.stock.blue = { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.board[0][0] = soldier("red", "red-1");
  state.board[0][1] = soldier("red", "red-2");
  state.board[0][2] = soldier("red", "red-3");
  state.board[0][3] = soldier("red", "red-4");
  state.board[8][4] = { ...soldier("blue", "blue-king"), type: "king", originalType: "king", revealed: true };

  const result = dispatchSharedLocalAction(state, "blue", { type: "pass" }, "blue");

  assert.equal(result.status, "accepted");
  assert.deepEqual(result.visibleEvents.map(({ type }) => type), ["turn_passed", "match_ended"]);
  assert.equal(result.state.winner, "red");
  assert.equal(state.winner, null);
});
