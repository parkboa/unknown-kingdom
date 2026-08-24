import assert from "node:assert/strict";
import test from "node:test";

import { teleportUiState } from "../js/render.js";

test("only the Wizard owner receives teleport controls and prompt", () => {
  const state = {
    mode: "pvp",
    teleporting: { owner: "red", row: 4, col: 4, reaction: true },
  };

  assert.deepEqual(teleportUiState(state, "red"), {
    canControl: true,
    showPrompt: true,
  });
  assert.deepEqual(teleportUiState(state, "blue"), {
    canControl: false,
    showPrompt: false,
  });
});

test("dismissing the owner prompt does not grant control to the opponent", () => {
  const state = {
    mode: "pvp",
    teleporting: { owner: "blue", row: 3, col: 5, reaction: true },
  };

  assert.deepEqual(teleportUiState(state, "blue", true), {
    canControl: true,
    showPrompt: false,
  });
  assert.deepEqual(teleportUiState(state, "red", true), {
    canControl: false,
    showPrompt: false,
  });
});

test("teleport controls stay hidden when no Wizard move is pending", () => {
  assert.deepEqual(teleportUiState({ mode: "pvp", teleporting: null }, "red"), {
    canControl: false,
    showPrompt: false,
  });
});
