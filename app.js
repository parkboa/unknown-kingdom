import {
  DEPLOY_ORDER,
  PVE_AI,
  PVE_HUMAN,
  SIZE,
  SPECIALS,
  WHITE_TERRITORY_BONUS,
  createSpecialHelp,
  createUnitLabels,
} from "./js/config.js?v=settings-menu";
import {
  cellKey,
  inBounds,
  neighbors,
  opponent,
} from "./js/board.js";
import {
  boardSignature as getBoardSignature,
  chooseCaptor as findCaptor,
  collectGroup as findGroup,
  groupHasLiberty as hasGroupLiberty,
  touchesOwnWall,
} from "./js/capture.js?v=king-one-life";
import {
  chooseAiTeleportDestination,
  findAiDeployMove,
} from "./js/ai.js?v=post-join-side-choice";
import { createTranslator } from "./js/i18n.js?v=settings-menu";
import {
  buildNetworkUrl,
  connectNetwork as openNetworkConnection,
  createNetworkSession,
  disconnectNetwork as closeNetworkConnection,
  sendNetworkCommand,
  sendNetworkAction as sendNetworkMessage,
} from "./js/network.js?v=post-join-side-choice";
import {
  createInitialState,
  createOccupiedSoldier,
  createPiece,
} from "./js/state.js?v=post-join-side-choice";
import {
  publicName as getPublicName,
  renderGame,
  viewerOwnsPiece as doesViewerOwnPiece,
} from "./js/render.js?v=mobile-special-selection";

const requestedLanguage = new URLSearchParams(location.search).get("lang") || localStorage.getItem("unknown-kingdom-language");
const LANGUAGE = requestedLanguage === "ko" ? "ko" : "en";
const requestedServer = new URLSearchParams(location.search).get("server");
if (requestedServer) localStorage.setItem("unknown-kingdom-server", requestedServer);
const defaultNetworkServer = location.hostname === "127.0.0.1" || location.hostname === "localhost"
  ? "ws://127.0.0.1:4175/ws"
  : "wss://unknown-kingdom-server.onrender.com/ws";
const NETWORK_SERVER = requestedServer || localStorage.getItem("unknown-kingdom-server") || defaultNetworkServer;
const UNIT_LABELS = createUnitLabels(LANGUAGE);
const SPECIAL_HELP = createSpecialHelp(LANGUAGE);
const text = createTranslator(LANGUAGE);
const HELP_PREFERENCE_RESET_KEY = "unknown-kingdom-help-preferences-v2";

function resetSpecialHelpPreferences() {
  SPECIALS.forEach((unitType) => {
    localStorage.removeItem(`unknown-kingdom-hide-help-${unitType}`);
  });
}

if (!localStorage.getItem(HELP_PREFERENCE_RESET_KEY)) {
  resetSpecialHelpPreferences();
  localStorage.setItem(HELP_PREFERENCE_RESET_KEY, "reset");
}

let state;
let undoStack = [];
let aiTimer = null;
let tauntTimer = null;
let visibleTaunt = null;
let lastTauntEventId = 0;
let networkSession = createNetworkSession();
let pveHumanPlayer = PVE_HUMAN;
let pveAiPlayer = PVE_AI;
let tutorialStep = -1;
let tutorialAwaitingContinue = false;
let tutorialKingPosition = null;
let tutorialReactionPending = false;
let tutorialReactionPhase = null;
let tutorialTimer = null;

const TUTORIAL_STEPS = [
  { unitType: "king", owner: "blue", row: 7, col: 4, message: "tutorialKing" },
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
    unitType: "soldier",
    owner: "blue",
    row: 4,
    col: 5,
    message: "tutorialCapture",
    placedMessage: "tutorialCapturePlaced",
    setup: "capture",
  },
  {
    unitType: "general",
    owner: "blue",
    row: 4,
    col: 4,
    message: "tutorialGeneral",
    placedMessage: "tutorialGeneralPlaced",
    readyMessage: "tutorialGeneralReady",
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
    readyMessage: "tutorialDiplomatReady",
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
    readyMessage: "tutorialWizardReady",
    setup: "special",
    reaction: true,
  },
];

