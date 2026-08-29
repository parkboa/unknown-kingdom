import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseMixedTierAction,
  parsePerturbationPolicy,
} from "../scripts/lib/human-like-perturbation.mjs";

test("perturbation policy defaults to the historical uniform sampler", () => {
  assert.equal(parsePerturbationPolicy(), "uniform");
  assert.equal(parsePerturbationPolicy("mixed-tier"), "mixed-tier");
  assert.throws(() => parsePerturbationPolicy("human"), /unknown.*human/);
});

test("mixed-tier sampling deduplicates recommendations before seeded selection", () => {
  const recommendations = [
    { type: "soldier", row: 2, col: 3 },
    { type: "soldier", row: 2, col: 3 },
    { type: "wizard", row: 5, col: 6 },
  ];

  assert.deepEqual(chooseMixedTierAction(recommendations, () => 0), {
    type: "deploy",
    unitType: "soldier",
    row: 2,
    col: 3,
  });
  assert.deepEqual(chooseMixedTierAction(recommendations, () => 0.75), {
    type: "deploy",
    unitType: "wizard",
    row: 5,
    col: 6,
  });
});

test("mixed-tier sampling ignores missing and malformed recommendations", () => {
  assert.equal(chooseMixedTierAction([null, { type: "soldier", row: 1 }], () => 0), null);
});
