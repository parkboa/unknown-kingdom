import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  dispatchAction,
  resampleFromInformationState,
  parseGameJournalJsonl,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";
import {
  findIsMctsAction,
} from "../js/is-mcts.js";
import { seededRandom } from "./lib/ai-match.mjs";

const SPECIAL_TYPES = new Set(["general", "wizard", "diplomat"]);
const SAMPLE_COUNT = 10000;
const SEARCH_TRIALS = 12;
const evaluation = JSON.parse(readFileSync(resolve("experiments/is-mcts-promotion-result.json"), "utf8"));
const candidateSettings = evaluation.config.candidateSettings;
const cases = [
  {
    gameId: "pair-002-candidate-blue",
    journal: "experiments/is-mcts-loss-replays/pair-002-candidate-blue.jsonl",
    actionIndex: 19,
  },
  {
    gameId: "pair-008-candidate-red",
    journal: "experiments/is-mcts-loss-replays/pair-008-candidate-red.jsonl",
    actionIndex: 24,
  },
];

function actionKey(action) {
  if (action.type === "deploy") return `${action.type}:${action.unitType}:${action.row}:${action.col}`;
  return action.type;
}

function stateBeforeAction(journal, actionIndex) {
  const state = structuredClone(journal.initialState);
  for (const entry of journal.actions.slice(0, actionIndex)) {
    const result = dispatchAction(state, entry.player, structuredClone(entry.action), entry.options || {});
    if (result.accepted !== entry.accepted) throw new Error(`Replay diverged before action ${actionIndex}`);
  }
  return state;
}

function hiddenOpponentStones(publicState, player) {
  const enemy = player === "red" ? "blue" : "red";
  return publicState.board.flat().filter((piece) =>
    piece?.owner === enemy && !piece.revealed && piece.type === "soldier").length;
}

const analyses = [];
for (const diagnosticCase of cases) {
  const parsed = parseGameJournalJsonl(readFileSync(resolve(diagnosticCase.journal), "utf8"));
  const state = stateBeforeAction(parsed.journal, diagnosticCase.actionIndex);
  const entry = parsed.journal.actions[diagnosticCase.actionIndex];
  const reveal = entry.events.find(({ type }) => type === "special_revealed");
  if (!reveal) throw new Error(`${diagnosticCase.gameId} has no reveal at the selected action`);
  const player = entry.player;
  const enemy = player === "red" ? "blue" : "red";
  const publicState = stateForPlayer(state, player);
  const random = seededRandom(diagnosticCase.gameId.length * 1000003 + entry.beforeDigest.length);
  const targetTypes = {};
  let targetAnySpecial = 0;
  let targetActualSpecial = 0;
  let terminalLossAfterActivation = 0;

  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    const world = resampleFromInformationState(publicState, player, random);
    const sampledType = world.board[reveal.row][reveal.col]?.type || "empty";
    targetTypes[sampledType] = (targetTypes[sampledType] || 0) + 1;
    if (SPECIAL_TYPES.has(sampledType)) targetAnySpecial += 1;
    if (sampledType === reveal.unitType) targetActualSpecial += 1;

    const deployed = dispatchAction(world, player, structuredClone(entry.action));
    if (!deployed.accepted || !world.pendingSpecial) continue;
    const activated = dispatchAction(world, world.pendingSpecial.owner, { type: "activate_special" });
    if (activated.accepted && world.winner === enemy) terminalLossAfterActivation += 1;
  }

  const dangerousKey = actionKey(entry.action);
  let rootCandidateCount = 0;
  let selectedCount = 0;
  const rootObservations = [];
  for (let trial = 0; trial < SEARCH_TRIALS; trial += 1) {
    const result = findIsMctsAction(publicState, {
      aiPlayer: player,
      settings: candidateSettings,
      iterations: candidateSettings.isMctsIterations,
      rootCandidateLimit: candidateSettings.isMctsRootCandidateLimit,
      treeCandidateLimit: candidateSettings.isMctsTreeCandidateLimit,
      rolloutCandidateLimit: candidateSettings.isMctsRolloutCandidateLimit,
      rootEvaluationLimit: candidateSettings.isMctsRootEvaluationLimit,
      treeEvaluationLimit: candidateSettings.isMctsTreeEvaluationLimit,
      rolloutEvaluationLimit: candidateSettings.isMctsRolloutEvaluationLimit,
      rolloutDepth: candidateSettings.isMctsRolloutDepth,
      random: seededRandom((diagnosticCase.actionIndex + 1) * 1000 + trial),
    });
    const edge = result.root.find(({ action }) => actionKey(action) === dangerousKey);
    if (edge) rootCandidateCount += 1;
    if (actionKey(result.action) === dangerousKey) selectedCount += 1;
    rootObservations.push({
      trial,
      selected: actionKey(result.action),
      dangerousEdge: edge ? { visits: edge.visits, meanValue: edge.meanValue } : null,
    });
  }

  analyses.push({
    gameId: diagnosticCase.gameId,
    player,
    dangerousAction: entry.action,
    actualHiddenSpecial: { type: reveal.unitType, row: reveal.row, col: reveal.col },
    opponentDeployments: state.deploymentCount[enemy],
    hiddenOpponentStones: hiddenOpponentStones(publicState, player),
    sampling: {
      samples: SAMPLE_COUNT,
      targetTypes,
      targetAnySpecialRate: targetAnySpecial / SAMPLE_COUNT,
      targetActualSpecialRate: targetActualSpecial / SAMPLE_COUNT,
      terminalLossAfterActivationRate: terminalLossAfterActivation / SAMPLE_COUNT,
    },
    search: {
      trials: SEARCH_TRIALS,
      rootCandidateCount,
      selectedCount,
      rootObservations,
    },
  });
}

const report = { schemaVersion: 1, analyses };
const outputPath = resolve("experiments/is-mcts-loss-replays/hidden-risk-analysis.json");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
