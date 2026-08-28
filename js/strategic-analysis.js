import {
  SIZE,
  boardSignature,
  collectGroup,
  findKingPosition,
  groupHasLiberty,
  opponent,
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
function wallAnchorStones(state, group, owner) {
  return group.filter(([row, col]) => orthogonalPositions(row, col).some(([nextRow, nextCol]) => {
    if (inBounds(nextRow, nextCol)) return false;
    const wallOwner = wallOwnerForEdge(row, nextRow, nextCol);
    return wallOwner === owner || wallOwner === null;
  }));
}

/**
 * Whether a special could be detonated against this King, and how soon.
 *
 * The first attempt here counted how many specials it would take to strip the wall anchors one
 * at a time. That models the wrong threat, and a test on a fully sealed group exposed it: a
 * reaction strikes or converts everything beside the special, and an adjacent King is captured
 * outright — `reactions.js` declares a winner in both the strike and the Diplomat conversion
 * paths. The opponent never has to dismantle an anchor. They need one special next to the King
 * and a reason for it to go off.
 *
 * Returns how many moves away that threat is:
 *
 *   - 1: an unrevealed enemy stone already sits beside the King. It may be a special already,
 *        and it fires the moment its group runs out of liberties.
 *   - 2: an empty point sits beside the King, so a special can still be brought there.
 *   - `Infinity`: the King is enclosed by stones that are known, or no special remains.
 */
function specialThreatProfile(state, group, owner, enemySpecials) {
  const idle = { specialDistance: Infinity, adjacentUnknown: 0, hiddenPool: 0, specialRisk: 0 };
  if (enemySpecials <= 0) return idle;
  const enemy = opponent(owner);

  const hiddenPool = specialCandidatePool(state, enemy);

  const border = new Set();
  for (const [row, col] of group) {
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (inBounds(nextRow, nextCol)) border.add(positionKey(nextRow, nextCol));
    }
  }
  let adjacentUnknown = 0;
  let hasEmptyNeighbour = false;
  for (const key of border) {
    const [row, col] = key.split(":").map(Number);
    const piece = state.board[row][col];
    if (!piece) { hasEmptyNeighbour = true; continue; }
    if (piece.owner === enemy && couldHideSpecial(piece)) adjacentUnknown += 1;
  }

  const specialDistance = adjacentUnknown > 0 ? 1 : (hasEmptyNeighbour ? 2 : Infinity);
  if (!Number.isFinite(specialDistance)) return { ...idle, hiddenPool };

  // A stone beside the King is only a threat if it is *actually* a special, and the odds of that
  // are the remaining specials over the stones whose identity is still unknown — usually dozens.
  // Reporting distance 1 without this would make every King with an unidentified neighbour read
  // as one move from death, which is the same overstatement as the `Infinity` it replaces, only
  // pointed the other way. Placement costs a move, so a reachable empty point is discounted.
  const perStone = hiddenPool > 0 ? Math.min(1, enemySpecials / hiddenPool) : 0;
  // A stone that reached the side of a King is not a stone picked at random, so the base rate
  // understates it by roughly threefold. Placement still costs a move, so a merely reachable
  // empty point is discounted instead.
  const specialRisk = adjacentUnknown > 0
    ? Math.min(1, perStone * KING_ADJACENT_SPECIAL_ODDS_FACTOR * adjacentUnknown)
    : perStone * 0.5;
  return { specialDistance, adjacentUnknown, hiddenPool, specialRisk };
}

/**
 * How far the King is from being captured.
 *
 * Without `specialsBreakAnchors` this is the Stage 1a measure exactly: `kingLibertyCount` sums
 * board liberties and wall liberties into one number, which ranks a King sealed against its own
 * wall below a King standing in the open, and separating the two restores the ordering the
 * rules imply. A wall anchor is permanent under soldier play — the opponent cannot occupy a wall
 * edge — so an anchored King reads as `Infinity`.
 *
 * With the option on, that `Infinity` is qualified. It is true of soldiers and of nothing else,
 * and left unqualified it pins the danger term at zero for most of the game: over 706 sampled
 * King positions, 53.7% were anchored overall and 100% were past 40% board fill. Once specials
 * are counted the measure becomes a spectrum again.
 */
