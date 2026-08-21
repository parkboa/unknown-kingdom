import { collectGroup, kingLibertyCount, SIZE } from "../packages/game-engine/src/index.js";

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

function rawStateFeatures(state, perspective) {
  const enemy = perspective === "red" ? "blue" : "red";
  const features = {
    material: 0,
    captures: (state.stats?.captures?.[perspective] || 0) - (state.stats?.captures?.[enemy] || 0),
    kingLiberties: kingLibertyValue(state, perspective) - kingLibertyValue(state, enemy),
    connectivity: 0,
    influence: 0,
    center: 0,
    home: 0,
  };
  const seen = new Set();

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
  return features;
}

export function stateEvaluationWeights(settings = {}) {
  const score = settings.score || settings;
  const kingWeight = ((score.kingSafety ?? 10) + (score.kingPressure ?? 10)) / 2;
  return {
    material: (score.capture ?? 9) * 3,
    captures: (score.capture ?? 9) * 6,
    kingLiberties: kingWeight * 8,
    connectivity: score.groupTactics ?? score.defense ?? 2,
    influence: score.influence ?? 0,
    center: score.center ?? 0,
    home: score.home ?? 0,
  };
}

export function evaluateStateDetailed(state, perspective, settings = {}) {
  if (state.winner) {
    const value = state.winner === "draw" ? 0 : state.winner === perspective
      ? TERMINAL_STATE_VALUE
      : -TERMINAL_STATE_VALUE;
    return { value, terminal: true, features: {}, weighted: {} };
  }

  const features = rawStateFeatures(state, perspective);
  const weights = stateEvaluationWeights(settings);
  const weighted = Object.fromEntries(
    Object.keys(features).map((key) => [key, features[key] * weights[key]]),
  );
  const value = Object.values(weighted).reduce((sum, component) => sum + component, 0);
  return { value, terminal: false, features, weighted };
}

export function evaluateState(state, perspective, settings = {}) {
  return evaluateStateDetailed(state, perspective, settings).value;
}

export function evaluateStateTransition(beforeState, afterState, perspective, settings = {}) {
  if (afterState.winner) return evaluateState(afterState, perspective, settings);
  return evaluateState(afterState, perspective, settings) - evaluateState(beforeState, perspective, settings);
}
