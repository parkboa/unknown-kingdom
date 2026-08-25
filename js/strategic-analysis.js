import {
  SIZE,
  boardSignature,
  collectGroup,
  findKingPosition,
  orthogonalPositions,
  wallOwnerForEdge,
} from "../packages/game-engine/src/index.js";

export const RECENT_SPECIAL_PROBABILITY = 0.8;
export const KING_ADJACENT_SPECIAL_PROBABILITY = 1;
export const KING_TACTIC_PRIORITY = 0.9;
export const OPENING_DEPLOYMENT_LIMIT = 20;
export const MIDDLE_DEPLOYMENT_LIMIT = 40;
export const SPECIAL_ASSAULT_TARGET_LIMIT = 15;
export const KING_ASSAULT_CUTOFF = 20;

const inBounds = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;
const positionKey = (row, col) => `${row}:${col}`;
const wallDistanceCache = new WeakMap();

export function gamePhase(state) {
  const red = state.deploymentCount?.red ?? (state.firstDeployDone?.red ? 1 : 0);
  const blue = state.deploymentCount?.blue ?? (state.firstDeployDone?.blue ? 1 : 0);
  const completedRounds = Math.min(red, blue);
  if (completedRounds <= OPENING_DEPLOYMENT_LIMIT) return "opening";
  if (completedRounds <= MIDDLE_DEPLOYMENT_LIMIT) return "middle";
  return "endgame";
}

export function phaseStrategicMultiplier(state) {
  const phase = gamePhase(state);
  if (phase === "opening") return 0.5;
  if (phase === "middle") return 1;
  return 1.4;
}

export function recentOpponentDeployments(state, perspective, limit = 4) {
  const result = [];
  const seen = new Set();
  const history = state.informationHistory?.[perspective];
  if (Array.isArray(history)) {
    for (let index = history.length - 1; index >= 0 && result.length < limit; index -= 1) {
      const transition = history[index];
      if (!transition || transition.actor === perspective) continue;
      const event = transition.events?.find(({ type }) => type === "piece_deployed");
      if (!event || !Number.isInteger(event.row) || !Number.isInteger(event.col)) continue;
      const key = positionKey(event.row, event.col);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ row: event.row, col: event.col, player: transition.actor });
    }
  }

  const lastMove = state.lastMove;
  if (
    result.length < limit
    && lastMove?.player
    && lastMove.player !== perspective
    && Number.isInteger(lastMove.row)
    && Number.isInteger(lastMove.col)
  ) {
    const key = positionKey(lastMove.row, lastMove.col);
    if (!seen.has(key)) result.unshift({ row: lastMove.row, col: lastMove.col, player: lastMove.player });
  }
  return result.slice(0, limit);
}

function wallDistancesThroughEmptyCells(state, startRow, startCol) {
  if (!inBounds(startRow, startCol) || state.board[startRow][startCol]) {
    return { red: Infinity, blue: Infinity, neutral: Infinity };
  }
  const signature = boardSignature(state);
  let cached = wallDistanceCache.get(state);
  if (!cached || cached.signature !== signature) {
    cached = { signature, values: new Map() };
    wallDistanceCache.set(state, cached);
  }
  const startKey = positionKey(startRow, startCol);
  if (cached.values.has(startKey)) return cached.values.get(startKey);
  const distances = { red: Infinity, blue: Infinity, neutral: Infinity };
  const queue = [[startRow, startCol, 0]];
  const visited = new Set();

  while (queue.length) {
    const [row, col, distance] = queue.shift();
    const key = positionKey(row, col);
    if (visited.has(key)) continue;
    visited.add(key);

    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (!inBounds(nextRow, nextCol)) {
        const owner = wallOwnerForEdge(row, nextRow, nextCol);
        const label = owner || "neutral";
        distances[label] = Math.min(distances[label], distance + 1);
      } else if (!state.board[nextRow][nextCol] && !visited.has(positionKey(nextRow, nextCol))) {
        queue.push([nextRow, nextCol, distance + 1]);
      }
    }
  }
  cached.values.set(startKey, distances);
  return distances;
}

