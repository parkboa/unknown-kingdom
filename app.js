import {
  DEPLOY_ORDER,
  PVE_AI,
  PVE_HUMAN,
  PROTOCOL_VERSION,
  SIZE,
  SPECIALS,
  createUnitLabels,
} from "./js/config.js?v=privacy-support-1";
import {
  inBounds,
  neighbors,
  opponent,
} from "./js/board.js";
import {
  activeKingZones as engineActiveKingZones,
  canDeploy as engineCanDeploy,
  countPieces as engineCountPieces,
  findKingPosition as engineFindKingPosition,
  hasLegalDeployment,
} from "./packages/game-engine/src/index.js";
import {
  chooseAiTeleportDestination,
  findAiDeployMove,
} from "./js/ai.js?v=progression-2";
import { createTranslator } from "./js/i18n.js?v=privacy-support-1";
import {
  buildNetworkUrl,
  clearOnlineResumeTicket,
  connectNetwork as openNetworkConnection,
  createNetworkSession,
  disconnectNetwork as closeNetworkConnection,
  sendNetworkCommand,
  sendNetworkAction as sendNetworkMessage,
} from "./js/network.js?v=account-delete-1";
import { deleteOnlineAccount } from "./js/auth.js?v=account-delete-1";
import {
  createInitialState,
  createOccupiedSoldier,
  createPiece,
} from "./js/state.js?v=resume-turn-1";
import {
  renderGame,
  setCoinDesign,
  teleportUiState,
  updateTurnTimerPill,
} from "./js/render.js?v=release-20260824-1";
import {
  AI_RANK_LABELS,
  AI_RANK_ORDER,
  CHALLENGE_DISPLAY_RANKS,
  CHALLENGE_RANK_LABELS,
  PUZZLES,
  RANK_LABELS,
  RANK_ORDER,
} from "./js/puzzles.js?v=progression-2";
import {
  dispatchSharedLocalAction,
  classifySharedLocalPlacement,
} from "./js/shared-engine-adapter.mjs?v=local-shared-2";
import { createPveJournalRecorder } from "./js/pve-journal.js?v=browser-jsonl-1";
import {
  initAudioGesture,
  isMusicEnabled,
  isSfxEnabled,
  playPlacementSound,
  setMusicEnabled,
  setSfxEnabled,
} from "./js/audio.js?v=release-20260824-1";
import {
  isSpecialCharacterEnabled,
  setSpecialCharacterEnabled,
  getSavedLanguage,
  isPveTimerEnabled,
  setPveTimerEnabled,
  setSavedLanguage,
} from "./js/settings.js?v=release-20260824-1";
import {
  arePrimaryModesUnlocked,
  challengeProgress,
  firstUnresolvedRankIndex,
  isAiRankUnlocked,
  isValidPuzzlePiece,
  localizedPuzzleText,
  markAiRankDefeated,
  markPuzzleComplete as persistPuzzleComplete,
  markTutorialComplete as persistTutorialComplete,
  normalizePuzzleStock,
} from "./js/puzzle-controller.js?v=progression-4";
import {
  renderOpenRoomsList,
  resetRpsButtons as uiResetRpsButtons,
  showNetworkRoomControls as uiShowNetworkRoomControls,
  showNetworkRpsPicker as uiShowNetworkRpsPicker,
  showNetworkWaitingRoom as uiShowNetworkWaitingRoom,
} from "./js/online-ui.js";
import {
  pveDeadlineAction,
  resolvePveTurnDeadline,
} from "./js/pve-timer-controller.js";

const LANGUAGE = getSavedLanguage("ko");
const ASSET_VERSION = "progression-2";
const PREVIEW_MODE = new URLSearchParams(location.search).get("preview");
const requestedServer = new URLSearchParams(location.search).get("server");
if (requestedServer) localStorage.setItem("unknown-kingdom-server", requestedServer);
const isNativeApp = location.protocol === "capacitor:";
const isLocalHost = !isNativeApp && (location.hostname === "127.0.0.1"
  || location.hostname === "localhost"
  || location.hostname.endsWith(".local")
  || /^192\.168\./.test(location.hostname)
  || /^10\./.test(location.hostname)
  || /^172\.(1[6-9]|2\d|3[01])\./.test(location.hostname));
const requestedDeveloperMode = new URLSearchParams(location.search).get("dev");
const DEVELOPER_MODE = requestedDeveloperMode === "1";
const defaultNetworkServer = isLocalHost
  ? `ws://${location.hostname}:4175/ws`
  : "wss://unknown-kingdom-server.onrender.com/ws";
const NETWORK_SERVER = requestedServer || (isLocalHost ? defaultNetworkServer : (localStorage.getItem("unknown-kingdom-server") || defaultNetworkServer));
const UNIT_LABELS = createUnitLabels(LANGUAGE);
const text = createTranslator(LANGUAGE);

document.body.classList.toggle("iphone-preview", PREVIEW_MODE === "iphone");

function lastDeploymentKey(move, board) {
  if (!move || move.action) return "";
  if (!Number.isInteger(move.row) || !Number.isInteger(move.col)) return "";
  const pieceId = board?.[move.row]?.[move.col]?.id || "";
  return `${move.player}:${move.unitType}:${move.row}:${move.col}:${pieceId}`;
}

let state;
let undoStack = [];
let aiTimer = null;
let tauntTimer = null;
let visibleTaunt = null;
let cutsceneTimer = null;
let visibleCutscene = null;
let pendingSpecialTimer = null;
let pendingSpecialAutoKey = null;
let activeSkillEffect = null;
let skillEffectTimer = null;
let lastTauntEventId = 0;
let networkSession = createNetworkSession();
let onlineTurnDeadline = null;
let pveTurnDeadline = null;
let rematchOfferedBy = null;
let pveHumanPlayer = PVE_HUMAN;
let pveAiPlayer = PVE_AI;
let pveDifficulty = "novice";
let selectedPveRank = null;
let pveTimerEnabled = isPveTimerEnabled();
let activePveTimerEnabled = pveTimerEnabled;
let tutorialStep = -1;
let tutorialIntro = false;
let tutorialIntroPage = 0;
let tutorialIntroReady = false;
let tutorialIntroTimer = null;
let tutorialAwaitingContinue = false;
let tutorialKingPosition = null;
let tutorialReactionPending = false;
let tutorialReactionPhase = null;
let tutorialTimer = null;
let tutorialScriptTimer = null;
let tutorialScriptRunning = false;
let tutorialSanctuaryPhase = null;
let tutorialSpecialIntroPhase = null;
let tutorialCompletionPhase = null;
let pveRpsResultTimer = null;
let puzzleIndex = 0;
let activePuzzle = null;
let puzzleMoves = 0;
let puzzleInitialCaptures = null;
let puzzleCompleted = false;
let openRooms = [];
let selectedOpenRoomCode = "";
let rematchRequested = false;
let pendingSuicideConfirmation = null;
let suicideConfirmReturnFocus = null;
let pveJournalRecorder = null;
let pveJournalGameId = null;
let pendingDeploymentAnimation = null;
let matchResultDetailsOpen = false;

const AI_MOVE_DELAY_MS = 600;
// One beat between "surrounded" and the ability firing, shared by every mode.
const SPECIAL_ACTIVATE_DELAY_MS = 1200;
const AI_WIZARD_TELEPORT_DELAY_MS = 900;
const TUTORIAL_SPECIAL_SURROUND_DELAY_MS = 1200;
const TUTORIAL_SCRIPT_ACTION_DELAY_MS = 180;
const TAUNT_DISPLAY_MS = 3000;
const CUTSCENE_DISPLAY_MS = 2000;
const GENERAL_CUTIN_MS = 2000;
const GENERAL_SKILL_EFFECT_MS = 500;
const DIPLOMAT_CUTIN_MS = 2000;
const DIPLOMAT_SKILL_EFFECT_MS = 600;
const WIZARD_CUTIN_MS = 2000;
const WIZARD_SKILL_EFFECT_MS = 600;
const SPLASH_MIN_DURATION_MS = 2500;
const SPLASH_SERVER_TIMEOUT_MS = 2000;
const PVE_TURN_LIMIT_MS = 30000;
const PVE_JOURNAL_STORAGE_KEY = "unknown-kingdom-latest-pve-jsonl";

const TUTORIAL_STEPS = [
  { unitType: "king", owner: "white", row: 7, col: 4, message: "tutorialKing", placedMessage: "tutorialKingPlaced" },
  {
    unitType: "soldier",
    owner: "white",
    row: 4,
    col: 4,
    message: "tutorialCapture",
    placedMessage: "tutorialCapturePlaced",
    setup: "capture-script",
  },
  {
    unitType: "soldier",
    owner: "white",
    row: 0,
    col: 2,
    message: "tutorialWallDefense",
    placedMessage: "tutorialWallDefensePlaced",
    setup: "own-wall-script",
  },
  {
    unitType: "soldier",
    owner: "white",
    row: 8,
    col: 2,
    message: "tutorialWallCapture",
    placedMessage: "tutorialWallCapturePlaced",
    setup: "enemy-wall-script",
  },
  {
    unitType: "general",
    owner: "white",
    row: 2,
    col: 5,
    message: "tutorialGeneral",
    placedMessage: "tutorialGeneralPlaced",
    setup: "general-continuation",
    reactionRow: 3,
    reactionCol: 5,
    requiresUnitSelection: true,
    reaction: true,
  },
  {
    unitType: "diplomat",
    owner: "white",
    row: 0,
    col: 3,
    message: "tutorialDiplomat",
    placedMessage: "tutorialDiplomatPlaced",
    setup: "diplomat-continuation",
    reactionRow: 1,
    reactionCol: 2,
    requiresUnitSelection: true,
    reaction: true,
  },
  {
    unitType: "wizard",
    owner: "white",
    row: 4,
    col: 6,
    message: "tutorialWizard",
    placedMessage: "tutorialWizardPlaced",
    setup: "wizard-continuation",
    reactionRow: 4,
    reactionCol: 7,
    teleportRow: 1,
    teleportCol: 5,
    requiresUnitSelection: true,
    reaction: true,
  },
];

const TUTORIAL_SANCTUARY_ACTIONS = [
  { player: "black", row: 0, col: 4 },
  { player: "white", row: 6, col: 4 },
  { player: "black", row: 1, col: 3 },
  { player: "white", row: 7, col: 3 },
  { player: "black", row: 1, col: 5 },
  { player: "white", row: 7, col: 5 },
  { player: "black", row: 2, col: 4 },
  { player: "white", row: 8, col: 4 },
];

const TUTORIAL_CAPTURE_SETUP_ACTIONS = [
  { player: "black", row: 5, col: 4 },
  { player: "white", row: 5, col: 3 },
  { player: "black", row: 0, col: 1 },
  { player: "white", row: 5, col: 5 },
  { player: "black", row: 8, col: 1 },
];

const TUTORIAL_OWN_WALL_ACTIONS = [
  { player: "black", row: 4, col: 5 },
  { player: "white", row: 0, col: 0 },
  { player: "black", row: 5, col: 6 },
  { player: "white", row: 1, col: 1 },
  { player: "black", row: 6, col: 5 },
];

const TUTORIAL_ENEMY_WALL_ACTIONS = [
  { player: "black", row: 6, col: 3 },
  { player: "white", row: 8, col: 0 },
  { player: "black", row: 8, col: 5 },
  { player: "white", row: 7, col: 1 },
  { player: "black", row: 7, col: 6 },
];

const TUTORIAL_GENERAL_SETUP_ACTIONS = [
  { player: "black", row: 2, col: 6 },
];

const TUTORIAL_DIPLOMAT_SETUP_ACTIONS = [
  { player: "white", row: 2, col: 3 },
  { player: "black", row: 2, col: 4 },
];

const TUTORIAL_WIZARD_SETUP_ACTIONS = [
  { player: "white", row: 3, col: 4 },
  { player: "black", row: 3, col: 6 },
];

const boardEl = document.querySelector("#board");
const fortressFrame = document.querySelector(".fortress-frame");
const gameStatusBar = document.querySelector(".game-status-bar");
const deployDock = document.querySelector(".deploy-dock");
const turnPill = document.querySelector("#turnPill");
const turnTimerBadge = document.querySelector("#turnTimerBadge");
const modeInfo = document.querySelector("#modeInfo");
const connectionInfo = document.querySelector("#connectionInfo");
const connectionInfoText = document.querySelector("#connectionInfoText");
const rankInfo = document.querySelector("#rankInfo");
const blackCount = document.querySelector("#blackCount");
const whiteCount = document.querySelector("#whiteCount");
const cancelTeleportBtn = document.querySelector("#cancelTeleportBtn");
const undoBtn = document.querySelector("#undoBtn");
const resignBtn = document.querySelector("#resignBtn");
const newGameBtn = document.querySelector("#newGameBtn");
const settingsBtn = document.querySelector("#settingsBtn");
const lobbySettingsBtn = document.querySelector("#lobbySettingsBtn");
const networkStatusGroup = document.querySelector("#networkStatusGroup");
const networkStatus = document.querySelector("#networkStatus");
const splashModal = document.querySelector("#splashModal");
const splashLogo = document.querySelector("#splashLogo");
const splashTitle = document.querySelector("#splashTitle");
const splashSubtitle = document.querySelector("#splashSubtitle");
const splashStatus = document.querySelector("#splashStatus");
const lobbyLogo = document.querySelector("#lobbyLogo");
const lobbyBrandMain = document.querySelector("#lobbyBrandMain");
const lobbyBrandSubtitle = document.querySelector("#lobbyBrandSubtitle");
const modeModal = document.querySelector("#modeModal");
const challengeModal = document.querySelector("#challengeModal");
const challengeRankList = document.querySelector("#challengeRankList");
const closeChallengeBtn = document.querySelector("#closeChallengeBtn");
const pveSideModal = document.querySelector("#pveSideModal");
const cancelPveSideBtn = document.querySelector("#cancelPveSideBtn");
const pveRankList = document.querySelector("#pveRankList");
const pveDifficultyButtons = document.querySelectorAll("[data-pve-difficulty]");
const pveTimerButtons = document.querySelectorAll("[data-pve-timer]");
const networkModal = document.querySelector("#networkModal");
const networkLobbyStatus = document.querySelector("#networkLobbyStatus");
const publicRoomList = document.querySelector("#publicRoomList");
const publicRoomItems = document.querySelector("#publicRoomItems");
const refreshRoomListBtn = document.querySelector("#refreshRoomListBtn");
const networkRoomControls = document.querySelector("#networkRoomControls");
const networkRpsPicker = document.querySelector("#networkRpsPicker");
const rpsButtons = document.querySelectorAll("[data-rps]");
const pveRpsStatus = document.querySelector("#pveRpsStatus");
const pveRpsButtonsContainer = document.querySelector("#pveRpsButtons");
const pveRpsButtons = Array.from(rpsButtons, (sourceButton) => {
  const button = sourceButton.cloneNode(true);
  button.dataset.pveRps = sourceButton.dataset.rps;
  button.removeAttribute("data-rps");
  pveRpsButtonsContainer?.appendChild(button);
  return button;
});
const createRoomBtn = document.querySelector("#createRoomBtn");
const cancelNetworkBtn = document.querySelector("#cancelNetworkBtn");
const resultModal = document.querySelector("#resultModal");
const playAgainBtn = document.querySelector("#playAgainBtn");
const matchDetailsBtn = document.querySelector("#matchDetailsBtn");
const closeMatchDetailsBtn = document.querySelector("#closeMatchDetailsBtn");
const resultRematchNotice = document.querySelector("#resultRematchNotice");
const resultDownloadJournalBtn = document.querySelector("#resultDownloadJournalBtn");
const rematchToast = document.querySelector("#rematchToast");
const rematchToastTitle = document.querySelector("#rematchToastTitle");
const toastAcceptRematchBtn = document.querySelector("#toastAcceptRematchBtn");
const toastDeclineRematchBtn = document.querySelector("#toastDeclineRematchBtn");
const suicideConfirmModal = document.querySelector("#suicideConfirmModal");
const suicideConfirmTitle = document.querySelector("#suicideConfirmTitle");
const suicideConfirmText = document.querySelector("#suicideConfirmText");
const cancelSuicideBtn = document.querySelector("#cancelSuicideBtn");
const confirmSuicideBtn = document.querySelector("#confirmSuicideBtn");
const resignConfirmModal = document.querySelector("#resignConfirmModal");
const cancelResignBtn = document.querySelector("#cancelResignBtn");
const confirmResignBtn = document.querySelector("#confirmResignBtn");
const passNotificationModal = document.querySelector("#passNotificationModal");
const passNoticeTitle = document.querySelector("#passNoticeTitle");
const passNoticeText = document.querySelector("#passNoticeText");
const confirmPassNoticeBtn = document.querySelector("#confirmPassNoticeBtn");
const settingsModal = document.querySelector("#settingsModal");
const settingsStatus = document.querySelector("#settingsStatus");
const deleteAccountBtn = document.querySelector("#deleteAccountBtn");
const deleteAccountModal = document.querySelector("#deleteAccountModal");
const deleteAccountStatus = document.querySelector("#deleteAccountStatus");
const cancelDeleteAccountBtn = document.querySelector("#cancelDeleteAccountBtn");
const confirmDeleteAccountBtn = document.querySelector("#confirmDeleteAccountBtn");
const downloadJournalBtn = document.querySelector("#downloadJournalBtn");
const closeSettingsBtn = document.querySelector("#closeSettingsBtn");
const languageSelect = document.querySelector("#languageSelect");
const specialCharacterToggle = document.querySelector("#specialCharacterToggle");
const musicToggle = document.querySelector("#musicToggle");
const sfxToggle = document.querySelector("#sfxToggle");

