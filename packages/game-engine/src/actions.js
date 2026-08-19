import { PLAYERS, SIZE, UNIT_TYPES, inBounds, opponent } from "./constants.js";
import {
  canDeploy,
  findKingPosition,
  hasLegalDeployment,
  incrementDeploymentCount,
  touchesOwnWall,
} from "./board.js";
import { isSuicideDeployment, resolveCaptures } from "./capture.js";
import { emitEvent } from "./events.js";
import {
  activatePendingSpecial,
  queueSpecialActivation,
  resumeNormalTurnIfReady,
} from "./reactions.js";
import { createPiece } from "./state.js";
import { endTurn, finishNoLegalDeployment } from "./victory.js";

export { isSuicideDeployment };

export function dispatchAction(state, player, action, options = {}) {
  const events = [];
  const accepted = performAction(state, player, action, events, options);
  return { accepted, events };
}

function performAction(state, player, action, events, options) {
  const queueReaction = (nextState, group, defender, captor, nextEvents) =>
    queueSpecialActivation(nextState, group, defender, captor, nextEvents, options);
  if (!PLAYERS.includes(player) || !action || typeof action !== "object" || state.winner) return false;
  if (action.type === "pass") {
    if (
      state.turn !== player
      || state.teleporting
      || state.pendingSpecial
      || state.pendingKingSwap
      || hasLegalDeployment(state, player)
    ) {
      return false;
    }
    finishNoLegalDeployment(state, player, events);
    return true;
  }
  if (action.type === "deploy") {
    if (!canDeploy(state, player, action.unitType, action.row, action.col)) return false;
    const piece = createPiece(state, player, action.unitType);
    state.board[action.row][action.col] = piece;
    state.lastMove = { player, unitType: action.unitType, row: action.row, col: action.col };
    state.stock[player][action.unitType] -= 1;
    state.firstDeployDone[player] = true;
    incrementDeploymentCount(state, player);
    let tauntAvailable = null;
    if (action.unitType === "king" && touchesOwnWall(player, action.row, action.col)) {
      const tauntingPlayer = opponent(player);
      state.tauntChances[tauntingPlayer] = {
        targetOwner: player,
        row: action.row,
        col: action.col,
      };
      tauntAvailable = {
        type: "taunt_available",
        player: tauntingPlayer,
        targetOwner: player,
        row: action.row,
        col: action.col,
      };
    }
    emitEvent(state, events, {
      type: "piece_deployed",
      player,
      pieceId: piece.id,
      unitType: action.unitType,
      row: action.row,
      col: action.col,
      revealed: piece.revealed,
    });
    if (tauntAvailable) emitEvent(state, events, tauntAvailable);
    resolveCaptures(state, player, events, queueReaction);
    if (
      options.advanceTurn !== false
      && !state.teleporting
      && !state.pendingSpecial
      && !state.pendingKingSwap
      && !state.winner
    ) {
      endTurn(state, events);
    }
    return true;
  }
  if (action.type === "activate_special") {
    return activatePendingSpecial(state, player, events, options);
  }
  if (action.type === "taunt") {
    const chance = state.tauntChances[player];
    const speaker = findKingPosition(state, player);
    if (!chance || !speaker) return false;
    state.tauntChances[player] = null;
    state.tauntSerial += 1;
    state.tauntEvent = {
      id: state.tauntSerial,
      speakerOwner: player,
      targetOwner: chance.targetOwner,
      row: speaker.row,
      col: speaker.col,
    };
    emitEvent(state, events, { type: "taunt_used", ...state.tauntEvent });
    return true;
  }
  if (action.type === "wizard_teleport") {
    const pending = state.teleporting;
    if (!pending || pending.owner !== player || !inBounds(action.row, action.col) || state.board[action.row][action.col]) {
      return false;
    }
    const wizard = state.board[pending.row][pending.col];
    if (!wizard || wizard.owner !== player) return false;
    state.board[pending.row][pending.col] = null;
    state.board[action.row][action.col] = wizard;
    state.lastMove = {
      player,
      unitType: "wizard",
      action: "teleport",
      row: action.row,
      col: action.col,
      fromRow: pending.row,
      fromCol: pending.col,
    };
    state.teleporting = null;
    emitEvent(state, events, {
      type: "wizard_moved",
      owner: player,
      pieceId: wizard.id,
      fromRow: pending.row,
      fromCol: pending.col,
      row: action.row,
      col: action.col,
    });
    resolveCaptures(state, player, events, queueReaction);
    if (pending.reaction) {
      resumeNormalTurnIfReady(state, events, options);
    } else if (
      options.advanceTurn !== false
      && !state.teleporting
      && !state.pendingSpecial
      && !state.pendingKingSwap
      && !state.winner
    ) {
      endTurn(state, events);
    }
    return true;
  }
  if (action.type === "wizard_stay") {
    const pending = state.teleporting;
    if (!pending || pending.owner !== player) return false;
    const wizard = state.board[pending.row]?.[pending.col];
    if (!wizard || wizard.owner !== player) return false;
    state.lastMove = {
      player,
      unitType: "wizard",
      action: "stay",
      row: pending.row,
      col: pending.col,
    };
    state.teleporting = null;
    emitEvent(state, events, {
      type: "wizard_stayed",
      owner: player,
      pieceId: wizard.id,
      row: pending.row,
      col: pending.col,
    });
    resolveCaptures(state, player, events, queueReaction);
    if (pending.reaction) {
      resumeNormalTurnIfReady(state, events, options);
    } else if (
      options.advanceTurn !== false
      && !state.teleporting
      && !state.pendingSpecial
      && !state.pendingKingSwap
      && !state.winner
    ) {
      endTurn(state, events);
    }
    return true;
  }
  return false;
}

export function applyAction(state, player, action) {
  return dispatchAction(state, player, action).accepted;
}

export function getLegalActions(state, player) {
  if (!PLAYERS.includes(player) || state.winner) return [];
  const actions = [];

  if (state.tauntChances[player] && findKingPosition(state, player)) actions.push({ type: "taunt" });

  if (state.pendingSpecial) {
    if (state.pendingSpecial.owner === player) actions.push({ type: "activate_special" });
    return actions;
  }

  if (state.teleporting) {
    if (state.teleporting.owner !== player) return actions;
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (!state.board[row][col]) actions.push({ type: "wizard_teleport", row, col });
      }
    }
    actions.push({ type: "wizard_stay" });
    return actions;
  }

  if (state.turn !== player) return actions;
  for (const unitType of UNIT_TYPES) {
    if (state.stock[player][unitType] <= 0) continue;
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (canDeploy(state, player, unitType, row, col)) {
          actions.push({ type: "deploy", unitType, row, col });
        }
      }
    }
  }
  if (!actions.some((action) => action.type === "deploy")) actions.push({ type: "pass" });
  return actions;
}
