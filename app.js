const SIZE = 9;
const requestedLanguage = new URLSearchParams(location.search).get("lang") || localStorage.getItem("unknown-kingdom-language");
const LANGUAGE = requestedLanguage === "ko" ? "ko" : "en";
const TEXT = {
  en: {
    deploy: "Deploy", language: "Language", chooseMode: "Choose Game Mode", chooseModeDescription: "Select how you want to start this match.",
    pveDescription: "Play as Blue against the Red AI", onlinePvp: "Online PvP", pvpDescription: "Create or join a private network room",
    networkLobby: "Network Lobby", networkPrompt: "Create a room or enter an invitation code.", roomCode: "Room code",
    enterCode: "Enter code", createRoom: "Create Room", joinRoom: "Join Room", back: "Back", specialUnit: "Special Unit",
    dontShowAgain: "Do not show this unit explanation again", gotIt: "Got It", matchComplete: "Match Complete",
    redTerritory: "Red territory", blueTerritory: "Blue territory", redCaptures: "Red captures", blueCaptures: "Blue captures",
    redSkills: "Red skills used", blueSkills: "Blue skills used", playAgain: "Play Again", cancelAbility: "Cancel Ability",
    undo: "Undo Last Move", newGame: "New Game", redUnits: "Red units", blueUnits: "Blue units",
    soldier: "Soldier", king: "King", general: "General", diplomat: "Diplomat", wizard: "Wizard",
    used: "Used", kingFirst: "King first", left: "{count} left", available: "Available",
    red: "Red", blue: "Blue", turn: "{side} turn", thinking: " thinking", wins: "{side} wins",
    hiddenUnit: "a hidden unit", notConnected: "The online match is not connected.", createOrJoin: "Create or join a room.",
    rematchWaiting: "Rematch requested. Waiting for opponent…", connecting: "Connecting to game server…",
    disconnected: "Disconnected from game server.", serverUnavailable: "Game server is unavailable. Online PvP requires the WebSocket server.",
    roomWaiting: "Room {room}. Waiting for opponent…", roomPlayer: "Room {room} · You are {side}.",
    serverRejected: "The game server rejected the request.", enterRoomCode: "Enter a room code.",
    resultWin: "{side} Wins", allEliminated: "All enemy units were eliminated.",
    boardFilled: "Board filled: {red}-{blue} territory.", kingCapturedSecond: "{side} King was captured a second time.",
  },
  ko: {
    deploy: "유닛 배치", language: "언어", chooseMode: "게임 모드 선택", chooseModeDescription: "플레이할 게임 모드를 선택하세요.",
    pveDescription: "파랑 진영으로 빨강 AI와 대결", onlinePvp: "온라인 PvP", pvpDescription: "비공개 방을 만들거나 참가",
    networkLobby: "온라인 대기실", networkPrompt: "방을 만들거나 초대 코드를 입력하세요.", roomCode: "방 코드",
    enterCode: "코드 입력", createRoom: "방 만들기", joinRoom: "방 참가", back: "뒤로", specialUnit: "특수 유닛",
    dontShowAgain: "이 유닛 설명을 다시 표시하지 않기", gotIt: "확인", matchComplete: "경기 종료",
    redTerritory: "빨강 영역", blueTerritory: "파랑 영역", redCaptures: "빨강 포획", blueCaptures: "파랑 포획",
    redSkills: "빨강 스킬 사용", blueSkills: "파랑 스킬 사용", playAgain: "다시 하기", cancelAbility: "스킬 취소",
    undo: "마지막 수 되돌리기", newGame: "새 게임", redUnits: "빨강 유닛", blueUnits: "파랑 유닛",
    soldier: "병사", king: "왕", general: "장군", diplomat: "외교관", wizard: "마법사",
    used: "사용 완료", kingFirst: "왕 먼저", left: "{count}개", available: "사용 가능",
    red: "빨강", blue: "파랑", turn: "{side} 턴", thinking: " 생각 중", wins: "{side} 승리",
    hiddenUnit: "숨겨진 유닛", notConnected: "온라인 경기에 연결되지 않았습니다.", createOrJoin: "방을 만들거나 참가하세요.",
    rematchWaiting: "재경기를 요청했습니다. 상대를 기다리는 중…", connecting: "게임 서버에 연결 중…",
    disconnected: "게임 서버 연결이 끊어졌습니다.", serverUnavailable: "게임 서버를 사용할 수 없습니다. 온라인 PvP에는 WebSocket 서버가 필요합니다.",
    roomWaiting: "{room} 방에서 상대를 기다리는 중…", roomPlayer: "{room} 방 · 나의 진영: {side}",
    serverRejected: "게임 서버가 요청을 거절했습니다.", enterRoomCode: "방 코드를 입력하세요.",
    resultWin: "{side} 승리", allEliminated: "상대 유닛이 모두 제거되었습니다.",
    boardFilled: "보드 종료: 빨강 {red} - 파랑 {blue}.", kingCapturedSecond: "{side} 왕이 두 번째로 포획되었습니다.",
  },
};
const UNIT_LABELS = {
  soldier: TEXT[LANGUAGE].soldier,
  king: TEXT[LANGUAGE].king,
  general: TEXT[LANGUAGE].general,
  diplomat: TEXT[LANGUAGE].diplomat,
  wizard: TEXT[LANGUAGE].wizard,
};
const SPECIALS = new Set(["general", "diplomat", "wizard"]);
const DEPLOY_ORDER = ["soldier", "general", "diplomat", "wizard", "king"];
const SPECIAL_HELP = {
  general: LANGUAGE === "ko"
    ? "장군의 집단이 완전히 포위되면 포획 판정 전에 인접한 적 유닛을 제거합니다."
    : "When its group is fully surrounded, the General removes adjacent enemy units before capture is resolved.",
  diplomat: LANGUAGE === "ko"
    ? "외교관의 집단이 완전히 포위되면 포획 판정 전에 인접한 적 유닛을 아군 병사로 전환합니다."
    : "When its group is fully surrounded, the Diplomat converts adjacent enemy units into friendly Soldiers before capture is resolved.",
  wizard: LANGUAGE === "ko"
    ? "마법사의 집단이 완전히 포위되면 인접한 적을 제거하고 선택한 빈 칸으로 텔레포트합니다."
    : "When its group is fully surrounded, the Wizard removes adjacent enemies and then teleports to an empty cell you choose.",
};
const AI_PROFILES = ["balanced", "aggressive", "defensive"];
const PVE_HUMAN = "blue";
const PVE_AI = "red";

