import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, stateForPlayer } from "../src/index.js";
import { validateGameState, validateNetworkMessage } from "../../../js/protocol.js";

test("accepts a player-visible state with only the viewer's stock", () => {
  const visibleState = stateForPlayer(createGameState(), "white");

  assert.equal(validateGameState(visibleState), true);
  assert.equal(validateNetworkMessage({
    type: "match_start",
    roomCode: "ABC123",
    boardNumber: 1,
    player: "white",
    state: visibleState,
  }), true);
});

test("rejects a visible state when both stocks are absent", () => {
  const visibleState = stateForPlayer(createGameState(), "white");
  visibleState.stock.white = null;

  assert.equal(validateGameState(visibleState), false);
});

test("rejects a network state whose visible stock belongs to the other player", () => {
  const visibleState = stateForPlayer(createGameState(), "black");

  assert.equal(validateNetworkMessage({
    type: "state",
    player: "white",
    state: visibleState,
  }), false);
});

test("accepts reconnect presence only as a boolean", () => {
  const visibleState = stateForPlayer(createGameState(), "black");
  assert.equal(validateNetworkMessage({
    type: "state",
    player: "black",
    opponentConnected: false,
    state: visibleState,
  }), true);
  assert.equal(validateNetworkMessage({
    type: "state",
    player: "black",
    opponentConnected: "no",
    state: visibleState,
  }), false);
});
