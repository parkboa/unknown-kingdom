export const SIZE = 9;
export const PROTOCOL_VERSION = 3;
export const WHITE_TERRITORY_BONUS = 0;
export const PLAYERS = ["black", "white"];
export const SPECIALS = new Set(["general", "diplomat", "wizard"]);
export const DEPLOY_ORDER = ["soldier", "king", "general", "diplomat", "wizard"];
export const UNIT_TYPES = new Set(DEPLOY_ORDER);

export const opponent = (player) => player === "black" ? "white" : "black";
export const sideLabel = (player) => player === "black" ? "Black" : "White";
export const inBounds = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;
export const cellKey = (row, col) => `${row}-${col}`;
export const orthogonalPositions = (row, col) => [
  [row - 1, col],
  [row + 1, col],
  [row, col - 1],
  [row, col + 1],
];
export const neighbors = (row, col) => orthogonalPositions(row, col)
  .filter(([nextRow, nextCol]) => inBounds(nextRow, nextCol));
