import { AI_PROFILES, DEPLOY_ORDER, SIZE } from "./config.js";

const MESSAGE_TYPES = new Set([
  "room_created",
  "waiting",
  "room_list",
  "side_selection",
  "match_start",
  "state",
  "error",
  "suicide_warning",
  "rematch_offered",
  "rematch_declined",
  "rps_start",
  "rps_result",
]);
const PLAYERS = new Set(["red", "blue"]);
const WINNERS = new Set(["red", "blue", "draw"]);
const UNIT_TYPES = new Set(DEPLOY_ORDER);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isRoomCode(value) {
  return typeof value === "string" && /^[A-Z0-9]{1,12}$/.test(value);
}

function isRoomSummary(value) {
  return isPlainObject(value)
    && isRoomCode(value.roomCode)
    && Number.isInteger(value.boardNumber)
    && value.boardNumber > 0
    && Number.isInteger(value.playerCount)
    && value.playerCount >= 0
    && value.playerCount <= 2;
}

function hasOptionalBoardNumber(value) {
  return value.boardNumber === undefined
    || (Number.isInteger(value.boardNumber) && value.boardNumber > 0);
}

function isCoordinate(value) {
  return isPlainObject(value)
    && Number.isInteger(value.row)
    && Number.isInteger(value.col)
    && value.row >= 0
    && value.row < SIZE
    && value.col >= 0
    && value.col < SIZE;
}

function isOptionalCoordinate(value) {
  return value === null || isCoordinate(value);
}

function isPiece(value) {
  if (value === null) return true;
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0 || value.id.length > 160) return false;
  if (!PLAYERS.has(value.owner) || !UNIT_TYPES.has(value.type)) return false;
  if (!UNIT_TYPES.has(value.originalType)) return false;
  return typeof value.revealed === "boolean"
    && typeof value.abilityUsed === "boolean"
    && typeof value.kingEscapeUsed === "boolean";
}

function isStock(value) {
  return isPlainObject(value)
    && DEPLOY_ORDER.every((unitType) => isNonNegativeInteger(value[unitType]));
}

function isVisibleStock(value) {
  return value === null || isStock(value);
}

function hasStockForPlayer(state, player) {
  const opponent = player === "red" ? "blue" : "red";
  return isStock(state.stock[player]) && state.stock[opponent] === null;
}

function isPlayerMap(value, validator) {
  return isPlainObject(value) && validator(value.red) && validator(value.blue);
}

function isPendingAbility(value) {
  if (value === null) return true;
  return isCoordinate(value)
    && PLAYERS.has(value.owner)
    && (value.reason === undefined || typeof value.reason === "string")
    && (value.reaction === undefined || typeof value.reaction === "boolean");
}

function isPendingSpecial(value) {
  if (value === null) return true;
  return isCoordinate(value)
    && PLAYERS.has(value.owner)
    && (value.type === undefined || UNIT_TYPES.has(value.type))
    && (value.captor === undefined || PLAYERS.has(value.captor));
}

function isTauntEvent(value) {
  return value === null
    || (isCoordinate(value)
      && isNonNegativeInteger(value.id)
      && PLAYERS.has(value.speakerOwner)
      && PLAYERS.has(value.targetOwner));
}

export function validateGameState(value) {
  if (!isPlainObject(value)) return false;
  if (!Array.isArray(value.board) || value.board.length !== SIZE) return false;
  if (!value.board.every((row) => Array.isArray(row) && row.length === SIZE && row.every(isPiece))) return false;
  if (!PLAYERS.has(value.turn)) return false;
  if (value.resumeTurn !== null && !PLAYERS.has(value.resumeTurn)) return false;
  if (!isOptionalCoordinate(value.selected)) return false;
  if (!isPendingAbility(value.teleporting) || !isPendingSpecial(value.pendingSpecial) || !isPendingAbility(value.pendingWizardTeleport) || !isPendingAbility(value.pendingKingSwap)) return false;
  if (!isTauntEvent(value.tauntEvent) || !isNonNegativeInteger(value.tauntSerial)) return false;
  if (!isNonNegativeInteger(value.tauntUntil)) return false;
  if (value.winner !== null && !WINNERS.has(value.winner)) return false;
  if (typeof value.resultReason !== "string" || value.resultReason.length > 1000) return false;
  if (value.mode !== "pvp") return false;
  if (!AI_PROFILES.includes(value.aiProfile)) return false;
  if (typeof value.aiThinking !== "boolean") return false;
  if (!isPlayerMap(value.stock, isVisibleStock)) return false;
  if (value.stock.red === null && value.stock.blue === null) return false;
  if (!isPlayerMap(value.firstDeployDone, (item) => typeof item === "boolean")) return false;
  if (!isPlainObject(value.stats)) return false;
  if (!isPlayerMap(value.stats.captures, isNonNegativeInteger)) return false;
  if (!isPlayerMap(value.stats.specialsUsed, isNonNegativeInteger)) return false;
  if (!Array.isArray(value.log) || value.log.length > 200 || !value.log.every((item) => typeof item === "string" && item.length <= 1000)) return false;
  return true;
}

export function validateNetworkMessage(message) {
  if (!isPlainObject(message) || !MESSAGE_TYPES.has(message.type)) return false;

  if (message.type === "room_created" || message.type === "waiting") {
    return isRoomCode(message.roomCode)
      && hasOptionalBoardNumber(message)
      && (message.player === undefined || PLAYERS.has(message.player));
  }

  if (message.type === "side_selection") {
    return isRoomCode(message.roomCode) && hasOptionalBoardNumber(message);
  }

  if (message.type === "room_list") {
    return Array.isArray(message.rooms)
      && message.rooms.length <= 100
      && message.rooms.every(isRoomSummary);
  }

  if (message.type === "match_start") {
    return isRoomCode(message.roomCode)
      && hasOptionalBoardNumber(message)
      && PLAYERS.has(message.player)
      && validateGameState(message.state)
      && hasStockForPlayer(message.state, message.player);
  }

  if (message.type === "state") {
    return (message.roomCode === undefined || isRoomCode(message.roomCode))
      && hasOptionalBoardNumber(message)
      && (message.player === undefined || PLAYERS.has(message.player))
      && validateGameState(message.state)
      && (message.player === undefined || hasStockForPlayer(message.state, message.player));
  }

  if (message.type === "suicide_warning") {
    return isPlainObject(message.action)
      && message.action.type === "deploy"
      && UNIT_TYPES.has(message.action.unitType)
      && isCoordinate(message.action);
  }

  if (message.type === "rematch_offered" || message.type === "rematch_declined") {
    return PLAYERS.has(message.byPlayer);
  }

  if (message.type === "rps_start") {
    return isRoomCode(message.roomCode) && hasOptionalBoardNumber(message);
  }

  if (message.type === "rps_result") {
    return ["draw", "win"].includes(message.result);
  }

  return message.message === undefined
    || (typeof message.message === "string" && message.message.length <= 500);
}
