import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, createGameState, dispatchAction, getLegalActions, isSuicideDeployment, stateForPlayer } from "../src/index.js";

function soldier(owner, id) {
  return {
    id,
    owner,
    type: "soldier",
    originalType: "soldier",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

function special(owner, type, id) {
  return {
    id,
    owner,
    type,
    originalType: type,
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

function createOpponentSurroundState(type) {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "blue";
  state.board[4][4] = special("red", type, `red-${type}`);
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");
  return state;
}

function createSelfSurroundState(type) {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "red";
  state.board[4][4] = special("red", type, `red-${type}`);
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");
  state.board[3][5] = soldier("blue", "northeast");
  state.board[5][5] = soldier("blue", "southeast");
  state.board[4][6] = soldier("blue", "east");
  return state;
}

test("requires the King as each player's first deployment", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 0, col: 0 }), false);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 0 }), true);
  assert.equal(state.deploymentCount.red, 1);
  assert.deepEqual(state.lastMove, { player: "red", unitType: "king", row: 0, col: 0 });
  assert.equal(state.turn, "blue");
});

test("generates deterministic piece IDs from state-owned sequencing", () => {
  const first = createGameState();
  const second = createGameState();
  const actions = [
    ["red", { type: "deploy", unitType: "king", row: 0, col: 4 }],
    ["blue", { type: "deploy", unitType: "king", row: 8, col: 4 }],
  ];

  for (const [player, action] of actions) {
    assert.equal(applyAction(first, player, action), true);
    assert.equal(applyAction(second, player, action), true);
  }

  assert.equal(first.board[0][4].id, "piece-1");
  assert.equal(first.board[8][4].id, "piece-2");
  assert.equal(first.nextPieceId, 3);
  assert.deepEqual(first, second);
});

test("enumerates only the required King deployments at match start", () => {
  const state = createGameState();
  const actions = getLegalActions(state, "red");
  assert.equal(actions.length, 81);
  assert.ok(actions.every((action) => action.type === "deploy" && action.unitType === "king"));
  assert.deepEqual(getLegalActions(state, "blue"), []);
});

test("blocks opponent deployment around a King until five deployments", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 3, col: 3 }), false);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);

  state.turn = "red";
  for (const [row, col] of [[0, 0], [0, 1], [0, 2], [0, 3]]) {
    assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row, col }), true);
    if (!state.winner) state.turn = "red";
  }

  assert.equal(state.deploymentCount.red, 5);
  state.turn = "blue";
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 3, col: 3 }), true);
});

test("locks special units until player completes five deployments", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 0 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 8 }), true);

  // Deployments 2, 3, 4, 5 for red - special units must be rejected
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "general", row: 1, col: 1 }), false);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 1, col: 1 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 7, col: 7 }), true);

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "wizard", row: 2, col: 2 }), false);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 2, col: 2 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 6, col: 6 }), true);

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "diplomat", row: 3, col: 3 }), false);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 3, col: 3 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 5, col: 5 }), true);

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "general", row: 4, col: 4 }), false);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 4, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 7, col: 6 }), true);

  // Red has now completed 5 deployments (deploymentCount.red === 5) -> 6th deployment allows specials!
  assert.equal(state.deploymentCount.red, 5);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "general", row: 5, col: 4 }), true);
  assert.equal(state.board[5][4]?.type, "general");
});

test("hides unrevealed enemy special identities", () => {
  const state = createGameState();
  state.board[0][0] = {
    id: "secret-general",
    owner: "red",
    type: "general",
    originalType: "general",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  const blueView = stateForPlayer(state, "blue");
  const redView = stateForPlayer(state, "red");
  assert.equal(blueView.board[0][0].type, "soldier");
  assert.equal(redView.board[0][0].type, "general");
});

test("rejects actions from the wrong player", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), false);
});

test("rejects pass while the current player has a legal deployment", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "pass" }), false);
  assert.equal(getLegalActions(state, "red").some((action) => action.type === "pass"), false);
});

test("exposes an explicit pass action and finishes by territory when no deployment is legal", () => {
  const state = createGameState();
  state.turn = "blue";
  state.firstDeployDone = { red: true, blue: true };
  state.stock.blue = { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.board[0][0] = soldier("red", "red-1");
  state.board[0][1] = soldier("red", "red-2");
  state.board[0][2] = soldier("red", "red-3");
  state.board[0][3] = soldier("red", "red-4");
  state.board[8][4] = { ...soldier("blue", "blue-king"), type: "king", originalType: "king", revealed: true };

  assert.deepEqual(getLegalActions(state, "blue"), [{ type: "pass" }]);
  const result = dispatchAction(state, "blue", { type: "pass" });

  assert.equal(result.accepted, true);
  assert.deepEqual(result.events.map(({ type }) => type), ["turn_passed", "match_ended"]);
  assert.deepEqual(state.lastMove, { player: "blue", action: "pass" });
  assert.equal(state.winner, "red");
  assert.equal(result.events[1].trigger, "no_legal_deployment");
});

test("ends the match when a King is captured once", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");
  state.deploymentCount.red = 5;
  state.turn = "blue";

  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.winner, "blue");
  assert.match(state.resultReason, /King was captured/);
  assert.equal(state.pendingKingSwap, null);
});