downloadJournalBtn?.toggleAttribute("hidden", !DEVELOPER_MODE);
resultDownloadJournalBtn?.toggleAttribute("hidden", !DEVELOPER_MODE);
const tutorialPanel = document.querySelector("#tutorialPanel");
const tutorialStepLabel = document.querySelector("#tutorialStepLabel");
const tutorialMessage = document.querySelector("#tutorialMessage");
const matchResultSummary = document.querySelector("#matchResultSummary");
const matchResultOutcome = document.querySelector("#matchResultOutcome");
const matchResultHeadline = document.querySelector("#matchResultHeadline");
const matchResultReason = document.querySelector("#matchResultReason");
const matchResultActions = document.querySelector("#matchResultActions");
const matchResultMeta = document.querySelector("#matchResultMeta");
const resultBlackUnits = document.querySelector("#resultBlackUnits");
const resultWhiteUnits = document.querySelector("#resultWhiteUnits");
const resultFinishMethod = document.querySelector("#resultFinishMethod");
const resultTotalDeployments = document.querySelector("#resultTotalDeployments");
const resultBlackCaptures = document.querySelector("#resultBlackCaptures");
const resultWhiteCaptures = document.querySelector("#resultWhiteCaptures");
const startTutorialBtn = document.querySelector("#startTutorialBtn");
const tutorialLobbyBtn = document.querySelector("#tutorialLobbyBtn");
const exitTutorialBtn = document.querySelector("#exitTutorialBtn");
const nextTutorialBtn = document.querySelector("#nextTutorialBtn");
const modeStartButtons = document.querySelectorAll("[data-start-mode]");
const modeInputs = document.querySelectorAll("input[name='mode']");
const unitInputs = document.querySelectorAll("input[name='unit']");

function sideName(side) {
  return text(side);
}

function visiblePveRanks() {
  const unresolved = firstUnresolvedRankIndex();
  const startIndex = Math.max(0, Math.min(unresolved, RANK_ORDER.length - 4));
  return RANK_ORDER.slice(startIndex, startIndex + 4);
}

function markPuzzleComplete(index) {
  persistPuzzleComplete(index);
  renderProgressionUi();
}

function renderChallengeRanks() {
  challengeRankList.innerHTML = "";
  CHALLENGE_DISPLAY_RANKS.forEach((rankKey, rankIndex) => {
    const rankPuzzles = PUZZLES.filter((puzzle) => puzzle.rank === rankKey);
    const hasPuzzle = rankPuzzles.length > 0;
    const completedCount = rankPuzzles.filter((puzzle) => challengeProgress.completedPuzzleIds.includes(puzzle.id)).length;
    const totalCount = rankPuzzles.length;
    const complete = hasPuzzle && completedCount === totalCount;

    const prevRankKey = rankIndex > 0 ? CHALLENGE_DISPLAY_RANKS[rankIndex - 1] : null;
    const prevRankPuzzles = prevRankKey ? PUZZLES.filter((p) => p.rank === prevRankKey) : [];
    const prevRankComplete = !prevRankKey || (prevRankPuzzles.length > 0 && prevRankPuzzles.every((p) => challengeProgress.completedPuzzleIds.includes(p.id)));
    const unlocked = hasPuzzle && prevRankComplete;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "challenge-rank-button";
    button.disabled = !unlocked;
    button.classList.toggle("complete", complete);
    button.classList.toggle("locked", hasPuzzle && !unlocked);
    button.classList.toggle("coming-soon", !hasPuzzle);

    const label = document.createElement("strong");
    label.textContent = CHALLENGE_RANK_LABELS[LANGUAGE][rankKey] || RANK_LABELS[LANGUAGE][rankKey] || rankKey;
    const status = document.createElement("small");
    status.className = "challenge-rank-status";
    if (!hasPuzzle) {
      status.textContent = text("comingSoon");
    } else if (complete) {
      const icon = createRankStatusIcon("complete");
      const statusLabel = text("rankComplete");
      icon.setAttribute("aria-label", statusLabel);
      icon.setAttribute("title", statusLabel);
      status.append(icon);
    } else if (!unlocked) {
      const icon = createRankStatusIcon("locked");
      const statusLabel = text("rankLocked");
      icon.setAttribute("aria-label", statusLabel);
      icon.setAttribute("title", statusLabel);
      status.append(icon);
    } else {
      status.textContent = rankKey === "thirdRateMaster" ? text("rankReady") : `${completedCount} / ${totalCount}`;
    }
    button.append(label, status);
    if (unlocked) {
      button.addEventListener("click", () => {
        const targetPuzzle = rankPuzzles.find((p) => !challengeProgress.completedPuzzleIds.includes(p.id)) || rankPuzzles[0];
        const targetIndex = PUZZLES.indexOf(targetPuzzle);
        loadPuzzle(targetIndex >= 0 ? targetIndex : 0);
      });
    }
    challengeRankList.append(button);
  });

  if (!challengeModal.hidden) requestAnimationFrame(scrollChallengeToFirstUnresolved);
}

function scrollChallengeToFirstUnresolved() {
  const firstUnresolved = challengeRankList.querySelector(".challenge-rank-button:not(.complete):not([disabled])")
    || challengeRankList.querySelector(".challenge-rank-button:not(.complete)");
  challengeRankList.scrollTop = firstUnresolved
    ? Math.max(0, firstUnresolved.offsetTop - challengeRankList.offsetTop)
    : 0;
}

function createRankStatusIcon(type) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.classList.add("challenge-status-icon", type);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", type === "complete"
    ? "m5 12 4 4L19 6"
    : "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z");
  svg.append(path);
  return svg;
}

function renderProgressionUi() {
  const modesUnlocked = arePrimaryModesUnlocked();
  for (const mode of ["pve", "pvp"]) {
    const button = document.querySelector(`[data-start-mode="${mode}"]`);
    if (!button) continue;
    button.disabled = !modesUnlocked;
    button.classList.toggle("locked", !modesUnlocked);
    button.querySelector(".mode-lock-icon")?.remove();
    if (modesUnlocked) {
      button.removeAttribute("aria-label");
      continue;
    }
    const lockIcon = createRankStatusIcon("locked");
    lockIcon.classList.add("mode-lock-icon");
    lockIcon.setAttribute("aria-hidden", "true");
    button.append(lockIcon);
    const modeLabel = button.querySelector("strong")?.textContent || "";
    button.setAttribute("aria-label", `${modeLabel}. ${text("modeLocked")}`);
  }
  renderChallengeRanks();
  renderPveRankOptions();
}

function openChallengeSelection() {
  renderChallengeRanks();
  modeModal.hidden = true;
  challengeModal.hidden = false;
  requestAnimationFrame(scrollChallengeToFirstUnresolved);
}

function returnToChallengeSelection() {
  startNewGame();
  openChallengeSelection();
}

function currentModeLabel() {
  if (state.mode === "pve") return text("pveMode");
  if (state.mode === "pvp") return text("onlinePvp");
  if (state.mode === "tutorial") return text("tutorial");
  if (state.mode === "puzzle") return text("puzzle");
  return text("chooseMode");
}

function currentRankLabel() {
  if (state.mode === "pve" && state.aiRank) {
    return AI_RANK_LABELS[LANGUAGE][state.aiRank] || RANK_LABELS[LANGUAGE][state.aiRank] || state.aiRank;
  }
  const rankKey = activePuzzle?.rank || "thirdRateMaster";
  const rankName = CHALLENGE_RANK_LABELS[LANGUAGE][rankKey] || RANK_LABELS[LANGUAGE][rankKey] || RANK_LABELS.ko.thirdRateMaster;
  if (state.mode === "puzzle" && activePuzzle && activePuzzle.type !== "tutorial") {
    const rankPuzzles = PUZZLES.filter((p) => p.rank === rankKey);
    const puzzleNumInRank = rankPuzzles.indexOf(activePuzzle) + 1;
    if (puzzleNumInRank > 0 && rankPuzzles.length > 1) {
      return `${rankName} (${puzzleNumInRank}/${rankPuzzles.length})`;
    }
  }
  return rankName;
}

function currentConnectionLabel() {
  if (state.mode !== "pvp") return "";
  return networkSession.ready
    ? (LANGUAGE === "ko" ? "상대 연결" : "Connected")
    : (LANGUAGE === "ko" ? "연결 끊김" : "Disconnected");
}

function syncSettingsControls() {
  document.querySelector("#languageCurrent").textContent = LANGUAGE === "ko" ? "한국어" : "English";
  languageSelect.querySelectorAll("input").forEach((input) => {
    input.checked = input.value === LANGUAGE;
  });
  specialCharacterToggle.checked = isSpecialCharacterEnabled();
  musicToggle.checked = isMusicEnabled();
  sfxToggle.checked = isSfxEnabled();
}

function setIconButtonLabel(button, key) {
  const label = text(key);
  button.setAttribute("aria-label", label);
  button.title = label;
}

function applyLanguage() {
  document.documentElement.lang = LANGUAGE;
  document.title = text("appTitle");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = text(element.dataset.i18n);
  });
  document.querySelectorAll(".unit-picker label").forEach((label) => {
    const input = label.querySelector("input");
    label.querySelector("span").textContent = UNIT_LABELS[input.value];
  });
  document.querySelector("#languageCurrent").textContent = LANGUAGE === "ko" ? "한국어" : "English";
  languageSelect.querySelectorAll("input").forEach((input) => {
    input.checked = input.value === LANGUAGE;
  });
  undoBtn.textContent = text("undo");
  undoBtn.setAttribute("aria-label", text("undo"));
  undoBtn.title = text("undo");
  if (resignBtn) {
    resignBtn.setAttribute("aria-label", text("resign"));
    resignBtn.title = text("resign");
  }
  newGameBtn.setAttribute("aria-label", text("home"));
  newGameBtn.title = text("home");
  const newGameLabel = newGameBtn.querySelector("span");
  if (newGameLabel) newGameLabel.textContent = text("home");
  settingsBtn.setAttribute("aria-label", text("settings"));
  settingsBtn.title = text("settings");
  const settingsLabel = settingsBtn.querySelector("span");
  if (settingsLabel) settingsLabel.textContent = text("settings");
  lobbySettingsBtn.setAttribute("aria-label", text("settings"));
  lobbySettingsBtn.title = text("settings");
  const logoLanguage = LANGUAGE === "ko" ? "ko" : "en";
  splashLogo.src = `./assets/ui/daeguk-logo-${logoLanguage}.svg?v=${ASSET_VERSION}`;
  lobbyLogo.src = `./assets/ui/daeguk-logo-lobby.svg?v=${ASSET_VERSION}`;
  lobbyLogo.alt = "DAEGUK";
  splashLogo.alt = text("appTitle");
  splashTitle.textContent = text("brandMain");
  splashSubtitle.textContent = text("brandSubtitle");
  splashSubtitle.classList.toggle("korean-title", LANGUAGE === "ko");
  lobbyBrandMain.textContent = text("brandMain");
  lobbyBrandSubtitle.textContent = text("brandSubtitle");
  lobbyBrandSubtitle.classList.toggle("korean-title", LANGUAGE === "ko");
  cancelTeleportBtn.textContent = text("cancelAbility");
  setIconButtonLabel(nextTutorialBtn, "nextTutorial");
  setIconButtonLabel(exitTutorialBtn, "backToChallenges");
  document.querySelector(".black-counter").setAttribute("aria-label", text("blackUnits"));
  document.querySelector(".white-counter").setAttribute("aria-label", text("whiteUnits"));
  if (rematchToastTitle) rematchToastTitle.textContent = text("rematchOfferedToast");
  if (toastAcceptRematchBtn) toastAcceptRematchBtn.textContent = text("acceptRematch");
  if (toastDeclineRematchBtn) toastDeclineRematchBtn.textContent = text("declineRematch");
  updatePveRpsButtonLabels();
  syncSettingsControls();
  renderOpenRooms();
}

function showRematchToast() {
  if (!rematchToast) return;
  if (rematchToastTitle) rematchToastTitle.textContent = text("rematchOfferedToast");
  if (toastAcceptRematchBtn) toastAcceptRematchBtn.textContent = text("acceptRematch");
  if (toastDeclineRematchBtn) toastDeclineRematchBtn.textContent = text("declineRematch");
  rematchToast.hidden = false;
}

