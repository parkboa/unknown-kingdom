import { writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  applyAction,
  canDeploy,
  createGameState,
  kingLibertyCount,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";
import { AI_RANK_SETTINGS, findAiDeployMove } from "../js/ai.js";
import { neighbors } from "../js/board.js";

const outputPath = resolve("experiments/grandmaster-tactical-validation.json");

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

function actionOf(move) {
  return { type: "deploy", unitType: move.type, row: move.row, col: move.col };
}

function countPieces(state, owner) {
  return state.board.flat().filter((candidate) => candidate?.owner === owner).length;
}

function chooseMove(actualState, rootFilter = () => true) {
  const publicState = stateForPlayer(actualState, "white");
  return findAiDeployMove(publicState, {
    aiPlayer: "white",
    humanPlayer: "black",
    canDeploy: (player, type, row, col) => rootFilter(player, type, row, col)
      && canDeploy(actualState, player, type, row, col),
    countPieces: (owner) => countPieces(actualState, owner),
    neighbors,
  });
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function mineState(hiddenType = "soldier") {
  const state = createGameState("pve", { aiRank: "grandmaster" });
  state.turn = "white";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 6, white: 6 };
  state.stock.black = { soldier: 70, king: 0, general: 1, diplomat: 1, wizard: 1 };
  if (hiddenType !== "soldier") state.stock.black[hiddenType] = 0;
  state.stock.white = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.board[0][0] = piece("black", "king", "black-king");
  state.board[4][4] = piece("white", "king", "white-king");
  state.board[4][5] = piece("black", hiddenType, "hidden-mine", false);
  state.board[4][7] = piece("black", "soldier", "black-connection", false);
  state.lastMove = { player: "black", unitType: hiddenType, row: 4, col: 5 };
  state.aiSettings = {
    ...AI_RANK_SETTINGS.grandmaster,
    searchDepth: 1,
    localSearchDepth: 1,
    rootCandidateLimit: 2,
    deepRiskCandidateLimit: 0,
  };
  return state;
}

const scenarioResults = [];

function runScenario(name, run) {
  const startedAt = performance.now();
  try {
    const details = run();
    scenarioResults.push({ name, passed: true, durationMs: performance.now() - startedAt, ...details });
  } catch (error) {
    scenarioResults.push({
      name,
      passed: false,
      durationMs: performance.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const safeMineMoves = [];
runScenario("king-adjacent hidden identities are all treated as 100% mine risk", () => {
  for (const hiddenType of ["general", "wizard", "diplomat"]) {
    const state = mineState(hiddenType);
    const move = chooseMove(
      state,
      (_player, type, row, col) => type === "soldier"
        && ((row === 4 && col === 6) || (row === 5 && col === 4)),
    );
    requireCondition(move, `${hiddenType}: no move selected`);
    requireCondition(move.specialRiskProbability === 1, `${hiddenType}: mine probability was not 1.0`);
    requireCondition(move.specialHypothesisCount === 3, `${hiddenType}: expected three public hypotheses`);
    requireCondition(move.kingMineHypothesis === true, `${hiddenType}: hypothesis was not marked as a mine`);
    requireCondition(move.row === 5 && move.col === 4, `${hiddenType}: selected the mine-blocking route`);
    const after = structuredClone(state);
    requireCondition(applyAction(after, "white", actionOf(move)), `${hiddenType}: selected move was illegal`);
    requireCondition(!after.pendingSpecial && !after.winner, `${hiddenType}: safe move detonated the mine`);
    safeMineMoves.push({ hiddenType, action: actionOf(move) });
  }
  requireCondition(new Set(safeMineMoves.map(({ action }) => JSON.stringify(action))).size === 1,
    "hidden identities produced different public decisions");
  return { cases: safeMineMoves };
});

runScenario("mine escape and enemy connection route are preserved", () => {
  const state = mineState("general");
  const move = chooseMove(
    state,
    (_player, type, row, col) => type === "soldier"
      && ((row === 4 && col === 6) || (row === 5 && col === 4)),
  );
  requireCondition(move.kingMineDefusal?.mineCount === 1, "adjacent mine was not found");
  requireCondition(move.kingMineDefusal.blocksLiberty === false, "selected move filled a mine liberty");
  requireCondition(move.kingMineDefusal.blocksEnemyConnection === false,
    "selected move blocked the mine's route to another enemy stone");
  return { selectedAction: actionOf(move), mineDefusal: move.kingMineDefusal };
});

runScenario("King group advances toward its own fortress wall", () => {
  const state = mineState("wizard");
  const move = chooseMove(
    state,
    (_player, type, row, col) => type === "soldier"
      && ((row === 4 && col === 6) || (row === 5 && col === 4)),
  );
  requireCondition(move.kingWallConnection?.afterDistance < move.kingWallConnection?.beforeDistance,
    "selected move did not shorten the King-to-wall route");
  return { selectedAction: actionOf(move), kingWallConnection: move.kingWallConnection };
});

runScenario("spent specials disable mine belief and restore ordinary capture", () => {
  const state = createGameState("pve", { aiRank: "grandmaster" });
  state.turn = "white";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 41, white: 41 };
  state.stats.specialsUsed.black = 3;
  state.stock.black = { soldier: 50, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.stock.white = { soldier: 50, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.board[0][0] = piece("black", "king", "black-king");
  state.board[4][4] = piece("white", "king", "white-king");
  state.board[4][5] = piece("black", "soldier", "ordinary-target", false);
  state.board[3][5] = piece("white", "soldier", "north");
  state.board[5][5] = piece("white", "soldier", "south");
  const move = chooseMove(
    state,
    (_player, type, row, col) => type === "soldier"
      && ((row === 4 && col === 6) || (row === 8 && col === 8)),
  );
  requireCondition(move.row === 4 && move.col === 6, "ordinary last-liberty capture was not restored");
  requireCondition(move.kingMineDefusal?.mineCount === 0, "spent special still created a mine");
  const after = structuredClone(state);
  requireCondition(applyAction(after, "white", actionOf(move)), "ordinary capture move was illegal");
  requireCondition(after.board[4][5]?.owner === "white", "ordinary target was not captured");
  requireCondition(!after.pendingSpecial, "ordinary target incorrectly queued a special");
  return { selectedAction: actionOf(move), capturedOwner: after.board[4][5]?.owner };
});

runScenario("King emergency rescue overrides unrelated play without detonating adjacent mines", () => {
  const state = createGameState("pve", { aiRank: "grandmaster" });
  state.turn = "white";
  state.firstDeployDone = { black: true, white: true };
  state.deploymentCount = { black: 6, white: 6 };
  state.stock.black = { soldier: 70, king: 0, general: 1, diplomat: 1, wizard: 1 };
  state.stock.white = { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 };
  state.board[8][8] = piece("black", "king", "black-king");
  state.board[4][4] = piece("white", "king", "white-king");
  for (const [row, col] of [[3, 4], [4, 3], [5, 4]]) {
    state.board[row][col] = piece("black", "soldier", `hidden-${row}-${col}`, false);
  }
  const beforeLiberties = kingLibertyCount(state, "white");
  const move = chooseMove(
    state,
    (_player, type, row, col) => type === "soldier"
      && ((row === 4 && col === 5) || (row === 0 && col === 0)),
  );
  const after = structuredClone(state);
  requireCondition(applyAction(after, "white", actionOf(move)), "King rescue move was illegal");
  requireCondition(move.row === 4 && move.col === 5, "AI chose unrelated play while its King was in atari");
  requireCondition(kingLibertyCount(after, "white") > beforeLiberties, "King rescue did not add liberties");
  requireCondition(!after.pendingSpecial && !after.winner, "King rescue detonated a mine or ended the game");
  return {
    selectedAction: actionOf(move),
    beforeLiberties,
    afterLiberties: kingLibertyCount(after, "white"),
  };
});

const passed = scenarioResults.every((scenario) => scenario.passed);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  aiTier: "grandmaster",
  scenarioCount: scenarioResults.length,
  passedCount: scenarioResults.filter((scenario) => scenario.passed).length,
  passed,
  scenarios: scenarioResults,
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  ...report,
  outputPath: relative(process.cwd(), outputPath),
}, null, 2)}\n`);
if (!passed) process.exitCode = 1;