const boardEl = document.querySelector("#board");
const fortressFrame = document.querySelector(".fortress-frame");
const turnPill = document.querySelector("#turnPill");
const tauntBtn = document.querySelector("#tauntBtn");
const redCount = document.querySelector("#redCount");
const blueCount = document.querySelector("#blueCount");
const cancelTeleportBtn = document.querySelector("#cancelTeleportBtn");
const undoBtn = document.querySelector("#undoBtn");
const newGameBtn = document.querySelector("#newGameBtn");
const settingsBtn = document.querySelector("#settingsBtn");
const networkStatusGroup = document.querySelector("#networkStatusGroup");
const networkStatus = document.querySelector("#networkStatus");
const modeModal = document.querySelector("#modeModal");
const pveSideModal = document.querySelector("#pveSideModal");
const cancelPveSideBtn = document.querySelector("#cancelPveSideBtn");
const pveSideButtons = document.querySelectorAll("[data-pve-side]");
const networkModal = document.querySelector("#networkModal");
const networkLobbyStatus = document.querySelector("#networkLobbyStatus");
const networkRoomControls = document.querySelector("#networkRoomControls");
const networkSidePicker = document.querySelector("#networkSidePicker");
const onlineSideButtons = document.querySelectorAll("[data-online-side]");
const roomCodeInput = document.querySelector("#roomCodeInput");
const createRoomBtn = document.querySelector("#createRoomBtn");
const joinRoomBtn = document.querySelector("#joinRoomBtn");
const cancelNetworkBtn = document.querySelector("#cancelNetworkBtn");
const resultModal = document.querySelector("#resultModal");
const playAgainBtn = document.querySelector("#playAgainBtn");
const specialHelpModal = document.querySelector("#specialHelpModal");
const specialHelpTitle = document.querySelector("#specialHelpTitle");
const specialHelpText = document.querySelector("#specialHelpText");
const hideSpecialHelpCheckbox = document.querySelector("#hideSpecialHelpCheckbox");
const closeSpecialHelpBtn = document.querySelector("#closeSpecialHelpBtn");
const settingsModal = document.querySelector("#settingsModal");
const resetSpecialHelpBtn = document.querySelector("#resetSpecialHelpBtn");
const settingsStatus = document.querySelector("#settingsStatus");
const closeSettingsBtn = document.querySelector("#closeSettingsBtn");
const languageSelect = document.querySelector("#languageSelect");
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

function applyLanguage() {
  document.documentElement.lang = LANGUAGE;
  document.title = LANGUAGE === "ko" ? "언노운 킹덤 프로토타입" : "Unknown Kingdom Prototype";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = text(element.dataset.i18n);
  });
  document.querySelectorAll(".unit-picker label").forEach((label) => {
    const input = label.querySelector("input");
    label.querySelector("span").textContent = UNIT_LABELS[input.value];
  });
  languageSelect.value = LANGUAGE;
  roomCodeInput.placeholder = text("enterCode");
  undoBtn.setAttribute("aria-label", text("undo"));
  undoBtn.title = text("undo");
  newGameBtn.setAttribute("aria-label", text("newGame"));
  newGameBtn.title = text("newGame");
  settingsBtn.setAttribute("aria-label", text("settings"));
  settingsBtn.title = text("settings");
  cancelTeleportBtn.textContent = text("cancelAbility");
  document.querySelector(".red-counter").setAttribute("aria-label", text("redUnits"));
  document.querySelector(".blue-counter").setAttribute("aria-label", text("blueUnits"));
}

function newState() {
  return createInitialState(currentModeChoice(), pveHumanPlayer);
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
  state.stock.blue = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.stock.red = { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.log = ["No-move demo: White has no legal deployment, but the board is not full."];
  return true;
}

function currentUnitChoice() {
  return document.querySelector("input[name='unit']:checked").value;
}

function currentModeChoice() {
  return document.querySelector("input[name='mode']:checked")?.value || "pve";
}

function isAiTurn() {
  return state.mode === "pve" && state.turn === pveAiPlayer && !state.winner;
}

function canDeploy(player, unitType, row, col) {
  if (state.mode === "pvp") return false;
  if (state.mode === "tutorial") {
    const expected = TUTORIAL_STEPS[tutorialStep];
    return Boolean(expected)
      && !tutorialAwaitingContinue
      && player === expected.owner
      && unitType === expected.unitType
      && row === expected.row
      && col === expected.col
      && !state.board[row][col];
  }
  if (state.winner || state.teleporting || state.pendingKingSwap) return false;
  if (!inBounds(row, col) || state.board[row][col]) return false;
  if (!state.firstDeployDone[player] && unitType !== "king") return false;
  if (state.stock[player][unitType] <= 0) return false;
  return true;
}

function hasLegalDeployment(player) {
  const availableTypes = DEPLOY_ORDER.filter((unitType) => {
    if (state.stock[player][unitType] <= 0) return false;
    return state.firstDeployDone[player] || unitType === "king";
  });

  for (const unitType of availableTypes) {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (state.board[row][col]) continue;
        if (canDeploy(player, unitType, row, col)) return true;
      }
    }
  }
  return false;
}

function deploymentSurvives(player, unitType, row, col, ignoreHiddenEnemySpecials = false) {
  const liveState = state;
  const simulatedState = structuredClone(state);

  try {
    state = simulatedState;
    if (ignoreHiddenEnemySpecials) suppressHiddenEnemySpecials(player);
    state.board[row][col] = createPiece(player, unitType);
    state.stock[player][unitType] -= 1;
    state.firstDeployDone[player] = true;
    resolveAllCaptures(player);

    const deployedPiece = state.board[row][col];
    const playerLost = state.winner && state.winner !== player;
    return Boolean(deployedPiece?.owner === player && !playerLost);
  } finally {
    state = liveState;
  }
}