function hideRematchToast() {
  if (!rematchToast) return;
  rematchToast.hidden = true;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function checkGameServer() {
  return new Promise((resolve) => {
    let settled = false;
    let socket = null;
    const finish = (available) => {
      if (settled) return;
      settled = true;
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
      resolve(available);
    };
    const timer = window.setTimeout(() => finish(false), SPLASH_SERVER_TIMEOUT_MS);
    try {
      socket = new WebSocket(buildNetworkUrl(location, NETWORK_SERVER));
      socket.addEventListener("open", () => {
        window.clearTimeout(timer);
        finish(true);
      });
      socket.addEventListener("error", () => {
        window.clearTimeout(timer);
        finish(false);
      });
    } catch {
      window.clearTimeout(timer);
      finish(false);
    }
  });
}

async function enterLobbyAfterSplash(showingDemo) {
  if (showingDemo) {
    splashModal.hidden = true;
    return;
  }
  modeModal.hidden = true;
  const [serverAvailable] = await Promise.all([
    checkGameServer(),
    wait(SPLASH_MIN_DURATION_MS),
  ]);
  splashStatus.textContent = text(serverAvailable ? "splashReady" : "splashOffline");
  await wait(250);
  splashModal.hidden = true;
  modeModal.hidden = false;
}

function isGameActive() {
  if (splashModal && !splashModal.hidden) return false;
  if (modeModal && !modeModal.hidden) return false;
  if (pveSideModal && !pveSideModal.hidden) return false;
  if (networkModal && !networkModal.hidden) return false;
  if (challengeModal && !challengeModal.hidden) return false;
  return true;
}

function newState() {
  const nextState = createInitialState(currentModeChoice(), pveHumanPlayer);
  if (nextState.mode === "pve") {
    nextState.aiDifficulty = pveDifficulty;
    nextState.aiRank = selectedPveRank;
    nextState.pveTimerEnabled = activePveTimerEnabled;
  }
  return nextState;
}

function renderPveRankOptions() {
  const container = pveRankList || document.querySelector(".difficulty-choice-actions");
  if (!container) return;
  const rankKeys = AI_RANK_ORDER;
  if (!selectedPveRank || !rankKeys.includes(selectedPveRank)) selectedPveRank = rankKeys[0];

  container.innerHTML = "";
  rankKeys.forEach((rankKey) => {
    const unlocked = isAiRankUnlocked(rankKey);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "challenge-rank-button";
    button.dataset.pveRank = rankKey;
    button.dataset.pveDifficulty = rankKey;
    const labelText = AI_RANK_LABELS[LANGUAGE][rankKey] || RANK_LABELS[LANGUAGE][rankKey] || rankKey;
    const label = document.createElement("span");
    label.className = "pve-rank-label";
    label.textContent = labelText;
    button.append(label);
    button.disabled = !unlocked;
    button.classList.toggle("locked", !unlocked);
    if (!unlocked) {
      const status = document.createElement("span");
      status.className = "challenge-rank-status";
      const lockIcon = createRankStatusIcon("locked");
      lockIcon.setAttribute("aria-hidden", "true");
      status.append(lockIcon);
      button.append(status);
      button.setAttribute("aria-label", `${labelText}. ${text("rankLocked")}`);
    } else {
      button.addEventListener("click", () => applyPveRank(rankKey));
    }
    container.appendChild(button);
  });
  applyPveRank(selectedPveRank);
  requestAnimationFrame(() => {
    const selectedBtn = container.querySelector(`[data-pve-rank="${selectedPveRank}"]`);
    if (selectedBtn) {
      container.scrollTop = Math.max(0, selectedBtn.offsetTop - container.offsetTop);
    }
    updatePveRankScrollCues(container);
  });
}

function updatePveRankScrollCues(container = pveRankList) {
  const frame = container?.closest(".ai-rank-frame");
  if (!container || !frame) return;
  frame.classList.toggle("can-scroll-up", container.scrollTop > 1);
  frame.classList.toggle(
    "can-scroll-down",
    container.scrollTop + container.clientHeight < container.scrollHeight - 1,
  );
}

function applyPveRank(rankKey) {
  if (!isAiRankUnlocked(rankKey)) return false;
  selectedPveRank = rankKey || AI_RANK_ORDER[0];
  pveDifficulty = selectedPveRank;
  const container = pveRankList || document.querySelector(".difficulty-choice-actions");
  if (container) {
    const buttons = container.querySelectorAll("[data-pve-rank]");
    buttons.forEach((button) => {
      const selected = button.dataset.pveRank === selectedPveRank;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }
  if (state?.mode === "pve") {
    state.aiDifficulty = pveDifficulty;
    state.aiRank = selectedPveRank;
  }
  return true;
}

function renderPveTimerOptions() {
  pveTimerButtons.forEach((button) => {
    const selected = (button.dataset.pveTimer === "on") === pveTimerEnabled;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function applyPveTimerSetting(enabled) {
  pveTimerEnabled = Boolean(enabled);
  setPveTimerEnabled(pveTimerEnabled);
  renderPveTimerOptions();
}

function applyNoMoveDemo() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return false;
  if (new URLSearchParams(location.search).get("demo") !== "no-move") return false;

  state.board = Array.from({ length: SIZE }, (_, row) =>
    Array.from({ length: SIZE }, (_, col) => {
      if (row === 4 && col === 4) return null;
      return createOccupiedSoldier("black");
    }),
  );
  state.board[8][4] = createPiece("white", "king");
  state.turn = "white";
  state.firstDeployDone = { black: true, white: true };
  state.stock.white = { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.stock.black = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.log = ["No-move demo: White has no legal deployment, but the board is not full."];
  return true;
}

function applyWizardTeleportDemo() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return false;
  if (new URLSearchParams(location.search).get("demo") !== "wizard-teleport") return false;

  selectModeChoice("pve");
  pveHumanPlayer = "white";
  pveAiPlayer = "black";
  state = createInitialState("pve", pveHumanPlayer);
  state.aiDifficulty = pveDifficulty;
  state.aiRank = selectedPveRank;
  state.board[4][4] = createPiece("white", "soldier");
  state.board[4][4].originalType = "wizard";
  state.board[4][4].abilityUsed = true;
  state.board[4][4].revealed = true;
  state.board[3][4] = createOccupiedSoldier("black");
  state.board[4][3] = createOccupiedSoldier("black");
  state.board[4][5] = createOccupiedSoldier("black");
  state.teleporting = { row: 4, col: 4, owner: "white", reaction: true };
  state.turn = "white";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.stock.white = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.stock.black = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.log = ["Wizard move demo: choose an empty cell or stay in place."];
  modeModal.hidden = true;
  pveSideModal.hidden = true;
  return true;
}

function applySpecialPendingDemo() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return false;
  const params = new URLSearchParams(location.search);
  if (params.get("demo") !== "special-pending") return false;
  // ?owner=ai surrounds the AI's own special instead of the player's.
  const specialOwner = params.get("owner") === "ai" ? "black" : "white";
  const surroundingSide = specialOwner === "white" ? "black" : "white";

  selectModeChoice("pve");
  pveHumanPlayer = "white";
  pveAiPlayer = "black";
  state = createInitialState("pve", pveHumanPlayer);
  state.aiDifficulty = pveDifficulty;
  state.aiRank = selectedPveRank;
  state.board[4][4] = createPiece(specialOwner, "general");
  state.board[4][4].revealed = true;
  state.board[3][4] = createOccupiedSoldier(surroundingSide);
  state.board[5][4] = createOccupiedSoldier(surroundingSide);
  state.board[4][3] = createOccupiedSoldier(surroundingSide);
  state.board[4][5] = createOccupiedSoldier(surroundingSide);
  // Reserves off the strike zone so the demo does not end by elimination.
  state.board[0][0] = createOccupiedSoldier("black");
  state.board[8][8] = createOccupiedSoldier("white");
  state.pendingSpecial = { row: 4, col: 4, owner: specialOwner, type: "general", captor: surroundingSide };
  state.resumeTurn = surroundingSide;
  state.turn = specialOwner;
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.stock.white = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.stock.black = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.log = ["Special activation demo: the surrounded General activates on its own."];
  modeModal.hidden = true;
  pveSideModal.hidden = true;
  return true;
}

function applySuicideWarningDemo() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return false;
  if (new URLSearchParams(location.search).get("demo") !== "suicide-warning") return false;

  selectModeChoice("pve");
  pveHumanPlayer = "white";
  pveAiPlayer = "black";
  state = createInitialState("pve", pveHumanPlayer);
  state.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  state.board[8][0] = createPiece("white", "king");
  state.board[3][4] = createOccupiedSoldier("black");
  state.board[5][4] = createOccupiedSoldier("black");
  state.board[4][3] = createOccupiedSoldier("black");
  state.board[4][5] = createOccupiedSoldier("black");
  state.turn = "white";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.stock.white = { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.stock.black = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.log = ["Suicide warning demo: place the White Soldier at E5."];
  modeModal.hidden = true;
  pveSideModal.hidden = true;
  return true;
}

function applyCapture38Demo() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return false;
  if (new URLSearchParams(location.search).get("demo") !== "capture-38") return false;

  selectModeChoice("pve");
  pveHumanPlayer = "black";
  pveAiPlayer = "white";
  state = createInitialState("pve", pveHumanPlayer);
  state.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const pieces = [
    ["white", "soldier", 0, 4], ["white", "soldier", 0, 5], ["white", "soldier", 0, 6],
    ["black", "soldier", 0, 7], ["white", "soldier", 1, 3], ["black", "soldier", 1, 4],
    ["white", "soldier", 1, 5], ["black", "soldier", 1, 6], ["white", "soldier", 1, 7],
    ["black", "soldier", 2, 2], ["white", "soldier", 2, 3], ["black", "soldier", 2, 4],
    ["black", "soldier", 2, 5], ["black", "soldier", 2, 6], ["white", "soldier", 2, 7],
    ["white", "soldier", 3, 3], ["black", "soldier", 3, 4], ["black", "soldier", 3, 5],
    ["black", "soldier", 3, 6], ["white", "soldier", 3, 7], ["white", "general", 4, 3],
    ["black", "king", 4, 4], ["white", "wizard", 4, 5], ["black", "soldier", 5, 2],
    ["black", "soldier", 5, 3], ["white", "soldier", 5, 4], ["black", "soldier", 6, 2],
    ["white", "soldier", 6, 3], ["white", "soldier", 6, 4], ["white", "soldier", 6, 5],
    ["black", "soldier", 7, 1], ["black", "soldier", 7, 2], ["white", "soldier", 7, 3],
    ["white", "king", 7, 4], ["black", "soldier", 7, 5], ["black", "soldier", 7, 6],
    ["white", "soldier", 8, 3], ["black", "soldier", 8, 4],
  ];
  for (const [owner, type, row, col] of pieces) state.board[row][col] = createPiece(owner, type);
  state.turn = "black";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 19, white: 19 };
  state.stock.black = { soldier: 61, king: 0, general: 0, diplomat: 1, wizard: 1 };
  state.stock.white = { soldier: 61, king: 0, general: 0, diplomat: 1, wizard: 0 };
  state.log = [LANGUAGE === "ko"
    ? "39번째 액션 직전: D1은 E1·F1·G1·F2 백돌 무리의 유일한 활로입니다. D1에 흑 병사를 놓아보세요."
    : "Before action 39: D1 is the only liberty of the White group at E1, F1, G1, and F2. Place a Black Soldier at D1."];
  modeModal.hidden = true;
  pveSideModal.hidden = true;
  return true;
}

function applyMatchResultDemo() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return false;
  const demoName = new URLSearchParams(location.search).get("demo");
  if (demoName !== "match-result" && demoName !== "match-result-online") return false;
  const onlineDemo = demoName === "match-result-online";

  selectModeChoice(onlineDemo ? "pvp" : "pve");
  pveHumanPlayer = "white";
  pveAiPlayer = "black";
  state = createInitialState(onlineDemo ? "pvp" : "pve", pveHumanPlayer);
  state.aiRank = selectedPveRank;
  state.board[4][4] = createPiece("black", "king");
  state.board[5][4] = createOccupiedSoldier("black");
  state.board[6][4] = createOccupiedSoldier("white");
  state.capturedKing = {
    pieceId: "demo-captured-white-king",
    owner: "white",
    row: 5,
    col: 4,
  };
  state.deploymentCount = { black: 19, white: 19 };
  state.stats.captures = { black: 7, white: 4 };
  state.stats.specialsUsed = { black: 2, white: 1 };
  state.aiRank = selectedPveRank || "novice";
  state.winner = "black";
  state.resultReason = "white King was captured.";
  if (onlineDemo) {
    networkSession.player = "white";
    networkSession.ready = true;
  }
  modeModal.hidden = true;
  pveSideModal.hidden = true;
  return true;
}

function applyLocalDemo() {
  return applyCapture38Demo() || applyMatchResultDemo() || applyNoMoveDemo() || applyWizardTeleportDemo() || applySpecialPendingDemo() || applySuicideWarningDemo();
}

function currentUnitChoice() {
  return document.querySelector("input[name='unit']:checked").value;
}

function currentModeChoice() {
  return document.querySelector("input[name='mode']:checked")?.value || "pve";
}

function selectModeChoice(mode) {
  const input = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (input) input.checked = true;
}

function isAiTurn() {
  return state.mode === "pve" && state.turn === pveAiPlayer && !state.winner;
}

function canDeploy(player, unitType, row, col, options = {}) {
  if (state.mode === "pvp") return false;
  if (state.mode === "tutorial") {
    if (tutorialIntro) return false;
    const expected = TUTORIAL_STEPS[tutorialStep];
    return Boolean(expected)
      && !tutorialAwaitingContinue
      && !tutorialScriptRunning
      && !(options.forHint && expected.hideHint)
      && player === expected.owner
      && unitType === expected.unitType
      && row === expected.row
      && col === expected.col
      && !state.board[row][col];
  }
  if (state.mode === "puzzle") {
    return !state.winner
      && !state.teleporting
      && !state.pendingSpecial
      && player === state.turn
      && inBounds(row, col)
      && !state.board[row][col]
      && state.stock[player][unitType] > 0;
  }
  return engineCanDeploy(state, player, unitType, row, col);
}

function activeKingZones() {
  if (tutorialIntro) return [];
  return engineActiveKingZones(state);
}

function countPieces(owner) {
  return engineCountPieces(state, owner);
}

function findKingPosition(owner) {
  return engineFindKingPosition(state, owner);
}

function saveUndoCheckpoint() {
  if (state.mode === "pve" && state.turn === pveAiPlayer) return;
  undoStack.push({
    state: structuredClone(state),
    unitChoice: currentUnitChoice(),
    puzzleIndex,
    puzzleMoves,
    puzzleCompleted,
    pveJournalActionCount: pveJournalRecorder?.actionCount() ?? null,
  });
  undoStack = undoStack.slice(-200);
}

function undoLastMove() {
  if (state.mode === "pvp") return;
  const checkpoint = undoStack.pop();
  if (!checkpoint) return;

  if (aiTimer !== null) {
    window.clearTimeout(aiTimer);
    aiTimer = null;
  }

  state = checkpoint.state;
  if (state.mode === "pve" && pveJournalRecorder && checkpoint.pveJournalActionCount !== null) {
    pveJournalRecorder.restore(checkpoint.pveJournalActionCount);
    persistPveJournal();
  }
  state.aiThinking = false;
  if (state.mode === "puzzle") {
    puzzleIndex = checkpoint.puzzleIndex ?? puzzleIndex;
    activePuzzle = PUZZLES[puzzleIndex] || activePuzzle;
    puzzleMoves = checkpoint.puzzleMoves ?? puzzleMoves;
    puzzleCompleted = checkpoint.puzzleCompleted ?? false;
  }
  const unitInput = document.querySelector(`input[name="unit"][value="${checkpoint.unitChoice}"]`);
  if (unitInput) unitInput.checked = true;
  addLog("Last move was undone.");
  render();
}

function openSuicideConfirmation(confirmation) {
  pendingSuicideConfirmation = structuredClone(confirmation);
  // A special dropped into an enclosed point does not die — it fires and clears its
  // neighbours — so the plain suicide wording would be false. Swapping the i18n keys keeps
  // the copy correct through a later language change too, since applyLanguage re-reads them.
  const enclosedSpecial = confirmation.kind === "special_detonation";
  suicideConfirmTitle.dataset.i18n = enclosedSpecial ? "enclosedSpecialTitle" : "suicideWarningTitle";
  suicideConfirmText.dataset.i18n = enclosedSpecial ? "enclosedSpecialWarning" : "suicideWarning";
  suicideConfirmTitle.textContent = text(suicideConfirmTitle.dataset.i18n);
  suicideConfirmText.textContent = text(suicideConfirmText.dataset.i18n);
  suicideConfirmReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  suicideConfirmModal.hidden = false;
  window.requestAnimationFrame(() => confirmSuicideBtn.focus());
}

function closeSuicideConfirmation({ restoreFocus = true } = {}) {
  const returnFocus = suicideConfirmReturnFocus;
  pendingSuicideConfirmation = null;
  suicideConfirmReturnFocus = null;
  suicideConfirmModal.hidden = true;
  if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
}

function deploy(row, col, options = {}) {
  const player = state.turn;
  const unitType = options.unitType || currentUnitChoice();
  if (options.player && options.player !== player) return;
  if (!canDeploy(player, unitType, row, col)) {
    let reason = "";
    if (unitType === "king" && isOpponentKingSanctuaryOverlap(player, row, col)) {
      reason = text("kingOverlapBlocked") || text("kingTerritoryBlocked");
    } else if (isOpponentKingTerritory(player, row, col)) {
      reason = text("kingTerritoryBlocked");
    }
    addLog(reason || `${sideName(player)} cannot deploy ${UNIT_LABELS[unitType]} there.`);
    render();
    return;
  }
  const enclosedKind = classifySharedLocalPlacement(state, player, unitType, row, col);
  if (enclosedKind && !options.confirmedSuicide) {
    openSuicideConfirmation({ source: "local", player, unitType, row, col, kind: enclosedKind });
    return;
  }

  saveUndoCheckpoint();
  const sharedResult = commitSharedLocalAction(player, { type: "deploy", unitType, row, col });
  if (sharedResult === "rejected") {
    addLog(`${sideName(player)} cannot deploy ${UNIT_LABELS[unitType]} there.`);
    render();
    return;
  }
  if (sharedResult !== "accepted") return;
  if (state.mode === "pve") {
    render();
    scheduleAiTurn();
    return;
  }
  if (state.mode === "puzzle") {
    puzzleMoves += 1;
    if (!checkPuzzleResult()) render();
    return;
  }
  if (unitType === "king") tutorialKingPosition = { row, col };
  const expected = TUTORIAL_STEPS[tutorialStep];
  tutorialReactionPending = Boolean(expected?.reaction);
  tutorialAwaitingContinue = true;
  if (tutorialStep === 0) {
    tutorialSanctuaryPhase = "overview";
    render();
    return;
  }
  if (!beginTutorialSpecialReaction()) render();
}

function selectTutorialUnit(unitType) {
  const input = document.querySelector(`input[name="unit"][value="${unitType}"]`);
  if (input) input.checked = true;
}

function clearTutorialScript() {
  if (tutorialScriptTimer !== null) window.clearTimeout(tutorialScriptTimer);
  tutorialScriptTimer = null;
  tutorialScriptRunning = false;
}

function runTutorialScriptedDeployments(actions) {
  clearTutorialScript();
  tutorialScriptRunning = true;
  let actionIndex = 0;

  const deployNext = () => {
    const action = actions[actionIndex];
    if (!action) {
      tutorialScriptTimer = null;
      tutorialScriptRunning = false;
      state.turn = TUTORIAL_STEPS[tutorialStep]?.owner || "white";
      render();
      return;
    }

    state.turn = action.player;
    const result = commitSharedLocalAction(action.player, {
      type: "deploy",
      unitType: "soldier",
      row: action.row,
      col: action.col,
    });
    if (result !== "accepted") {
      tutorialScriptTimer = null;
      tutorialScriptRunning = false;
      addLog(`Tutorial scripted deployment failed at ${coord(action.row, action.col)}.`);
      render();
      return;
    }

    actionIndex += 1;
    render();
    tutorialScriptTimer = window.setTimeout(deployNext, TUTORIAL_SCRIPT_ACTION_DELAY_MS);
  };

  deployNext();
}

function resetTutorialBoard() {
  state.lastMove = null;
  state.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.stock.black = { soldier: 20, king: 1, general: 1, diplomat: 1, wizard: 1 };
  state.stock.white = { soldier: 20, king: 1, general: 1, diplomat: 1, wizard: 1 };
}

function setTutorialSpecialBoard() {
  resetTutorialBoard();
  state.board[3][4] = createOccupiedSoldier("black");
  state.board[5][4] = createOccupiedSoldier("black");
  state.board[4][3] = createOccupiedSoldier("black");
}

function advanceTutorial() {
  tutorialAwaitingContinue = false;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
  tutorialSanctuaryPhase = null;
  tutorialSpecialIntroPhase = null;
  tutorialCompletionPhase = null;
  tutorialStep += 1;
  state.selected = null;
  state.lastMove = null;
  state.winner = null;
  state.resultReason = "";
  const expected = TUTORIAL_STEPS[tutorialStep];
  if (!expected) {
    if (activePuzzle?.type === "tutorial") {
      markPuzzleComplete(puzzleIndex);
      state.winner = "white";
    }
    return;
  }
  if (expected.setup === "special") setTutorialSpecialBoard();
  state.turn = expected.owner;
  if (expected.setup === "general-continuation") {
    tutorialSpecialIntroPhase = "overview";
    tutorialAwaitingContinue = true;
    selectTutorialUnit("soldier");
  } else if (expected.setup === "diplomat-continuation" || expected.setup === "wizard-continuation") {
    tutorialSpecialIntroPhase = "practice";
    selectTutorialUnit("soldier");
  } else {
    selectTutorialUnit(expected.unitType);
  }
  if (expected.setup === "capture-script") {
    runTutorialScriptedDeployments(TUTORIAL_CAPTURE_SETUP_ACTIONS);
  }
  if (expected.setup === "own-wall-script") {
    runTutorialScriptedDeployments(TUTORIAL_OWN_WALL_ACTIONS);
  }
  if (expected.setup === "enemy-wall-script") {
    runTutorialScriptedDeployments(TUTORIAL_ENEMY_WALL_ACTIONS);
  }
  if (expected.setup === "diplomat-continuation") {
    runTutorialScriptedDeployments(TUTORIAL_DIPLOMAT_SETUP_ACTIONS);
  }
  if (expected.setup === "wizard-continuation") {
    runTutorialScriptedDeployments(TUTORIAL_WIZARD_SETUP_ACTIONS);
  }
}

function beginTutorialSpecialReaction() {
  if (!tutorialReactionPending || tutorialReactionPhase) return false;
  tutorialReactionPending = false;
  tutorialReactionPhase = "preparing";
  render();
  tutorialTimer = window.setTimeout(() => {
    state.turn = "black";
    const expected = TUTORIAL_STEPS[tutorialStep];
    const surrounded = commitSharedLocalAction("black", {
      type: "deploy",
      unitType: "soldier",
      row: expected?.reactionRow ?? 4,
      col: expected?.reactionCol ?? 5,
    });
    if (surrounded !== "accepted") {
      tutorialTimer = null;
      tutorialReactionPhase = null;
      addLog("Tutorial reaction could not be prepared.");
      render();
      return;
    }
    tutorialTimer = null;
    tutorialReactionPhase = "surrounded";
    render();
    // scheduleSpecialAutoActivation() fires the ability from here, on the same
    // timer every other mode uses.
  }, TUTORIAL_SPECIAL_SURROUND_DELAY_MS);
  return true;
}

const TUTORIAL_INTRO_PAGE_KEYS = [
  "tutorialIntroPage1",
  "tutorialIntroPage2",
  "tutorialIntroPage4",
];

function getTutorialIntroCutscene(pageIndex) {
  const pageKeys = TUTORIAL_INTRO_PAGE_KEYS;
  const unitType = pageIndex === 0 ? "guide" : "rules";
  return {
    unitType,
    owner: "white",
    persistent: true,
    nameplate: pageIndex === 0 ? text("tutorialGuideName") : "",
    message: text(pageKeys[pageIndex] || "tutorialIntroPage1"),
    introPage: pageIndex,
    totalPages: pageKeys.length,
  };
}

function handleDialogueNext() {
  if (tutorialIntro && tutorialIntroPage < TUTORIAL_INTRO_PAGE_KEYS.length - 1) {
    tutorialIntroPage++;
    tutorialIntroReady = tutorialIntroPage === TUTORIAL_INTRO_PAGE_KEYS.length - 1;
    visibleCutscene = getTutorialIntroCutscene(tutorialIntroPage);
    render();
  }
}

function handleDialoguePrev() {
  if (tutorialIntro && tutorialIntroPage > 0) {
    tutorialIntroPage--;
    tutorialIntroReady = tutorialIntroPage === TUTORIAL_INTRO_PAGE_KEYS.length - 1;
    visibleCutscene = getTutorialIntroCutscene(tutorialIntroPage);
    render();
  }
}

function proceedFromTutorialIntro() {
  if (!tutorialIntro) return;
  if (tutorialIntroTimer !== null) window.clearTimeout(tutorialIntroTimer);
  tutorialIntroTimer = null;
  tutorialIntro = false;
  tutorialIntroPage = 0;
  tutorialIntroReady = false;
  visibleCutscene = null;
  if (tutorialStep === 0) {
    state.board[1][4] = createPiece("black", "king");
    state.firstDeployDone.black = true;
    state.deploymentCount.black = 1;
    state.stock.black.king = 0;
  }
  render();
}

function startTutorial({ puzzleEntry = false, index = 0 } = {}) {
  clearTutorialScript();
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  tutorialTimer = null;
  if (tutorialIntroTimer !== null) window.clearTimeout(tutorialIntroTimer);
  tutorialIntroTimer = null;
  disconnectNetwork();
  networkModal.hidden = true;
  puzzleIndex = index;
  activePuzzle = puzzleEntry ? PUZZLES[puzzleIndex] : null;
  puzzleMoves = 0;
  puzzleCompleted = false;
  undoStack = [];
  state = createInitialState("tutorial");
  state.turn = "white";
  state.stock.white = { soldier: 20, king: 1, general: 1, diplomat: 1, wizard: 1 };
  state.stock.black = { soldier: 20, king: 1, general: 1, diplomat: 1, wizard: 1 };
  tutorialStep = 0;
  tutorialIntro = true;
  tutorialIntroPage = 0;
  tutorialIntroReady = false;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
  tutorialSanctuaryPhase = null;
  tutorialSpecialIntroPhase = null;
  tutorialCompletionPhase = null;
  visibleCutscene = getTutorialIntroCutscene(0);
  selectModeChoice(puzzleEntry ? "puzzle" : "tutorial");
  selectTutorialUnit(TUTORIAL_STEPS[0].unitType);
  modeModal.hidden = true;
  challengeModal.hidden = true;
  render();
}

function selectPuzzleUnit(unitType) {
  const input = document.querySelector(`input[name="unit"][value="${unitType}"]`);
  if (input) input.checked = true;
}

function loadPuzzle(index = 0) {
  disconnectNetwork();
  clearTutorialScript();
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  tutorialTimer = null;
  if (tutorialIntroTimer !== null) window.clearTimeout(tutorialIntroTimer);
  tutorialIntroTimer = null;
  tutorialStep = -1;
  tutorialIntro = false;
  tutorialIntroPage = 0;
  tutorialIntroReady = false;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
  tutorialSanctuaryPhase = null;
  tutorialSpecialIntroPhase = null;
  undoStack = [];
  if (PUZZLES.length === 0) {
    startNewGame();
    return;
  }
  puzzleIndex = Math.max(0, Math.min(PUZZLES.length - 1, index));
  activePuzzle = PUZZLES[puzzleIndex];
  if (activePuzzle.type === "tutorial") {
    startTutorial({ puzzleEntry: true, index: puzzleIndex });
    return;
  }
  puzzleMoves = 0;
  puzzleCompleted = false;
  challengeModal.hidden = true;
  state = createInitialState("puzzle", activePuzzle.player);
  state.turn = activePuzzle.player;
  state.board = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
  state.stock = normalizePuzzleStock(activePuzzle.stock);
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  if (activePuzzle.unit === "king") {
    state.firstDeployDone[activePuzzle.player] = false;
    state.deploymentCount[activePuzzle.player] = 0;
  }
  state.log = [`${localizedPuzzleText(activePuzzle.title)}: ${localizedPuzzleText(activePuzzle.description)}`];
  for (const piece of activePuzzle.pieces || []) {
    if (!isValidPuzzlePiece(piece)) {
      console.warn("Invalid puzzle piece skipped:", activePuzzle.id, piece);
      continue;
    }
    const [owner, type, row, col] = piece;
    if (state.board[row][col]) {
      console.warn("Overlapping puzzle piece skipped:", activePuzzle.id, piece);
      continue;
    }
    state.board[row][col] = createPiece(owner, type);
  }
  puzzleInitialCaptures = structuredClone(state.stats.captures);
  pveHumanPlayer = activePuzzle.player;
  pveAiPlayer = opponent(activePuzzle.player);
  selectModeChoice("puzzle");
  selectPuzzleUnit(activePuzzle.unit);
  pveSideModal.hidden = true;
  networkModal.hidden = true;
  resultModal.hidden = true;
  passNotificationModal.hidden = true;
  modeModal.hidden = true;
  render();
}

function completePuzzle() {
  puzzleCompleted = true;
  markPuzzleComplete(puzzleIndex);
  state.winner = activePuzzle.player;
  state.resultReason = text("puzzleSolvedReason", {
    title: localizedPuzzleText(activePuzzle.title),
    moves: puzzleMoves,
  });
  addLog(state.resultReason);
  render();
  return true;
}

function failPuzzle(reason = text("puzzleFailedReason")) {
  puzzleCompleted = false;
  state.winner = "draw";
  state.resultReason = reason;
  addLog(state.resultReason);
  render();
  return true;
}

function checkPuzzleResult() {
  if (!activePuzzle) return false;
  const objective = activePuzzle.objective;
  if (!objective) return failPuzzle(text("puzzleInvalidReason"));
  let solved = false;
  if (objective.type === "winner") {
    solved = state.winner === objective.winner;
  } else if (objective.type === "cellOwner") {
    solved = state.board[objective.row]?.[objective.col]?.owner === objective.owner;
  } else if (objective.type === "captureAtLeast") {
    solved = state.stats.captures[objective.owner] - puzzleInitialCaptures[objective.owner] >= objective.count;
  } else {
    return failPuzzle(text("puzzleInvalidReason"));
  }

  if (solved) return completePuzzle();

  if (state.winner && state.winner !== activePuzzle.player) return failPuzzle();

  if (puzzleMoves >= activePuzzle.maxMoves && !state.pendingSpecial && !state.teleporting) {
    return failPuzzle();
  }
  return false;
}

function completeTutorialPuzzleIfNeeded() {
  if (state.mode !== "tutorial" || activePuzzle?.type !== "tutorial") return;
  if (tutorialStep < TUTORIAL_STEPS.length || state.winner) return;
  puzzleCompleted = true;
  markPuzzleComplete(puzzleIndex);
  state.winner = "white";
  state.resultReason = text("tutorialPuzzleSolvedReason");
  addLog(state.resultReason);
}

function sendNetworkAction(action) {
  if (!sendNetworkMessage(networkSession, action)) {
    setNetworkStatus(text("notConnected"));
  }
}

function deployUnit(player, unitType, row, col) {
  if (!canDeploy(player, unitType, row, col)) return false;
  return applySharedPveDeployment(player, unitType, row, col) === "accepted";
}

function applySharedPveDeployment(player, unitType, row, col) {
  return applySharedPveAction(player, { type: "deploy", unitType, row, col });
}

function applySharedPveAction(player, action, options = {}) {
  const status = commitSharedLocalAction(player, action, options);
  if (status !== "accepted") return status;

  render();
  scheduleAiTurn();
  return "accepted";
}

function commitSharedLocalAction(player, action, options = {}) {
  const viewer = state.mode === "tutorial" ? "white" : pveHumanPlayer;
  const dispatchOptions = { ...options, advanceTurn: state.mode === "pve" };
  const result = dispatchSharedLocalAction(
    state,
    player,
    action,
    viewer,
    dispatchOptions,
  );
  if (result.status !== "accepted") return result.status;

  if (state.mode === "pve" && pveJournalRecorder) {
    const recorded = pveJournalRecorder.record(player, action, dispatchOptions);
    if (!recorded.accepted) throw new Error(`PvE journal rejected accepted action ${action.type}`);
  }

  state = result.state;
  presentSharedLocalEvents(result.visibleEvents);
  if (state.mode === "pve") {
    if (state.winner === pveHumanPlayer && markAiRankDefeated(state.aiRank || state.aiDifficulty)) {
      renderProgressionUi();
    }
    persistPveJournal();
  }
  return "accepted";
}

function pveJournalOutcome() {
  if (!state?.winner) return null;
  return {
    winner: state.winner,
    reason: state.resultReason || null,
    finalPieces: { black: countPieces("black"), white: countPieces("white") },
  };
}

function currentPveJournalJsonl() {
  const activeJournal = pveJournalRecorder?.jsonl(pveJournalOutcome()) || "";
  if (activeJournal) return activeJournal;
  try {
    const persisted = localStorage.getItem(PVE_JOURNAL_STORAGE_KEY);
    if (persisted) return persisted;
  } catch {}
  try {
    return sessionStorage.getItem(PVE_JOURNAL_STORAGE_KEY) || "";
  } catch {}
  return "";
}

function persistPveJournal() {
  if (!pveJournalRecorder) return;
  const jsonl = currentPveJournalJsonl();
  try {
    localStorage.setItem(PVE_JOURNAL_STORAGE_KEY, jsonl);
    sessionStorage.removeItem(PVE_JOURNAL_STORAGE_KEY);
    return;
  } catch (error) {
    console.warn("Could not persist PvE journal in local storage", error);
  }
  try {
    sessionStorage.setItem(PVE_JOURNAL_STORAGE_KEY, jsonl);
  } catch (error) {
    console.warn("Could not persist PvE journal in session storage", error);
  }
}

function startPveJournal() {
  if (state?.mode !== "pve") {
    pveJournalRecorder = null;
    pveJournalGameId = null;
    return;
  }
  pveJournalGameId = `browser-pve-${Date.now()}`;
  pveJournalRecorder = createPveJournalRecorder(state, {
    gameId: pveJournalGameId,
    source: "browser-pve",
    aiRank: state.aiRank,
    humanPlayer: pveHumanPlayer,
    aiPlayer: pveAiPlayer,
  });
  persistPveJournal();
}

function downloadPveJournal() {
  const jsonl = currentPveJournalJsonl();
  if (!jsonl) return;
  const blobUrl = URL.createObjectURL(new Blob([jsonl], { type: "application/x-ndjson;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${pveJournalGameId || "browser-pve"}.jsonl`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
  settingsStatus.textContent = text("pveJournalDownloaded");
}

window.getDaegukPveJournalJsonl = currentPveJournalJsonl;

function presentSharedLocalEvents(events) {
  const generalActivation = events.find((e) => e.type === "special_activated" && e.unitType === "general");
  if (generalActivation) {
    const removedEvents = events.filter((e) => e.type === "piece_removed" && e.reason === "general_reaction");
    triggerGeneralSkillSequence(generalActivation, removedEvents);
  }
  const diplomatActivation = events.find((e) => e.type === "special_activated" && e.unitType === "diplomat");
  if (diplomatActivation) {
    const convertedEvent = events.find((e) => e.type === "pieces_converted");
    triggerDiplomatSkillSequence(diplomatActivation, convertedEvent?.pieces || []);
  }
  const wizardActivation = events.find((e) => e.type === "special_activated" && e.unitType === "wizard");
  if (wizardActivation) {
    const removedEvents = events.filter((e) => e.type === "piece_removed" && e.reason === "wizard_reaction");
    triggerWizardSkillSequence(wizardActivation, removedEvents);
  }

  for (const event of events) {
    if (event.type === "piece_deployed") {
      pendingDeploymentAnimation = { row: event.row, col: event.col };
      playPlacementSound();
      const unitName = event.player === pveAiPlayer && event.unitType !== "king"
        ? text("hiddenUnit")
        : UNIT_LABELS[event.unitType];
      addLog(`${sideName(event.player)} deployed ${unitName} at ${coord(event.row, event.col)}.`);
    } else if (event.type === "taunt_used") {
      showTauntBubble(event);
    } else if (event.type === "group_captured" && event.pieces.length) {
      addLog(`${sideName(event.captor)} captured ${event.pieces.length} ${sideName(event.defender)} space(s).`);
    } else if (event.type === "special_revealed") {
      addLog(`${sideName(event.owner)} ${UNIT_LABELS[event.unitType]} was surrounded. Ability activation is pending.`);
    } else if (event.type === "special_activated") {
      if (event.unitType !== "general" && event.unitType !== "diplomat" && event.unitType !== "wizard") {
        showSpecialCutscene(event);
      }
      addLog(`${sideName(event.owner)} ${UNIT_LABELS[event.unitType]} ability activated while surrounded.`);
    } else if (event.type === "piece_removed") {
      const ability = event.reason === "general_reaction" ? UNIT_LABELS.general : UNIT_LABELS.wizard;
      addLog(`${sideName(event.owner)} ${UNIT_LABELS[event.unitType]} at ${coord(event.row, event.col)} was removed by ${ability}.`);
    } else if (event.type === "pieces_converted" && event.pieces.length) {
      addLog(`${sideName(event.owner)} ${UNIT_LABELS.diplomat} converted ${event.pieces.length} space(s).`);
    } else if (event.type === "wizard_move_required") {
      addLog(`${sideName(event.owner)} ${UNIT_LABELS.wizard} ability activated. Choose an empty escape cell.`);
    } else if (event.type === "wizard_moved") {
      addLog(`${sideName(event.owner)} ${UNIT_LABELS.wizard} teleported to ${coord(event.row, event.col)}.`);
    } else if (event.type === "wizard_stayed") {
      addLog(`${sideName(event.owner)} ${UNIT_LABELS.wizard} stayed in place.`);
    } else if (event.type === "turn_passed") {
      addLog(`${sideName(event.player)} had no legal deployment.`);
      showPassNotification(event.player, () => {
        render();
        if (state.mode === "pve" && isAiTurn()) {
          scheduleAiTurn();
        }
      });
    } else if (event.type === "match_ended") {
      state.resultReason = sharedMatchResultReason(event);
      const outcome = event.winner === "draw" ? text("draw") : text("wins", { side: sideName(event.winner) });
      addLog(`${outcome}. ${state.resultReason}`);
    }
  }
}

function sharedMatchResultReason(event) {
  if (event.reason === "elimination") return text("allEliminated");
  if (event.reason === "territory") {
    return text(event.trigger === "board_filled" ? "boardFilled" : "noLegalMoves", {
      black: event.black,
      white: event.white,
      bonus: event.secondPlayerBonus,
    });
  }
  if (event.reason === "king_captured") {
    return text("kingCaptured", { side: sideName(event.defeatedPlayer) });
  }
  return state.resultReason;
}

function coord(row, col) {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

function addLog(message) {
  state.log.push(message);
  state.log = state.log.slice(-40);
}

let pendingPassCallback = null;

function showPassNotification(player, onConfirm) {
  if (!passNotificationModal) return;
  pendingPassCallback = onConfirm || null;
  if (passNoticeTitle) passNoticeTitle.textContent = text("passNoticeTitle");
  if (passNoticeText) passNoticeText.textContent = text("noLegalMovesPass", { side: sideName(player) });
  passNotificationModal.hidden = false;
}

function dismissPassNotification() {
  if (!passNotificationModal) return;
  passNotificationModal.hidden = true;
  if (pendingPassCallback) {
    const cb = pendingPassCallback;
    pendingPassCallback = null;
    cb();
  }
}

confirmPassNoticeBtn?.addEventListener("click", () => {
  dismissPassNotification();
});

function triggerGeneralSkillSequence(event, removedEvents = []) {
  if (cutsceneTimer !== null) window.clearTimeout(cutsceneTimer);
  if (skillEffectTimer !== null) window.clearTimeout(skillEffectTimer);
  cutsceneTimer = null;
  skillEffectTimer = null;

  const targets = (removedEvents || []).map((e) => {
    let direction = "north";
    if (e.row < event.row) direction = "north";
    else if (e.row > event.row) direction = "south";
    else if (e.col < event.col) direction = "west";
    else if (e.col > event.col) direction = "east";
    return {
      row: e.row,
      col: e.col,
      owner: e.owner,
      unitType: e.unitType,
      pieceId: e.pieceId,
      revealed: e.revealed,
      direction,
    };
  });

  const showCharacter = isSpecialCharacterEnabled();
  visibleCutscene = showCharacter ? {
    owner: event.owner,
    unitType: "general",
    row: event.row,
    col: event.col,
    durationMs: GENERAL_CUTIN_MS,
  } : null;
  activeSkillEffect = {
    type: "general_strike",
    phase: "cutin",
    source: { row: event.row, col: event.col, owner: event.owner },
    targets,
  };
  render();

  const startSkillEffect = () => {
    cutsceneTimer = null;
    visibleCutscene = null;
    if (activeSkillEffect) {
      activeSkillEffect.phase = "slash";
    }
    render();

    skillEffectTimer = window.setTimeout(() => {
      skillEffectTimer = null;
      activeSkillEffect = null;
      render();
      if (state.mode === "pve" && isAiTurn()) {
        scheduleAiTurn();
      }
    }, GENERAL_SKILL_EFFECT_MS);
  };
  if (showCharacter) cutsceneTimer = window.setTimeout(startSkillEffect, GENERAL_CUTIN_MS);
  else startSkillEffect();
}

function triggerDiplomatSkillSequence(event, convertedPieces) {
  if (cutsceneTimer !== null) window.clearTimeout(cutsceneTimer);
  if (skillEffectTimer !== null) window.clearTimeout(skillEffectTimer);

  const targets = (convertedPieces || []).map((e) => {
    return {
      row: e.row,
      col: e.col,
      fromOwner: e.fromOwner,
      toOwner: event.owner,
      pieceId: e.pieceId,
    };
  });

  const showCharacter = isSpecialCharacterEnabled();
  visibleCutscene = showCharacter ? {
    owner: event.owner,
    unitType: "diplomat",
    row: event.row,
    col: event.col,
    durationMs: DIPLOMAT_CUTIN_MS,
  } : null;
  activeSkillEffect = {
    type: "diplomat_conversion",
    phase: "cutin",
    source: { row: event.row, col: event.col, owner: event.owner },
    targets,
  };
  render();

  const startSkillEffect = () => {
    cutsceneTimer = null;
    visibleCutscene = null;
    if (activeSkillEffect) {
      activeSkillEffect.phase = "bribe";
    }
    render();

    skillEffectTimer = window.setTimeout(() => {
      skillEffectTimer = null;
      activeSkillEffect = null;
      render();
      if (state.mode === "pve" && isAiTurn()) {
        scheduleAiTurn();
      }
    }, DIPLOMAT_SKILL_EFFECT_MS);
  };
  if (showCharacter) cutsceneTimer = window.setTimeout(startSkillEffect, DIPLOMAT_CUTIN_MS);
  else startSkillEffect();
}

function triggerWizardSkillSequence(event, removedEvents) {
  if (cutsceneTimer !== null) window.clearTimeout(cutsceneTimer);
  if (skillEffectTimer !== null) window.clearTimeout(skillEffectTimer);

  const targets = (removedEvents || []).map((e) => {
    return {
      row: e.row,
      col: e.col,
      owner: e.owner,
      unitType: e.unitType,
      pieceId: e.pieceId,
      revealed: e.revealed,
    };
  });

  const showCharacter = isSpecialCharacterEnabled();
  visibleCutscene = showCharacter ? {
    owner: event.owner,
    unitType: "wizard",
    row: event.row,
    col: event.col,
    durationMs: WIZARD_CUTIN_MS,
  } : null;
  activeSkillEffect = {
    type: "wizard_vanish",
    phase: "cutin",
    source: { row: event.row, col: event.col, owner: event.owner },
    targets,
  };
  render();

  const startSkillEffect = () => {
    cutsceneTimer = null;
    visibleCutscene = null;
    if (activeSkillEffect) {
      activeSkillEffect.phase = "rune";
    }
    render();

    skillEffectTimer = window.setTimeout(() => {
      skillEffectTimer = null;
      activeSkillEffect = null;
      render();
      if (state.mode === "pve" && isAiTurn()) {
        scheduleAiTurn();
      }
    }, WIZARD_SKILL_EFFECT_MS);
  };
  if (showCharacter) cutsceneTimer = window.setTimeout(startSkillEffect, WIZARD_CUTIN_MS);
  else startSkillEffect();
}

function showSpecialCutscene(event) {
  if (!event || !event.unitType || !isSpecialCharacterEnabled()) return;
  const durationMs = CUTSCENE_DISPLAY_MS;
  visibleCutscene = {
    owner: event.owner,
    unitType: event.unitType,
    row: event.row,
    col: event.col,
    durationMs,
  };
  if (cutsceneTimer !== null) window.clearTimeout(cutsceneTimer);
  render();
  cutsceneTimer = window.setTimeout(() => {
    cutsceneTimer = null;
    visibleCutscene = null;
    render();
  }, durationMs);
}

function showTauntBubble(event) {
  if (!event || event.id === lastTauntEventId) return;
  lastTauntEventId = event.id;
  if (!isSpecialCharacterEnabled()) return;
  const durationMs = TAUNT_DISPLAY_MS;
  visibleTaunt = { ...event, durationMs };
  if (tauntTimer !== null) window.clearTimeout(tauntTimer);
  if (aiTimer !== null) {
    window.clearTimeout(aiTimer);
    aiTimer = null;
    state.aiThinking = false;
  }
  render();
  tauntTimer = window.setTimeout(() => {
    tauntTimer = null;
    visibleTaunt = null;
    render();
    scheduleAiTurn();
  }, durationMs);
}

function activatePendingSpecial(player) {
  if (state.mode === "pve") {
    return applySharedPveAction(player, { type: "activate_special" }) === "accepted";
  }
  const accepted = commitSharedLocalAction(player, { type: "activate_special" }) === "accepted";
  if (!accepted) return false;
  if (state.mode === "puzzle" && checkPuzzleResult()) return true;
  render();
  return true;
}

function selectCell(row, col) {
  if (state.winner || visibleTaunt) return;
  if (tutorialIntro) return;
  if (state.mode === "pvp") {
    if (!networkSession.ready) return;
    if (state.pendingSpecial) return;
    if (state.teleporting) {
      if (state.teleporting.owner !== networkSession.player) return;
      sendNetworkAction({ type: "wizard_teleport", row, col });
      return;
    }
    if (state.turn !== networkSession.player) return;
    const piece = state.board[row][col];
    if (piece) {
      state.selected = { row, col };
      render();
      return;
    }
    sendNetworkAction({ type: "deploy", unitType: currentUnitChoice(), row, col });
    return;
  }
  if (isAiTurn()) return;
  if (state.pendingSpecial) return;

  if (state.teleporting) {
    const tutorialTarget = state.mode === "tutorial" ? TUTORIAL_STEPS[tutorialStep] : null;
    if (
      tutorialTarget
      && (row !== tutorialTarget.teleportRow || col !== tutorialTarget.teleportCol)
    ) return;
    teleportWizard(row, col);
    return;
  }

  const piece = state.board[row][col];
  if (piece) {
    state.selected = { row, col };
    render();
    return;
  }

  deploy(row, col);
}

function teleportWizard(row, col) {
  if (!state.teleporting) return;
  const owner = state.teleporting.owner;
  const result = state.mode === "pve"
    ? applySharedPveAction(owner, { type: "wizard_teleport", row, col })
    : commitSharedLocalAction(owner, { type: "wizard_teleport", row, col });
  if (result === "rejected") {
    addLog("Wizard needs an empty teleport cell.");
    render();
  } else if (result === "accepted" && state.mode === "puzzle") {
    if (!checkPuzzleResult()) render();
  } else if (result === "accepted" && state.mode === "tutorial") {
    tutorialAwaitingContinue = true;
    if (tutorialStep === TUTORIAL_STEPS.length - 1) {
      tutorialCompletionPhase = "summary";
      state.winner = "white";
      state.resultReason = text("tutorialPuzzleSolvedReason");
      persistTutorialComplete();
      renderProgressionUi();
    }
    render();
  }
}

function scheduleAiTurn() {
  if (new URLSearchParams(location.search).get("demo") === "capture-38") return;
  if (visibleTaunt) return;
  if (state.mode === "pve" && state.teleporting?.owner === pveAiPlayer && !state.aiThinking) {
    state.aiThinking = true;
    render();
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      state.aiThinking = false;
      const destination = chooseAiTeleportDestination(state, neighbors, pveAiPlayer, pveHumanPlayer);
      if (destination) teleportWizard(destination.row, destination.col);
    }, AI_WIZARD_TELEPORT_DELAY_MS);
    return;
  }

  if (!isAiTurn() || state.teleporting || state.pendingSpecial || state.aiThinking) return;
  state.aiThinking = true;
  render();
  aiTimer = window.setTimeout(() => {
    aiTimer = null;
    state.aiThinking = false;
    runAiTurn();
  }, AI_MOVE_DELAY_MS);
}

function runAiTurn() {
  if (!isAiTurn() || state.winner || state.teleporting || state.pendingSpecial) return;

  const deployMove = findAiDeployMove(state, {
    aiPlayer: pveAiPlayer,
    humanPlayer: pveHumanPlayer,
    canDeploy,
    countPieces,
    neighbors,
  });
  if (deployMove && deployUnit(pveAiPlayer, deployMove.type, deployMove.row, deployMove.col)) return;

  const passResult = applySharedPveAction(pveAiPlayer, { type: "pass" });
  if (passResult === "rejected") {
    addLog(`${sideName(pveAiPlayer)} AI could not choose a legal move.`);
    render();
  }
}

function forEachPiece(callback) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state.board[row][col];
      if (piece) callback(piece, row, col);
    }
  }
}

