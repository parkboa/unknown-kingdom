const SIZE = 9;
const PLAYERS = ["red", "blue"];
const SPECIALS = new Set(["general", "diplomat", "wizard"]);
const UNIT_TYPES = new Set(["soldier", "king", ...SPECIALS]);

const opponent = (player) => player === "red" ? "blue" : "red";
const inBounds = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;
const cellKey = (row, col) => `${row}-${col}`;
const neighbors = (row, col) => [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
  .filter(([nextRow, nextCol]) => inBounds(nextRow, nextCol));
const orthogonalPositions = (row, col) => [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];

function createPiece(owner, type) {
  return {
    id: crypto.randomUUID(),
    owner,
    type,
    originalType: type,
    revealed: type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

function occupiedSoldier(owner) {
  return createPiece(owner, "soldier");
}

export function createGameState() {
  return {
    board: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
    turn: "red",
    selected: null,
    teleporting: null,
    pendingWizardTeleport: null,
    pendingKingSwap: null,
    winner: null,
    resultReason: "",
    mode: "pvp",
    aiProfile: "balanced",
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
    log: ["New online match started. Red deploys first."],
  };
}

function addLog(state, message) {
  state.log.push(message);
  state.log = state.log.slice(-40);
}

function countPieces(state, owner) {
  return state.board.flat().filter((piece) => piece?.owner === owner).length;
}

function hasEmptyCell(state) {
  return state.board.some((row) => row.some((piece) => !piece));
}

function wallOwnerForEdge(row, nextRow, nextCol) {
  if (nextRow < 0) return "red";
  if (nextRow >= SIZE) return "blue";
  if (nextCol < 0 || nextCol >= SIZE) {
    if (row <= 3) return "red";
    if (row >= 5) return "blue";
  }
  return null;
}

function collectGroup(state, row, col) {
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
      if (state.board[nextRow][nextCol]?.owner === origin.owner) queue.push([nextRow, nextCol]);
    }
  }
  return group;
}

function groupHasLiberty(state, group, owner) {
  return group.some(([row, col]) =>
    orthogonalPositions(row, col).some(([nextRow, nextCol]) => {
      if (inBounds(nextRow, nextCol)) return !state.board[nextRow][nextCol];
      return wallOwnerForEdge(row, nextRow, nextCol) === owner;
    }),
  );
}

function captureOwners(state, group) {
  const owners = new Set();
  const groupCells = new Set(group.map(([row, col]) => cellKey(row, col)));
  for (const [row, col] of group) {
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (inBounds(nextRow, nextCol)) {
        if (groupCells.has(cellKey(nextRow, nextCol))) continue;
        const piece = state.board[nextRow][nextCol];
        if (piece) owners.add(piece.owner);
      } else {
        const owner = wallOwnerForEdge(row, nextRow, nextCol);
        if (owner) owners.add(owner);
      }
    }
  }
  return [...owners];
}

function boardSignature(state) {
  return state.board.map((row) =>
    row.map((piece) => piece ? `${piece.owner}:${piece.type}:${piece.abilityUsed ? 1 : 0}` : ".").join(","),
  ).join(";");
}

function declareWinner(state, winner, reason) {
  if (state.winner) return;
  state.winner = winner;
  state.resultReason = reason;
  addLog(state, `${winner} wins. ${reason}`);
}

function finishByTerritory(state, prefix) {
  const red = countPieces(state, "red");
  const blue = countPieces(state, "blue");
  const reason = `${prefix}: ${red}-${blue} territory.`;
  if (red === blue) {
    state.winner = "draw";
    state.resultReason = reason;
  } else {
    declareWinner(state, red > blue ? "red" : "blue", reason);
  }
}

function kingEscapeType(state, owner, kingRow, kingCol, row, col) {
  if (!inBounds(row, col) || (row === kingRow && col === kingCol)) return null;
  const piece = state.board[row][col];
  if (piece?.owner === owner && piece.type === "soldier") return "swap";
  const distance = Math.abs(row - kingRow) + Math.abs(col - kingCol);
  if (!piece && distance <= 3) return "escape";
  return null;
}

function hasKingEscapeTarget(state, owner, kingRow, kingCol) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (kingEscapeType(state, owner, kingRow, kingCol, row, col)) return true;
    }
  }
  return false;
}