test("grants one taunt when a King starts against its own wall", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.deepEqual(state.tauntChances.blue, {
    targetOwner: "red",
    row: 0,
    col: 4,
  });
  assert.equal(applyAction(state, "blue", { type: "taunt" }), false);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "taunt" }), true);
  assert.equal(state.tauntChances.blue, null);
  assert.deepEqual(state.tauntEvent, {
    id: 1,
    speakerOwner: "blue",
    targetOwner: "red",
    row: 8,
    col: 4,
  });
  assert.equal(applyAction(state, "blue", { type: "taunt" }), false);
});

test("does not grant a taunt for a King away from its own wall", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);
  assert.equal(state.tauntChances.blue, null);
});

test("neutral side-wall row gives liberty to Black", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "blue";
  state.board[4][0] = soldier("red", "neutral-red");
  state.board[3][0] = soldier("blue", "north");
  state.board[5][0] = soldier("blue", "south");

  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 1 }), true);
  assert.equal(state.board[4][0].owner, "red");
  assert.equal(state.winner, null);
});

test("neutral side-wall row gives liberty to White", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "red";
  state.board[4][0] = soldier("blue", "neutral-blue");
  state.board[3][0] = soldier("red", "north");
  state.board[5][0] = soldier("red", "south");

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 4, col: 1 }), true);
  assert.equal(state.board[4][0].owner, "blue");
  assert.equal(state.winner, null);
});

test("allows a suicidal soldier and removes it immediately", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");
  state.board[4][5] = soldier("blue", "east");
  state.turn = "red";

  const nextPieceId = state.nextPieceId;
  assert.equal(isSuicideDeployment(state, "red", "soldier", 4, 4), true);
  assert.equal(state.nextPieceId, nextPieceId);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 4, col: 4 }), true);
  assert.equal(state.nextPieceId, nextPieceId + 2);
  assert.equal(state.board[4][4].owner, "blue");
  assert.equal(state.board[4][4].type, "soldier");
});

test("does not leak a hidden special through the suicide warning", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.turn = "blue";
  state.board[4][4] = {
    id: "hidden-general",
    owner: "red",
    type: "general",
    originalType: "general",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");

  assert.equal(isSuicideDeployment(state, "blue", "soldier", 4, 5), false);
  const publicState = stateForPlayer(state, "blue");
  assert.equal(publicState.board[4][4].type, "soldier");
  assert.equal(isSuicideDeployment(publicState, "blue", "soldier", 4, 5), false);
});

test("queues a surrounded special until its owner activates it", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "blue";
  state.board[4][4] = {
    id: "red-general",
    owner: "red",
    type: "general",
    originalType: "general",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");

  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.deepEqual(state.pendingSpecial, { row: 4, col: 4, owner: "red", type: "general", captor: "blue" });
  assert.equal(state.turn, "red");
  assert.equal(state.board[4][4].type, "general");
  assert.equal(applyAction(state, "blue", { type: "activate_special" }), false);
  assert.equal(applyAction(state, "red", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.board[4][4].type, "soldier");
  assert.equal(state.board[4][5], null);
});

test("wizard may stay in place after breaking a surround", () => {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 5, blue: 5 };
  state.turn = "blue";
  state.board[4][4] = {
    id: "red-wizard",
    owner: "red",
    type: "wizard",
    originalType: "wizard",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  state.board[3][4] = soldier("blue", "north");
  state.board[5][4] = soldier("blue", "south");
  state.board[4][3] = soldier("blue", "west");

  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.deepEqual(state.pendingSpecial, { row: 4, col: 4, owner: "red", type: "wizard", captor: "blue" });
  assert.equal(applyAction(state, "red", { type: "activate_special" }), true);
  assert.deepEqual(state.teleporting, { row: 4, col: 4, owner: "red", reaction: true });
  assert.equal(state.board[3][4], null);
  assert.equal(state.board[5][4], null);
  assert.equal(state.board[4][3], null);
  assert.equal(state.board[4][5], null);

  assert.equal(applyAction(state, "red", { type: "wizard_stay" }), true);
  assert.equal(state.teleporting, null);
  assert.equal(state.board[4][4].owner, "red");
  assert.equal(state.board[4][4].type, "soldier");
  assert.equal(state.lastMove.action, "stay");
});

test("opponent-surrounded General returns control to its owner for the normal next deployment", () => {
  const state = createOpponentSurroundState("general");

  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "red");
  assert.equal(state.resumeTurn, "red");
  assert.equal(applyAction(state, "red", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.turn, "red");
  assert.equal(state.resumeTurn, null);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 0, col: 0 }), true);
});

