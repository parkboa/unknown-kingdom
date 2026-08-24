import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isOpponentLastMoveCell } from "../js/render.js";

test("last-move highlight is shown only to the opponent at the played cell", () => {
  const state = {
    lastMove: { player: "red", unitType: "soldier", row: 2, col: 6 },
  };

  assert.equal(isOpponentLastMoveCell(state, "blue", 2, 6), true);
  assert.equal(isOpponentLastMoveCell(state, "red", 2, 6), false);
  assert.equal(isOpponentLastMoveCell(state, "blue", 6, 2), false);
});

test("pass and missing moves do not create a board highlight", () => {
  assert.equal(isOpponentLastMoveCell({ lastMove: { player: "red", action: "pass" } }, "blue", 0, 0), false);
  assert.equal(isOpponentLastMoveCell({ lastMove: null }, "blue", 0, 0), false);
});

test("tutorial scene transitions clear the previous last move", async () => {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const resetBoardSource = appSource.match(/function resetTutorialBoard\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const advanceSource = appSource.match(/function advanceTutorial\(\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(resetBoardSource, /state\.lastMove = null/);
  assert.match(advanceSource, /state\.lastMove = null/);
});
