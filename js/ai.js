import { SIZE } from "./config.js";
import {
  applyAction,
  canDeploy,
  collectGroup,
  getLegalActions,
  groupHasLiberty,
  isSuicideDeployment,
  kingLibertyCount,
  opponent,
  orthogonalPositions,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";
import { evaluateStateTransition } from "./state-evaluation.js";
import {
  candidateActionKey,
  classifyAiCandidate,
  createAiCatalogContext,
} from "./ai-catalog.js";
import {
  KING_ADJACENT_SPECIAL_ODDS_FACTOR,
  KING_ADJACENT_SPECIAL_PROBABILITY,
  KING_TACTIC_PRIORITY,
  RECENT_SPECIAL_PROBABILITY,
  buildMidgameTacticalPolicy,
  classifyMidgameCandidate,
  gamePhase,
  kingAdjacentMinePositions,
  kingMineDefusalValue,
  kingWallConnectionValue,
  diplomatConversionCapturesKing,
  joinsOwnPendingSpecial,
  observedRemainingSpecialTypes,
  phaseStrategicMultiplier,
  specialAssaultTargets,
  specialCandidatePool,
  recentIntentValue,
  recentOpponentDeployments,
  wallTacticalValue,
} from "./strategic-analysis.js";

const SPECIAL_UNIT_TYPES = new Set(["general", "diplomat", "wizard"]);

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
    searchAlgorithm: "heuristic",
    typeWeights: { soldier: 40, general: 27, wizard: 18, diplomat: 15 },
    pressureMultiplier: 8,
    specialBoost: 16,
    variance: 1.5,
    considerAllTypes: true,
    // Opening doctrine: how far from its own wall this tier may plant the King,
    // then the four squares beside it.
    kingWallDistance: { min: 0, max: 6 },
    openingWallStones: 1,
    specialDeploymentPolicy: {
      earliestFirstDeployment: 9,
      firstDeploymentDeadline: null,
      maxConsecutive: 1,
      rescueAtariSpecial: true,
    },
    searchDepth: 2,
    rootCandidateLimit: 20,
    replyCandidateLimit: 12,
    criticalBeliefWorldLimit: 0,
    riskCandidateLimit: 0,
    deepRiskCandidateLimit: 0,
    score: { center: 2.4, allies: 4.5, enemies: 5.5, home: 1.2, capture: 24, threat: 11, kingPressure: 14, kingSafety: 8, defense: 6 },
  },

  // 2단계: 중급 (기존 초절정고수 수준: 외교관/진형 장악, searchDepth 2)
  intermediate: {
    searchAlgorithm: "heuristic",
    typeWeights: { soldier: 34, general: 31, wizard: 20, diplomat: 15 },
    pressureMultiplier: 10,
    specialBoost: 20,
    variance: 0.5,
    considerAllTypes: true,
    // Opening doctrine: how far from its own wall this tier may plant the King,
    // then the four squares beside it.
    kingWallDistance: { min: 0, max: 5 },
    openingWallStones: 2,
    specialDeploymentPolicy: {
      earliestFirstDeployment: 7,
      firstDeploymentDeadline: 8,
      maxConsecutive: 1,
      rescueAtariSpecial: true,
    },
    searchDepth: 2,
    rootCandidateLimit: 28,
    replyCandidateLimit: 16,
    criticalBeliefWorldLimit: 1,
    riskCandidateLimit: 3,
    deepRiskCandidateLimit: 0,
    score: { center: 2.8, allies: 5.5, enemies: 6.5, home: 1.4, capture: 34, threat: 16, kingPressure: 24, kingSafety: 18, defense: 12 },
  },

  // 3단계: 상급 (기존 화경 수준: 마법사 도약 및 변칙 전술, searchDepth 3)
  advanced: {
    searchAlgorithm: "heuristic",
    typeWeights: { soldier: 32, general: 28, wizard: 22, diplomat: 18 },
    pressureMultiplier: 11,
    specialBoost: 22,
    variance: 0,
    considerAllTypes: true,
    // Opening doctrine: how far from its own wall this tier may plant the King,
    // then the four squares beside it.
    kingWallDistance: { min: 0, max: 4 },
    openingWallStones: 2,
    specialDeploymentPolicy: {
      earliestFirstDeployment: 6,
      firstDeploymentDeadline: 8,
      maxConsecutive: 2,
      rescueAtariSpecial: true,
    },
    searchDepth: 3,
    rootCandidateLimit: 32,
    replyCandidateLimit: 20,
    continuationCandidateLimit: 12,
    // How much of the hidden pool this tier will bet against when a verified win is questioned
    // by a belief world. 0 demands certainty, which is what made the tiers that model belief
    // walk away from wins the tiers that do not took every time. Measured over a 260-position
    // exam: at 0.7 immediate wins found rise from 75%/48%/63% to 87%/80%/90% for
    // advanced/expert/grandmaster. Traps taken rise too, but a trap costs 2.24 stones on
    // average and ends the game 1 time in 41, while a missed win hands back a decided game.
    instantWinRiskTolerance: 0.7,
    criticalBeliefWorldLimit: 6,
    riskCandidateLimit: 3,
    deepRiskCandidateLimit: 0,
    score: { center: 3, allies: 6, enemies: 7, home: 1.5, capture: 38, threat: 18, kingPressure: 28, kingSafety: 22, defense: 15 },
  },

  // 4단계: 달인 (2~3수 연계 수읽기, 넓은 실리 포진 및 전술 확장)
  expert: {
    searchAlgorithm: "heuristic",
    typeWeights: { soldier: 30, general: 30, wizard: 22, diplomat: 18 },
    pressureMultiplier: 12,
    specialBoost: 26,
    variance: 0,
    considerAllTypes: true,
    // Opening doctrine: how far from its own wall this tier may plant the King,
    // then the four squares beside it.
    kingWallDistance: { min: 0, max: 3 },
    openingWallStones: 3,
    specialDeploymentPolicy: {
      earliestFirstDeployment: 6,
      firstDeploymentDeadline: 8,
      maxConsecutive: 3,
      rescueAtariSpecial: false,
    },
    searchDepth: 3,
    tacticalExtension: true,
    rootCandidateLimit: 36,
    replyCandidateLimit: 18,
    continuationCandidateLimit: 10,
    // How much of the hidden pool this tier will bet against when a verified win is questioned
    // by a belief world. 0 demands certainty, which is what made the tiers that model belief
    // walk away from wins the tiers that do not took every time. Measured over a 260-position
    // exam: at 0.7 immediate wins found rise from 75%/48%/63% to 87%/80%/90% for
    // advanced/expert/grandmaster. Traps taken rise too, but a trap costs 2.24 stones on
    // average and ends the game 1 time in 41, while a missed win hands back a decided game.
    instantWinRiskTolerance: 0.7,
    criticalBeliefWorldLimit: 6,
    riskCandidateLimit: 4,
    deepRiskCandidateLimit: 1,
    deepRiskWeight: 0.35,
    strategicContext: true,
    recentBeliefStrategy: true,
    recentSpecialProbability: RECENT_SPECIAL_PROBABILITY,
    recentIntentWeight: 4,
    wallTacticsWeight: 1,
    kingTacticalPriority: KING_TACTIC_PRIORITY,
    // Diagonal breaching is mandatory from here up; the lower tiers stumble onto it and are
    // left to keep planting mines they cannot manage, which is its own kind of difficulty.
    specialAssaultDoctrine: true,
    openingSpecialUrgency: true,
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
    searchAlgorithm: "heuristic",
    typeWeights: { soldier: 28, general: 32, wizard: 22, diplomat: 18 },
    pressureMultiplier: 14,
    specialBoost: 30,
    variance: 0,
    considerAllTypes: true,
    // Opening doctrine: how far from its own wall this tier may plant the King,
    // then the four squares beside it.
    kingWallDistance: { min: 1, max: 1 },
    openingWallStones: 4,
    specialDeploymentPolicy: {
      earliestFirstDeployment: 6,
      firstDeploymentDeadline: 8,
      maxConsecutive: 3,
      rescueAtariSpecial: false,
      reactiveReplantAfterActivation: true,
    },
    searchDepth: 3,
    localSearchDepth: 4,
    localFourPlyCandidateLimit: 6,
    tacticalExtension: true,
    instantKillCheck: true,
    ironcladKingDefense: true,
    rootCandidateLimit: 28,
    replyCandidateLimit: 12,
    continuationCandidateLimit: 8,
    ply4CandidateLimit: 4,
    // How much of the hidden pool this tier will bet against when a verified win is questioned
    // by a belief world. 0 demands certainty, which is what made the tiers that model belief
    // walk away from wins the tiers that do not took every time. Measured over a 260-position
    // exam: at 0.7 immediate wins found rise from 75%/48%/63% to 87%/80%/90% for
    // advanced/expert/grandmaster. Traps taken rise too, but a trap costs 2.24 stones on
    // average and ends the game 1 time in 41, while a missed win hands back a decided game.
    instantWinRiskTolerance: 0.7,
    criticalBeliefWorldLimit: 6,
    hiddenKingRiskVeto: true,
    riskCandidateLimit: 6,
    deepRiskCandidateLimit: 2,
    deepRiskWeight: 0.5,
    strategicContext: true,
    recentBeliefStrategy: true,
    recentSpecialProbability: RECENT_SPECIAL_PROBABILITY,
    recentIntentWeight: 6,
    wallTacticsWeight: 1.4,
    kingTacticalPriority: KING_TACTIC_PRIORITY,
    specialAssaultDoctrine: true,
    openingSpecialUrgency: true,
    // Grandmaster alone reads the Diplomat conversion that turns a guard and closes the net.
    diplomatConversionSight: true,
    kingMineStrategy: true,
    kingAdjacentSpecialProbability: KING_ADJACENT_SPECIAL_PROBABILITY,
    midgameCandidatePolicy: true,
    midgameTacticalCandidateLimit: 8,
    midgameSpecialAttackLimit: 4,
    kingAssaultSafetyCandidateLimit: 2,
    // Grandmaster-only, off by default. Switches King safety from a liberty-count bonus to a
    // soldier-capture-distance penalty; `experiments/fix-terminal-objective.json` turns it on
    // for A/B runs. Listed explicitly so the tier that owns the flag is visible here.
    terminalObjectiveModel: false,
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
  return state.aiSettings || AI_RANK_SETTINGS[normalizeAiTier(state.aiRank || state.aiDifficulty)];
}

