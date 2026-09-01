import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, createGameState, dispatchAction, getLegalActions, hasLegalDeployment, isSuicideDeployment, stateForPlayer } from "../src/index.js";

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

function mirrorColorRows(state) {
  const opposite = (owner) => owner === "black" ? "white" : "black";
  const mirrored = structuredClone(state);
  mirrored.board = state.board
    .slice()
    .reverse()
    .map((row) => row.map((piece) => piece && { ...structuredClone(piece), owner: opposite(piece.owner) }));
  mirrored.turn = opposite(state.turn);
  mirrored.stock = { black: structuredClone(state.stock.white), white: structuredClone(state.stock.black) };
  mirrored.firstDeployDone = { black: state.firstDeployDone.white, white: state.firstDeployDone.black };
  mirrored.deploymentCount = { black: state.deploymentCount.white, white: state.deploymentCount.black };
  mirrored.stats.captures = { black: state.stats.captures.white, white: state.stats.captures.black };
  mirrored.stats.specialsUsed = { black: state.stats.specialsUsed.white, white: state.stats.specialsUsed.black };
  return mirrored;
}

function createOpponentSurroundState(type) {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "white";
  state.board[4][4] = special("black", type, `black-${type}`);
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");
  return state;
}

function createSelfSurroundState(type) {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "black";
  state.board[4][4] = special("black", type, `black-${type}`);
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");
  state.board[3][5] = soldier("white", "northeast");
  state.board[5][5] = soldier("white", "southeast");
  state.board[4][6] = soldier("white", "east");
  return state;
}

test("requires the King as each player's first deployment", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 0, col: 0 }), false);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 0, col: 0 }), true);
  assert.equal(state.deploymentCount.black, 1);
  assert.deepEqual(state.lastMove, { player: "black", unitType: "king", row: 0, col: 0 });
  assert.equal(state.turn, "white");
});

test("simultaneous capturable specials are resolved in color-swapped vertical symmetry", () => {
  const state = createGameState();
  state.turn = "black";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 6, white: 6 };
  state.board[0][8] = special("black", "king", "black-king");
  state.board[0][8].revealed = true;
  state.board[8][0] = special("white", "king", "white-king");
  state.board[8][0].revealed = true;

  state.board[1][1] = special("white", "general", "top-general");
  state.board[7][7] = special("white", "wizard", "bottom-wizard");
  for (const [row, col] of [[0, 1], [2, 1], [1, 0], [1, 2], [6, 7], [8, 7], [7, 6], [7, 8]]) {
    state.board[row][col] = soldier("black", `black-${row}-${col}`);
  }

  const mirrored = mirrorColorRows(state);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 4, col: 4 }), true);
  assert.equal(applyAction(mirrored, "white", { type: "deploy", unitType: "soldier", row: 4, col: 4 }), true);

  assert.deepEqual(
    { owner: mirrored.pendingSpecial.owner, type: mirrored.pendingSpecial.type, row: mirrored.pendingSpecial.row, col: mirrored.pendingSpecial.col },
    { owner: "black", type: state.pendingSpecial.type, row: 8 - state.pendingSpecial.row, col: state.pendingSpecial.col },
  );
  assert.equal(state.pendingSpecial.type, "general");
});

test("generates deterministic piece IDs from state-owned sequencing", () => {
  const first = createGameState();
  const second = createGameState();
  const actions = [
    ["black", { type: "deploy", unitType: "king", row: 0, col: 4 }],
    ["white", { type: "deploy", unitType: "king", row: 8, col: 4 }],
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
  const actions = getLegalActions(state, "black");
  assert.equal(actions.length, 81);
  assert.ok(actions.every((action) => action.type === "deploy" && action.unitType === "king"));
  assert.deepEqual(getLegalActions(state, "white"), []);
});

test("blocks White King placement that overlaps with Black King sanctuary (distance < 3)", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);

  // Black King is at (4,4), with 3x3 sanctuary rows 3..5, cols 3..5.
  // Any White King placed at Chebyshev distance <= 2 (rows 2..6, cols 2..6) would cause sanctuaries to overlap.
  for (let r = 2; r <= 6; r++) {
    for (let c = 2; c <= 6; c++) {
      assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: r, col: c }), false, `Should reject King at (${r},${c})`);
    }
  }

  // White King at distance >= 3 (e.g. row 1, col 4 or row 8, col 4) is allowed
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 1, col: 4 }), true);
  assert.equal(state.turn, "black");
});

