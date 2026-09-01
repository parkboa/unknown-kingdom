import assert from "node:assert/strict";
import test from "node:test";

import { isOpponentLastMoveCell, visiblePieceIdentity } from "../js/render.js";

test("last-move highlight is shown only to the opponent at the played cell", () => {
  const state = {
    lastMove: { player: "black", unitType: "soldier", row: 2, col: 6 },
  };

  assert.equal(isOpponentLastMoveCell(state, "white", 2, 6), true);
  assert.equal(isOpponentLastMoveCell(state, "black", 2, 6), false);
  assert.equal(isOpponentLastMoveCell(state, "white", 6, 2), false);
});

test("pass and missing moves do not create a board highlight", () => {
  assert.equal(isOpponentLastMoveCell({ lastMove: { player: "black", action: "pass" } }, "white", 0, 0), false);
  assert.equal(isOpponentLastMoveCell({ lastMove: null }, "white", 0, 0), false);
});

test("tutorial mode hides the opponent last-move highlight", () => {
  const state = {
    mode: "tutorial",
    lastMove: { player: "black", unitType: "soldier", row: 2, col: 6 },
  };

  assert.equal(isOpponentLastMoveCell(state, "white", 2, 6), false);
});

test("an activated and revealed special keeps its original visible identity", () => {
  assert.deepEqual(visiblePieceIdentity({
    type: "soldier",
    originalType: "general",
    revealed: true,
    abilityUsed: true,
  }), {
    iconType: "general",
    isSpecial: true,
    isRetiredSpecial: true,
  });
});

test("a hidden converted special does not leak its original identity", () => {
  assert.deepEqual(visiblePieceIdentity({
    type: "soldier",
    originalType: "wizard",
    revealed: false,
    abilityUsed: true,
  }), {
    iconType: "soldier",
    isSpecial: false,
    isRetiredSpecial: false,
  });
});