test("self-surrounded General resumes the opponent's normal deployment", () => {
  const state = createSelfSurroundState("general");

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "red");
  assert.equal(state.resumeTurn, "blue");
  assert.equal(applyAction(state, "red", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.turn, "blue");
  assert.equal(state.resumeTurn, null);
});

test("opponent-surrounded Diplomat returns control to its owner for the normal next deployment", () => {
  const state = createOpponentSurroundState("diplomat");

  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "red");
  assert.equal(state.resumeTurn, "red");
  assert.equal(applyAction(state, "red", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.turn, "red");
  assert.equal(state.resumeTurn, null);
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 0, col: 0 }), true);
});

test("self-surrounded Diplomat resumes the opponent's normal deployment", () => {
  const state = createSelfSurroundState("diplomat");

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "red");
  assert.equal(state.resumeTurn, "blue");
  assert.equal(applyAction(state, "red", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.turn, "blue");
  assert.equal(state.resumeTurn, null);
});

test("self-surrounded Wizard resumes the opponent's normal deployment after teleporting", () => {
  const state = createSelfSurroundState("wizard");

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "red");
  assert.equal(state.resumeTurn, "blue");
  assert.equal(applyAction(state, "red", { type: "activate_special" }), true);
  assert.deepEqual(state.teleporting, { row: 4, col: 4, owner: "red", reaction: true });
  assert.equal(applyAction(state, "red", { type: "wizard_teleport", row: 0, col: 0 }), true);
  assert.equal(state.teleporting, null);
  assert.equal(state.turn, "blue");
  assert.equal(state.resumeTurn, null);
});

test("self-surrounded Wizard resumes the opponent's normal deployment after staying", () => {
  const state = createSelfSurroundState("wizard");

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "red");
  assert.equal(state.resumeTurn, "blue");
  assert.equal(applyAction(state, "red", { type: "activate_special" }), true);
  assert.deepEqual(state.teleporting, { row: 4, col: 4, owner: "red", reaction: true });
  assert.equal(applyAction(state, "red", { type: "wizard_stay" }), true);
  assert.equal(state.teleporting, null);
  assert.equal(state.turn, "blue");
  assert.equal(state.resumeTurn, null);
});

test("ends by territory when the next player has no deployable units", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.equal(applyAction(state, "blue", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  for (const type of ["soldier", "general", "diplomat", "wizard", "king"]) state.stock.blue[type] = 0;
  state.turn = "red";

  assert.equal(applyAction(state, "red", { type: "deploy", unitType: "soldier", row: 1, col: 4 }), true);
  assert.notEqual(state.winner, null);
  assert.match(state.resultReason, /no legal deployment/);
});

test("validates all challenge puzzles across 8 ranks", async () => {
  const { PUZZLES, RANK_ORDER } = await import("../../../js/puzzles.js");
  assert.equal(PUZZLES.length, 29, "There must be 29 challenge puzzles (1 tutorial + 7 ranks * 4 puzzles)");
  assert.equal(RANK_ORDER.length, 8, "There must be 8 ranks");

  for (const rankKey of RANK_ORDER) {
    const rankPuzzles = PUZZLES.filter((p) => p.rank === rankKey);
    const expectedCount = rankKey === "thirdRateMaster" ? 1 : 4;
    assert.equal(rankPuzzles.length, expectedCount, `Rank ${rankKey} must have ${expectedCount} puzzles`);
  }

  for (const puzzle of PUZZLES) {
    assert.ok(puzzle.id, "Puzzle must have an ID");
    assert.ok(puzzle.title?.en && puzzle.title?.ko, `Puzzle ${puzzle.id} must have bilingual titles`);
    assert.ok(puzzle.description?.en && puzzle.description?.ko, `Puzzle ${puzzle.id} must have bilingual descriptions`);
    if (puzzle.type !== "tutorial") {
      assert.ok(puzzle.maxMoves >= 1, `Puzzle ${puzzle.id} must define maxMoves`);
      assert.ok(puzzle.player === "red" || puzzle.player === "blue", `Puzzle ${puzzle.id} must have valid player`);
      assert.ok(puzzle.objective?.type, `Puzzle ${puzzle.id} must have an objective`);
      for (const piece of puzzle.pieces || []) {
        const [owner, type, row, col] = piece;
        assert.ok(["red", "blue"].includes(owner), `Invalid owner in puzzle ${puzzle.id}`);
        assert.ok(["soldier", "king", "general", "diplomat", "wizard"].includes(type), `Invalid unit in puzzle ${puzzle.id}`);
        assert.ok(row >= 0 && row < 9 && col >= 0 && col < 9, `Piece out of bounds in puzzle ${puzzle.id}`);
      }
    }
  }
});