function handleKingCapture(state, row, col, reason) {
  const king = state.board[row][col];
  if (!king || king.type !== "king" || king.kingEscapeUsed) return false;
  king.kingEscapeUsed = true;
  king.revealed = true;
  if (hasKingEscapeTarget(state, king.owner, row, col)) {
    state.pendingKingSwap = { row, col, owner: king.owner, reason };
  } else {
    declareWinner(state, opponent(king.owner), `${king.owner} King had no valid escape from ${reason}.`);
  }
  return true;
}

function capturePiece(state, row, col, reason) {
  const piece = state.board[row][col];
  if (!piece) return;
  if (piece.type === "king" && handleKingCapture(state, row, col, reason)) return;
  const captor = opponent(piece.owner);
  state.board[row][col] = null;
  state.stats.captures[captor] += 1;
  if (piece.type === "king") declareWinner(state, captor, `${piece.owner} King was captured a second time by ${reason}.`);
}

function strikeAdjacentEnemies(state, row, col, owner, reason) {
  for (const [targetRow, targetCol] of neighbors(row, col)) {
    if (state.board[targetRow][targetCol]?.owner !== owner) capturePiece(state, targetRow, targetCol, reason);
    if (state.winner || state.pendingKingSwap) return;
  }
}

function convertAdjacentEnemies(state, row, col, owner) {
  for (const [targetRow, targetCol] of neighbors(row, col)) {
    const piece = state.board[targetRow][targetCol];
    if (!piece || piece.owner === owner) continue;
    if (piece.type === "king") {
      if (handleKingCapture(state, targetRow, targetCol, "Diplomat conversion")) return;
      declareWinner(state, owner, `${piece.owner} King was captured a second time by Diplomat conversion.`);
      return;
    }
    state.stats.captures[owner] += 1;
    piece.owner = owner;
    piece.type = "soldier";
    piece.abilityUsed = true;
  }
}

function retireSpecial(piece) {
  piece.originalType ||= piece.type;
  piece.type = "soldier";
  piece.abilityUsed = true;
}

function triggerSpecials(state, group, defender) {
  const specials = group
    .map(([row, col]) => ({ row, col, piece: state.board[row][col] }))
    .filter(({ piece }) => piece?.owner === defender && SPECIALS.has(piece.type) && !piece.abilityUsed);
  for (const { row, col, piece } of specials) {
    piece.revealed = true;
    state.stats.specialsUsed[piece.owner] += 1;
    if (piece.type === "general") {
      strikeAdjacentEnemies(state, row, col, piece.owner, "General capture reaction");
      retireSpecial(piece);
    } else if (piece.type === "diplomat") {
      convertAdjacentEnemies(state, row, col, piece.owner);
      retireSpecial(piece);
    } else {
      strikeAdjacentEnemies(state, row, col, piece.owner, "Wizard capture reaction");
      retireSpecial(piece);
      if (hasEmptyCell(state)) {
        const teleport = { row, col, owner: piece.owner, reaction: true };
        if (state.pendingKingSwap) state.pendingWizardTeleport = teleport;
        else state.teleporting = teleport;
        return;
      }
    }
    if (state.winner || state.pendingKingSwap) return;
  }
}

function occupyGroup(state, group, captor) {
  const defender = state.board[group[0][0]][group[0][1]].owner;
  let occupied = 0;
  for (const [row, col] of group) {
    const piece = state.board[row][col];
    if (!piece) continue;
    if (piece.type === "king") {
      if (handleKingCapture(state, row, col, "territory capture")) continue;
      state.board[row][col] = occupiedSoldier(captor);
      state.stats.captures[captor] += 1;
      declareWinner(state, captor, `${defender} King was captured a second time at ${row},${col}.`);
      return;
    }
    state.board[row][col] = occupiedSoldier(captor);
    occupied += 1;
  }
  state.stats.captures[captor] += occupied;
}

function resolveCapturedGroup(state, group, captor) {
  const defender = state.board[group[0][0]][group[0][1]].owner;
  triggerSpecials(state, group, defender);
  if (state.winner || state.teleporting || state.pendingKingSwap) return;
  const checked = new Set();
  for (const [row, col] of group) {
    if (state.board[row][col]?.owner !== defender) continue;
    const remaining = collectGroup(state, row, col);
    const key = remaining.map(([groupRow, groupCol]) => cellKey(groupRow, groupCol)).sort().join("|");
    if (checked.has(key)) continue;
    checked.add(key);
    if (!groupHasLiberty(state, remaining, defender)) occupyGroup(state, remaining, captor);
    if (state.winner || state.teleporting || state.pendingKingSwap) return;
  }
}

