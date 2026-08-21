import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, stateForPlayer } from "../src/index.js";
import { validateGameState, validateNetworkMessage } from "../../../js/protocol.js";

test("accepts a player-visible state with only the viewer's stock", () => {
  const visibleState = stateForPlayer(createGameState(), "blue");

  assert.equal(validateGameState(visibleState), true);
  assert.equal(validateNetworkMessage({
    type: "match_start",
    roomCode: "ABC123",
    boardNumber: 1,
    player: "blue",
    state: visibleState,
  }), true);
});

test("rejects a visible state when both stocks are absent", () => {
  const visibleState = stateForPlayer(createGameState(), "blue");
  visibleState.stock.blue = null;

  assert.equal(validateGameState(visibleState), false);
});

test("rejects a network state whose visible stock belongs to the other player", () => {
  const visibleState = stateForPlayer(createGameState(), "red");

  assert.equal(validateNetworkMessage({
    type: "state",
    player: "blue",
    state: visibleState,
  }), false);
});
