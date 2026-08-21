import {
  canDeploy,
  countPieces,
  createGameJournal,
  createGameState,
  dispatchRecordedAction,
  getLegalActions,
  neighbors,
  replayGameJournal,
  stateForPlayer,
} from "../../packages/game-engine/src/index.js";
import { chooseAiTeleportDestination, findAiDeployMove } from "../../js/ai.js";
import { findIsMctsAction } from "../../js/is-mcts.js";
import { createJsonlGameRecorder } from "./game-journal-jsonl.mjs";

export function seededRandom(initialSeed) {
  let value = initialSeed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function chooseDeployMove(state, player, tier, settings) {
  const enemy = player === "red" ? "blue" : "red";
  const playerView = stateForPlayer(state, player);
  playerView.aiRank = tier;
  if (settings) playerView.aiSettings = settings;
  if (settings?.searchAlgorithm === "is-mcts") {
    const result = findIsMctsAction(playerView, {
      aiPlayer: player,
      settings,
      iterations: settings.isMctsIterations || 64,
      rootCandidateLimit: settings.isMctsRootCandidateLimit || 24,
      treeCandidateLimit: settings.isMctsTreeCandidateLimit || 12,
      rolloutCandidateLimit: settings.isMctsRolloutCandidateLimit || 6,
      rootEvaluationLimit: settings.isMctsRootEvaluationLimit || 40,
      treeEvaluationLimit: settings.isMctsTreeEvaluationLimit || 24,
      rolloutEvaluationLimit: settings.isMctsRolloutEvaluationLimit || 12,
      rolloutDepth: settings.isMctsRolloutDepth || 10,
      riskWeight: settings.isMctsRiskWeight || 0,
      riskQuantile: settings.isMctsRiskQuantile || 0.25,
      riskCandidateLimit: settings.isMctsRiskCandidateLimit || 0,
      riskWorldLimit: settings.isMctsRiskWorldLimit || 6,
      riskRolloutDepth: settings.isMctsRiskRolloutDepth || 4,
      specialDeploymentProbability: settings.isMctsSpecialDeploymentProbability ?? 0.35,
      specialTypeWeights: settings.isMctsSpecialTypeWeights || null,
      random: Math.random,
    });
    if (result?.action.type !== "deploy") return null;
    return {
      type: result.action.unitType,
      row: result.action.row,
      col: result.action.col,
      mctsVisits: result.visits,
      mctsValue: result.meanValue,
      mctsDiagnostics: {
        iterations: result.iterations,
        nodeCount: result.nodeCount,
        root: result.root,
      },
    };
  }
  return findAiDeployMove(playerView, {
    aiPlayer: player,
    humanPlayer: enemy,
    canDeploy: (owner, type, row, col) => canDeploy(state, owner, type, row, col),
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });
}

function chooseRequiredAction(state, tiers, settings) {
  if (state.pendingSpecial) {
    return { player: state.pendingSpecial.owner, action: { type: "activate_special" } };
  }
  if (!state.teleporting) return null;

  const player = state.teleporting.owner;
  const enemy = player === "red" ? "blue" : "red";
  const playerView = stateForPlayer(state, player);
  playerView.aiRank = tiers[player];
  if (settings[player]) playerView.aiSettings = settings[player];
  const destination = chooseAiTeleportDestination(playerView, neighbors, player, enemy);
  return {
    player,
    action: destination
      ? { type: "wizard_teleport", row: destination.row, col: destination.col }
      : { type: "wizard_stay" },
  };
}

function territoryWinner(state) {
  const red = countPieces(state, "red");
  const blue = countPieces(state, "blue");
  return red === blue ? "draw" : red > blue ? "red" : "blue";
}

export function playDeterministicAiMatch({
  redTier,
  blueTier,
  seed,
  gameId,
  maxDeployments = 180,
  startingPlayer = "red",
  journalPath = null,
  redSettings = null,
  blueSettings = null,
  onDecision = null,
}) {
  const state = createGameState("pve", { aiRank: redTier });
  state.turn = startingPlayer;
  state.log = [`Evaluation match started. ${startingPlayer} deploys first.`];
  const tiers = { red: redTier, blue: blueTier };
  const settings = { red: redSettings, blue: blueSettings };
  const metadata = { gameId, seed, tiers, settings, startingPlayer };
  const fileRecorder = journalPath
    ? createJsonlGameRecorder(journalPath, state, metadata)
    : null;
  const journal = fileRecorder?.journal || createGameJournal(state, metadata);
  const dispatch = fileRecorder
    ? (player, action) => fileRecorder.dispatch(state, player, action)
    : (player, action) => dispatchRecordedAction(state, journal, player, action);
  const previousRandom = Math.random;
  Math.random = seededRandom(seed);
  let deployments = 0;
  let forcedDecisions = 0;
  const startedAt = performance.now();

  try {
    while (!state.winner && deployments < maxDeployments) {
      const required = chooseRequiredAction(state, tiers, settings);
      if (required) {
        if (!dispatch(required.player, required.action).accepted) {
          throw new Error(`Could not settle required decision after deployment ${deployments}`);
        }
        forcedDecisions += 1;
        if (forcedDecisions > 500) throw new Error("Reaction loop exceeded safety limit");
        continue;
      }

      const player = state.turn;
      const move = chooseDeployMove(state, player, tiers[player], settings[player]);
      if (!move) {
        const pass = getLegalActions(state, player).find((action) => action.type === "pass");
        if (!pass || !dispatch(player, pass).accepted) {
          throw new Error(`${tiers[player]} returned no legal move for ${player}`);
        }
        continue;
      }

      const action = { type: "deploy", unitType: move.type, row: move.row, col: move.col };
      if (onDecision) {
        onDecision({
          deployments,
          player,
          tier: tiers[player],
          action: structuredClone(action),
          diagnostics: move.mctsDiagnostics ? structuredClone(move.mctsDiagnostics) : null,
        });
      }
      if (!dispatch(player, action).accepted) {
        throw new Error(`${tiers[player]} returned an illegal move ${move.type}@${move.row},${move.col}`);
      }
      deployments += 1;
    }
  } finally {
    Math.random = previousRandom;
  }

  const capped = !state.winner;
  const winner = state.winner || territoryWinner(state);
  const outcome = {
    winner,
    capped,
    deployments,
    reason: state.resultReason || (capped ? "evaluation_cap_territory" : "unknown"),
    finalPieces: { red: countPieces(state, "red"), blue: countPieces(state, "blue") },
  };
  if (fileRecorder) fileRecorder.finalize(outcome);
  const replay = replayGameJournal(journal);
  if (!replay.ok) {
    throw new Error(`Replay diverged at action ${replay.index}: ${replay.reason}`);
  }

  return {
    gameId,
    redTier,
    blueTier,
    seed,
    startingPlayer,
    ...outcome,
    durationMs: Math.round(performance.now() - startedAt),
    actionCount: replay.actionCount,
    finalDigest: replay.finalDigest,
    journalPath,
  };
}
