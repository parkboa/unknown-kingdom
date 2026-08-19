import { SIZE } from "./config.js";
import {
  applyAction,
  canDeploy,
  collectGroup,
  getLegalActions,
  groupHasLiberty,
  kingLibertyCount,
  opponent,
  orthogonalPositions,
  stateForPlayer,
  wallOwnerForEdge,
} from "../packages/game-engine/src/index.js";

export const AI_TIER_ORDER = [
  "novice",
  "intermediate",
  "advanced",
  "expert",
  "grandmaster",
];

export const AI_RANK_SETTINGS = {
  // 1단계: 초급 (기존 절정고수 수준: 특수기물 기본 활용, searchDepth 2)
  novice: {
    typeWeights: { soldier: 40, general: 27, wizard: 18, diplomat: 15 },
    pressureMultiplier: 8,
    specialBoost: 16,
    variance: 1.5,
    considerAllTypes: true,
    searchDepth: 2,
    rootCandidateLimit: 20,
    replyCandidateLimit: 12,
    score: { center: 2.4, allies: 4.5, enemies: 5.5, home: 1.2, capture: 24, threat: 11, kingPressure: 14, kingSafety: 8, defense: 6 },
  },

  // 2단계: 중급 (기존 초절정고수 수준: 외교관/진형 장악, searchDepth 2)
  intermediate: {
    typeWeights: { soldier: 34, general: 31, wizard: 20, diplomat: 15 },
    pressureMultiplier: 10,
    specialBoost: 20,
    variance: 0.5,
    considerAllTypes: true,
    searchDepth: 2,
    rootCandidateLimit: 28,
    replyCandidateLimit: 16,
    score: { center: 2.8, allies: 5.5, enemies: 6.5, home: 1.4, capture: 34, threat: 16, kingPressure: 24, kingSafety: 18, defense: 12 },
  },

  // 3단계: 상급 (기존 화경 수준: 마법사 도약 및 변칙 전술, searchDepth 3)
  advanced: {
    typeWeights: { soldier: 32, general: 28, wizard: 22, diplomat: 18 },
    pressureMultiplier: 11,
    specialBoost: 22,
    variance: 0,
    considerAllTypes: true,
    searchDepth: 3,
    rootCandidateLimit: 32,
    replyCandidateLimit: 20,
    continuationCandidateLimit: 12,
    score: { center: 3, allies: 6, enemies: 7, home: 1.5, capture: 38, threat: 18, kingPressure: 28, kingSafety: 22, defense: 15 },
  },

  // 4단계: 달인 (2~3수 연계 수읽기, 넓은 실리 포진 및 전술 확장)
  expert: {
    typeWeights: { soldier: 30, general: 30, wizard: 22, diplomat: 18 },
    pressureMultiplier: 12,
    specialBoost: 26,
    variance: 0,
    considerAllTypes: true,
    searchDepth: 3,
    tacticalExtension: true,
    beliefSampling: true,
    rootCandidateLimit: 36,
    replyCandidateLimit: 18,
    continuationCandidateLimit: 10,
    score: {
      center: 3.0,
      allies: 6.5,
      enemies: 7.0,
      home: 1.5,
      capture: 55,
      threat: 24,
      kingPressure: 30,
      kingSafety: 38,
      defense: 14,
      influence: 14,
      groupTactics: 28,
    },
  },

  // 5단계: 신의 한 수 (신규 극강 튜닝 AI: 넓은 실리 장악 + 무결점 왕 방어 + 100% 킬각 캐치)
  grandmaster: {
    typeWeights: { soldier: 28, general: 32, wizard: 22, diplomat: 18 },
    pressureMultiplier: 14,
    specialBoost: 30,
    variance: 0,
    considerAllTypes: true,
    searchDepth: 3,
    tacticalExtension: true,
    beliefSampling: true,
    instantKillCheck: true,
    ironcladKingDefense: true,
    rootCandidateLimit: 42,
    replyCandidateLimit: 22,
    continuationCandidateLimit: 14,
    score: {
      center: 3.2,
      allies: 7.5,
      enemies: 7.8,
      home: 1.6,
      capture: 68,
      threat: 30,
      kingPressure: 34,
      kingSafety: 50,
      defense: 18,
      influence: 16,
      groupTactics: 34,
    },
  },

  // ==========================================
  // 하위 호환성 (Legacy Ranks)
  // ==========================================
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
    variance: 1.5,
    considerAllTypes: true,
    searchDepth: 2,
    rootCandidateLimit: 20,
    replyCandidateLimit: 12,
    score: { center: 2.4, allies: 4.5, enemies: 5.5, home: 1.2, capture: 24, threat: 11, kingPressure: 14, kingSafety: 8, defense: 6 },
  },
  transcendentMaster: {
    typeWeights: { soldier: 34, general: 31, wizard: 20, diplomat: 15 },
    pressureMultiplier: 10,
    specialBoost: 20,
    variance: 0.5,
    considerAllTypes: true,
    searchDepth: 2,
    rootCandidateLimit: 28,
    replyCandidateLimit: 16,
    score: { center: 2.8, allies: 5.5, enemies: 6.5, home: 1.4, capture: 34, threat: 16, kingPressure: 24, kingSafety: 18, defense: 12 },
  },
  harmonyMaster: {
    typeWeights: { soldier: 32, general: 28, wizard: 22, diplomat: 18 },
    pressureMultiplier: 11,
    specialBoost: 22,
    variance: 0,
    considerAllTypes: true,
    searchDepth: 3,
    rootCandidateLimit: 32,
    replyCandidateLimit: 20,
    continuationCandidateLimit: 12,
    score: { center: 3, allies: 6, enemies: 7, home: 1.5, capture: 38, threat: 18, kingPressure: 28, kingSafety: 22, defense: 15 },
  },
  profoundMaster: {
    typeWeights: { soldier: 30, general: 29, wizard: 22, diplomat: 19 },
    pressureMultiplier: 12,
    specialBoost: 24,
    variance: 0,
    considerAllTypes: true,
    searchDepth: 3,
    rootCandidateLimit: 40,
    replyCandidateLimit: 24,
    continuationCandidateLimit: 16,
    score: { center: 3.2, allies: 6.5, enemies: 7.5, home: 1.7, capture: 44, threat: 22, kingPressure: 36, kingSafety: 30, defense: 18 },
  },
  lifeDeathMaster: {
    typeWeights: { soldier: 30, general: 30, wizard: 22, diplomat: 18 },
    pressureMultiplier: 14,
    specialBoost: 30,
    variance: 0,
    considerAllTypes: true,
    searchDepth: 4,
    tacticalExtension: true,
    beliefSampling: true,
    rootCandidateLimit: 22,
    replyCandidateLimit: 12,
    continuationCandidateLimit: 6,
    ply4CandidateLimit: 3,
    score: {
      center: 3.5,
      allies: 7.0,
      enemies: 8.5,
      home: 1.8,
      capture: 75,
      threat: 38,
      kingPressure: 65,
      kingSafety: 35,
      defense: 8,
      influence: 14,
      groupTactics: 28,
    },
  },
};

