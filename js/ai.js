import { SIZE } from "./config.js";

export const AI_RANK_SETTINGS = {
  thirdRateMaster: {
    typeWeights: { soldier: 78, general: 8, wizard: 7, diplomat: 7 },
    pressureMultiplier: 1.5,
    specialBoost: 2,
    variance: 32,
    considerAllTypes: false,
    searchDepth: 1,
    score: { center: 1, allies: 1.2, enemies: 1.6, home: 0.5, capture: 3, threat: 1, kingPressure: 0.8, kingSafety: 0.3, defense: 0.4 },
  },
  secondRateMaster: {
    typeWeights: { soldier: 68, general: 12, wizard: 10, diplomat: 10 },
    pressureMultiplier: 2.5,
    specialBoost: 4,
    variance: 20,
    considerAllTypes: false,
    searchDepth: 1,
    score: { center: 1.4, allies: 2, enemies: 2.8, home: 0.7, capture: 6, threat: 2, kingPressure: 1.5, kingSafety: 0.8, defense: 1 },
  },
  firstRateMaster: {
    typeWeights: { soldier: 56, general: 17, wizard: 15, diplomat: 12 },
    pressureMultiplier: 4,
    specialBoost: 8,
    variance: 11,
    considerAllTypes: false,
    searchDepth: 1,
    score: { center: 2, allies: 3, enemies: 4, home: 1, capture: 9, threat: 4, kingPressure: 3, kingSafety: 1.5, defense: 2 },
  },
  peakMaster: {
    typeWeights: { soldier: 40, general: 27, wizard: 18, diplomat: 15 },
    pressureMultiplier: 8,
    specialBoost: 16,
    variance: 2,
    considerAllTypes: true,
    searchDepth: 1,
    score: { center: 2.4, allies: 4.5, enemies: 5.5, home: 1.2, capture: 24, threat: 11, kingPressure: 14, kingSafety: 5, defense: 6 },
  },
  transcendentMaster: {
    typeWeights: { soldier: 34, general: 31, wizard: 20, diplomat: 15 },
    pressureMultiplier: 10,
    specialBoost: 20,
    variance: 1,
    considerAllTypes: true,
    searchDepth: 1,
    score: { center: 2.8, allies: 5.5, enemies: 6.5, home: 1.4, capture: 34, threat: 16, kingPressure: 24, kingSafety: 18, defense: 12 },
  },
  harmonyMaster: {
    typeWeights: { soldier: 32, general: 28, wizard: 22, diplomat: 18 },
    pressureMultiplier: 11,
    specialBoost: 22,
    variance: 0.5,
    considerAllTypes: true,
    searchDepth: 2,
    rootCandidateLimit: 20,
    replyCandidateLimit: 12,
    score: { center: 3, allies: 6, enemies: 7, home: 1.5, capture: 38, threat: 18, kingPressure: 28, kingSafety: 22, defense: 15 },
  },
  profoundMaster: {
    typeWeights: { soldier: 30, general: 29, wizard: 22, diplomat: 19 },
    pressureMultiplier: 12,
    specialBoost: 24,
    variance: 0.15,
    considerAllTypes: true,
    searchDepth: 2,
    rootCandidateLimit: 32,
    replyCandidateLimit: 20,
    score: { center: 3.2, allies: 6.5, enemies: 7.5, home: 1.7, capture: 42, threat: 21, kingPressure: 32, kingSafety: 27, defense: 18 },
  },
  lifeDeathMaster: {
    typeWeights: { soldier: 28, general: 30, wizard: 22, diplomat: 20 },
    pressureMultiplier: 14,
    specialBoost: 28,
    variance: 0,
    considerAllTypes: true,
    searchDepth: 3,
    rootCandidateLimit: 48,
    replyCandidateLimit: 28,
    continuationCandidateLimit: 20,
    score: { center: 3.5, allies: 7, enemies: 8.5, home: 1.8, capture: 48, threat: 25, kingPressure: 38, kingSafety: 34, defense: 22 },
  },
};