export function classifyLibertyDirection(state, row, col, groupOwner, opposingOwner) {
  const distances = wallDistancesThroughEmptyCells(state, row, col);
  const ownerDistance = distances[groupOwner];
  const opposingDistance = distances[opposingOwner];
  if (ownerDistance < opposingDistance && ownerDistance <= distances.neutral) return "owner_wall";
  if (opposingDistance < ownerDistance && opposingDistance <= distances.neutral) return "opposing_wall";
  return "other";
}

function groupLiberties(state, group) {
  const liberties = new Map();
  for (const [row, col] of group) {
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (!inBounds(nextRow, nextCol) || state.board[nextRow][nextCol]) continue;
      liberties.set(positionKey(nextRow, nextCol), { row: nextRow, col: nextCol });
    }
  }
  return [...liberties.values()];
}

const ATTACK_SPECIALS = new Set(["general", "wizard", "diplomat"]);

function groupTouchesOwnWall(state, group, owner) {
  return group.some(([row, col]) => orthogonalPositions(row, col).some(([nextRow, nextCol]) =>
    !inBounds(nextRow, nextCol) && wallOwnerForEdge(row, nextRow, nextCol) === owner));
}

/**
 * Stones of the group that rest against a wall the opponent can never fill — the group's own
 * wall or a neutral one.
 *
 * `groupTouchesOwnWall` ignores neutral edges, but `groupHasLiberty` treats them as liberties
 * just like an own wall, so a safety measure has to follow the capture rule rather than that
 * helper.
 */
function countWallAnchors(state, group, owner) {
  return group.filter(([row, col]) => orthogonalPositions(row, col).some(([nextRow, nextCol]) => {
    if (inBounds(nextRow, nextCol)) return false;
    const wallOwner = wallOwnerForEdge(row, nextRow, nextCol);
    return wallOwner === owner || wallOwner === null;
  })).length;
}

/**
 * How far the King is from being captured by ordinary soldier play.
 *
 * `kingLibertyCount` adds board liberties and wall liberties into a single number, which ranks
 * a King sealed against its own wall (one liberty, and no soldier can ever take it) below a
 * King standing in the open with three empty neighbours (three liberties, dead in three
 * moves). Separating the two restores the ordering the rules actually imply.
 *
 * A wall anchor is permanent under soldier play: the opponent cannot occupy a wall edge, so no
 * sequence of ordinary deployments removes that liberty. Only a special can break the anchor,
 * by converting or removing the stone that holds it — modelled in Stage 2, deliberately absent
 * here so this stays a pure Go-style measure.
 *
 * `soldierCaptureDistance` is `Infinity` for an anchored group, otherwise the number of empty
 * liberties the opponent must fill. A missing King yields 0, matching the "already lost"
 * reading the evaluation gives a captured King.
 */
export function kingSafetyProfile(state, owner) {
  const king = findKingPosition(state, owner);
  if (!king) return { wallAnchors: 0, boardLiberties: 0, soldierCaptureDistance: 0 };
  const group = collectGroup(state, king.row, king.col);
  const wallAnchors = countWallAnchors(state, group, owner);
  const boardLiberties = groupLiberties(state, group).length;
  return {
    wallAnchors,
    boardLiberties,
    soldierCaptureDistance: wallAnchors > 0 ? Infinity : boardLiberties,
  };
}

function groupsForOwner(state, owner) {
  const groups = [];
  const visited = new Set();
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (state.board[row][col]?.owner !== owner || visited.has(positionKey(row, col))) continue;
      const group = collectGroup(state, row, col);
      group.forEach(([groupRow, groupCol]) => visited.add(positionKey(groupRow, groupCol)));
      groups.push(group);
    }
  }
  return groups;
}

function minimumGroupDistance(first, second) {
  let distance = Infinity;
  for (const [firstRow, firstCol] of first) {
    for (const [secondRow, secondCol] of second) {
      distance = Math.min(distance, Math.abs(firstRow - secondRow) + Math.abs(firstCol - secondCol));
    }
  }
  return distance;
}

function isHomeHalf(row, player) {
  return player === "red" ? row <= Math.floor(SIZE / 2) : row >= Math.floor(SIZE / 2);
}

/**
 * Builds the cheap, board-local contract used to shrink Grandmaster's midgame tree.
 * The returned coordinate sets deliberately contain only public board positions so callers can apply
 * the same policy to root and reply candidates without leaking hidden identities.
 */