function render() {
  completeTutorialPuzzleIfNeeded();
  const viewerSide = state.mode === "pvp"
    ? networkSession.player
    : state.mode === "pve" || state.mode === "puzzle"
      ? pveHumanPlayer
      : PVE_HUMAN;
  fortressFrame.classList.toggle("view-black", viewerSide === "black");
  pveTurnDeadline = resolvePveTurnDeadline({
    currentDeadline: pveTurnDeadline,
    now: Date.now(),
    limitMs: PVE_TURN_LIMIT_MS,
    developerMode: DEVELOPER_MODE,
    timerEnabled: activePveTimerEnabled,
    mode: state.mode,
    winner: state.winner,
    gameActive: isGameActive(),
    turn: state.turn,
    humanPlayer: pveHumanPlayer,
  });

  const deploymentAnimation = pendingDeploymentAnimation;
  pendingDeploymentAnimation = null;
  const matchEnded = Boolean(
    state?.winner
      && (state.mode === "pve" || state.mode === "pvp")
      && !activeSkillEffect,
  );
  if (!matchEnded) matchResultDetailsOpen = false;
  renderGame({
    state,
    boardEl,
    turnPill,
    onlineTurnDeadline,
    pveTurnDeadline,
    modeInfo,
    connectionInfo,
    connectionInfoText,
    rankInfo,
    blackCount,
    whiteCount,
    deployDock,
    cancelTeleportBtn,
    undoBtn,
    resignBtn,
    resultModal,
    showMatchResult: matchEnded && matchResultDetailsOpen,
    networkModalHidden: networkModal ? networkModal.hidden : true,
    networkStatusGroup,
    unitInputs,
    networkReady: networkSession.ready,
    networkConnecting: networkSession.connected && !networkSession.opponentDisconnected,
    modeLabel: currentModeLabel(),
    rankLabel: currentRankLabel(),
    connectionLabel: currentConnectionLabel(),
    networkPlayer: networkSession.player,
    pveHumanPlayer,
    pveAiPlayer,
    viewerSide,
    visibleTaunt,
    visibleCutscene,
    activeSkillEffect,
    deploymentAnimation,
    undoCount: undoStack.length,
    unitLabels: UNIT_LABELS,
    text,
    sideName,
    coord,
    currentUnitChoice,
    canDeploy,
    tutorialUnitHighlight: state.mode === "tutorial"
      && tutorialSpecialIntroPhase === "practice"
      && !tutorialScriptRunning
      && !tutorialAwaitingContinue
      ? TUTORIAL_STEPS[tutorialStep]?.unitType
      : null,
    tutorialTeleportTarget: state.mode === "tutorial" && state.teleporting
      ? {
        row: TUTORIAL_STEPS[tutorialStep]?.teleportRow,
        col: TUTORIAL_STEPS[tutorialStep]?.teleportCol,
      }
      : null,
    kingZones: activeKingZones,
    selectCell,
    countPieces,
    localizeResultReason,
    onDialogueNext: handleDialogueNext,
    onDialoguePrev: handleDialoguePrev,
  });
  const matchResultVisible = matchEnded;
  if (matchResultVisible) {
    if (state.mode === "pvp") {
      if (networkSession.opponentDisconnected) {
        playAgainBtn.disabled = true;
        playAgainBtn.textContent = text("requestRematch");
        playAgainBtn.classList.remove("rematch-offered");
        if (resultRematchNotice) {
          resultRematchNotice.hidden = false;
          resultRematchNotice.classList.add("disconnected");
          resultRematchNotice.textContent = text("opponentLeftRoom");
        }
      } else if (rematchRequested) {
        playAgainBtn.disabled = true;
        playAgainBtn.textContent = text("requestRematch");
        playAgainBtn.classList.remove("rematch-offered");
        if (resultRematchNotice) {
          resultRematchNotice.hidden = false;
          resultRematchNotice.classList.remove("disconnected");
          resultRematchNotice.textContent = text("rematchWaiting");
        }
      } else if (rematchOfferedBy && rematchOfferedBy !== networkSession.player) {
        playAgainBtn.disabled = false;
        playAgainBtn.textContent = text("acceptRematch");
        playAgainBtn.classList.add("rematch-offered");
        if (resultRematchNotice) {
          resultRematchNotice.hidden = false;
          resultRematchNotice.classList.remove("disconnected");
          resultRematchNotice.textContent = text("opponentRematchOffered");
        }
      } else {
        playAgainBtn.disabled = false;
        playAgainBtn.textContent = text("requestRematch");
        playAgainBtn.classList.remove("rematch-offered");
        if (resultRematchNotice) {
          resultRematchNotice.hidden = true;
          resultRematchNotice.classList.remove("disconnected");
        }
      }
    } else {
      playAgainBtn.disabled = false;
      playAgainBtn.textContent = text("playAgain");
      playAgainBtn.classList.remove("rematch-offered");
      if (resultRematchNotice) {
        resultRematchNotice.hidden = true;
      }
    }
  } else {
    playAgainBtn.disabled = false;
    playAgainBtn.classList.remove("rematch-offered");
    if (resultRematchNotice) {
      resultRematchNotice.hidden = true;
    }
    if (!state.winner) {
      rematchRequested = false;
      rematchOfferedBy = null;
    }
  }
  const tutorialActive = state.mode === "tutorial";
  const puzzleActive = state.mode === "puzzle" && activePuzzle;
  const tutorialWallHighlight = tutorialActive && !tutorialIntro && !activePuzzle
    ? tutorialStep === 2
      ? "black"
      : tutorialStep === 3
        ? "white"
        : null
    : null;
  fortressFrame.classList.toggle("tutorial-highlight-black-wall", tutorialWallHighlight === "black");
  fortressFrame.classList.toggle("tutorial-highlight-white-wall", tutorialWallHighlight === "white");
  const teleportActive = Boolean(state.teleporting);
  const teleportUi = teleportUiState(state, viewerSide);
  const matchResultAnnouncementActive = Boolean(
    matchEnded && networkModal?.hidden !== false,
  );
  const challengeResultActive = Boolean(state.winner && (puzzleActive || (tutorialActive && activePuzzle?.type === "tutorial")));
  const challengeResultSolved = challengeResultActive && (tutorialActive
    ? state.winner === "white"
    : state.winner === activePuzzle?.player);
  const tutorialVictoryReady = Boolean(
    tutorialActive
      && !activePuzzle
      && state.winner === "white"
      && tutorialStep >= TUTORIAL_STEPS.length - 1
      && tutorialAwaitingContinue
      && !state.teleporting,
  );
  tutorialPanel.hidden = !tutorialActive && !puzzleActive && !teleportUi.showPrompt && !matchResultAnnouncementActive;
  gameStatusBar.classList.toggle("guide-active", !tutorialPanel.hidden);
  tutorialPanel.classList.toggle("wizard-move-panel", teleportUi.showPrompt);
  tutorialPanel.classList.toggle("challenge-result", challengeResultActive);
  tutorialPanel.classList.toggle("match-result-announcement", matchResultAnnouncementActive);
  tutorialPanel.classList.toggle("complete", challengeResultSolved);
  tutorialPanel.classList.toggle("incomplete", challengeResultActive && !challengeResultSolved);
  tutorialPanel.toggleAttribute("data-outcome", matchResultAnnouncementActive);
  if (matchResultAnnouncementActive) tutorialPanel.dataset.outcome = state.winner;
  matchResultSummary.hidden = !matchResultAnnouncementActive;
  matchResultActions.hidden = !matchResultAnnouncementActive;
  tutorialMessage.hidden = matchResultAnnouncementActive;
  matchDetailsBtn.hidden = !matchResultAnnouncementActive;
  playAgainBtn.hidden = !matchResultAnnouncementActive;
  exitTutorialBtn.hidden = !challengeResultActive;
  tutorialLobbyBtn.hidden = !(tutorialVictoryReady && tutorialCompletionPhase === "challenge");
  setIconButtonLabel(exitTutorialBtn, "backToChallenges");
  boardEl.classList.toggle("tutorial-active", tutorialActive);
  if (matchResultAnnouncementActive) {
    tutorialStepLabel.hidden = true;
    tutorialStepLabel.textContent = "";
    matchResultOutcome.textContent = state.winner === "draw"
      ? text("resultDraw")
      : text("resultWin", { side: sideName(state.winner) });
    matchResultHeadline.textContent = text("matchComplete");
    matchResultReason.textContent = localizeResultReason(state.resultReason);
    fitMatchResultVerdict();
    const resultSide = state.mode === "pvp" ? networkSession.player : pveHumanPlayer;
    const metaParts = [state.mode === "pve" ? text("matchMetaPve") : currentModeLabel()];
    if (state.mode === "pve") {
      const resultRank = state.aiRank || state.aiDifficulty;
      metaParts.push(resultRank === "novice" ? text("matchMetaNoviceRank") : currentRankLabel());
    }
    if (resultSide) metaParts.push(sideName(resultSide));
    matchResultMeta.textContent = metaParts.join(" · ");
    resultBlackUnits.textContent = countPieces("black");
    resultWhiteUnits.textContent = countPieces("white");
    resultFinishMethod.textContent = localizeResultReason(state.resultReason);
    resultTotalDeployments.textContent = text("deploymentTotalValue", {
      count: (state.deploymentCount?.black || 0) + (state.deploymentCount?.white || 0),
    });
    resultBlackCaptures.textContent = state.stats?.captures?.black || 0;
    resultWhiteCaptures.textContent = state.stats?.captures?.white || 0;
    startTutorialBtn.hidden = true;
    tutorialLobbyBtn.hidden = true;
    exitTutorialBtn.hidden = true;
    nextTutorialBtn.hidden = true;
    cancelTeleportBtn.hidden = true;
    boardEl.classList.remove("tutorial-active");
    boardEl.classList.remove("tutorial-complete");
  } else if (tutorialActive) {
    const complete = tutorialStep >= TUTORIAL_STEPS.length;
    const tutorialPuzzleActive = activePuzzle?.type === "tutorial";
    if (tutorialIntro) {
      tutorialPanel.hidden = false;
      gameStatusBar.classList.toggle("guide-active", true);
      tutorialMessage.textContent = tutorialIntroReady ? text("tutorialIntroPrompt") : "";
      startTutorialBtn.hidden = !tutorialIntroReady;
      startTutorialBtn.textContent = text("startTutorialAction");
      nextTutorialBtn.hidden = true;
      cancelTeleportBtn.hidden = true;
      boardEl.classList.toggle("tutorial-complete", false);
    } else {
      tutorialPanel.hidden = false;
      gameStatusBar.classList.toggle("guide-active", true);
      startTutorialBtn.hidden = true;
      const tutorialMessageKey = tutorialVictoryReady && tutorialCompletionPhase === "challenge"
        ? "tutorialAiChallengePrompt"
        : complete && !tutorialPuzzleActive
        ? "tutorialWizardPlaced"
        : tutorialReactionPhase === "preparing"
          ? "tutorialBlackPreparing"
          : tutorialReactionPhase === "surrounded"
            ? "tutorialSurroundComplete"
            : tutorialSpecialIntroPhase === "overview"
              ? "tutorialSpecialIntro"
              : tutorialAwaitingContinue
                ? state.teleporting
                  ? "tutorialWizardTeleport"
                  : tutorialStep === 0 && tutorialSanctuaryPhase === "duration"
                    ? "tutorialSanctuaryDuration"
                    : TUTORIAL_STEPS[tutorialStep].placedMessage
                : TUTORIAL_STEPS[tutorialStep]?.message;
      const conciseTutorialMessage = text(complete && tutorialPuzzleActive ? "challengeComplete" : tutorialMessageKey);
      tutorialMessage.textContent = conciseTutorialMessage;
      nextTutorialBtn.hidden = tutorialVictoryReady
        ? tutorialCompletionPhase !== "summary"
        : complete || !tutorialAwaitingContinue || tutorialScriptRunning || Boolean(state.teleporting) || Boolean(tutorialReactionPhase);
      setIconButtonLabel(nextTutorialBtn, "nextTutorial");
      boardEl.classList.toggle("tutorial-complete", complete);
    }
  } else if (puzzleActive) {
    startTutorialBtn.hidden = true;
    if (state.winner) {
      const solved = state.winner === activePuzzle.player;
      tutorialMessage.textContent = solved ? text("challengeComplete") : text("challengeIncomplete");
      nextTutorialBtn.hidden = solved;
      setIconButtonLabel(nextTutorialBtn, "retryChallenge");
    } else {
      tutorialMessage.textContent = localizedPuzzleText(activePuzzle.description);
      nextTutorialBtn.hidden = true;
      setIconButtonLabel(nextTutorialBtn, "nextChallenge");
    }
    boardEl.classList.remove("tutorial-complete");
  } else if (teleportUi.canControl) {
    startTutorialBtn.hidden = true;
    tutorialStepLabel.hidden = true;
    tutorialStepLabel.textContent = "";
    tutorialMessage.textContent = text("wizardTeleportPrompt");
    cancelTeleportBtn.hidden = false;
    nextTutorialBtn.hidden = true;
    boardEl.classList.remove("tutorial-active");
    boardEl.classList.remove("tutorial-complete");
  } else {
    startTutorialBtn.hidden = true;
    cancelTeleportBtn.hidden = true;
    nextTutorialBtn.hidden = true;
    setIconButtonLabel(nextTutorialBtn, "nextTutorial");
    boardEl.classList.remove("tutorial-active");
    boardEl.classList.remove("tutorial-complete");
  }
  if (tutorialActive && teleportUi.canControl) {
    cancelTeleportBtn.hidden = true;
  }
  scheduleSpecialAutoActivation(viewerSide);
}