export function normalizeAiTier(value) {
  return AI_TIER_ORDER.includes(value) ? value : LEGACY_RANK_MAP[value] || "novice";
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

const ASSAULT_RANK_BONUS = { 1: 180, 2: 120, 3: 60 };

/**
 * What a standing conversion capture is worth after the search has spoken.
 *
 * The same figure the static sight bonus uses, applied again once the reply term is in, because
 * the two answer different questions. The static one gets the move looked at; this one keeps it
 * from being talked out of by a line the opponent is free not to play. It is deliberately not
 * the instant-win score: the King dies when the Diplomat's group is surrounded and its reaction
 * fires, which the opponent can decline to bring about.
 */
const CONVERSION_CAPTURE_THREAT = 900;

const conversionThreat = (candidate) =>
  (candidate.midgameTactics?.conversionCapture ? CONVERSION_CAPTURE_THREAT : 0);

/**
 * Doctrine for spending a special, layered on top of the positional score.
 *
 * Three rules, all of them consequences of a reaction striking every adjacent enemy and
 * capturing an adjacent King outright:
 *
 *   - Go where it can reach the King. Beside it is decisive, the diagonals open two guarded
 *     sides with one detonation, outside a guard is the fallback.
 *   - Do not tuck a special beside one of ours that has not fired. The group gains liberties and
 *     both stones can sit inert for the rest of the game.
 *   - Against a guarded King prefer the two that clear stones. A Diplomat converts rather than
 *     removes, which is worth more once a way through already exists.
 */
/** Nothing has been spent yet and the lock is open, so the opening special is due. */
function firstSpecialIsDue(state, player, settings) {
  if (!settings.openingSpecialUrgency) return false;
  const stock = state.stock?.[player];
  if (!stock) return false;
  const untouched = SPECIAL_UNIT_TYPES.size
    === [...SPECIAL_UNIT_TYPES].filter((type) => (stock[type] || 0) > 0).length;
  return untouched && (state.deploymentCount?.[player] ?? 0) >= 5;
}

function specialAssaultAdjustment(state, unitType, row, col, aiPlayer, humanPlayer, settings) {
  if (!SPECIAL_UNIT_TYPES.has(unitType)) return 0;
  // A conversion that completes the surround wins without the Diplomat ever touching the King,
  // and it is invisible one ply deep because the reaction has not happened yet.
  if (settings.diplomatConversionSight && unitType === "diplomat"
    && diplomatConversionCapturesKing(state, aiPlayer, humanPlayer, row, col)) {
    return 900;
  }
  if (!settings.specialAssaultDoctrine) return 0;
  if (joinsOwnPendingSpecial(state, aiPlayer, row, col)) return -220;
  const target = specialAssaultTargets(state, aiPlayer, humanPlayer)
    .find((candidate) => candidate.row === row && candidate.col === col);
  if (!target) return 0;
  const clears = unitType === "general" || unitType === "wizard";
  const breaching = target.rank > 1 && clears ? 40 : 0;
  // The opening special goes out the move it becomes legal, at the best square available, rather
  // than waiting for a position that scores well on its own terms.
  const opening = firstSpecialIsDue(state, aiPlayer, settings) ? 260 : 0;
  return (ASSAULT_RANK_BONUS[target.rank] || 0) + breaching + opening;
}

function scoreDeployType(state, unitType, row, col, neighbors, aiPlayer, humanPlayer) {
  if (!difficultySettings(state).considerAllTypes) return 0;
  const adjacentEnemies = adjacentCount(state, row, col, humanPlayer, neighbors);
  const pressure = kingPressureScore(state, row, col, humanPlayer);
  const capturePotential = localCapturePotential(state, row, col, aiPlayer, humanPlayer, neighbors);
  const doctrine = specialAssaultAdjustment(
    state, unitType, row, col, aiPlayer, humanPlayer, difficultySettings(state),
  );

  if (unitType === "general") {
    if (adjacentEnemies >= 3) return 85 + doctrine;
    if (adjacentEnemies === 2) return 55 + doctrine;
    if (adjacentEnemies === 1) return 18 + doctrine;
    return -10 + doctrine;
  }
  if (unitType === "diplomat") {
    const ownKingDist = ownKingSafetyScore(state, row, col, aiPlayer);
    if (adjacentEnemies >= 2) return 48 + ownKingDist * 2 + doctrine;
    if (adjacentEnemies === 1) return 20 + doctrine;
    return -8 + doctrine;
  }
  if (unitType === "wizard") {
    if (pressure > 0) return 38 + pressure * 2.5 + doctrine;
    if (adjacentEnemies > 0) return 25 + doctrine;
    return -5 + doctrine;
  }
  if (unitType === "soldier") {
    return capturePotential > 20 ? 25 : 8;
  }
  return 0;
}

function scoreCell(state, row, col, neighbors, aiPlayer, humanPlayer, rootStrategic = false) {
  const centerScore = 8 - (Math.abs(row - 4) + Math.abs(col - 4));
  const adjacentAllies = adjacentCount(state, row, col, aiPlayer, neighbors);
  const adjacentEnemies = adjacentCount(state, row, col, humanPlayer, neighbors);
  const homeBoardBias = aiPlayer === "black" ? SIZE - 1 - row : row;
  const weights = difficultySettings(state).score;
  const capturePotential = localCapturePotential(state, row, col, aiPlayer, humanPlayer, neighbors);
  const liberties = libertiesAfterDeploy(state, row, col, aiPlayer, neighbors);
  const dangerPenalty = Math.max(0, 2 - liberties) * weights.defense;

  let strategicScore = centerScore * weights.center
    + adjacentAllies * weights.allies
    + adjacentEnemies * weights.enemies
    + homeBoardBias * weights.home
    + capturePotential * weights.capture
    + Math.max(0, adjacentEnemies - 1) * weights.threat
    - dangerPenalty;
  let kingScore = kingPressureScore(state, row, col, humanPlayer) * weights.kingPressure
    + ownKingSafetyScore(state, row, col, aiPlayer) * weights.kingSafety;

  if (weights.influence) {
    strategicScore += cellInfluenceScore(state, row, col, aiPlayer, humanPlayer) * weights.influence;
  }
  if (weights.groupTactics) {
    strategicScore += evaluateGroupTactics(state, row, col, aiPlayer, humanPlayer, neighbors);
  }

  const settings = difficultySettings(state);
  let wallTactics = null;
  let recentIntent = 0;
  if (settings.strategicContext) {
    const phaseMultiplier = phaseStrategicMultiplier(state);
    strategicScore *= phaseMultiplier;
    recentIntent = recentIntentValue(state, row, col, aiPlayer);
    strategicScore += recentIntent * (settings.recentIntentWeight || 0) * phaseMultiplier;
    if (gamePhase(state) !== "opening") {
      wallTactics = wallTacticalValue(state, row, col, aiPlayer, humanPlayer);
      strategicScore += wallTactics.value * (settings.wallTacticsWeight || 0) * phaseMultiplier;
    }
    if (settings.kingMineStrategy && rootStrategic) {
      kingScore += kingMineDefusalValue(state, row, col, aiPlayer, humanPlayer).value;
      kingScore += kingWallConnectionValue(state, row, col, aiPlayer).value;
    }
    // Root ordering has to combine the same way the state evaluation does, or candidates get
    // ranked by one objective and then searched under another.
    const priority = settings.terminalObjectiveModel || settings.additiveObjectiveModel
      ? 0
      : Math.max(0, Math.min(1, settings.kingTacticalPriority || 0));
    if (kingScore !== 0 && priority > 0) {
      return kingScore * priority + strategicScore * (1 - priority);
    }
  }

  return strategicScore + kingScore;
}

function compareCandidates(a, b, perspectivePlayer) {
  const relativeRowA = perspectivePlayer === "black" ? a.row : SIZE - 1 - a.row;
  const relativeRowB = perspectivePlayer === "black" ? b.row : SIZE - 1 - b.row;
  return (b.deepScore ?? b.score) - (a.deepScore ?? a.score)
    || b.score - a.score
    || relativeRowA - relativeRowB
    || a.col - b.col
    || a.type.localeCompare(b.type);
}

function hasAdjacentEmptyCell(state, row, col) {
  return orthogonalPositions(row, col).some(([nextRow, nextCol]) =>
    nextRow >= 0 && nextRow < SIZE && nextCol >= 0 && nextCol < SIZE && !state.board[nextRow][nextCol]);
}

/**
 * A placement that throws the unit away for nothing.
 *
 * Uses `isSuicideDeployment` rather than `isEnclosedPlacement` because special reactions
 * genuinely rescue the placement: a special dropped into an enclosed point fires and
 * survives, and an ordinary soldier that seals a group holding an unspent special is saved
 * when that special triggers. Neither wastes the unit, so neither should be filtered.
 *
 * Sharing the predicate with `hasLegalDeployment` also keeps the AI and the engine in
 * agreement — if this removes every candidate, the engine likewise reports no legal
 * deployment and offers `pass`, so the AI can never be left with nothing to play.
 *
 * The cheap adjacency test comes first because the exact check clones and re-resolves the
 * board, and this runs over every legal cell of every deployable type.
 */
function isPointlessSuicide(publicState, player, type, row, col, neighbors) {
  if (hasAdjacentEmptyCell(publicState, row, col)) return false;
  if (!isSuicideDeployment(publicState, player, type, row, col)) return false;

  // A sacrifice on the last useful point can end the match by territory in the same
  // authoritative transition. It is not pointless when the sacrificed stone still leaves us
  // ahead and the opponent has no legal deployment. Keep that rare candidate so the instant-win
  // pass below can select it before ordinary positional ordering.
  const result = simulateEngineTransition(
    publicState,
    player,
    { type: "deploy", unitType: type, row, col },
    neighbors,
  );
  return result?.winner !== player;
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

export function compareBeliefStonePositions(a, b, myKing, perspectivePlayer) {
  const distA = myKing ? Math.abs(a.row - myKing.row) + Math.abs(a.col - myKing.col) : 0;
  const distB = myKing ? Math.abs(b.row - myKing.row) + Math.abs(b.col - myKing.col) : 0;
  const relativeRowA = perspectivePlayer === "black" ? a.row : SIZE - 1 - a.row;
  const relativeRowB = perspectivePlayer === "black" ? b.row : SIZE - 1 - b.row;
  return distA - distB || relativeRowA - relativeRowB || a.col - b.col;
}

function unrevealedSpecialCounts(publicState, perspectivePlayer, opponentPlayer) {
  const remaining = new Set(observedRemainingSpecialTypes(publicState, perspectivePlayer, opponentPlayer));
  return Object.fromEntries(
    ["general", "wizard", "diplomat"].map((type) => [type, remaining.has(type) ? 1 : 0]),
  );
}

function criticalHiddenStonesForDeploy(
  publicState,
  perspectivePlayer,
  opponentPlayer,
  candidate,
  includeKingMines = false,
  includeRecentIntent = true,
) {
  if (!candidate || publicState.board[candidate.row]?.[candidate.col]) return [];
  const probe = structuredClone(publicState);
  probe.board[candidate.row][candidate.col] = {
    id: "belief-probe",
    owner: perspectivePlayer,
    type: candidate.type,
    originalType: candidate.type,
    revealed: candidate.type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };

  const critical = [];
  const seenGroups = new Set();
  const seenStones = new Set();
  for (const [row, col] of orthogonalPositions(candidate.row, candidate.col)) {
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) continue;
    if (probe.board[row][col]?.owner !== opponentPlayer) continue;
    const group = collectGroup(probe, row, col);
    const groupKey = group.map(([groupRow, groupCol]) => `${groupRow}:${groupCol}`).sort().join("|");
    if (seenGroups.has(groupKey) || groupHasLiberty(probe, group, opponentPlayer)) continue;
    seenGroups.add(groupKey);
    for (const [groupRow, groupCol] of group) {
      const piece = publicState.board[groupRow][groupCol];
      const stoneKey = `${groupRow}:${groupCol}`;
      if (!piece?.revealed && !seenStones.has(stoneKey)) {
        seenStones.add(stoneKey);
        critical.push({ row: groupRow, col: groupCol, reason: "capture" });
      }
    }
  }
  if (includeKingMines) {
    for (const position of kingAdjacentMinePositions(publicState, perspectivePlayer, opponentPlayer)) {
      const stoneKey = `${position.row}:${position.col}`;
      if (seenStones.has(stoneKey)) {
        const existing = critical.find(({ row, col }) => row === position.row && col === position.col);
        if (existing) existing.isKingMine = true;
        continue;
      }
      seenStones.add(stoneKey);
      critical.push({ ...position, reason: "king_adjacent_mine", isKingMine: true });
    }
  }
  const myKing = findKing(publicState, perspectivePlayer);
  const recent = includeRecentIntent ? recentOpponentDeployments(publicState, perspectivePlayer, 4) : [];
  for (const [index, position] of recent.entries()) {
    const piece = publicState.board[position.row]?.[position.col];
    if (!piece || piece.owner !== opponentPlayer || piece.revealed || piece.type === "king") continue;
    const candidateDistance = Math.abs(candidate.row - position.row) + Math.abs(candidate.col - position.col);
    const kingDistance = myKing
      ? Math.abs(myKing.row - position.row) + Math.abs(myKing.col - position.col)
      : Infinity;
    if (candidateDistance > 4 && kingDistance > 3) continue;
    const stoneKey = `${position.row}:${position.col}`;
    if (seenStones.has(stoneKey)) {
      const existing = critical.find(({ row, col }) => row === position.row && col === position.col);
      if (existing) {
        existing.isRecent = true;
        existing.recency = index;
      }
      continue;
    }
    seenStones.add(stoneKey);
    critical.push({
      row: position.row,
      col: position.col,
      reason: "recent_intent",
      isRecent: true,
      recency: index,
    });
  }
  return critical.sort((a, b) => Number(Boolean(b.isKingMine)) - Number(Boolean(a.isKingMine))
    || Number(Boolean(b.isRecent)) - Number(Boolean(a.isRecent))
    || (a.recency ?? Infinity) - (b.recency ?? Infinity)
    || compareBeliefStonePositions(a, b, myKing, perspectivePlayer));
}

function createCriticalBeliefWorlds(publicState, perspectivePlayer, opponentPlayer, candidate, settings) {
  const criticalStones = criticalHiddenStonesForDeploy(
    publicState,
    perspectivePlayer,
    opponentPlayer,
    candidate,
    Boolean(settings.kingMineStrategy),
    settings.recentBeliefStrategy !== false,
  );
  if (!criticalStones.length) return [];

  const specialCounts = unrevealedSpecialCounts(publicState, perspectivePlayer, opponentPlayer);
  const worlds = [];
  for (const position of criticalStones) {
    for (const type of ["general", "wizard", "diplomat"]) {
      if (specialCounts[type] <= 0) continue;
      const world = structuredClone(publicState);
      const piece = world.board[position.row][position.col];
      if (!piece) continue;
      piece.type = type;
      piece.originalType = type;
      worlds.push({
        state: world,
        row: position.row,
        col: position.col,
        type,
        isRecent: Boolean(position.isRecent),
        isKingMine: Boolean(position.isKingMine),
        reason: position.reason,
      });
    }
  }
  return worlds;
}

/**
 * How likely an engine-verified win survives the specials that could still be hiding.
 *
 * The belief worlds say *what* could go wrong; they say nothing about *how likely* it is. A
 * hypothesis places a specific special on a specific stone, and the odds of that stone being
 * that special are one in however many enemy stones are still unidentified — usually dozens.
 * Treating every hypothesis as certain is what made the tiers that model belief the ones that
 * walk away from wins: measured over 118 positions, immediate wins found ran 85% for the two
 * tiers with almost no belief modelling and 40% for expert, with the miss sets nesting.
 *
 * Each critical stone can only be one unit, so its danger is the number of failing types over
 * the size of the hidden pool, and the win holds only if none of the critical stones turns out
 * to be dangerous.
 */
function instantWinSurvivalOdds(publicState, opponentPlayer, failingWorlds) {
  const pool = specialCandidatePool(publicState, opponentPlayer);
  // No stone left that could be a special means the hypotheses are empty talk and the verified
  // win stands. `specialCandidatePool` rules out the opening ten stones outright, since nobody
  // may deploy a special before their fifth move.
  if (pool <= 0) return 1;
  const kings = ["black", "white"].map((side) => findKing(publicState, side)).filter(Boolean);
  const besideKing = (row, col) => kings.some((king) =>
    Math.abs(king.row - row) + Math.abs(king.col - col) === 1);

  const dangerousTypesByStone = new Map();
  for (const world of failingWorlds) {
    const key = `${world.row}:${world.col}`;
    dangerousTypesByStone.set(key, (dangerousTypesByStone.get(key) || 0) + 1);
  }
  let odds = 1;
  for (const [key, dangerous] of dangerousTypesByStone) {
    const [row, col] = key.split(":").map(Number);
    // A stone that got itself next to a King is a chosen stone, not a random one, and is about
    // three times likelier to be a special. Anywhere else the base rate stands.
    const weight = besideKing(row, col) ? KING_ADJACENT_SPECIAL_ODDS_FACTOR : 1;
    odds *= Math.max(0, 1 - Math.min(pool, dangerous * weight) / pool);
  }
  return odds;
}

function immediateBeliefValue(beforeState, afterState, aiPlayer, humanPlayer, settings) {
  if (!afterState || afterState.winner === humanPlayer) return -100000;
  if (afterState.winner === aiPlayer) return 100000;
  return evaluateEngineTransitionDelta(beforeState, afterState, aiPlayer, humanPlayer, settings);
}

function evaluateCriticalBeliefRisk(
  publicState,
  criticalWorlds,
  candidate,
  settings,
  aiPlayer,
  humanPlayer,
  neighbors,
) {
  if (!criticalWorlds.length) return null;
  const action = { type: "deploy", unitType: candidate.type, row: candidate.row, col: candidate.col };
  const publicAfter = simulateEngineTransition(publicState, aiPlayer, action, neighbors);
  const publicValue = immediateBeliefValue(publicState, publicAfter, aiPlayer, humanPlayer, settings);
  const outcomes = criticalWorlds.map((hypothesis) => {
    const after = simulateEngineTransition(hypothesis.state, aiPlayer, action, neighbors);
    return {
      ...hypothesis,
      after,
      value: immediateBeliefValue(hypothesis.state, after, aiPlayer, humanPlayer, settings),
    };
  });
  if (settings.recentBeliefStrategy === false) {
    const averageValue = (publicValue + outcomes.reduce((sum, outcome) => sum + outcome.value, 0))
      / (outcomes.length + 1);
    const worstOutcome = outcomes.reduce(
      (worst, outcome) => !worst || outcome.value < worst.value ? outcome : worst,
      null,
    );
    return {
      adjustment: averageValue - publicValue,
      fatal: outcomes.some((outcome) => outcome.after?.winner === humanPlayer),
      worstWorld: worstOutcome?.state || null,
      specialProbability: outcomes.length / (outcomes.length + 1),
      hypothesisCount: outcomes.length,
      kingMineHypothesis: false,
    };
  }
  const hasKingMineHypothesis = settings.kingMineStrategy && outcomes.some(({ isKingMine }) => isKingMine);
  const hasRecentHypothesis = outcomes.some(({ isRecent }) => isRecent);
  const specialProbability = hasKingMineHypothesis
    ? Math.max(0, Math.min(1, settings.kingAdjacentSpecialProbability
      ?? KING_ADJACENT_SPECIAL_PROBABILITY))
    : hasRecentHypothesis
      ? Math.max(0, Math.min(1, settings.recentSpecialProbability ?? RECENT_SPECIAL_PROBABILITY))
      : 0.35;
  const specialAverage = outcomes.reduce((sum, outcome) => sum + outcome.value, 0) / outcomes.length;
  const averageValue = publicValue * (1 - specialProbability) + specialAverage * specialProbability;
  const worstOutcome = outcomes.reduce(
    (worst, outcome) => !worst || outcome.value < worst.value ? outcome : worst,
    null,
  );
  return {
    adjustment: averageValue - publicValue,
    fatal: outcomes.some((outcome) => outcome.after?.winner === humanPlayer),
    worstWorld: worstOutcome?.state || null,
    specialProbability,
    hypothesisCount: outcomes.length,
    kingMineHypothesis: hasKingMineHypothesis,
  };
}

function materializeUnknownStockForSimulation(state, player) {
  if (state.stock[player] !== null) return;

  const perspective = opponent(player);
  const remainingSpecials = new Set(observedRemainingSpecialTypes(state, perspective, player));
  const deployedSpecials = new Set();
  for (const piece of state.board.flat()) {
    if (!piece || piece.owner !== player) continue;
    const knownType = piece.originalType || piece.type;
    if (["general", "wizard", "diplomat"].includes(knownType)) {
      deployedSpecials.add(knownType);
    }
  }

  const kingUsed = state.firstDeployDone[player] ? 1 : 0;
  const deployments = state.deploymentCount?.[player] ?? kingUsed;
  const assumedSoldiersUsed = Math.max(0, deployments - kingUsed - deployedSpecials.size);
  state.stock[player] = {
    soldier: Math.max(0, 77 - assumedSoldiersUsed),
    king: kingUsed ? 0 : 1,
    general: remainingSpecials.has("general") ? 1 : 0,
    diplomat: remainingSpecials.has("diplomat") ? 1 : 0,
    wizard: remainingSpecials.has("wizard") ? 1 : 0,
  };
}

function simulateEngineTransition(state, player, action, neighbors) {
  const cloned = structuredClone(state);
  materializeUnknownStockForSimulation(cloned, "black");
  materializeUnknownStockForSimulation(cloned, "white");
  if (action.type === "deploy" && !cloned.pendingSpecial && !cloned.teleporting) {
    cloned.turn = player;
  }
  const ok = applyAction(cloned, player, action);
  if (!ok) return null;
  return settleSimulationState(cloned, player, opponent(player), neighbors);
}

function evaluateEngineTransitionDelta(beforeState, afterState, player, enemy, settings) {
  return evaluateStateTransition(beforeState, afterState, player, settings);
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
  // A missing King is not necessarily captured: during opening deployment the
  // second player's King has not entered the board yet. Real King captures set
  // state.winner and are handled above.
  if (!enemyKing) return 0;

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
  candidates.sort((a, b) => compareCandidates(a, b, player));
  return candidates;
}

function prioritizeMidgameCandidates(state, candidates, player, enemy, settings, limit) {
  const finishPool = (selected, keptReason, stoppedReason) => {
    const selectedByKey = new Map(selected.map(
      (candidate) => [candidateActionKey(candidate), candidate],
    ));
    for (const candidate of candidates) {
      const selectedCandidate = selectedByKey.get(candidateActionKey(candidate));
      const kept = Boolean(selectedCandidate);
      candidate.searchPoolDiagnostic = {
        outcome: kept ? "kept" : "stopped",
        reason: kept
          ? (typeof keptReason === "function" ? keptReason(selectedCandidate) : keptReason)
          : stoppedReason,
      };
    }
    for (const candidate of selected) {
      candidate.searchPoolDiagnostic = candidates.find(
        (source) => candidateActionKey(source) === candidateActionKey(candidate),
      )?.searchPoolDiagnostic || { outcome: "kept", reason: keptReason };
    }
    return selected;
  };
  if (!settings.midgameCandidatePolicy || !candidates.length) {
    return finishPool(candidates.slice(0, limit), "score_limit_survivor", "outside_score_limit");
  }
  const policy = buildMidgameTacticalPolicy(state, player, enemy, {
    conversionSight: settings.diplomatConversionSight,
  });
  if (!policy.active) {
    return finishPool(candidates.slice(0, limit), "inactive_policy_score_survivor", "outside_score_limit");
  }
  const classified = candidates.map((candidate) => ({
    candidate,
    tactics: classifyMidgameCandidate(policy, candidate),
  }));
  const specialAttacks = classified.filter(({ tactics }) => tactics.specialAttack);
  if (specialAttacks.length) {
    const bestSpecialOrder = Math.max(...specialAttacks.map(({ tactics }) => tactics.specialOrder));
    const attacks = specialAttacks
      .filter(({ tactics }) => tactics.specialOrder === bestSpecialOrder
        || (bestSpecialOrder === 3 && tactics.specialOrder === 2))
      .sort((a, b) => Number(b.tactics.reactiveReplant) - Number(a.tactics.reactiveReplant)
        || b.tactics.specialOrder - a.tactics.specialOrder
        || a.tactics.kingDistance - b.tactics.kingDistance
        || compareCandidates(a.candidate, b.candidate, player))
      .slice(0, Math.min(limit, settings.midgameSpecialAttackLimit || 4));
    const safetyReserve = classified
      .filter(({ tactics }) => !tactics.specialAttack)
      .sort((a, b) => compareCandidates(a.candidate, b.candidate, player))
      .slice(0, Math.max(0, Math.min(
        limit - attacks.length,
        settings.kingAssaultSafetyCandidateLimit || 0,
      )));
    const selected = [...attacks, ...safetyReserve]
      .map(({ candidate, tactics }) => ({ ...candidate, midgameTactics: tactics }));
    return finishPool(
      selected,
      (candidate) => candidate.midgameTactics?.specialAttack
        ? "midgame_special_attack" : "king_assault_safety_reserve",
      "midgame_special_attack_filter",
    );
  }

  const forced = classified.filter(({ tactics }) => tactics.forcedSoldierLiberty);
  if (forced.length) {
    return finishPool(
      forced.map(({ candidate, tactics }) => ({ ...candidate, midgameTactics: tactics })).slice(0, limit),
      "midgame_forced_soldier_liberty",
      "midgame_forced_soldier_filter",
    );
  }

  const captures = classified.filter(({ tactics }) => tactics.capture);
  if (captures.length) {
    return finishPool(captures
      .sort((a, b) => compareCandidates(a.candidate, b.candidate, player))
      .slice(0, limit)
      .map(({ candidate, tactics }) => ({ ...candidate, midgameTactics: tactics })),
    "midgame_capture",
    "midgame_capture_filter");
  }

  const positional = classified
    .filter(({ tactics }) => tactics.homeSeal || tactics.wallBridge)
    .sort((a, b) => Number(b.tactics.homeSeal) - Number(a.tactics.homeSeal)
      || Number(b.tactics.wallBridge) - Number(a.tactics.wallBridge)
      || compareCandidates(a.candidate, b.candidate, player));
  if (positional.length) {
    return finishPool(positional
      .slice(0, Math.min(limit, settings.midgameTacticalCandidateLimit || 8))
      .map(({ candidate, tactics }) => ({ ...candidate, midgameTactics: tactics })),
    "midgame_position",
    "midgame_position_filter");
  }
  return finishPool(
    candidates.slice(0, Math.min(limit, settings.midgameTacticalCandidateLimit || 8)),
    "midgame_fallback_score_survivor",
    "outside_midgame_fallback_limit",
  );
}

function isLocalStrategicCandidate(state, candidate, player, enemy) {
  const recent = recentOpponentDeployments(state, player, 4);
  if (recent.some(({ row, col }) => Math.abs(candidate.row - row) + Math.abs(candidate.col - col) <= 4)) {
    return true;
  }
  for (const owner of [player, enemy]) {
    const king = findKing(state, owner);
    if (king && Math.abs(candidate.row - king.row) + Math.abs(candidate.col - king.col) <= 3) return true;
  }
  return gamePhase(state) !== "opening"
    && wallTacticalValue(state, candidate.row, candidate.col, player, enemy).value !== 0;
}

function selectSearchCandidates(state, player, enemy, neighbors, limit) {
  const candidates = generateSearchCandidates(state, player, enemy, neighbors);
  if (candidates.length <= limit) return candidates;

  const ownKingInCrisis = kingLibertyCount(state, player) === 1;
  const enemyKingInCrisis = kingLibertyCount(state, enemy) === 1;
  if (!ownKingInCrisis && !enemyKingInCrisis) {
    return prioritizeMidgameCandidates(state, candidates, player, enemy, difficultySettings(state), limit);
  }

  const winningMoves = [];
  const rescueMoves = [];
  for (const candidate of candidates) {
    const nextState = simulateEngineTransition(state, player, {
      type: "deploy",
      unitType: candidate.type,
      row: candidate.row,
      col: candidate.col,
    }, neighbors);
    if (!nextState) continue;

    if (nextState.winner === player) {
      winningMoves.push(candidate);
      continue;
    }
    if (
      ownKingInCrisis
      && !nextState.winner
      && kingLibertyCount(nextState, player) > 1
    ) {
      rescueMoves.push(candidate);
    }
  }

  const selected = [];
  const seen = new Set();
  const append = (candidate) => {
    const key = `${candidate.type}:${candidate.row}:${candidate.col}`;
    if (seen.has(key)) return;
    seen.add(key);
    selected.push(candidate);
  };

  winningMoves.forEach(append);
  rescueMoves.forEach(append);
  const fallback = prioritizeMidgameCandidates(
    state,
    candidates,
    player,
    enemy,
    difficultySettings(state),
    limit,
  );
  for (const candidate of fallback) {
    if (selected.length >= limit && seen.size >= winningMoves.length + rescueMoves.length) break;
    append(candidate);
  }
  return selected;
}

function scoreWithLookahead(
  state,
  candidate,
  settings,
  aiPlayer,
  humanPlayer,
  neighbors,
  alpha = -Infinity,
  worldOverride = null,
) {
  const action = { type: "deploy", unitType: candidate.type, row: candidate.row, col: candidate.col };
  // One belief world per call: the caller decides whether that is the public state
  // or a specific hidden-special hypothesis (see the deep-risk pass in findAiDeployMove).
  const world = worldOverride || stateForPlayer(state, aiPlayer);

  const afterAi = simulateEngineTransition(world, aiPlayer, action, neighbors);
  if (!afterAi) return -100000;
  if (afterAi.winner === aiPlayer) return 100000;
  if (afterAi.winner && afterAi.winner !== aiPlayer) return -100000;

  const rootEngineDelta = evaluateEngineTransitionDelta(world, afterAi, aiPlayer, humanPlayer, settings);
  let worldValue = candidate.score + rootEngineDelta;

  // Tactical Checkmate Extension (6~8-ply deep mating net)
  if (settings.tacticalExtension) {
    const enemyLibs = kingLibertyCount(afterAi, humanPlayer);
    // kingLibertyCount returns -1 while the opponent's King is not deployed.
    if (enemyLibs >= 0 && enemyLibs <= 2) {
      const matingScore = evaluateTacticalMatingNet(afterAi, aiPlayer, humanPlayer, 4, 8, neighbors);
      if (matingScore >= 100000) return 100000;
      worldValue += matingScore;
    }
  }

  if (settings.searchDepth >= 2) {
    const replies = selectSearchCandidates(
      afterAi,
      humanPlayer,
      aiPlayer,
      neighbors,
      settings.replyCandidateLimit || 12,
    );

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
          const continuations = selectSearchCandidates(
            afterReply,
            aiPlayer,
            humanPlayer,
            neighbors,
            settings.continuationCandidateLimit || 10,
          );

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
              const ply4Candidates = selectSearchCandidates(
                afterCont,
                humanPlayer,
                aiPlayer,
                neighbors,
                settings.ply4CandidateLimit || 6,
              );

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

  return worldValue;
}

/**
 * Opening doctrine — the King stands near its own wall, and its four orthogonal squares are the
 * first stones played.
 *
 * Two things argue for it. Measured over recorded games the squares beside a King are 39% own
 * stones, so protecting them is already the dominant pattern, and Stage 3's breach play assumes a
 * King that has to be broken open before it can be reached. And a King in the open centre reads as
 * safer than it is: `kingLibertyCount` adds wall liberties and board liberties together, so a King
 * sealed against its own wall scores as though it were in danger when soldiers cannot take it at
 * all.
 *
 * The band is one half of the difficulty ladder. A wide one leaves the tier free to wander into
 * the centre; a narrow one holds it to the wall. Only the row is constrained — which column, and
 * which square to fill first, stay the tier's own judgement.
 *
 * `openingWallStones` is the other half, and it has to be graded too. Left at four for everyone it
 * quietly cancelled the band: Novice's 0-6 band is wide enough to keep the centre, but a full ring
 * is a full ring wherever it stands, so Novice opened with the same textbook shape as Grandmaster
 * and only the King's row differed. `variance` does not rescue it either — the plan filters the
 * candidates down to the ring, so variance only shuffles the order inside it. Novice now lays one
 * stone and plays on, and the ring closes a square at a time up the ladder.
 */
function wallDistanceRow(player, distance) {
  return player === "black" ? distance : SIZE - 1 - distance;
}

export const AI_DECISION_STAGE = Object.freeze({
  OPENING_KING: "opening_king",
  OPENING_SANCTUARY: "opening_sanctuary",
  OPENING_FREE_PLAY: "opening_free_play",
  CATALOG: "catalog",
});

/**
 * The opening contract sits above terminal checks and every scoring catalog.
 *
 * The rules engine always requires the King first and protects its sanctuary through the
 * owner's fifth deployment. This contract adds the tier's policy inside that protected window:
 * the King row band, then the configured number of adjacent wall stones. Once that tier-specific
 * construction is complete, the remaining sanctuary turns are deliberately free play, but they
 * are still identified as opening so later catalog arbitration cannot silently take precedence.
 */
export function openingDecisionContract(state, player, settings) {
  const band = settings.kingWallDistance;
  if (!state.firstDeployDone?.[player]) {
    const rows = new Set();
    if (band) {
      for (let distance = band.min; distance <= band.max; distance += 1) {
        rows.add(wallDistanceRow(player, distance));
      }
    }
    return {
      stage: AI_DECISION_STAGE.OPENING_KING,
      sanctuaryActive: false,
      allows: (type, row) => type === "king" && (!rows.size || rows.has(row)),
    };
  }

  const placed = state.deploymentCount?.[player] ?? 1;
  const sanctuaryActive = placed > 0 && placed < 5;
  if (!sanctuaryActive) {
    return {
      stage: AI_DECISION_STAGE.CATALOG,
      sanctuaryActive: false,
      allows: null,
    };
  }

  const stones = settings.openingWallStones || 0;
  if (!stones || placed > stones) {
    return {
      stage: AI_DECISION_STAGE.OPENING_FREE_PLAY,
      sanctuaryActive: true,
      allows: null,
    };
  }
  const king = findKing(state, player);
  if (!king) {
    return {
      stage: AI_DECISION_STAGE.OPENING_FREE_PLAY,
      sanctuaryActive: true,
      allows: null,
    };
  }
  const ring = new Set(orthogonalPositions(king.row, king.col)
    .filter(([row, col]) => row >= 0 && row < SIZE && col >= 0 && col < SIZE)
    .filter(([row, col]) => !state.board[row][col])
    .map(([row, col]) => `${row}:${col}`));
  // Nothing left to wall in — an edge column, or the opponent took the square first.
  if (!ring.size) {
    return {
      stage: AI_DECISION_STAGE.OPENING_FREE_PLAY,
      sanctuaryActive: true,
      allows: null,
    };
  }
  return {
    stage: AI_DECISION_STAGE.OPENING_SANCTUARY,
    sanctuaryActive: true,
    allows: (_type, row, col) => ring.has(`${row}:${col}`),
  };
}

function recentOwnSpecialDeploymentStreak(state, player) {
  const history = state.informationHistory?.[player];
  if (!Array.isArray(history)) return 0;
  let streak = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const transition = history[index];
    const action = transition?.actor === player ? transition.ownAction : null;
    if (action?.type !== "deploy") continue;
    if (!SPECIAL_UNIT_TYPES.has(action.unitType)) break;
    streak += 1;
  }
  return streak;
}

function activeSpecialAtariLiberties(state, player) {
  const liberties = new Set();
  const visited = new Set();
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const key = `${row}:${col}`;
      const piece = state.board[row][col];
      if (piece?.owner !== player || visited.has(key)) continue;
      const group = collectGroup(state, row, col);
      group.forEach(([groupRow, groupCol]) => visited.add(`${groupRow}:${groupCol}`));
      const pieces = group.map(([groupRow, groupCol]) => state.board[groupRow][groupCol]);
      if (pieces.some((groupPiece) => groupPiece.type === "king")) continue;
      if (!pieces.some((groupPiece) =>
        SPECIAL_UNIT_TYPES.has(groupPiece.type) && !groupPiece.abilityUsed)) continue;
      const groupLiberties = new Set();
      for (const [groupRow, groupCol] of group) {
        for (const [nextRow, nextCol] of orthogonalPositions(groupRow, groupCol)) {
          if (nextRow < 0 || nextRow >= SIZE || nextCol < 0 || nextCol >= SIZE) continue;
          if (!state.board[nextRow][nextCol]) groupLiberties.add(`${nextRow}:${nextCol}`);
        }
      }
      if (groupLiberties.size === 1) liberties.add([...groupLiberties][0]);
    }
  }
  return liberties;
}

