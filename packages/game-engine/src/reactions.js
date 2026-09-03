import { SPECIALS, neighbors, opponent, sideLabel } from "./constants.js";
import { hasEmptyCell } from "./board.js";
import { resolveCaptures } from "./capture.js";
import { emitEvent, setTurn } from "./events.js";
import { occupiedSoldier } from "./state.js";
import { declareWinner, startTurn } from "./victory.js";

const captureReasonLabel = (reason) => ({
  general_reaction: "General capture reaction",
  wizard_reaction: "Wizard capture reaction",
}[reason] || reason);

function capturePiece(state, row, col, reason, events) {
  const piece = state.board[row][col];
  if (!piece) return null;
  const captor = opponent(piece.owner);
  state.board[row][col] = null;
  state.stats.captures[captor] += 1;
  emitEvent(state, events, {
    type: "piece_removed",
    captor,
    owner: piece.owner,
    pieceId: piece.id,
    unitType: piece.type,
    row,
    col,
    reason,
    revealed: piece.revealed || piece.type === "king",
  });
  return piece.type === "king" ? { captor, owner: piece.owner } : null;
}

function strikeAdjacentEnemies(state, row, col, owner, reason, events) {
  let capturedKing = null;
  for (const [targetRow, targetCol] of neighbors(row, col)) {
    if (state.board[targetRow][targetCol]?.owner !== owner) {
      const captured = capturePiece(state, targetRow, targetCol, reason, events);
      if (captured) capturedKing = captured;
    }
    if (state.pendingKingSwap) return;
  }
  return capturedKing;
}

function convertAdjacentEnemies(state, row, col, owner, events) {
  const converted = [];
  let capturedKing = null;
  for (const [targetRow, targetCol] of neighbors(row, col)) {
    const piece = state.board[targetRow][targetCol];
    if (!piece || piece.owner === owner) continue;
    if (piece.type === "king") {
      converted.push({ pieceId: piece.id, fromOwner: piece.owner, row: targetRow, col: targetCol });
      state.board[targetRow][targetCol] = occupiedSoldier(state, owner);
      state.stats.captures[owner] += 1;
      capturedKing = { owner: piece.owner };
      continue;
    }
    state.stats.captures[owner] += 1;
    converted.push({ pieceId: piece.id, fromOwner: piece.owner, row: targetRow, col: targetCol });
    piece.owner = owner;
    piece.type = "soldier";
    piece.abilityUsed = true;
  }
  if (converted.length) emitEvent(state, events, { type: "pieces_converted", owner, pieces: converted });
  return capturedKing;
}

function declareReactionKingWinner(state, capturedKing, owner, type, events) {
  if (!capturedKing || state.winner) return;
  const captureMethod = type === "diplomat" ? "diplomat_conversion" : `${type}_reaction`;
  const legacyReason = type === "diplomat"
    ? `${sideLabel(capturedKing.owner)} King was captured by Diplomat conversion.`
    : `${sideLabel(capturedKing.owner)} King was captured by ${captureReasonLabel(captureMethod)}.`;
  declareWinner(
    state,
    owner,
    legacyReason,
    events,
    "king_captured",
    { defeatedPlayer: capturedKing.owner, captureMethod },
  );
}

function retireSpecial(piece) {
  piece.originalType ||= piece.type;
  piece.type = "soldier";
  piece.abilityUsed = true;
}

export function queueSpecialActivation(state, group, defender, captor, events, options = {}) {
  const specials = group
    .map(([row, col]) => ({ row, col, piece: state.board[row][col] }))
    .filter(({ piece }) => piece?.owner === defender && SPECIALS.has(piece.type) && !piece.abilityUsed);
  const special = specials[0];
  if (!special) return false;

  const { row, col, piece } = special;
  piece.revealed = true;
  state.resumeTurn ??= opponent(state.turn);
  state.pendingSpecial = { row, col, owner: piece.owner, type: piece.type, captor };
  emitEvent(
    state,
    events,
    { type: "special_revealed", owner: piece.owner, unitType: piece.type, pieceId: piece.id, row, col, captor },
    `${sideLabel(piece.owner)} ${piece.type} was surrounded. Ability activation is pending.`,
  );
  setTurn(state, piece.owner, events, "special_reaction");
  return true;
}

export function resumeNormalTurnIfReady(state, events, options = {}) {
  if (state.winner) {
    state.resumeTurn = null;
    return;
  }
  if (state.teleporting || state.pendingSpecial || state.pendingKingSwap || !state.resumeTurn) return;
  const resumeTurn = state.resumeTurn;
  state.resumeTurn = null;
  if (options.advanceTurn === false) {
    setTurn(state, resumeTurn, events, "reaction_complete");
  } else {
    startTurn(state, resumeTurn, events, "reaction_complete");
  }
}

export function activatePendingSpecial(state, player, events, options = {}) {
  const pending = state.pendingSpecial;
  if (!pending || pending.owner !== player || state.winner) return false;
  const piece = state.board[pending.row]?.[pending.col];
  if (!piece || piece.owner !== player || piece.type !== pending.type || !SPECIALS.has(piece.type) || piece.abilityUsed) {
    state.pendingSpecial = null;
    return false;
  }

  piece.revealed = true;
  state.stats.specialsUsed[piece.owner] += 1;
  state.pendingSpecial = null;
  emitEvent(state, events, {
    type: "special_activated",
    owner: piece.owner,
    unitType: piece.type,
    pieceId: piece.id,
    row: pending.row,
    col: pending.col,
  });
  let capturedKing = null;
  if (piece.type === "general") {
    capturedKing = strikeAdjacentEnemies(state, pending.row, pending.col, piece.owner, "general_reaction", events);
    retireSpecial(piece);
  } else if (piece.type === "diplomat") {
    capturedKing = convertAdjacentEnemies(state, pending.row, pending.col, piece.owner, events);
    retireSpecial(piece);
  } else if (piece.type === "wizard") {
    capturedKing = strikeAdjacentEnemies(state, pending.row, pending.col, piece.owner, "wizard_reaction", events);
    retireSpecial(piece);
    if (!capturedKing && hasEmptyCell(state)) {
      state.teleporting = { row: pending.row, col: pending.col, owner: piece.owner, reaction: true };
      emitEvent(state, events, {
        type: "wizard_move_required",
        owner: piece.owner,
        pieceId: piece.id,
        row: pending.row,
        col: pending.col,
      });
      return true;
    }
  }

  if (!state.pendingKingSwap) {
    const queueReaction = capturedKing
      ? () => false
      : (nextState, group, defender, captor, nextEvents) =>
        queueSpecialActivation(nextState, group, defender, captor, nextEvents, options);
    resolveCaptures(state, player, events, queueReaction);
  }
  declareReactionKingWinner(state, capturedKing, piece.owner, piece.originalType, events);
  resumeNormalTurnIfReady(state, events, options);
  return true;
}
