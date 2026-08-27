import {
  DEPLOY_ORDER,
  PVE_AI,
  PVE_HUMAN,
  SIZE,
  SPECIALS,
  createUnitLabels,
} from "./js/config.js?v=release-20260824-1";
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
import { createTranslator } from "./js/i18n.js?v=disconnect-state-1";
import {
  buildNetworkUrl,
  connectNetwork as openNetworkConnection,
  createNetworkSession,
  disconnectNetwork as closeNetworkConnection,
  sendNetworkCommand,
  sendNetworkAction as sendNetworkMessage,
} from "./js/network.js?v=disconnect-state-1";
import {
  createInitialState,
  createOccupiedSoldier,
  createPiece,
} from "./js/state.js?v=resume-turn-1";
import {
  renderGame,
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
} from "./js/shared-engine-adapter.mjs?v=local-shared-1";
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
  disableChallengeGuidance,
  enableChallengeGuidance,
  getSavedLanguage,
  isChallengeGuidanceEnabled,
  isPveTimerEnabled,
  setPveTimerEnabled,
  setSavedLanguage,
} from "./js/settings.js?v=release-20260824-1";
import {
  challengeProgress,
  firstUnresolvedRankIndex,
  isValidPuzzlePiece,
  localizedPuzzleText,
  markPuzzleComplete as persistPuzzleComplete,
  normalizePuzzleStock,
} from "./js/puzzle-controller.js";
import {
  renderOpenRoomsList,
  resetRpsButtons as uiResetRpsButtons,
  showNetworkRoomControls as uiShowNetworkRoomControls,
  showNetworkRpsPicker as uiShowNetworkRpsPicker,
} from "./js/online-ui.js";

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
const DEVELOPER_MODE = requestedDeveloperMode === "1"
  || (requestedDeveloperMode !== "0" && isLocalHost);
const defaultNetworkServer = isLocalHost
  ? `ws://${location.hostname}:4175/ws`
  : "wss://unknown-kingdom-server.onrender.com/ws";
const NETWORK_SERVER = requestedServer || (isLocalHost ? defaultNetworkServer : (localStorage.getItem("unknown-kingdom-server") || defaultNetworkServer));
const UNIT_LABELS = createUnitLabels(LANGUAGE);
const text = createTranslator(LANGUAGE);

document.body.classList.toggle("iphone-preview", PREVIEW_MODE === "iphone");

function lastDeploymentKey(move) {
  if (!move || move.action) return "";
  if (!Number.isInteger(move.row) || !Number.isInteger(move.col)) return "";
  return `${move.player}:${move.unitType}:${move.row}:${move.col}`;
}

let state;
let undoStack = [];
let aiTimer = null;
let tauntTimer = null;
let visibleTaunt = null;
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
let tutorialAwaitingContinue = false;
let tutorialKingPosition = null;
let tutorialReactionPending = false;
let tutorialReactionPhase = null;
let tutorialTimer = null;
let puzzleIndex = 0;
let activePuzzle = null;
let puzzleMoves = 0;
let puzzleInitialCaptures = null;
let puzzleCompleted = false;
let openRooms = [];
let selectedOpenRoomCode = "";
let wizardMovePromptDismissed = false;
let rematchRequested = false;
let pendingSuicideConfirmation = null;
let suicideConfirmReturnFocus = null;
let pveJournalRecorder = null;
let pveJournalGameId = null;

const AI_MOVE_DELAY_MS = 600;
const AI_SPECIAL_REVEAL_DELAY_MS = 1500;
const AI_WIZARD_TELEPORT_DELAY_MS = 900;
const TUTORIAL_SPECIAL_SURROUND_DELAY_MS = 1200;
const TUTORIAL_SPECIAL_ACTIVATE_DELAY_MS = 1600;
const TAUNT_DISPLAY_MS = 3000;
const SPLASH_MIN_DURATION_MS = 2500;
const SPLASH_SERVER_TIMEOUT_MS = 2000;
const PVE_TURN_LIMIT_MS = 30000;
const PVE_JOURNAL_STORAGE_KEY = "unknown-kingdom-latest-pve-jsonl";