const LEGACY_RANK_MAP = {
  thirdRateMaster: "novice",
  secondRateMaster: "novice",
  firstRateMaster: "novice",
  peakMaster: "novice",
  transcendentMaster: "intermediate",
  harmonyMaster: "advanced",
  profoundMaster: "expert",
  lifeDeathMaster: "expert",
  beginner: "novice",
};

export function difficultySettings(state) {
  const rank = state.aiRank || state.aiDifficulty;
  return AI_RANK_SETTINGS[rank]
    || AI_RANK_SETTINGS[LEGACY_RANK_MAP[rank]]
    || AI_RANK_SETTINGS.novice;
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

  if (occupiedCount >= 10 && pressure > 0) {
    weights.general = Math.round(weights.general + pressure * settings.pressureMultiplier);
    weights.wizard = Math.round(weights.wizard + pressure * (settings.pressureMultiplier * 0.75));
    weights.diplomat = Math.round(weights.diplomat + pressure * (settings.pressureMultiplier * 0.5));
  }

  if (occupiedCount >= 16) {
    weights.general += settings.specialBoost;
    weights.wizard += settings.specialBoost;
    weights.diplomat += settings.specialBoost;
  }

  const deployments = state.deploymentCount?.[aiPlayer] ?? (state.firstDeployDone[aiPlayer] ? 1 : 0);
  const allowSpecials = state.mode === "tutorial" || state.mode === "puzzle" || deployments >= 5;

  const choices = Object.entries(state.stock[aiPlayer])
    .filter(([type, count]) => count > 0 && type !== "king" && (allowSpecials || type === "soldier"))
    .map(([type]) => ({ type, weight: weights[type] || 1 }));

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
    if (enemyLiberties === 0) score += isKing ? 70 : 25 + enemyAllies * 5;
    else if (enemyLiberties === 1) score += isKing ? 25 : 5 + enemyAllies * 2;
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

function cellInfluenceScore(state, row, col, aiPlayer, humanPlayer) {
  let influence = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const piece = state.board[r][c];
      if (!piece) continue;
      const dist = Math.abs(r - row) + Math.abs(c - col);
      if (dist === 0) continue;
      const power = (piece.type === "king" ? 2.5 : piece.type === "general" ? 2.0 : 1.0) / (dist * dist);
      if (piece.owner === aiPlayer) influence += power;
      else if (piece.owner === humanPlayer) influence -= power;
    }
  }
  return influence;
}

