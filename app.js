import {
  DEPLOY_ORDER,
  PVE_AI,
  SIZE,
  SPECIALS,
  createSpecialHelp,
  createUnitLabels,
} from "./js/config.js";
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
  isFortressConnected as connectsToFortress,
} from "./js/capture.js";
import {
  chooseAiKingSwapTarget,
  chooseAiTeleportDestination,
  findAiDeployMove,
} from "./js/ai.js";
import { createTranslator } from "./js/i18n.js";
import {
  buildNetworkUrl,
  connectNetwork as openNetworkConnection,
  createNetworkSession,
  disconnectNetwork as closeNetworkConnection,
  sendNetworkAction as sendNetworkMessage,
} from "./js/network.js";
import {
  createInitialState,
  createOccupiedSoldier,
  createPiece,
} from "./js/state.js";
import {
  publicName as getPublicName,
  renderGame,
  viewerOwnsPiece as doesViewerOwnPiece,
} from "./js/render.js";

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

let state;
let undoStack = [];
let aiTimer = null;
let networkSession = createNetworkSession();

const boardEl = document.querySelector("#board");
const turnPill = document.querySelector("#turnPill");
const redCount = document.querySelector("#redCount");
const blueCount = document.querySelector("#blueCount");
const cancelTeleportBtn = document.querySelector("#cancelTeleportBtn");
const undoBtn = document.querySelector("#undoBtn");
const newGameBtn = document.querySelector("#newGameBtn");
const networkStatusGroup = document.querySelector("#networkStatusGroup");
const networkStatus = document.querySelector("#networkStatus");
const modeModal = document.querySelector("#modeModal");
const networkModal = document.querySelector("#networkModal");
const networkLobbyStatus = document.querySelector("#networkLobbyStatus");
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
const languageSelect = document.querySelector("#languageSelect");
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
  cancelTeleportBtn.textContent = text("cancelAbility");
  document.querySelector(".red-counter").setAttribute("aria-label", text("redUnits"));
  document.querySelector(".blue-counter").setAttribute("aria-label", text("blueUnits"));
}

function newState() {
  return createInitialState(currentModeChoice());
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
  state.log = ["No-move demo: Blue has no legal deployment, but the board is not full."];
  return true;
}

function currentUnitChoice() {
  return document.querySelector("input[name='unit']:checked").value;
}

function currentModeChoice() {
  return document.querySelector("input[name='mode']:checked")?.value || "pve";
}

function isAiTurn() {
  return state.mode === "pve" && state.turn === PVE_AI && !state.winner;
}

function canDeploy(player, unitType, row, col) {
  if (state.mode === "pvp") return false;
  if (state.winner || state.teleporting || state.pendingKingSwap) return false;
  if (!inBounds(row, col) || state.board[row][col]) return false;
  if (!state.firstDeployDone[player] && unitType !== "king") return false;
  if (state.stock[player][unitType] <= 0) return false;
  if (deploymentSurvives(player, unitType, row, col)) return true;
  return deploymentSurvives(player, unitType, row, col, true);
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
  if (state.mode === "pve" && state.turn === PVE_AI) return;
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
    addLog(`${capitalize(player)} cannot deploy ${UNIT_LABELS[unitType]} there.`);
    render();
    return;
  }

  saveUndoCheckpoint();
  state.board[row][col] = createPiece(player, unitType);
  state.stock[player][unitType] -= 1;
  state.firstDeployDone[player] = true;
  addLog(`${capitalize(player)} deployed ${UNIT_LABELS[unitType]} at ${coord(row, col)}.`);
  resolveAllCaptures(player);
  endTurn();
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
  const unitName = state.mode === "pve" && player === PVE_AI && unitType !== "king"
    ? text("hiddenUnit")
    : UNIT_LABELS[unitType];
  addLog(`${capitalize(player)} deployed ${unitName} at ${coord(row, col)}.`);
  resolveAllCaptures(player);
  endTurn();
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
  addLog(`${capitalize(winner)} wins. ${reason}`);
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
  const reason = text(reasonTemplate, { red: redTerritory, blue: blueTerritory });
  if (redTerritory === blueTerritory) {
    declareDraw(reason);
  } else {
    declareWinner(redTerritory > blueTerritory ? "red" : "blue", reason);
  }
}