/** Empty cells created by the player's latest special activation, before another own deploy. */
export function recentOwnSpecialActivationVacancies(state, player) {
  const history = state.informationHistory?.[player];
  if (!Array.isArray(history)) return new Set();
  const laterWizardMoves = [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const transition = history[index];
    if (transition?.actor === player && transition.ownAction?.type === "deploy") return new Set();
    const events = Array.isArray(transition?.events) ? transition.events : [];
    for (const event of events) {
      if (event.type === "wizard_moved" && event.owner === player
        && Number.isInteger(event.fromRow) && Number.isInteger(event.fromCol)) {
        laterWizardMoves.push(event);
      }
    }
    const activation = events.find((event) =>
      event.type === "special_activated" && event.owner === player);
    if (!activation) continue;

    const vacancies = new Set();
    const removalReason = activation.unitType === "general"
      ? "general_reaction"
      : activation.unitType === "wizard" ? "wizard_reaction" : null;
    if (removalReason) {
      for (const event of events) {
        if (event.type === "piece_removed" && event.captor === player
          && event.reason === removalReason
          && Number.isInteger(event.row) && Number.isInteger(event.col)) {
          vacancies.add(`${event.row}:${event.col}`);
        }
      }
    }
    if (activation.unitType === "wizard") {
      for (const event of laterWizardMoves) {
        if (!activation.pieceId || !event.pieceId || event.pieceId === activation.pieceId) {
          vacancies.add(`${event.fromRow}:${event.fromCol}`);
        }
      }
    }
    return new Set([...vacancies].filter((key) => {
      const [row, col] = key.split(":").map(Number);
      return !state.board[row]?.[col];
    }));
  }
  return new Set();
}