const TUTORIAL_STEPS = [
  { unitType: "king", owner: "blue", row: 7, col: 4, message: "tutorialKing", placedMessage: "tutorialKingPlaced" },
  {
    unitType: "soldier",
    owner: "blue",
    row: 4,
    col: 5,
    message: "tutorialCapture",
    placedMessage: "tutorialCapturePlaced",
    setup: "capture",
    hideHint: true,
  },
  {
    unitType: "soldier",
    owner: "red",
    row: 8,
    col: 3,
    message: "tutorialWallDefense",
    placedMessage: "tutorialWallDefensePlaced",
    setup: "wall-defense",
  },
  {
    unitType: "soldier",
    owner: "blue",
    row: 8,
    col: 7,
    message: "tutorialWallCapture",
    placedMessage: "tutorialWallCapturePlaced",
    setup: "wall-capture",
  },
  {
    unitType: "general",
    owner: "blue",
    row: 4,
    col: 4,
    message: "tutorialGeneral",
    placedMessage: "tutorialGeneralPlaced",
    setup: "special",
    reaction: true,
  },
  {
    unitType: "diplomat",
    owner: "blue",
    row: 4,
    col: 4,
    message: "tutorialDiplomat",
    placedMessage: "tutorialDiplomatPlaced",
    setup: "special",
    reaction: true,
  },
  {
    unitType: "wizard",
    owner: "blue",
    row: 4,
    col: 4,
    message: "tutorialWizard",
    placedMessage: "tutorialWizardPlaced",
    setup: "special",
    reaction: true,
  },
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
const redCount = document.querySelector("#redCount");
const blueCount = document.querySelector("#blueCount");
const confirmTeleportBtn = document.querySelector("#confirmTeleportBtn");
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
const pveSideButtons = document.querySelectorAll("[data-pve-side]");
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
const createRoomBtn = document.querySelector("#createRoomBtn");
const cancelNetworkBtn = document.querySelector("#cancelNetworkBtn");
const resultModal = document.querySelector("#resultModal");
const playAgainBtn = document.querySelector("#playAgainBtn");
const resultRematchNotice = document.querySelector("#resultRematchNotice");
const resultLobbyBtn = document.querySelector("#resultLobbyBtn");
const resultDownloadJournalBtn = document.querySelector("#resultDownloadJournalBtn");
const rematchToast = document.querySelector("#rematchToast");
const rematchToastTitle = document.querySelector("#rematchToastTitle");
const toastAcceptRematchBtn = document.querySelector("#toastAcceptRematchBtn");
const toastDeclineRematchBtn = document.querySelector("#toastDeclineRematchBtn");
const pendingSpecialModal = document.querySelector("#pendingSpecialModal");
const pendingSpecialTitle = document.querySelector("#pendingSpecialTitle");
const pendingSpecialText = document.querySelector("#pendingSpecialText");
const activateSpecialBtn = document.querySelector("#activateSpecialBtn");
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
const downloadJournalBtn = document.querySelector("#downloadJournalBtn");
const closeSettingsBtn = document.querySelector("#closeSettingsBtn");
const languageSelect = document.querySelector("#languageSelect");
const musicToggle = document.querySelector("#musicToggle");
const sfxToggle = document.querySelector("#sfxToggle");
const specialHelpToggle = document.querySelector("#specialHelpToggle");

downloadJournalBtn?.toggleAttribute("hidden", !DEVELOPER_MODE);
resultDownloadJournalBtn?.toggleAttribute("hidden", !DEVELOPER_MODE);
const tutorialPanel = document.querySelector("#tutorialPanel");
const tutorialStepLabel = document.querySelector("#tutorialStepLabel");
const tutorialMessage = document.querySelector("#tutorialMessage");
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

function primaryModesUnlocked() {
  return true;
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
  const unlocked = primaryModesUnlocked();
  for (const mode of ["pve", "pvp"]) {
    const button = document.querySelector(`[data-start-mode="${mode}"]`);
    if (!button) continue;
    button.disabled = !unlocked;
    button.classList.toggle("locked", !unlocked);
    button.querySelector(".mode-lock-icon")?.remove();
    button.removeAttribute("title");
    button.removeAttribute("data-lock-label");
    if (unlocked) {
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
  if (state.mode === "puzzle" || state.mode === "tutorial") return text("puzzle");
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
  if (networkSession.ready) return LANGUAGE === "ko" ? "접속 중" : "Connected";
  if (networkSession.connected && networkSession.opponentDisconnected) return text("opponentDisconnected");
  if (networkSession.connected) return LANGUAGE === "ko" ? "대기 중" : "Waiting";
  return LANGUAGE === "ko" ? "연결 끊김" : "Disconnected";
}

function syncSettingsControls() {
  languageSelect.value = LANGUAGE;
  musicToggle.checked = isMusicEnabled();
  sfxToggle.checked = isSfxEnabled();
  specialHelpToggle.checked = isChallengeGuidanceEnabled();
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
  languageSelect.value = LANGUAGE;
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
  resultLobbyBtn.setAttribute("aria-label", text("lobby"));
  resultLobbyBtn.title = text("lobby");
  const logoLanguage = LANGUAGE === "ko" ? "ko" : "en";
  const isOldLogo = new URLSearchParams(window.location.search).get("logo") === "old";
  if (isOldLogo) {
    splashLogo.src = `./assets/ui/daeguk-logo-${logoLanguage}-old.svg?v=${ASSET_VERSION}`;
    lobbyLogo.src = `./assets/ui/daeguk-logo-${logoLanguage}-old.svg?v=${ASSET_VERSION}`;
    lobbyLogo.alt = text("appTitle");
  } else {
    splashLogo.src = `./assets/ui/daeguk-logo-${logoLanguage}.svg?v=${ASSET_VERSION}`;
    lobbyLogo.src = `./assets/ui/daeguk-logo-lobby.svg?v=${ASSET_VERSION}`;
    lobbyLogo.alt = "DAEGUK";
  }
  splashLogo.alt = text("appTitle");
  splashTitle.textContent = text("brandMain");
  splashSubtitle.textContent = text("brandSubtitle");
  splashSubtitle.classList.toggle("korean-title", LANGUAGE === "ko");
  lobbyBrandMain.textContent = text("brandMain");
  lobbyBrandSubtitle.textContent = text("brandSubtitle");
  lobbyBrandSubtitle.classList.toggle("korean-title", LANGUAGE === "ko");
  confirmTeleportBtn.textContent = text("wizardMoveButton");
  cancelTeleportBtn.textContent = text("cancelAbility");
  setIconButtonLabel(nextTutorialBtn, "nextTutorial");
  setIconButtonLabel(exitTutorialBtn, "backToChallenges");
  document.querySelector(".red-counter").setAttribute("aria-label", text("redUnits"));
  document.querySelector(".blue-counter").setAttribute("aria-label", text("blueUnits"));
  if (rematchToastTitle) rematchToastTitle.textContent = text("rematchOfferedToast");
  if (toastAcceptRematchBtn) toastAcceptRematchBtn.textContent = text("acceptRematch");
  if (toastDeclineRematchBtn) toastDeclineRematchBtn.textContent = text("declineRematch");
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
  const container = document.getElementById("pveRankList") || document.querySelector(".difficulty-choice-actions");
  if (!container) return;
  const rankKeys = AI_RANK_ORDER;
  if (!selectedPveRank || !rankKeys.includes(selectedPveRank)) selectedPveRank = rankKeys[0];

  container.innerHTML = "";
  rankKeys.forEach((rankKey) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "challenge-rank-button";
    button.dataset.pveRank = rankKey;
    button.dataset.pveDifficulty = rankKey;
    button.textContent = AI_RANK_LABELS[LANGUAGE][rankKey] || RANK_LABELS[LANGUAGE][rankKey] || rankKey;
    button.addEventListener("click", () => applyPveRank(rankKey));
    container.appendChild(button);
  });
  applyPveRank(selectedPveRank);
  requestAnimationFrame(() => {
    const selectedBtn = container.querySelector(`[data-pve-rank="${selectedPveRank}"]`);
    if (selectedBtn) {
      container.scrollTop = Math.max(0, selectedBtn.offsetTop - container.offsetTop);
    }
  });
}

function applyPveRank(rankKey) {
  selectedPveRank = rankKey || AI_RANK_ORDER[0];
  pveDifficulty = selectedPveRank;
  const container = document.getElementById("pveRankList") || document.querySelector(".difficulty-choice-actions");
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
      return createOccupiedSoldier("red");
    }),
  );
  state.board[8][4] = createPiece("blue", "king");
  state.turn = "blue";
  state.firstDeployDone = { red: true, blue: true };
  state.stock.blue = { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.stock.red = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.log = ["No-move demo: White has no legal deployment, but the board is not full."];
  return true;
}

