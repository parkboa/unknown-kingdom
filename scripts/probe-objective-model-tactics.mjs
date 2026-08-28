import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  applyAction,
  canDeploy,
  countPieces,
  createGameState,
  getLegalActions,
} from "../packages/game-engine/src/index.js";
import { AI_RANK_SETTINGS, findAiDeployMove } from "../js/ai.js";
import { neighbors } from "../js/board.js";
import { kingSafetyProfile } from "../js/strategic-analysis.js";

// Overridable so a read-only sweep can park its report outside the repository. Without it every
// run rewrites the tracked report, and an analysis pass leaves the working tree dirty for
// whichever agent holds the editing turn.
const outputArgIndex = process.argv.indexOf("--output");
const outputPath = resolve(outputArgIndex >= 0 && outputArgIndex + 1 < process.argv.length
  ? process.argv[outputArgIndex + 1]
  : "experiments/objective-model-tactical-validation.json");
const soldiersOnlyExam = JSON.parse(readFileSync(
  resolve("experiments/ai-tactics-soldiers-only.json"),
  "utf8",
));

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

function actionKey(action) {
  if (!action) return null;
  return `${action.unitType ?? action.type}:${action.row}:${action.col}`;
}

function chooseMove(state, settings, allowed) {
  const view = structuredClone(state);
  view.aiSettings = { ...AI_RANK_SETTINGS.grandmaster, ...settings };
  const player = view.turn;
  const enemy = player === "red" ? "blue" : "red";
  return findAiDeployMove(view, {
    aiPlayer: player,
    humanPlayer: enemy,
    canDeploy: (owner, type, row, col) => allowed.has(`${type}:${row}:${col}`)
      && canDeploy(view, owner, type, row, col),
    countPieces: (owner) => countPieces(view, owner),
    neighbors,
  });
}

function settleSpecial(state) {
  let guard = 0;
  while (state.pendingSpecial && !state.winner && guard < 4) {
    if (!applyAction(state, state.pendingSpecial.owner, { type: "activate_special" })) break;
    guard += 1;
  }
}

function applyDeployment(state, action) {
  const next = structuredClone(state);
  const accepted = applyAction(next, state.turn, action);
  if (!accepted) throw new Error(`engine rejected ${actionKey(action)}`);
  settleSpecial(next);
  return next;
}

function solveToEnd(state, perspective) {
  if (state.winner) return state.winner === "draw" ? 0 : state.winner === perspective ? 1 : -1;
  const actions = getLegalActions(state, state.turn).filter(({ type }) => type === "deploy");
  if (!actions.length) throw new Error("unfinished fixture has no engine deployment");
  const values = actions.map((action) => solveToEnd(applyDeployment(state, action), perspective));
  return state.turn === perspective ? Math.max(...values) : Math.min(...values);
}

function terminalTerritoryFixture() {
  const source = soldiersOnlyExam.answers.find(({ id }) => id === "p100");
  if (!source) throw new Error("saved p100 fixture is missing");
  const state = createGameState("pve", { aiRank: "grandmaster" });
  let id = 20;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const compact = source.board[row][col];
      if (!compact) continue;
      const owner = compact[0] === "R" ? "red" : "blue";
      const type = compact.slice(1);
      state.board[row][col] = piece(owner, type, `piece-${id++}`, true);
    }
  }
  state.turn = source.turn;
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 50, blue: 50 };
  state.stock = {
    red: { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 },
    blue: { soldier: 77, king: 0, general: 0, diplomat: 0, wizard: 0 },
  };
  state.stats.specialsUsed = { red: 3, blue: 3 };

  // Three empty points leave an exact three-ply ending. These six ownership changes narrow the
  // count without changing the rule: exhaustive engine play proves that only 4,7 wins for Blue.
  state.board[4][7] = null;
  for (const [row, col] of [[5, 3], [7, 5], [6, 2], [2, 2], [3, 7], [6, 7]]) {
    state.board[row][col].owner = "red";
    state.board[row][col].id = `piece-${id++}`;
  }
  return state;
}

function evaluateTerritoryFixture() {
  const state = terminalTerritoryFixture();
  const player = state.turn;
  const rootValues = getLegalActions(state, player)
    .filter(({ type }) => type === "deploy")
    .map((action) => ({
      action: actionKey(action),
      value: solveToEnd(applyDeployment(state, action), player),
    }));
  const winning = rootValues.filter(({ value }) => value === 1).map(({ action }) => action);
  const allowed = new Set(rootValues.map(({ action }) => action));
  const isolated = {
    searchDepth: 1,
    localSearchDepth: 1,
    riskCandidateLimit: 0,
    deepRiskCandidateLimit: 0,
  };
  const baseline = actionKey(chooseMove(state, isolated, allowed));
  const model = actionKey(chooseMove(state, { ...isolated, territoryVerdictModel: true }, allowed));
  const productionBaseline = actionKey(chooseMove(state, {}, allowed));
  const productionModel = actionKey(chooseMove(state, { territoryVerdictModel: true }, allowed));
  return {
    name: "1b terminal territory verdict",
    correct: winning,
    rootValues,
    isolated: { baseline, model },
    production: { baseline: productionBaseline, model: productionModel },
    modelFixesIsolatedDecision: !winning.includes(baseline) && winning.includes(model),
    modelImprovesProductionDecision: !winning.includes(productionBaseline) && winning.includes(productionModel),
    modelPassesAnswerKey: winning.length === 1 && winning.includes(model) && winning.includes(productionModel),
  };
}

