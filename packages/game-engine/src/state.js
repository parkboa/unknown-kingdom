import { SIZE } from "./constants.js";

function ensureNextPieceId(state) {
  if (Number.isSafeInteger(state.nextPieceId) && state.nextPieceId > 0) return;
  let highestExistingId = 0;
  for (const piece of state.board?.flat?.() || []) {
    const match = /^piece-(\d+)$/.exec(piece?.id || "");
    if (match) highestExistingId = Math.max(highestExistingId, Number(match[1]));
  }
  state.nextPieceId = highestExistingId + 1;
}

export function createPiece(state, owner, type) {
  ensureNextPieceId(state);
  const id = `piece-${state.nextPieceId}`;
  state.nextPieceId += 1;
  return {
    id,
    owner,
    type,
    originalType: type,
    revealed: type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

export function occupiedSoldier(state, owner) {
  return createPiece(state, owner, "soldier");
}

export function createGameState(mode = "pvp", options = {}) {
  const base = {
    board: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
    nextPieceId: 1,
    turn: "black",
    selected: null,
    lastMove: null,
    teleporting: null,
    pendingSpecial: null,
    resumeTurn: null,
    pendingWizardTeleport: null,
    pendingKingSwap: null,
    capturedKing: null,
    tauntEvent: null,
    tauntSerial: 0,
    tauntUntil: 0,
    winner: null,
    resultReason: "",
    mode,
    aiProfile: "balanced",
    aiThinking: false,
    stock: {
      black: { soldier: 77, king: 1, general: 1, diplomat: 1, wizard: 1 },
      white: { soldier: 77, king: 1, general: 1, diplomat: 1, wizard: 1 },
    },
    firstDeployDone: { black: false, white: false },
    deploymentCount: { black: 0, white: 0 },
    stats: {
      captures: { black: 0, white: 0 },
      specialsUsed: { black: 0, white: 0 },
    },
    informationHistory: {
      schemaVersion: 1,
      black: [],
      white: [],
    },
    log: ["New online match started. Black deploys first."],
  };
  return Object.assign(base, options);
}
