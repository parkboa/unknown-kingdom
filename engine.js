const SIZE = 9;
const WHITE_TERRITORY_BONUS = 2;
const PLAYERS = ["red", "blue"];
const SPECIALS = new Set(["general", "diplomat", "wizard"]);
const UNIT_TYPES = new Set(["soldier", "king", ...SPECIALS]);

const opponent = (player) => player === "red" ? "blue" : "red";
const sideLabel = (player) => player === "red" ? "Black" : "White";
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
    tauntChances: { red: null, blue: null },
    tauntEvent: null,
    tauntSerial: 0,
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
    log: ["New online match started. Black deploys first."],
  };
}

function addLog(state, message) {
  state.log.push(message);
  state.log = state.log.slice(-40);
}

function countPieces(state, owner) {
  return state.board.flat().filter((piece) => piece?.owner === owner).length;
}

function findKingPosition(state, owner) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state.board[row][col];
      if (piece?.owner === owner && piece.type === "king") return { row, col };
    }
  }
  return null;
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

function touchesOwnWall(owner, row, col) {
  return orthogonalPositions(row, col)
    .some(([nextRow, nextCol]) => !inBounds(nextRow, nextCol)
      && wallOwnerForEdge(row, nextRow, nextCol) === owner);
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
  addLog(state, `${sideLabel(winner)} wins. ${reason}`);
}

function finishByTerritory(state, prefix) {
  const red = countPieces(state, "red");
  const blue = countPieces(state, "blue");
  const adjustedBlue = blue + WHITE_TERRITORY_BONUS;
  const reason = `${prefix}: Black ${red} - White ${blue} territory (+${WHITE_TERRITORY_BONUS} second-player compensation).`;
  if (red === adjustedBlue) {
    state.winner = "draw";
    state.resultReason = reason;
  } else {
    declareWinner(state, red > adjustedBlue ? "red" : "blue", reason);
  }
}

