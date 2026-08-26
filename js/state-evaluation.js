import { collectGroup, kingLibertyCount, SIZE } from "../packages/game-engine/src/index.js";
import { kingSafetyProfile, phaseStrategicMultiplier } from "./strategic-analysis.js";

export const TERMINAL_STATE_VALUE = 100000;

function sideSign(owner, perspective) {
  return owner === perspective ? 1 : -1;
}

function kingLibertyValue(state, owner) {
  if (!state.firstDeployDone?.[owner]) return 0;
  const liberties = kingLibertyCount(state, owner);
  if (liberties < 0) return -12;
  if (liberties === 0) return -12;
  if (liberties === 1) return -8;
  if (liberties === 2) return -3;
  return Math.min(6, liberties - 2);
}

/**
 * Penalty by soldier-capture distance, indexed 0..4; beyond that the tail below takes over.
 *
 * Distance 0 means the King's group already has no liberty, so it reads as lost rather than
 * merely threatened.
 */
const SOLDIER_CAPTURE_DANGER = [-16, -12, -6, -2.5, -1];

/**
 * King risk as a penalty that vanishes once the King is out of soldier reach.
 *
 * `kingLibertyValue` pays a *bonus* for surplus liberties, so a safe King keeps drawing on the
 * evaluation budget no matter how safe it already is. Bounding this at 0 from above hands that
 * budget back, which is what lets the territory term of Stage 1b actually decide endgames.
 *
 * An anchored King scores exactly 0: soldiers cannot break a wall anchor, and pretending
 * otherwise is what produced the inversion this replaces. The special-unit threat against
 * anchors is Stage 2's job.
 */
function dangerForDistance(distance) {
  if (!Number.isFinite(distance)) return 0;
  if (distance < SOLDIER_CAPTURE_DANGER.length) return SOLDIER_CAPTURE_DANGER[distance];
  return -6 / (distance * distance);
}

function kingDangerValue(state, owner, settings = {}) {
  if (!state.firstDeployDone?.[owner]) return 0;
  const specialsBreakAnchors = Boolean(settings.specialAnchorThreat);
  const profile = kingSafetyProfile(state, owner, { specialsBreakAnchors });
  const soldierDanger = dangerForDistance(profile.soldierCaptureDistance);
  if (!specialsBreakAnchors) return soldierDanger;

  // The special route is a threat in proportion to the odds that the stone beside the King is
  // one, so its danger is scaled rather than asserted. Taking the worse of the two routes keeps
  // the term honest in both directions: a wall still stops soldiers, and it never stopped a
  // Diplomat.
  const specialDanger = dangerForDistance(profile.specialDistance) * profile.specialRisk;
  return Math.min(soldierDanger, specialDanger);
}

/**
 * How sharply the territory verdict takes over as the board fills.
 *
 * Measured over 440 recorded games: King captures finish at a median 27% fill and 90% of them
 * land below 65%, while territory finishes cluster at 98-100%. The exponent has to keep this
 * term out of the midgame, where King tactics genuinely decide things, and still have it near
 * full strength by the time stones settle the match — `p ** 12` gives 0.006 at 65%, 0.28 at
 * 90% and 0.78 at 98%.
 */
const TERRITORY_PROXIMITY_EXPONENT = 12;

/**
 * The territory result, discounted by how far the board is from producing it.
 *
 * A territory finish compares raw piece counts (`victory.js` uses `red > blue`, with the komi
 * hook `WHITE_TERRITORY_BONUS` still at 0), so the margin here is exactly `features.material`.
 * What the evaluation lacked was any notion of how close that comparison is to being the final
 * word: a +1 margin on move 5 and a +1 margin on move 80 scored identically, though the second
 * one simply is the win.
 */
function territoryVerdictValue(margin, filledCells) {
  const proximity = filledCells / (SIZE * SIZE);
  return margin * (proximity ** TERRITORY_PROXIMITY_EXPONENT);
}

function rawStateFeatures(state, perspective, settings = {}) {
  const enemy = perspective === "red" ? "blue" : "red";
  // Same slot, different measure: Stage 1c replaces the blending that consumes it, so the key
  // stays put until then and a disabled flag leaves the old path byte-identical.
  const kingValueFor = settings.terminalObjectiveModel
    ? (target, side) => kingDangerValue(target, side, settings)
    : kingLibertyValue;
  const features = {
    material: 0,
    captures: (state.stats?.captures?.[perspective] || 0) - (state.stats?.captures?.[enemy] || 0),
    kingLiberties: kingValueFor(state, perspective) - kingValueFor(state, enemy),
    territoryVerdict: 0,
    connectivity: 0,
    influence: 0,
    center: 0,
    home: 0,
  };
  const seen = new Set();
  let filledCells = 0;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state.board[row][col];
      if (!piece) {
        let localInfluence = 0;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const neighbor = state.board[row + dr]?.[col + dc];
          if (neighbor) localInfluence += sideSign(neighbor.owner, perspective);
        }
        features.influence += Math.sign(localInfluence);
        continue;
      }

      const sign = sideSign(piece.owner, perspective);
      filledCells += 1;
      features.material += sign;
      features.center += sign * (8 - (Math.abs(row - 4) + Math.abs(col - 4)));
      const homeValue = piece.owner === "red" ? SIZE - 1 - row : row;
      features.home += sign * homeValue;

      const key = `${row}:${col}`;
      if (seen.has(key)) continue;
      const group = collectGroup(state, row, col);
      for (const [groupRow, groupCol] of group) seen.add(`${groupRow}:${groupCol}`);
      features.connectivity += sign * group.length * group.length;
    }
  }
  // Stays exactly 0 on the default path, so the disabled flag leaves every weighted component
  // untouched rather than merely small.
  if (settings.terminalObjectiveModel) {
    features.territoryVerdict = territoryVerdictValue(features.material, filledCells);
  }
  return features;
}