function resolveNoMoveTurn() {
  if (state.winner || hasLegalDeployment(state.turn)) return false;

  const passingPlayer = state.turn;
  const nextPlayer = opponent(passingPlayer);
  if (!hasLegalDeployment(nextPlayer)) {
    finishByTerritory("noLegalMoves");
  } else {
    addLog(text("autoPass", { side: sideName(passingPlayer) }));
    state.turn = nextPlayer;
    state.selected = null;
  }
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
      addLog(`${capitalize(defender)} group resisted capture after special reaction.`);
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
      addLog(`${capitalize(piece.owner)} General triggered while surrounded.`);
    } else if (piece.type === "diplomat") {
      convertAdjacentEnemies(row, col, piece.owner);
      retireSpecial(piece);
      addLog(`${capitalize(piece.owner)} Diplomat triggered while surrounded.`);
    } else if (piece.type === "wizard") {
      strikeAdjacentEnemies(row, col, piece.owner, "Wizard capture reaction");
      retireSpecial(piece);
      if (hasEmptyCell()) {
        const teleport = { row, col, owner: piece.owner, reaction: true };
        if (state.pendingKingSwap) {
          state.pendingWizardTeleport = teleport;
          addLog(`${capitalize(piece.owner)} Wizard triggered while surrounded and will teleport after the King escapes.`);
        } else {
          state.teleporting = teleport;
          addLog(`${capitalize(piece.owner)} Wizard triggered while surrounded. Choose an empty escape cell.`);
        }
        return;
      } else {
        addLog(`${capitalize(piece.owner)} Wizard triggered while surrounded but had no escape cell.`);
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
      const escaped = handleKingCapture(row, col, "territory capture");
      if (escaped) continue;
      state.board[row][col] = createOccupiedSoldier(captor);
      state.stats.captures[captor] += 1;
      declareWinner(captor, `${capitalize(defender)} King was captured a second time at ${coord(row, col)}.`);
      return;
    }

    state.board[row][col] = createOccupiedSoldier(captor);
    occupied += 1;
  }

  state.stats.captures[captor] += occupied;
  if (occupied > 0) addLog(`${capitalize(captor)} captured ${occupied} ${capitalize(defender)} space(s).`);
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

function isFortressConnected(owner, row, col) {
  return connectsToFortress(state, owner, row, col);
}

function capturePiece(row, col, reason) {
  const piece = state.board[row][col];
  if (!piece) return;

  if (piece.type === "king" && handleKingCapture(row, col, reason)) {
    return;
  }

  if (piece.type === "king") {
    state.board[row][col] = null;
    const winner = opponent(piece.owner);
    state.stats.captures[winner] += 1;
    declareWinner(winner, `${capitalize(piece.owner)} King was captured a second time by ${reason}.`);
    return;
  }

  state.board[row][col] = null;
  state.stats.captures[opponent(piece.owner)] += 1;
  addLog(`${capitalize(piece.owner)} ${publicName(piece)} at ${coord(row, col)} was removed by ${reason}.`);
}

function handleKingCapture(row, col, reason) {
  const piece = state.board[row][col];
  if (!piece || piece.type !== "king" || piece.kingEscapeUsed) return false;

  piece.kingEscapeUsed = true;
  piece.revealed = true;
  if (hasKingEscapeTarget(piece.owner, row, col)) {
    state.pendingKingSwap = { row, col, owner: piece.owner, reason };
    addLog(`${capitalize(piece.owner)} King was attacked by ${reason}. Swap with a friendly Soldier or escape to an empty cell within 3 spaces.`);
  } else {
    const winner = opponent(piece.owner);
    state.stats.captures[winner] += 1;
    declareWinner(winner, `${capitalize(piece.owner)} King had no valid escape from ${reason}.`);
  }
  return true;
}