function evaluateGroupTactics(state, row, col, aiPlayer, humanPlayer, neighbors) {
  let score = 0;
  const allyNeighbors = [];
  const enemyNeighbors = [];

  for (const [nr, nc] of neighbors(row, col)) {
    const piece = state.board[nr][nc];
    if (!piece) continue;
    if (piece.owner === aiPlayer) allyNeighbors.push([nr, nc]);
    else if (piece.owner === humanPlayer) enemyNeighbors.push([nr, nc]);
  }

  // Connection: Connecting 2 or more separate friendly groups
  if (allyNeighbors.length >= 2) {
    const groups = new Set();
    for (const [ar, ac] of allyNeighbors) {
      const g = collectGroup(state, ar, ac);
      if (g.length) groups.add(`${g[0][0]}-${g[0][1]}`);
    }
    if (groups.size >= 2) {
      score += 24 * groups.size;
    }
  }

  // Cutting: Slicing through enemy formations, preventing enemy connection
  if (enemyNeighbors.length >= 2) {
    const enemyGroups = new Set();
    for (const [er, ec] of enemyNeighbors) {
      const eg = collectGroup(state, er, ec);
      if (eg.length) enemyGroups.add(`${eg[0][0]}-${eg[0][1]}`);
    }
    if (enemyGroups.size >= 2) {
      score += 30 * enemyGroups.size;
    }
  }

  // Eye Space: Rewarding placement that expands liberties
  const afterLibs = libertiesAfterDeploy(state, row, col, aiPlayer, neighbors);
  if (afterLibs >= 3) score += 10;
  else if (afterLibs <= 1) score -= 20;

  return score;
}

function availableDeployTypes(state, aiPlayer, countPieces, humanPlayer) {
  if (!state.firstDeployDone[aiPlayer] && state.stock[aiPlayer].king > 0) return ["king"];
  const deployments = state.deploymentCount?.[aiPlayer] ?? (state.firstDeployDone[aiPlayer] ? 1 : 0);
  const allowSpecials = state.mode === "tutorial" || state.mode === "puzzle" || deployments >= 5;
  if (!difficultySettings(state).considerAllTypes) {
    if (!allowSpecials) return ["soldier"];
    return [chooseDeployType(state, countPieces, aiPlayer, humanPlayer)];
  }
  return Object.entries(state.stock[aiPlayer])
    .filter(([type, count]) => count > 0 && type !== "king" && (allowSpecials || type === "soldier"))
    .map(([type]) => type);
}

