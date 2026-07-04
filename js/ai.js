import { SIZE } from "./config.js";

function weightedChoice(choices) {
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  for (const choice of choices) {
    roll -= choice.weight;
    if (roll <= 0) return choice.type;
  }
  return choices[choices.length - 1]?.type || null;
}

function chooseDeployType(state, countPieces, aiPlayer, humanPlayer) {
  if (!state.firstDeployDone[aiPlayer] && state.stock[aiPlayer].king > 0) return "king";

  const aiCount = countPieces(aiPlayer);
  const humanCount = countPieces(humanPlayer);
  const pressure = Math.max(0, humanCount - aiCount);
  const occupiedCount = aiCount + humanCount;
  const weightsByProfile = {
    balanced: { soldier: 52, general: 18, wizard: 16, diplomat: 14 },
    aggressive: { soldier: 40, general: 28, wizard: 22, diplomat: 10 },
    defensive: { soldier: 58, general: 12, wizard: 12, diplomat: 18 },
  };
  const weights = { ...weightsByProfile[state.aiProfile] };

  if (pressure > 0) {
    weights.general += pressure * 4;
    weights.diplomat += pressure * 3;
  }
  if (humanCount >= 5) weights.wizard += 6;
  if (aiCount < 2) weights.soldier += 25;
  if (occupiedCount >= 10 && occupiedCount <= 50) {
    weights.soldier = Math.max(20, weights.soldier - 10);
    weights.general += 8;
    weights.wizard += 8;
    weights.diplomat += 8;
  }

  const choices = Object.entries(weights)
    .filter(([type]) => state.stock[aiPlayer][type] > 0)
    .map(([type, weight]) => ({ type, weight }));

  return weightedChoice(choices) || "soldier";
}

function positionVariance(profile) {
  if (profile === "aggressive") return 8;
  if (profile === "defensive") return 13;
  return 10;
}

function scoreCell(state, row, col, neighbors, aiPlayer, humanPlayer) {
  const centerScore = 8 - (Math.abs(row - 4) + Math.abs(col - 4));
  const adjacentAllies = neighbors(row, col).filter(([nextRow, nextCol]) => state.board[nextRow][nextCol]?.owner === aiPlayer).length;
  const adjacentEnemies = neighbors(row, col).filter(([nextRow, nextCol]) => state.board[nextRow][nextCol]?.owner === humanPlayer).length;
  const homeBoardBias = aiPlayer === "red" ? SIZE - 1 - row : row;
  return centerScore * 2 + adjacentAllies * 3 + adjacentEnemies * 4 + homeBoardBias;
}

export function findAiDeployMove(state, { aiPlayer, humanPlayer, canDeploy, countPieces, neighbors }) {
  const type = chooseDeployType(state, countPieces, aiPlayer, humanPlayer);
  const candidates = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!canDeploy(aiPlayer, type, row, col)) continue;
      candidates.push({
        row,
        col,
        type,
        score: scoreCell(state, row, col, neighbors, aiPlayer, humanPlayer) + Math.random() * positionVariance(state.aiProfile),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

export function chooseAiTeleportDestination(state, neighbors, aiPlayer, humanPlayer) {
  const candidates = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!state.board[row][col]) candidates.push({
        row,
        col,
        score: scoreCell(state, row, col, neighbors, aiPlayer, humanPlayer),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

export function chooseAiKingSwapTarget(state, {
  aiPlayer,
  humanPlayer,
  kingEscapeType,
  neighbors,
  isFortressConnected,
}) {
  const pending = state.pendingKingSwap;
  if (!pending || pending.owner !== aiPlayer) return null;

  const candidates = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const escapeType = kingEscapeType(aiPlayer, pending.row, pending.col, row, col);
      if (!escapeType) continue;
      const adjacentEnemies = neighbors(row, col).filter(([nextRow, nextCol]) => state.board[nextRow][nextCol]?.owner === humanPlayer).length;
      const adjacentAllies = neighbors(row, col).filter(([nextRow, nextCol]) => state.board[nextRow][nextCol]?.owner === aiPlayer).length;
      const fortressSafety = escapeType === "swap" && isFortressConnected(aiPlayer, row, col) ? 20 : 0;
      const homeBoardSafety = (aiPlayer === "red" ? SIZE - 1 - row : row) * 2;
      candidates.push({
        row,
        col,
        score: fortressSafety + homeBoardSafety + adjacentAllies * 3 - adjacentEnemies * 8 + (escapeType === "escape" ? 4 : 0),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}
