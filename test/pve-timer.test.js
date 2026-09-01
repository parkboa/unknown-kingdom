import assert from "node:assert/strict";
import test from "node:test";

import {
  pveDeadlineAction,
  resolvePveTurnDeadline,
} from "../js/pve-timer-controller.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("AI timer defaults on and persists an explicit choice", async () => {
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;

  try {
    const settings = await import(`../js/settings.js?timer-test=${Date.now()}`);

    assert.equal(settings.isPveTimerEnabled(), true);
    settings.setPveTimerEnabled(false);
    assert.equal(settings.isPveTimerEnabled(), false);
    assert.equal(storage.getItem("daeguk-pve-timer"), "disabled");
    settings.setPveTimerEnabled(true);
    assert.equal(settings.isPveTimerEnabled(), true);
    assert.equal(storage.getItem("daeguk-pve-timer"), "enabled");
  } finally {
    delete globalThis.localStorage;
  }
});

test("AI timer deadline exists only during the human PvE turn", () => {
  const base = {
    currentDeadline: null,
    now: 1_000,
    limitMs: 30_000,
    developerMode: false,
    timerEnabled: true,
    mode: "pve",
    winner: null,
    gameActive: true,
    turn: "black",
    humanPlayer: "black",
  };

  assert.equal(resolvePveTurnDeadline(base), 31_000);
  assert.equal(resolvePveTurnDeadline({ ...base, currentDeadline: 15_000 }), 15_000);
  assert.equal(resolvePveTurnDeadline({ ...base, timerEnabled: false }), null);
  assert.equal(resolvePveTurnDeadline({ ...base, developerMode: true }), null);
  assert.equal(resolvePveTurnDeadline({ ...base, turn: "white" }), null);
  assert.equal(resolvePveTurnDeadline({ ...base, mode: "tutorial" }), null);
  assert.equal(resolvePveTurnDeadline({ ...base, winner: "black" }), null);
  assert.equal(resolvePveTurnDeadline({ ...base, gameActive: false }), null);
});

test("AI timer expiry chooses the authoritative timeout or a legal pass", () => {
  assert.deepEqual(pveDeadlineAction(true), {
    action: { type: "timeout" },
    options: { authoritative: true },
  });
  assert.deepEqual(pveDeadlineAction(false), {
    action: { type: "pass" },
    options: undefined,
  });
});
