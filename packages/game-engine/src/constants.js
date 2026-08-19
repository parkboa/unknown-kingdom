export const SIZE = 9;
export const WHITE_TERRITORY_BONUS = 0;
export const PLAYERS = ["red", "blue"];
export const SPECIALS = new Set(["general", "diplomat", "wizard"]);
export const UNIT_TYPES = new Set(["soldier", "king", ...SPECIALS]);

export const opponent = (player) => player === "red" ? "blue" : "red";
export const sideLabel = (player) => player === "red" ? "Black" : "White";
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