/**
 * Tier identity for special deployment, below verified wins and King rescue but above scoring.
 * Deployment numbers are the player's own turns: the first rules-legal special is number six.
 */
export function specialDeploymentContract(state, player, settings) {
  const policy = settings.specialDeploymentPolicy || null;
  const ownDeployments = state.deploymentCount?.[player] ?? 0;
  const ownDeploymentNumber = ownDeployments + 1;
  const remainingSpecials = [...SPECIAL_UNIT_TYPES]
    .reduce((total, type) => total + Math.max(0, state.stock?.[player]?.[type] || 0), 0);
  const specialsDeployed = Math.max(0, SPECIAL_UNIT_TYPES.size - remainingSpecials);
  const firstSpecialPending = specialsDeployed === 0 && remainingSpecials > 0;
  const reactiveReplantCells = policy?.reactiveReplantAfterActivation
    && specialsDeployed === 2 && remainingSpecials === 1
    ? recentOwnSpecialActivationVacancies(state, player)
    : new Set();
  return {
    policy,
    ownDeploymentNumber,
    remainingSpecials,
    specialsDeployed,
    firstSpecialPending,
    consecutiveSpecials: recentOwnSpecialDeploymentStreak(state, player),
    atariSpecialLiberties: activeSpecialAtariLiberties(state, player),
    reactiveReplantCells,
  };
}