export function buildMidgameTacticalPolicy(state, player, enemy) {
  const ownDeployments = state.deploymentCount?.[player] ?? (state.firstDeployDone?.[player] ? 1 : 0);
  const remainingSpecials = ["general", "wizard", "diplomat"]
    .reduce((total, type) => total + Math.max(0, state.stock?.[player]?.[type] || 0), 0);
  const kingAssault = ownDeployments >= 5 && ownDeployments <= KING_ASSAULT_CUTOFF && remainingSpecials > 0;
  const territoryFocus = ownDeployments > KING_ASSAULT_CUTOFF
    || (ownDeployments > SPECIAL_ASSAULT_TARGET_LIMIT && remainingSpecials === 0);
  const active = kingAssault || territoryFocus;
  const forcedSoldierLiberties = new Set();
  const captureCells = new Set();
  const homeSealCells = new Set();
  const wallBridgeCells = new Set();
  if (!active) {
    return {
      active,
      ownDeployments,
      remainingSpecials,
      kingAssault,
      territoryFocus,
      forcedSoldierLiberties,
      captureCells,
      homeSealCells,
      wallBridgeCells,
      enemyKing: null,
    };
  }

  const ownGroups = groupsForOwner(state, player);
  for (const group of ownGroups) {
    if (groupTouchesOwnWall(state, group, player)) continue;
    const pieces = group.map(([row, col]) => state.board[row][col]);
    const containsAttackSpecial = pieces.some((piece) => ATTACK_SPECIALS.has(piece.originalType || piece.type));
    const containsKing = pieces.some((piece) => piece.type === "king");
    const liberties = groupLiberties(state, group);
    if (!containsAttackSpecial && !containsKing && liberties.length === 1) {
      forcedSoldierLiberties.add(positionKey(liberties[0].row, liberties[0].col));
    }
  }

  const enemyGroups = groupsForOwner(state, enemy);
  for (const group of enemyGroups) {
    const liberties = groupLiberties(state, group);
    if (liberties.length === 1 && !groupTouchesOwnWall(state, group, enemy)) {
      captureCells.add(positionKey(liberties[0].row, liberties[0].col));
    }
    for (const liberty of liberties) {
      if (isHomeHalf(liberty.row, player)) homeSealCells.add(positionKey(liberty.row, liberty.col));
    }
  }

  const wallGroups = ownGroups.filter((group) => groupTouchesOwnWall(state, group, player));
  const detachedGroups = ownGroups.filter((group) => !groupTouchesOwnWall(state, group, player));
  for (const wallGroup of wallGroups) {
    for (const detachedGroup of detachedGroups) {
      const beforeDistance = minimumGroupDistance(wallGroup, detachedGroup);
      for (const [row, col] of wallGroup) {
        for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
          if (!inBounds(nextRow, nextCol) || state.board[nextRow][nextCol]) continue;
          const afterDistance = minimumGroupDistance([[nextRow, nextCol]], detachedGroup);
          if (afterDistance < beforeDistance) wallBridgeCells.add(positionKey(nextRow, nextCol));
        }
      }
    }
  }

  let enemyKing = null;
  for (const group of enemyGroups) {
    const kingPosition = group.find(([row, col]) => state.board[row][col]?.type === "king");
    if (kingPosition) {
      enemyKing = { row: kingPosition[0], col: kingPosition[1] };
      break;
    }
  }
  return {
    active,
    ownDeployments,
    remainingSpecials,
    kingAssault,
    territoryFocus,
    forcedSoldierLiberties,
    captureCells,
    homeSealCells,
    wallBridgeCells,
    enemyKing,
  };
}

export function classifyMidgameCandidate(policy, candidate) {
  const key = positionKey(candidate.row, candidate.col);
  const special = ATTACK_SPECIALS.has(candidate.type);
  const kingDistance = policy.enemyKing
    ? Math.abs(candidate.row - policy.enemyKing.row) + Math.abs(candidate.col - policy.enemyKing.col)
    : Infinity;
  const specialAttack = policy.kingAssault && special && kingDistance <= 3;
  const specialOrder = candidate.type === "general" ? 3
    : candidate.type === "wizard" ? 2
      : candidate.type === "diplomat" ? 1 : 0;
  return {
    forcedSoldierLiberty: candidate.type === "soldier" && policy.forcedSoldierLiberties.has(key),
    specialAttack,
    specialOrder,
    kingDistance,
    capture: policy.captureCells.has(key),
    homeSeal: policy.homeSealCells.has(key),
    wallBridge: policy.wallBridgeCells.has(key),
  };
}