test("blocks opponent deployment around a King until five deployments", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 3, col: 3 }), false);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);

  state.turn = "black";
  for (const [row, col] of [[0, 0], [0, 1], [0, 2], [0, 3]]) {
    assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row, col }), true);
    if (!state.winner) state.turn = "black";
  }

  assert.equal(state.deploymentCount.black, 5);
  state.turn = "white";
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 3, col: 3 }), true);
});

test("locks special units until player completes five deployments", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 0, col: 0 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 8 }), true);

  // Deployments 2, 3, 4, 5 for black - special units must be rejected
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "general", row: 1, col: 1 }), false);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 1, col: 1 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 7, col: 7 }), true);

  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "wizard", row: 2, col: 2 }), false);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 2, col: 2 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 6, col: 6 }), true);

  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "diplomat", row: 3, col: 3 }), false);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 3, col: 3 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 5, col: 5 }), true);

  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "general", row: 4, col: 4 }), false);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 4, col: 4 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 7, col: 6 }), true);

  // Black has now completed 5 deployments (deploymentCount.black === 5) -> 6th deployment allows specials!
  assert.equal(state.deploymentCount.black, 5);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "general", row: 5, col: 4 }), true);
  assert.equal(state.board[5][4]?.type, "general");
});

test("hides unrevealed enemy special identities", () => {
  const state = createGameState();
  state.stock.black.general = 0;
  state.board[0][0] = {
    id: "secret-general",
    owner: "black",
    type: "general",
    originalType: "general",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  state.lastMove = { player: "black", unitType: "general", row: 0, col: 0 };
  const whiteView = stateForPlayer(state, "white");
  const blackView = stateForPlayer(state, "black");
  assert.equal(whiteView.board[0][0].type, "soldier");
  assert.equal(whiteView.lastMove.unitType, "soldier");
  assert.equal(blackView.board[0][0].type, "general");
  assert.equal(blackView.lastMove.unitType, "general");
  assert.equal(whiteView.stock.black, null);
  assert.deepEqual(whiteView.stock.white, state.stock.white);
  assert.equal(blackView.stock.white, null);
  assert.deepEqual(blackView.stock.black, state.stock.black);
});

test("rejects an invalid player when creating a hidden-information view", () => {
  assert.throws(() => stateForPlayer(createGameState(), "spectator"), /Unknown player/);
});

test("rejects actions from the wrong player", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 4 }), false);
});

test("rejects pass while the current player has a legal deployment", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "pass" }), false);
  assert.equal(getLegalActions(state, "black").some((action) => action.type === "pass"), false);
});

test("exposes an explicit pass action and finishes by territory when no deployment is legal", () => {
  const state = createGameState();
  state.turn = "white";
  state.firstDeployDone = { black: true, white: true };
  state.stock.white = { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.board[0][0] = soldier("black", "black-1");
  state.board[0][1] = soldier("black", "black-2");
  state.board[0][2] = soldier("black", "black-3");
  state.board[0][3] = soldier("black", "black-4");
  state.board[8][4] = { ...soldier("white", "white-king"), type: "king", originalType: "king", revealed: true };

  assert.deepEqual(getLegalActions(state, "white"), [{ type: "pass" }]);
  const result = dispatchAction(state, "white", { type: "pass" });

  assert.equal(result.accepted, true);
  assert.deepEqual(result.events.map(({ type }) => type), ["turn_passed", "match_ended"]);
  assert.deepEqual(state.lastMove, { player: "white", action: "pass" });
  assert.equal(state.winner, "black");
  assert.equal(result.events[1].trigger, "no_legal_deployment");
});

test("ends the match when a King is captured once", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");
  state.deploymentCount.black = 5;
  state.turn = "white";

  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.winner, "white");
  assert.match(state.resultReason, /King was captured/);
  assert.equal(state.pendingKingSwap, null);
  assert.deepEqual(state.capturedKing, {
    pieceId: "piece-1",
    owner: "black",
    row: 4,
    col: 4,
  });
  assert.equal(state.board[4][4].owner, "white");
  assert.equal(state.board[4][4].type, "soldier");
});

test("automatically emits one taunt when a King starts against its own wall", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.deepEqual(state.tauntEvent, {
    id: 1,
    speakerOwner: "white",
    targetOwner: "black",
    row: 0,
    col: 4,
  });
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  assert.deepEqual(state.tauntEvent, {
    id: 2,
    speakerOwner: "black",
    targetOwner: "white",
    row: 8,
    col: 4,
  });
  assert.equal(applyAction(state, "black", { type: "taunt" }), false);
});

test("does not grant a taunt for a King away from its own wall", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 4, col: 4 }), true);
  assert.equal(state.tauntEvent, null);
});