function applySpecialDeploymentContract(state, candidates, player, settings, recordDecision) {
  const contract = specialDeploymentContract(state, player, settings);
  const policy = contract.policy;
  if (!policy || !candidates.length) return candidates;

  const isSpecial = (candidate) => SPECIAL_UNIT_TYPES.has(candidate.type);
  const atari = contract.atariSpecialLiberties;
  for (const candidate of candidates) {
    candidate.reactiveSpecialReplant = isSpecial(candidate)
      && contract.reactiveReplantCells.has(`${candidate.row}:${candidate.col}`);
  }
  let allowed = candidates;
  let reasonFor = () => "special_contract_available";

  if (atari.size && policy.rescueAtariSpecial) {
    allowed = candidates.filter((candidate) =>
      candidate.type === "soldier" && atari.has(`${candidate.row}:${candidate.col}`));
    reasonFor = (candidate) => allowed.includes(candidate)
      ? "lower_tier_special_group_rescue"
      : "special_group_rescue_selected";
  } else {
    allowed = candidates.filter((candidate) => {
      if (atari.size && !policy.rescueAtariSpecial
        && atari.has(`${candidate.row}:${candidate.col}`)) return false;
      if (!isSpecial(candidate)) return true;
      if (contract.firstSpecialPending
        && contract.ownDeploymentNumber < policy.earliestFirstDeployment) return false;
      if (contract.consecutiveSpecials >= policy.maxConsecutive) return false;
      return true;
    });
    reasonFor = (candidate) => {
      if (atari.size && !policy.rescueAtariSpecial
        && atari.has(`${candidate.row}:${candidate.col}`)) return "high_tier_special_group_sacrifice";
      if (isSpecial(candidate) && contract.firstSpecialPending
        && contract.ownDeploymentNumber < policy.earliestFirstDeployment) {
        return "before_tier_special_window";
      }
      if (isSpecial(candidate) && contract.consecutiveSpecials >= policy.maxConsecutive) {
        return "special_consecutive_limit";
      }
      if (candidate.reactiveSpecialReplant) return "grandmaster_reactive_special_replant";
      return "special_contract_available";
    };

    const deadline = policy.firstDeploymentDeadline;
    if (contract.firstSpecialPending && deadline
      && contract.ownDeploymentNumber >= deadline) {
      const dueSpecials = allowed.filter(isSpecial);
      if (dueSpecials.length) {
        allowed = dueSpecials;
        reasonFor = (candidate) => allowed.includes(candidate)
          ? "first_special_deadline"
          : "first_special_due";
      }
    }
  }

  // A malformed fixture or exhausted board must not turn a legal AI position into no move.
  if (!allowed.length) allowed = candidates;
  const allowedKeys = new Set(allowed.map(candidateActionKey));
  for (const candidate of candidates) {
    const kept = allowedKeys.has(candidateActionKey(candidate));
    recordDecision(
      candidate,
      "special_contract",
      kept ? "kept" : "stopped",
      reasonFor(candidate),
    );
  }
  return allowed;
}

