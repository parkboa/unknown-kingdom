import { AI_PROFILES, PVE_HUMAN, SIZE } from "./config.js";

function pieceId(owner, type) {
  return `${owner}-${type}-${crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random()}`;
}

export function createPiece(owner, type) {
  return {
    id: pieceId(owner, type),
    owner,
    type,
    originalType: type,
    revealed: type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

export function createOccupiedSoldier(owner) {
  return createPiece(owner, "soldier");
}

export function createInitialState(mode, pveHumanPlayer = PVE_HUMAN) {
  const startingSide = mode === "puzzle" ? pveHumanPlayer : "black";
  const startingSideLabel = startingSide === "black" ? "Black" : "White";
  const aiProfile = AI_PROFILES[Math.floor(Math.random() * AI_PROFILES.length)];
  return {
    board: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null)),
    turn: startingSide,
    selected: null,
    lastMove: null,
    teleporting: null,
    pendingSpecial: null,
    resumeTurn: null,
    pendingWizardTeleport: null,
    pendingKingSwap: null,
    tauntEvent: null,
    tauntSerial: 0,
    tauntUntil: 0,
    winner: null,
    resultReason: "",
    mode,
    aiProfile,
    aiDifficulty: "novice",
    aiRank: "novice",
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
    log: [`New match started. ${startingSideLabel} deploys first.`],
  };
}