function hasKingEscapeTarget(owner, kingRow, kingCol) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (kingEscapeType(owner, kingRow, kingCol, row, col)) return true;
    }
  }
  return false;
}

function kingEscapeType(owner, kingRow, kingCol, row, col) {
  if (row === kingRow && col === kingCol) return false;
  const piece = state.board[row]?.[col];
  if (piece?.owner === owner && piece.type === "soldier") return "swap";
  const distance = Math.abs(row - kingRow) + Math.abs(col - kingCol);
  if (!piece && distance <= 3) return "escape";
  return null;
}

function completeKingSwap(row, col) {
  const pending = state.pendingKingSwap;
  if (!pending || state.winner) return;
  const escapeType = kingEscapeType(pending.owner, pending.row, pending.col, row, col);
  if (!escapeType) {
    addLog("Choose a friendly Soldier, or an empty cell within 3 spaces of the King.");
    render();
    return;
  }

  const king = state.board[pending.row][pending.col];
  if (!king || king.owner !== pending.owner || king.type !== "king") {
    state.pendingKingSwap = null;
    addLog("King escape was cancelled because the King was no longer at the captured position.");
    render();
    return;
  }
  state.board[pending.row][pending.col] = escapeType === "swap" ? state.board[row][col] : null;
  state.board[row][col] = king;
  state.pendingKingSwap = null;
  const action = escapeType === "swap" ? "swapped with a Soldier" : "escaped";
  addLog(`${capitalize(pending.owner)} King ${action} to ${coord(row, col)}.`);

  if (state.pendingWizardTeleport) {
    state.teleporting = state.pendingWizardTeleport;
    state.pendingWizardTeleport = null;
    addLog(`${capitalize(state.teleporting.owner)} Wizard may now choose an empty teleport cell.`);
    render();
    scheduleAiTurn();
    return;
  }

  resolveAllCaptures(pending.owner);
  endTurn();
}

function publicName(piece) {
  return getPublicName(piece, UNIT_LABELS, text);
}

function viewerOwnsPiece(piece) {
  return doesViewerOwnPiece(state, networkSession.player, piece);
}

function selectCell(row, col) {
  if (state.winner) return;
  if (state.mode === "pvp") {
    if (!networkSession.ready) return;
    if (state.pendingKingSwap) {
      if (state.pendingKingSwap.owner !== networkSession.player) return;
      sendNetworkAction({ type: "king_escape", row, col });
      return;
    }
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

  if (state.pendingKingSwap) {
    completeKingSwap(row, col);
    return;
  }

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
    if (handleKingCapture(row, col, "Diplomat conversion")) return;
    state.stats.captures[owner] += 1;
    declareWinner(owner, `${capitalize(piece.owner)} King was captured a second time by Diplomat conversion.`);
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
  addLog(`${capitalize(owner)} Wizard teleported to ${coord(row, col)}.`);
  resolveAllCaptures(owner);
  endTurn();
}

function scheduleAiTurn() {
  if (state.mode === "pve" && state.pendingKingSwap?.owner === PVE_AI && !state.aiThinking) {
    state.aiThinking = true;
    render();
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      state.aiThinking = false;
      const destination = chooseAiKingSwapTarget(state, { kingEscapeType, neighbors, isFortressConnected });
      if (destination) completeKingSwap(destination.row, destination.col);
    }, 450);
    return;
  }

  if (state.mode === "pve" && state.teleporting?.owner === PVE_AI && !state.aiThinking) {
    state.aiThinking = true;
    render();
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      state.aiThinking = false;
      const destination = chooseAiTeleportDestination(state, neighbors);
      if (destination) teleportWizard(destination.row, destination.col);
    }, 450);
    return;
  }

  if (!isAiTurn() || state.teleporting || state.pendingKingSwap || state.aiThinking) return;
  state.aiThinking = true;
  render();
  aiTimer = window.setTimeout(() => {
    aiTimer = null;
    state.aiThinking = false;
    runBlueAiTurn();
  }, 450);
}