function applyWizardTeleportDemo() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return false;
  if (new URLSearchParams(location.search).get("demo") !== "wizard-teleport") return false;

  selectModeChoice("pve");
  pveHumanPlayer = "blue";
  pveAiPlayer = "red";
  state = createInitialState("pve", pveHumanPlayer);
  state.aiDifficulty = pveDifficulty;
  state.aiRank = selectedPveRank;
  state.board[4][4] = createPiece("blue", "soldier");
  state.board[4][4].originalType = "wizard";
  state.board[4][4].abilityUsed = true;
  state.board[4][4].revealed = true;
  state.board[3][4] = createOccupiedSoldier("red");
  state.board[4][3] = createOccupiedSoldier("red");
  state.board[4][5] = createOccupiedSoldier("red");
  state.teleporting = { row: 4, col: 4, owner: "blue", reaction: true };
  wizardMovePromptDismissed = false;
  state.turn = "blue";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.stock.blue = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.stock.red = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.log = ["Wizard move demo: choose an empty cell or stay in place."];
  modeModal.hidden = true;
  pveSideModal.hidden = true;
  return true;
}

function applySuicideWarningDemo() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return false;
  if (new URLSearchParams(location.search).get("demo") !== "suicide-warning") return false;

  selectModeChoice("pve");
  pveHumanPlayer = "blue";
  pveAiPlayer = "red";
  state = createInitialState("pve", pveHumanPlayer);
  state.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  state.board[8][0] = createPiece("blue", "king");
  state.board[3][4] = createOccupiedSoldier("red");
  state.board[5][4] = createOccupiedSoldier("red");
  state.board[4][3] = createOccupiedSoldier("red");
  state.board[4][5] = createOccupiedSoldier("red");
  state.turn = "blue";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.stock.blue = { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.stock.red = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.log = ["Suicide warning demo: place the White Soldier at E5."];
  modeModal.hidden = true;
  pveSideModal.hidden = true;
  return true;
}