// A surrounded special has no decline option, so the old confirmation card was
// a forced tap. It activates on its own after a beat and the character cut-in
// announces it, the way the tutorial script and the PvE AI already do.
function scheduleSpecialAutoActivation(viewerSide) {
  const pending = state.pendingSpecial;
  if (!pending || state.winner || visibleTaunt) {
    cancelSpecialAutoActivation();
    return;
  }
  // Only the client that controls the surrounded unit's side may fire it. In
  // PvP that is its owner alone; every other mode drives both sides locally.
  if (state.mode === "pvp" && (pending.owner !== viewerSide || !networkSession.ready)) return;

  const key = `${pending.owner}:${pending.row}:${pending.col}`;
  if (pendingSpecialAutoKey === key) return;
  cancelSpecialAutoActivation();
  pendingSpecialAutoKey = key;
  pendingSpecialTimer = window.setTimeout(() => {
    pendingSpecialTimer = null;
    pendingSpecialAutoKey = null;
    const current = state.pendingSpecial;
    if (!current || state.winner) return;
    if (`${current.owner}:${current.row}:${current.col}` !== key) return;
    tutorialReactionPhase = null;
    if (state.mode === "pvp") {
      sendNetworkAction({ type: "activate_special" });
    } else {
      activatePendingSpecial(current.owner);
    }
  }, SPECIAL_ACTIVATE_DELAY_MS);
}

