import test from "node:test";
import assert from "node:assert/strict";
import {
  CHALLENGE_DISPLAY_RANKS,
  CHALLENGE_RANK_LABELS,
  PUZZLES,
  RANK_ORDER,
} from "../../../js/puzzles.js";

test("challenge catalog has unique IDs and complete rank metadata", () => {
  assert.ok(PUZZLES.length > 0, "challenge catalog should not be empty");
  assert.ok(RANK_ORDER.length > 0, "challenge rank order should not be empty");
  assert.equal(new Set(RANK_ORDER).size, RANK_ORDER.length, "challenge ranks should be unique");
  assert.equal(
    new Set(CHALLENGE_DISPLAY_RANKS).size,
    CHALLENGE_DISPLAY_RANKS.length,
    "display ranks should be unique",
  );

  const ids = PUZZLES.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, "challenge IDs should be unique");

  for (const rank of RANK_ORDER) {
    assert.ok(PUZZLES.some((puzzle) => puzzle.rank === rank), `rank ${rank} should contain a challenge`);
  }

  for (const rank of CHALLENGE_DISPLAY_RANKS) {
    assert.ok(RANK_ORDER.includes(rank), `display rank ${rank} should exist in rank order`);
    assert.ok(CHALLENGE_RANK_LABELS.en[rank], `display rank ${rank} should have an English label`);
    assert.ok(CHALLENGE_RANK_LABELS.ko[rank], `display rank ${rank} should have a Korean label`);
  }
});

test("every challenge has the fields required by the challenge UI", () => {
  for (const puzzle of PUZZLES) {
    assert.equal(typeof puzzle.id, "string");
    assert.ok(puzzle.id.length > 0);
    assert.equal(typeof puzzle.type, "string");
    assert.ok(puzzle.type.length > 0);
    assert.ok(RANK_ORDER.includes(puzzle.rank), `challenge ${puzzle.id} should use a known rank`);
    assert.ok(puzzle.title?.en, `challenge ${puzzle.id} should have an English title`);
    assert.ok(puzzle.title?.ko, `challenge ${puzzle.id} should have a Korean title`);
    assert.ok(puzzle.description?.en, `challenge ${puzzle.id} should have an English description`);
    assert.ok(puzzle.description?.ko, `challenge ${puzzle.id} should have a Korean description`);
  }
});