function applyCapture38Demo() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return false;
  if (new URLSearchParams(location.search).get("demo") !== "capture-38") return false;

  selectModeChoice("pve");
  pveHumanPlayer = "red";
  pveAiPlayer = "blue";
  state = createInitialState("pve", pveHumanPlayer);
  state.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const pieces = [
    ["blue", "soldier", 0, 4], ["blue", "soldier", 0, 5], ["blue", "soldier", 0, 6],
    ["red", "soldier", 0, 7], ["blue", "soldier", 1, 3], ["red", "soldier", 1, 4],
    ["blue", "soldier", 1, 5], ["red", "soldier", 1, 6], ["blue", "soldier", 1, 7],
    ["red", "soldier", 2, 2], ["blue", "soldier", 2, 3], ["red", "soldier", 2, 4],
    ["red", "soldier", 2, 5], ["red", "soldier", 2, 6], ["blue", "soldier", 2, 7],
    ["blue", "soldier", 3, 3], ["red", "soldier", 3, 4], ["red", "soldier", 3, 5],
    ["red", "soldier", 3, 6], ["blue", "soldier", 3, 7], ["blue", "general", 4, 3],
    ["red", "king", 4, 4], ["blue", "wizard", 4, 5], ["red", "soldier", 5, 2],
    ["red", "soldier", 5, 3], ["blue", "soldier", 5, 4], ["red", "soldier", 6, 2],
    ["blue", "soldier", 6, 3], ["blue", "soldier", 6, 4], ["blue", "soldier", 6, 5],
    ["red", "soldier", 7, 1], ["red", "soldier", 7, 2], ["blue", "soldier", 7, 3],
    ["blue", "king", 7, 4], ["red", "soldier", 7, 5], ["red", "soldier", 7, 6],
    ["blue", "soldier", 8, 3], ["red", "soldier", 8, 4],
  ];
  for (const [owner, type, row, col] of pieces) state.board[row][col] = createPiece(owner, type);
  state.turn = "red";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 19, blue: 19 };
  state.stock.red = { soldier: 61, king: 0, general: 0, diplomat: 1, wizard: 1 };
  state.stock.blue = { soldier: 61, king: 0, general: 0, diplomat: 1, wizard: 0 };
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
  pveHumanPlayer = "blue";
  pveAiPlayer = "red";
  state = createInitialState(onlineDemo ? "pvp" : "pve", pveHumanPlayer);
  state.aiRank = selectedPveRank;
  state.board[4][4] = createPiece("red", "king");
  state.board[3][4] = createOccupiedSoldier("red");
  state.board[5][4] = createOccupiedSoldier("blue");
  state.stats.captures = { red: 7, blue: 4 };
  state.stats.specialsUsed = { red: 2, blue: 1 };
  state.winner = "red";
  state.resultReason = "blue King was captured.";
  if (onlineDemo) {
    networkSession.player = "blue";
    networkSession.ready = true;
  }
  modeModal.hidden = true;
  pveSideModal.hidden = true;
  return true;
}

function applyLocalDemo() {
  return applyCapture38Demo() || applyMatchResultDemo() || applyNoMoveDemo() || applyWizardTeleportDemo() || applySuicideWarningDemo();
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
    const expected = TUTORIAL_STEPS[tutorialStep];
    return Boolean(expected)
      && !tutorialAwaitingContinue
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
  if (!beginTutorialSpecialReaction()) render();
}

function selectTutorialUnit(unitType) {
  const input = document.querySelector(`input[name="unit"][value="${unitType}"]`);
  if (input) input.checked = true;
}

function setTutorialCaptureBoard() {
  resetTutorialBoard();
  state.board[3][4] = createOccupiedSoldier("blue");
  state.board[5][4] = createOccupiedSoldier("blue");
  state.board[4][3] = createOccupiedSoldier("blue");
  state.board[4][4] = createOccupiedSoldier("red");
}

function resetTutorialBoard() {
  state.lastMove = null;
  state.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  if (activePuzzle?.type !== "tutorial") {
    const king = tutorialKingPosition || { row: 7, col: 4 };
    state.board[king.row][king.col] = createPiece("blue", "king");
  }
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.stock.red = { soldier: 20, king: 1, general: 1, diplomat: 1, wizard: 1 };
  state.stock.blue = { soldier: 20, king: 1, general: 1, diplomat: 1, wizard: 1 };
}

function setTutorialWallDefenseBoard() {
  resetTutorialBoard();
  state.board[8][2] = createOccupiedSoldier("blue");
  state.board[8][1] = createOccupiedSoldier("red");
  state.board[7][2] = createOccupiedSoldier("red");
}

function setTutorialWallCaptureBoard() {
  resetTutorialBoard();
  state.board[8][6] = createOccupiedSoldier("red");
  state.board[8][5] = createOccupiedSoldier("blue");
  state.board[7][6] = createOccupiedSoldier("blue");
}

