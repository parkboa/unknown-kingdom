import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canDeploy,
  countPieces,
  neighbors,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";
import { AI_RANK_SETTINGS, findAiDeployMove } from "../js/ai.js";

const SIZE = 9;
const deterministicTiers = ["advanced", "expert", "grandmaster"];
const inputPath = resolve(process.argv[2] || "artifacts/ai-puzzle-candidates-20260820.jsonl");
const samplesPerTier = Math.max(1, Number.parseInt(process.argv[3] || "3", 10));
const disableBeliefSampling = process.argv.includes("--disable-belief");
const disableTacticalExtension = process.argv.includes("--disable-tactical");

if (disableBeliefSampling) {
  AI_RANK_SETTINGS.expert.beliefSampling = false;
  AI_RANK_SETTINGS.grandmaster.beliefSampling = false;
}
if (disableTacticalExtension) {
  AI_RANK_SETTINGS.expert.tacticalExtension = false;
  AI_RANK_SETTINGS.grandmaster.tacticalExtension = false;
}

function opponent(player) {
  return player === "red" ? "blue" : "red";
}

function swapPlayers(value) {
  return { red: structuredClone(value.blue), blue: structuredClone(value.red) };
}

function mirrorPiece(piece) {
  if (!piece) return null;
  return { ...structuredClone(piece), owner: opponent(piece.owner) };
}

function mirrorState(state) {
  const mirrored = structuredClone(state);
  mirrored.board = state.board
    .slice()
    .reverse()
    .map((row) => row.map(mirrorPiece));
  mirrored.turn = opponent(state.turn);
  mirrored.stock = swapPlayers(state.stock);
  mirrored.firstDeployDone = swapPlayers(state.firstDeployDone);
  mirrored.deploymentCount = swapPlayers(state.deploymentCount);
  mirrored.stats = {
    ...structuredClone(state.stats),
    captures: swapPlayers(state.stats.captures),
  };
  mirrored.selected = null;
  mirrored.lastMove = null;
  mirrored.teleporting = null;
  mirrored.pendingSpecial = null;
  mirrored.resumeTurn = null;
  mirrored.pendingWizardTeleport = null;
  mirrored.pendingKingSwap = null;
  mirrored.tauntEvent = null;
  mirrored.winner = state.winner ? opponent(state.winner) : null;
  mirrored.log = [];
  return mirrored;
}

function chooseMove(state, tier) {
  state.aiRank = tier;
  const player = state.turn;
  const enemy = opponent(player);
  return findAiDeployMove(stateForPlayer(state, player), {
    aiPlayer: player,
    humanPlayer: enemy,
    canDeploy: (owner, type, row, col) => canDeploy(state, owner, type, row, col),
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });
}

function sampleEvenly(rows, count) {
  if (rows.length <= count) return rows;
  return Array.from({ length: count }, (_, index) => {
    const sampleIndex = Math.floor(((index + 1) * rows.length) / (count + 1));
    return rows[sampleIndex];
  });
}

function moveLabel(move) {
  return move ? `${move.type}@${move.row},${move.col}` : "none";
}

function scoreOf(move) {
  return move?.deepScore ?? move?.score ?? null;
}

const records = readFileSync(inputPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map(JSON.parse);
const checks = [];

for (const tier of deterministicTiers) {
  const eligible = records.filter((record) =>
    record.source.playerTier === tier
    && !record.position.winner
    && !record.position.pendingSpecial
    && !record.position.teleporting
    && !record.position.pendingKingSwap);

  for (const record of sampleEvenly(eligible, samplesPerTier)) {
    const originalState = structuredClone(record.position);
    const mirroredState = mirrorState(record.position);
    const originalMove = chooseMove(originalState, tier);
    const mirroredMove = chooseMove(mirroredState, tier);
    const expectedMirror = originalMove && {
      type: originalMove.type,
      row: SIZE - 1 - originalMove.row,
      col: originalMove.col,
    };
    const moveMatches = Boolean(
      expectedMirror
      && mirroredMove
      && mirroredMove.type === expectedMirror.type
      && mirroredMove.row === expectedMirror.row
      && mirroredMove.col === expectedMirror.col,
    );
    const originalScore = scoreOf(originalMove);
    const mirroredScore = scoreOf(mirroredMove);
    const scoreDifference = Number.isFinite(originalScore) && Number.isFinite(mirroredScore)
      ? Math.abs(originalScore - mirroredScore)
      : null;

    checks.push({
      id: record.id,
      tier,
      originalTurn: record.position.turn,
      originalMove: moveLabel(originalMove),
      expectedMirror: expectedMirror ? moveLabel(expectedMirror) : "none",
      mirroredMove: moveLabel(mirroredMove),
      moveMatches,
      originalScore,
      mirroredScore,
      scoreDifference,
      scoreMatches: scoreDifference !== null && scoreDifference < 1e-9,
    });
  }
}

const mismatches = checks.filter((check) => !check.moveMatches || !check.scoreMatches);
process.stdout.write(`${JSON.stringify({
  inputPath,
  samplesPerTier,
  disableBeliefSampling,
  disableTacticalExtension,
  checks: checks.length,
  exactMatches: checks.length - mismatches.length,
  mismatches,
  results: checks,
}, null, 2)}\n`);
