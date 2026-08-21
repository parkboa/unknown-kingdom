import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAction, canDeploy, createGameState, getLegalActions, kingLibertyCount, stateForPlayer } from "../src/index.js";
import {
  AI_RANK_SETTINGS,
  AI_TIER_ORDER,
  compareBeliefStonePositions,
  findAiDeployMove,
  normalizeAiTier,
} from "../../../js/ai.js";
import { neighbors } from "../../../js/board.js";

function countPieces(state, owner) {
  return state.board.flat().filter((p) => p?.owner === owner).length;
}

test("all five production difficulty tiers remain on the promoted heuristic engine", () => {
  assert.equal(AI_TIER_ORDER.length, 5);
  for (const tier of AI_TIER_ORDER) {
    assert.equal(AI_RANK_SETTINGS[tier].searchAlgorithm, "heuristic");
  }
});

test("Tactical AI does not treat an undeployed opponent King as a forced win", () => {
  for (const tier of ["expert", "grandmaster"]) {
    const state = createGameState("pve", { aiRank: tier });
    const move = findAiDeployMove(state, {
      aiPlayer: "red",
      humanPlayer: "blue",
      canDeploy: (player, type, row, col) => canDeploy(state, player, type, row, col),
      countPieces: (owner) => countPieces(state, owner),
      neighbors,
    });

    assert.ok(move, `${tier} should choose an opening King deployment`);
    assert.equal(move.type, "king");
    assert.ok(Number.isFinite(move.deepScore), `${tier} opening score should be finite`);
    assert.ok(move.deepScore < 100000, `${tier} should not report a forced win before the opponent King deploys`);
  }
});

test("searching AI does not call a hidden-special King trap a guaranteed win", () => {
  const base = createGameState("pve");
  base.turn = "blue";
  base.firstDeployDone = { red: true, blue: true };
  base.deploymentCount = { red: 6, blue: 6 };
  base.stock.red = { soldier: 70, king: 0, general: 1, diplomat: 0, wizard: 1 };
  base.stock.blue = { soldier: 70, king: 0, general: 1, diplomat: 1, wizard: 1 };

  const place = (row, col, owner, type, revealed = false) => {
    base.board[row][col] = {
      id: `${owner}-${type}-${row}-${col}`,
      owner,
      type,
      originalType: type,
      revealed: revealed || type === "king",
      abilityUsed: false,
      kingEscapeUsed: false,
    };
  };
  place(4, 4, "red", "king", true);
  place(4, 5, "red", "diplomat");
  place(5, 5, "blue", "king", true);
  for (const [row, col] of [[3, 4], [5, 4], [4, 3], [3, 5]]) {
    place(row, col, "blue", "soldier");
  }

  const actualTrap = structuredClone(base);
  assert.equal(applyAction(actualTrap, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 6 }), true);
  assert.equal(actualTrap.pendingSpecial?.type, "diplomat");
  assert.equal(applyAction(actualTrap, "red", { type: "activate_special" }), true);
  assert.equal(actualTrap.winner, "red");

  const originalRandom = Math.random;
  Math.random = () => 0.5;
  try {
    for (const tier of ["intermediate", "advanced", "expert", "grandmaster"]) {
      const state = structuredClone(base);
      state.aiRank = tier;
      const move = findAiDeployMove(stateForPlayer(state, "blue"), {
        aiPlayer: "blue",
        humanPlayer: "red",
        canDeploy: (owner, type, row, col) => canDeploy(state, owner, type, row, col),
        countPieces: (owner) => countPieces(state, owner),
        neighbors,
      });
      assert.ok(move, `${tier} should return a move`);
      assert.ok(move.deepScore < 100000, `${tier} should not report a hidden-information win as guaranteed`);
      const choseTrap = move.type === "soldier" && move.row === 4 && move.col === 6;
      if (choseTrap) {
        assert.equal(move.riskEvaluated, true, `${tier} should inspect the hidden-special risk before gambling`);
        assert.ok(move.riskAdjustment < 0, `${tier} should discount the apparent public-state win`);
        assert.ok(move.deepScore < move.publicDeepScore, `${tier} should retain the uncertainty penalty`);
      }
      if (tier === "grandmaster") {
        assert.equal(choseTrap, false, "grandmaster should veto a move that can immediately kill its King");
      }
    }
  } finally {
    Math.random = originalRandom;
  }
});