function suppressHiddenEnemySpecials(player) {
  forEachPiece((piece) => {
    if (piece.owner === player || piece.revealed || piece.abilityUsed || !SPECIALS.has(piece.type)) return;
    piece.type = "soldier";
    piece.originalType = "soldier";
  });
}

function saveUndoCheckpoint() {
  if (state.mode === "pve" && state.turn === pveAiPlayer) return;
  undoStack.push({
    state: structuredClone(state),
    unitChoice: currentUnitChoice(),
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
  state.aiThinking = false;
  const unitInput = document.querySelector(`input[name="unit"][value="${checkpoint.unitChoice}"]`);
  if (unitInput) unitInput.checked = true;
  addLog("Last move was undone.");
  render();
}

function deploy(row, col) {
  const player = state.turn;
  const unitType = currentUnitChoice();
  if (!canDeploy(player, unitType, row, col)) {
    addLog(`${sideName(player)} cannot deploy ${UNIT_LABELS[unitType]} there.`);
    render();
    return;
  }
  if (!deploymentSurvives(player, unitType, row, col, true) && !window.confirm(text("suicideWarning"))) return;

  saveUndoCheckpoint();
  state.board[row][col] = createPiece(player, unitType);
  if (state.mode === "tutorial" && unitType === "king") tutorialKingPosition = { row, col };
  state.stock[player][unitType] -= 1;
  state.firstDeployDone[player] = true;
  if (unitType === "king") registerKingWallTaunt(player, row, col);
  addLog(`${sideName(player)} deployed ${UNIT_LABELS[unitType]} at ${coord(row, col)}.`);
  resolveAllCaptures(player);
  if (state.mode === "tutorial") {
    const expected = TUTORIAL_STEPS[tutorialStep];
    tutorialReactionPending = Boolean(expected?.reaction);
    if (tutorialStep >= 1) {
      tutorialAwaitingContinue = true;
      render();
      return;
    }
    advanceTutorial();
    render();
    return;
  }
  if (state.winner || state.teleporting || state.pendingKingSwap) {
    render();
    scheduleAiTurn();
    return;
  }
  endTurn();
}

function selectTutorialUnit(unitType) {
  const input = document.querySelector(`input[name="unit"][value="${unitType}"]`);
  if (input) input.checked = true;
}

function setTutorialCaptureBoard() {
  state.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const king = tutorialKingPosition || { row: 7, col: 4 };
  state.board[king.row][king.col] = createPiece("blue", "king");
  state.board[3][4] = createOccupiedSoldier("blue");
  state.board[5][4] = createOccupiedSoldier("blue");
  state.board[4][3] = createOccupiedSoldier("blue");
  state.board[4][4] = createOccupiedSoldier("red");
}

function resetTutorialBoard() {
  state.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const king = tutorialKingPosition || { row: 7, col: 4 };
  state.board[king.row][king.col] = createPiece("blue", "king");
  state.firstDeployDone = { red: true, blue: true };
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
  state.winner = null;
  state.resultReason = "";
  const expected = TUTORIAL_STEPS[tutorialStep];
  if (!expected) return;
  if (expected.setup === "wall-defense") setTutorialWallDefenseBoard();
  if (expected.setup === "wall-capture") setTutorialWallCaptureBoard();
  if (expected.setup === "capture") setTutorialCaptureBoard();
  if (expected.setup === "special") setTutorialSpecialBoard();
  state.turn = expected.owner;
  selectTutorialUnit(expected.unitType);
}

function startTutorial() {
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  tutorialTimer = null;
  disconnectNetwork();
  networkModal.hidden = true;
  undoStack = [];
  state = createInitialState("tutorial");
  state.turn = "blue";
  state.stock.blue = { soldier: 20, king: 1, general: 1, diplomat: 1, wizard: 1 };
  tutorialStep = 0;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
  selectTutorialUnit(TUTORIAL_STEPS[0].unitType);
  modeModal.hidden = true;
  render();
}

function sendNetworkAction(action) {
  if (!sendNetworkMessage(networkSession, action)) {
    setNetworkStatus(text("notConnected"));
  }
}

function deployUnit(player, unitType, row, col) {
  if (!canDeploy(player, unitType, row, col)) return false;
  state.board[row][col] = createPiece(player, unitType);
  state.stock[player][unitType] -= 1;
  state.firstDeployDone[player] = true;
  if (unitType === "king") registerKingWallTaunt(player, row, col);
  const unitName = state.mode === "pve" && player === pveAiPlayer && unitType !== "king"
    ? text("hiddenUnit")
    : UNIT_LABELS[unitType];
  addLog(`${sideName(player)} deployed ${unitName} at ${coord(row, col)}.`);
  resolveAllCaptures(player);
  endTurn();
  if (player === pveAiPlayer && state.tauntChances[pveAiPlayer]) {
    window.setTimeout(() => useTaunt(pveAiPlayer), 150);
  }
  return true;
}

function coord(row, col) {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

function addLog(message) {
  state.log.push(message);
  state.log = state.log.slice(-40);
}

function declareWinner(winner, reason) {
  if (state.winner) return;
  state.winner = winner;
  state.resultReason = reason;
  addLog(`${sideName(winner)} wins. ${reason}`);
}

function registerKingWallTaunt(owner, row, col) {
  if (!touchesOwnWall(owner, row, col)) return;
  const tauntingPlayer = opponent(owner);
  state.tauntChances[tauntingPlayer] = {
    targetOwner: owner,
    row,
    col,
  };
  addLog(`${sideName(owner)} placed the King against its own fortress wall.`);
}

function showTauntBubble(event) {
  if (!event || event.id === lastTauntEventId) return;
  lastTauntEventId = event.id;
  visibleTaunt = event;
  if (tauntTimer !== null) window.clearTimeout(tauntTimer);
  render();
  tauntTimer = window.setTimeout(() => {
    tauntTimer = null;
    visibleTaunt = null;
    render();
  }, 2000);
}

function findKingPosition(owner) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state.board[row][col];
      if (piece?.owner === owner && piece.type === "king") return { row, col };
    }
  }
  return null;
}