function setTutorialSpecialBoard() {
  resetTutorialBoard();
  state.board[3][4] = createOccupiedSoldier("red");
  state.board[5][4] = createOccupiedSoldier("red");
  state.board[4][3] = createOccupiedSoldier("red");
}

function advanceTutorial() {
  tutorialAwaitingContinue = false;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
  tutorialStep += 1;
  state.selected = null;
  state.lastMove = null;
  state.winner = null;
  state.resultReason = "";
  const expected = TUTORIAL_STEPS[tutorialStep];
  if (!expected) {
    if (activePuzzle?.type === "tutorial") {
      markPuzzleComplete(puzzleIndex);
      state.winner = "blue";
    }
    return;
  }
  if (expected.setup === "wall-defense") setTutorialWallDefenseBoard();
  if (expected.setup === "wall-capture") setTutorialWallCaptureBoard();
  if (expected.setup === "capture") setTutorialCaptureBoard();
  if (expected.setup === "special") setTutorialSpecialBoard();
  state.turn = expected.owner;
  selectTutorialUnit(expected.unitType);
}

function beginTutorialSpecialReaction() {
  if (!tutorialReactionPending || tutorialReactionPhase) return false;
  tutorialReactionPending = false;
  tutorialReactionPhase = "preparing";
  render();
  tutorialTimer = window.setTimeout(() => {
    state.turn = "red";
    const surrounded = commitSharedLocalAction("red", {
      type: "deploy",
      unitType: "soldier",
      row: 4,
      col: 5,
    });
    if (surrounded !== "accepted") {
      tutorialTimer = null;
      tutorialReactionPhase = null;
      addLog("Tutorial reaction could not be prepared.");
      render();
      return;
    }
    tutorialReactionPhase = "surrounded";
    render();
    tutorialTimer = window.setTimeout(() => {
      tutorialTimer = null;
      tutorialReactionPhase = null;
      commitSharedLocalAction("blue", { type: "activate_special" });
      render();
    }, TUTORIAL_SPECIAL_ACTIVATE_DELAY_MS);
  }, TUTORIAL_SPECIAL_SURROUND_DELAY_MS);
  return true;
}

function startTutorial({ puzzleEntry = false, index = 0 } = {}) {
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  tutorialTimer = null;
  disconnectNetwork();
  networkModal.hidden = true;
  puzzleIndex = index;
  activePuzzle = puzzleEntry ? PUZZLES[puzzleIndex] : null;
  puzzleMoves = 0;
  puzzleCompleted = false;
  undoStack = [];
  state = createInitialState("tutorial");
  state.turn = "blue";
  state.stock.blue = { soldier: 20, king: 1, general: 1, diplomat: 1, wizard: 1 };
  state.stock.red = { soldier: 20, king: 1, general: 1, diplomat: 1, wizard: 1 };
  tutorialStep = 0;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
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
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  tutorialTimer = null;
  tutorialStep = -1;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
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
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
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
  state.winner = "blue";
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
  const viewer = state.mode === "tutorial" ? "blue" : pveHumanPlayer;
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
  if (state.mode === "pve") persistPveJournal();
  return "accepted";
}

