function inverseStandardNormal(probability) {
  if (!(probability > 0 && probability < 1)) throw new RangeError("Probability must be between 0 and 1");
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;

  if (probability < low) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (probability <= high) {
    const q = probability - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - probability));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
    / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export function wilsonScoreInterval(points, games, confidence = 0.95) {
  if (games <= 0) return { lower: 0, upper: 1, rate: 0 };
  const rate = points / games;
  const z = inverseStandardNormal(0.5 + confidence / 2);
  const zSquared = z * z;
  const denominator = 1 + zSquared / games;
  const center = (rate + zSquared / (2 * games)) / denominator;
  const margin = z * Math.sqrt((rate * (1 - rate) + zSquared / (4 * games)) / games) / denominator;
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    rate,
  };
}

export function decidePromotionGate({
  points,
  games,
  minGames,
  maxGames,
  threshold = 0.55,
  confidence = 0.95,
}) {
  const interval = wilsonScoreInterval(points, games, confidence);
  const base = { ...interval, points, games, threshold, confidence };
  if ((points + Math.max(0, maxGames - games)) / maxGames < threshold) {
    return { ...base, status: "rejected", reason: "threshold_unreachable" };
  }
  if (games < minGames) return { ...base, status: "continue", reason: "minimum_games" };
  if (interval.lower >= threshold) return { ...base, status: "promoted", reason: "lower_bound_reached" };
  if (interval.upper < threshold) return { ...base, status: "rejected", reason: "upper_bound_below_threshold" };
  if (games >= maxGames) return { ...base, status: "rejected", reason: "max_games_without_confidence" };
  return { ...base, status: "continue", reason: "confidence_interval_overlaps_threshold" };
}
