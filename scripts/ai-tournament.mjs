import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  canDeploy,
  countPieces,
  createGameJournal,
  createGameState,
  dispatchRecordedAction,
  getLegalActions,
  kingLibertyCount,
  neighbors,
  replayGameJournal,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";
import {
  AI_RANK_SETTINGS,
  AI_TIER_ORDER,
  chooseAiTeleportDestination,
  findAiDeployMove,
} from "../js/ai.js";

const gamesPerColor = Math.max(1, Number.parseInt(process.argv[2] || "1", 10));
const maxDeployments = Math.max(40, Number.parseInt(process.argv[3] || "180", 10));
const seed = Number.parseInt(process.argv[4] || "20260820", 10) >>> 0;
const collectFlagIndex = process.argv.indexOf("--collect-puzzles");
const summaryOnly = process.argv.includes("--summary-only");
const commonScoreFlagIndex = process.argv.indexOf("--common-score");
const commonScoreProfile = commonScoreFlagIndex >= 0 ? process.argv[commonScoreFlagIndex + 1] : null;
const scoreAblationFlagIndex = process.argv.indexOf("--ablate-score");
const startingPlayerFlagIndex = process.argv.indexOf("--starting-player");
const startingPlayer = startingPlayerFlagIndex >= 0 ? process.argv[startingPlayerFlagIndex + 1] : "red";
const outputFlagIndex = process.argv.indexOf("--output");
const outputPath = outputFlagIndex >= 0 ? resolve(process.argv[outputFlagIndex + 1]) : null;
const traceGamesFlagIndex = process.argv.indexOf("--trace-games");
const traceGames = new Set(traceGamesFlagIndex >= 0
  ? (process.argv[traceGamesFlagIndex + 1] || "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isInteger)
  : []);
const scoreAblations = scoreAblationFlagIndex >= 0
  ? (process.argv[scoreAblationFlagIndex + 1] || "").split(",").filter(Boolean)
  : [];
const scoreProfiles = {
  intermediate: { ...AI_RANK_SETTINGS.intermediate.score },
  advanced: { ...AI_RANK_SETTINGS.advanced.score },
};
if (commonScoreProfile && !["intermediate", "advanced"].includes(commonScoreProfile)) {
  throw new Error("--common-score must be either intermediate or advanced");
}
if (!["red", "blue"].includes(startingPlayer)) {
  throw new Error("--starting-player must be red or blue");
}
if (scoreAblations.some((key) => !["capture", "kingPressure", "kingSafety"].includes(key))) {
  throw new Error("--ablate-score values must be capture, kingPressure, or kingSafety");
}
if (scoreAblations.length > 0 && commonScoreProfile !== "advanced") {
  throw new Error("--ablate-score requires --common-score advanced");
}
if (commonScoreProfile) {
  const commonScore = { ...scoreProfiles[commonScoreProfile] };
  for (const tier of AI_TIER_ORDER) AI_RANK_SETTINGS[tier].score = { ...commonScore };
}
for (const scoreAblation of scoreAblations) {
  for (const tier of AI_TIER_ORDER) {
    AI_RANK_SETTINGS[tier].score[scoreAblation] = scoreProfiles.intermediate[scoreAblation];
  }
}
const puzzleOutputPath = collectFlagIndex >= 0
  ? resolve(process.argv[collectFlagIndex + 1] || `artifacts/ai-puzzle-candidates-${seed}.jsonl`)
  : null;
const collectedPuzzleCandidates = [];
const collectedGameTraces = [];

function seededRandom(initialSeed) {
  let value = initialSeed;
  return () => {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

Math.random = seededRandom(seed);

function deployMove(state, player, tier) {
  const enemy = player === "red" ? "blue" : "red";
  const playerView = stateForPlayer(state, player);
  playerView.aiRank = tier;
  return findAiDeployMove(playerView, {
    aiPlayer: player,
    humanPlayer: enemy,
    canDeploy: (owner, type, row, col) => canDeploy(state, owner, type, row, col),
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });
}

function settleRequiredDecision(state, journal, tiers) {
  if (state.pendingSpecial) {
    return dispatchRecordedAction(
      state,
      journal,
      state.pendingSpecial.owner,
      { type: "activate_special" },
    ).accepted;
  }
  if (state.teleporting) {
    const owner = state.teleporting.owner;
    const playerView = stateForPlayer(state, owner);
    playerView.aiRank = tiers[owner];
    const destination = chooseAiTeleportDestination(
      playerView,
      neighbors,
      owner,
      owner === "red" ? "blue" : "red",
    );
    return dispatchRecordedAction(
      state,
      journal,
      owner,
      destination
        ? { type: "wizard_teleport", row: destination.row, col: destination.col }
        : { type: "wizard_stay" },
    ).accepted;
  }
  return false;
}

function territoryWinner(state) {
  const red = countPieces(state, "red");
  const blue = countPieces(state, "blue");
  return red === blue ? "draw" : red > blue ? "red" : "blue";
}

function tacticalTags(beforeState, afterState, player, enemy, move) {
  const tags = [];
  const ownLibertiesBefore = kingLibertyCount(beforeState, player);
  const ownLibertiesAfter = kingLibertyCount(afterState, player);
  const enemyLibertiesBefore = kingLibertyCount(beforeState, enemy);
  const enemyLibertiesAfter = kingLibertyCount(afterState, enemy);
  const captureGain = (afterState.stats?.captures?.[player] || 0)
    - (beforeState.stats?.captures?.[player] || 0);
  const enemyPieceLoss = countPieces(beforeState, enemy) - countPieces(afterState, enemy);

  if (afterState.winner === player && afterState.resultReason?.includes("King")) tags.push("king_capture");
  if (ownLibertiesBefore === 1 && ownLibertiesAfter > 1) tags.push("king_rescue");
  if (enemyLibertiesAfter === 1 && enemyLibertiesBefore !== 1) tags.push("king_atari");
  if (captureGain > 0 || enemyPieceLoss > 0) tags.push("capture");
  if (afterState.pendingSpecial || afterState.teleporting) tags.push("special_reaction");
  if (["general", "wizard", "diplomat"].includes(move.type)) tags.push("special_deploy");

  return {
    tags,
    metrics: {
      ownLibertiesBefore,
      ownLibertiesAfter,
      enemyLibertiesBefore,
      enemyLibertiesAfter,
      captureGain,
      enemyPieceLoss,
    },
  };
}

function traceStateSummary(state) {
  return {
    turn: state.turn,
    pieces: { red: countPieces(state, "red"), blue: countPieces(state, "blue") },
    captures: structuredClone(state.stats.captures),
    kingLiberties: {
      red: kingLibertyCount(state, "red"),
      blue: kingLibertyCount(state, "blue"),
    },
    pendingSpecial: state.pendingSpecial ? structuredClone(state.pendingSpecial) : null,
    teleporting: state.teleporting ? structuredClone(state.teleporting) : null,
    winner: state.winner,
  };
}

function playGame(redTier, blueTier, gameNumber) {
  const state = createGameState("pve", { aiRank: redTier });
  state.turn = startingPlayer;
  state.log = [`Simulation match started. ${startingPlayer} deploys first.`];
  const tiers = { red: redTier, blue: blueTier };
  const journal = createGameJournal(state, {
    seed,
    gameNumber,
    tiers,
    startingPlayer,
  });
  const gameCandidates = [];
  const tracing = traceGames.has(gameNumber);
  const traceEvents = [];
  let deployments = 0;
  let forcedDecisions = 0;
  const startedAt = performance.now();

  while (!state.winner && deployments < maxDeployments) {
    if (state.pendingSpecial || state.teleporting) {
      const beforeDecision = tracing ? traceStateSummary(state) : null;
      const requiredDecision = state.pendingSpecial
        ? {
            type: "activate_special",
            owner: state.pendingSpecial.owner,
            unitType: state.pendingSpecial.type,
            row: state.pendingSpecial.row,
            col: state.pendingSpecial.col,
          }
        : {
            type: "wizard_decision",
            owner: state.teleporting.owner,
            row: state.teleporting.row,
            col: state.teleporting.col,
          };
      if (!settleRequiredDecision(state, journal, tiers)) {
        throw new Error(`Could not settle required decision at deployment ${deployments}`);
      }
      if (tracing) {
        traceEvents.push({
          kind: "reaction",
          afterDeployment: deployments,
          decision: requiredDecision,
          resolvedMove: state.lastMove ? structuredClone(state.lastMove) : null,
          before: beforeDecision,
          after: traceStateSummary(state),
        });
      }
      forcedDecisions += 1;
      if (forcedDecisions > 500) throw new Error("Reaction loop exceeded safety limit");
      continue;
    }

    const player = state.turn;
    const enemy = player === "red" ? "blue" : "red";
    const positionBeforeMove = puzzleOutputPath || tracing ? structuredClone(state) : null;
    const move = deployMove(state, player, tiers[player]);
    if (!move) {
      const pass = getLegalActions(state, player).find((action) => action.type === "pass");
      if (!pass || !dispatchRecordedAction(state, journal, player, pass).accepted) {
        throw new Error(`${tiers[player]} returned no legal move for ${player}`);
      }
      continue;
    }

    if (!dispatchRecordedAction(state, journal, player, {
      type: "deploy",
      unitType: move.type,
      row: move.row,
      col: move.col,
    }).accepted) {
      throw new Error(`${tiers[player]} returned an illegal move ${move.type}@${move.row},${move.col}`);
    }
    deployments += 1;

    if (positionBeforeMove) {
      const tactical = tacticalTags(positionBeforeMove, state, player, enemy, move);
      if (tracing) {
        traceEvents.push({
          kind: "deploy",
          deployment: deployments,
          player,
          tier: tiers[player],
          move: {
            unitType: move.type,
            row: move.row,
            col: move.col,
            staticScore: move.score,
            searchScore: move.deepScore ?? null,
          },
          tags: tactical.tags,
          metrics: tactical.metrics,
          before: traceStateSummary(positionBeforeMove),
          after: traceStateSummary(state),
        });
      }
      if (puzzleOutputPath && tactical.tags.length > 0) {
        gameCandidates.push({
          schemaVersion: 1,
          id: `${seed}-${gameNumber}-${deployments}`,
          reviewStatus: "unreviewed",
          source: {
            seed,
            gameNumber,
            moveNumber: deployments,
            redTier,
            blueTier,
            playerTier: tiers[player],
          },
          tags: tactical.tags,
          metrics: tactical.metrics,
          move: {
            type: "deploy",
            unitType: move.type,
            row: move.row,
            col: move.col,
            staticScore: move.score,
            searchScore: move.deepScore ?? null,
          },
          position: positionBeforeMove,
        });
      }
    }
  }

  const capped = !state.winner;
  const replay = replayGameJournal(journal);
  if (!replay.ok) {
    throw new Error(`Replay diverged in game ${gameNumber} at action ${replay.index}: ${replay.reason}`);
  }
  const winner = state.winner || territoryWinner(state);
  const reason = state.resultReason || (capped ? "simulation_cap_territory" : "unknown");
  const finishType = reason.includes("King") ? "king_capture" : "territory";
  for (const candidate of gameCandidates) {
    candidate.outcome = {
      winner,
      candidatePlayerWon: candidate.position.turn === winner,
      finishType,
      reason,
      finalPieces: { red: countPieces(state, "red"), blue: countPieces(state, "blue") },
    };
    collectedPuzzleCandidates.push(candidate);
  }
  if (tracing) {
    collectedGameTraces.push({
      gameNumber,
      redTier,
      blueTier,
      startingPlayer,
      winner,
      deployments,
      finishType,
      reason,
      replay: {
        actionCount: replay.actionCount,
        finalDigest: replay.finalDigest,
      },
      finalPieces: { red: countPieces(state, "red"), blue: countPieces(state, "blue") },
      events: traceEvents,
      journal,
    });
  }
  return {
    redTier,
    blueTier,
    startingPlayer,
    winner,
    capped,
    deployments,
    durationMs: Math.round(performance.now() - startedAt),
    reason,
    finishType,
    finalPieces: { red: countPieces(state, "red"), blue: countPieces(state, "blue") },
  };
}

const results = [];
const totalGames = (AI_TIER_ORDER.length * (AI_TIER_ORDER.length - 1) / 2) * gamesPerColor * 2;
let completed = 0;

for (let left = 0; left < AI_TIER_ORDER.length; left += 1) {
  for (let right = left + 1; right < AI_TIER_ORDER.length; right += 1) {
    const first = AI_TIER_ORDER[left];
    const second = AI_TIER_ORDER[right];
    for (let game = 0; game < gamesPerColor; game += 1) {
      for (const [redTier, blueTier] of [[first, second], [second, first]]) {
        const result = playGame(redTier, blueTier, completed + 1);
        results.push(result);
        completed += 1;
        process.stderr.write(
          `[${completed}/${totalGames}] ${redTier}(B) vs ${blueTier}(W): ${result.winner} in ${result.deployments} moves, ${result.durationMs}ms\n`,
        );
      }
    }
  }
}

const standings = Object.fromEntries(AI_TIER_ORDER.map((tier) => [tier, {
  tier,
  games: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  asBlack: { games: 0, wins: 0 },
  asWhite: { games: 0, wins: 0 },
  asStarter: { games: 0, wins: 0 },
  asSecond: { games: 0, wins: 0 },
  totalDeployments: 0,
  kingCaptureWins: 0,
  territoryWins: 0,
}]));

for (const result of results) {
  for (const [side, tier] of [["red", result.redTier], ["blue", result.blueTier]]) {
    const row = standings[tier];
    row.games += 1;
    row.totalDeployments += result.deployments;
    const color = side === "red" ? row.asBlack : row.asWhite;
    const turnOrder = side === result.startingPlayer ? row.asStarter : row.asSecond;
    color.games += 1;
    turnOrder.games += 1;
    if (result.winner === "draw") {
      row.draws += 1;
      row.points += 0.5;
    } else if (result.winner === side) {
      row.wins += 1;
      row.points += 1;
      color.wins += 1;
      turnOrder.wins += 1;
      if (result.finishType === "king_capture") row.kingCaptureWins += 1;
      else row.territoryWins += 1;
    } else {
      row.losses += 1;
    }
  }
}

const output = {
  config: {
    gamesPerColor,
    maxDeployments,
    seed,
    totalGames,
    startingPlayer,
    commonScoreProfile,
    scoreAblations: scoreAblations.map((scoreAblation) => ({
        key: scoreAblation,
        from: scoreProfiles.advanced[scoreAblation],
        to: scoreProfiles.intermediate[scoreAblation],
      })),
    traceGames: [...traceGames],
    puzzleCollection: puzzleOutputPath
      ? { outputPath: puzzleOutputPath, candidateCount: collectedPuzzleCandidates.length }
      : null,
  },
  standings: Object.values(standings).map((row) => ({
    tier: row.tier,
    games: row.games,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    scoreRate: Number((row.points / row.games * 100).toFixed(1)),
    blackWinRate: Number((row.asBlack.wins / row.asBlack.games * 100).toFixed(1)),
    whiteWinRate: Number((row.asWhite.wins / row.asWhite.games * 100).toFixed(1)),
    starterWinRate: Number((row.asStarter.wins / row.asStarter.games * 100).toFixed(1)),
    secondPlayerWinRate: Number((row.asSecond.wins / row.asSecond.games * 100).toFixed(1)),
    kingCaptureWins: row.kingCaptureWins,
    territoryWins: row.territoryWins,
    averageDeployments: Number((row.totalDeployments / row.games).toFixed(1)),
  })).sort((a, b) => b.scoreRate - a.scoreRate),
  cappedGames: results.filter((result) => result.capped).length,
  outcomeSummary: {
    redWins: results.filter((result) => result.winner === "red").length,
    blueWins: results.filter((result) => result.winner === "blue").length,
    starterWins: results.filter((result) => result.winner === result.startingPlayer).length,
    secondPlayerWins: results.filter(
      (result) => result.winner !== "draw" && result.winner !== result.startingPlayer,
    ).length,
    draws: results.filter((result) => result.winner === "draw").length,
  },
  averageGameMs: Math.round(results.reduce((sum, result) => sum + result.durationMs, 0) / results.length),
  traces: collectedGameTraces,
  ...(summaryOnly ? {} : { results }),
};

if (puzzleOutputPath) {
  mkdirSync(dirname(puzzleOutputPath), { recursive: true });
  const jsonl = collectedPuzzleCandidates.map((candidate) => JSON.stringify(candidate)).join("\n");
  writeFileSync(puzzleOutputPath, jsonl ? `${jsonl}\n` : "", "utf8");
}

const serializedOutput = `${JSON.stringify(output, null, 2)}\n`;
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serializedOutput, "utf8");
}
process.stdout.write(serializedOutput);