function capturePiece(state, row, col, reason) {
  const piece = state.board[row][col];
  if (!piece) return;
  const captor = opponent(piece.owner);
  state.board[row][col] = null;
  state.stats.captures[captor] += 1;
  if (piece.type === "king") declareWinner(state, captor, `${sideLabel(piece.owner)} King was captured by ${reason}.`);
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
      state.board[targetRow][targetCol] = occupiedSoldier(owner);
      state.stats.captures[owner] += 1;
      declareWinner(state, owner, `${sideLabel(piece.owner)} King was captured by Diplomat conversion.`);
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
        state.teleporting = teleport;
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
      state.board[row][col] = occupiedSoldier(captor);
      state.stats.captures[captor] += 1;
      declareWinner(state, captor, `${sideLabel(defender)} King was captured at ${row},${col}.`);
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

export function isSuicideDeployment(state, player, type, row, col) {
  if (!canDeploy(state, player, type, row, col)) return false;
  const simulated = structuredClone(state);
  simulated.board[row][col] = createPiece(player, type);
  simulated.stock[player][type] -= 1;
  simulated.firstDeployDone[player] = true;
  resolveCaptures(simulated, player);
  return simulated.board[row][col]?.owner !== player || simulated.winner === opponent(player);
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
    && state.stock[player][type] > 0;
}

function hasLegalDeployment(state, player) {
  const unitTypes = state.firstDeployDone[player]
    ? [...UNIT_TYPES].filter((type) => state.stock[player][type] > 0)
    : state.stock[player].king > 0 ? ["king"] : [];
  if (!unitTypes.length) return false;
  return state.board.some((row) => row.some((piece) => !piece));
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
  if (!hasLegalDeployment(state, next)) {
    finishByTerritory(state, `${sideLabel(next)} has no legal deployment`);
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
    if (action.unitType === "king" && touchesOwnWall(player, action.row, action.col)) {
      state.tauntChances[opponent(player)] = {
        targetOwner: player,
        row: action.row,
        col: action.col,
      };
    }
    resolveCaptures(state, player);
    if (!state.teleporting && !state.pendingKingSwap && !state.winner) endTurn(state);
    return true;
  }
  if (action.type === "taunt") {
    const chance = state.tauntChances[player];
    const speaker = findKingPosition(state, player);
    if (!chance || !speaker) return false;
    state.tauntChances[player] = null;
    state.tauntSerial += 1;
    state.tauntEvent = {
      id: state.tauntSerial,
      speakerOwner: player,
      targetOwner: chance.targetOwner,
      row: speaker.row,
      col: speaker.col,
    };
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

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function kingLibertyCount(state, owner) {
  const king = findKingPosition(state, owner);
  if (!king) return -1;
  const group = collectGroup(state, king.row, king.col);
  const liberties = new Set();
  for (const [row, col] of group) {
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (inBounds(nextRow, nextCol)) {
        if (!state.board[nextRow][nextCol]) liberties.add(cellKey(nextRow, nextCol));
      } else if (wallOwnerForEdge(row, nextRow, nextCol) === owner) {
        liberties.add(`wall:${row}:${col}:${nextRow}:${nextCol}`);
      }
    }
  }
  return liberties.size;
}

function scoreBotDeployment(publicState, player, action) {
  const before = publicState;
  const after = structuredClone(publicState);
  if (!applyAction(after, player, action)) return Number.NEGATIVE_INFINITY;
  if (after.winner === player) return 100000;
  if (after.winner && after.winner !== player) return -100000;

  const enemy = opponent(player);
  const beforeOwn = countPieces(before, player);
  const beforeEnemy = countPieces(before, enemy);
  const afterOwn = countPieces(after, player);
  const afterEnemy = countPieces(after, enemy);
  const captureGain = after.stats.captures[player] - before.stats.captures[player];
  const ownLoss = beforeOwn + 1 - afterOwn;
  const enemyLoss = beforeEnemy - afterEnemy;
  const ownKingLiberties = kingLibertyCount(after, player);
  const enemyKingLiberties = kingLibertyCount(after, enemy);
  const placedPiece = after.board[action.row]?.[action.col];
  const adjacent = neighbors(action.row, action.col)
    .map(([row, col]) => after.board[row][col]);
  const adjacentAllies = adjacent.filter((piece) => piece?.owner === player).length;
  const adjacentEnemies = adjacent.filter((piece) => piece?.owner === enemy).length;
  const centerDistance = Math.abs(action.row - 4) + Math.abs(action.col - 4);
  const occupiedCells = before.board.flat().filter(Boolean).length;

  let score = 0;
  score += captureGain * 45;
  score += enemyLoss * 22;
  score -= ownLoss * 35;
  score += ownKingLiberties * 9;
  if (enemyKingLiberties >= 0) score += Math.max(0, 6 - enemyKingLiberties) * 10;
  score += adjacentAllies * 5;
  score += adjacentEnemies * 3;
  score += Math.max(0, 5 - centerDistance) * 1.5;
  if (!placedPiece || placedPiece.owner !== player) score -= 80;
  if (action.unitType === "king" && touchesOwnWall(player, action.row, action.col)) score -= 16;
  if (SPECIALS.has(action.unitType)) {
    if (occupiedCells < 10) score -= 5;
    if (occupiedCells >= 10 && occupiedCells <= 55) score += 8;
    score += adjacentEnemies * 8;
  }
  if (action.unitType === "soldier") score += 1;
  return score + Math.random() * 2;
}

function chooseScoredTeleport(state, player) {
  const candidates = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (state.board[row][col]) continue;
      const adjacent = neighbors(row, col).map(([nextRow, nextCol]) => state.board[nextRow][nextCol]);
      const allies = adjacent.filter((piece) => piece?.owner === player).length;
      const enemies = adjacent.filter((piece) => piece && piece.owner !== player).length;
      const centerDistance = Math.abs(row - 4) + Math.abs(col - 4);
      candidates.push({
        action: { type: "wizard_teleport", row, col },
        score: allies * 5 - enemies * 4 + Math.max(0, 5 - centerDistance) + Math.random() * 2,
      });
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  return shuffled(candidates.slice(0, 3))[0]?.action || null;
}

export function chooseBotAction(state, player) {
  if (!PLAYERS.includes(player) || state.winner) return null;
  if (state.tauntChances[player] && findKingPosition(state, player)) return { type: "taunt" };

  if (state.teleporting?.owner === player) {
    return chooseScoredTeleport(stateForPlayer(state, player), player);
  }

  if (state.turn !== player) return null;
  const unitTypes = state.firstDeployDone[player]
    ? [...UNIT_TYPES].filter((type) => state.stock[player][type] > 0)
    : ["king"];
  const cells = Array.from({ length: SIZE * SIZE }, (_, index) => ({
    row: Math.floor(index / SIZE),
    col: index % SIZE,
  }));
  const publicState = stateForPlayer(state, player);
  const candidates = [];

  for (const type of unitTypes) {
    for (const { row, col } of cells) {
      if (canDeploy(state, player, type, row, col)) {
        const action = { type: "deploy", unitType: type, row, col };
        candidates.push({ action, score: scoreBotDeployment(publicState, player, action) });
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  const winningMoves = candidates.filter(({ score }) => score >= 100000);
  if (winningMoves.length) return shuffled(winningMoves)[0].action;
  const explorationPool = Math.random() < 0.15 ? 15 : 6;
  return shuffled(candidates.slice(0, explorationPool))[0]?.action || null;
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
