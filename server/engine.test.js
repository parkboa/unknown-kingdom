import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  createGameState,
  declareWinner,
  dispatchAction,
  eventsForPlayer,
  getLegalActions,
  hasLegalDeployment,
  isSuicideDeployment,
  stateForPlayer,
} from "./engine.js";
import * as sharedEngine from "@daeguk/game-engine";
import { declineRematch, startAutomaticTauntLock } from "./room-actions.js";

test("server adapter exposes the shared engine package API", () => {
  assert.equal(applyAction, sharedEngine.applyAction);
  assert.equal(createGameState, sharedEngine.createGameState);
  assert.equal(declareWinner, sharedEngine.declareWinner);
  assert.equal(dispatchAction, sharedEngine.dispatchAction);
  assert.equal(eventsForPlayer, sharedEngine.eventsForPlayer);
  assert.equal(getLegalActions, sharedEngine.getLegalActions);
  assert.equal(hasLegalDeployment, sharedEngine.hasLegalDeployment);
  assert.equal(isSuicideDeployment, sharedEngine.isSuicideDeployment);
  assert.equal(stateForPlayer, sharedEngine.stateForPlayer);
});

test("server adapter executes an authoritative shared-engine action", () => {
  const state = createGameState();
  const result = dispatchAction(state, "red", {
    type: "deploy",
    unitType: "king",
    row: 0,
    col: 4,
  });

  assert.equal(result.accepted, true);
  assert.equal(state.board[0][4]?.type, "king");
  assert.equal(state.turn, "blue");
  assert.equal(result.events.some(({ type }) => type === "piece_deployed"), true);
});

test("declining a rematch clears the offer and notifies both players", () => {
  const black = { id: "black" };
  const white = { id: "white" };
  const room = {
    code: "TEST1",
    players: { red: black, blue: white },
    rematch: new Set(["red"]),
  };
  const deliveries = [];

  declineRematch(room, "blue", (socket, message) => deliveries.push({ socket, message }));

  assert.equal(room.rematch.size, 0);
  assert.deepEqual(deliveries, [
    { socket: black, message: { type: "rematch_declined", byPlayer: "blue" } },
    { socket: white, message: { type: "rematch_declined", byPlayer: "blue" } },
  ]);
});

test("an automatic King-wall taunt locks deployment for exactly three seconds", () => {
  const room = { state: createGameState() };
  const action = { type: "deploy", unitType: "king", row: 0, col: 4 };
  assert.equal(applyAction(room.state, "red", action), true);

  assert.equal(startAutomaticTauntLock(room, "red", action, 10_000, 3_000), true);
  assert.equal(room.state.tauntUntil, 13_000);
});