function canPlayerUseTaunt(player) {
  return Boolean(player && state.tauntChances[player] && findKingPosition(player));
}

function useTaunt(player) {
  const chance = state.tauntChances[player];
  const speaker = findKingPosition(player);
  if (!chance || !speaker || state.winner) return false;
  state.tauntChances[player] = null;
  state.tauntSerial += 1;
  state.tauntEvent = {
    id: state.tauntSerial,
    speakerOwner: player,
    targetOwner: chance.targetOwner,
    row: speaker.row,
    col: speaker.col,
  };
  showTauntBubble(state.tauntEvent);
  return true;
}

function declareDraw(reason) {
  if (state.winner) return;
  state.winner = "draw";
  state.resultReason = reason;
  addLog(`Draw. ${reason}`);
}

function finishByTerritory(reasonTemplate) {
  const redTerritory = countPieces("red");
  const blueTerritory = countPieces("blue");
  const adjustedBlueTerritory = blueTerritory + WHITE_TERRITORY_BONUS;
  const reason = text(reasonTemplate, {
    red: redTerritory,
    blue: blueTerritory,
    bonus: WHITE_TERRITORY_BONUS,
  });
  if (redTerritory === adjustedBlueTerritory) {
    declareDraw(reason);
  } else {
    declareWinner(redTerritory > adjustedBlueTerritory ? "red" : "blue", reason);
  }
}

function resolveNoMoveTurn() {
  if (state.teleporting || state.pendingKingSwap) return false;
  if (state.winner || hasLegalDeployment(state.turn)) return false;

  const passingPlayer = state.turn;
  const nextPlayer = opponent(passingPlayer);
  finishByTerritory("noLegalMoves");
  return true;
}

function endTurn() {
  if (!state.winner) {
    if (!hasEmptyCell()) {
      finishByTerritory("boardFilled");
    }

    const nextPlayer = opponent(state.turn);
    if (!state.winner && countPieces(nextPlayer) === 0 && state.firstDeployDone[nextPlayer]) {
      declareWinner(state.turn, "All enemy units were eliminated.");
    } else {
      if (!state.winner) {
        state.turn = nextPlayer;
        state.selected = null;
        resolveNoMoveTurn();
      }
    }
  }
  render();
  scheduleAiTurn();
}

function resolveAllCaptures(preferredCaptor) {
  let changed = true;
  const seenStates = new Set();

  while (changed && !state.winner) {
    const passStart = boardSignature();
    if (seenStates.has(passStart)) break;
    seenStates.add(passStart);

    changed = false;
    const checked = new Set();

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const piece = state.board[row][col];
        if (!piece) continue;
        const group = collectGroup(row, col);
        const groupKey = group.map(([groupRow, groupCol]) => cellKey(groupRow, groupCol)).sort().join("|");
        if (checked.has(groupKey)) continue;
        checked.add(groupKey);

        if (groupHasLiberty(group, piece.owner)) continue;

        const captor = chooseCaptor(group, piece.owner, preferredCaptor);
        if (!captor) continue;

        const before = boardSignature();
        resolveCapturedGroup(group, captor);
        if (state.winner || state.teleporting || state.pendingKingSwap) return;
        changed = changed || before !== boardSignature();
      }
    }
  }
}

function boardSignature() {
  return getBoardSignature(state);
}

