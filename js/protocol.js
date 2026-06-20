import { AI_PROFILES, DEPLOY_ORDER, SIZE } from "./config.js";

const MESSAGE_TYPES = new Set(["room_created", "waiting", "match_start", "state", "error"]);
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

export function validateGameState(value) {
  if (!isPlainObject(value)) return false;
  if (!Array.isArray(value.board) || value.board.length !== SIZE) return false;
  if (!value.board.every((row) => Array.isArray(row) && row.length === SIZE && row.every(isPiece))) return false;
  if (!PLAYERS.has(value.turn)) return false;
  if (!isOptionalCoordinate(value.selected)) return false;
  if (!isPendingAbility(value.teleporting) || !isPendingAbility(value.pendingWizardTeleport) || !isPendingAbility(value.pendingKingSwap)) return false;
  if (value.winner !== null && !WINNERS.has(value.winner)) return false;
  if (typeof value.resultReason !== "string" || value.resultReason.length > 1000) return false;
  if (value.mode !== "pvp") return false;
  if (!AI_PROFILES.includes(value.aiProfile)) return false;
  if (typeof value.aiThinking !== "boolean") return false;
  if (!isPlayerMap(value.stock, isStock)) return false;
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
    return isRoomCode(message.roomCode);
  }

  if (message.type === "match_start") {
    return isRoomCode(message.roomCode)
      && PLAYERS.has(message.player)
      && validateGameState(message.state);
  }

  if (message.type === "state") {
    return (message.roomCode === undefined || isRoomCode(message.roomCode))
      && (message.player === undefined || PLAYERS.has(message.player))
      && validateGameState(message.state);
  }

  return message.message === undefined
    || (typeof message.message === "string" && message.message.length <= 500);
}
