/**
 * Parse the comma-separated tier scope used by offline AI experiments.
 *
 * Omitting the option preserves the historical behaviour: an override applies to every tier.
 * An explicit scope is strict so a typo cannot silently flatten or distort the difficulty ladder.
 */
export function parseOverrideTiers(value, validTiers) {
  if (value == null) return new Set(validTiers);

  const tiers = value.split(",").map((tier) => tier.trim()).filter(Boolean);
  if (!tiers.length) throw new Error("--override-tiers must name at least one tier");

  const valid = new Set(validTiers);
  const unknown = tiers.filter((tier) => !valid.has(tier));
  if (unknown.length) {
    throw new Error(
      `unknown --override-tiers value: ${unknown.join(", ")}; expected ${validTiers.join(", ")}`,
    );
  }

  return new Set(tiers);
}

/** Return the original settings object when this tier is outside the experiment scope. */
export function settingsWithTierOverride(settings, tier, override, overrideTiers) {
  if (!override || !overrideTiers.has(tier)) return settings;
  return { ...settings, ...override };
}