function cancelSpecialAutoActivation() {
  if (pendingSpecialTimer !== null) window.clearTimeout(pendingSpecialTimer);
  pendingSpecialTimer = null;
  pendingSpecialAutoKey = null;
}

// The verdict sits in a fixed-height bar and both lines vary by language, so
// each steps down from its CSS size until it fits instead of being clipped:
// the headline stays on one line, the reason within its clamped line count.
function fitMatchResultVerdict() {
  matchResultHeadline.style.fontSize = "";
  let headlineSize = parseFloat(getComputedStyle(matchResultHeadline).fontSize);
  while (headlineSize > 13 && matchResultHeadline.scrollWidth > matchResultHeadline.clientWidth) {
    headlineSize -= 1;
    matchResultHeadline.style.fontSize = `${headlineSize}px`;
  }
  matchResultReason.style.fontSize = "";
  let reasonSize = parseFloat(getComputedStyle(matchResultReason).fontSize);
  while (reasonSize > 9 && matchResultReason.scrollHeight > matchResultReason.clientHeight) {
    reasonSize -= 1;
    matchResultReason.style.fontSize = `${reasonSize}px`;
  }
}

window.addEventListener("resize", () => {
  if (!matchResultSummary.hidden) fitMatchResultVerdict();
});

function localizeResultReason(reason) {
  if (!reason) return "";
  if (reason === "All enemy units were eliminated.") return text("allEliminated");
  if (reason === "Time limit exceeded (30s).") return text("timeExpired");
  if (reason.includes("resigned.")) {
    const side = reason.startsWith("Black") || reason.startsWith("black") ? text("black") : text("white");
    return text("resignReason", { side });
  }
  const localizedSides = reason
    .replace(/\b(?:red|black)\b/gi, text("black"))
    .replace(/\b(?:blue|white)\b/gi, text("white"));
  if (LANGUAGE !== "ko") return localizedSides;
  return localizedSides
    .replaceAll("King", text("king"))
    .replaceAll("was captured", "포획되었습니다")
    .replaceAll("왕 포획되었습니다", "왕이 포획되었습니다")
    .replaceAll("territory capture", "영역 포획")
    .replaceAll("Diplomat conversion", "외교관 전환");
}

function closeResignConfirmation() {
  resignConfirmModal.hidden = true;
}

undoBtn.addEventListener("click", undoLastMove);
if (resignBtn) {
  resignBtn.addEventListener("click", () => {
    if (state.winner || state.phase === "complete") return;
    if (state.mode === "pvp" && !networkSession.ready) return;
    resignConfirmModal.hidden = false;
    cancelResignBtn.focus();
  });
}
if (cancelResignBtn) {
  cancelResignBtn.addEventListener("click", () => {
    closeResignConfirmation();
  });
}
if (confirmResignBtn) {
  confirmResignBtn.addEventListener("click", () => {
    closeResignConfirmation();
    if (state.winner || state.phase === "complete") return;
    if (state.mode === "pvp") {
      sendNetworkAction({ type: "resign" });
      return;
    }
    if (state.mode === "pve") {
      applySharedPveAction(pveHumanPlayer, { type: "resign" });
      return;
    }
    const resigningSide = state.mode === "pve" ? pveHumanPlayer : state.turn;
    const winningSide = opponent(resigningSide);
    state.phase = "complete";
    state.winner = winningSide;
    state.resultReason = `${resigningSide === "black" ? "Black" : "White"} resigned.`;
    recordMatchHistory();
    render();
  });
}
if (resignConfirmModal) {
  resignConfirmModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeResignConfirmation();
      return;
    }
    if (event.key !== "Tab") return;
    const firstButton = cancelResignBtn;
    const lastButton = confirmResignBtn;
    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault();
      lastButton.focus();
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault();
      firstButton.focus();
    }
  });
}
cancelTeleportBtn.addEventListener("click", () => {
  if (state.mode === "pvp") {
    if (state.teleporting?.owner === networkSession.player) sendNetworkAction({ type: "wizard_stay" });
    return;
  }
  if (state.teleporting) {
    const owner = state.teleporting.owner;
    const result = state.mode === "pve"
      ? applySharedPveAction(owner, { type: "wizard_stay" })
      : commitSharedLocalAction(owner, { type: "wizard_stay" });
    if (result === "accepted" && state.mode === "puzzle") {
      if (!checkPuzzleResult()) render();
    } else if (result === "accepted" && state.mode === "tutorial") {
      tutorialAwaitingContinue = true;
      render();
    }
    return;
  }
});
cancelSuicideBtn.addEventListener("click", () => closeSuicideConfirmation());
confirmSuicideBtn.addEventListener("click", () => {
  const confirmation = pendingSuicideConfirmation;
  if (!confirmation) return;
  closeSuicideConfirmation({ restoreFocus: false });
  if (confirmation.source === "online") {
    sendNetworkAction({ ...confirmation.action, confirmSuicide: true });
    return;
  }
  deploy(confirmation.row, confirmation.col, {
    player: confirmation.player,
    unitType: confirmation.unitType,
    confirmedSuicide: true,
  });
});
suicideConfirmModal.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeSuicideConfirmation();
    return;
  }
  if (event.key !== "Tab") return;
  const firstButton = cancelSuicideBtn;
  const lastButton = confirmSuicideBtn;
  if (event.shiftKey && document.activeElement === firstButton) {
    event.preventDefault();
    lastButton.focus();
  } else if (!event.shiftKey && document.activeElement === lastButton) {
    event.preventDefault();
    firstButton.focus();
  }
});
function resetGame() {
  clearTutorialScript();
  if (aiTimer !== null) window.clearTimeout(aiTimer);
  if (tauntTimer !== null) window.clearTimeout(tauntTimer);
  if (cutsceneTimer !== null) window.clearTimeout(cutsceneTimer);
  if (skillEffectTimer !== null) window.clearTimeout(skillEffectTimer);
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  if (tutorialIntroTimer !== null) window.clearTimeout(tutorialIntroTimer);
  cancelSpecialAutoActivation();
  tutorialIntroTimer = null;
  tutorialTimer = null;
  aiTimer = null;
  tauntTimer = null;
  cutsceneTimer = null;
  skillEffectTimer = null;
  visibleTaunt = null;
  visibleCutscene = null;
  activeSkillEffect = null;
  lastTauntEventId = 0;
  rematchRequested = false;
  undoStack = [];
  tutorialStep = -1;
  tutorialIntro = false;
  tutorialIntroPage = 0;
  tutorialIntroReady = false;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
  tutorialSanctuaryPhase = null;
  tutorialSpecialIntroPhase = null;
  tutorialCompletionPhase = null;
  closeSuicideConfirmation({ restoreFocus: false });
  closeResignConfirmation();
  if (state?.mode === "puzzle") {
    loadPuzzle(puzzleIndex);
    return;
  }
  state = newState();
  startPveJournal();
  render();
  scheduleAiTurn();
}

function startNewGame() {
  clearTutorialScript();
  if (aiTimer !== null) window.clearTimeout(aiTimer);
  if (tauntTimer !== null) window.clearTimeout(tauntTimer);
  if (cutsceneTimer !== null) window.clearTimeout(cutsceneTimer);
  if (skillEffectTimer !== null) window.clearTimeout(skillEffectTimer);
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  if (tutorialIntroTimer !== null) window.clearTimeout(tutorialIntroTimer);
  cancelSpecialAutoActivation();
  tutorialIntroTimer = null;
  tutorialTimer = null;
  aiTimer = null;
  tauntTimer = null;
  cutsceneTimer = null;
  skillEffectTimer = null;
  visibleTaunt = null;
  visibleCutscene = null;
  activeSkillEffect = null;
  lastTauntEventId = 0;
  rematchRequested = false;
  undoStack = [];
  tutorialStep = -1;
  tutorialIntro = false;
  tutorialIntroPage = 0;
  tutorialIntroReady = false;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
  tutorialSanctuaryPhase = null;
  tutorialSpecialIntroPhase = null;
  tutorialCompletionPhase = null;
  activePuzzle = null;
  puzzleMoves = 0;
  puzzleCompleted = false;
  disconnectNetwork();
  selectModeChoice("pve");
  state = createInitialState("pve", pveHumanPlayer);
  state.aiDifficulty = pveDifficulty;
  state.aiRank = selectedPveRank;
  startPveJournal();
  pveSideModal.hidden = true;
  networkModal.hidden = true;
  resultModal.hidden = true;
  passNotificationModal.hidden = true;
  challengeModal.hidden = true;
  modeModal.hidden = false;
  renderProgressionUi();
  render();
}

function playAgain() {
  if (state.mode === "pvp") {
    hideRematchToast();
    rematchRequested = true;
    sendNetworkAction({ type: "rematch" });
    setNetworkStatus(text("rematchWaiting"));
    render();
    return;
  }
  if (state.mode === "tutorial" && activePuzzle?.type === "tutorial" && state.winner) {
    loadPuzzle(puzzleIndex + 1);
    return;
  }
  if (state.mode === "puzzle") {
    if (state.winner === activePuzzle?.player) {
      if (puzzleIndex + 1 < PUZZLES.length) {
        loadPuzzle(puzzleIndex + 1);
      } else {
        openChallengeSelection();
      }
    } else {
      loadPuzzle(puzzleIndex);
    }
    return;
  }
  resetGame();
}