function scoreDeployType(state, unitType, row, col, neighbors, aiPlayer, humanPlayer) {
  if (!difficultySettings(state).considerAllTypes) return 0;
  const adjacentEnemies = adjacentCount(state, row, col, humanPlayer, neighbors);
  const pressure = kingPressureScore(state, row, col, humanPlayer);
  const capturePotential = localCapturePotential(state, row, col, aiPlayer, humanPlayer, neighbors);

  if (unitType === "general") {
    if (adjacentEnemies >= 3) return 85;
    if (adjacentEnemies === 2) return 55;
    if (adjacentEnemies === 1) return 18;
    return -10;
  }
  if (unitType === "diplomat") {
    const ownKingDist = ownKingSafetyScore(state, row, col, aiPlayer);
    if (adjacentEnemies >= 2) return 48 + ownKingDist * 2;
    if (adjacentEnemies === 1) return 20;
    return -8;
  }
  if (unitType === "wizard") {
    if (pressure > 0) return 38 + pressure * 2.5;
    if (adjacentEnemies > 0) return 25;
    return -5;
  }
  if (unitType === "soldier") {
    return capturePotential > 20 ? 25 : 8;
  }
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

  let total = centerScore * weights.center
    + adjacentAllies * weights.allies
    + adjacentEnemies * weights.enemies
    + homeBoardBias * weights.home
    + capturePotential * weights.capture
    + Math.max(0, adjacentEnemies - 1) * weights.threat
    + kingPressureScore(state, row, col, humanPlayer) * weights.kingPressure
    + ownKingSafetyScore(state, row, col, aiPlayer) * weights.kingSafety
    - dangerPenalty;

  if (weights.influence) {
    total += cellInfluenceScore(state, row, col, aiPlayer, humanPlayer) * weights.influence;
  }
  if (weights.groupTactics) {
    total += evaluateGroupTactics(state, row, col, aiPlayer, humanPlayer, neighbors);
  }

  return total;
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

function settleSimulationState(state, aiPlayer, humanPlayer, neighbors) {
  let safetyLimit = 12;
  while (safetyLimit-- > 0 && !state.winner) {
    if (state.pendingSpecial) {
      const specialOwner = state.pendingSpecial.owner;
      const ok = applyAction(state, specialOwner, { type: "activate_special" });
      if (!ok) break;
      continue;
    }
    if (state.teleporting) {
      const tpOwner = state.teleporting.owner;
      const enemy = tpOwner === aiPlayer ? humanPlayer : aiPlayer;
      const bestDest = chooseAiTeleportDestination(state, neighbors, tpOwner, enemy);
      if (bestDest) {
        applyAction(state, tpOwner, { type: "wizard_teleport", row: bestDest.row, col: bestDest.col });
      } else {
        applyAction(state, tpOwner, { type: "wizard_stay" });
      }
      continue;
    }
    break;
  }
  return state;
}

function createSampledBeliefWorlds(state, perspectivePlayer, opponentPlayer, sampleCount = 2) {
  const publicState = stateForPlayer(state, perspectivePlayer);

  const startingSpecials = { general: 1, wizard: 1, diplomat: 1 };
  const opponentStock = publicState.stock[opponentPlayer] || {};
  let unrevealedGeneral = startingSpecials.general - (opponentStock.general || 0);
  let unrevealedWizard = startingSpecials.wizard - (opponentStock.wizard || 0);
  let unrevealedDiplomat = startingSpecials.diplomat - (opponentStock.diplomat || 0);

  const unrevealedEnemyStones = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const piece = publicState.board[r][c];
      if (!piece || piece.owner !== opponentPlayer) continue;
      if (piece.revealed) {
        if (piece.type === "general") unrevealedGeneral -= 1;
        if (piece.type === "wizard") unrevealedWizard -= 1;
        if (piece.type === "diplomat") unrevealedDiplomat -= 1;
      } else {
        unrevealedEnemyStones.push({ row: r, col: c });
      }
    }
  }

  unrevealedGeneral = Math.max(0, unrevealedGeneral);
  unrevealedWizard = Math.max(0, unrevealedWizard);
  unrevealedDiplomat = Math.max(0, unrevealedDiplomat);

  const totalUnrevealedSpecials = unrevealedGeneral + unrevealedWizard + unrevealedDiplomat;
  if (totalUnrevealedSpecials === 0 || unrevealedEnemyStones.length === 0) {
    return [publicState];
  }

  const myKing = findKing(publicState, perspectivePlayer);
  unrevealedEnemyStones.sort((a, b) => {
    const distA = myKing ? Math.abs(a.row - myKing.row) + Math.abs(a.col - myKing.col) : 0;
    const distB = myKing ? Math.abs(b.row - myKing.row) + Math.abs(b.col - myKing.col) : 0;
    return distA - distB;
  });

  const worlds = [];

  // World 1: Trap World (Highest danger stone is General, 2nd is Wizard)
  const world1 = structuredClone(publicState);
  let gLeft = unrevealedGeneral;
  let wLeft = unrevealedWizard;
  let dLeft = unrevealedDiplomat;
  for (const pos of unrevealedEnemyStones) {
    const target = world1.board[pos.row][pos.col];
    if (!target) continue;
    if (gLeft > 0) {
      target.type = "general";
      target.originalType = "general";
      gLeft -= 1;
    } else if (wLeft > 0) {
      target.type = "wizard";
      target.originalType = "wizard";
      wLeft -= 1;
    } else if (dLeft > 0) {
      target.type = "diplomat";
      target.originalType = "diplomat";
      dLeft -= 1;
    }
  }
  worlds.push(world1);

  if (sampleCount >= 2) {
    const world2 = structuredClone(publicState);
    worlds.push(world2);
  }

  return worlds;
}

