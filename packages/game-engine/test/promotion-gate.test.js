import test from "node:test";
import assert from "node:assert/strict";
import { decidePromotionGate, wilsonScoreInterval } from "../../../scripts/lib/promotion-gate.mjs";

test("Wilson interval contains the observed score rate", () => {
  const interval = wilsonScoreInterval(12, 20, 0.95);
  assert.ok(interval.lower < 0.6);
  assert.ok(interval.upper > 0.6);
  assert.equal(interval.rate, 0.6);
});

test("promotion gate promotes only when the lower confidence bound clears the threshold", () => {
  const decision = decidePromotionGate({
    points: 18, games: 20, minGames: 20, maxGames: 100, threshold: 0.55, confidence: 0.95,
  });
  assert.equal(decision.status, "promoted");
  assert.equal(decision.reason, "lower_bound_reached");
});

test("promotion gate rejects when the upper confidence bound is below the threshold", () => {
  const decision = decidePromotionGate({
    points: 2, games: 20, minGames: 20, maxGames: 100, threshold: 0.55, confidence: 0.95,
  });
  assert.equal(decision.status, "rejected");
  assert.equal(decision.reason, "upper_bound_below_threshold");
});

test("promotion gate rejects when the remaining games cannot reach the threshold", () => {
  const decision = decidePromotionGate({
    points: 8, games: 18, minGames: 20, maxGames: 20, threshold: 0.55, confidence: 0.95,
  });
  assert.equal(decision.status, "rejected");
  assert.equal(decision.reason, "threshold_unreachable");
});

test("promotion gate waits for paired minimum games and rejects an inconclusive maximum", () => {
  assert.equal(decidePromotionGate({
    points: 3, games: 4, minGames: 10, maxGames: 20, threshold: 0.55, confidence: 0.95,
  }).status, "continue");
  const final = decidePromotionGate({
    points: 11, games: 20, minGames: 10, maxGames: 20, threshold: 0.55, confidence: 0.95,
  });
  assert.equal(final.status, "rejected");
  assert.equal(final.reason, "max_games_without_confidence");
});
