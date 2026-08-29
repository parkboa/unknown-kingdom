import {
  collectGroup,
  findKingPosition,
  inBounds,
  orthogonalPositions,
  touchesOwnWall,
} from "../packages/game-engine/src/index.js";

const SPECIAL_TYPES = new Set(["general", "wizard", "diplomat"]);

export const AI_CANDIDATE_CATALOG = Object.freeze({
  KING: "king",
  SPECIAL: "special",
  BOARD: "board",
});

const positionKey = (row, col) => `${row}:${col}`;

function kingLibertyCells(state, king) {
  const liberties = new Set();
  if (!king) return liberties;
  for (const [row, col] of collectGroup(state, king.row, king.col)) {
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (inBounds(nextRow, nextCol) && !state.board[nextRow][nextCol]) {
        liberties.add(positionKey(nextRow, nextCol));
      }
    }
  }
  return liberties;
}

export function createAiCatalogContext(state, aiPlayer, humanPlayer, decisionStage) {
  const ownKing = findKingPosition(state, aiPlayer);
  const enemyKing = findKingPosition(state, humanPlayer);
  return {
    state,
    aiPlayer,
    humanPlayer,
    decisionStage,
    ownKing,
    enemyKing,
    ownKingLiberties: kingLibertyCells(state, ownKing),
    enemyKingLiberties: kingLibertyCells(state, enemyKing),
  };
}

function kingSignals(context, candidate) {
  const signals = [];
  const key = positionKey(candidate.row, candidate.col);
  if (context.decisionStage === "opening_king") signals.push("opening_king_deployment");
  if (context.decisionStage === "opening_sanctuary") signals.push("opening_sanctuary_construction");
  if (context.ownKingLiberties.has(key)) signals.push("own_king_liberty");
  if (context.enemyKingLiberties.has(key)) signals.push("enemy_king_liberty");
  if (context.ownKing) {
    const distance = Math.abs(candidate.row - context.ownKing.row)
      + Math.abs(candidate.col - context.ownKing.col);
    if (distance <= 2) signals.push("own_king_proximity");
  }
  if (context.enemyKing) {
    const distance = Math.abs(candidate.row - context.enemyKing.row)
      + Math.abs(candidate.col - context.enemyKing.col);
    if (distance <= 3) signals.push("enemy_king_pressure");
  }
  return signals;
}

function specialSignals(candidate) {
  if (!SPECIAL_TYPES.has(candidate.type)) return [];
  return [`special_unit:${candidate.type}`];
}

function boardSignals(context, candidate) {
  const signals = [];
  if (candidate.type === "soldier") signals.push("ordinary_soldier");
  let adjacentAllies = 0;
  let adjacentEnemies = 0;
  for (const [row, col] of orthogonalPositions(candidate.row, candidate.col)) {
    if (!inBounds(row, col)) continue;
    const piece = context.state.board[row][col];
    if (piece?.owner === context.aiPlayer) adjacentAllies += 1;
    else if (piece?.owner === context.humanPlayer) adjacentEnemies += 1;
  }
  if (adjacentAllies > 0) signals.push("group_connection");
  if (adjacentEnemies > 0) signals.push("enemy_contact");
  if (touchesOwnWall(context.aiPlayer, candidate.row, candidate.col)) signals.push("own_wall");
  if (touchesOwnWall(context.humanPlayer, candidate.row, candidate.col)) signals.push("enemy_wall");
  if (!signals.length) signals.push("territory_shape");
  return signals;
}

/**
 * Classifies without changing score or candidate order. A move may carry signals from several
 * catalogs, but receives one primary owner so later arbitration cannot count the same fact twice.
 */
export function classifyAiCandidate(context, candidate) {
  const signals = {
    king: kingSignals(context, candidate),
    special: specialSignals(candidate),
    board: boardSignals(context, candidate),
  };
  const openingKingContract = context.decisionStage === "opening_king"
    || context.decisionStage === "opening_sanctuary";
  const primary = openingKingContract || candidate.type === "king"
    ? AI_CANDIDATE_CATALOG.KING
    : signals.special.length
      ? AI_CANDIDATE_CATALOG.SPECIAL
      : signals.king.length
        ? AI_CANDIDATE_CATALOG.KING
        : AI_CANDIDATE_CATALOG.BOARD;
  return { primary, signals };
}

export function candidateActionKey(candidate) {
  return `${candidate.type}:${candidate.row}:${candidate.col}`;
}