function pveJournalOutcome() {
  if (!state?.winner) return null;
  return {
    winner: state.winner,
    reason: state.resultReason || null,
    finalPieces: { red: countPieces("red"), blue: countPieces("blue") },
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
  for (const event of events) {
    if (event.type === "piece_deployed") {
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
      addLog(`${sideName(event.owner)} ${UNIT_LABELS[event.unitType]} ability activated while surrounded.`);
    } else if (event.type === "piece_removed") {
      const ability = event.reason === "general_reaction" ? UNIT_LABELS.general : UNIT_LABELS.wizard;
      addLog(`${sideName(event.owner)} ${UNIT_LABELS[event.unitType]} at ${coord(event.row, event.col)} was removed by ${ability}.`);
    } else if (event.type === "pieces_converted" && event.pieces.length) {
      addLog(`${sideName(event.owner)} ${UNIT_LABELS.diplomat} converted ${event.pieces.length} space(s).`);
    } else if (event.type === "wizard_move_required") {
      wizardMovePromptDismissed = false;
      addLog(`${sideName(event.owner)} ${UNIT_LABELS.wizard} ability activated. Choose an empty escape cell.`);
    } else if (event.type === "wizard_moved") {
      wizardMovePromptDismissed = false;
      addLog(`${sideName(event.owner)} ${UNIT_LABELS.wizard} teleported to ${coord(event.row, event.col)}.`);
    } else if (event.type === "wizard_stayed") {
      wizardMovePromptDismissed = false;
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
      red: event.red,
      blue: event.blue,
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

function showTauntBubble(event) {
  if (!event || event.id === lastTauntEventId) return;
  lastTauntEventId = event.id;
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
    render();
  }
}

function scheduleAiTurn() {
  if (new URLSearchParams(location.search).get("demo") === "capture-38") return;
  if (visibleTaunt) return;
  if (state.mode === "pve" && state.pendingSpecial?.owner === pveAiPlayer && !state.aiThinking) {
    state.aiThinking = true;
    render();
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      state.aiThinking = false;
      activatePendingSpecial(pveAiPlayer);
    }, AI_SPECIAL_REVEAL_DELAY_MS);
    return;
  }

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
  fortressFrame.classList.toggle("view-red", viewerSide === "red");
  if (DEVELOPER_MODE || (state.mode === "pve" && !activePveTimerEnabled)) {
    pveTurnDeadline = null;
  } else if (state.mode === "pve" && !state.winner && isGameActive()) {
    if (state.turn === pveHumanPlayer && pveTurnDeadline === null) {
      pveTurnDeadline = Date.now() + PVE_TURN_LIMIT_MS;
    } else if (state.turn !== pveHumanPlayer) {
      pveTurnDeadline = null;
    }
  } else if (state.mode !== "pve" || state.winner || !isGameActive()) {
    pveTurnDeadline = null;
  }

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
    redCount,
    blueCount,
    deployDock,
    confirmTeleportBtn,
    cancelTeleportBtn,
    undoBtn,
    resignBtn,
    resultModal,
    showMatchResult: state.mode === "pve" || state.mode === "pvp",
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
    wizardMovePromptDismissed,
    visibleTaunt,
    undoCount: undoStack.length,
    unitLabels: UNIT_LABELS,
    text,
    sideName,
    coord,
    currentUnitChoice,
    canDeploy,
    kingZones: activeKingZones,
    selectCell,
    countPieces,
    localizeResultReason,
  });
  const matchResultVisible = Boolean(state.winner && (state.mode === "pve" || state.mode === "pvp"));
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
  const teleportActive = Boolean(state.teleporting);
  const teleportUi = teleportUiState(state, viewerSide, wizardMovePromptDismissed);
  const challengeResultActive = Boolean(state.winner && (puzzleActive || (tutorialActive && activePuzzle?.type === "tutorial")));
  const challengeResultSolved = challengeResultActive && (tutorialActive
    ? state.winner === "blue"
    : state.winner === activePuzzle?.player);
  tutorialPanel.hidden = !tutorialActive && !puzzleActive && !teleportUi.showPrompt;
  gameStatusBar.classList.toggle("guide-active", !tutorialPanel.hidden);
  tutorialPanel.classList.toggle("wizard-move-panel", teleportUi.showPrompt);
  tutorialPanel.classList.toggle("challenge-result", challengeResultActive);
  tutorialPanel.classList.toggle("complete", challengeResultSolved);
  tutorialPanel.classList.toggle("incomplete", challengeResultActive && !challengeResultSolved);
  exitTutorialBtn.hidden = !challengeResultActive;
  setIconButtonLabel(exitTutorialBtn, "backToChallenges");
  boardEl.classList.toggle("tutorial-active", tutorialActive);
  tutorialStepLabel.hidden = true;
  if (tutorialActive) {
    const complete = tutorialStep >= TUTORIAL_STEPS.length;
    const tutorialPuzzleActive = activePuzzle?.type === "tutorial";
    const tutorialMessageKey = tutorialReactionPhase === "preparing"
      ? "tutorialBlackPreparing"
      : tutorialReactionPhase === "surrounded"
        ? "tutorialSurroundComplete"
        : tutorialAwaitingContinue
          ? state.teleporting
            ? "tutorialWizardTeleport"
            : TUTORIAL_STEPS[tutorialStep].placedMessage
          : TUTORIAL_STEPS[tutorialStep]?.message;
    const conciseTutorialMessage = text(complete && tutorialPuzzleActive ? "challengeComplete" : complete ? "tutorialComplete" : tutorialMessageKey);
    tutorialMessage.textContent = conciseTutorialMessage;
    nextTutorialBtn.hidden = complete
      ? true
      : !tutorialAwaitingContinue || Boolean(state.teleporting) || Boolean(tutorialReactionPhase);
    setIconButtonLabel(nextTutorialBtn, "nextTutorial");
    boardEl.classList.toggle("tutorial-complete", complete);
  } else if (puzzleActive) {
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
    tutorialStepLabel.hidden = true;
    tutorialStepLabel.textContent = "";
    tutorialMessage.textContent = text("tutorialWizardTeleport");
    confirmTeleportBtn.hidden = wizardMovePromptDismissed;
    cancelTeleportBtn.hidden = wizardMovePromptDismissed;
    nextTutorialBtn.hidden = true;
    boardEl.classList.remove("tutorial-active");
    boardEl.classList.remove("tutorial-complete");
  } else {
    confirmTeleportBtn.hidden = true;
    cancelTeleportBtn.hidden = true;
    nextTutorialBtn.hidden = true;
    setIconButtonLabel(nextTutorialBtn, "nextTutorial");
    boardEl.classList.remove("tutorial-active");
    boardEl.classList.remove("tutorial-complete");
  }
  if (tutorialActive && teleportUi.canControl) {
    confirmTeleportBtn.hidden = wizardMovePromptDismissed;
    cancelTeleportBtn.hidden = wizardMovePromptDismissed;
  }
  renderPendingSpecialModal(viewerSide);
}