function chooseVerifiedImmediateWin({
  candidates,
  settings,
  publicState,
  aiPlayer,
  humanPlayer,
  neighbors,
  criticalWorldsFor,
}) {
  if (!settings.instantKillCheck && settings.searchDepth < 2) return null;
  for (const candidate of candidates) {
    const quickAction = {
      type: "deploy",
      unitType: candidate.type,
      row: candidate.row,
      col: candidate.col,
    };
    const publicResult = simulateEngineTransition(publicState, aiPlayer, quickAction, neighbors);
    if (publicResult?.winner !== aiPlayer) continue;

    const criticalWorlds = criticalWorldsFor(candidate);
    const failingWorlds = criticalWorlds.filter((hypothesis) => {
      const simulated = simulateEngineTransition(hypothesis.state, aiPlayer, quickAction, neighbors);
      return simulated?.winner !== aiPlayer;
    });
    // `instantWinRiskTolerance` is the share of the hidden pool a tier will bet against. Left
    // unset the odds must be a flat 1, which is the old "wins in every hypothesised world"
    // rule exactly — any failing world drops the odds below 1 and the win is passed over.
    const requiredOdds = 1 - Math.max(0, Math.min(
      1,
      Number(settings.instantWinRiskTolerance || 0),
    ));
    const survivalOdds = failingWorlds.length
      ? instantWinSurvivalOdds(publicState, humanPlayer, failingWorlds)
      : 1;
    if (survivalOdds >= requiredOdds) return candidate;
  }
  return null;
}

