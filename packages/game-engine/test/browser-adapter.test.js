import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, isSuicideDeployment } from "../src/index.js";
import {
  dispatchSharedLocalAction,
  classifySharedLocalPlacement,
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

test("browser local adapter clones ordinary deployment and capture transitions", () => {
  const state = createGameState();
  state.mode = "pve";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "white";
  state.board[0][0] = soldier("black", "survivor");
  state.board[4][4] = soldier("black", "target");
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");

  const result = dispatchSharedLocalAction(
    state,
    "white",
    { type: "deploy", unitType: "soldier", row: 4, col: 5 },
    "white",
  );

  assert.equal(result.status, "accepted");
  assert.deepEqual(result.events.map(({ type }) => type), [
    "piece_deployed",
    "group_captured",
    "turn_changed",
  ]);
  assert.equal(result.state.board[4][4].owner, "white");
  assert.equal(result.state.turn, "black");
  assert.equal(state.board[4][4].owner, "black");
});

function surroundedSpecialState(type, turn = "white") {
  const state = createGameState();
  state.mode = "pve";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = turn;
  state.board[4][4] = {
    ...soldier("black", `hidden-${type}`),
    type,
    originalType: type,
  };
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");
  return state;
}

test("browser local adapter adopts Wizard move and stay decisions", () => {
  for (const action of [
    { type: "wizard_teleport", row: 0, col: 0 },
    { type: "wizard_stay" },
  ]) {
    const state = surroundedSpecialState("wizard");
    const surrounded = dispatchSharedLocalAction(
      state,
      "white",
      { type: "deploy", unitType: "soldier", row: 4, col: 5 },
      "white",
    );
    const activated = dispatchSharedLocalAction(
      surrounded.state,
      "black",
      { type: "activate_special" },
      "white",
    );

    assert.equal(activated.status, "accepted");
    assert.equal(activated.events.at(-1).type, "wizard_move_required");
    const decided = dispatchSharedLocalAction(activated.state, "black", action, "white");
    assert.equal(decided.status, "accepted");
    assert.equal(decided.events[0].type, action.type === "wizard_stay" ? "wizard_stayed" : "wizard_moved");
    assert.equal(decided.state.teleporting, null);
    assert.equal(decided.state.turn, "black");
  }
});

test("browser local suicide checks use the player-filtered shared state", () => {
  const state = createGameState();
  state.mode = "pve";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "black";
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");
  state.board[4][5] = soldier("white", "east");

  assert.equal(classifySharedLocalPlacement(state, "black", "soldier", 4, 4), "suicide");
  assert.equal(state.board[4][4], null);
});

test("scenario actions resolve captures without advancing the normal match turn", () => {
  const state = createGameState();
  state.mode = "puzzle";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "white";
  state.board[4][4] = soldier("black", "target");
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");

  const result = dispatchSharedLocalAction(
    state,
    "white",
    { type: "deploy", unitType: "soldier", row: 4, col: 5 },
    "white",
    { advanceTurn: false },
  );

  assert.equal(result.status, "accepted");
  assert.equal(result.state.turn, "white");
  assert.equal(result.state.winner, null);
  assert.equal(result.state.board[4][4].owner, "white");
  assert.equal(result.events.some(({ type }) => type === "turn_changed"), false);
});

test("scenario special reactions restore resumeTurn without running match completion", () => {
  const state = surroundedSpecialState("general");
  state.mode = "tutorial";
  const surrounded = dispatchSharedLocalAction(
    state,
    "white",
    { type: "deploy", unitType: "soldier", row: 4, col: 5 },
    "white",
    { advanceTurn: false },
  );
  const activated = dispatchSharedLocalAction(
    surrounded.state,
    "black",
    { type: "activate_special" },
    "white",
    { advanceTurn: false },
  );

  assert.equal(activated.status, "accepted");
  assert.equal(activated.state.turn, "black");
  assert.equal(activated.state.resumeTurn, null);
  assert.equal(activated.state.winner, null);
});

test("Challenge king capture keeps the scenario turn policy while reporting the real winner", () => {
  const state = createGameState();
  state.mode = "puzzle";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "white";
  state.board[4][4] = { ...soldier("black", "black-king"), type: "king", originalType: "king", revealed: true };
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");

  const result = dispatchSharedLocalAction(
    state,
    "white",
    { type: "deploy", unitType: "soldier", row: 4, col: 5 },
    "white",
    { advanceTurn: false },
  );

  assert.equal(result.status, "accepted");
  assert.equal(result.state.winner, "white");
  assert.equal(result.events.at(-1).type, "match_ended");
  assert.equal(result.events.some(({ type }) => type === "turn_changed"), false);
});

test("tutorial scripted surround and General activation are both shared-engine actions", () => {
  const state = createGameState();
  state.mode = "tutorial";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "white";
  state.board[3][4] = soldier("black", "north");
  state.board[5][4] = soldier("black", "south");
  state.board[4][3] = soldier("black", "west");

  assert.equal(classifySharedLocalPlacement(state, "white", "general", 4, 4), null);
  const placed = dispatchSharedLocalAction(
    state,
    "white",
    { type: "deploy", unitType: "general", row: 4, col: 4 },
    "white",
    { advanceTurn: false },
  );
  placed.state.turn = "black";
  const surrounded = dispatchSharedLocalAction(
    placed.state,
    "black",
    { type: "deploy", unitType: "soldier", row: 4, col: 5 },
    "white",
    { advanceTurn: false },
  );
  const activated = dispatchSharedLocalAction(
    surrounded.state,
    "white",
    { type: "activate_special" },
    "white",
    { advanceTurn: false },
  );

  assert.equal(surrounded.state.pendingSpecial?.type, "general");
  assert.equal(activated.status, "accepted");
  assert.equal(activated.state.pendingSpecial, null);
  assert.equal(activated.state.turn, "white");
  assert.equal(activated.state.winner, null);
  assert.equal(activated.state.stats.captures.white, 4);
  assert.equal(activated.events.some(({ type }) => type === "special_activated"), true);
});

test("browser adapter adopts explicit no-move pass and territory completion", () => {
  const state = createGameState();
  state.mode = "pve";
  state.turn = "white";
  state.firstDeployDone = { black: true, white: true };
  state.stock.white = { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.board[0][0] = soldier("black", "black-1");
  state.board[0][1] = soldier("black", "black-2");
  state.board[0][2] = soldier("black", "black-3");
  state.board[0][3] = soldier("black", "black-4");
  state.board[8][4] = { ...soldier("white", "white-king"), type: "king", originalType: "king", revealed: true };

  const result = dispatchSharedLocalAction(state, "white", { type: "pass" }, "white");

  assert.equal(result.status, "accepted");
  assert.deepEqual(result.visibleEvents.map(({ type }) => type), ["turn_passed", "match_ended"]);
  assert.equal(result.state.winner, "black");
  assert.equal(state.winner, null);
});

test("browser adapter adopts timeout as a shared-engine action", () => {
  const state = createGameState("pve");
  assert.equal(
    dispatchSharedLocalAction(state, "black", { type: "timeout" }, "black").status,
    "rejected",
  );
  const result = dispatchSharedLocalAction(
    state,
    "black",
    { type: "timeout" },
    "black",
    { authoritative: true },
  );

  assert.equal(result.status, "accepted");
  assert.equal(result.state.winner, "white");
  assert.equal(state.winner, null);
  assert.deepEqual(result.visibleEvents, [{
    type: "match_ended",
    winner: "white",
    reason: "timeout",
    defeatedPlayer: "black",
  }]);
});

test("a special dropped into an enclosed point is flagged for confirmation, unlike a plain suicide", () => {
  const state = createGameState();
  state.mode = "pve";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "black";
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");
  state.board[4][5] = soldier("white", "east");

  // The special survives here — it fires on placement and clears its neighbours — so it
  // must not be described as dying, but it still needs a confirmation step.
  assert.equal(classifySharedLocalPlacement(state, "black", "general", 4, 4), "special_detonation");
  assert.equal(classifySharedLocalPlacement(state, "black", "diplomat", 4, 4), "special_detonation");
  assert.equal(classifySharedLocalPlacement(state, "black", "soldier", 4, 4), "suicide");

  // The match-ending machinery reads isSuicideDeployment, which must keep its old answer.
  assert.equal(isSuicideDeployment(state, "black", "general", 4, 4), false);
  assert.equal(isSuicideDeployment(state, "black", "soldier", 4, 4), true);
});