export function observedRemainingSpecialTypes(state, perspective, enemy) {
  if ((state.stats?.specialsUsed?.[enemy] || 0) >= 3) return [];
  const unavailable = new Set();
  for (const piece of state.board.flat()) {
    if (!piece || piece.owner !== enemy || !piece.revealed) continue;
    const knownType = piece.originalType || piece.type;
    if (["general", "wizard", "diplomat"].includes(knownType)) unavailable.add(knownType);
  }
  for (const transition of state.informationHistory?.[perspective] || []) {
    for (const event of transition.events || []) {
      if (
        event.owner === enemy
        && (event.type === "special_revealed" || event.type === "special_activated")
        && ["general", "wizard", "diplomat"].includes(event.unitType)
      ) unavailable.add(event.unitType);
    }
  }
  return ["general", "wizard", "diplomat"].filter((type) => !unavailable.has(type));
}

export function kingAdjacentMinePositions(state, player, enemy) {
  if (!observedRemainingSpecialTypes(state, player, enemy).length) return [];
  let king = null;
  for (let row = 0; row < SIZE && !king; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state.board[row][col];
      if (piece?.owner === player && piece.type === "king") {
        king = { row, col };
        break;
      }
    }
  }
  if (!king) return [];
  return orthogonalPositions(king.row, king.col)
    .filter(([row, col]) => inBounds(row, col))
    .filter(([row, col]) => {
      const piece = state.board[row][col];
      return piece?.owner === enemy && !piece.revealed && piece.type !== "king";
    })
    .map(([row, col]) => ({ row, col }));
}

function shortestConnectionToOtherGroup(state, sourceGroup, owner, blockedPosition = null) {
  const source = new Set(sourceGroup.map(([row, col]) => positionKey(row, col)));
  const queue = sourceGroup.map(([row, col]) => [row, col, 0]);
  const visited = new Set();
  while (queue.length) {
    const [row, col, distance] = queue.shift();
    const key = positionKey(row, col);
    if (visited.has(key)) continue;
    visited.add(key);
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (!inBounds(nextRow, nextCol)) continue;
      if (blockedPosition?.row === nextRow && blockedPosition?.col === nextCol) continue;
      const nextKey = positionKey(nextRow, nextCol);
      if (source.has(nextKey)) continue;
      const piece = state.board[nextRow][nextCol];
      if (piece?.owner === owner) return distance;
      if (!piece && !visited.has(nextKey)) queue.push([nextRow, nextCol, distance + 1]);
    }
  }
  return Infinity;
}

function minimumEmptyPlacementsToOwnWall(state, player, conceptualStone = null) {
  let king = null;
  for (let row = 0; row < SIZE && !king; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (state.board[row][col]?.owner === player && state.board[row][col]?.type === "king") {
        king = { row, col };
        break;
      }
    }
  }
  if (!king) return Infinity;
  const group = collectGroup(state, king.row, king.col);
  const costs = new Map(group.map(([row, col]) => [positionKey(row, col), 0]));
  const queue = group.map(([row, col]) => [row, col, 0]);
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [row, col, cost] = queue.shift();
    if (cost !== costs.get(positionKey(row, col))) continue;
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (!inBounds(nextRow, nextCol)) {
        if (wallOwnerForEdge(row, nextRow, nextCol) === player) return cost;
        continue;
      }
      const piece = state.board[nextRow][nextCol];
      const conceptual = conceptualStone?.row === nextRow && conceptualStone?.col === nextCol;
      if (piece && piece.owner !== player) continue;
      const nextCost = cost + (!piece && !conceptual ? 1 : 0);
      const key = positionKey(nextRow, nextCol);
      if (nextCost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, nextCost);
      queue.push([nextRow, nextCol, nextCost]);
    }
  }
  return Infinity;
}

