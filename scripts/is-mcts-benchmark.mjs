import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AI_RANK_SETTINGS } from "../js/ai.js";
import { findIsMctsAction } from "../js/is-mcts.js";
import { createGameState, stateForPlayer } from "../packages/game-engine/src/index.js";
import { seededRandom } from "./lib/ai-match.mjs";

function optionValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

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

function benchmarkScenarios() {
  const opening = createGameState("pve");
  const hiddenMidgame = createGameState("pve");
  hiddenMidgame.turn = "blue";
  hiddenMidgame.firstDeployDone = { red: true, blue: true };
  hiddenMidgame.deploymentCount = { red: 6, blue: 6 };
  hiddenMidgame.stock.red = { soldier: 72, king: 0, general: 1, diplomat: 1, wizard: 1 };
  hiddenMidgame.stock.blue = { soldier: 72, king: 0, general: 1, diplomat: 1, wizard: 1 };
  hiddenMidgame.board[0][4] = piece("red", "king", "red-king");
  hiddenMidgame.board[8][4] = piece("blue", "king", "blue-king");
  hiddenMidgame.board[2][2] = piece("red", "soldier", "red-hidden-1", false);
  hiddenMidgame.board[3][4] = piece("red", "soldier", "red-hidden-2", false);
  hiddenMidgame.board[4][3] = piece("red", "soldier", "red-hidden-3", false);
  hiddenMidgame.board[4][5] = piece("blue", "soldier", "blue-1", false);
  hiddenMidgame.board[5][4] = piece("blue", "soldier", "blue-2", false);
  hiddenMidgame.board[6][3] = piece("blue", "soldier", "blue-3", false);
  hiddenMidgame.nextPieceId = 20;
  return [
    { name: "opening", state: opening, player: "red" },
    { name: "hidden_midgame", state: hiddenMidgame, player: "blue" },
  ];
}

const profiles = [
  {
    name: "fast",
    iterations: 8,
    rolloutDepth: 4,
    rootCandidateLimit: 4,
    treeCandidateLimit: 4,
    rolloutCandidateLimit: 3,
    rootEvaluationLimit: 20,
    treeEvaluationLimit: 10,
    rolloutEvaluationLimit: 6,
  },
  {
    name: "balanced",
    iterations: 24,
    rolloutDepth: 6,
    rootCandidateLimit: 6,
    treeCandidateLimit: 6,
    rolloutCandidateLimit: 4,
    rootEvaluationLimit: 28,
    treeEvaluationLimit: 14,
    rolloutEvaluationLimit: 8,
  },
  {
    name: "deep",
    iterations: 48,
    rolloutDepth: 8,
    rootCandidateLimit: 8,
    treeCandidateLimit: 8,
    rolloutCandidateLimit: 5,
    rootEvaluationLimit: 32,
    treeEvaluationLimit: 16,
    rolloutEvaluationLimit: 8,
  },
];
const repeats = Math.max(1, Math.floor(Number(optionValue("--repeats", 2))));
const seed = Math.floor(Number(optionValue("--seed", 20260824))) >>> 0;
const outputValue = optionValue("--output");
const outputPath = outputValue ? resolve(outputValue) : null;
const settings = structuredClone(AI_RANK_SETTINGS.grandmaster);
const results = [];

for (const scenario of benchmarkScenarios()) {
  for (const profile of profiles) {
    const trials = [];
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const startedAt = performance.now();
      const result = findIsMctsAction(stateForPlayer(scenario.state, scenario.player), {
        aiPlayer: scenario.player,
        settings,
        random: seededRandom((seed + repeat) >>> 0),
        ...profile,
      });
      const durationMs = performance.now() - startedAt;
      trials.push({
        repeat,
        durationMs,
        action: result.action,
        visits: result.visits,
        meanValue: result.meanValue,
        nodeCount: result.nodeCount,
      });
    }
    const actionKeys = trials.map(({ action }) => JSON.stringify(action));
    const row = {
      scenario: scenario.name,
      profile: profile.name,
      config: profile,
      averageMs: trials.reduce((sum, trial) => sum + trial.durationMs, 0) / trials.length,
      stableChoice: new Set(actionKeys).size === 1,
      trials,
    };
    results.push(row);
    process.stderr.write(
      `${scenario.name}/${profile.name}: ${row.averageMs.toFixed(1)}ms · stable=${row.stableChoice} · ${actionKeys[0]}\n`,
    );
  }
}

const output = { schemaVersion: 1, seed, repeats, results };
const serialized = `${JSON.stringify(output, null, 2)}\n`;
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized, "utf8");
}
process.stdout.write(serialized);
