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

function surroundState(type, turn = "white") {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = turn;
  state.board[4][4] = piece("black", type, `black-${type}`);
  state.board[3][4] = piece("white", "soldier", "north");
  state.board[5][4] = piece("white", "soldier", "south");
  state.board[4][3] = piece("white", "soldier", "west");
  return state;
}

test("dispatchAction returns no events for a rejected action", () => {
  const state = createGameState();
  assert.deepEqual(
    dispatchAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 4 }),
    { accepted: false, events: [] },
  );
});

test("deployment events are ordered and hide an unrevealed special from the opponent", () => {
  const state = createGameState();
  state.firstDeployDone.black = true;
  state.deploymentCount = { black: 5, white: 5 };

  const result = dispatchAction(state, "black", { type: "deploy", unitType: "general", row: 4, col: 4 });

  assert.equal(result.accepted, true);
  assert.deepEqual(result.events.map(({ type }) => type), ["piece_deployed", "turn_changed"]);
  assert.equal(result.events[0].pieceId, "piece-1");
  assert.equal(result.events[0].unitType, "general");
  assert.equal(eventsForPlayer(result.events, "black")[0].unitType, "general");
  assert.equal(eventsForPlayer(result.events, "white")[0].unitType, "soldier");
  assert.equal(JSON.stringify(eventsForPlayer(result.events, "white")).includes("general"), false);
  assert.equal("revealed" in eventsForPlayer(result.events, "white")[0], false);
});

test("surrounding and activating a General emits ordered reaction events", () => {
  const state = surroundState("general");

  const surrounded = dispatchAction(state, "white", {
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

  const activated = dispatchAction(state, "black", { type: "activate_special" });
  assert.equal(activated.accepted, true);
  assert.equal(activated.events[0].type, "special_activated");
  assert.equal(activated.events[0].unitType, "general");
  assert.equal(activated.events.filter(({ type }) => type === "piece_removed").length, 4);
  assert.equal(state.turn, "black");
});

test("Diplomat and Wizard decisions emit their domain events", () => {
  const diplomatState = surroundState("diplomat");
  dispatchAction(diplomatState, "white", { type: "deploy", unitType: "soldier", row: 4, col: 5 });
  const diplomat = dispatchAction(diplomatState, "black", { type: "activate_special" });
  assert.equal(diplomat.events.some(({ type }) => type === "pieces_converted"), true);

  const wizardState = surroundState("wizard");
  dispatchAction(wizardState, "white", { type: "deploy", unitType: "soldier", row: 4, col: 5 });
  const activated = dispatchAction(wizardState, "black", { type: "activate_special" });
  assert.equal(activated.events.at(-1).type, "wizard_move_required");

  const stayed = dispatchAction(wizardState, "black", { type: "wizard_stay" });
  assert.equal(stayed.events[0].type, "wizard_stayed");

  const movingState = surroundState("wizard");
  dispatchAction(movingState, "white", { type: "deploy", unitType: "soldier", row: 4, col: 5 });
  dispatchAction(movingState, "black", { type: "activate_special" });
  const moved = dispatchAction(movingState, "black", { type: "wizard_teleport", row: 0, col: 0 });
  assert.equal(moved.events[0].type, "wizard_moved");
  assert.deepEqual(
    { fromRow: moved.events[0].fromRow, fromCol: moved.events[0].fromCol, row: moved.events[0].row, col: moved.events[0].col },
    { fromRow: 4, fromCol: 4, row: 0, col: 0 },
  );
});

test("capture, victory, and taunt events carry data without presentation text", () => {
  const state = createGameState();
  dispatchAction(state, "black", { type: "deploy", unitType: "king", row: 4, col: 4 });
  dispatchAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 4 });
  state.board[3][4] = piece("white", "soldier", "north");
  state.board[5][4] = piece("white", "soldier", "south");
  state.board[4][3] = piece("white", "soldier", "west");
  state.deploymentCount.black = 5;
  state.turn = "white";

  const victory = dispatchAction(state, "white", { type: "deploy", unitType: "soldier", row: 4, col: 5 });
  assert.deepEqual(victory.events.map(({ type }) => type), [
    "piece_deployed",
    "group_captured",
    "match_ended",
  ]);
  assert.equal(victory.events[2].winner, "white");
  assert.equal(victory.events.every((event) => !("message" in event)), true);

  const tauntState = createGameState();
  const wallKing = dispatchAction(tauntState, "black", { type: "deploy", unitType: "king", row: 0, col: 4 });
  assert.deepEqual(wallKing.events.map(({ type }) => type), [
    "piece_deployed",
    "taunt_used",
    "turn_changed",
  ]);
  assert.equal(wallKing.events[1].speakerOwner, "white");
  assert.equal(wallKing.events[1].targetOwner, "black");
});

test("removed hidden special identities are only visible to their owner", () => {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "black";
  state.resumeTurn = "black";
  state.board[4][4] = piece("black", "general", "black-general", true);
  state.board[4][5] = piece("white", "wizard", "white-wizard");
  state.pendingSpecial = { row: 4, col: 4, owner: "black", type: "general", captor: "white" };

  const result = dispatchAction(state, "black", { type: "activate_special" });
  const removed = result.events.find(({ type }) => type === "piece_removed");
  assert.equal(removed.unitType, "wizard");
  assert.equal(eventsForPlayer([removed], "white")[0].unitType, "wizard");
  assert.equal(eventsForPlayer([removed], "black")[0].unitType, "soldier");
});
