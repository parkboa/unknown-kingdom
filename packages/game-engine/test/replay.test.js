import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createGameJournal,
  createGameState,
  dispatchRecordedAction,
  parseGameJournalJsonl,
  replayGameJournal,
  serializeGameJournalJsonl,
  stateDigest,
} from "../src/index.js";
import { createJsonlGameRecorder } from "../../../scripts/lib/game-journal-jsonl.mjs";
import { createPveJournalRecorder } from "../../../js/pve-journal.js";

test("records and deterministically replays actions and domain events", () => {
  const state = createGameState();
  const journal = createGameJournal(state, { matchId: "test-match" });

  assert.equal(dispatchRecordedAction(state, journal, "black", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  }).accepted, true);
  assert.equal(dispatchRecordedAction(state, journal, "white", {
    type: "deploy", unitType: "king", row: 8, col: 4,
  }).accepted, true);
  assert.equal(dispatchRecordedAction(state, journal, "black", { type: "resign" }).accepted, true);

  const replay = replayGameJournal(journal);
  assert.equal(replay.ok, true);
  assert.equal(replay.actionCount, 3);
  assert.equal(replay.finalDigest, stateDigest(state));
  assert.deepEqual(replay.state, state);
});

test("round-trips a complete action, event, and digest journal through JSONL", () => {
  const state = createGameState();
  const journal = createGameJournal(state, { gameId: "jsonl-1" });
  dispatchRecordedAction(state, journal, "black", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  });
  const outcome = { winner: null, capped: true };

  const jsonl = serializeGameJournalJsonl(journal, outcome);
  const parsed = parseGameJournalJsonl(jsonl);

  assert.equal(jsonl.trim().split("\n").length, 3);
  assert.deepEqual(parsed.journal, journal);
  assert.deepEqual(parsed.outcome, outcome);
  assert.equal(parsed.replay.finalDigest, stateDigest(state));

  const browserState = createGameState("pve");
  const browserRecorder = createPveJournalRecorder(browserState, { source: "browser-pve" });
  browserRecorder.record("black", { type: "deploy", unitType: "king", row: 0, col: 4 });
  const checkpoint = browserRecorder.actionCount();
  browserRecorder.record("white", { type: "deploy", unitType: "king", row: 8, col: 4 });
  assert.equal(browserRecorder.actionCount(), 2);
  browserRecorder.restore(checkpoint);
  assert.equal(browserRecorder.actionCount(), 1);
  browserRecorder.record("white", { type: "deploy", unitType: "king", row: 8, col: 3 });
  const browserParsed = parseGameJournalJsonl(browserRecorder.jsonl());
  assert.equal(browserParsed.journal.metadata.source, "browser-pve");
  assert.equal(browserParsed.replay.ok, true);
  assert.equal(browserParsed.replay.actionCount, 2);
});

test("compatibility: schema 1 red and blue JSONL migrates to schema 2 black and white", () => {
  const legacyPath = new URL(
    "../../../experiments/is-mcts-loss-replays/pair-002-candidate-blue.jsonl",
    import.meta.url,
  );
  const parsed = parseGameJournalJsonl(readFileSync(legacyPath, "utf8"));

  assert.equal(parsed.migratedFromSchemaVersion, 1);
  assert.equal(parsed.journal.schemaVersion, 2);
  assert.equal(parsed.replay.ok, true);
  assert.ok(["black", "white"].includes(parsed.journal.initialState.turn));
  assert.deepEqual(Object.keys(parsed.journal.initialState.stock).sort(), ["black", "white"]);
  assert.ok(parsed.journal.actions.every(({ player }) => player === "black" || player === "white"));
});

test("PvE timeout is journaled and deterministically restored from JSONL", () => {
  const state = createGameState("pve");
  const recorder = createPveJournalRecorder(state, { source: "browser-pve" });

  const timeout = recorder.record(
    "black",
    { type: "timeout" },
    { advanceTurn: true, authoritative: true },
  );
  assert.equal(timeout.accepted, true);
  assert.deepEqual(timeout.events, [{
    type: "match_ended",
    winner: "white",
    reason: "timeout",
    defeatedPlayer: "black",
  }]);

  const parsed = parseGameJournalJsonl(recorder.jsonl({ winner: "white", reason: "timeout" }));
  assert.equal(parsed.journal.actions.length, 1);
  assert.deepEqual(parsed.journal.actions[0].action, { type: "timeout" });
  assert.deepEqual(parsed.journal.actions[0].options, { advanceTurn: true, authoritative: true });
  assert.equal(parsed.replay.state.winner, "white");
  assert.equal(parsed.replay.state.resultReason, "Time limit exceeded (30s).");
  assert.deepEqual(parsed.outcome, { winner: "white", reason: "timeout" });
});

test("streams a complete replayable JSONL journal to a real file", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "daeguk-jsonl-recorder-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const outputPath = join(directory, "nested", "match.jsonl");
  const state = createGameState();
  const recorder = createJsonlGameRecorder(outputPath, state, { matchId: "file-match" });

  assert.equal(recorder.dispatch(state, "black", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  }).accepted, true);
  assert.equal(recorder.dispatch(state, "white", {
    type: "deploy", unitType: "king", row: 8, col: 4,
  }).accepted, true);
  assert.equal(recorder.dispatch(state, "black", { type: "resign" }).accepted, true);
  const outcome = { winner: "white", reason: "resignation" };
  recorder.finalize(outcome);

  const jsonl = readFileSync(outputPath, "utf8");
  const parsed = parseGameJournalJsonl(jsonl);
  assert.equal(jsonl.trim().split("\n").length, 5);
  assert.deepEqual(parsed.outcome, outcome);
  assert.equal(parsed.journal.metadata.matchId, "file-match");
  assert.equal(parsed.replay.actionCount, 3);
  assert.equal(parsed.replay.finalDigest, stateDigest(state));
  assert.throws(() => recorder.dispatch(state, "white", { type: "resign" }), /after game_end/);
  assert.throws(() => recorder.finalize(outcome), /already finalized/);
});

test("rejects a JSONL journal with a tampered action", () => {
  const state = createGameState();
  const journal = createGameJournal(state);
  dispatchRecordedAction(state, journal, "black", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  });
  const records = serializeGameJournalJsonl(journal).trim().split("\n").map(JSON.parse);
  records[1].action.row = 4;

  assert.throws(
    () => parseGameJournalJsonl(`${records.map(JSON.stringify).join("\n")}\n`),
    /replay failed/,
  );
});

test("reports the first divergence when a recorded action is changed", () => {
  const state = createGameState();
  const journal = createGameJournal(state);
  dispatchRecordedAction(state, journal, "black", {
    type: "deploy", unitType: "king", row: 0, col: 4,
  });
  journal.actions[0].action.row = 4;

  const replay = replayGameJournal(journal);
  assert.equal(replay.ok, false);
  assert.equal(replay.index, 0);
  assert.equal(replay.reason, "event_mismatch");
});

test("refuses to append when authoritative state changed outside the journal", () => {
  const state = createGameState();
  const journal = createGameJournal(state);
  state.turn = "white";

  assert.throws(
    () => dispatchRecordedAction(state, journal, "white", { type: "resign" }),
    /Journal state diverged/,
  );
});
