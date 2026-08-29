import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createGameState } from "../packages/game-engine/src/index.js";
import { createPveJournalRecorder } from "../js/pve-journal.js";
import {
  loadPveJournalPositions,
  positionsFromPveJournalJsonl,
} from "../scripts/lib/pve-journal-positions.mjs";

function recordedPveJournal(metadata = {}) {
  const recorder = createPveJournalRecorder(createGameState("pve"), {
    source: "browser-pve",
    gameId: "human-game-1",
    aiRank: "advanced",
    humanPlayer: "red",
    aiPlayer: "blue",
    ...metadata,
  });
  recorder.record("red", { type: "deploy", unitType: "king", row: 0, col: 4 });
  recorder.record("blue", { type: "deploy", unitType: "king", row: 8, col: 4 });
  recorder.record("red", { type: "deploy", unitType: "soldier", row: 1, col: 4 });
  return recorder.jsonl();
}

test("PvE journals yield quiet AI response positions after human play", () => {
  const positions = positionsFromPveJournalJsonl(recordedPveJournal(), "downloaded.jsonl");

  assert.equal(positions.length, 1);
  assert.equal(positions[0].position.turn, "blue");
  assert.equal(positions[0].position.board[1][4].owner, "red");
  assert.deepEqual(positions[0].source, {
    kind: "pve-journal",
    file: "downloaded.jsonl",
    gameId: "human-game-1",
    actionIndex: 2,
    humanPlayer: "red",
    aiPlayer: "blue",
    aiRank: "advanced",
  });
});

test("PvE journal import refuses to guess missing or contradictory player metadata", () => {
  const missing = recordedPveJournal({ humanPlayer: undefined });
  assert.throws(() => positionsFromPveJournalJsonl(missing), /metadata\.humanPlayer/);

  const samePlayer = recordedPveJournal({ aiPlayer: "red" });
  assert.throws(() => positionsFromPveJournalJsonl(samePlayer), /must differ/);
});

test("PvE journal import accepts a file or a sorted directory of downloads", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "daeguk-pve-corpus-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const first = join(directory, "a.jsonl");
  const second = join(directory, "b.jsonl");
  writeFileSync(first, recordedPveJournal({ gameId: "a" }), "utf8");
  writeFileSync(second, recordedPveJournal({ gameId: "b" }), "utf8");

  assert.equal(loadPveJournalPositions(first).length, 1);
  assert.deepEqual(
    loadPveJournalPositions(directory).map(({ source }) => source.gameId),
    ["a", "b"],
  );
});

test("the tactics CLI records actual PvE provenance in its report", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "daeguk-pve-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const journalPath = join(directory, "browser-pve.jsonl");
  const reportPath = join(directory, "report.json");
  writeFileSync(journalPath, recordedPveJournal(), "utf8");

  const repository = fileURLToPath(new URL("../", import.meta.url));
  const result = spawnSync(process.execPath, [
    "scripts/ai-tactics-suite.mjs",
    "--pve-journals", journalPath,
    "--positions", "1",
    "--output", reportPath,
  ], { cwd: repository, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.equal(report.corpusSource, "pve-journal");
  assert.equal(report.perturbationPolicy, "actual-pve");
  assert.equal(report.sampledPlies, 1);
});
