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

test("tutorial and AI rank unlocks are sequential and survive reload", async () => {
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;

  try {
    const progression = await import(`../js/puzzle-controller.js?progression-test=${Date.now()}`);

    assert.equal(progression.arePrimaryModesUnlocked(), false);
    assert.equal(progression.isAiRankUnlocked("novice"), false);
    assert.equal(progression.markAiRankDefeated("intermediate"), false);

    assert.equal(progression.markTutorialComplete(), true);
    assert.equal(progression.markTutorialComplete(), false);
    assert.equal(progression.arePrimaryModesUnlocked(), true);
    assert.equal(progression.isAiRankUnlocked("novice"), true);
    assert.equal(progression.isAiRankUnlocked("intermediate"), false);

    assert.equal(progression.markAiRankDefeated("novice"), true);
    assert.equal(progression.markAiRankDefeated("novice"), false);
    assert.equal(progression.isAiRankUnlocked("intermediate"), true);
    assert.equal(progression.isAiRankUnlocked("advanced"), false);
    assert.equal(progression.markAiRankDefeated("advanced"), false);
    assert.equal(progression.markAiRankDefeated("intermediate"), true);

    const saved = JSON.parse(storage.getItem(progression.CHALLENGE_PROGRESS_KEY));
    assert.deepEqual(saved.completedPuzzleIds, ["basic-tutorial-01"]);
    assert.deepEqual(saved.defeatedAiRanks, ["novice", "intermediate"]);
    assert.equal(saved.tutorialCompleted, true);

    const reloaded = await import(`../js/puzzle-controller.js?progression-reload=${Date.now()}`);
    assert.equal(reloaded.arePrimaryModesUnlocked(), true);
    assert.equal(reloaded.isAiRankUnlocked("advanced"), true);
    assert.equal(reloaded.isAiRankUnlocked("expert"), false);
  } finally {
    delete globalThis.localStorage;
  }
});

test("invalid saved progression is sanitized", async () => {
  const storage = new MemoryStorage();
  storage.setItem("daeguk-challenge-progress-v1", JSON.stringify({
    completedPuzzleIds: ["missing-puzzle", 7],
    defeatedAiRanks: ["novice", "novice", "missing-rank", null],
  }));
  globalThis.localStorage = storage;

  try {
    const progression = await import(`../js/puzzle-controller.js?progression-sanitize=${Date.now()}`);
    assert.deepEqual(progression.challengeProgress, {
      completedPuzzleIds: [],
      defeatedAiRanks: ["novice"],
      tutorialCompleted: false,
    });
    assert.equal(progression.arePrimaryModesUnlocked(), false);
    assert.equal(progression.isAiRankUnlocked("intermediate"), false);
  } finally {
    delete globalThis.localStorage;
  }
});

test("legacy puzzle completion alone does not unlock match modes", async () => {
  const storage = new MemoryStorage();
  storage.setItem("daeguk-challenge-progress-v1", JSON.stringify({
    completedPuzzleIds: ["basic-tutorial-01"],
  }));
  globalThis.localStorage = storage;

  try {
    const progression = await import(`../js/puzzle-controller.js?progression-legacy=${Date.now()}`);
    assert.equal(progression.isPuzzleComplete(0), true);
    assert.equal(progression.arePrimaryModesUnlocked(), false);
    assert.equal(progression.isAiRankUnlocked("novice"), false);
  } finally {
    delete globalThis.localStorage;
  }
});
