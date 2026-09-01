import assert from "node:assert/strict";
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
}

class FakeAudio {
  static instances = [];

  constructor(src) {
    this.src = src;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.currentTime = 0;
    FakeAudio.instances.push(this);
  }

  play() {
    this.playCalls += 1;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
  }
}

test("audio settings default on and persist explicit changes", async () => {
  const storage = new MemoryStorage();
  const listeners = [];
  globalThis.Audio = FakeAudio;
  globalThis.localStorage = storage;
  globalThis.document = {
    addEventListener(type, listener, options) {
      listeners.push({ type, listener, options });
    },
  };

  try {
    const audio = await import(`../js/audio.js?test=${Date.now()}`);
    const [backgroundMusic, placementSound] = FakeAudio.instances;

    assert.equal(audio.isMusicEnabled(), true);
    assert.equal(audio.isSfxEnabled(), true);

    audio.setMusicEnabled(false);
    assert.equal(storage.getItem("unknown-kingdom-music"), "disabled");
    assert.equal(audio.isMusicEnabled(), false);
    assert.equal(backgroundMusic.pauseCalls, 1);

    audio.setMusicEnabled(true);
    assert.equal(storage.getItem("unknown-kingdom-music"), "enabled");
    assert.equal(backgroundMusic.playCalls, 1);

    audio.setSfxEnabled(false);
    audio.playPlacementSound();
    assert.equal(storage.getItem("unknown-kingdom-sfx"), "disabled");
    assert.equal(placementSound.playCalls, 0);

    audio.setSfxEnabled(true);
    audio.playPlacementSound();
    assert.equal(storage.getItem("unknown-kingdom-sfx"), "enabled");
    assert.equal(placementSound.playCalls, 1);

    audio.initAudioGesture();
    assert.deepEqual(listeners.map(({ type, options }) => ({ type, options })), [
      { type: "pointerdown", options: { once: true } },
    ]);
    listeners[0].listener();
    assert.equal(backgroundMusic.playCalls, 2);
  } finally {
    FakeAudio.instances = [];
    delete globalThis.Audio;
    delete globalThis.localStorage;
    delete globalThis.document;
  }
});
