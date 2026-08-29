export const PERTURBATION_POLICIES = ["uniform", "mixed-tier"];

export function parsePerturbationPolicy(value = "uniform") {
  if (!PERTURBATION_POLICIES.includes(value)) {
    throw new Error(
      `unknown --perturbation-policy value: ${value}; expected ${PERTURBATION_POLICIES.join(", ")}`,
    );
  }
  return value;
}

/**
 * Pick one distinct move from a set of tier recommendations.
 *
 * A move recommended by several tiers still appears once: this stratum is intended to create
 * plausible variation, not to turn the current majority policy back into another deterministic
 * game. Callers provide a seeded RNG so corpus generation remains reproducible.
 */
export function chooseMixedTierAction(recommendations, random) {
  const distinct = new Map();
  for (const move of recommendations) {
    if (!move) continue;
    const unitType = move.unitType ?? move.type;
    if (!unitType || !Number.isInteger(move.row) || !Number.isInteger(move.col)) continue;
    const key = `${unitType}:${move.row}:${move.col}`;
    distinct.set(key, { type: "deploy", unitType, row: move.row, col: move.col });
  }

  const choices = [...distinct.values()];
  if (!choices.length) return null;
  return choices[Math.floor(random() * choices.length)];
}