function resolveCaptures(state, preferredCaptor) {
  const seen = new Set();
  let changed = true;
  while (changed && !state.winner) {
    const signature = boardSignature(state);
    if (seen.has(signature)) break;
    seen.add(signature);
    changed = false;
    const checked = new Set();
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const piece = state.board[row][col];
        if (!piece) continue;
        const group = collectGroup(state, row, col);
        const key = group.map(([groupRow, groupCol]) => cellKey(groupRow, groupCol)).sort().join("|");
        if (checked.has(key)) continue;
        checked.add(key);
        if (groupHasLiberty(state, group, piece.owner)) continue;
        const owners = captureOwners(state, group).filter((owner) => owner !== piece.owner);
        const captor = owners.includes(preferredCaptor) ? preferredCaptor : owners[0];
        if (!captor) continue;
        const before = boardSignature(state);
        resolveCapturedGroup(state, group, captor);
        if (state.winner || state.teleporting || state.pendingKingSwap) return;
        changed ||= before !== boardSignature(state);
      }
    }
  }
}

function deploymentSurvives(state, player, type, row, col) {
  const simulated = structuredClone(state);
  simulated.board[row][col] = createPiece(player, type);
  simulated.stock[player][type] -= 1;
  simulated.firstDeployDone[player] = true;
  resolveCaptures(simulated, player);
  return simulated.board[row][col]?.owner === player && simulated.winner !== opponent(player);
}

function canDeploy(state, player, type, row, col) {
  return !state.winner
    && !state.teleporting
    && !state.pendingKingSwap
    && player === state.turn
    && UNIT_TYPES.has(type)
    && inBounds(row, col)
    && !state.board[row][col]
    && (state.firstDeployDone[player] || type === "king")
    && state.stock[player][type] > 0
    && deploymentSurvives(state, player, type, row, col);
}

function endTurn(state) {
  if (state.winner) return;
  if (!hasEmptyCell(state)) {
    finishByTerritory(state, "Board filled");
    return;
  }
  const next = opponent(state.turn);
  if (countPieces(state, next) === 0 && state.firstDeployDone[next]) {
    declareWinner(state, state.turn, "All enemy units were eliminated.");
    return;
  }
  state.turn = next;
  state.selected = null;
}

export function applyAction(state, player, action) {
  if (!PLAYERS.includes(player) || !action || typeof action !== "object" || state.winner) return false;
  if (action.type === "deploy") {
    if (!canDeploy(state, player, action.unitType, action.row, action.col)) return false;
    state.board[action.row][action.col] = createPiece(player, action.unitType);
    state.stock[player][action.unitType] -= 1;
    state.firstDeployDone[player] = true;
    resolveCaptures(state, player);
    if (!state.teleporting && !state.pendingKingSwap && !state.winner) endTurn(state);
    return true;
  }
  if (action.type === "king_escape") {
    const pending = state.pendingKingSwap;
    if (!pending || pending.owner !== player) return false;
    const escapeType = kingEscapeType(state, player, pending.row, pending.col, action.row, action.col);
    if (!escapeType) return false;
    const king = state.board[pending.row][pending.col];
    if (!king || king.owner !== player || king.type !== "king") return false;
    state.board[pending.row][pending.col] = escapeType === "swap" ? state.board[action.row][action.col] : null;
    state.board[action.row][action.col] = king;
    state.pendingKingSwap = null;
    if (state.pendingWizardTeleport) {
      state.teleporting = state.pendingWizardTeleport;
      state.pendingWizardTeleport = null;
    } else {
      resolveCaptures(state, player);
      if (!state.teleporting && !state.pendingKingSwap && !state.winner) endTurn(state);
    }
    return true;
  }
  if (action.type === "wizard_teleport") {
    const pending = state.teleporting;
    if (!pending || pending.owner !== player || !inBounds(action.row, action.col) || state.board[action.row][action.col]) return false;
    const wizard = state.board[pending.row][pending.col];
    if (!wizard || wizard.owner !== player) return false;
    state.board[pending.row][pending.col] = null;
    state.board[action.row][action.col] = wizard;
    state.teleporting = null;
    resolveCaptures(state, player);
    if (!state.teleporting && !state.pendingKingSwap && !state.winner) endTurn(state);
    return true;
  }
  return false;
}

export function stateForPlayer(state, player) {
  const view = structuredClone(state);
  for (const row of view.board) {
    for (const piece of row) {
      if (!piece || piece.owner === player || piece.type === "king" || (piece.revealed && piece.abilityUsed)) continue;
      piece.type = "soldier";
      piece.originalType = "soldier";
      piece.revealed = false;
      piece.abilityUsed = false;
    }
  }
  return view;
}
