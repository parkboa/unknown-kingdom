import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canDeploy,
  countPieces,
  createGameState,
  neighbors,
} from "../src/index.js";
import {
  AI_RANK_SETTINGS,
  findAiDeployMove,
  recentOwnSpecialActivationVacancies,
  specialDeploymentContract,
} from "../../../js/ai.js";

const SPECIAL_TYPES = new Set(["general", "wizard", "diplomat"]);

function piece(id, owner, type) {
  return {
    id,
    owner,
    type,
    originalType: type,
    revealed: true,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

function baseState(tier, ownDeployments = 8) {
  const state = createGameState("pve", { aiRank: tier });
  state.turn = "black";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: ownDeployments, white: ownDeployments };
  state.stock.black.king = 0;
  state.stock.white.king = 0;
  state.board[0][0] = piece("black-king", "black", "king");
  state.board[8][8] = piece("white-king", "white", "king");
  return state;
}

function findMove(state, allowed) {
  return findAiDeployMove(state, {
    aiPlayer: "black",
    humanPlayer: "white",
    canDeploy: (player, type, row, col) =>
      allowed(type, row, col) && canDeploy(state, player, type, row, col),
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
    collectDecisionDiagnostics: true,
  });
}

function recordOwnDeployments(state, types) {
  for (const unitType of types) {
    state.informationHistory.black.push({
      actor: "black",
      ownAction: { type: "deploy", unitType, row: 1, col: 1 },
      events: [],
    });
    state.informationHistory.black.push({
      actor: "white",
      ownAction: null,
      events: [],
    });
  }
}

test("tier settings expose the agreed first-special windows and consecutive limits", () => {
  const expected = {
    novice: [9, null, 1, true],
    intermediate: [7, 8, 1, true],
    advanced: [6, 8, 2, true],
    expert: [6, 8, 3, false],
    grandmaster: [6, 8, 3, false],
  };
  for (const [tier, values] of Object.entries(expected)) {
    const policy = AI_RANK_SETTINGS[tier].specialDeploymentPolicy;
    assert.deepEqual([
      policy.earliestFirstDeployment,
      policy.firstDeploymentDeadline,
      policy.maxConsecutive,
      policy.rescueAtariSpecial,
    ], values, tier);
  }
  assert.equal(AI_RANK_SETTINGS.expert.specialDeploymentPolicy.reactiveReplantAfterActivation, undefined);
  assert.equal(AI_RANK_SETTINGS.grandmaster.specialDeploymentPolicy.reactiveReplantAfterActivation, true);
});

test("novice waits until its ninth deployment while intermediate must open by eight", () => {
  const allowed = (type, row, col) =>
    (SPECIAL_TYPES.has(type) && row === 7 && col === 8)
    || (type === "soldier" && row === 6 && col === 6);

  const earlyNovice = baseState("novice", 5);
  assert.equal(findMove(earlyNovice, allowed).type, "soldier");

  const readyNovice = baseState("novice", 8);
  assert.ok(SPECIAL_TYPES.has(findMove(readyNovice, allowed).type));

  const dueIntermediate = baseState("intermediate", 7);
  const dueMove = findMove(dueIntermediate, allowed);
  assert.ok(SPECIAL_TYPES.has(dueMove.type));
  assert.ok(dueMove.decisionPath.some(
    ({ stage, reason }) => stage === "special_contract" && reason === "first_special_deadline",
  ));
});

test("a verified special King capture overrides the novice deployment window", () => {
  const state = baseState("novice", 5);
  state.board[8][8] = null;
  state.board[4][4] = piece("white-target-king", "white", "king");
  for (const [row, col] of [[3, 5], [5, 5], [4, 6]]) {
    state.board[row][col] = piece(`white-surround-${row}-${col}`, "white", "soldier");
  }
  const move = findMove(state, (type, row, col) =>
    (type === "general" && row === 4 && col === 5)
    || (type === "soldier" && row === 6 && col === 6));

  assert.deepEqual({ type: move.type, row: move.row, col: move.col }, {
    type: "general", row: 4, col: 5,
  });
  assert.ok(move.decisionPath.some(
    ({ stage, reason }) => stage === "terminal_priority" && reason === "verified_immediate_win",
  ));
});

test("intermediate stops after one consecutive special, advanced after two, and expert allows three", () => {
  const allowed = (type, row, col) =>
    (type === "diplomat" && row === 7 && col === 8)
    || (type === "soldier" && row === 6 && col === 6);

  const intermediate = baseState("intermediate", 7);
  intermediate.stock.black.general = 0;
  recordOwnDeployments(intermediate, ["general"]);
  assert.equal(findMove(intermediate, allowed).type, "soldier");

  const advanced = baseState("advanced", 7);
  advanced.stock.black.general = 0;
  advanced.stock.black.wizard = 0;
  recordOwnDeployments(advanced, ["general", "wizard"]);
  assert.equal(findMove(advanced, allowed).type, "soldier");

  const expert = baseState("expert", 7);
  expert.stock.black.general = 0;
  expert.stock.black.wizard = 0;
  recordOwnDeployments(expert, ["general", "wizard"]);
  assert.equal(findMove(expert, allowed).type, "diplomat");

  const contract = specialDeploymentContract(expert, "black", AI_RANK_SETTINGS.expert);
  assert.equal(contract.consecutiveSpecials, 2);
  assert.equal(contract.specialsDeployed, 2);
});

test("lower tiers rescue an active special group while expert and grandmaster leave its liberty open", () => {
  const allowed = (type, row, col) => type === "soldier"
    && ((row === 4 && col === 5) || (row === 6 && col === 6));

  for (const tier of ["novice", "intermediate", "advanced", "expert", "grandmaster"]) {
    const state = baseState(tier, 21);
    state.stock.black = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
    state.board[4][4] = piece(`${tier}-general`, "black", "general");
    for (const [row, col] of [[3, 4], [4, 3], [5, 4]]) {
      state.board[row][col] = piece(`${tier}-block-${row}-${col}`, "white", "soldier");
    }

    const move = findMove(state, allowed);
    const expected = ["novice", "intermediate", "advanced"].includes(tier)
      ? { row: 4, col: 5 }
      : { row: 6, col: 6 };
    assert.deepEqual({ row: move.row, col: move.col }, expected, tier);
  }
});

test("grandmaster preserves a just-cleared activation cell for its final special", () => {
  const state = baseState("grandmaster", 8);
  state.stock.black.general = 0;
  state.stock.black.diplomat = 0;
  state.stock.black.wizard = 1;
  state.board[6][8] = {
    ...piece("spent-general", "black", "soldier"),
    originalType: "general",
    abilityUsed: true,
  };
  recordOwnDeployments(state, ["general", "diplomat"]);
  state.informationHistory.black.push({
    actor: "black",
    ownAction: { type: "activate_special" },
    events: [
      {
        type: "special_activated",
        owner: "black",
        unitType: "general",
        pieceId: "spent-general",
        row: 6,
        col: 8,
      },
      {
        type: "piece_removed",
        captor: "black",
        owner: "white",
        pieceId: "cleared-white",
        unitType: "soldier",
        row: 7,
        col: 8,
        reason: "general_reaction",
      },
    ],
  });

  assert.deepEqual([...recentOwnSpecialActivationVacancies(state, "black")], ["7:8"]);
  const contract = specialDeploymentContract(state, "black", AI_RANK_SETTINGS.grandmaster);
  assert.deepEqual([...contract.reactiveReplantCells], ["7:8"]);

  const move = findMove(state, (type, row, col) =>
    (type === "wizard" && row === 7 && col === 8)
    || (type === "soldier" && row === 6 && col === 6));
  assert.deepEqual({ type: move.type, row: move.row, col: move.col }, {
    type: "wizard", row: 7, col: 8,
  });
  assert.equal(move.midgameTactics.reactiveReplant, true);
  const replant = move.decisionDiagnostics.candidates.find(({ action }) =>
    action.unitType === "wizard" && action.row === 7 && action.col === 8);
  assert.ok(replant.path.some(
    ({ stage, reason }) => stage === "special_contract"
      && reason === "grandmaster_reactive_special_replant",
  ));
  assert.ok(replant.path.some(
    ({ stage, outcome, reason }) => stage === "search_pool"
      && outcome === "kept" && reason === "midgame_special_attack",
  ));
});

test("reactive replant expires after the next own deployment and stays grandmaster-only", () => {
  const state = baseState("grandmaster", 9);
  state.stock.black.general = 0;
  state.stock.black.wizard = 0;
  state.stock.black.diplomat = 1;
  state.informationHistory.black.push({
    actor: "black",
    ownAction: { type: "activate_special" },
    events: [
      { type: "special_activated", owner: "black", unitType: "general", row: 4, col: 4 },
      { type: "piece_removed", captor: "black", reason: "general_reaction", row: 4, col: 5 },
    ],
  });
  assert.deepEqual(
    [...specialDeploymentContract(state, "black", AI_RANK_SETTINGS.expert).reactiveReplantCells],
    [],
  );

  state.informationHistory.black.push({
    actor: "black",
    ownAction: { type: "deploy", unitType: "soldier", row: 6, col: 6 },
    events: [],
  });
  assert.deepEqual([...recentOwnSpecialActivationVacancies(state, "black")], []);
});

test("grandmaster keeps a poor reactive replant searchable without forcing it", () => {
  const state = baseState("grandmaster", 8);
  state.stock.black.general = 0;
  state.stock.black.wizard = 0;
  state.stock.black.diplomat = 1;
  state.board[4][4] = {
    ...piece("spent-general", "black", "soldier"),
    originalType: "general",
    abilityUsed: true,
  };
  state.board[3][5] = piece("nearby-white", "white", "soldier");
  recordOwnDeployments(state, ["general", "wizard"]);
  state.informationHistory.black.push({
    actor: "black",
    ownAction: { type: "activate_special" },
    events: [
      { type: "special_activated", owner: "black", unitType: "general", row: 4, col: 4 },
      { type: "piece_removed", captor: "black", reason: "general_reaction", row: 4, col: 5 },
    ],
  });

  const move = findMove(state, (type, row, col) =>
    (type === "diplomat" && row === 4 && col === 5)
    || (type === "soldier" && row === 6 && col === 6));
  assert.equal(move.type, "soldier");
  const replant = move.decisionDiagnostics.candidates.find(({ action }) =>
    action.unitType === "diplomat" && action.row === 4 && action.col === 5);
  assert.ok(replant.path.some(
    ({ stage, outcome }) => stage === "search_pool" && outcome === "kept",
  ));
});
