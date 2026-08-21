import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseGameJournalJsonl } from "../packages/game-engine/src/index.js";

const evaluationPath = resolve("experiments/is-mcts-promotion-result.json");
const outputDirectory = "experiments/is-mcts-loss-replays";
const summaryPath = resolve(outputDirectory, "summary.json");
const selectedGameIds = [
  "pair-002-candidate-blue",
  "pair-008-candidate-red",
  "pair-001-candidate-red",
];
const comparisonFields = [
  "winner",
  "capped",
  "deployments",
  "reason",
  "finalPieces",
  "actionCount",
  "finalDigest",
];

const evaluation = JSON.parse(readFileSync(evaluationPath, "utf8"));
const replays = [];

for (const gameId of selectedGameIds) {
  const expected = evaluation.results.find((result) => result.gameId === gameId);
  if (!expected) throw new Error(`Evaluation result not found: ${gameId}`);
  const journalPath = resolve(outputDirectory, `${gameId}.jsonl`);
  const parsed = parseGameJournalJsonl(readFileSync(journalPath, "utf8"));
  const actual = {
    ...parsed.outcome,
    actionCount: parsed.replay.actionCount,
    finalDigest: parsed.replay.finalDigest,
  };

  for (const field of comparisonFields) {
    if (JSON.stringify(actual[field]) !== JSON.stringify(expected[field])) {
      throw new Error(
        `${gameId} diverged at ${field}: expected ${JSON.stringify(expected[field])}, got ${JSON.stringify(actual[field])}`,
      );
    }
  }

  const replay = {
    gameId,
    candidateColor: expected.candidateColor,
    seed: expected.seed,
    winner: actual.winner,
    capped: actual.capped,
    deployments: actual.deployments,
    reason: actual.reason,
    finalPieces: actual.finalPieces,
    actionCount: actual.actionCount,
    finalDigest: actual.finalDigest,
    journalPath: relative(process.cwd(), journalPath),
    reproduced: true,
  };
  replays.push(replay);
  process.stderr.write(
    `${gameId}: replayed ${actual.winner} win in ${actual.deployments} deployments (${actual.finalDigest})\n`,
  );
}

const summary = {
  schemaVersion: 1,
  sourceEvaluation: relative(process.cwd(), evaluationPath),
  replayCount: replays.length,
  allReproduced: replays.every(({ reproduced }) => reproduced),
  replays,
};
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
