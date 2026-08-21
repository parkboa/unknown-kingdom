import test from "node:test";
import assert from "node:assert/strict";
import {
  dispatchAction,
  eventsForPlayer,
  createGameState,
} from "../src/index.js";

function piece(owner, type, id, revealed = false) {
  return {
    id,
    owner,
    type,
    originalType: type,
    revealed: revealed || type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

function surroundState(type, turn = "blue") {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = turn;
  state.board[4][4] = piece("red", type, `red-${type}`);
  state.board[3][4] = piece("blue", "soldier", "north");
  state.board[5][4] = piece("blue", "soldier", "south");
  state.board[4][3] = piece("blue", "soldier", "west");
  return state;
}

test("dispatchAction returns no events for a rejected action", () => {
  const state = createGameState();
  assert.deepEqual(
    dispatchAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }),
    { accepted: false, events: [] },
  );
});

test("deployment events are ordered and hide an unrevealed special from the opponent", () => {
  const state = createGameState();
  state.firstDeployDone.red = true;
  state.deploymentCount = { red: 5, blue: 5 };

  const result = dispatchAction(state, "red", { type: "deploy", unitType: "general", row: 4, col: 4 });

  assert.equal(result.accepted, true);
  assert.deepEqual(result.events.map(({ type }) => type), ["piece_deployed", "turn_changed"]);
  assert.equal(result.events[0].pieceId, "piece-1");
  assert.equal(result.events[0].unitType, "general");
  assert.equal(eventsForPlayer(result.events, "red")[0].unitType, "general");
  assert.equal(eventsForPlayer(result.events, "blue")[0].unitType, "soldier");
  assert.equal(JSON.stringify(eventsForPlayer(result.events, "blue")).includes("general"), false);
  assert.equal("revealed" in eventsForPlayer(result.events, "blue")[0], false);
});

test("surrounding and activating a General emits ordered reaction events", () => {
  const state = surroundState("general");

  const surrounded = dispatchAction(state, "blue", {
    type: "deploy",
    unitType: "soldier",
    row: 4,
    col: 5,
  });
  assert.deepEqual(surrounded.events.map(({ type }) => type), [
    "piece_deployed",
    "special_revealed",
    "turn_changed",
  ]);
  assert.equal(surrounded.events[1].unitType, "general");

  const activated = dispatchAction(state, "red", { type: "activate_special" });
  assert.equal(activated.accepted, true);
  assert.equal(activated.events[0].type, "special_activated");
  assert.equal(activated.events[0].unitType, "general");
  assert.equal(activated.events.filter(({ type }) => type === "piece_removed").length, 4);
  assert.equal(state.turn, "red");
});

test("Diplomat and Wizard decisions emit their domain events", () => {
  const diplomatState = surroundState("diplomat");
  dispatchAction(diplomatState, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 });
  const diplomat = dispatchAction(diplomatState, "red", { type: "activate_special" });
  assert.equal(diplomat.events.some(({ type }) => type === "pieces_converted"), true);

  const wizardState = surroundState("wizard");
  dispatchAction(wizardState, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 });
  const activated = dispatchAction(wizardState, "red", { type: "activate_special" });
  assert.equal(activated.events.at(-1).type, "wizard_move_required");

  const stayed = dispatchAction(wizardState, "red", { type: "wizard_stay" });
  assert.equal(stayed.events[0].type, "wizard_stayed");

  const movingState = surroundState("wizard");
  dispatchAction(movingState, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 });
  dispatchAction(movingState, "red", { type: "activate_special" });
  const moved = dispatchAction(movingState, "red", { type: "wizard_teleport", row: 0, col: 0 });
  assert.equal(moved.events[0].type, "wizard_moved");
  assert.deepEqual(
    { fromRow: moved.events[0].fromRow, fromCol: moved.events[0].fromCol, row: moved.events[0].row, col: moved.events[0].col },
    { fromRow: 4, fromCol: 4, row: 0, col: 0 },
  );
});

test("capture, victory, and taunt events carry data without presentation text", () => {
  const state = createGameState();
  dispatchAction(state, "red", { type: "deploy", unitType: "king", row: 4, col: 4 });
  dispatchAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 });
  state.board[3][4] = piece("blue", "soldier", "north");
  state.board[5][4] = piece("blue", "soldier", "south");
  state.board[4][3] = piece("blue", "soldier", "west");
  state.deploymentCount.red = 5;
  state.turn = "blue";

  const victory = dispatchAction(state, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 });
  assert.deepEqual(victory.events.map(({ type }) => type), [
    "piece_deployed",
    "group_captured",
    "match_ended",
  ]);
  assert.equal(victory.events[2].winner, "blue");
  assert.equal(victory.events.every((event) => !("message" in event)), true);

  const tauntState = createGameState();
  const wallKing = dispatchAction(tauntState, "red", { type: "deploy", unitType: "king", row: 0, col: 4 });
  assert.deepEqual(wallKing.events.map(({ type }) => type), [
    "piece_deployed",
    "taunt_used",
    "turn_changed",
  ]);
  assert.equal(wallKing.events[1].speakerOwner, "blue");
  assert.equal(wallKing.events[1].targetOwner, "red");
});

test("removed hidden special identities are only visible to their owner", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "red";
  state.resumeTurn = "red";
  state.board[4][4] = piece("red", "general", "red-general", true);
  state.board[4][5] = piece("blue", "wizard", "blue-wizard");
  state.pendingSpecial = { row: 4, col: 4, owner: "red", type: "general", captor: "blue" };

  const result = dispatchAction(state, "red", { type: "activate_special" });
  const removed = result.events.find(({ type }) => type === "piece_removed");
  assert.equal(removed.unitType, "wizard");
  assert.equal(eventsForPlayer([removed], "blue")[0].unitType, "wizard");
  assert.equal(eventsForPlayer([removed], "red")[0].unitType, "soldier");
});
