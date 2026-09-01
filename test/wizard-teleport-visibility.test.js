import assert from "node:assert/strict";
import test from "node:test";

import { teleportUiState } from "../js/render.js";

test("only the Wizard owner receives teleport controls and prompt", () => {
  const state = {
    mode: "pvp",
    teleporting: { owner: "black", row: 4, col: 4, reaction: true },
  };

  assert.deepEqual(teleportUiState(state, "black"), {
    canControl: true,
    showPrompt: true,
  });
  assert.deepEqual(teleportUiState(state, "white"), {
    canControl: false,
    showPrompt: false,
  });
});

test("dismissing the owner prompt does not grant control to the opponent", () => {
  const state = {
    mode: "pvp",
    teleporting: { owner: "white", row: 3, col: 5, reaction: true },
  };

  assert.deepEqual(teleportUiState(state, "white", true), {
    canControl: true,
    showPrompt: false,
  });
  assert.deepEqual(teleportUiState(state, "black", true), {
    canControl: false,
    showPrompt: false,
  });
});

test("teleport controls stay hidden when no Wizard move is pending", () => {
  assert.deepEqual(teleportUiState({ mode: "pvp", teleporting: null }, "black"), {
    canControl: false,
    showPrompt: false,
  });
});