test("Depth-3 search keeps a forced King rescue outside the heuristic reply cutoff", () => {
  for (const tier of ["advanced", "expert"]) {
    const state = createGameState("pve", { aiRank: tier });
    state.turn = "blue";
    state.firstDeployDone.red = true;
    state.firstDeployDone.blue = true;
    state.deploymentCount.red = 6;
    state.deploymentCount.blue = 6;

    state.board[0][0] = { id: "blue-king", owner: "blue", type: "king", originalType: "king", revealed: true };
    state.board[8][8] = { id: "red-king", owner: "red", type: "king", originalType: "king", revealed: true };
    state.board[2][2] = { id: "red-soldier", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
    state.board[1][2] = { id: "blue-1", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
    state.board[3][2] = { id: "blue-2", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
    state.board[2][1] = { id: "blue-3", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };

    const move = findAiDeployMove(state, {
      aiPlayer: "blue",
      humanPlayer: "red",
      canDeploy: (player, type, row, col) => canDeploy(state, player, type, row, col),
      countPieces: (owner) => countPieces(state, owner),
      neighbors,
    });

    assert.ok(move, `${tier} should return a tactical move`);
    assert.ok(move.deepScore < 10000, `${tier} should account for Red's forced I8 King rescue`);
  }
});

test("equidistant hidden stones keep the same order after color-swapped vertical mirroring", () => {
  const redKing = { row: 4, col: 4 };
  const blueKing = { row: 4, col: 4 };
  const original = [
    { row: 3, col: 4 },
    { row: 4, col: 3 },
    { row: 4, col: 5 },
    { row: 5, col: 4 },
  ];
  const mirroredRowMajor = original
    .map(({ row, col }) => ({ row: 8 - row, col }))
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const redOrder = original.slice().sort((a, b) => compareBeliefStonePositions(a, b, redKing, "red"));
  const blueOrder = mirroredRowMajor.slice().sort((a, b) => compareBeliefStonePositions(a, b, blueKing, "blue"));

  assert.deepEqual(
    blueOrder,
    redOrder.map(({ row, col }) => ({ row: 8 - row, col })),
  );
});

test("Grandmaster returns an authoritative legal move in a tactical capture position", () => {
  const state = createGameState("pve", { aiRank: "grandmaster" });
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
  const action = { type: "deploy", unitType: move.type, row: move.row, col: move.col };
  assert.equal(getLegalActions(state, "blue").some((legal) => JSON.stringify(legal) === JSON.stringify(action)), true);
  assert.equal(applyAction(structuredClone(state), "blue", action), true);
});

test("legacy 8-rank save values migrate into the five current AI tiers", () => {
  assert.deepEqual(
    [
      "thirdRateMaster",
      "secondRateMaster",
      "firstRateMaster",
      "peakMaster",
      "transcendentMaster",
      "harmonyMaster",
      "profoundMaster",
      "lifeDeathMaster",
    ].map(normalizeAiTier),
    ["novice", "novice", "novice", "novice", "intermediate", "advanced", "expert", "expert"],
  );
});

test("AI handles special reaction transaction settling when surrounding a Wizard", () => {
  const state = createGameState("pve", { aiRank: "expert" });
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
  const action = { type: "deploy", unitType: move.type, row: move.row, col: move.col };
  assert.equal(getLegalActions(state, "blue").some((legal) => JSON.stringify(legal) === JSON.stringify(action)), true);
  assert.equal(applyAction(structuredClone(state), "blue", action), true);
});

test("All 5 primary AI tiers (novice, intermediate, advanced, expert, grandmaster) generate valid moves", () => {
  const tiers = [
    "novice",
    "intermediate",
    "advanced",
    "expert",
    "grandmaster",
  ];

  for (const tier of tiers) {
    const state = createGameState("pve", { aiRank: tier });
    state.turn = "blue";
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

    assert.ok(move, `AI tier ${tier} should return a valid move`);
    const action = { type: "deploy", unitType: move.type, row: move.row, col: move.col };
    assert.equal(
      getLegalActions(state, "blue").some((legal) => JSON.stringify(legal) === JSON.stringify(action)),
      true,
      `AI tier ${tier} should choose an authoritative legal action`,
    );
    assert.equal(applyAction(structuredClone(state), "blue", action), true);
  }
});

test("Grandmaster AI captures an exposed King in one move", () => {
  const state = createGameState("pve", { aiRank: "grandmaster" });
  state.firstDeployDone.red = true;
  state.firstDeployDone.blue = true;
  state.deploymentCount.red = 6;
  state.deploymentCount.blue = 6;

  // Red King at (4,4) surrounded on 3 sides by Blue soldiers
  state.board[4][4] = { id: "red-king", owner: "red", type: "king", originalType: "king", revealed: true };
  state.board[3][4] = { id: "blue-1", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  state.board[5][4] = { id: "blue-2", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  state.board[4][3] = { id: "blue-3", owner: "blue", type: "soldier", originalType: "soldier", revealed: true };
  // (4,5) is the 4th surrounding cell

  const move = findAiDeployMove(state, {
    aiPlayer: "blue",
    humanPlayer: "red",
    canDeploy: (player, type, row, col) => !state.board[row][col] && state.stock[player][type] > 0,
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });

  assert.ok(move, "Grandmaster AI should find winning move");
  assert.equal(move.row, 4, "Grandmaster AI should target row 4");
  assert.equal(move.col, 5, "Grandmaster AI should target col 5");
  const after = structuredClone(state);
  after.turn = "blue";
  assert.equal(applyAction(after, "blue", { type: "deploy", unitType: move.type, row: move.row, col: move.col }), true);
  assert.equal(after.winner, "blue");
});

test("Grandmaster defensive move is legal and increases its King's liberties", () => {
  const state = createGameState("pve", { aiRank: "grandmaster" });
  state.firstDeployDone.red = true;
  state.firstDeployDone.blue = true;
  state.turn = "blue";
  state.deploymentCount.red = 6;
  state.deploymentCount.blue = 6;

  // Blue AI King at (4,4) surrounded on 3 sides by Red soldiers
  state.board[4][4] = { id: "blue-king", owner: "blue", type: "king", originalType: "king", revealed: true };
  state.board[3][4] = { id: "red-1", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
  state.board[5][4] = { id: "red-2", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
  state.board[4][3] = { id: "red-3", owner: "red", type: "soldier", originalType: "soldier", revealed: true };
  state.board[8][8] = { id: "red-king", owner: "red", type: "king", originalType: "king", revealed: true };

  const move = findAiDeployMove(state, {
    aiPlayer: "blue",
    humanPlayer: "red",
    canDeploy: (player, type, row, col) => !state.board[row][col] && state.stock[player][type] > 0,
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });

  assert.ok(move, "Grandmaster AI should find a defensive move");
  const beforeLiberties = kingLibertyCount(state, "blue");
  const after = structuredClone(state);
  assert.equal(applyAction(after, "blue", { type: "deploy", unitType: move.type, row: move.row, col: move.col }), true);
  assert.equal(after.winner, null);
  assert.ok(kingLibertyCount(after, "blue") > beforeLiberties);
});