test("neutral side-wall row gives liberty to Black", () => {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "white";
  state.board[4][0] = soldier("black", "neutral-black");
  state.board[3][0] = soldier("white", "north");
  state.board[5][0] = soldier("white", "south");

  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 4, col: 1 }), true);
  assert.equal(state.board[4][0].owner, "black");
  assert.equal(state.winner, null);
});

test("neutral side-wall row gives liberty to White", () => {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "black";
  state.board[4][0] = soldier("white", "neutral-white");
  state.board[3][0] = soldier("black", "north");
  state.board[5][0] = soldier("black", "south");

  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 4, col: 1 }), true);
  assert.equal(state.board[4][0].owner, "white");
  assert.equal(state.winner, null);
});

test("allows a suicidal soldier and removes it immediately", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");
  state.board[4][5] = soldier("white", "east");
  state.turn = "black";

  const nextPieceId = state.nextPieceId;
  assert.equal(isSuicideDeployment(state, "black", "soldier", 4, 4), true);
  assert.equal(state.nextPieceId, nextPieceId);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 4, col: 4 }), true);
  assert.equal(state.nextPieceId, nextPieceId + 2);
  assert.equal(state.board[4][4].owner, "white");
  assert.equal(state.board[4][4].type, "soldier");
});

test("does not leak a hidden special through the suicide warning", () => {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.turn = "white";
  state.board[4][4] = {
    id: "hidden-general",
    owner: "black",
    type: "general",
    originalType: "general",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");

  assert.equal(isSuicideDeployment(state, "white", "soldier", 4, 5), false);
  const publicState = stateForPlayer(state, "white");
  assert.equal(publicState.board[4][4].type, "soldier");
  assert.equal(isSuicideDeployment(publicState, "white", "soldier", 4, 5), false);
});

test("engine queues a surrounded special and accepts activation only from its owner", () => {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "white";
  state.board[4][4] = {
    id: "black-general",
    owner: "black",
    type: "general",
    originalType: "general",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");

  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.deepEqual(state.pendingSpecial, { row: 4, col: 4, owner: "black", type: "general", captor: "white" });
  assert.equal(state.turn, "black");
  assert.equal(state.board[4][4].type, "general");
  assert.equal(applyAction(state, "white", { type: "activate_special" }), false);
  assert.equal(applyAction(state, "black", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.board[4][4].type, "soldier");
  assert.equal(state.board[4][5], null);
});

test("wizard may stay in place after breaking a surround", () => {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 5, white: 5 };
  state.turn = "white";
  state.board[4][4] = {
    id: "black-wizard",
    owner: "black",
    type: "wizard",
    originalType: "wizard",
    revealed: false,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
  state.board[3][4] = soldier("white", "north");
  state.board[5][4] = soldier("white", "south");
  state.board[4][3] = soldier("white", "west");

  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.deepEqual(state.pendingSpecial, { row: 4, col: 4, owner: "black", type: "wizard", captor: "white" });
  assert.equal(applyAction(state, "black", { type: "activate_special" }), true);
  assert.deepEqual(state.teleporting, { row: 4, col: 4, owner: "black", reaction: true });
  assert.equal(state.board[3][4], null);
  assert.equal(state.board[5][4], null);
  assert.equal(state.board[4][3], null);
  assert.equal(state.board[4][5], null);

  assert.equal(applyAction(state, "black", { type: "wizard_stay" }), true);
  assert.equal(state.teleporting, null);
  assert.equal(state.board[4][4].owner, "black");
  assert.equal(state.board[4][4].type, "soldier");
  assert.equal(state.lastMove.action, "stay");
});

test("opponent-surrounded General returns control to its owner for the normal next deployment", () => {
  const state = createOpponentSurroundState("general");

  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "black");
  assert.equal(state.resumeTurn, "black");
  assert.equal(applyAction(state, "black", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.turn, "black");
  assert.equal(state.resumeTurn, null);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 0, col: 0 }), true);
});

test("self-surrounded General resumes the opponent's normal deployment", () => {
  const state = createSelfSurroundState("general");

  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "black");
  assert.equal(state.resumeTurn, "white");
  assert.equal(applyAction(state, "black", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.turn, "white");
  assert.equal(state.resumeTurn, null);
});

test("opponent-surrounded Diplomat returns control to its owner for the normal next deployment", () => {
  const state = createOpponentSurroundState("diplomat");

  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "black");
  assert.equal(state.resumeTurn, "black");
  assert.equal(applyAction(state, "black", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.turn, "black");
  assert.equal(state.resumeTurn, null);
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 0, col: 0 }), true);
});