function anchorMineFixture(hiddenType, specialsSpent = false) {
  const state = createGameState("pve", { aiRank: "grandmaster" });
  state.turn = "red";
  state.firstDeployDone = { red: true, blue: true };
  state.deploymentCount = { red: 20, blue: 20 };
  state.stock = {
    red: { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 },
    blue: { soldier: 70, king: 0, general: 0, diplomat: 0, wizard: 0 },
  };
  state.stats.specialsUsed = { red: 3, blue: specialsSpent ? 3 : 0 };
  state.board[0][4] = piece("red", "king", "piece-20", true);
  state.board[0][3] = piece("red", "soldier", "piece-21", true);
  state.board[1][3] = piece("red", "soldier", "piece-22", true);
  state.board[1][5] = piece("red", "soldier", "piece-23", true);
  state.board[1][4] = piece("blue", hiddenType, "piece-30", specialsSpent);
  return state;
}

function evaluateAnchorFixture(hiddenType) {
  const state = anchorMineFixture(hiddenType);
  const threat = kingSafetyProfile(state, "red", { specialsBreakAnchors: true });
  const risky = { type: "deploy", unitType: "soldier", row: 2, col: 4 };
  const safe = { type: "deploy", unitType: "soldier", row: 8, col: 8 };
  const riskyResult = applyDeployment(state, risky);
  const safeResult = applyDeployment(state, safe);
  const allowed = new Set([actionKey(risky), actionKey(safe)]);
  const isolated = {
    searchDepth: 1,
    localSearchDepth: 1,
    criticalBeliefWorldLimit: 0,
    riskCandidateLimit: 0,
    deepRiskCandidateLimit: 0,
    midgameCandidatePolicy: false,
    kingMineStrategy: false,
    kingDangerModel: true,
  };
  const baseline = actionKey(chooseMove(state, isolated, allowed));
  const model = actionKey(chooseMove(state, { ...isolated, specialAnchorThreat: true }, allowed));
  const productionBaseline = actionKey(chooseMove(state, { kingDangerModel: true }, allowed));
  const productionModel = actionKey(chooseMove(state, {
    kingDangerModel: true,
    specialAnchorThreat: true,
  }, allowed));
  return {
    hiddenType,
    correct: actionKey(safe),
    engine: {
      riskyWinner: riskyResult.winner,
      riskyReason: riskyResult.resultReason,
      safeWinner: safeResult.winner,
    },
    threat: {
      wallAnchors: threat.wallAnchors,
      soldierCaptureDistance: Number.isFinite(threat.soldierCaptureDistance)
        ? threat.soldierCaptureDistance
        : "Infinity",
      specialDistance: threat.specialDistance,
      specialRisk: threat.specialRisk,
    },
    isolated: { baseline, model },
    production: { baseline: productionBaseline, model: productionModel },
    modelFixesIsolatedDecision: baseline !== actionKey(safe) && model === actionKey(safe),
    modelImprovesProductionDecision: productionBaseline !== actionKey(safe) && productionModel === actionKey(safe),
    groundTruthVerified: riskyResult.winner === "blue"
      && !safeResult.winner
      && threat.wallAnchors > 0
      && threat.soldierCaptureDistance === Infinity
      && threat.specialDistance === 1
      && threat.specialRisk > 0,
    modelPassesAnswerKey: model === actionKey(safe),
  };
}

const territory = evaluateTerritoryFixture();
const anchors = ["general", "wizard", "diplomat"].map(evaluateAnchorFixture);
const groundTruthVerified = territory.correct.length === 1
  && territory.rootValues.filter(({ value }) => value === 1).length === 1
  && anchors.every(({ groundTruthVerified: verified }) => verified);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  groundTruthVerified,
  decisions: {
    territoryVerdictModel: territory.modelImprovesProductionDecision ? "promote" : "hold",
    specialAnchorThreat: anchors.every(({ modelPassesAnswerKey }) => modelPassesAnswerKey)
      ? "promote"
      : "redesign",
  },
  territory,
  anchors,
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ...report, outputPath: relative(process.cwd(), outputPath) }, null, 2)}\n`);
if (!groundTruthVerified) process.exitCode = 1;