export function kingSafetyProfile(state, owner, options = {}) {
  const king = findKingPosition(state, owner);
  if (!king) {
    return {
      wallAnchors: 0,
      boardLiberties: 0,
      soldierCaptureDistance: 0,
      enemySpecials: 0,
      specialDistance: Infinity,
      adjacentUnknown: 0,
      hiddenPool: 0,
      specialRisk: 0,
      effectiveCaptureDistance: 0,
    };
  }
  const group = collectGroup(state, king.row, king.col);
  const anchors = wallAnchorStones(state, group, owner);
  const boardLiberties = groupLiberties(state, group).length;
  const soldierCaptureDistance = anchors.length > 0 ? Infinity : boardLiberties;

  if (!options.specialsBreakAnchors) {
    return {
      wallAnchors: anchors.length,
      boardLiberties,
      soldierCaptureDistance,
      enemySpecials: 0,
      specialDistance: Infinity,
      adjacentUnknown: 0,
      hiddenPool: 0,
      specialRisk: 0,
      effectiveCaptureDistance: soldierCaptureDistance,
    };
  }

  // Hidden information is respected: this counts what the owner could have observed, not what
  // the opponent actually holds.
  const enemySpecials = observedRemainingSpecialTypes(state, owner, opponent(owner)).length;
  const threat = specialThreatProfile(state, group, owner, enemySpecials);
  const { specialDistance } = threat;
  return {
    wallAnchors: anchors.length,
    boardLiberties,
    soldierCaptureDistance,
    enemySpecials,
    ...threat,
    // Whichever route is shorter. Claiming `Infinity` while a special can still be walked up to
    // the King is the overstatement that flattened the danger term.
    effectiveCaptureDistance: Math.min(soldierCaptureDistance, specialDistance),
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
export function buildMidgameTacticalPolicy(state, player, enemy, options = {}) {
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
  const conversionCells = new Set();
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
      conversionCells,
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
  // A Diplomat that turns a guard and closes the net captures the King, and nothing else on the
  // board can do it. That is the move worth protecting from a preference about unit types.
  //
  // Beside the King is not that move: a reaction takes an adjacent King whatever fired it, so
  // there the General and the Wizard kill too and the doctrine's preference for the stones they
  // clear still stands. Only the empty points touching the King's own group can change that
  // group's liberties, so those, minus its neighbours, are the whole set worth testing.
  if (options.conversionSight && kingAssault && enemyKing
    && (state.stock?.[player]?.diplomat || 0) > 0) {
    for (const [row, col] of collectGroup(state, enemyKing.row, enemyKing.col)) {
      for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
        if (!inBounds(nextRow, nextCol) || state.board[nextRow][nextCol]) continue;
        if (Math.abs(nextRow - enemyKing.row) + Math.abs(nextCol - enemyKing.col) === 1) continue;
        const key = positionKey(nextRow, nextCol);
        if (conversionCells.has(key)) continue;
        if (diplomatConversionCapturesKing(state, player, enemy, nextRow, nextCol)) {
          conversionCells.add(key);
        }
      }
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
    conversionCells,
    enemyKing,
  };
}

export function classifyMidgameCandidate(policy, candidate) {
  const key = positionKey(candidate.row, candidate.col);
  const special = ATTACK_SPECIALS.has(candidate.type);
  const kingDistance = policy.enemyKing
    ? Math.abs(candidate.row - policy.enemyKing.row) + Math.abs(candidate.col - policy.enemyKing.col)
    : Infinity;
  // A conversion capture stays in the assault pool whatever its distance to the King, because
  // the guard it turns need only belong to the King's group.
  const conversionCapture = candidate.type === "diplomat"
    && Boolean(policy.conversionCells?.has(key));
  const specialAttack = conversionCapture || (policy.kingAssault && special && kingDistance <= 3);
  // The type order is a real preference and not one the positional score carries: beside the
  // King the table scores a Diplomat two points above a General, so with the order gone the
  // stone-clearing doctrine loses those squares to an accident of the base values. What the
  // order must not do is outrank a conversion capture, which is a win rather than a preference.
  const specialOrder = conversionCapture ? 4
    : candidate.type === "general" ? 3
      : candidate.type === "wizard" ? 2
        : candidate.type === "diplomat" ? 1 : 0;
  return {
    forcedSoldierLiberty: candidate.type === "soldier" && policy.forcedSoldierLiberties.has(key),
    specialAttack,
    conversionCapture,
    specialOrder,
    kingDistance,
    capture: policy.captureCells.has(key),
    homeSeal: policy.homeSealCells.has(key),
    wallBridge: policy.wallBridgeCells.has(key),
  };
}

/** Deployments a side must make before a special becomes legal (`isSpecialLocked`). */
const SPECIAL_UNLOCK_DEPLOYMENTS = 5;

/**
 * Ceiling on the pool a hidden special is drawn from.
 *
 * Captures hand stones back and forth, so in principle the unidentified pool can reach seventy
 * or eighty. Positions that lopsided are rare, and a denominator that large drives the odds to
 * near zero exactly when the game is most decided. Sixty keeps the floor at a real number.
 */
const SPECIAL_CANDIDATE_POOL_CAP = 60;

/**
 * How much likelier a stone beside a King is to be a special than a stone picked at random.
 *
 * Measured over 4904 King positions from recorded games: 38.4% of unidentified stones beside a
 * King were specials against a 12.0% base rate. It is not survivorship — counted at the moment
 * of deployment, 72.2% of placements beside a King were specials against 37.8% overall. Nobody
 * spends an ordinary soldier there; it is a mine, and it wins the game when it goes off.
 */
export const KING_ADJACENT_SPECIAL_ODDS_FACTOR = 3.2;

/**
 * Whether this stone could still turn out to be a special.
 *
 * Specials are locked until a side's fifth deployment and the two sides alternate, so the first
 * ten stones created in a game are ordinary without exception. Those can be ruled out outright
 * rather than discounted, which matters most in the opening — the naive ratio spreads three
 * specials over stones that are not even eligible, and understates the danger of the first one
 * that is.
 */
export function couldHideSpecial(piece) {
  if (!piece || piece.revealed || piece.type === "king") return false;
  const match = /^piece-(\d+)$/.exec(piece.id || "");
  if (!match) return true;
  return Number(match[1]) > SPECIAL_UNLOCK_DEPLOYMENTS * 2;
}

/** Enemy stones a hidden special could still be, bounded so the odds stay meaningful. */
export function specialCandidatePool(state, enemy) {
  let count = 0;
  for (const piece of state.board.flat()) {
    if (piece?.owner === enemy && couldHideSpecial(piece)) count += 1;
  }
  return Math.min(count, SPECIAL_CANDIDATE_POOL_CAP);
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

/**
 * Where to put a special so it works against the enemy King, ranked best first.
 *
 * The offensive mirror of `kingAdjacentMinePositions`, which only ever looked at enemy stones
 * beside *our* King. A reaction strikes or converts every enemy adjacent to the special and
 * captures an adjacent King outright, and that one fact orders the whole board:
 *
 *   1. Beside the King. Any special ends the match when it goes off, so the type does not
 *      matter. If the point is already enclosed it fires at once; otherwise it is a mine the
 *      opponent can never safely approach.
 *   2. The diagonals. A King guarded on all four sides cannot be reached, but a diagonal point
 *      touches two of those guards at the same time, so one detonation opens two sides at once.
 *      Verified on the engine: a General on the corner point removed both neighbouring guards.
 *   3. Outside a guard, on the far side from the King. Slower, and it only threatens one guard,
 *      but it is what remains when the diagonals are taken.
 */
export function specialAssaultTargets(state, player, enemy) {
  const king = findKingPosition(state, enemy);
  if (!king) return [];
  const targets = [];
  const consider = (row, col, rank, reason) => {
    if (!inBounds(row, col) || state.board[row][col]) return;
    targets.push({ row, col, rank, reason });
  };
  for (const [row, col] of orthogonalPositions(king.row, king.col)) {
    consider(row, col, 1, "beside_king");
  }
  for (const [rowStep, colStep] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    consider(king.row + rowStep, king.col + colStep, 2, "diagonal");
  }
  for (const [rowStep, colStep] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const guard = state.board[king.row + rowStep]?.[king.col + colStep];
    if (guard?.owner !== enemy || guard.type === "king") continue;
    consider(king.row + rowStep * 2, king.col + colStep * 2, 3, "outside_guard");
  }
  return targets.sort((a, b) => a.rank - b.rank);
}

/**
 * Whether a placement would join one of our own specials that has not gone off yet.
 *
 * A special fires when its group runs out of liberties, so adding a stone beside it enlarges
 * the group, hands it more liberties, and can leave it inert for the rest of the game. Placing
 * a second special there wastes both at once. The evaluation pulls the other way — `connectivity`
 * rewards `group.length * group.length` — which is why three of the five tiers walk into it.
 */
export function joinsOwnPendingSpecial(state, player, row, col) {
  return orthogonalPositions(row, col).some(([nextRow, nextCol]) => {
    if (!inBounds(nextRow, nextCol)) return false;
    const piece = state.board[nextRow][nextCol];
    return piece?.owner === player && ATTACK_SPECIALS.has(piece.type) && !piece.abilityUsed;
  });
}

/**
 * Whether a Diplomat placed here would take the King by turning its own guards.
 *
 * A Diplomat converts every adjacent enemy into one of ours rather than removing it, and
 * `activatePendingSpecial` runs `resolveCaptures` afterwards. So a guard that was giving the
 * King its last liberty can change sides and complete the surround in the same reaction — the
 * King is captured without the Diplomat ever touching it. Verified on the engine: flipping the
 * single guard of an otherwise enclosed King left it with no liberty at all.
 *
 * The look-ahead is what makes this a Grandmaster move. The reward is invisible one ply deep,
 * because the conversion has not happened yet.
 */
export function diplomatConversionCapturesKing(state, player, enemy, row, col) {
  if (!inBounds(row, col) || state.board[row][col]) return false;
  const king = findKingPosition(state, enemy);
  if (!king) return false;
  const after = structuredClone(state);
  after.board[row][col] = {
    id: "diplomat-probe",
    owner: player,
    type: "diplomat",
    originalType: "diplomat",
    revealed: true,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  let converted = 0;
  for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
    if (!inBounds(nextRow, nextCol)) continue;
    const piece = after.board[nextRow][nextCol];
    if (!piece || piece.owner !== enemy) continue;
    if (piece.type === "king") return true;
    piece.owner = player;
    piece.type = "soldier";
    converted += 1;
  }
  if (!converted) return false;
  const group = collectGroup(after, king.row, king.col);
  return !groupHasLiberty(after, group, enemy);
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