function runBlueAiTurn() {
  if (!isAiTurn() || state.winner || state.teleporting || state.pendingKingSwap) return;

  const deployMove = findAiDeployMove(state, { canDeploy, countPieces, neighbors });
  if (deployMove && deployUnit(PVE_AI, deployMove.type, deployMove.row, deployMove.col)) return;

  addLog(`${capitalize(PVE_AI)} AI has no valid move.`);
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

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function render() {
  renderGame({
    state,
    boardEl,
    turnPill,
    redCount,
    blueCount,
    cancelTeleportBtn,
    undoBtn,
    resultModal,
    networkStatusGroup,
    unitInputs,
    networkReady: networkSession.ready,
    networkPlayer: networkSession.player,
    undoCount: undoStack.length,
    unitLabels: UNIT_LABELS,
    text,
    sideName,
    coord,
    currentUnitChoice,
    canDeploy,
    kingEscapeType,
    selectCell,
    countPieces,
    localizeResultReason,
  });
}

function localizeResultReason(reason) {
  if (LANGUAGE !== "ko") return reason;
  if (reason === "All enemy units were eliminated.") return text("allEliminated");
  return reason
    .replaceAll("Red", text("red"))
    .replaceAll("Blue", text("blue"))
    .replaceAll("King", text("king"))
    .replaceAll("was captured a second time", "두 번째로 포획되었습니다")
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
  if (state.pendingKingSwap) {
    addLog("King escape was cancelled. Turn ends.");
    state.pendingKingSwap = null;
    state.pendingWizardTeleport = null;
    endTurn();
  } else if (state.teleporting) {
    addLog("Wizard teleport was cancelled. Turn ends.");
    state.teleporting = null;
    endTurn();
  }
});
function resetGame() {
  if (aiTimer !== null) window.clearTimeout(aiTimer);
  aiTimer = null;
  undoStack = [];
  state = newState();
  render();
  scheduleAiTurn();
}

function startNewGame() {
  disconnectNetwork();
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
  const modeInput = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (!modeInput) return;
  modeInput.checked = true;
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
  networkModal.hidden = true;
  resetGame();
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
      if (networkSession === session) render();
    },
  });
}

function handleNetworkMessage(message) {
  if (message.type === "room_created" || message.type === "waiting") {
    networkSession.roomCode = message.roomCode;
    roomCodeInput.value = message.roomCode;
    setNetworkStatus(text("roomWaiting", { room: message.roomCode }));
    return;
  }

  if (message.type === "match_start" || message.type === "state") {
    networkSession.roomCode = message.roomCode || networkSession.roomCode;
    networkSession.player = message.player || networkSession.player;
    networkSession.ready = true;
    state = message.state;
    state.mode = "pvp";
    networkModal.hidden = true;
    setNetworkStatus(text("roomPlayer", { room: networkSession.roomCode, side: sideName(networkSession.player) }));
    render();
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
playAgainBtn.addEventListener("click", playAgain);
createRoomBtn.addEventListener("click", () => connectNetwork({ type: "create_room" }));
joinRoomBtn.addEventListener("click", () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!roomCode) {
    setNetworkStatus(text("enterRoomCode"));
    return;
  }
  connectNetwork({ type: "join_room", roomCode });
});
cancelNetworkBtn.addEventListener("click", () => {
  disconnectNetwork();
  networkModal.hidden = true;
  modeModal.hidden = false;
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
  input.closest("label").addEventListener("pointerdown", () => {
    if (SPECIALS.has(input.value)) showSpecialHelp(input.value);
  });
  input.addEventListener("change", () => {
    if (SPECIALS.has(input.value)) showSpecialHelp(input.value);
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