function prioritizeKingCrisisRescues(
  state,
  candidates,
  aiPlayer,
  neighbors,
) {
  const ownKingLibs = kingLibertyCount(state, aiPlayer);
  if (ownKingLibs !== 1) return ownKingLibs;
  for (const candidate of candidates) {
    const quickAction = {
      type: "deploy",
      unitType: candidate.type,
      row: candidate.row,
      col: candidate.col,
    };
    const simulated = simulateEngineTransition(state, aiPlayer, quickAction, neighbors);
    if (simulated && kingLibertyCount(simulated, aiPlayer) > 1) candidate.score += 5000;
  }
  candidates.sort((a, b) => compareCandidates(a, b, aiPlayer));
  return ownKingLibs;
}

export function findAiDeployMove(state, {
  aiPlayer,
  humanPlayer,
  canDeploy,
  countPieces,
  neighbors,
  collectDecisionDiagnostics = false,
}) {
  const settings = difficultySettings(state);
  const types = availableDeployTypes(state, aiPlayer, countPieces, humanPlayer);
  const publicState = stateForPlayer(state, aiPlayer);
  const openingContract = openingDecisionContract(state, aiPlayer, settings);
  const catalogContext = createAiCatalogContext(
    state,
    aiPlayer,
    humanPlayer,
    openingContract.stage,
  );
  const decisionRecords = new Map();
  const recordDecision = (candidate, stage, outcome, reason) => {
    const key = candidateActionKey(candidate);
    let record = decisionRecords.get(key);
    if (!record) {
      record = {
        action: { unitType: candidate.type, row: candidate.row, col: candidate.col },
        catalog: candidate.decisionCatalog || classifyAiCandidate(catalogContext, candidate),
        path: [],
        scores: {},
      };
      decisionRecords.set(key, record);
    }
    candidate.decisionCatalog = record.catalog;
    candidate.decisionPath = record.path;
    record.path.push({ stage, outcome, reason });
    if (Number.isFinite(candidate.score)) record.scores.static = candidate.score;
    if (Number.isFinite(candidate.deepScore)) record.scores.search = candidate.deepScore;
    return candidate;
  };
  const finishDecision = (candidate, reason) => {
    recordDecision(candidate, "selection", "selected", reason);
    candidate.decisionStage = openingContract.stage;
    if (collectDecisionDiagnostics) {
      candidate.decisionDiagnostics = {
        decisionStage: openingContract.stage,
        candidates: [...decisionRecords.values()].map((record) => structuredClone(record)),
      };
    }
    return candidate;
  };
  const collectCandidates = (allows) => {
    const collected = [];
    for (const type of types) {
      for (let row = 0; row < SIZE; row += 1) {
        for (let col = 0; col < SIZE; col += 1) {
          if (!canDeploy(aiPlayer, type, row, col)) continue;
          if (allows && !allows(type, row, col)) continue;
          if (isPointlessSuicide(publicState, aiPlayer, type, row, col, neighbors)) continue;
          const candidate = {
            row,
            col,
            type,
            score: scoreCell(state, row, col, neighbors, aiPlayer, humanPlayer, true)
              + scoreDeployType(state, type, row, col, neighbors, aiPlayer, humanPlayer)
              + (settings.variance > 0 ? Math.random() * positionVariance(state) : 0),
          };
          collected.push(recordDecision(
            candidate,
            "candidate_collection",
            "kept",
            openingContract.allows ? openingContract.stage : "general_legal_candidate",
          ));
        }
      }
    }
    return collected;
  };
  // The doctrine narrows the choice; it must never empty it. If nothing legal is left inside the
  // band, the tier plays on as it would without one.
  let candidates = openingContract?.allows ? collectCandidates(openingContract.allows) : [];
  if (!candidates.length) candidates = collectCandidates(null);
  candidates.sort((a, b) => compareCandidates(a, b, aiPlayer));
  if (!candidates.length) return null;
  const criticalWorldCache = new Map();
  const criticalWorldsFor = (candidate) => {
    const key = `${candidate.type}:${candidate.row}:${candidate.col}`;
    if (!criticalWorldCache.has(key)) {
      criticalWorldCache.set(
        key,
        createCriticalBeliefWorlds(publicState, aiPlayer, humanPlayer, candidate, settings),
      );
    }
    return criticalWorldCache.get(key);
  };

  // Opening constraints already narrowed `candidates`, so they remain above terminal checks.
  const immediateWin = chooseVerifiedImmediateWin({
    candidates,
    settings,
    publicState,
    aiPlayer,
    humanPlayer,
    neighbors,
    criticalWorldsFor,
  });
  if (immediateWin) {
    for (const candidate of candidates) {
      recordDecision(
        candidate,
        "terminal_priority",
        candidate === immediateWin ? "kept" : "stopped",
        candidate === immediateWin ? "verified_immediate_win" : "verified_win_selected_first",
      );
    }
    return finishDecision(immediateWin, "verified_immediate_win");
  }

  // King rescue is the last rule-level priority before catalog scoring and search take over.
  const ownKingLibs = prioritizeKingCrisisRescues(state, candidates, aiPlayer, neighbors);
  const contractCandidates = ownKingLibs === 1
    ? candidates
    : applySpecialDeploymentContract(state, candidates, aiPlayer, settings, recordDecision);

  const limit = settings.searchDepth > 1
    ? (settings.rootCandidateLimit || 20)
    : contractCandidates.length;
  const searchedCandidates = ownKingLibs === 1
    ? contractCandidates.slice(0, limit)
    : prioritizeMidgameCandidates(state, contractCandidates, aiPlayer, humanPlayer, settings, limit);
  const searchedByKey = new Map(searchedCandidates.map(
    (candidate) => [candidateActionKey(candidate), candidate],
  ));
  for (const candidate of contractCandidates) {
    const searched = searchedByKey.get(candidateActionKey(candidate));
    const kept = Boolean(searched);
    const tacticalReason = candidate.searchPoolDiagnostic?.reason
      || searched?.searchPoolDiagnostic?.reason
      || (ownKingLibs === 1 ? "king_crisis_root_limit" : "unclassified_search_limit");
    recordDecision(candidate, "search_pool", kept ? "kept" : "stopped", tacticalReason);
  }
  let bestScore = -Infinity;

  for (const [candidateIndex, candidate] of searchedCandidates.entries()) {
    const useLocalFourthPly = settings.localSearchDepth >= 4
      && candidateIndex < (settings.localFourPlyCandidateLimit || 0)
      && isLocalStrategicCandidate(state, candidate, aiPlayer, humanPlayer);
    const candidateSettings = useLocalFourthPly
      ? {
        ...settings,
        searchDepth: 4,
        replyCandidateLimit: Math.min(settings.replyCandidateLimit || 8, 10),
        continuationCandidateLimit: Math.min(settings.continuationCandidateLimit || 6, 6),
        ply4CandidateLimit: Math.min(settings.ply4CandidateLimit || 3, 3),
      }
      : settings;
    const deepScore = scoreWithLookahead(
      state,
      candidate,
      candidateSettings,
      aiPlayer,
      humanPlayer,
      neighbors,
      bestScore,
      publicState,
    );
    candidate.deepScore = deepScore + conversionThreat(candidate);
    candidate.publicDeepScore = candidate.deepScore;
    candidate.searchDepthUsed = candidateSettings.searchDepth;
    recordDecision(
      candidate,
      "lookahead",
      "kept",
      candidateSettings.searchDepth >= 4 ? "local_four_ply" : `depth_${candidateSettings.searchDepth}`,
    );
    // `bestScore` is the search window the remaining candidates prune against, so it stays on the
    // score the search actually returned.
    if (deepScore > bestScore) bestScore = deepScore;
  }

  searchedCandidates.sort((a, b) => compareCandidates(a, b, aiPlayer));
  const riskCandidates = searchedCandidates.slice(0, settings.riskCandidateLimit || 0);
  if (riskCandidates.length) {
    const riskKeys = new Set(riskCandidates.map(candidateActionKey));
    for (const candidate of searchedCandidates) {
      recordDecision(
        candidate,
        "risk_pool",
        riskKeys.has(candidateActionKey(candidate)) ? "kept" : "stopped",
        riskKeys.has(candidateActionKey(candidate)) ? "within_risk_candidate_limit" : "outside_risk_candidate_limit",
      );
    }
  }
  const riskByCandidate = new Map();
  const applyRiskToCandidate = (candidate) => {
    const criticalWorlds = criticalWorldsFor(candidate)
      .slice(0, settings.criticalBeliefWorldLimit || 0);
    const risk = evaluateCriticalBeliefRisk(
      publicState,
      criticalWorlds,
      candidate,
      settings,
      aiPlayer,
      humanPlayer,
      neighbors,
    );
    candidate.riskEvaluated = true;
    if (!risk) {
      recordDecision(candidate, "hidden_special_risk", "kept", "no_critical_hypothesis");
      return;
    }
    riskByCandidate.set(candidate, risk);
    candidate.riskAdjustment = risk.adjustment;
    candidate.specialRiskProbability = risk.specialProbability;
    candidate.specialHypothesisCount = risk.hypothesisCount;
    candidate.kingMineHypothesis = risk.kingMineHypothesis;
    candidate.deepScore = risk.fatal && settings.hiddenKingRiskVeto
      ? -100000
      : candidate.deepScore + risk.adjustment;
    recordDecision(
      candidate,
      "hidden_special_risk",
      risk.fatal && settings.hiddenKingRiskVeto ? "vetoed" : "kept",
      risk.fatal && settings.hiddenKingRiskVeto ? "fatal_hidden_king_world" : "probability_adjusted",
    );
  };
  for (const candidate of riskCandidates) {
    applyRiskToCandidate(candidate);
  }

  // A veto needs somewhere to go. `prioritizeMidgameCandidates` commits to a single tactical
  // class before any risk is known — special attacks, forced liberties, then captures — and
  // returns only that class, so the one fatal move can be the entire pool. Vetoing it then
  // changes nothing. Measured on a wall-anchored King with a hidden mine beside it: the capture
  // that detonates the mine was the sole survivor of the policy, scored -100000 by the veto,
  // and played regardless for all three special identities.
  const isVetoed = (candidate) => candidate.deepScore <= -100000;
  if (riskCandidates.length && riskCandidates.every(isVetoed)) {
    const searchedKeys = new Set(searchedCandidates.map(
      (candidate) => `${candidate.type}:${candidate.row}:${candidate.col}`,
    ));
    const reserves = contractCandidates
      .filter((candidate) => !searchedKeys.has(`${candidate.type}:${candidate.row}:${candidate.col}`))
      .slice(0, Math.max(1, settings.riskCandidateLimit || 4));
    for (const reserve of reserves) {
      reserve.deepScore = reserve.score;
      recordDecision(reserve, "risk_reserve", "kept", "all_primary_risk_candidates_vetoed");
      applyRiskToCandidate(reserve);
    }
    const survivors = reserves.filter((candidate) => !isVetoed(candidate));
    if (survivors.length) {
      searchedCandidates.push(...survivors);
      riskCandidates.push(...survivors);
    }
  }

  const selectionPool = riskCandidates.length ? riskCandidates : searchedCandidates;
  selectionPool.sort((a, b) => compareCandidates(a, b, aiPlayer));
  const deepRiskCandidates = selectionPool
    .filter((candidate) => riskByCandidate.get(candidate)?.worstWorld && candidate.deepScore > -100000)
    .slice(0, settings.deepRiskCandidateLimit || 0);
  for (const candidate of deepRiskCandidates) {
    recordDecision(candidate, "deep_risk_pool", "kept", "worst_hidden_world_available");
  }
  const boundedRiskSettings = {
    ...settings,
    searchDepth: Math.min(settings.searchDepth, 2),
    replyCandidateLimit: Math.min(settings.replyCandidateLimit || 8, 8),
    tacticalExtension: false,
  };
  for (const candidate of deepRiskCandidates) {
    const worstDeepScore = scoreWithLookahead(
      state,
      candidate,
      boundedRiskSettings,
      aiPlayer,
      humanPlayer,
      neighbors,
      -Infinity,
      riskByCandidate.get(candidate).worstWorld,
    );
    const weight = settings.deepRiskWeight || 0;
    candidate.worstBeliefDeepScore = worstDeepScore;
    // The conversion holds in the pessimistic world as well: a belief world changes what a stone
    // is, never where the King's group can breathe. So the same term stands in both scores and
    // the blend has nothing to average away — otherwise the fact is halved for being examined.
    candidate.deepScore = candidate.deepScore * (1 - weight)
      + (worstDeepScore + conversionThreat(candidate)) * weight;
    recordDecision(candidate, "deep_risk_lookahead", "kept", `weight_${weight}`);
  }
  selectionPool.sort((a, b) => compareCandidates(a, b, aiPlayer));
  const selected = selectionPool[0] || null;
  if (selected && settings.strategicContext) {
    selected.gamePhase = gamePhase(state);
    selected.kingTacticalPriority = settings.kingTacticalPriority;
    selected.recentSpecialProbability = settings.recentSpecialProbability;
    selected.wallTactics = gamePhase(state) === "opening"
      ? null
      : wallTacticalValue(state, selected.row, selected.col, aiPlayer, humanPlayer);
    if (settings.kingMineStrategy) {
      selected.kingMineDefusal = kingMineDefusalValue(
        state,
        selected.row,
        selected.col,
        aiPlayer,
        humanPlayer,
      );
      selected.kingWallConnection = kingWallConnectionValue(state, selected.row, selected.col, aiPlayer);
    }
  }
  return selected ? finishDecision(selected, "highest_surviving_search_score") : null;
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
  candidates.sort((a, b) => b.score - a.score || compareCandidates(a, b, aiPlayer));
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
      const homeBoardSafety = (aiPlayer === "black" ? SIZE - 1 - row : row) * 2;
      candidates.push({
        row,
        col,
        score: fortressSafety + homeBoardSafety + adjacentAllies * 3 - adjacentEnemies * 8 + (escapeType === "escape" ? 4 : 0),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || compareCandidates(a, b, aiPlayer));
  return candidates[0] || null;
}
