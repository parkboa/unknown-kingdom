import {
  SIZE,
  UNIT_TYPES,
  cellKey,
  inBounds,
  neighbors,
  opponent,
  orthogonalPositions,
} from "./constants.js";
import { isSuicideDeployment } from "./capture.js";

export function countPieces(state, owner) {
  return state.board.flat().filter((piece) => piece?.owner === owner).length;
}

export function findKingPosition(state, owner) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state.board[row][col];
      if (piece?.owner === owner && piece.type === "king") return { row, col };
    }
  }
  return null;
}

function deploymentCount(state, player) {
  return state.deploymentCount?.[player] ?? (state.firstDeployDone[player] ? 1 : 0);
}

export function incrementDeploymentCount(state, player) {
  state.deploymentCount ??= { black: 0, white: 0 };
  state.deploymentCount[player] = deploymentCount(state, player) + 1;
}

function isOpponentKingTerritory(state, player, row, col) {
  const enemy = opponent(player);
  const enemyDeployments = deploymentCount(state, enemy);
  if (enemyDeployments <= 0 || enemyDeployments >= 5) return false;
  const king = findKingPosition(state, enemy);
  if (!king) return false;
  const rowDistance = Math.abs(row - king.row);
  const colDistance = Math.abs(col - king.col);
  return rowDistance <= 1 && colDistance <= 1 && (rowDistance !== 0 || colDistance !== 0);
}

export function isOpponentKingSanctuaryOverlap(state, player, row, col) {
  const enemy = opponent(player);
  const king = findKingPosition(state, enemy);
  if (!king) return false;
  const rowDistance = Math.abs(row - king.row);
  const colDistance = Math.abs(col - king.col);
  return Math.max(rowDistance, colDistance) < 3;
}

export function hasEmptyCell(state) {
  return state.board.some((row) => row.some((piece) => !piece));
}

export function wallOwnerForEdge(row, nextRow, nextCol) {
  if (nextRow < 0) return "black";
  if (nextRow >= SIZE) return "white";
  if (nextCol < 0 || nextCol >= SIZE) {
    if (row <= 3) return "black";
    if (row >= 5) return "white";
  }
  return null;
}

export function touchesOwnWall(owner, row, col) {
  return orthogonalPositions(row, col)
    .some(([nextRow, nextCol]) => !inBounds(nextRow, nextCol)
      && wallOwnerForEdge(row, nextRow, nextCol) === owner);
}

export function collectGroup(state, row, col) {
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

export function groupHasLiberty(state, group, owner) {
  return group.some(([row, col]) =>
    orthogonalPositions(row, col).some(([nextRow, nextCol]) => {
      if (inBounds(nextRow, nextCol)) return !state.board[nextRow][nextCol];
      const wallOwner = wallOwnerForEdge(row, nextRow, nextCol);
      return wallOwner === owner || wallOwner === null;
    }),
  );
}

export function captureOwners(state, group) {
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

export function boardSignature(state) {
  return state.board.map((row) =>
    row.map((piece) => piece ? `${piece.owner}:${piece.type}:${piece.abilityUsed ? 1 : 0}` : ".").join(","),
  ).join(";");
}

export function isSpecialUnit(type) {
  return type === "general" || type === "wizard" || type === "diplomat";
}

export function isSpecialLocked(state, player, type) {
  if (!isSpecialUnit(type)) return false;
  if (state.mode === "tutorial" || state.mode === "puzzle") return false;
  return deploymentCount(state, player) < 5;
}

export function canDeployPosition(state, player, type, row, col) {
  return !state.winner
    && !state.teleporting
    && !state.pendingSpecial
    && !state.pendingKingSwap
    && UNIT_TYPES.has(type)
    && inBounds(row, col)
    && !state.board[row][col]
    && (state.firstDeployDone[player] || type === "king")
    && (!isSpecialUnit(type) || !isSpecialLocked(state, player, type))
    && !(type === "king" && isOpponentKingSanctuaryOverlap(state, player, row, col))
    && !isOpponentKingTerritory(state, player, row, col)
    && state.stock[player][type] > 0;
}

export function canDeploy(state, player, type, row, col) {
  return player === state.turn && canDeployPosition(state, player, type, row, col);
}

export function hasLegalDeployment(state, player) {
  const unitTypes = state.firstDeployDone[player]
    ? [...UNIT_TYPES].filter((type) => state.stock[player][type] > 0 && !isSpecialLocked(state, player, type))
    : state.stock[player].king > 0 ? ["king"] : [];
  if (!unitTypes.length) return false;
  return unitTypes.some((type) =>
    state.board.some((row, rowIndex) =>
      row.some((piece, colIndex) =>
        canDeployPosition(state, player, type, rowIndex, colIndex)
        && (!state.firstDeployDone[player] || !isSuicideDeployment(state, player, type, rowIndex, colIndex)))));
}

export function kingLibertyCount(state, owner) {
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

export function activeKingZones(state) {
  return ["black", "white"].flatMap((owner) => {
    const deployments = deploymentCount(state, owner);
    const king = findKingPosition(state, owner);
    if (deployments <= 0 || deployments >= 5 || !king) return [];

    const cells = [];
    const minRow = Math.max(0, king.row - 1);
    const maxRow = Math.min(SIZE - 1, king.row + 1);
    const minCol = Math.max(0, king.col - 1);
    const maxCol = Math.min(SIZE - 1, king.col + 1);
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        const row = king.row + rowOffset;
        const col = king.col + colOffset;
        if (!inBounds(row, col)) continue;
        cells.push({
          owner,
          row,
          col,
          rowSpan: 1,
          colSpan: 1,
          center: rowOffset === 0 && colOffset === 0,
          corners: {
            topLeft: row === minRow && col === minCol,
            topRight: row === minRow && col === maxCol,
            bottomLeft: row === maxRow && col === minCol,
            bottomRight: row === maxRow && col === maxCol,
          },
        });
      }
    }
    return cells;
  });
}