function chooseCaptor(group, defender, preferredCaptor) {
  return findCaptor(state, group, defender, preferredCaptor);
}

function collectGroup(row, col) {
  return findGroup(state, row, col);
}

function groupHasLiberty(group, owner) {
  return hasGroupLiberty(state, group, owner);
}

function resolveCapturedGroup(group, captor) {
  const defender = state.board[group[0][0]][group[0][1]].owner;
  triggerCapturedSpecials(group, defender);
  if (state.winner || state.teleporting || state.pendingKingSwap) return;

  const checked = new Set();
  for (const [row, col] of group) {
    const piece = state.board[row][col];
    if (!piece || piece.owner !== defender) continue;

    const remainingGroup = collectGroup(row, col);
    const groupKey = remainingGroup.map(([groupRow, groupCol]) => cellKey(groupRow, groupCol)).sort().join("|");
    if (checked.has(groupKey)) continue;
    checked.add(groupKey);

    if (!groupHasLiberty(remainingGroup, defender)) {
      occupyCapturedGroup(remainingGroup, captor);
      if (state.winner || state.teleporting || state.pendingKingSwap) return;
    } else {
      addLog(`${sideName(defender)} group resisted capture after special reaction.`);
    }
  }
}

function triggerCapturedSpecials(group, defender) {
  const specials = group
    .map(([row, col]) => ({ row, col, piece: state.board[row][col] }))
    .filter(({ piece }) => piece?.owner === defender && SPECIALS.has(piece.type) && !piece.abilityUsed);

  for (const { row, col, piece } of specials) {
    piece.revealed = true;
    state.stats.specialsUsed[piece.owner] += 1;
    if (piece.type === "general") {
      strikeAdjacentEnemies(row, col, piece.owner, "General capture reaction");
      retireSpecial(piece);
      addLog(`${sideName(piece.owner)} General triggered while surrounded.`);
    } else if (piece.type === "diplomat") {
      convertAdjacentEnemies(row, col, piece.owner);
      retireSpecial(piece);
      addLog(`${sideName(piece.owner)} Diplomat triggered while surrounded.`);
    } else if (piece.type === "wizard") {
      strikeAdjacentEnemies(row, col, piece.owner, "Wizard capture reaction");
      retireSpecial(piece);
      if (hasEmptyCell()) {
        const teleport = { row, col, owner: piece.owner, reaction: true };
        state.teleporting = teleport;
        addLog(`${sideName(piece.owner)} Wizard triggered while surrounded. Choose an empty escape cell.`);
        return;
      } else {
        addLog(`${sideName(piece.owner)} Wizard triggered while surrounded but had no escape cell.`);
      }
    }
  }
}

function occupyCapturedGroup(group, captor) {
  const defender = state.board[group[0][0]][group[0][1]].owner;
  let occupied = 0;

  for (const [row, col] of group) {
    const piece = state.board[row][col];
    if (!piece) continue;

    if (piece.type === "king") {
      state.board[row][col] = createOccupiedSoldier(captor);
      state.stats.captures[captor] += 1;
      declareWinner(captor, `${sideName(defender)} King was captured at ${coord(row, col)}.`);
      return;
    }

    state.board[row][col] = createOccupiedSoldier(captor);
    occupied += 1;
  }

  state.stats.captures[captor] += occupied;
  if (occupied > 0) addLog(`${sideName(captor)} captured ${occupied} ${sideName(defender)} space(s).`);
}

function strikeAdjacentEnemies(row, col, owner, reason) {
  for (const [targetRow, targetCol] of neighbors(row, col)) {
    const target = state.board[targetRow][targetCol];
    if (target && target.owner !== owner) capturePiece(targetRow, targetCol, reason);
    if (state.winner || state.pendingKingSwap) return;
  }
}

function convertAdjacentEnemies(row, col, owner) {
  for (const [targetRow, targetCol] of neighbors(row, col)) {
    const target = state.board[targetRow][targetCol];
    if (target && target.owner !== owner) convertPiece(targetRow, targetCol, owner);
    if (state.winner || state.pendingKingSwap) return;
  }
}

function hasEmptyCell() {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!state.board[row][col]) return true;
    }
  }
  return false;
}

function capturePiece(row, col, reason) {
  const piece = state.board[row][col];
  if (!piece) return;

  if (piece.type === "king") {
    state.board[row][col] = null;
    const winner = opponent(piece.owner);
    state.stats.captures[winner] += 1;
    declareWinner(winner, `${sideName(piece.owner)} King was captured by ${reason}.`);
    return;
  }

  state.board[row][col] = null;
  state.stats.captures[opponent(piece.owner)] += 1;
  addLog(`${sideName(piece.owner)} ${publicName(piece)} at ${coord(row, col)} was removed by ${reason}.`);
}