export function stateEvaluationWeights(settings = {}) {
  const score = settings.score || settings;
  const kingWeight = ((score.kingSafety ?? 10) + (score.kingPressure ?? 10)) / 2;
  return {
    material: (score.capture ?? 9) * 3,
    // `captures` counts capture *events* cumulatively and never decreases, while the
    // stones a capture wins are already in `material` (a captured group becomes the
    // captor's soldiers). Set captureHistoryMultiplier to 0 to score the board as it
    // stands instead of rewarding capture history.
    captures: (score.capture ?? 9) * (score.captureHistoryMultiplier ?? 6),
      // `kingDangerScale` only applies on the new path, so a sweep of it cannot disturb the
    // default weights. It multiplies the danger term alone, unlike raising `kingSafety` or
    // `kingPressure`, which would also move the separate King terms inside `scoreCell`.
    kingLiberties: kingWeight * 8 * (settings.terminalObjectiveModel ? (settings.kingDangerScale ?? 1) : 1),
    // Deliberately heavier than `material`, which scores the same margin: near a territory
    // finish the margin is not one consideration among several, it is the result.
    territoryVerdict: (score.territory ?? (score.capture ?? 9) * 12),
    connectivity: score.groupTactics ?? score.defense ?? 2,
    influence: score.influence ?? 0,
    center: score.center ?? 0,
    home: score.home ?? 0,
  };
}

/**
 * The fixed-budget blend: King safety and everything else split one unit of weight, so raising
 * either necessarily lowers the other.
 *
 * Measured 2026-08-24: `kingTacticalPriority: 0` took Grandmaster from 65% to 52.5% against
 * real tiers, which is what a shared budget does — you cannot buy territory here without
 * selling King safety. Kept for the default path.
 */
function blendedValue(weighted, kingValue, priority, strategicMultiplier) {
  const strategicValue = Object.entries(weighted)
    .filter(([key]) => key !== "kingLiberties")
    .reduce((sum, [, component]) => sum + component * strategicMultiplier, 0);
  return priority > 0 && kingValue !== 0
    ? kingValue * priority + strategicValue * (1 - priority)
    : kingValue + strategicValue;
}

/**
 * Three independent terms rather than a split budget: `territoryVerdict + strategicValue +
 * kingDanger`.
 *
 * Each is already scaled to mean something on its own — King danger is a bounded penalty that
 * reaches 0 when the King is out of reach, and the territory verdict is the stone margin
 * discounted by how close the board is to ending. Adding them lets both be large at once,
 * which the blend forbade.
 *
 * The phase multiplier stays on the positional terms only. It exists to retune shape play by
 * game phase, and neither a capture distance nor a settled stone count is a matter of shape.
 */
function additiveValue(weighted, strategicMultiplier) {
  const strategicValue = Object.entries(weighted)
    .filter(([key]) => key !== "kingLiberties" && key !== "territoryVerdict")
    .reduce((sum, [, component]) => sum + component * strategicMultiplier, 0);
  return weighted.territoryVerdict + strategicValue + weighted.kingLiberties;
}

export function evaluateStateDetailed(state, perspective, settings = {}) {
  if (state.winner) {
    const value = state.winner === "draw" ? 0 : state.winner === perspective
      ? TERMINAL_STATE_VALUE
      : -TERMINAL_STATE_VALUE;
    return { value, terminal: true, features: {}, weighted: {} };
  }

  const features = rawStateFeatures(state, perspective, settings);
  const weights = stateEvaluationWeights(settings);
  const weighted = Object.fromEntries(
    Object.keys(features).map((key) => [key, features[key] * weights[key]]),
  );
  const priority = Math.max(0, Math.min(1, Number(settings.kingTacticalPriority || 0)));
  const strategicMultiplier = settings.strategicContext ? phaseStrategicMultiplier(state) : 1;
  const kingValue = weighted.kingLiberties;
  const value = settings.terminalObjectiveModel
    ? additiveValue(weighted, strategicMultiplier)
    : blendedValue(weighted, kingValue, priority, strategicMultiplier);
  return { value, terminal: false, features, weighted };
}

export function evaluateState(state, perspective, settings = {}) {
  return evaluateStateDetailed(state, perspective, settings).value;
}

export function evaluateStateTransition(beforeState, afterState, perspective, settings = {}) {
  if (afterState.winner) return evaluateState(afterState, perspective, settings);
  return evaluateState(afterState, perspective, settings) - evaluateState(beforeState, perspective, settings);
}