let state;
let undoStack = [];
let aiTimer = null;
let networkSession = {
  socket: null,
  connected: false,
  ready: false,
  roomCode: "",
  player: null,
};

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

function text(key, values = {}) {
  let output = TEXT[LANGUAGE][key] || TEXT.en[key] || key;
  Object.entries(values).forEach(([name, value]) => {
    output = output.replaceAll(`{${name}}`, value);
  });
  return output;
}

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
  const mode = currentModeChoice();
  const startingSide = mode === "pvp" ? "red" : PVE_HUMAN;
  const aiProfile = AI_PROFILES[Math.floor(Math.random() * AI_PROFILES.length)];
  return {
    board: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null)),
    turn: startingSide,
    selected: null,
    teleporting: null,
    pendingWizardTeleport: null,
    pendingKingSwap: null,
    winner: null,
    resultReason: "",
    mode,
    aiProfile,
    aiThinking: false,
    stock: {
      red: { soldier: 77, king: 1, general: 1, diplomat: 1, wizard: 1 },
      blue: { soldier: 77, king: 1, general: 1, diplomat: 1, wizard: 1 },
    },
    firstDeployDone: { red: false, blue: false },
    stats: {
      captures: { red: 0, blue: 0 },
      specialsUsed: { red: 0, blue: 0 },
    },
    log: [`New match started. ${capitalize(startingSide)} deploys first.`],
  };
}

function cellKey(row, col) {
  return `${row}-${col}`;
}

function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function neighbors(row, col) {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].filter(([nextRow, nextCol]) => inBounds(nextRow, nextCol));
}