function publicName(piece) {
  return getPublicName(piece, UNIT_LABELS, text);
}

function viewerOwnsPiece(piece) {
  return doesViewerOwnPiece(state, networkSession.player, piece, pveHumanPlayer);
}

function selectCell(row, col) {
  if (state.winner) return;
  if (state.mode === "pvp") {
    if (!networkSession.ready) return;
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

  if (state.teleporting) {
    teleportWizard(row, col);
    return;
  }

  const piece = state.board[row][col];
  if (piece) {
    if (viewerOwnsPiece(piece) && SPECIALS.has(piece.type) && !piece.abilityUsed) showSpecialHelp(piece.type);
    state.selected = { row, col };
    render();
    return;
  }

  deploy(row, col);
}

function retireSpecial(piece) {
  piece.originalType = piece.originalType || piece.type;
  piece.type = "soldier";
  piece.abilityUsed = true;
}

function convertPiece(row, col, owner) {
  const piece = state.board[row][col];
  if (!piece) return;
  if (piece.type === "king") {
    state.stats.captures[owner] += 1;
    state.board[row][col] = createOccupiedSoldier(owner);
    declareWinner(owner, `${sideName(piece.owner)} King was captured by Diplomat conversion.`);
    return;
  }
  state.stats.captures[owner] += 1;
  piece.owner = owner;
  piece.type = "soldier";
  piece.abilityUsed = true;
}

function teleportWizard(row, col) {
  if (!state.teleporting) return;
  if (!inBounds(row, col) || state.board[row][col]) {
    addLog("Wizard needs an empty teleport cell.");
    render();
    return;
  }

  const { row: fromRow, col: fromCol, owner } = state.teleporting;
  const wizard = state.board[fromRow][fromCol];
  if (!wizard || wizard.owner !== owner) {
    state.teleporting = null;
    render();
    return;
  }

  state.board[fromRow][fromCol] = null;
  state.board[row][col] = wizard;
  state.teleporting = null;
  addLog(`${sideName(owner)} Wizard teleported to ${coord(row, col)}.`);
  resolveAllCaptures(owner);
  if (state.mode === "tutorial") {
    tutorialAwaitingContinue = true;
    render();
    return;
  }
  endTurn();
}

function scheduleAiTurn() {
  if (state.mode === "pve" && state.teleporting?.owner === pveAiPlayer && !state.aiThinking) {
    state.aiThinking = true;
    render();
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      state.aiThinking = false;
      const destination = chooseAiTeleportDestination(state, neighbors, pveAiPlayer, pveHumanPlayer);
      if (destination) teleportWizard(destination.row, destination.col);
    }, 450);
    return;
  }

  if (!isAiTurn() || state.teleporting || state.aiThinking) return;
  state.aiThinking = true;
  render();
  aiTimer = window.setTimeout(() => {
    aiTimer = null;
    state.aiThinking = false;
    runAiTurn();
  }, 450);
}

function runAiTurn() {
  if (!isAiTurn() || state.winner || state.teleporting) return;

  const deployMove = findAiDeployMove(state, {
    aiPlayer: pveAiPlayer,
    humanPlayer: pveHumanPlayer,
    canDeploy,
    countPieces,
    neighbors,
  });
  if (deployMove && deployUnit(pveAiPlayer, deployMove.type, deployMove.row, deployMove.col)) return;

  addLog(`${sideName(pveAiPlayer)} AI has no valid move.`);
  endTurn();
}

function countPieces(owner) {
  let total = 0;
  forEachPiece((piece) => {
    if (piece.owner === owner) total += 1;
  });
  return total;
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
  const viewerSide = state.mode === "pvp"
    ? networkSession.player
    : state.mode === "pve"
      ? pveHumanPlayer
      : PVE_HUMAN;
  fortressFrame.classList.toggle("view-red", viewerSide === "red");
  renderGame({
    state,
    boardEl,
    turnPill,
    redCount,
    blueCount,
    cancelTeleportBtn,
    tauntBtn,
    undoBtn,
    resultModal,
    networkStatusGroup,
    unitInputs,
    networkReady: networkSession.ready,
    networkPlayer: networkSession.player,
    pveHumanPlayer,
    canUseTaunt: canPlayerUseTaunt(state.mode === "pvp" ? networkSession.player : pveHumanPlayer),
    visibleTaunt,
    undoCount: undoStack.length,
    unitLabels: UNIT_LABELS,
    text,
    sideName,
    coord,
    currentUnitChoice,
    canDeploy,
    selectCell,
    countPieces,
    localizeResultReason,
  });
  const tutorialActive = state.mode === "tutorial";
  tutorialPanel.hidden = !tutorialActive;
  boardEl.classList.toggle("tutorial-active", tutorialActive);
  if (tutorialActive) {
    const complete = tutorialStep >= TUTORIAL_STEPS.length;
    tutorialStepLabel.textContent = complete
      ? text("tutorial")
      : text("tutorialStep", { current: tutorialStep + 1, total: TUTORIAL_STEPS.length });
    const tutorialMessageKey = tutorialReactionPhase === "preparing"
      ? "tutorialBlackPreparing"
      : tutorialReactionPhase === "surrounded"
        ? "tutorialSurroundComplete"
        : tutorialAwaitingContinue
          ? tutorialReactionPending
            ? TUTORIAL_STEPS[tutorialStep].readyMessage
            : state.teleporting
              ? "tutorialWizardTeleport"
              : TUTORIAL_STEPS[tutorialStep].placedMessage
          : TUTORIAL_STEPS[tutorialStep]?.message;
    tutorialMessage.textContent = text(complete ? "tutorialComplete" : tutorialMessageKey);
    nextTutorialBtn.hidden = complete
      || !tutorialAwaitingContinue
      || Boolean(state.teleporting)
      || Boolean(tutorialReactionPhase);
    boardEl.classList.toggle("tutorial-complete", complete);
  } else {
    nextTutorialBtn.hidden = true;
    boardEl.classList.remove("tutorial-active");
    boardEl.classList.remove("tutorial-complete");
  }
}