function difficultySettings(state) {
  return AI_RANK_SETTINGS[state.aiRank]
    || AI_RANK_SETTINGS[state.aiDifficulty]
    || AI_RANK_SETTINGS.thirdRateMaster;
}

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
  const settings = difficultySettings(state);
  const weights = { ...settings.typeWeights };

  if (pressure > 0) {
    weights.general += pressure * settings.pressureMultiplier;
    weights.diplomat += pressure * Math.max(1, settings.pressureMultiplier - 1);
  }
  if (humanCount >= 5) weights.wizard += settings.specialBoost;
  if (aiCount < 2) weights.soldier += settings.considerAllTypes ? 8 : 26;
  if (occupiedCount >= 10 && occupiedCount <= 50) {
    weights.soldier = Math.max(20, weights.soldier - 10);
    weights.general += settings.specialBoost;
    weights.wizard += settings.specialBoost;
    weights.diplomat += settings.specialBoost;
  }

  const choices = Object.entries(weights)
    .filter(([type]) => state.stock[aiPlayer][type] > 0)
    .map(([type, weight]) => ({ type, weight }));

  return weightedChoice(choices) || "soldier";
}

function positionVariance(state) {
  return difficultySettings(state).variance;
}

function adjacentCount(state, row, col, owner, neighbors) {
  return neighbors(row, col).filter(([nextRow, nextCol]) => state.board[nextRow][nextCol]?.owner === owner).length;
}

function libertiesAfterDeploy(state, row, col, owner, neighbors) {
  const liberties = new Set();
  for (const [nextRow, nextCol] of neighbors(row, col)) {
    const piece = state.board[nextRow][nextCol];
    if (!piece) liberties.add(`${nextRow}-${nextCol}`);
    if (piece?.owner === owner) {
      for (const [allyRow, allyCol] of neighbors(nextRow, nextCol)) {
        if (!state.board[allyRow][allyCol] && (allyRow !== row || allyCol !== col)) liberties.add(`${allyRow}-${allyCol}`);
      }
    }
  }
  return liberties.size;
}

