import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canDeploy,
  countPieces,
  createGameState,
  neighbors,
} from "../src/index.js";
import {
  AI_CANDIDATE_CATALOG,
  classifyAiCandidate,
  createAiCatalogContext,
} from "../../../js/ai-catalog.js";
import {
  AI_DECISION_STAGE,
  findAiDeployMove,
} from "../../../js/ai.js";

function piece(id, owner, type) {
  return {
    id,
    owner,
    type,
    originalType: type,
    revealed: type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

test("candidate catalogs keep overlapping signals while assigning one primary owner", () => {
  const state = createGameState("pve", { aiRank: "grandmaster" });
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.board[4][4] = piece("red-king", "red", "king");
  state.board[0][4] = piece("blue-king", "blue", "king");
  const context = createAiCatalogContext(
    state,
    "red",
    "blue",
    AI_DECISION_STAGE.CATALOG,
  );

  const special = classifyAiCandidate(context, { type: "general", row: 1, col: 4 });
  assert.equal(special.primary, AI_CANDIDATE_CATALOG.SPECIAL);
  assert.deepEqual(special.signals.special, ["special_unit:general"]);
  assert.ok(special.signals.king.includes("enemy_king_liberty"));

  const kingMove = classifyAiCandidate(context, { type: "soldier", row: 4, col: 5 });
  assert.equal(kingMove.primary, AI_CANDIDATE_CATALOG.KING);
  assert.ok(kingMove.signals.king.includes("own_king_liberty"));
  assert.ok(kingMove.signals.board.includes("ordinary_soldier"));

  const boardMove = classifyAiCandidate(context, { type: "soldier", row: 7, col: 7 });
  assert.equal(boardMove.primary, AI_CANDIDATE_CATALOG.BOARD);
  assert.ok(boardMove.signals.board.includes("ordinary_soldier"));
});

test("opening diagnostics record every surviving candidate without changing the selected move contract", () => {
  const state = createGameState("pve", { aiRank: "novice" });
  const move = findAiDeployMove(state, {
    aiPlayer: "red",
    humanPlayer: "blue",
    canDeploy: (player, type, row, col) => canDeploy(state, player, type, row, col),
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
    collectDecisionDiagnostics: true,
  });

  assert.equal(move.type, "king");
  assert.equal(move.decisionStage, AI_DECISION_STAGE.OPENING_KING);
  assert.equal(move.decisionCatalog.primary, AI_CANDIDATE_CATALOG.KING);
  assert.ok(move.decisionDiagnostics.candidates.length > 0);
  assert.ok(move.decisionDiagnostics.candidates.every(
    ({ catalog }) => catalog.primary === AI_CANDIDATE_CATALOG.KING,
  ));
  const selected = move.decisionDiagnostics.candidates.find(({ action }) =>
    action.unitType === move.type && action.row === move.row && action.col === move.col);
  assert.ok(selected.path.some(({ stage, outcome }) => stage === "selection" && outcome === "selected"));
});

test("catalog-stage diagnostics preserve King, special, and board candidates through one decision", () => {
  const state = createGameState("pve", { aiRank: "novice" });
  state.turn = "red";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.stock.red.king = 0;
  state.stock.blue.king = 0;
  state.board[4][4] = piece("red-king", "red", "king");
  state.board[0][4] = piece("blue-king", "blue", "king");

  const move = findAiDeployMove(state, {
    aiPlayer: "red",
    humanPlayer: "blue",
    canDeploy: (player, type, row, col) => canDeploy(state, player, type, row, col),
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
    collectDecisionDiagnostics: true,
  });

  assert.equal(move.decisionStage, AI_DECISION_STAGE.CATALOG);
  const catalogs = new Set(move.decisionDiagnostics.candidates.map(({ catalog }) => catalog.primary));
  assert.deepEqual(
    catalogs,
    new Set([
      AI_CANDIDATE_CATALOG.KING,
      AI_CANDIDATE_CATALOG.SPECIAL,
      AI_CANDIDATE_CATALOG.BOARD,
    ]),
  );
  const selected = move.decisionDiagnostics.candidates.find(({ path }) =>
    path.some(({ stage, outcome }) => stage === "selection" && outcome === "selected"));
  assert.ok(selected);
  assert.ok(selected.path.some(({ stage }) => stage === "search_pool"));
  assert.ok(selected.path.some(({ stage }) => stage === "lookahead"));
});

test("grandmaster diagnostics identify the midgame special-attack search filter", () => {
  const state = createGameState("pve", { aiRank: "grandmaster" });
  state.turn = "red";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.stock.red.king = 0;
  state.stock.blue.king = 0;
  state.board[4][4] = piece("red-king", "red", "king");
  state.board[0][4] = piece("blue-king", "blue", "king");

  const move = findAiDeployMove(state, {
    aiPlayer: "red",
    humanPlayer: "blue",
    canDeploy: (player, type, row, col) => canDeploy(state, player, type, row, col),
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
    collectDecisionDiagnostics: true,
  });

  assert.ok(move.decisionDiagnostics.candidates.some(({ catalog, path }) =>
    catalog.primary === AI_CANDIDATE_CATALOG.SPECIAL
    && path.some(({ stage, outcome, reason }) =>
      stage === "search_pool"
      && outcome === "stopped"
      && reason === "midgame_special_attack_filter")));
});
