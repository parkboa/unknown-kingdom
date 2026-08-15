import { applyAction, getLegalActions } from "./actions.js";
import { stateForPlayer } from "./visibility.js";

const SIZE = 9;
const SPECIALS = new Set(["general", "diplomat", "wizard"]);

const opponent = (player) => player === "red" ? "blue" : "red";
const inBounds = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;
const cellKey = (row, col) => `${row}-${col}`;
const neighbors = (row, col) => [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
  .filter(([nextRow, nextCol]) => inBounds(nextRow, nextCol));
const orthogonalPositions = (row, col) => [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function countPieces(state, owner) {
  return state.board.flat().filter((piece) => piece?.owner === owner).length;
}

function findKingPosition(state, owner) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (state.board[row][col]?.owner === owner && state.board[row][col]?.type === "king") return { row, col };
    }
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

function kingLibertyCount(state, owner) {
  const king = findKingPosition(state, owner);
  if (!king) return -1;
  const group = collectGroup(state, king.row, king.col);
  const liberties = new Set();
  for (const [row, col] of group) {
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (inBounds(nextRow, nextCol)) {
        if (!state.board[nextRow][nextCol]) liberties.add(cellKey(nextRow, nextCol));
      } else {
        const wallOwner = wallOwnerForEdge(row, nextRow, nextCol);
        if (wallOwner === owner || wallOwner === null) liberties.add(`wall:${row}:${col}:${nextRow}:${nextCol}`);
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

function chooseScoredTeleport(state, player, legalActions) {
  const candidates = legalActions
    .filter((action) => action.type === "wizard_teleport")
    .map((action) => {
      const adjacent = neighbors(action.row, action.col)
        .map(([nextRow, nextCol]) => state.board[nextRow][nextCol]);
      const allies = adjacent.filter((piece) => piece?.owner === player).length;
      const enemies = adjacent.filter((piece) => piece && piece.owner !== player).length;
      const centerDistance = Math.abs(action.row - 4) + Math.abs(action.col - 4);
      return {
        action,
        score: allies * 5 - enemies * 4 + Math.max(0, 5 - centerDistance) + Math.random() * 2,
      };
    });
  candidates.sort((left, right) => right.score - left.score);
  return shuffled(candidates.slice(0, 3))[0]?.action || null;
}

export function chooseBotAction(state, player) {
  const legalActions = getLegalActions(state, player);
  if (!legalActions.length) return null;

  const taunt = legalActions.find((action) => action.type === "taunt");
  if (taunt) return taunt;
  const activation = legalActions.find((action) => action.type === "activate_special");
  if (activation) return activation;

  if (state.teleporting?.owner === player) {
    return chooseScoredTeleport(stateForPlayer(state, player), player, legalActions);
  }

  const pass = legalActions.find((action) => action.type === "pass");
  if (pass) return pass;

  const publicState = stateForPlayer(state, player);
  const candidates = legalActions
    .filter((action) => action.type === "deploy")
    .map((action) => ({ action, score: scoreBotDeployment(publicState, player, action) }));
  candidates.sort((left, right) => right.score - left.score);
  const winningMoves = candidates.filter(({ score }) => score >= 100000);
  if (winningMoves.length) return shuffled(winningMoves)[0].action;
  const explorationPool = Math.random() < 0.15 ? 15 : 6;
  return shuffled(candidates.slice(0, explorationPool))[0]?.action || null;
}