function selectGameMode(mode, closeModal = false) {
  if (mode === "tutorial") {
    startTutorial();
    return;
  }
  if (mode === "puzzle") {
    openChallengeSelection();
    return;
  }
  if ((mode === "pve" || mode === "pvp") && !arePrimaryModesUnlocked()) return;
  const modeInput = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (!modeInput) return;
  modeInput.checked = true;
  if (mode === "pve") {
    disconnectNetwork();
    networkModal.hidden = true;
    modeModal.hidden = true;
    renderPveRankOptions();
    renderPveTimerOptions();
    resetPveRps();
    pveSideModal.hidden = false;
    return;
  }
  if (closeModal) modeModal.hidden = true;
  if (mode === "pvp") {
    disconnectNetwork();
    state = newState();
    render();
    networkModal.hidden = false;
    openRooms = [];
    renderOpenRooms();
    requestRoomList();
    return;
  }
  disconnectNetwork();
  pveSideModal.hidden = true;
  networkModal.hidden = true;
  resetGame();
}

function startPve(side) {
  clearPveRpsResultTimer();
  pveHumanPlayer = side;
  pveAiPlayer = opponent(side);
  activePveTimerEnabled = pveTimerEnabled;
  selectModeChoice("pve");
  pveSideModal.hidden = true;
  modeModal.hidden = true;
  resetGame();
  state.aiDifficulty = pveDifficulty;
  state.aiRank = selectedPveRank;
  state.pveTimerEnabled = activePveTimerEnabled;
  pveTurnDeadline = activePveTimerEnabled && !DEVELOPER_MODE && side === "black"
    ? Date.now() + PVE_TURN_LIMIT_MS
    : null;
  render();
  if (side === "white") scheduleAiTurn();
}

function updatePveRpsButtonLabels() {
  pveRpsButtons.forEach((button) => {
    const label = text(button.dataset.pveRps);
    button.setAttribute("aria-label", label);
    button.title = label;
  });
}

function clearPveRpsResultTimer() {
  if (pveRpsResultTimer !== null) window.clearTimeout(pveRpsResultTimer);
  pveRpsResultTimer = null;
}

function resetPveRps() {
  clearPveRpsResultTimer();
  pveRpsButtons.forEach((button) => {
    button.disabled = false;
    button.classList.remove("selected");
  });
  if (pveRpsStatus) pveRpsStatus.textContent = text("choosePreferredSide");
  updatePveRpsButtonLabels();
}

function pveRpsResult(playerChoice, aiChoice) {
  if (playerChoice === aiChoice) return "draw";
  const winningReply = { scissors: "rock", rock: "paper", paper: "scissors" };
  return winningReply[aiChoice] === playerChoice ? "win" : "lose";
}

function choosePveRps(button) {
  if (pveRpsResultTimer !== null) return;
  const choices = ["scissors", "rock", "paper"];
  const playerChoice = button.dataset.pveRps;
  const aiChoice = choices[Math.floor(Math.random() * choices.length)];
  const result = pveRpsResult(playerChoice, aiChoice);
  pveRpsButtons.forEach((item) => {
    item.classList.toggle("selected", item === button);
    item.disabled = result !== "draw";
  });
  if (pveRpsStatus) pveRpsStatus.textContent = text(result === "draw" ? "rpsDraw" : result === "win" ? "rpsWin" : "rpsLose");
  if (result === "draw") return;
  pveRpsResultTimer = window.setTimeout(() => {
    pveRpsResultTimer = null;
    startPve(result === "win" ? "black" : "white");
  }, 900);
}

function showNetworkRoomControls() {
  uiShowNetworkRoomControls({ publicRoomList, networkRoomControls, networkRpsPicker });
}

function showNetworkRpsPicker() {
  uiShowNetworkRpsPicker({ publicRoomList, networkRoomControls, networkRpsPicker, rpsButtons });
}

function showNetworkWaitingRoom() {
  uiShowNetworkWaitingRoom({ publicRoomList, networkRoomControls, networkRpsPicker });
}

function resetRpsButtons() {
  uiResetRpsButtons(rpsButtons);
}

function setNetworkStatus(message) {
  networkStatus.textContent = message;
  networkLobbyStatus.textContent = message;
  const identity = document.querySelector('#networkPublicIdentity');
  const publicCode = networkSession?.connected ? networkSession.profile?.publicCode : null;
  identity.hidden = !publicCode;
  identity.textContent = publicCode ? `ID: ${publicCode}` : '';
}

function boardName(boardNumber) {
  return text("boardName", { number: boardNumber });
}

function displayBoardNumber(boardNumber, fallback = 1) {
  return Number.isInteger(boardNumber) && boardNumber > 0 ? boardNumber : fallback;
}

function currentBoardLabel() {
  const roomIndex = openRooms.findIndex((item) => item.roomCode === networkSession.roomCode);
  const room = roomIndex >= 0 ? openRooms[roomIndex] : null;
  const fallback = roomIndex >= 0 ? roomIndex + 1 : 1;
  return boardName(displayBoardNumber(networkSession.boardNumber || room?.boardNumber, fallback));
}

function renderOpenRooms() {
  renderOpenRoomsList({
    openRooms,
    container: publicRoomItems,
    onJoin: joinNetworkRoom,
    text,
    boardName,
    displayBoardNumber,
  });
}

function requestRoomList() {
  showNetworkRoomControls();
  connectNetwork({ type: "list_rooms", protocolVersion: PROTOCOL_VERSION });
}

function returnToNetworkLobby() {
  resultModal.hidden = true;
  hideRematchToast();
  rematchRequested = false;
  rematchOfferedBy = null;
  state = createInitialState("pvp", "black");
  state.mode = "pvp";
  networkModal.hidden = false;
  showNetworkRoomControls();
  openRooms = [];
  renderOpenRooms();
  requestRoomList();
  render();
}

function connectNetwork(command) {
  // Lobby commands share the authenticated connection. Closing and reopening it
  // can race the server's one-connection-per-player check.
  if (!networkSession.roomCode && sendNetworkCommand(networkSession, command)) {
    setNetworkStatus(text("connecting"));
    return;
  }
  disconnectNetwork();
  networkSession = openNetworkConnection(command, {
    url: buildNetworkUrl(location, NETWORK_SERVER),
    connectingMessage: text("connecting"),
    reconnectingMessage: text("reconnecting"),
    disconnectedMessage: text("disconnected"),
    unavailableMessage: text("serverUnavailable"),
    authenticationFailedMessage: text("guestAuthenticationFailed"),
    invalidMessage: text("invalidServerResponse"),
    onStatus: (message, session) => {
      if (!session || networkSession === session) setNetworkStatus(message);
    },
    onMessage: handleNetworkMessage,
    onClose: (session, { reconnecting } = {}) => {
      if (networkSession === session) {
        if (!reconnecting || !session.roomCode) showNetworkRoomControls();
        render();
      }
    },
  });
}

function handleNetworkMessage(message) {
  if (message.type === "room_list") {
    openRooms = message.rooms;
    if (!openRooms.some((room) => room.roomCode === selectedOpenRoomCode)) selectedOpenRoomCode = "";
    renderOpenRooms();
    setNetworkStatus(networkSession.matchVoided ? text("serverRestartVoided") : text("createOrJoin"));
    return;
  }

  if (message.type === "room_created") {
    networkSession.matchVoided = false;
    networkSession.roomCode = message.roomCode;
    networkSession.boardNumber = message.boardNumber || networkSession.boardNumber;
    state.mode = "pvp";
    showNetworkWaitingRoom();
    networkModal.hidden = false;
    setNetworkStatus(text("roomWaiting", { room: currentBoardLabel() }));
    render();
    return;
  }

  if (message.type === "rps_start") {
    networkSession.matchVoided = false;
    networkSession.roomCode = message.roomCode;
    networkSession.boardNumber = message.boardNumber || networkSession.boardNumber;
    networkSession.player = message.player || networkSession.player;
    resultModal.hidden = true;
    hideRematchToast();
    rematchRequested = false;
    rematchOfferedBy = null;
    state = createInitialState("pvp", networkSession.player);
    state.mode = "pvp";
    showNetworkRpsPicker();
    networkModal.hidden = false;
    setNetworkStatus(text("rpsPrompt"));
    render();
    return;
  }

  if (message.type === "rps_result") {
    if (message.result === "draw") {
      setNetworkStatus(text("rpsDraw"));
      setTimeout(() => {
        resetRpsButtons();
        setNetworkStatus(text("rpsPrompt"));
      }, 1200);
    } else if (message.result === "win") {
      const won = message.yourSide === "black";
      setNetworkStatus(won ? text("rpsWin") : text("rpsLose"));
      if (won) playPlacementSound();
    }
    render();
    return;
  }

  if (message.type === "match_start" || message.type === "state") {
    const previousDeploymentKey = lastDeploymentKey(state?.lastMove, state?.board);
    const previousTeleportKey = state?.teleporting
      ? `${state.teleporting.owner}:${state.teleporting.row}:${state.teleporting.col}`
      : "";
    const previousPendingSpecial = state?.pendingSpecial;
    const previousBoard = state?.board;
    networkSession.roomCode = message.roomCode || networkSession.roomCode;
    networkSession.boardNumber = message.boardNumber || networkSession.boardNumber;
    networkSession.player = message.player || networkSession.player;
    networkSession.ready = message.opponentConnected !== false;
    networkSession.opponentDisconnected = message.opponentConnected === false;
    state = message.state;
    const nextDeploymentKey = lastDeploymentKey(state.lastMove, state.board);
    if (nextDeploymentKey && nextDeploymentKey !== previousDeploymentKey) {
      pendingDeploymentAnimation = { row: state.lastMove.row, col: state.lastMove.col };
      playPlacementSound();
    }
    const nextTeleportKey = state?.teleporting
      ? `${state.teleporting.owner}:${state.teleporting.row}:${state.teleporting.col}`
      : "";
    if (message.type === "match_start") {
      lastTauntEventId = 0;
      if (cutsceneTimer !== null) {
        window.clearTimeout(cutsceneTimer);
        cutsceneTimer = null;
      }
      if (skillEffectTimer !== null) {
        window.clearTimeout(skillEffectTimer);
        skillEffectTimer = null;
      }
      visibleCutscene = null;
      activeSkillEffect = null;
      rematchRequested = false;
      rematchOfferedBy = null;
      hideRematchToast();
      resultModal.hidden = true;
      networkModal.hidden = true;
    }
    state.mode = "pvp";
    onlineTurnDeadline = message.turnDeadline || message.state?.turnDeadline || null;
    showNetworkRoomControls();
    networkModal.hidden = true;
    setNetworkStatus(networkSession.opponentDisconnected
      ? text("opponentDisconnected")
      : text("roomPlayer", { room: currentBoardLabel(), side: sideName(networkSession.player) }));
    if (state.tauntEvent?.id !== lastTauntEventId) showTauntBubble(state.tauntEvent);
    if (previousPendingSpecial && !state.pendingSpecial) {
      const specialType = previousPendingSpecial.type || previousPendingSpecial.unitType;
      if (specialType === "general") {
        const removedPieces = [];
        const pRow = previousPendingSpecial.row;
        const pCol = previousPendingSpecial.col;
        const adjacentCoords = [[pRow - 1, pCol], [pRow + 1, pCol], [pRow, pCol - 1], [pRow, pCol + 1]];
        for (const [ar, ac] of adjacentCoords) {
          if (ar >= 0 && ar < 9 && ac >= 0 && ac < 9) {
            const prevP = previousBoard?.[ar]?.[ac];
            const currP = state.board?.[ar]?.[ac];
            if (prevP && !currP && prevP.owner !== previousPendingSpecial.owner) {
              removedPieces.push({ row: ar, col: ac, owner: prevP.owner, unitType: prevP.type, revealed: prevP.revealed });
            }
          }
        }
        triggerGeneralSkillSequence({
          owner: previousPendingSpecial.owner,
          unitType: "general",
          row: previousPendingSpecial.row,
          col: previousPendingSpecial.col,
        }, removedPieces);
      } else {
        showSpecialCutscene({
          owner: previousPendingSpecial.owner,
          unitType: specialType,
          row: previousPendingSpecial.row,
          col: previousPendingSpecial.col,
        });
      }
    }
    render();
    return;
  }

  if (message.type === "rematch_offered") {
    rematchOfferedBy = message.byPlayer;
    if (rematchOfferedBy !== networkSession.player) {
      setNetworkStatus(text("opponentRematchOffered"));
      playPlacementSound();
      showRematchToast();
    }
    render();
    return;
  }

  if (message.type === "rematch_declined") {
    returnToNetworkLobby();
    return;
  }

  if (message.type === "suicide_warning") {
    openSuicideConfirmation({ source: "online", action: message.action, kind: message.kind });
    return;
  }

  if (message.type === "error") {
    if (message.message === "Opponent did not reconnect.") {
      returnToNetworkLobby();
      setNetworkStatus(text("opponentReconnectExpired"));
      return;
    }
    if (message.message === "Opponent disconnected.") {
      networkSession.ready = false;
      networkSession.opponentDisconnected = true;
      onlineTurnDeadline = null;
      hideRematchToast();
      setNetworkStatus(text("opponentDisconnected"));
      render();
      return;
    }
    setNetworkStatus(message.message || text("serverRejected"));
  }

  if (message.type === "match_voided" && message.reason === "server_restart") {
    onlineTurnDeadline = null;
    hideRematchToast();
    resultModal.hidden = true;
    state = createInitialState("pvp", "black");
    state.mode = "pvp";
    networkModal.hidden = false;
    showNetworkRoomControls();
    setNetworkStatus(text("serverRestartVoided"));
    render();
  }
}

function disconnectNetwork() {
  onlineTurnDeadline = null;
  hideRematchToast();
  rematchOfferedBy = null;
  rematchRequested = false;
  closeSuicideConfirmation({ restoreFocus: false });
  networkSession = closeNetworkConnection(networkSession);
}

function joinNetworkRoom(roomCode) {
  if (!roomCode) {
    setNetworkStatus(text("enterRoomCode"));
    return;
  }
  connectNetwork({
    type: "join_room",
    roomCode,
    protocolVersion: PROTOCOL_VERSION,
  });
}

newGameBtn.addEventListener("click", startNewGame);
function openSettingsModal() {
  syncSettingsControls();
  if (downloadJournalBtn) downloadJournalBtn.disabled = !currentPveJournalJsonl();
  settingsStatus.hidden = true;
  document.querySelector("#languageDropdown").open = false;
  settingsModal.hidden = false;
}

