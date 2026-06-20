import { cellKey, inBounds, neighbors, orthogonalPositions } from "./board.js";
import { SIZE } from "./config.js";

export function boardSignature(state) {
  return state.board
    .map((row) => row.map((piece) => (piece ? `${piece.owner}:${piece.type}:${piece.abilityUsed ? 1 : 0}` : ".")).join(","))
    .join(";");
}

export function wallOwnerForEdge(row, col, nextRow, nextCol) {
  if (nextRow < 0) return "red";
  if (nextRow >= SIZE) return "blue";
  if (nextCol < 0 || nextCol >= SIZE) {
    if (row <= 3) return "red";
    if (row >= 5) return "blue";
  }
  return null;
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
      return wallOwnerForEdge(row, col, nextRow, nextCol) === owner;
    }),
  );
}

export function captureOwnersAroundGroup(state, group) {
  const owners = new Set();
  const groupCells = new Set(group.map(([row, col]) => cellKey(row, col)));

  for (const [row, col] of group) {
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (inBounds(nextRow, nextCol)) {
        if (groupCells.has(cellKey(nextRow, nextCol))) continue;
        const piece = state.board[nextRow][nextCol];
        if (piece) owners.add(piece.owner);
      } else {
        const wallOwner = wallOwnerForEdge(row, col, nextRow, nextCol);
        if (wallOwner) owners.add(wallOwner);
      }
    }
  }
  return [...owners];
}

export function chooseCaptor(state, group, defender, preferredCaptor) {
  const owners = captureOwnersAroundGroup(state, group).filter((owner) => owner !== defender);
  if (!owners.length) return null;
  if (owners.includes(preferredCaptor)) return preferredCaptor;
  return owners[0];
}

export function isFortressConnected(state, owner, row, col) {
  const piece = state.board[row][col];
  if (!piece || piece.owner !== owner) return false;

  const visited = new Set();
  const queue = [[row, col]];
  while (queue.length) {
    const [currentRow, currentCol] = queue.shift();
    const key = cellKey(currentRow, currentCol);
    if (visited.has(key)) continue;
    visited.add(key);

    const touchesOwnWall = orthogonalPositions(currentRow, currentCol)
      .some(([nextRow, nextCol]) => !inBounds(nextRow, nextCol)
        && wallOwnerForEdge(currentRow, currentCol, nextRow, nextCol) === owner);
    if (touchesOwnWall) return true;

    for (const [nextRow, nextCol] of neighbors(currentRow, currentCol)) {
      if (state.board[nextRow][nextCol]?.owner === owner) queue.push([nextRow, nextCol]);
    }
  }
  return false;
}
