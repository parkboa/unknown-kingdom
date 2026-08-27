import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("AI timer UI is placed between difficulty and side selection", async () => {
  const indexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const difficultyIndex = indexSource.indexOf('id="pveRankList"');
  const timerIndex = indexSource.indexOf('class="pve-timer-actions"');
  const sideIndex = indexSource.indexOf('data-i18n="choosePreferredSide"');

  assert.ok(difficultyIndex >= 0);
  assert.ok(timerIndex > difficultyIndex);
  assert.ok(sideIndex > timerIndex);
  assert.match(indexSource, /data-pve-timer="on"[\s\S]*data-pve-timer="off"/);
});

test("AI timer preference gates both deadline creation and timeout checks", async () => {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(appSource, /state\.mode === "pve" && !activePveTimerEnabled/);
  assert.match(appSource, /activePveTimerEnabled && !DEVELOPER_MODE && side === "red"/);
  assert.match(appSource, /activePveTimerEnabled && !DEVELOPER_MODE && state\.mode === "pve"/);
});

test("AI timer expiry is committed through the journaled shared action path", async () => {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    appSource,
    /applySharedPveAction\(pveHumanPlayer, \{ type: "timeout" \}, \{ authoritative: true \}\)/,
  );
  assert.doesNotMatch(appSource, /declareWinner\([\s\S]{0,200}"timeout"/);
});