function renderPendingSpecialModal(viewerSide) {
  const pending = state.pendingSpecial;
  if (!pending || state.winner || state.mode === "tutorial") {
    pendingSpecialModal.hidden = true;
    return;
  }

  const unitLabel = pending.type ? UNIT_LABELS[pending.type] : text("hiddenUnit");
  const canActivate = pending.owner === viewerSide
    && (state.mode !== "pvp" || networkSession.ready);
  pendingSpecialTitle.textContent = canActivate
    ? text("activateSpecialTitle", { unit: unitLabel })
    : text("specialUnit");
  pendingSpecialText.textContent = canActivate
    ? text("activateSpecialPrompt", { side: sideName(pending.owner), unit: unitLabel })
    : text("waitingSpecialPrompt", { side: sideName(pending.owner) });
  activateSpecialBtn.textContent = canActivate
    ? text("activateSpecialButton", { unit: unitLabel })
    : text("waitingSpecialPrompt", { side: sideName(pending.owner) });
  activateSpecialBtn.disabled = !canActivate;
  pendingSpecialModal.hidden = false;
}

function localizeResultReason(reason) {
  if (!reason) return "";
  if (reason === "All enemy units were eliminated.") return text("allEliminated");
  if (reason === "Time limit exceeded (30s).") return text("timeExpired");
  if (reason.includes("resigned.")) {
    const side = reason.startsWith("Black") || reason.startsWith("red") ? text("red") : text("blue");
    return text("resignReason", { side });
  }
  const localizedSides = reason
    .replace(/\bred\b/gi, text("red"))
    .replace(/\bblue\b/gi, text("blue"));
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
    state.resultReason = `${resigningSide === "red" ? "Black" : "White"} resigned.`;
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
confirmTeleportBtn.addEventListener("click", () => {
  if (!state.teleporting) return;
  wizardMovePromptDismissed = true;
  render();
});
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
activateSpecialBtn.addEventListener("click", () => {
  if (!state.pendingSpecial) return;
  if (state.mode === "pvp") {
    if (state.pendingSpecial.owner === networkSession.player) sendNetworkAction({ type: "activate_special" });
  } else {
    activatePendingSpecial(state.pendingSpecial.owner);
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
  if (aiTimer !== null) window.clearTimeout(aiTimer);
  if (tauntTimer !== null) window.clearTimeout(tauntTimer);
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  aiTimer = null;
  tauntTimer = null;
  tutorialTimer = null;
  visibleTaunt = null;
  lastTauntEventId = 0;
  rematchRequested = false;
  undoStack = [];
  tutorialStep = -1;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
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
  if (aiTimer !== null) window.clearTimeout(aiTimer);
  if (tauntTimer !== null) window.clearTimeout(tauntTimer);
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  tutorialTimer = null;
  aiTimer = null;
  tauntTimer = null;
  visibleTaunt = null;
  lastTauntEventId = 0;
  rematchRequested = false;
  undoStack = [];
  tutorialStep = -1;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
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
  const modeInput = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (!modeInput) return;
  modeInput.checked = true;
  if (mode === "pve") {
    disconnectNetwork();
    networkModal.hidden = true;
    modeModal.hidden = true;
    renderPveRankOptions();
    renderPveTimerOptions();
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
  pveTurnDeadline = activePveTimerEnabled && !DEVELOPER_MODE && side === "red"
    ? Date.now() + PVE_TURN_LIMIT_MS
    : null;
  render();
  if (side === "blue") scheduleAiTurn();
}

function showNetworkRoomControls() {
  uiShowNetworkRoomControls({ publicRoomList, networkRoomControls, networkRpsPicker });
}

function showNetworkRpsPicker() {
  uiShowNetworkRpsPicker({ publicRoomList, networkRoomControls, networkRpsPicker, rpsButtons });
}

function resetRpsButtons() {
  uiResetRpsButtons(rpsButtons);
}

function setNetworkStatus(message) {
  networkStatus.textContent = message;
  networkLobbyStatus.textContent = message;
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
  connectNetwork({ type: "list_rooms" });
}

function returnToNetworkLobby() {
  resultModal.hidden = true;
  hideRematchToast();
  rematchRequested = false;
  rematchOfferedBy = null;
  state = createInitialState("pvp", "red");
  state.mode = "pvp";
  networkModal.hidden = false;
  showNetworkRoomControls();
  openRooms = [];
  renderOpenRooms();
  requestRoomList();
  render();
}

function connectNetwork(command) {
  disconnectNetwork();
  networkSession = openNetworkConnection(command, {
    url: buildNetworkUrl(location, NETWORK_SERVER),
    connectingMessage: text("connecting"),
    disconnectedMessage: text("disconnected"),
    unavailableMessage: text("serverUnavailable"),
    invalidMessage: text("invalidServerResponse"),
    onStatus: (message, session) => {
      if (!session || networkSession === session) setNetworkStatus(message);
    },
    onMessage: handleNetworkMessage,
    onClose: (session) => {
      if (networkSession === session) {
        showNetworkRoomControls();
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
    setNetworkStatus(text("createOrJoin"));
    return;
  }

  if (message.type === "room_created" || message.type === "waiting") {
    networkSession.roomCode = message.roomCode;
    networkSession.boardNumber = message.boardNumber || networkSession.boardNumber;
    state.mode = "pvp";
    networkModal.hidden = true;
    setNetworkStatus(text("roomWaiting", { room: currentBoardLabel() }));
    render();
    return;
  }

  if (message.type === "rps_start" || message.type === "side_selection") {
    networkSession.roomCode = message.roomCode;
    networkSession.boardNumber = message.boardNumber || networkSession.boardNumber;
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
      const won = message.yourSide === "red";
      setNetworkStatus(won ? text("rpsWin") : text("rpsLose"));
      if (won) playPlacementSound();
    }
    render();
    return;
  }

  if (message.type === "match_start" || message.type === "state") {
    const previousDeploymentKey = lastDeploymentKey(state?.lastMove);
    const previousTeleportKey = state?.teleporting
      ? `${state.teleporting.owner}:${state.teleporting.row}:${state.teleporting.col}`
      : "";
    networkSession.roomCode = message.roomCode || networkSession.roomCode;
    networkSession.boardNumber = message.boardNumber || networkSession.boardNumber;
    networkSession.player = message.player || networkSession.player;
    networkSession.ready = true;
    networkSession.opponentDisconnected = false;
    state = message.state;
    const nextDeploymentKey = lastDeploymentKey(state.lastMove);
    if (nextDeploymentKey && nextDeploymentKey !== previousDeploymentKey) playPlacementSound();
    const nextTeleportKey = state?.teleporting
      ? `${state.teleporting.owner}:${state.teleporting.row}:${state.teleporting.col}`
      : "";
    if (nextTeleportKey && nextTeleportKey !== previousTeleportKey) wizardMovePromptDismissed = false;
    if (message.type === "match_start") {
      lastTauntEventId = 0;
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
    setNetworkStatus(text("roomPlayer", { room: currentBoardLabel(), side: sideName(networkSession.player) }));
    if (state.tauntEvent?.id !== lastTauntEventId) showTauntBubble(state.tauntEvent);
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
    protocolVersion: 2,
  });
}

newGameBtn.addEventListener("click", startNewGame);
function openSettingsModal() {
  syncSettingsControls();
  if (downloadJournalBtn) downloadJournalBtn.disabled = !currentPveJournalJsonl();
  settingsStatus.hidden = true;
  settingsModal.hidden = false;
}

settingsBtn.addEventListener("click", openSettingsModal);
lobbySettingsBtn.addEventListener("click", openSettingsModal);
musicToggle.addEventListener("change", () => {
  setMusicEnabled(musicToggle.checked);
});
sfxToggle.addEventListener("change", () => {
  setSfxEnabled(sfxToggle.checked);
  if (sfxToggle.checked) playPlacementSound();
});
specialHelpToggle.addEventListener("change", () => {
  if (specialHelpToggle.checked) {
    enableChallengeGuidance();
    settingsStatus.textContent = text("specialHelpReset");
  } else {
    disableChallengeGuidance();
    settingsStatus.textContent = text("specialHelpHidden");
  }
  settingsStatus.hidden = false;
});
downloadJournalBtn?.addEventListener("click", () => {
  downloadPveJournal();
  settingsStatus.hidden = false;
});
resultDownloadJournalBtn?.addEventListener("click", downloadPveJournal);
closeSettingsBtn.addEventListener("click", () => {
  settingsModal.hidden = true;
});
initAudioGesture();
playAgainBtn.addEventListener("click", playAgain);
resultLobbyBtn.addEventListener("click", startNewGame);
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
  protocolVersion: 2,
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
pveSideButtons.forEach((button) => {
  button.addEventListener("click", () => startPve(button.dataset.pveSide));
});
pveDifficultyButtons.forEach((button) => {
  button.addEventListener("click", () => applyPveRank(button.dataset.pveRank));
});
pveTimerButtons.forEach((button) => {
  button.addEventListener("click", () => applyPveTimerSetting(button.dataset.pveTimer === "on"));
});
cancelPveSideBtn.addEventListener("click", () => {
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
  if (!tutorialAwaitingContinue || tutorialReactionPhase) return;
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
languageSelect.addEventListener("change", () => {
  const nextLanguage = languageSelect.value === "ko" ? "ko" : "en";
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
      if (!hasLegalDeployment(state, pveHumanPlayer)) {
        applySharedPveAction(pveHumanPlayer, { type: "pass" });
      } else {
        applySharedPveAction(pveHumanPlayer, { type: "timeout" }, { authoritative: true });
      }
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
