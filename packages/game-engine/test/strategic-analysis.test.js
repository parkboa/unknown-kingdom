import assert from "node:assert/strict";
import test from "node:test";
import { canDeploy, createGameState, dispatchAction, kingLibertyCount } from "../src/index.js";
import { AI_RANK_SETTINGS, findAiDeployMove } from "../../../js/ai.js";
import { neighbors } from "../../../js/board.js";
import { evaluateState } from "../../../js/state-evaluation.js";
import {
  KING_ADJACENT_SPECIAL_PROBABILITY,
  KING_ASSAULT_CUTOFF,
  KING_TACTIC_PRIORITY,
  RECENT_SPECIAL_PROBABILITY,
  SPECIAL_ASSAULT_TARGET_LIMIT,
  buildMidgameTacticalPolicy,
  classifyLibertyDirection,
  classifyMidgameCandidate,
  gamePhase,
  kingAdjacentMinePositions,
  kingMineDefusalValue,
  kingSafetyProfile,
  kingWallConnectionValue,
  observedRemainingSpecialTypes,
  phaseStrategicMultiplier,
  recentOpponentDeployments,
  wallTacticalValue,
} from "../../../js/strategic-analysis.js";

function piece(owner, type, id, revealed = type === "king") {
  return {
    id,
    owner,
    type,
    originalType: type,
    revealed,
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

function countPieces(state, owner) {
  return state.board.flat().filter((candidate) => candidate?.owner === owner).length;
}

function findMove(state, aiPlayer, humanPlayer, rootCanDeploy) {
  return findAiDeployMove(state, {
    aiPlayer,
    humanPlayer,
    canDeploy: rootCanDeploy,
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });
}

test("phase-aware high-tier contracts keep the agreed 20/40, 80%, 90%, and local-depth rules", () => {
  const state = createGameState();
  for (const [deployments, phase, multiplier] of [
    [20, "opening", 0.5],
    [21, "middle", 1],
    [40, "middle", 1],
    [41, "endgame", 1.4],
  ]) {
    state.deploymentCount = { red: deployments, blue: deployments };
    assert.equal(gamePhase(state), phase);
    assert.equal(phaseStrategicMultiplier(state), multiplier);
  }
  state.deploymentCount = { red: 21, blue: 20 };
  assert.equal(gamePhase(state), "opening", "an unmatched extra move does not complete a round");

  for (const tier of ["expert", "grandmaster"]) {
    assert.equal(AI_RANK_SETTINGS[tier].recentSpecialProbability, RECENT_SPECIAL_PROBABILITY);
    assert.equal(AI_RANK_SETTINGS[tier].recentSpecialProbability, 0.8);
    assert.equal(AI_RANK_SETTINGS[tier].kingTacticalPriority, KING_TACTIC_PRIORITY);
    assert.equal(AI_RANK_SETTINGS[tier].kingTacticalPriority, 0.9);
  }
  assert.equal(AI_RANK_SETTINGS.expert.searchDepth, 3);
  assert.equal(AI_RANK_SETTINGS.grandmaster.localSearchDepth, 4);
  assert.equal(AI_RANK_SETTINGS.grandmaster.kingAdjacentSpecialProbability, 1);
  assert.equal(AI_RANK_SETTINGS.grandmaster.midgameCandidatePolicy, true);
  assert.equal(AI_RANK_SETTINGS.grandmaster.midgameTacticalCandidateLimit, 8);
  assert.equal(AI_RANK_SETTINGS.grandmaster.midgameSpecialAttackLimit, 4);
  assert.equal(AI_RANK_SETTINGS.grandmaster.kingAssaultSafetyCandidateLimit, 2);

  const assaultState = createGameState();
  assaultState.deploymentCount = { red: SPECIAL_ASSAULT_TARGET_LIMIT, blue: SPECIAL_ASSAULT_TARGET_LIMIT };
  let tacticalPolicy = buildMidgameTacticalPolicy(assaultState, "red", "blue");
  assert.equal(tacticalPolicy.kingAssault, true);
  assert.equal(tacticalPolicy.territoryFocus, false);
  assaultState.deploymentCount.red = SPECIAL_ASSAULT_TARGET_LIMIT + 1;
  assaultState.stock.red = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
  tacticalPolicy = buildMidgameTacticalPolicy(assaultState, "red", "blue");
  assert.equal(tacticalPolicy.kingAssault, false);
  assert.equal(tacticalPolicy.territoryFocus, true);
  assaultState.deploymentCount.red = KING_ASSAULT_CUTOFF;
  assaultState.stock.red.general = 1;
  tacticalPolicy = buildMidgameTacticalPolicy(assaultState, "red", "blue");
  assert.equal(tacticalPolicy.kingAssault, true);
  assaultState.deploymentCount.red = KING_ASSAULT_CUTOFF + 1;
  tacticalPolicy = buildMidgameTacticalPolicy(assaultState, "red", "blue");
  assert.equal(tacticalPolicy.kingAssault, false);
  assert.equal(tacticalPolicy.territoryFocus, true);

  const opening = createGameState();
  opening.board[4][4] = piece("red", "soldier", "red-area");
  opening.deploymentCount = { red: 20, blue: 20 };
  const settings = {
    strategicContext: true,
    score: {
      capture: 1, kingSafety: 0, kingPressure: 0, groupTactics: 0,
      influence: 0, center: 0, home: 0,
    },
  };
  const middle = structuredClone(opening);
  middle.deploymentCount = { red: 21, blue: 21 };
  const endgame = structuredClone(opening);
  endgame.deploymentCount = { red: 41, blue: 41 };
  assert.ok(evaluateState(opening, "red", settings) < evaluateState(middle, "red", settings));
  assert.ok(evaluateState(middle, "red", settings) < evaluateState(endgame, "red", settings));
});

test("remembered observations identify recent moves and remove exhausted special hypotheses", () => {
  const state = createGameState("pve");
  assert.equal(dispatchAction(state, "red", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  }).accepted, true);
  assert.equal(dispatchAction(state, "blue", {
    type: "deploy", unitType: "king", row: 8, col: 4,
  }).accepted, true);
  state.deploymentCount.blue = 5;
  assert.equal(dispatchAction(state, "red", {
    type: "deploy", unitType: "soldier", row: 7, col: 4,
  }).accepted, true);
  assert.deepEqual(recentOpponentDeployments(state, "blue", 2), [
    { row: 7, col: 4, player: "red" },
    { row: 0, col: 4, player: "red" },
  ]);
  assert.deepEqual(observedRemainingSpecialTypes(state, "blue", "red"), [
    "general", "wizard", "diplomat",
  ]);
  assert.deepEqual(kingAdjacentMinePositions(state, "blue", "red"), [{ row: 7, col: 4 }]);

  state.informationHistory.blue.push({
    actor: "red",
    ownAction: null,
    events: ["general", "wizard", "diplomat"].map((unitType) => ({
      type: "special_activated", owner: "red", unitType,
    })),
  });
  assert.deepEqual(observedRemainingSpecialTypes(state, "blue", "red"), []);
  assert.deepEqual(kingAdjacentMinePositions(state, "blue", "red"), []);
  const legacySummary = structuredClone(state);
  legacySummary.informationHistory.blue = [];
  legacySummary.stats.specialsUsed.red = 3;
  assert.deepEqual(observedRemainingSpecialTypes(legacySummary, "blue", "red"), []);
});

test("directional tactics block an enemy wall while mine defense preserves escape and builds our King wall", () => {
  const wallState = createGameState();
  wallState.board[4][4] = piece("red", "soldier", "target");
  wallState.board[4][3] = piece("blue", "soldier", "west-block");
  wallState.board[4][5] = piece("blue", "soldier", "east-block");
  assert.equal(classifyLibertyDirection(wallState, 3, 4, "red", "blue"), "owner_wall");
  assert.equal(classifyLibertyDirection(wallState, 5, 4, "red", "blue"), "opposing_wall");
  assert.deepEqual(wallTacticalValue(wallState, 3, 4, "blue", "red"), {
    value: 218,
    blocksEnemyWall: true,
    funnelsToOwnWall: true,
    blocksOwnWallRoute: false,
  });
  assert.ok(wallTacticalValue(wallState, 5, 4, "blue", "red").value < 0);

  const mineState = createGameState("pve");
  mineState.firstDeployDone = { red: true, blue: true };
  mineState.board[4][4] = piece("blue", "king", "blue-king");
  mineState.board[4][5] = piece("red", "soldier", "hidden-mine", false);
  mineState.board[4][7] = piece("red", "soldier", "red-connection", false);
  const blocked = kingMineDefusalValue(mineState, 4, 6, "blue", "red");
  assert.equal(blocked.blocksLiberty, true);
  assert.equal(blocked.blocksEnemyConnection, true);
  assert.ok(blocked.value < 0);
  assert.equal(kingMineDefusalValue(mineState, 5, 4, "blue", "red").value, 0);
  assert.ok(kingWallConnectionValue(mineState, 5, 4, "blue").value > 0);
  assert.equal(kingWallConnectionValue(mineState, 3, 4, "blue").value, 0);

  const policyState = createGameState();
  policyState.deploymentCount = { red: 21, blue: 21 };
  policyState.board[4][4] = piece("red", "soldier", "atari-soldier");
  for (const [row, col] of [[3, 4], [4, 3], [5, 4]]) {
    policyState.board[row][col] = piece("blue", "soldier", `surround-${row}-${col}`);
  }
  let policy = buildMidgameTacticalPolicy(policyState, "red", "blue");
  assert.equal(policy.forcedSoldierLiberties.has("4:5"), true);
  assert.equal(classifyMidgameCandidate(policy, { type: "soldier", row: 4, col: 5 }).forcedSoldierLiberty, true);

  policyState.board[4][4] = piece("red", "general", "atari-general");
  policy = buildMidgameTacticalPolicy(policyState, "red", "blue");
  assert.equal(policy.forcedSoldierLiberties.size, 0, "a group containing an attack special is not rescued");

  const routeState = createGameState();
  routeState.deploymentCount = { red: 15, blue: 15 };
  routeState.board[0][3] = piece("red", "soldier", "wall-group");
  routeState.board[3][3] = piece("red", "soldier", "detached-group");
  routeState.board[3][5] = piece("blue", "king", "enemy-king");
  const routePolicy = buildMidgameTacticalPolicy(routeState, "red", "blue");
  assert.equal(classifyMidgameCandidate(routePolicy, { type: "soldier", row: 1, col: 3 }).wallBridge, true);
  assert.equal(classifyMidgameCandidate(routePolicy, { type: "soldier", row: 3, col: 4 }).homeSeal, true);
  assert.equal(classifyMidgameCandidate(routePolicy, { type: "general", row: 2, col: 5 }).specialAttack, true);
});

test("production high-tier choices apply wall funneling and 100% King-mine defusal", () => {
  const wallState = createGameState("pve");
  wallState.turn = "blue";
  wallState.firstDeployDone = { red: true, blue: true };
  wallState.deploymentCount = { red: 21, blue: 21 };
  wallState.board[0][0] = piece("red", "king", "red-king");
  wallState.board[8][8] = piece("blue", "king", "blue-king");
  wallState.board[4][4] = piece("red", "soldier", "target");
  wallState.board[4][3] = piece("blue", "soldier", "west-block");
  wallState.board[4][5] = piece("blue", "soldier", "east-block");
  wallState.stock.red = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
  wallState.stock.blue = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
  wallState.aiSettings = {
    ...AI_RANK_SETTINGS.expert,
    searchDepth: 1,
    riskCandidateLimit: 0,
    deepRiskCandidateLimit: 0,
    recentIntentWeight: 0,
    score: {
      center: 0, allies: 0, enemies: 0, home: 0, capture: 0, threat: 0,
      kingPressure: 0, kingSafety: 0, defense: 0, influence: 0, groupTactics: 0,
    },
  };
  const wallMove = findMove(
    wallState,
    "blue",
    "red",
    (player, type, row, col) => canDeploy(wallState, player, type, row, col),
  );
  assert.deepEqual({ row: wallMove.row, col: wallMove.col }, { row: 3, col: 4 });
  assert.equal(wallMove.wallTactics.funnelsToOwnWall, true);

  const mineState = createGameState("pve", { aiRank: "grandmaster" });
  mineState.turn = "blue";
  mineState.firstDeployDone = { red: true, blue: true };
  mineState.deploymentCount = { red: 6, blue: 6 };
  mineState.stock.red = { soldier: 70, king: 0, general: 1, diplomat: 1, wizard: 1 };
  mineState.stock.blue = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
  mineState.board[0][0] = piece("red", "king", "red-king");
  mineState.board[4][4] = piece("blue", "king", "blue-king");
  mineState.board[4][5] = piece("red", "soldier", "hidden-mine", false);
  mineState.board[4][7] = piece("red", "soldier", "red-connection", false);
  mineState.lastMove = { player: "red", unitType: "soldier", row: 4, col: 5 };
  mineState.aiSettings = {
    ...AI_RANK_SETTINGS.grandmaster,
    searchDepth: 1,
    localSearchDepth: 1,
    rootCandidateLimit: 2,
    deepRiskCandidateLimit: 0,
  };
  const mineMove = findMove(
    mineState,
    "blue",
    "red",
    (_player, type, row, col) => type === "soldier"
      && ((row === 4 && col === 6) || (row === 5 && col === 4)),
  );
  assert.deepEqual({ row: mineMove.row, col: mineMove.col }, { row: 5, col: 4 });
  assert.equal(mineMove.specialRiskProbability, KING_ADJACENT_SPECIAL_PROBABILITY);
  assert.equal(mineMove.specialHypothesisCount, 3);
  assert.equal(mineMove.kingMineHypothesis, true);
  assert.equal(mineMove.kingMineDefusal.blocksEnemyConnection, false);
  assert.ok(mineMove.kingWallConnection.value > 0);

  const fatalState = createGameState("pve", { aiRank: "grandmaster" });
  fatalState.turn = "blue";
  fatalState.firstDeployDone = { red: true, blue: true };
  fatalState.deploymentCount = { red: 6, blue: 6 };
  fatalState.stock.red = { soldier: 70, king: 0, general: 1, diplomat: 0, wizard: 1 };
  fatalState.stock.blue = { soldier: 70, king: 0, general: 1, diplomat: 1, wizard: 1 };
  fatalState.board[4][4] = piece("red", "king", "red-king");
  fatalState.board[4][5] = piece("red", "diplomat", "fatal-mine", false);
  fatalState.board[5][5] = piece("blue", "king", "blue-king");
  for (const [row, col] of [[3, 4], [5, 4], [4, 3], [3, 5]]) {
    fatalState.board[row][col] = piece("blue", "soldier", `blue-${row}-${col}`);
  }
  fatalState.lastMove = { player: "red", unitType: "soldier", row: 4, col: 5 };
  const fatalMove = findMove(
    fatalState,
    "blue",
    "red",
    (_player, type, row, col) => type === "soldier" && row === 4 && col === 6,
  );
  assert.equal(fatalMove.specialRiskProbability, 1);
  assert.equal(fatalMove.searchDepthUsed, 4);
  assert.equal(fatalMove.deepScore, -100000, "detonating a possible King-adjacent special remains a veto");

  const forcedState = createGameState("pve", { aiRank: "grandmaster" });
  forcedState.turn = "red";
  forcedState.firstDeployDone = { red: true, blue: true };
  forcedState.deploymentCount = { red: 21, blue: 21 };
  forcedState.stock.red = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
  forcedState.stock.blue = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
  forcedState.board[0][0] = piece("red", "king", "forced-red-king");
  forcedState.board[8][8] = piece("blue", "king", "forced-blue-king");
  forcedState.board[4][4] = piece("red", "soldier", "forced-soldier");
  for (const [row, col] of [[3, 4], [4, 3], [5, 4]]) {
    forcedState.board[row][col] = piece("blue", "soldier", `forced-block-${row}-${col}`);
  }
  forcedState.aiSettings = { ...AI_RANK_SETTINGS.grandmaster, searchDepth: 1, localSearchDepth: 1 };
  const forcedMove = findMove(
    forcedState,
    "red",
    "blue",
    (_player, type, row, col) => type === "soldier"
      && ((row === 4 && col === 5) || (row === 6 && col === 6)),
  );
  assert.deepEqual({ type: forcedMove.type, row: forcedMove.row, col: forcedMove.col }, {
    type: "soldier", row: 4, col: 5,
  });
  assert.equal(forcedMove.midgameTactics.forcedSoldierLiberty, true);

  const attackState = createGameState("pve", { aiRank: "grandmaster" });
  attackState.turn = "red";
  attackState.firstDeployDone = { red: true, blue: true };
  attackState.deploymentCount = { red: 15, blue: 15 };
  attackState.stock.red = { soldier: 70, king: 0, general: 1, diplomat: 1, wizard: 1 };
  attackState.stock.blue = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
  attackState.board[0][0] = piece("red", "king", "attack-red-king");
  attackState.board[8][4] = piece("blue", "king", "attack-blue-king");
  attackState.aiSettings = { ...AI_RANK_SETTINGS.grandmaster, searchDepth: 1, localSearchDepth: 1 };
  const attackMove = findMove(
    attackState,
    "red",
    "blue",
    (_player, type, row, col) => (row === 7 && col === 4 && ["general", "wizard", "diplomat"].includes(type))
      || (type === "soldier" && row === 4 && col === 4),
  );
  assert.equal(["general", "wizard"].includes(attackMove.type), true);
  assert.deepEqual({ row: attackMove.row, col: attackMove.col }, { row: 7, col: 4 });
  assert.equal(attackMove.midgameTactics.specialAttack, true);
});

function kingSafetyState(build) {
  const state = createGameState();
  state.firstDeployDone = { red: true, blue: true };
  const place = (row, col, owner, type) => {
    state.board[row][col] = {
      id: `${owner}-${row}-${col}`,
      owner,
      type,
      originalType: type,
      revealed: type === "king",
      abilityUsed: false,
      kingEscapeUsed: false,
    };
  };
  build(place);
  return state;
}

test("soldier capture distance separates wall anchors from board liberties", () => {
  // Own wall: the top edge belongs to red, so red's King keeps a liberty no soldier can fill.
  const ownWall = kingSafetyState((place) => {
    place(0, 4, "red", "king");
    place(1, 4, "blue", "soldier");
    place(0, 3, "blue", "soldier");
    place(0, 5, "blue", "soldier");
  });
  const ownWallProfile = kingSafetyProfile(ownWall, "red");
  assert.equal(ownWallProfile.wallAnchors, 1);
  assert.equal(ownWallProfile.boardLiberties, 0);
  assert.equal(ownWallProfile.soldierCaptureDistance, Infinity);

  // Neutral wall: the side edges are neutral only on row 4, and groupHasLiberty counts a
  // neutral edge exactly like an own wall, so the profile has to as well.
  const neutralWall = kingSafetyState((place) => {
    place(4, 0, "red", "king");
    place(3, 0, "blue", "soldier");
    place(5, 0, "blue", "soldier");
    place(4, 1, "blue", "soldier");
  });
  assert.equal(kingSafetyProfile(neutralWall, "red").wallAnchors, 1);
  assert.equal(kingSafetyProfile(neutralWall, "red").soldierCaptureDistance, Infinity);

  // Open centre: three empty neighbours are three soldier moves from capture.
  const centre = kingSafetyState((place) => {
    place(4, 4, "red", "king");
    place(3, 4, "blue", "soldier");
  });
  const centreProfile = kingSafetyProfile(centre, "red");
  assert.equal(centreProfile.wallAnchors, 0);
  assert.equal(centreProfile.boardLiberties, 3);
  assert.equal(centreProfile.soldierCaptureDistance, 3);

  // The opponent's wall grants nothing: this King is already without a liberty.
  const enemyWall = kingSafetyState((place) => {
    place(8, 4, "red", "king");
    place(7, 4, "blue", "soldier");
    place(8, 3, "blue", "soldier");
    place(8, 5, "blue", "soldier");
  });
  assert.equal(kingSafetyProfile(enemyWall, "red").wallAnchors, 0);
  assert.equal(kingSafetyProfile(enemyWall, "red").soldierCaptureDistance, 0);
});

test("kingLibertyCount cannot express the ordering that soldier capture distance does", () => {
  // The regression anchor for Stage 1a: these two positions are the pair the old measure
  // ranked backwards, so any future change must keep them in this order.
  const anchored = kingSafetyState((place) => {
    place(0, 4, "red", "king");
    place(1, 4, "blue", "soldier");
    place(0, 3, "blue", "soldier");
    place(0, 5, "blue", "soldier");
  });
  const exposed = kingSafetyState((place) => {
    place(4, 4, "red", "king");
    place(3, 4, "blue", "soldier");
  });

  // One wall liberty against three board liberties — indistinguishable to a plain count, and
  // ordered the wrong way round by it.
  assert.ok(kingLibertyCount(anchored, "red") < kingLibertyCount(exposed, "red"));
  // Uncapturable by soldiers against three moves from death.
  assert.ok(
    kingSafetyProfile(anchored, "red").soldierCaptureDistance
      > kingSafetyProfile(exposed, "red").soldierCaptureDistance,
  );
});

test("a wall anchor only stops soldiers, and the profile says so once specials are counted", () => {
  // Red's King is sealed against its own wall. No soldier can ever take it, which is exactly
  // what Stage 1a measures — and on its own that reads as absolute safety.
  const state = kingSafetyState((place) => {
    place(0, 4, "red", "king");
    place(0, 3, "red", "soldier");
    place(0, 2, "blue", "soldier");
    place(0, 5, "blue", "soldier");
    place(1, 4, "blue", "soldier");
    place(1, 3, "blue", "soldier");
  });

  const soldierOnly = kingSafetyProfile(state, "red");
  assert.equal(soldierOnly.wallAnchors, 2);
  assert.equal(soldierOnly.soldierCaptureDistance, Infinity);
  // Without the option nothing about Stage 1a may move.
  assert.equal(soldierOnly.effectiveCaptureDistance, Infinity);

  // A reaction captures an adjacent King outright, so an unidentified stone beside it is a live
  // threat no wall can answer.
  const withSpecials = kingSafetyProfile(state, "red", { specialsBreakAnchors: true });
  assert.equal(withSpecials.specialDistance, 1);
  assert.equal(withSpecials.effectiveCaptureDistance, 1);
  assert.equal(withSpecials.enemySpecials, 3);
  assert.ok(withSpecials.specialRisk > 0);

  // Spent specials cannot threaten anything, and the anchor becomes permanent again.
  const spent = structuredClone(state);
  spent.stats.specialsUsed.blue = 3;
  const afterSpending = kingSafetyProfile(spent, "red", { specialsBreakAnchors: true });
  assert.equal(afterSpending.effectiveCaptureDistance, Infinity);
  assert.equal(afterSpending.specialRisk, 0);
});

test("the danger of an unidentified neighbour falls as the hidden pool grows", () => {
  const build = (extraHidden) => kingSafetyState((place) => {
    place(0, 4, "red", "king");
    place(0, 3, "red", "soldier");
    place(0, 2, "blue", "soldier");
    place(0, 5, "blue", "soldier");
    place(1, 4, "blue", "soldier");
    place(1, 3, "blue", "soldier");
    let placed = 0;
    for (let row = 5; row < 9 && placed < extraHidden; row += 1) {
      for (let col = 0; col < 9 && placed < extraHidden; col += 1) {
        place(row, col, "blue", "soldier");
        placed += 1;
      }
    }
  });

  const tight = kingSafetyProfile(build(0), "red", { specialsBreakAnchors: true });
  const loose = kingSafetyProfile(build(40), "red", { specialsBreakAnchors: true });

  // Same four unidentified neighbours either way; what changes is how many stones the three
  // specials could be hiding among. Reporting distance 1 without this weighting would call
  // every King with an unknown neighbour one move from death.
  assert.equal(tight.adjacentUnknown, loose.adjacentUnknown);
  assert.equal(tight.specialDistance, loose.specialDistance);
  assert.ok(loose.hiddenPool > tight.hiddenPool);
  assert.ok(loose.specialRisk < tight.specialRisk);
});

test("a Diplomat conversion that closes the net survives the pool and the belief blend", () => {
  // Blue's King sits on the edge behind one guard, and the guard is what keeps the group
  // breathing. A stone on 2:4 takes a liberty and no more; a General there strikes the guard off
  // the board and hands the King the square it stood on. Only the Diplomat's conversion turns the
  // guard red, which leaves the King alone with three red neighbours and no liberty at all.
  const state = createGameState("pve");
  state.turn = "red";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 10, blue: 10 };
  state.board[8][0] = piece("red", "king", "red-king");
  state.board[0][4] = piece("blue", "king", "blue-king");
  state.board[0][3] = piece("red", "soldier", "west-clamp");
  state.board[0][5] = piece("red", "soldier", "east-clamp");
  state.board[1][4] = piece("blue", "soldier", "king-guard", false);
  state.board[2][2] = piece("blue", "soldier", "decoy-west", false);
  state.board[3][3] = piece("blue", "soldier", "decoy-south", false);
  state.stock.red = { soldier: 60, king: 0, general: 1, diplomat: 1, wizard: 1 };
  state.stock.blue = { soldier: 60, king: 0, general: 1, diplomat: 1, wizard: 1 };
  state.aiSettings = { ...AI_RANK_SETTINGS.grandmaster, searchDepth: 1, localSearchDepth: 1 };

  assert.equal(kingLibertyCount(state, "blue"), 3, "the King is not in atari, so nothing wins on the spot");

  const policy = buildMidgameTacticalPolicy(state, "red", "blue", { conversionSight: true });
  assert.equal(policy.conversionCells.has("2:4"), true);

  const conversion = classifyMidgameCandidate(policy, { type: "diplomat", row: 2, col: 4 });
  const clearing = classifyMidgameCandidate(policy, { type: "general", row: 2, col: 4 });
  assert.equal(conversion.conversionCapture, true);
  assert.equal(clearing.conversionCapture, false);
  // The order is what deleted the Diplomat before anything scored it: the assault pool keeps only
  // the best rank, so a General on the same square used to end the search for it.
  assert.ok(conversion.specialOrder > clearing.specialOrder);

  const move = findMove(
    state,
    "red",
    "blue",
    (_player, type, row, col) => (row === 2 && col === 4)
      || (row === 2 && col === 3 && type !== "king")
      || (type === "soldier" && row === 5 && col === 5),
  );
  assert.deepEqual({ type: move.type, row: move.row, col: move.col }, {
    type: "diplomat", row: 2, col: 4,
  });
  // Reaching the answer through `midgameTactics` is the part worth asserting: it is only attached
  // by the policy, so its presence says the candidate survived the pool rather than arriving by
  // some other route.
  assert.equal(move.midgameTactics.conversionCapture, true);
});