function simulateEngineTransition(state, player, action, neighbors) {
  const cloned = structuredClone(state);
  if (action.type === "deploy" && !cloned.pendingSpecial && !cloned.teleporting) {
    cloned.turn = player;
  }
  const ok = applyAction(cloned, player, action);
  if (!ok) return null;
  return settleSimulationState(cloned, player, opponent(player), neighbors);
}

function evaluateEngineTransitionDelta(beforeState, afterState, player, enemy, settings) {
  if (afterState.winner === player) return 100000;
  if (afterState.winner && afterState.winner !== player) return -100000;

  const weights = settings.score;
  let scoreDelta = 0;

  const captureGain = (afterState.stats?.captures?.[player] || 0) - (beforeState.stats?.captures?.[player] || 0);
  scoreDelta += captureGain * (weights.capture || 9) * 6;

  const enemyBefore = countStatePieces(beforeState, enemy);
  const enemyAfter = countStatePieces(afterState, enemy);
  const enemyLoss = enemyBefore - enemyAfter;
  if (enemyLoss > 0) {
    scoreDelta += enemyLoss * (weights.capture || 9) * 3;
  }

  const ownBefore = countStatePieces(beforeState, player);
  const ownAfter = countStatePieces(afterState, player);
  const ownLoss = (ownBefore + 1) - ownAfter;
  if (ownLoss > 0) {
    scoreDelta -= ownLoss * (weights.defense || 2) * (settings.ironcladKingDefense ? 14 : 8);
  }

  const enemyKingAfter = findKing(afterState, enemy);
  if (enemyKingAfter) {
    const enemyLibs = kingLibertyCount(afterState, enemy);
    if (enemyLibs === 1) scoreDelta += (weights.kingPressure || 10) * 18;
    else if (enemyLibs === 2) scoreDelta += (weights.kingPressure || 10) * 6;
  }

  const ownKingAfter = findKing(afterState, player);
  if (ownKingAfter) {
    const ownLibs = kingLibertyCount(afterState, player);
    if (ownLibs === 1) scoreDelta -= (weights.kingSafety || 10) * (settings.ironcladKingDefense ? 60 : 25);
    else if (ownLibs === 2) scoreDelta -= (weights.kingSafety || 10) * (settings.ironcladKingDefense ? 20 : 8);
  }

  return scoreDelta;
}

