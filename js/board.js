import { SIZE } from "./config.js";

export function cellKey(row, col) {
  return `${row}-${col}`;
}

export function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

export function neighbors(row, col) {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].filter(([nextRow, nextCol]) => inBounds(nextRow, nextCol));
}

export function orthogonalPositions(row, col) {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
}

export function opponent(player) {
  return player === "red" ? "blue" : "red";
}