specialCharacterToggle.addEventListener("change", () => {
  setSpecialCharacterEnabled(specialCharacterToggle.checked);
});
settingsBtn.addEventListener("click", openSettingsModal);
lobbySettingsBtn.addEventListener("click", openSettingsModal);
musicToggle.addEventListener("change", () => {
  setMusicEnabled(musicToggle.checked);
});
sfxToggle.addEventListener("change", () => {
  setSfxEnabled(sfxToggle.checked);
  if (sfxToggle.checked) playPlacementSound();
});
downloadJournalBtn?.addEventListener("click", () => {
  downloadPveJournal();
  settingsStatus.hidden = false;
});
deleteAccountBtn?.addEventListener("click", () => {
  settingsModal.hidden = true;
  deleteAccountStatus.hidden = true;
  confirmDeleteAccountBtn.disabled = false;
  cancelDeleteAccountBtn.disabled = false;
  deleteAccountModal.hidden = false;
});
cancelDeleteAccountBtn?.addEventListener("click", () => {
  deleteAccountModal.hidden = true;
  settingsModal.hidden = false;
  deleteAccountBtn.focus();
});
confirmDeleteAccountBtn?.addEventListener("click", async () => {
  confirmDeleteAccountBtn.disabled = true;
  cancelDeleteAccountBtn.disabled = true;
  deleteAccountStatus.textContent = text("deletingAccount");
  deleteAccountStatus.hidden = false;
  try {
    await deleteOnlineAccount();
    disconnectNetwork();
    clearOnlineResumeTicket();
    deleteAccountModal.hidden = true;
    settingsModal.hidden = false;
    settingsStatus.textContent = text("accountDeleted");
    settingsStatus.hidden = false;
  } catch (error) {
    deleteAccountStatus.textContent = text(error?.code === "NO_SESSION" ? "noAccountToDelete" : "accountDeletionFailed");
    confirmDeleteAccountBtn.disabled = false;
    cancelDeleteAccountBtn.disabled = false;
  }
});
resultDownloadJournalBtn?.addEventListener("click", downloadPveJournal);
closeSettingsBtn.addEventListener("click", () => {
  settingsModal.hidden = true;
});
initAudioGesture();
matchDetailsBtn.addEventListener("click", () => {
  if (!state.winner || (state.mode !== "pve" && state.mode !== "pvp")) return;
  matchResultDetailsOpen = true;
  render();
  closeMatchDetailsBtn.focus();
});
closeMatchDetailsBtn.addEventListener("click", () => {
  matchResultDetailsOpen = false;
  render();
  matchDetailsBtn.focus();
});
resultModal.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  matchResultDetailsOpen = false;
  render();
  matchDetailsBtn.focus();
});
playAgainBtn.addEventListener("click", playAgain);
toastAcceptRematchBtn?.addEventListener("click", () => {
  hideRematchToast();
  playAgain();
});
toastDeclineRematchBtn?.addEventListener("click", () => {
  if (state.mode === "pvp") {
    sendNetworkAction({ type: "decline_rematch" });
  }
  returnToNetworkLobby();
});
createRoomBtn.addEventListener("click", () => connectNetwork({
  type: "create_room",
  protocolVersion: PROTOCOL_VERSION,
}));
refreshRoomListBtn.addEventListener("click", requestRoomList);
rpsButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const choice = button.dataset.rps;
    rpsButtons.forEach((b) => {
      b.disabled = true;
      b.classList.toggle("selected", b === button);
    });
    setNetworkStatus(text("rpsWaitingOpponent"));
    const sent = sendNetworkCommand(networkSession, {
      type: "rps_choice",
      roomCode: networkSession.roomCode,
      choice,
    });
    if (!sent) setNetworkStatus(text("notConnected"));
  });
});
pveRpsButtons.forEach((button) => {
  button.addEventListener("click", () => choosePveRps(button));
});
pveDifficultyButtons.forEach((button) => {
  button.addEventListener("click", () => applyPveRank(button.dataset.pveRank));
});
pveTimerButtons.forEach((button) => {
  button.addEventListener("click", () => applyPveTimerSetting(button.dataset.pveTimer === "on"));
});
pveRankList?.addEventListener("scroll", () => updatePveRankScrollCues(pveRankList));
cancelPveSideBtn.addEventListener("click", () => {
  resetPveRps();
  pveSideModal.hidden = true;
  modeModal.hidden = false;
});
closeChallengeBtn.addEventListener("click", () => {
  challengeModal.hidden = true;
  modeModal.hidden = false;
  renderProgressionUi();
});
cancelNetworkBtn.addEventListener("click", () => {
  disconnectNetwork();
  showNetworkRoomControls();
  networkModal.hidden = true;
  modeModal.hidden = false;
});
startTutorialBtn?.addEventListener("click", () => {
  proceedFromTutorialIntro();
});
tutorialLobbyBtn?.addEventListener("click", startNewGame);
nextTutorialBtn.addEventListener("click", () => {
  if (state.mode === "puzzle") {
    const solved = state.winner === activePuzzle?.player;
    if (solved && puzzleIndex + 1 >= PUZZLES.length) {
      returnToChallengeSelection();
      return;
    }
    loadPuzzle(solved ? puzzleIndex + 1 : puzzleIndex);
    return;
  }
  if (state.mode === "tutorial" && activePuzzle?.type === "tutorial" && tutorialStep >= TUTORIAL_STEPS.length) {
    if (puzzleIndex + 1 >= PUZZLES.length) returnToChallengeSelection();
    else loadPuzzle(puzzleIndex + 1);
    return;
  }
  if (
    state.mode === "tutorial"
    && !activePuzzle
    && tutorialStep === TUTORIAL_STEPS.length - 1
    && tutorialAwaitingContinue
    && tutorialCompletionPhase === "summary"
  ) {
    tutorialCompletionPhase = "challenge";
    render();
    return;
  }
  if (!tutorialAwaitingContinue || tutorialScriptRunning || tutorialReactionPhase) return;
  if (tutorialStep === 0 && tutorialSanctuaryPhase === "overview") {
    tutorialSanctuaryPhase = "duration";
    runTutorialScriptedDeployments(TUTORIAL_SANCTUARY_ACTIONS);
    return;
  }
  if (tutorialStep === 4 && tutorialSpecialIntroPhase === "overview") {
    tutorialSpecialIntroPhase = "practice";
    tutorialAwaitingContinue = false;
    runTutorialScriptedDeployments(TUTORIAL_GENERAL_SETUP_ACTIONS);
    return;
  }
  if (beginTutorialSpecialReaction()) return;
  advanceTutorial();
  render();
});
exitTutorialBtn.addEventListener("click", returnToChallengeSelection);
modeStartButtons.forEach((button) => {
  button.addEventListener("click", () => selectGameMode(button.dataset.startMode, true));
});
modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    selectGameMode(input.value);
  });
});
unitInputs.forEach((input) => {
  input.closest("label").addEventListener("click", () => {
    if (input.disabled || !SPECIALS.has(input.value)) return;
    window.setTimeout(() => {
      input.checked = true;
      render();
    }, 0);
  });
  input.addEventListener("change", () => {
    render();
  });
});
document.addEventListener("click", (event) => {
  const dropdown = document.querySelector("#languageDropdown");
  if (dropdown.open && !dropdown.contains(event.target)) dropdown.open = false;
});
document.querySelector("#languageDropdown").addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.open = false;
  event.currentTarget.querySelector("summary").focus();
});
languageSelect.addEventListener("change", (event) => {
  const nextLanguage = event.target.value === "ko" ? "ko" : "en";
  if (nextLanguage === LANGUAGE) return;
  localStorage.setItem("unknown-kingdom-language", nextLanguage);
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set("lang", nextLanguage);
  location.href = nextUrl.toString();
});

applyLanguage();
renderPveRankOptions();
renderPveTimerOptions();
state = newState();
renderProgressionUi();
const showingDemo = applyLocalDemo();
if (showingDemo && new URLSearchParams(location.search).get("demo") === "no-move") {
  modeModal.hidden = true;
  commitSharedLocalAction(state.turn, { type: "pass" });
}

window.setInterval(() => {
  if (!isGameActive() || state?.winner) return;

  if (state.mode === "pvp" && onlineTurnDeadline) {
    updateTurnTimerPill(turnPill, {
      state,
      onlineTurnDeadline,
      pveTurnDeadline: null,
      pveHumanPlayer,
      text,
      sideName,
    });
  } else if (activePveTimerEnabled && !DEVELOPER_MODE && state.mode === "pve" && state.turn === pveHumanPlayer && pveTurnDeadline) {
    if (Date.now() >= pveTurnDeadline) {
      pveTurnDeadline = null;
      const { action, options } = pveDeadlineAction(hasLegalDeployment(state, pveHumanPlayer));
      applySharedPveAction(pveHumanPlayer, action, options);
      render();
    } else {
      updateTurnTimerPill(turnPill, {
        state,
        onlineTurnDeadline: null,
        pveTurnDeadline,
        pveHumanPlayer,
        text,
        sideName,
      });
    }
  }
}, 250);
render();
if (showingDemo) scheduleAiTurn();
enterLobbyAfterSplash(showingDemo);

// FX Preview Toolbar Controller
const fxPreviewBar = document.querySelector("#fxPreviewBar");
const toggleFxBarBtn = document.querySelector("#toggleFxBarBtn");
const fxGeneralBtn = document.querySelector("#fxGeneralBtn");
const fxDiplomatBtn = document.querySelector("#fxDiplomatBtn");
const fxGeneralCutinBtn = document.querySelector("#fxGeneralCutinBtn");
const fxDiplomatCutinBtn = document.querySelector("#fxDiplomatCutinBtn");
const fxWizardCutinBtn = document.querySelector("#fxWizardCutinBtn");
const fxKingTauntBtn = document.querySelector("#fxKingTauntBtn");
const fxSideToggleBtn = document.querySelector("#fxSideToggleBtn");
const fxLoopToggleBtn = document.querySelector("#fxLoopToggleBtn");

fxPreviewBar?.toggleAttribute("hidden", !DEVELOPER_MODE);

let fxPreviewSide = "black";
let fxLoopActive = false;
let fxLoopInterval = null;

function setupGeneralDemoBoard(side = "black", shouldRender = true) {
  const opponent = side === "black" ? "white" : "black";
  if (modeModal) modeModal.hidden = true;
  state.mode = "pve";
  state.board = Array.from({ length: 9 }, () => Array(9).fill(null));
  state.board[4][4] = { id: "demo-general", type: "general", owner: side, revealed: true, abilityUsed: false };
  state.board[3][4] = { id: "demo-enemy-1", type: "soldier", owner: opponent, revealed: false };
  state.board[5][4] = { id: "demo-enemy-2", type: "soldier", owner: opponent, revealed: false };
  state.board[4][3] = { id: "demo-enemy-3", type: "soldier", owner: opponent, revealed: false };
  state.board[4][5] = { id: "demo-enemy-4", type: "soldier", owner: opponent, revealed: false };
  state.winner = null;
  state.selected = null;
  if (shouldRender) render();
}

function playGeneralDemo() {
  setupGeneralDemoBoard(fxPreviewSide, false);
  const opponent = fxPreviewSide === "black" ? "white" : "black";
  const removedEvents = [
    { row: 3, col: 4, owner: opponent, unitType: "soldier", pieceId: "demo-enemy-1", reason: "general_reaction" },
    { row: 5, col: 4, owner: opponent, unitType: "soldier", pieceId: "demo-enemy-2", reason: "general_reaction" },
    { row: 4, col: 3, owner: opponent, unitType: "soldier", pieceId: "demo-enemy-3", reason: "general_reaction" },
    { row: 4, col: 5, owner: opponent, unitType: "soldier", pieceId: "demo-enemy-4", reason: "general_reaction" },
  ];
  state.board[3][4] = null;
  state.board[5][4] = null;
  state.board[4][3] = null;
  state.board[4][5] = null;
  if (state.board[4][4]) state.board[4][4].abilityUsed = true;
  triggerGeneralSkillSequence({
    owner: fxPreviewSide,
    unitType: "general",
    row: 4,
    col: 4,
  }, removedEvents);
}

function setupDiplomatDemoBoard(side = "black", shouldRender = true) {
  const opponent = side === "black" ? "white" : "black";
  if (modeModal) modeModal.hidden = true;
  state.mode = "pve";
  state.board = Array.from({ length: 9 }, () => Array(9).fill(null));
  state.board[4][4] = { id: "demo-diplomat", type: "diplomat", owner: side, revealed: true, abilityUsed: false };
  state.board[3][4] = { id: "demo-enemy-1", type: "soldier", owner: opponent, revealed: false };
  state.board[5][4] = { id: "demo-enemy-2", type: "soldier", owner: opponent, revealed: false };
  state.board[4][3] = { id: "demo-enemy-3", type: "soldier", owner: opponent, revealed: false };
  state.board[4][5] = { id: "demo-enemy-4", type: "soldier", owner: opponent, revealed: false };
  state.winner = null;
  state.selected = null;
  if (shouldRender) render();
}

function playDiplomatDemo() {
  setupDiplomatDemoBoard(fxPreviewSide, false);
  const opponent = fxPreviewSide === "black" ? "white" : "black";
  const convertedPieces = [
    { row: 3, col: 4, fromOwner: opponent, toOwner: fxPreviewSide, pieceId: "demo-enemy-1" },
    { row: 5, col: 4, fromOwner: opponent, toOwner: fxPreviewSide, pieceId: "demo-enemy-2" },
    { row: 4, col: 3, fromOwner: opponent, toOwner: fxPreviewSide, pieceId: "demo-enemy-3" },
    { row: 4, col: 5, fromOwner: opponent, toOwner: fxPreviewSide, pieceId: "demo-enemy-4" },
  ];
  state.board[3][4] = { id: "demo-enemy-1", type: "soldier", owner: fxPreviewSide, revealed: false, abilityUsed: true };
  state.board[5][4] = { id: "demo-enemy-2", type: "soldier", owner: fxPreviewSide, revealed: false, abilityUsed: true };
  state.board[4][3] = { id: "demo-enemy-3", type: "soldier", owner: fxPreviewSide, revealed: false, abilityUsed: true };
  state.board[4][5] = { id: "demo-enemy-4", type: "soldier", owner: fxPreviewSide, revealed: false, abilityUsed: true };
  if (state.board[4][4]) state.board[4][4].abilityUsed = true;
  triggerDiplomatSkillSequence({
    owner: fxPreviewSide,
    unitType: "diplomat",
    row: 4,
    col: 4,
  }, convertedPieces);
}

function setupWizardDemoBoard(side = "black", shouldRender = true) {
  const opponent = side === "black" ? "white" : "black";
  if (modeModal) modeModal.hidden = true;
  state.mode = "pve";
  state.board = Array.from({ length: 9 }, () => Array(9).fill(null));
  state.board[4][4] = { id: "demo-wizard", type: "wizard", owner: side, revealed: true, abilityUsed: false };
  state.board[3][4] = { id: "demo-enemy-1", type: "soldier", owner: opponent, revealed: false };
  state.board[5][4] = { id: "demo-enemy-2", type: "soldier", owner: opponent, revealed: false };
  state.board[4][3] = { id: "demo-enemy-3", type: "soldier", owner: opponent, revealed: false };
  state.board[4][5] = { id: "demo-enemy-4", type: "soldier", owner: opponent, revealed: false };
  state.winner = null;
  state.selected = null;
  if (shouldRender) render();
}

function playWizardDemo() {
  setupWizardDemoBoard(fxPreviewSide, false);
  const opponent = fxPreviewSide === "black" ? "white" : "black";
  const removedEvents = [
    { row: 3, col: 4, owner: opponent, unitType: "soldier", pieceId: "demo-enemy-1", reason: "wizard_reaction" },
    { row: 5, col: 4, owner: opponent, unitType: "soldier", pieceId: "demo-enemy-2", reason: "wizard_reaction" },
    { row: 4, col: 3, owner: opponent, unitType: "soldier", pieceId: "demo-enemy-3", reason: "wizard_reaction" },
    { row: 4, col: 5, owner: opponent, unitType: "soldier", pieceId: "demo-enemy-4", reason: "wizard_reaction" },
  ];
  state.board[3][4] = null;
  state.board[5][4] = null;
  state.board[4][3] = null;
  state.board[4][5] = null;
  if (state.board[4][4]) state.board[4][4].abilityUsed = true;
  triggerWizardSkillSequence({
    owner: fxPreviewSide,
    unitType: "wizard",
    row: 4,
    col: 4,
  }, removedEvents);
}

toggleFxBarBtn?.addEventListener("click", () => {
  fxPreviewBar?.classList.toggle("collapsed");
  if (toggleFxBarBtn && fxPreviewBar) {
    toggleFxBarBtn.textContent = fxPreviewBar.classList.contains("collapsed") ? "열기" : "최소화";
  }
});

fxGeneralBtn?.addEventListener("click", () => {
  playGeneralDemo();
});

fxDiplomatBtn?.addEventListener("click", () => {
  setCoinDesign("a");
  playDiplomatDemo();
});

const fxWizardBtn = document.querySelector("#fxWizardBtn");
fxWizardBtn?.addEventListener("click", () => {
  playWizardDemo();
});

fxGeneralCutinBtn?.addEventListener("click", () => {
  if (modeModal) modeModal.hidden = true;
  showSpecialCutscene({ owner: fxPreviewSide, unitType: "general", row: 4, col: 4, durationMs: 2000 });
});

fxDiplomatCutinBtn?.addEventListener("click", () => {
  if (modeModal) modeModal.hidden = true;
  showSpecialCutscene({ owner: fxPreviewSide, unitType: "diplomat", row: 4, col: 4, durationMs: 2000 });
});

fxWizardCutinBtn?.addEventListener("click", () => {
  if (modeModal) modeModal.hidden = true;
  showSpecialCutscene({ owner: fxPreviewSide, unitType: "wizard", row: 4, col: 4, durationMs: 2000 });
});

fxKingTauntBtn?.addEventListener("click", () => {
  if (modeModal) modeModal.hidden = true;
  showTauntBubble({ speakerOwner: fxPreviewSide, id: Date.now() });
});

fxSideToggleBtn?.addEventListener("click", () => {
  fxPreviewSide = fxPreviewSide === "black" ? "white" : "black";
  fxSideToggleBtn.textContent = fxPreviewSide === "black" ? "진영: 흑 (Black)" : "진영: 백 (White)";
  if (fxPreviewSide === "white") {
    fxSideToggleBtn.classList.add("fx-btn-active");
  } else {
    fxSideToggleBtn.classList.remove("fx-btn-active");
  }
});

fxLoopToggleBtn?.addEventListener("click", () => {
  fxLoopActive = !fxLoopActive;
  if (fxLoopActive) {
    fxLoopToggleBtn.textContent = "🔁 반복 재생: ON";
    fxLoopToggleBtn.classList.add("fx-btn-active");
    playWizardDemo();
    fxLoopInterval = window.setInterval(() => {
      playWizardDemo();
    }, 3100);
  } else {
    fxLoopToggleBtn.textContent = "🔁 반복 재생: OFF";
    fxLoopToggleBtn.classList.remove("fx-btn-active");
    if (fxLoopInterval) {
      window.clearInterval(fxLoopInterval);
      fxLoopInterval = null;
    }
  }
});

window.playGeneralDemo = playGeneralDemo;
window.setupGeneralDemoBoard = setupGeneralDemoBoard;
window.playDiplomatDemo = playDiplomatDemo;
window.setupDiplomatDemoBoard = setupDiplomatDemoBoard;
window.playWizardDemo = playWizardDemo;
window.setupWizardDemoBoard = setupWizardDemoBoard;

const urlParams = new URLSearchParams(location.search);
if (urlParams.has("coin")) {
  setCoinDesign(urlParams.get("coin"));
}
if (urlParams.has("fx") || urlParams.get("demo") === "fx") {
  if (splashModal) splashModal.hidden = true;
  if (modeModal) modeModal.hidden = true;
  window.setTimeout(() => {
    if (urlParams.get("fx") === "wizard") {
      playWizardDemo();
    } else if (urlParams.get("fx") === "diplomat") {
      playDiplomatDemo();
    } else {
      playGeneralDemo();
    }
  }, 400);
}