function opponent(player) {
  return player === "red" ? "blue" : "red";
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

function createPiece(owner, type) {
  return {
    id: `${owner}-${type}-${crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random()}`,
    owner,
    type,
    originalType: type,
    revealed: type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };
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
  if (!networkSession.ready || networkSession.socket?.readyState !== WebSocket.OPEN) {
    setNetworkStatus(text("notConnected"));
    return;
  }
  networkSession.socket.send(JSON.stringify({
    type: "action",
    roomCode: networkSession.roomCode,
    action,
  }));
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

function endTurn() {
  if (!state.winner) {
    if (!hasEmptyCell()) {
      const redTerritory = countPieces("red");
      const blueTerritory = countPieces("blue");
      if (redTerritory !== blueTerritory) {
        const winner = redTerritory > blueTerritory ? "red" : "blue";
        declareWinner(winner, `Board filled: ${redTerritory}-${blueTerritory} territory.`);
      }
    }

    const nextPlayer = opponent(state.turn);
    if (!state.winner && countPieces(nextPlayer) === 0 && state.firstDeployDone[nextPlayer]) {
      declareWinner(state.turn, "All enemy units were eliminated.");
    } else {
      if (!state.winner) {
        state.turn = nextPlayer;
        state.selected = null;
      }
    }
  }
  render();
  scheduleAiTurn();
}

function resolveAllCaptures(preferredCaptor) {
  let changed = true;
  let passes = 0;

  while (changed && passes < 12 && !state.winner) {
    changed = false;
    passes += 1;
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
  return state.board
    .map((row) => row.map((piece) => (piece ? `${piece.owner}:${piece.type}:${piece.abilityUsed ? 1 : 0}` : ".")).join(","))
    .join(";");
}

function chooseCaptor(group, defender, preferredCaptor) {
  const owners = captureOwnersAroundGroup(group).filter((owner) => owner !== defender);
  if (!owners.length) return null;
  if (owners.includes(preferredCaptor)) return preferredCaptor;
  return owners[0];
}

function captureOwnersAroundGroup(group) {
  const owners = new Set();
  const groupCells = new Set(group.map(([row, col]) => cellKey(row, col)));

  for (const [row, col] of group) {
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (inBounds(nextRow, nextCol)) {
        if (groupCells.has(cellKey(nextRow, nextCol))) continue;
        const piece = state.board[nextRow][nextCol];
        if (piece) owners.add(piece.owner);
      } else {
        const wallOwnerName = wallOwnerForEdge(row, col, nextRow, nextCol);
        if (wallOwnerName) owners.add(wallOwnerName);
      }
    }
  }

  return [...owners];
}

function orthogonalPositions(row, col) {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
}

function wallOwnerForEdge(row, col, nextRow, nextCol) {
  if (nextRow < 0) return "red";
  if (nextRow >= SIZE) return "blue";
  if (nextCol < 0 || nextCol >= SIZE) {
    if (row <= 3) return "red";
    if (row >= 5) return "blue";
  }
  return null;
}

function collectGroup(row, col) {
  const origin = state.board[row][col];
  if (!origin) return [];

  const group = [];
  const visited = new Set();
  const queue = [[row, col]];

  while (queue.length) {
    const [currentRow, currentCol] = queue.shift();
    const key = cellKey(currentRow, currentCol);
    if (visited.has(key)) continue;
    visited.add(key);

    const piece = state.board[currentRow][currentCol];
    if (!piece || piece.owner !== origin.owner) continue;

    group.push([currentRow, currentCol]);
    for (const [nextRow, nextCol] of neighbors(currentRow, currentCol)) {
      const nextPiece = state.board[nextRow][nextCol];
      if (nextPiece?.owner === origin.owner) queue.push([nextRow, nextCol]);
    }
  }

  return group;
}

function groupHasLiberty(group, owner) {
  return group.some(([row, col]) => {
    const piece = state.board[row][col];
    if (!piece) return false;
    return orthogonalPositions(row, col).some(([nextRow, nextCol]) => {
      if (inBounds(nextRow, nextCol)) return !state.board[nextRow][nextCol];
      return wallOwnerForEdge(row, col, nextRow, nextCol) === owner;
    });
  });
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
  const piece = state.board[row][col];
  if (!piece || piece.owner !== owner) return false;

  const visited = new Set();
  const queue = [[row, col]];
  while (queue.length) {
    const [currentRow, currentCol] = queue.shift();
    const key = cellKey(currentRow, currentCol);
    if (visited.has(key)) continue;
    visited.add(key);

    if (orthogonalPositions(currentRow, currentCol).some(([nextRow, nextCol]) => !inBounds(nextRow, nextCol) && wallOwnerForEdge(currentRow, currentCol, nextRow, nextCol) === owner)) return true;

    for (const [nextRow, nextCol] of neighbors(currentRow, currentCol)) {
      const nextPiece = state.board[nextRow][nextCol];
      if (nextPiece?.owner === owner) queue.push([nextRow, nextCol]);
    }
  }
  return false;
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

function createOccupiedSoldier(owner) {
  return {
    id: `${owner}-occupied-${crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random()}`,
    owner,
    type: "soldier",
    originalType: "soldier",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
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
  if (piece.type === "king") return UNIT_LABELS.king;
  const revealedType = revealedSpecialType(piece);
  if (revealedType) return `${UNIT_LABELS[revealedType]} (${text("used")})`;
  return UNIT_LABELS.soldier;
}

function revealedSpecialType(piece) {
  return piece.revealed && piece.abilityUsed && SPECIALS.has(piece.originalType) ? piece.originalType : null;
}

function selectCell(row, col) {
  if (state.winner) return;
  if (state.mode === "pvp") {
    if (!networkSession.ready || state.turn !== networkSession.player) return;
    if (state.pendingKingSwap) {
      sendNetworkAction({ type: "king_escape", row, col });
      return;
    }
    if (state.teleporting) {
      sendNetworkAction({ type: "wizard_teleport", row, col });
      return;
    }
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
      const destination = chooseAiKingSwapTarget();
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
      const destination = chooseAiTeleportDestination();
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

  const deployMove = findAiDeployMove();
  if (deployMove && deployUnit(PVE_AI, deployMove.type, deployMove.row, deployMove.col)) return;

  addLog(`${capitalize(PVE_AI)} AI has no valid move.`);
  endTurn();
}

function findAiDeployMove() {
  const type = chooseAiDeployType();
  const candidates = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!canDeploy(PVE_AI, type, row, col)) continue;
      candidates.push({ row, col, type, score: scoreAiCell(row, col) + Math.random() * aiPositionVariance() });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function chooseAiDeployType() {
  if (!state.firstDeployDone[PVE_AI] && state.stock[PVE_AI].king > 0) return "king";

  const aiCount = countPieces(PVE_AI);
  const humanCount = countPieces(PVE_HUMAN);
  const pressure = Math.max(0, humanCount - aiCount);
  const weightsByProfile = {
    balanced: { soldier: 62, general: 14, wizard: 13, diplomat: 11 },
    aggressive: { soldier: 48, general: 24, wizard: 19, diplomat: 9 },
    defensive: { soldier: 68, general: 9, wizard: 9, diplomat: 14 },
  };
  const weights = { ...weightsByProfile[state.aiProfile] };

  if (pressure > 0) {
    weights.general += pressure * 4;
    weights.diplomat += pressure * 3;
  }
  if (humanCount >= 5) weights.wizard += 6;
  if (aiCount < 2) weights.soldier += 25;

  const choices = Object.entries(weights)
    .filter(([type]) => state.stock[PVE_AI][type] > 0)
    .map(([type, weight]) => ({ type, weight }));

  return weightedChoice(choices) || "soldier";
}

function weightedChoice(choices) {
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  for (const choice of choices) {
    roll -= choice.weight;
    if (roll <= 0) return choice.type;
  }
  return choices[choices.length - 1]?.type || null;
}

function aiPositionVariance() {
  if (state.aiProfile === "aggressive") return 8;
  if (state.aiProfile === "defensive") return 13;
  return 10;
}

function scoreAiCell(row, col) {
  const centerScore = 8 - (Math.abs(row - 4) + Math.abs(col - 4));
  const adjacentAllies = neighbors(row, col).filter(([nextRow, nextCol]) => state.board[nextRow][nextCol]?.owner === PVE_AI).length;
  const adjacentEnemies = neighbors(row, col).filter(([nextRow, nextCol]) => state.board[nextRow][nextCol]?.owner === PVE_HUMAN).length;
  const homeBoardBias = SIZE - 1 - row;
  return centerScore * 2 + adjacentAllies * 3 + adjacentEnemies * 4 + homeBoardBias;
}

function chooseAiTeleportDestination() {
  const candidates = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!state.board[row][col]) candidates.push({ row, col, score: scoreAiCell(row, col) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function chooseAiKingSwapTarget() {
  const pending = state.pendingKingSwap;
  if (!pending || pending.owner !== PVE_AI) return null;

  const candidates = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const escapeType = kingEscapeType(PVE_AI, pending.row, pending.col, row, col);
      if (!escapeType) continue;
      const adjacentEnemies = neighbors(row, col).filter(([nextRow, nextCol]) => state.board[nextRow][nextCol]?.owner === PVE_HUMAN).length;
      const adjacentAllies = neighbors(row, col).filter(([nextRow, nextCol]) => state.board[nextRow][nextCol]?.owner === PVE_AI).length;
      const fortressSafety = escapeType === "swap" && isFortressConnected(PVE_AI, row, col) ? 20 : 0;
      const homeBoardSafety = (SIZE - 1 - row) * 2;
      candidates.push({
        row,
        col,
        score: fortressSafety + homeBoardSafety + adjacentAllies * 3 - adjacentEnemies * 8 + (escapeType === "escape" ? 4 : 0),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
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
  renderDeployPicker();
  renderBoard();
  renderPanel();
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", coord(row, col));
      button.dataset.row = row;
      button.dataset.col = col;

      if (state.selected?.row === row && state.selected?.col === col) button.classList.add("selected");
      if (canDeploy(state.turn, currentUnitChoice(), row, col)) button.classList.add("valid");
      if (state.teleporting && !state.board[row][col]) button.classList.add("teleport");
      if (state.pendingKingSwap && kingEscapeType(state.pendingKingSwap.owner, state.pendingKingSwap.row, state.pendingKingSwap.col, row, col)) button.classList.add("teleport");

      const piece = state.board[row][col];
      if (piece) button.append(pieceElement(piece, row, col));

      button.addEventListener("click", () => selectCell(row, col));
      boardEl.append(button);
    }
  }
}

function pieceElement(piece, row, col) {
  const el = document.createElement("div");
  const canSeeIdentity = viewerOwnsPiece(piece);
  const visibleType = visiblePieceClass(piece, canSeeIdentity);
  el.className = `piece ${piece.owner} ${visibleType}`;
  if (canSeeIdentity && SPECIALS.has(piece.type) && !piece.abilityUsed) el.classList.add("special");
  if (revealedSpecialType(piece)) el.classList.add("used-special");
  el.textContent = pieceInitial(piece, canSeeIdentity);
  el.title = `${sideName(piece.owner)} ${ownerViewName(piece, canSeeIdentity)}`;
  return el;
}

function visiblePieceClass(piece, canSeeIdentity) {
  if (piece.type === "king") return "king";
  if (revealedSpecialType(piece)) return "special";
  if (canSeeIdentity && SPECIALS.has(piece.type) && !piece.abilityUsed) return "special";
  return "soldier";
}

function viewerOwnsPiece(piece) {
  if (state.mode === "pve") return piece.owner === PVE_HUMAN;
  return piece.owner === networkSession.player;
}

function pieceInitial(piece, canSeeIdentity) {
  if (piece.type === "king") return "K";
  const revealedType = revealedSpecialType(piece);
  if (revealedType === "general") return "G";
  if (revealedType === "wizard") return "W";
  if (revealedType === "diplomat") return "D";
  if (!canSeeIdentity) return "";
  if (piece.type === "general") return "G";
  if (piece.type === "wizard") return "W";
  if (piece.type === "diplomat") return "D";
  return "";
}

function ownerViewName(piece, canSeeIdentity) {
  const revealedType = revealedSpecialType(piece);
  if (revealedType) return `${UNIT_LABELS[revealedType]} (${text("used")})`;
  if (canSeeIdentity) return UNIT_LABELS[piece.type] || UNIT_LABELS.soldier;
  return publicName(piece);
}

function renderPanel() {
  turnPill.textContent = state.winner
    ? text("wins", { side: sideName(state.winner) })
    : text("turn", { side: sideName(state.turn) }) + (state.aiThinking ? text("thinking") : "");
  turnPill.classList.toggle("blue", state.turn === "blue");
  redCount.textContent = countPieces("red");
  blueCount.textContent = countPieces("blue");

  networkStatusGroup.hidden = state.mode !== "pvp";
  networkStatusGroup.classList.toggle("connected", networkSession.ready);
  undoBtn.disabled = state.mode === "pvp" || undoStack.length === 0;
  cancelTeleportBtn.hidden = !state.teleporting && !state.pendingKingSwap;
  renderResultModal();
}

function renderResultModal() {
  resultModal.hidden = !state.winner;
  if (!state.winner) return;

  document.querySelector("#resultTitle").textContent = text("resultWin", { side: sideName(state.winner) });
  document.querySelector("#resultReason").textContent = localizeResultReason(state.resultReason);
  document.querySelector("#resultRedTerritory").textContent = countPieces("red");
  document.querySelector("#resultBlueTerritory").textContent = countPieces("blue");
  document.querySelector("#resultRedCaptures").textContent = state.stats.captures.red;
  document.querySelector("#resultBlueCaptures").textContent = state.stats.captures.blue;
  document.querySelector("#resultRedSpecials").textContent = state.stats.specialsUsed.red;
  document.querySelector("#resultBlueSpecials").textContent = state.stats.specialsUsed.blue;
}

function renderDeployPicker() {
  unitInputs.forEach((input) => {
    const remaining = state.stock[state.turn][input.value];
    const label = input.closest("label");
    const status = label.querySelector("small");
    const exhausted = remaining <= 0;
    const firstMoveLocked = !state.firstDeployDone[state.turn] && input.value !== "king";

    const onlineLocked = state.mode === "pvp" && (!networkSession.ready || state.turn !== networkSession.player);
    input.disabled = exhausted || firstMoveLocked || onlineLocked || state.aiThinking || Boolean(state.winner);
    label.classList.toggle("used", exhausted);
    label.classList.toggle("locked", firstMoveLocked);
    const baseOrder = DEPLOY_ORDER.indexOf(input.value);
    label.style.order = exhausted ? 200 + baseOrder : firstMoveLocked ? 100 + baseOrder : baseOrder;
    status.textContent = exhausted
      ? text("used")
      : firstMoveLocked ? text("kingFirst") : input.value === "soldier" ? text("left", { count: remaining }) : text("available");
  });

  const selectedInput = document.querySelector("input[name='unit']:checked");
  if (selectedInput?.disabled) {
    const fallback = [...unitInputs].find((input) => !input.disabled);
    if (fallback) fallback.checked = true;
  }
}

function localizeResultReason(reason) {
  if (LANGUAGE !== "ko") return reason;
  if (reason === "All enemy units were eliminated.") return text("allEliminated");
  const boardMatch = reason.match(/^Board filled: (\d+)-(\d+) territory\.$/);
  if (boardMatch) return text("boardFilled", { red: boardMatch[1], blue: boardMatch[2] });
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

function networkUrl() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
}

function setNetworkStatus(message) {
  networkStatus.textContent = message;
  networkLobbyStatus.textContent = message;
}

function connectNetwork(command) {
  disconnectNetwork();
  setNetworkStatus(text("connecting"));
  const socket = new WebSocket(networkUrl());
  networkSession.socket = socket;

  socket.addEventListener("open", () => {
    networkSession.connected = true;
    socket.send(JSON.stringify(command));
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    handleNetworkMessage(message);
  });

  socket.addEventListener("close", () => {
    networkSession.connected = false;
    networkSession.ready = false;
    setNetworkStatus(text("disconnected"));
    render();
  });

  socket.addEventListener("error", () => {
    setNetworkStatus(text("serverUnavailable"));
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
  if (networkSession.socket) networkSession.socket.close();
  networkSession = {
    socket: null,
    connected: false,
    ready: false,
    roomCode: "",
    player: null,
  };
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
render();
