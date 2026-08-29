import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOverrideTiers,
  settingsWithTierOverride,
} from "../scripts/lib/tier-overrides.mjs";

const TIERS = ["novice", "intermediate", "advanced", "expert", "grandmaster"];

test("tier overrides preserve the historical all-tier default", () => {
  assert.deepEqual([...parseOverrideTiers(null, TIERS)], TIERS);
});

test("tier overrides accept an explicit comma-separated scope", () => {
  assert.deepEqual(
    [...parseOverrideTiers("advanced, expert,grandmaster", TIERS)],
    ["advanced", "expert", "grandmaster"],
  );
});

test("tier overrides reject an empty or unknown explicit scope", () => {
  assert.throws(() => parseOverrideTiers("", TIERS), /at least one tier/);
  assert.throws(() => parseOverrideTiers("advanced,legend", TIERS), /unknown.*legend/);
});

test("settings outside the override scope remain untouched", () => {
  const baseline = { searchDepth: 2, kingDangerModel: false };
  const override = { kingDangerModel: true };
  const scope = parseOverrideTiers("advanced,expert,grandmaster", TIERS);

  assert.strictEqual(settingsWithTierOverride(baseline, "novice", override, scope), baseline);
  assert.deepEqual(settingsWithTierOverride(baseline, "advanced", override, scope), {
    searchDepth: 2,
    kingDangerModel: true,
  });
});
