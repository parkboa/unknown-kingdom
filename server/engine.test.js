import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  chooseBotAction,
  createGameState,
  dispatchAction,
  eventsForPlayer,
  getLegalActions,
  isSuicideDeployment,
  stateForPlayer,
} from "./engine.js";
import * as sharedEngine from "@daeguk/game-engine";
import { chooseBotAction as sharedChooseBotAction } from "@daeguk/game-engine/bot";

test("server adapter exposes the shared engine package API", () => {
  assert.equal(applyAction, sharedEngine.applyAction);
  assert.equal(createGameState, sharedEngine.createGameState);
  assert.equal(dispatchAction, sharedEngine.dispatchAction);
  assert.equal(eventsForPlayer, sharedEngine.eventsForPlayer);
  assert.equal(getLegalActions, sharedEngine.getLegalActions);
  assert.equal(isSuicideDeployment, sharedEngine.isSuicideDeployment);
  assert.equal(stateForPlayer, sharedEngine.stateForPlayer);
  assert.equal(chooseBotAction, sharedChooseBotAction);
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