test("self-surrounded Diplomat resumes the opponent's normal deployment", () => {
  const state = createSelfSurroundState("diplomat");

  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "black");
  assert.equal(state.resumeTurn, "white");
  assert.equal(applyAction(state, "black", { type: "activate_special" }), true);
  assert.equal(state.pendingSpecial, null);
  assert.equal(state.turn, "white");
  assert.equal(state.resumeTurn, null);
});

test("self-surrounded Wizard resumes the opponent's normal deployment after teleporting", () => {
  const state = createSelfSurroundState("wizard");

  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "black");
  assert.equal(state.resumeTurn, "white");
  assert.equal(applyAction(state, "black", { type: "activate_special" }), true);
  assert.deepEqual(state.teleporting, { row: 4, col: 4, owner: "black", reaction: true });
  assert.equal(applyAction(state, "black", { type: "wizard_teleport", row: 0, col: 0 }), true);
  assert.equal(state.teleporting, null);
  assert.equal(state.turn, "white");
  assert.equal(state.resumeTurn, null);
});

test("self-surrounded Wizard resumes the opponent's normal deployment after staying", () => {
  const state = createSelfSurroundState("wizard");

  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 4, col: 5 }), true);
  assert.equal(state.turn, "black");
  assert.equal(state.resumeTurn, "white");
  assert.equal(applyAction(state, "black", { type: "activate_special" }), true);
  assert.deepEqual(state.teleporting, { row: 4, col: 4, owner: "black", reaction: true });
  assert.equal(applyAction(state, "black", { type: "wizard_stay" }), true);
  assert.equal(state.teleporting, null);
  assert.equal(state.turn, "white");
  assert.equal(state.resumeTurn, null);
});

test("ends by territory when the next player has no deployable units", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  for (const type of ["soldier", "general", "diplomat", "wizard", "king"]) state.stock.white[type] = 0;
  state.turn = "black";

  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 1, col: 4 }), true);
  assert.notEqual(state.winner, null);
  assert.match(state.resultReason, /no legal deployment/);
});

test("ends by territory with 0 bonus when a player has only suicide moves remaining", () => {
  const state = createGameState();
  assert.equal(applyAction(state, "black", { type: "deploy", unitType: "king", row: 0, col: 4 }), true);
  assert.equal(applyAction(state, "white", { type: "deploy", unitType: "king", row: 8, col: 4 }), true);
  
  // Fill all board with black pieces except row 4, col 4 which is surrounded by black pieces with no liberties
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if ((r === 0 && c === 4) || (r === 8 && c === 4)) continue;
      state.board[r][c] = { id: `black-${r}-${c}`, owner: "black", type: "soldier" };
    }
  }
  // Clear cell 4,4
  state.board[4][4] = null;
  state.turn = "black";
  state.stock.black.soldier = 5;
  state.stock.white.soldier = 5;

  // White has 1 empty square at (4,4), but deploying soldier at (4,4) is surrounded by black without liberties (suicide)
  assert.equal(hasLegalDeployment(state, "white"), false);
  
  // When turn ends or passes to white, game immediately finishes by territory
  applyAction(state, "black", { type: "deploy", unitType: "soldier", row: 4, col: 4 });
  // After black places at (4,4), board is full or white has no moves and match ends with winner black
  assert.notEqual(state.winner, null);
  assert.equal(state.winner, "black");
});

test("player resignation immediately awards victory to the opponent", () => {
  const state = createGameState();
  const result = dispatchAction(state, "black", { type: "resign" });
  assert.equal(result.accepted, true);
  assert.equal(state.winner, "white");
  assert.equal(state.resultReason, "Black resigned.");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, "match_ended");
  assert.equal(result.events[0].reason, "resignation");
  assert.equal(result.events[0].winner, "white");
});

test("current player timeout is an authoritative match-ending action", () => {
  const state = createGameState();

  assert.equal(
    dispatchAction(state, "white", { type: "timeout" }, { authoritative: true }).accepted,
    false,
  );
  assert.equal(dispatchAction(state, "black", { type: "timeout" }).accepted, false);
  assert.equal(getLegalActions(state, "black").some(({ type }) => type === "timeout"), false);
  const result = dispatchAction(state, "black", { type: "timeout" }, { authoritative: true });

  assert.equal(result.accepted, true);
  assert.equal(state.winner, "white");
  assert.equal(state.resultReason, "Time limit exceeded (30s).");
  assert.deepEqual(result.events, [{
    type: "match_ended",
    winner: "white",
    reason: "timeout",
    defeatedPlayer: "black",
  }]);
});