function evaluateTacticalMatingNet(state, aiPlayer, humanPlayer, depthRemaining, maxDepth = 6, neighbors) {
  if (state.winner === aiPlayer) return 100000;
  if (state.winner && state.winner !== aiPlayer) return -100000;
  if (depthRemaining <= 0) {
    const enemyLibs = kingLibertyCount(state, humanPlayer);
    if (enemyLibs === 1) return 800;
    if (enemyLibs === 2) return 200;
    return 0;
  }

  const enemyKing = findKing(state, humanPlayer);
  if (!enemyKing) return 100000;

  const isAiTurn = state.turn === aiPlayer;

  const candidateCells = [];
  for (const [r, c] of orthogonalPositions(enemyKing.row, enemyKing.col)) {
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && !state.board[r][c]) {
      candidateCells.push([r, c]);
    }
  }

  if (!candidateCells.length) return 0;

  if (isAiTurn) {
    let best = -Infinity;
    for (const [r, c] of candidateCells.slice(0, 4)) {
      const types = availableDeployTypes(state, aiPlayer, (o) => countStatePieces(state, o), humanPlayer);
      for (const t of types.slice(0, 2)) {
        const nextState = simulateEngineTransition(state, aiPlayer, { type: "deploy", unitType: t, row: r, col: c }, neighbors);
        if (!nextState) continue;
        const val = evaluateTacticalMatingNet(nextState, aiPlayer, humanPlayer, depthRemaining - 1, maxDepth, neighbors);
        if (val > best) best = val;
        if (best >= 100000) return 100000;
      }
    }
    return best === -Infinity ? 0 : best;
  } else {
    let worst = Infinity;
    for (const [r, c] of candidateCells.slice(0, 4)) {
      const types = availableDeployTypes(state, humanPlayer, (o) => countStatePieces(state, o), aiPlayer);
      for (const t of types.slice(0, 2)) {
        const nextState = simulateEngineTransition(state, humanPlayer, { type: "deploy", unitType: t, row: r, col: c }, neighbors);
        if (!nextState) continue;
        const val = evaluateTacticalMatingNet(nextState, aiPlayer, humanPlayer, depthRemaining - 1, maxDepth, neighbors);
        if (val < worst) worst = val;
        if (worst <= -100000) return -100000;
      }
    }
    return worst === Infinity ? 0 : worst;
  }
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

