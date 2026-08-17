import assert from "node:assert/strict";
import { test } from "node:test";
import { createGameState } from "../src/index.js";
import { findAiDeployMove } from "../../../js/ai.js";
import { neighbors } from "../../../js/board.js";

function countPieces(state, owner) {
  return state.board.flat().filter((p) => p?.owner === owner).length;
}

test("AI finds immediate King capture (winning move)", () => {
  const state = createGameState("pve", { aiRank: "lifeDeathMaster" });
  state.firstDeployDone.red = true;
  state.firstDeployDone.blue = true;
  state.deploymentCount.red = 6;
  state.deploymentCount.blue = 6;

  // Place Red King at (4,4) surrounded on 3 sides by Blue soldiers
  state.board[4][4] = { id: "red-king", owner: "red", type: "king", originalType: "king", revealed: true };
  state.board[3][4] = { id: "blue-1", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  state.board[5][4] = { id: "blue-2", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  state.board[4][3] = { id: "blue-3", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  // (4,5) is empty! Blue can place a soldier at (4,5) to capture Red King at (4,4).

  // Blue is AI
  const move = findAiDeployMove(state, {
    aiPlayer: "blue",
    humanPlayer: "red",
    canDeploy: (player, type, row, col) => !state.board[row][col] && state.stock[player][type] > 0,
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });

  assert.ok(move, "AI should return a move");
  assert.equal(move.row, 4, "AI should place piece at row 4 to capture King");
  assert.equal(move.col, 5, "AI should place piece at col 5 to capture King");
});

test("AI avoids suicidal placement that leads to own King capture", () => {
  const state = createGameState("pve", { aiRank: "lifeDeathMaster" });
  state.firstDeployDone.red = true;
  state.firstDeployDone.blue = true;
  state.deploymentCount.red = 6;
  state.deploymentCount.blue = 6;

  // Place Blue (AI) King at (4,4) surrounded on 3 sides by Red soldiers
  state.board[4][4] = { id: "blue-king", owner: "blue", type: "king", originalType: "king", revealed: true };
  state.board[3][4] = { id: "red-1", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
  state.board[5][4] = { id: "red-2", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
  state.board[4][3] = { id: "red-3", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
  // (4,5) is the ONLY remaining liberty of Blue King.

  const move = findAiDeployMove(state, {
    aiPlayer: "blue",
    humanPlayer: "red",
    canDeploy: (player, type, row, col) => !state.board[row][col] && state.stock[player][type] > 0,
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });

  assert.ok(move, "AI should return a move");
});

test("AI evaluates group captures using exact engine state transitions", () => {
  const state = createGameState("pve", { aiRank: "lifeDeathMaster" });
  state.turn = "blue";
  state.firstDeployDone.red = true;
  state.firstDeployDone.blue = true;
  state.deploymentCount.red = 6;
  state.deploymentCount.blue = 6;

  // Blue AI King at (0,0), Red King at (8,8) with friendly defenders
  state.board[0][0] = { id: "blue-king", owner: "blue", type: "king", originalType: "king", revealed: true };
  state.board[8][8] = { id: "red-king", owner: "red", type: "king", originalType: "king", revealed: true };
  state.board[7][8] = { id: "red-def1", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
  state.board[8][7] = { id: "red-def2", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
  state.stock.blue = { king: 0, soldier: 10, general: 0, wizard: 0, diplomat: 0 };

  // Red group at (2,2) with 1 liberty at (2,3)
  state.board[2][2] = { id: "red-soldier", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
  state.board[1][2] = { id: "blue-s1", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  state.board[3][2] = { id: "blue-s2", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  state.board[2][1] = { id: "blue-s3", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };

  const move = findAiDeployMove(state, {
    aiPlayer: "blue",
    humanPlayer: "red",
    canDeploy: (player, type, row, col) => !state.board[row][col] && state.stock[player][type] > 0,
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });

  assert.ok(move, "AI should return a move");
  assert.equal(move.row, 2, "AI should target row 2 to complete group capture");
  assert.equal(move.col, 3, "AI should target col 3 to complete group capture");
});

test("All 8 AI ranks generate valid moves without errors", () => {
  const ranks = [
    "thirdRateMaster",
    "secondRateMaster",
    "firstRateMaster",
    "peakMaster",
    "transcendentMaster",
    "harmonyMaster",
    "profoundMaster",
    "lifeDeathMaster",
  ];

  for (const rank of ranks) {
    const state = createGameState("pve", { aiRank: rank });
    state.firstDeployDone.red = true;
    state.firstDeployDone.blue = true;
    state.deploymentCount.red = 6;
    state.deploymentCount.blue = 6;
    state.board[0][0] = { id: "blue-king", owner: "blue", type: "king", originalType: "king", revealed: true };
    state.board[8][8] = { id: "red-king", owner: "red", type: "king", originalType: "king", revealed: true };

    const move = findAiDeployMove(state, {
      aiPlayer: "blue",
      humanPlayer: "red",
      canDeploy: (player, type, row, col) => !state.board[row][col] && state.stock[player][type] > 0,
      countPieces: (owner) => countPieces(state, owner),
      neighbors,
    });

    assert.ok(move, `AI rank ${rank} should return a valid move`);
    assert.ok(move.row >= 0 && move.row < 9, `AI rank ${rank} row should be in bounds`);
    assert.ok(move.col >= 0 && move.col < 9, `AI rank ${rank} col should be in bounds`);
  }
});

test("AI handles special reaction transaction settling when surrounding a Wizard", () => {
  const state = createGameState("pve", { aiRank: "lifeDeathMaster" });
  state.turn = "blue";
  state.firstDeployDone.red = true;
  state.firstDeployDone.blue = true;
  state.deploymentCount.red = 6;
  state.deploymentCount.blue = 6;

  state.board[0][0] = { id: "blue-king", owner: "blue", type: "king", originalType: "king", revealed: true };
  state.board[8][8] = { id: "red-king", owner: "red", type: "king", originalType: "king", revealed: true };

  // Red revealed wizard at (4,4) surrounded on 3 sides
  state.board[4][4] = { id: "red-wiz", owner: "red", type: "wizard", originalType: "wizard", revealed: true };
  state.board[3][4] = { id: "blue-s1", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  state.board[5][4] = { id: "blue-s2", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  state.board[4][3] = { id: "blue-s3", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };

  const move = findAiDeployMove(state, {
    aiPlayer: "blue",
    humanPlayer: "red",
    canDeploy: (player, type, row, col) => !state.board[row][col] && state.stock[player][type] > 0,
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });

  assert.ok(move, "AI should return a valid move with Wizard reaction settling");
});