function localizeResultReason(reason) {
  if (reason === "All enemy units were eliminated.") return text("allEliminated");
  const localizedSides = reason
    .replace(/\bred\b/gi, text("red"))
    .replace(/\bblue\b/gi, text("blue"));
  if (LANGUAGE !== "ko") return localizedSides;
  return localizedSides
    .replaceAll("King", text("king"))
    .replaceAll("was captured", "포획되었습니다")
    .replaceAll("territory capture", "영역 포획")
    .replaceAll("Diplomat conversion", "외교관 전환");
}

let activeSpecialHelpType = null;

function showSpecialHelp(unitType) {
  if (!SPECIAL_HELP[unitType]) return;
  const storageKey = `unknown-kingdom-hide-help-${unitType}`;
  if (localStorage.getItem(storageKey)) return;
  activeSpecialHelpType = unitType;
  specialHelpTitle.textContent = UNIT_LABELS[unitType];
  specialHelpText.textContent = SPECIAL_HELP[unitType];
  hideSpecialHelpCheckbox.checked = false;
  specialHelpModal.hidden = false;
}

undoBtn.addEventListener("click", undoLastMove);
cancelTeleportBtn.addEventListener("click", () => {
  if (state.teleporting) {
    addLog("Wizard teleport was cancelled. Turn ends.");
    state.teleporting = null;
    endTurn();
  }
});
tauntBtn.addEventListener("click", () => {
  if (state.mode === "pvp") {
    sendNetworkAction({ type: "taunt" });
  } else {
    useTaunt(pveHumanPlayer);
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
  undoStack = [];
  tutorialStep = -1;
  tutorialAwaitingContinue = false;
  tutorialKingPosition = null;
  tutorialReactionPending = false;
  tutorialReactionPhase = null;
  state = newState();
  render();
  scheduleAiTurn();
}

function startNewGame() {
  if (tutorialTimer !== null) window.clearTimeout(tutorialTimer);
  tutorialTimer = null;
  tutorialReactionPhase = null;
  disconnectNetwork();
  pveSideModal.hidden = true;
  networkModal.hidden = true;
  resultModal.hidden = true;
  modeModal.hidden = false;
}

function playAgain() {
  if (state.mode === "pvp") {
    sendNetworkAction({ type: "rematch" });
    resultModal.hidden = true;
    setNetworkStatus(text("rematchWaiting"));
    return;
  }
  resetGame();
}

function selectGameMode(mode, closeModal = false) {
  if (mode === "tutorial") {
    startTutorial();
    return;
  }
  const modeInput = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (!modeInput) return;
  modeInput.checked = true;
  if (mode === "pve") {
    disconnectNetwork();
    networkModal.hidden = true;
    modeModal.hidden = true;
    pveSideModal.hidden = false;
    return;
  }
  if (closeModal) modeModal.hidden = true;
  if (mode === "pvp") {
    disconnectNetwork();
    state = newState();
    render();
    networkModal.hidden = false;
    setNetworkStatus(text("createOrJoin"));
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
  document.querySelector("input[name='mode'][value='pve']").checked = true;
  pveSideModal.hidden = true;
  modeModal.hidden = true;
  resetGame();
}

function showNetworkRoomControls() {
  networkRoomControls.hidden = false;
  networkSidePicker.hidden = true;
}

function showNetworkSidePicker() {
  networkRoomControls.hidden = true;
  networkSidePicker.hidden = false;
}

function setNetworkStatus(message) {
  networkStatus.textContent = message;
  networkLobbyStatus.textContent = message;
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
  if (message.type === "room_created" || message.type === "waiting") {
    networkSession.roomCode = message.roomCode;
    roomCodeInput.value = message.roomCode;
    setNetworkStatus(text("roomWaiting", { room: message.roomCode }));
    render();
    return;
  }

  if (message.type === "side_selection") {
    networkSession.roomCode = message.roomCode;
    roomCodeInput.value = message.roomCode;
    showNetworkSidePicker();
    setNetworkStatus(text("sideSelectionReady", { room: message.roomCode }));
    return;
  }

  if (message.type === "match_start" || message.type === "state") {
    networkSession.roomCode = message.roomCode || networkSession.roomCode;
    networkSession.player = message.player || networkSession.player;
    networkSession.ready = true;
    state = message.state;
    if (message.type === "match_start") lastTauntEventId = 0;
    state.mode = "pvp";
    showNetworkRoomControls();
    networkModal.hidden = true;
    setNetworkStatus(text("roomPlayer", { room: networkSession.roomCode, side: sideName(networkSession.player) }));
    if (state.tauntEvent?.id !== lastTauntEventId) showTauntBubble(state.tauntEvent);
    render();
    return;
  }

  if (message.type === "suicide_warning") {
    if (window.confirm(text("suicideWarning"))) {
      sendNetworkAction({ ...message.action, confirmSuicide: true });
    }
    return;
  }

  if (message.type === "error") {
    setNetworkStatus(message.message || text("serverRejected"));
  }
}

function disconnectNetwork() {
  networkSession = closeNetworkConnection(networkSession);
}

newGameBtn.addEventListener("click", startNewGame);
settingsBtn.addEventListener("click", () => {
  settingsStatus.hidden = true;
  settingsModal.hidden = false;
});
resetSpecialHelpBtn.addEventListener("click", () => {
  resetSpecialHelpPreferences();
  settingsStatus.textContent = text("specialHelpReset");
  settingsStatus.hidden = false;
});
closeSettingsBtn.addEventListener("click", () => {
  settingsModal.hidden = true;
});
playAgainBtn.addEventListener("click", playAgain);
createRoomBtn.addEventListener("click", () => connectNetwork({
  type: "create_room",
  protocolVersion: 2,
}));
joinRoomBtn.addEventListener("click", () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!roomCode) {
    setNetworkStatus(text("enterRoomCode"));
    return;
  }
  connectNetwork({
    type: "join_room",
    roomCode,
    protocolVersion: 2,
  });
});
onlineSideButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const sent = sendNetworkCommand(networkSession, {
      type: "choose_side",
      roomCode: networkSession.roomCode,
      side: button.dataset.onlineSide,
    });
    if (!sent) setNetworkStatus(text("notConnected"));
  });
});
pveSideButtons.forEach((button) => {
  button.addEventListener("click", () => startPve(button.dataset.pveSide));
});
cancelPveSideBtn.addEventListener("click", () => {
  pveSideModal.hidden = true;
  modeModal.hidden = false;
});
cancelNetworkBtn.addEventListener("click", () => {
  disconnectNetwork();
  showNetworkRoomControls();
  networkModal.hidden = true;
  modeModal.hidden = false;
});
exitTutorialBtn.addEventListener("click", startNewGame);
nextTutorialBtn.addEventListener("click", () => {
  if (!tutorialAwaitingContinue || tutorialReactionPhase) return;
  if (tutorialReactionPending) {
    tutorialReactionPending = false;
    tutorialReactionPhase = "preparing";
    render();
    tutorialTimer = window.setTimeout(() => {
      state.board[4][5] = createOccupiedSoldier("red");
      tutorialReactionPhase = "surrounded";
      render();
      tutorialTimer = window.setTimeout(() => {
        tutorialTimer = null;
        tutorialReactionPhase = null;
        resolveAllCaptures("red");
        render();
      }, 800);
    }, 300);
    return;
  }
  advanceTutorial();
  render();
});
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
      showSpecialHelp(input.value);
      render();
    }, 0);
  });
  input.addEventListener("change", () => {
    render();
  });
});
closeSpecialHelpBtn.addEventListener("click", () => {
  if (activeSpecialHelpType && hideSpecialHelpCheckbox.checked) {
    localStorage.setItem(`unknown-kingdom-hide-help-${activeSpecialHelpType}`, "hidden");
  }
  activeSpecialHelpType = null;
  specialHelpModal.hidden = true;
});

languageSelect.addEventListener("change", () => {
  const nextLanguage = languageSelect.value === "ko" ? "ko" : "en";
  localStorage.setItem("unknown-kingdom-language", nextLanguage);
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set("lang", nextLanguage);
  location.href = nextUrl.toString();
});

applyLanguage();
state = newState();
const showingNoMoveDemo = applyNoMoveDemo();
if (showingNoMoveDemo) {
  modeModal.hidden = true;
  resolveNoMoveTurn();
}
render();
if (showingNoMoveDemo) scheduleAiTurn();