export function kingWallConnectionValue(state, row, col, player) {
  if (!inBounds(row, col) || state.board[row][col]) {
    return { value: 0, beforeDistance: Infinity, afterDistance: Infinity, connectsNow: false };
  }
  const beforeDistance = minimumEmptyPlacementsToOwnWall(state, player);
  const afterDistance = minimumEmptyPlacementsToOwnWall(state, player, { row, col });
  if (!Number.isFinite(beforeDistance) || !Number.isFinite(afterDistance) || afterDistance >= beforeDistance) {
    return { value: 0, beforeDistance, afterDistance, connectsNow: false };
  }
  const connectsNow = afterDistance === 0;
  return {
    value: (beforeDistance - afterDistance) * 180 + (connectsNow ? 600 : 0),
    beforeDistance,
    afterDistance,
    connectsNow,
  };
}

export function kingMineDefusalValue(state, row, col, player, enemy) {
  const mines = kingAdjacentMinePositions(state, player, enemy);
  let value = 0;
  let blocksLiberty = false;
  let blocksEnemyConnection = false;
  let wouldDetonate = false;
  const seenGroups = new Set();
  for (const mine of mines) {
    const group = collectGroup(state, mine.row, mine.col);
    const groupKey = group.map(([groupRow, groupCol]) => positionKey(groupRow, groupCol)).sort().join("|");
    if (seenGroups.has(groupKey)) continue;
    seenGroups.add(groupKey);
    const liberties = groupLiberties(state, group);
    const occupiesLiberty = liberties.some((liberty) => liberty.row === row && liberty.col === col);
    if (occupiesLiberty) {
      blocksLiberty = true;
      wouldDetonate ||= liberties.length === 1;
      value -= liberties.length === 1 ? 100000 : 1800 / liberties.length;
    }
    const beforeConnection = shortestConnectionToOtherGroup(state, group, enemy);
    const afterConnection = shortestConnectionToOtherGroup(state, group, enemy, { row, col });
    if (afterConnection > beforeConnection) {
      blocksEnemyConnection = true;
      value -= Number.isFinite(afterConnection) ? 900 : 1800;
    }
  }
  return { value, mineCount: mines.length, blocksLiberty, blocksEnemyConnection, wouldDetonate };
}

export function wallTacticalValue(state, row, col, player, enemy) {
  if (!inBounds(row, col) || state.board[row][col]) {
    return { value: 0, blocksEnemyWall: false, funnelsToOwnWall: false, blocksOwnWallRoute: false };
  }

  let value = 0;
  let blocksEnemyWall = false;
  let funnelsToOwnWall = false;
  let blocksOwnWallRoute = false;
  const visitedGroups = new Set();

  for (const [neighborRow, neighborCol] of orthogonalPositions(row, col)) {
    if (!inBounds(neighborRow, neighborCol)) continue;
    if (state.board[neighborRow][neighborCol]?.owner !== enemy) continue;
    const group = collectGroup(state, neighborRow, neighborCol);
    const groupKey = group.map(([r, c]) => positionKey(r, c)).sort().join("|");
    if (visitedGroups.has(groupKey)) continue;
    visitedGroups.add(groupKey);

    const liberties = groupLiberties(state, group);
    if (liberties.length < 2 || !liberties.some((liberty) => liberty.row === row && liberty.col === col)) continue;
    const classified = liberties.map((liberty) => ({
      ...liberty,
      direction: classifyLibertyDirection(state, liberty.row, liberty.col, enemy, player),
    }));
    const target = classified.find((liberty) => liberty.row === row && liberty.col === col);
    const remaining = classified.filter((liberty) => liberty !== target);

    if (target.direction === "owner_wall") {
      blocksEnemyWall = true;
      value += 90 + group.length * 8;
    } else if (target.direction === "opposing_wall") {
      blocksOwnWallRoute = true;
      value -= 70 + group.length * 6;
    } else {
      value += 12;
    }

    if (
      target.direction !== "opposing_wall"
      && remaining.some(({ direction }) => direction === "opposing_wall")
      && !remaining.some(({ direction }) => direction === "owner_wall")
    ) {
      funnelsToOwnWall = true;
      value += 110 + group.length * 10;
    }
  }

  return { value, blocksEnemyWall, funnelsToOwnWall, blocksOwnWallRoute };
}

export function recentIntentValue(state, row, col, perspective, radius = 4) {
  const recent = recentOpponentDeployments(state, perspective, 4);
  let value = 0;
  for (let index = 0; index < recent.length; index += 1) {
    const distance = Math.abs(row - recent[index].row) + Math.abs(col - recent[index].col);
    if (distance > radius) continue;
    value += (radius + 1 - distance) * (4 - index);
  }
  return value;
}