function localCapturePotential(state, row, col, aiPlayer, humanPlayer, neighbors) {
  let score = 0;
  const seen = new Set();
  for (const [enemyRow, enemyCol] of neighbors(row, col)) {
    const enemy = state.board[enemyRow][enemyCol];
    if (enemy?.owner !== humanPlayer) continue;
    const key = `${enemyRow}-${enemyCol}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const enemyLiberties = neighbors(enemyRow, enemyCol)
      .filter(([libertyRow, libertyCol]) => !state.board[libertyRow][libertyCol] && (libertyRow !== row || libertyCol !== col))
      .length;
    const enemyAllies = adjacentCount(state, enemyRow, enemyCol, humanPlayer, neighbors);
    const isKing = enemy.type === "king";
    if (enemyLiberties === 0) score += isKing ? 55 : 12 + enemyAllies * 4;
    else if (enemyLiberties === 1) score += isKing ? 24 : 5 + enemyAllies * 2;
  }
  return score;
}

function kingPressureScore(state, row, col, humanPlayer) {
  let score = 0;
  for (let kingRow = 0; kingRow < SIZE; kingRow += 1) {
    for (let kingCol = 0; kingCol < SIZE; kingCol += 1) {
      const piece = state.board[kingRow][kingCol];
      if (piece?.owner !== humanPlayer || piece.type !== "king") continue;
      const distance = Math.abs(row - kingRow) + Math.abs(col - kingCol);
      if (distance === 1) score += 10;
      else if (distance === 2) score += 5;
      else if (distance === 3) score += 2;
    }
  }
  return score;
}

function ownKingSafetyScore(state, row, col, aiPlayer) {
  let score = 0;
  for (let kingRow = 0; kingRow < SIZE; kingRow += 1) {
    for (let kingCol = 0; kingCol < SIZE; kingCol += 1) {
      const piece = state.board[kingRow][kingCol];
      if (piece?.owner !== aiPlayer || piece.type !== "king") continue;
      const distance = Math.abs(row - kingRow) + Math.abs(col - kingCol);
      if (distance === 1) score += 5;
      else if (distance === 2) score += 2;
    }
  }
  return score;
}

function availableDeployTypes(state, aiPlayer, countPieces, humanPlayer) {
  if (!state.firstDeployDone[aiPlayer] && state.stock[aiPlayer].king > 0) return ["king"];
  if (!difficultySettings(state).considerAllTypes) return [chooseDeployType(state, countPieces, aiPlayer, humanPlayer)];
  return Object.entries(state.stock[aiPlayer])
    .filter(([type, count]) => count > 0 && type !== "king")
    .map(([type]) => type);
}

function scoreDeployType(state, unitType, row, col, neighbors, aiPlayer, humanPlayer) {
  if (!difficultySettings(state).considerAllTypes) return 0;
  const adjacentEnemies = adjacentCount(state, row, col, humanPlayer, neighbors);
  const pressure = kingPressureScore(state, row, col, humanPlayer);
  const capturePotential = localCapturePotential(state, row, col, aiPlayer, humanPlayer, neighbors);

  if (unitType === "general") return adjacentEnemies >= 2 ? 44 : adjacentEnemies === 1 ? 12 : -6;
  if (unitType === "diplomat") return adjacentEnemies >= 2 ? 34 : adjacentEnemies === 1 ? 9 : -5;
  if (unitType === "wizard") return adjacentEnemies > 0 ? 18 + pressure * 1.5 : -4;
  if (unitType === "soldier") return capturePotential > 20 ? 18 : 6;
  return 0;
}

function scoreCell(state, row, col, neighbors, aiPlayer, humanPlayer) {
  const centerScore = 8 - (Math.abs(row - 4) + Math.abs(col - 4));
  const adjacentAllies = adjacentCount(state, row, col, aiPlayer, neighbors);
  const adjacentEnemies = adjacentCount(state, row, col, humanPlayer, neighbors);
  const homeBoardBias = aiPlayer === "red" ? SIZE - 1 - row : row;
  const weights = difficultySettings(state).score;
  const capturePotential = localCapturePotential(state, row, col, aiPlayer, humanPlayer, neighbors);
  const liberties = libertiesAfterDeploy(state, row, col, aiPlayer, neighbors);
  const dangerPenalty = Math.max(0, 2 - liberties) * weights.defense;

  return centerScore * weights.center
    + adjacentAllies * weights.allies
    + adjacentEnemies * weights.enemies
    + homeBoardBias * weights.home
    + capturePotential * weights.capture
    + Math.max(0, adjacentEnemies - 1) * weights.threat
    + kingPressureScore(state, row, col, humanPlayer) * weights.kingPressure
    + ownKingSafetyScore(state, row, col, aiPlayer) * weights.kingSafety
    - dangerPenalty;
}

function compareCandidates(a, b) {
  return (b.deepScore ?? b.score) - (a.deepScore ?? a.score)
    || b.score - a.score
    || a.row - b.row
    || a.col - b.col
    || a.type.localeCompare(b.type);
}

function countStatePieces(state, owner) {
  return state.board.flat().filter((piece) => piece?.owner === owner).length;
}

function findKing(state, owner) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (state.board[row][col]?.owner === owner && state.board[row][col]?.type === "king") return { row, col };
    }
  }
  return null;
}

function canSearchDeploy(state, player, type, row, col, enemy) {
  if (state.board[row][col] || (state.stock[player]?.[type] ?? 0) <= 0) return false;
  if (!state.firstDeployDone[player] && type !== "king") return false;
  const enemyDeployments = state.deploymentCount?.[enemy] ?? (state.firstDeployDone[enemy] ? 1 : 0);
  const enemyKing = enemyDeployments > 0 && enemyDeployments < 5 ? findKing(state, enemy) : null;
  if (!enemyKing) return true;
  return Math.abs(row - enemyKing.row) > 1 || Math.abs(col - enemyKing.col) > 1;
}

function simulateDeploy(state, move, player) {
  const nextState = {
    ...state,
    board: state.board.map((row) => row.map((piece) => piece ? { ...piece } : null)),
    stock: {
      red: { ...state.stock.red },
      blue: { ...state.stock.blue },
    },
    firstDeployDone: { ...state.firstDeployDone },
    deploymentCount: { ...state.deploymentCount },
  };
  nextState.board[move.row][move.col] = {
    id: `search-${player}-${move.type}-${move.row}-${move.col}`,
    owner: player,
    type: move.type,
    originalType: move.type,
    revealed: move.type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  nextState.stock[player][move.type] -= 1;
  nextState.firstDeployDone[player] = true;
  nextState.deploymentCount[player] = (nextState.deploymentCount[player] ?? 0) + 1;
  return nextState;
}

function generateSearchCandidates(state, player, enemy, neighbors) {
  const types = availableDeployTypes(state, player, (owner) => countStatePieces(state, owner), enemy);
  const candidates = [];
  for (const type of types) {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (!canSearchDeploy(state, player, type, row, col, enemy)) continue;
        candidates.push({
          row,
          col,
          type,
          score: scoreCell(state, row, col, neighbors, player, enemy)
            + scoreDeployType(state, type, row, col, neighbors, player, enemy),
        });
      }
    }
  }
  candidates.sort(compareCandidates);
  return candidates;
}

function scoreWithLookahead(state, candidate, settings, aiPlayer, humanPlayer, neighbors) {
  const afterAi = simulateDeploy(state, candidate, aiPlayer);
  const replies = generateSearchCandidates(afterAi, humanPlayer, aiPlayer, neighbors)
    .slice(0, settings.replyCandidateLimit);
  if (!replies.length) return candidate.score;

  let strongestReply = -Infinity;
  for (const reply of replies) {
    let replyValue = reply.score;
    if (settings.searchDepth >= 3) {
      const afterReply = simulateDeploy(afterAi, reply, humanPlayer);
      const continuation = generateSearchCandidates(afterReply, aiPlayer, humanPlayer, neighbors)
        .slice(0, settings.continuationCandidateLimit);
      const bestContinuation = continuation[0]?.score ?? 0;
      replyValue -= bestContinuation * 0.6;
    }
    strongestReply = Math.max(strongestReply, replyValue);
  }
  return candidate.score - strongestReply * 0.8;
}

export function findAiDeployMove(state, { aiPlayer, humanPlayer, canDeploy, countPieces, neighbors }) {
  const settings = difficultySettings(state);
  const types = availableDeployTypes(state, aiPlayer, countPieces, humanPlayer);
  const candidates = [];
  for (const type of types) {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (!canDeploy(aiPlayer, type, row, col)) continue;
        candidates.push({
          row,
          col,
          type,
          score: scoreCell(state, row, col, neighbors, aiPlayer, humanPlayer)
            + scoreDeployType(state, type, row, col, neighbors, aiPlayer, humanPlayer)
            + (settings.variance > 0 ? Math.random() * positionVariance(state) : 0),
        });
      }
    }
  }
  candidates.sort(compareCandidates);
  if (settings.searchDepth > 1) {
    const searchedCandidates = candidates.slice(0, settings.rootCandidateLimit);
    searchedCandidates.forEach((candidate) => {
      candidate.deepScore = scoreWithLookahead(state, candidate, settings, aiPlayer, humanPlayer, neighbors);
    });
    searchedCandidates.sort(compareCandidates);
    return searchedCandidates[0] || null;
  }
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