function scoreWithLookahead(state, candidate, settings, aiPlayer, humanPlayer, neighbors, alpha = -Infinity) {
  const action = { type: "deploy", unitType: candidate.type, row: candidate.row, col: candidate.col };

  const beliefWorlds = settings.beliefSampling
    ? createSampledBeliefWorlds(state, aiPlayer, humanPlayer, 2)
    : [stateForPlayer(state, aiPlayer)];

  let totalValue = 0;

  for (const world of beliefWorlds) {
    const afterAi = simulateEngineTransition(world, aiPlayer, action, neighbors);
    if (!afterAi) {
      totalValue += -100000;
      continue;
    }

    if (afterAi.winner === aiPlayer) {
      totalValue += 100000;
      continue;
    }
    if (afterAi.winner && afterAi.winner !== aiPlayer) {
      totalValue += -100000;
      continue;
    }

    const rootEngineDelta = evaluateEngineTransitionDelta(world, afterAi, aiPlayer, humanPlayer, settings);
    let worldValue = candidate.score + rootEngineDelta;

    // Tactical Checkmate Extension (6~8-ply deep mating net)
    if (settings.tacticalExtension) {
      const enemyLibs = kingLibertyCount(afterAi, humanPlayer);
      if (enemyLibs <= 2) {
        const matingScore = evaluateTacticalMatingNet(afterAi, aiPlayer, humanPlayer, 4, 8, neighbors);
        if (matingScore >= 100000) return 100000;
        worldValue += matingScore;
      }
    }

    if (settings.searchDepth >= 2) {
      const replies = generateSearchCandidates(afterAi, humanPlayer, aiPlayer, neighbors)
        .slice(0, settings.replyCandidateLimit || 12);

      if (replies.length > 0) {
        let strongestReply = -Infinity;
        for (const reply of replies) {
          const replyAction = { type: "deploy", unitType: reply.type, row: reply.row, col: reply.col };
          const afterReply = simulateEngineTransition(afterAi, humanPlayer, replyAction, neighbors);
          if (!afterReply) continue;

          if (afterReply.winner === humanPlayer) {
            strongestReply = 100000;
            break;
          }

          const replyEngineDelta = evaluateEngineTransitionDelta(afterAi, afterReply, humanPlayer, aiPlayer, settings);
          let replyValue = reply.score + replyEngineDelta;

          if (settings.searchDepth >= 3) {
            const continuations = generateSearchCandidates(afterReply, aiPlayer, humanPlayer, neighbors)
              .slice(0, settings.continuationCandidateLimit || 10);

            let bestContinuation = -Infinity;
            for (const cont of continuations) {
              const contAction = { type: "deploy", unitType: cont.type, row: cont.row, col: cont.col };
              const afterCont = simulateEngineTransition(afterReply, aiPlayer, contAction, neighbors);
              if (!afterCont) continue;

              if (afterCont.winner === aiPlayer) {
                bestContinuation = 100000;
                break;
              }

              const contEngineDelta = evaluateEngineTransitionDelta(afterReply, afterCont, aiPlayer, humanPlayer, settings);
              let contVal = cont.score + contEngineDelta;

              if (settings.searchDepth >= 4) {
                const ply4Candidates = generateSearchCandidates(afterCont, humanPlayer, aiPlayer, neighbors)
                  .slice(0, settings.ply4CandidateLimit || 6);

                let strongestPly4 = -Infinity;
                for (const ply4 of ply4Candidates) {
                  const ply4Action = { type: "deploy", unitType: ply4.type, row: ply4.row, col: ply4.col };
                  const afterPly4 = simulateEngineTransition(afterCont, humanPlayer, ply4Action, neighbors);
                  if (!afterPly4) continue;
                  if (afterPly4.winner === humanPlayer) {
                    strongestPly4 = 100000;
                    break;
                  }
                  const ply4Delta = evaluateEngineTransitionDelta(afterCont, afterPly4, humanPlayer, aiPlayer, settings);
                  const ply4Val = ply4.score + ply4Delta;
                  if (ply4Val > strongestPly4) strongestPly4 = ply4Val;
                }
                if (strongestPly4 !== -Infinity) {
                  contVal -= strongestPly4 * 0.5;
                }
              }

              if (contVal > bestContinuation) bestContinuation = contVal;
            }

            if (bestContinuation !== -Infinity) {
              replyValue -= bestContinuation * 0.6;
            }
          }

          if (replyValue > strongestReply) {
            strongestReply = replyValue;
            if (worldValue - 0.8 * strongestReply <= alpha) {
              break;
            }
          }
        }

        if (strongestReply !== -Infinity) {
          worldValue -= strongestReply * 0.8;
        }
      }
    }

    totalValue += worldValue;
  }

  return totalValue / beliefWorlds.length;
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
  if (!candidates.length) return null;

  // Fast Instant-Win check: If a candidate immediately captures the opponent King, play it instantly
  if (settings.instantKillCheck || settings.searchDepth >= 2) {
    for (const cand of candidates.slice(0, 10)) {
      const quickAction = { type: "deploy", unitType: cand.type, row: cand.row, col: cand.col };
      const simulated = simulateEngineTransition(state, aiPlayer, quickAction, neighbors);
      if (simulated && simulated.winner === aiPlayer) {
        return cand;
      }
    }
  }

  const limit = settings.searchDepth > 1 ? (settings.rootCandidateLimit || 20) : candidates.length;
  const searchedCandidates = candidates.slice(0, limit);
  let bestScore = -Infinity;

  for (const candidate of searchedCandidates) {
    const deepScore = scoreWithLookahead(state, candidate, settings, aiPlayer, humanPlayer, neighbors, bestScore);
    candidate.deepScore = deepScore;
    if (deepScore > bestScore) {
      bestScore = deepScore;
      if (deepScore >= 100000) {
        // Guaranteed winning move found, no need to search further root candidates
        break;
      }
    }
  }
  searchedCandidates.sort(compareCandidates);
  return searchedCandidates[0] || null;
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
