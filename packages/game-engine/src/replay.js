import { dispatchAction } from "./actions.js";

const JOURNAL_SCHEMA_VERSION = 1;
const JSONL_RECORD_TYPES = new Set(["game_start", "action", "game_end"]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (!value || typeof value !== "object") return value;

  const normalized = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) normalized[key] = canonicalize(value[key]);
  }
  return normalized;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function stateDigest(state) {
  const input = new TextEncoder().encode(canonicalJson(state));
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input[index]);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function createGameJournal(initialState, metadata = {}) {
  const state = structuredClone(initialState);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    metadata: structuredClone(metadata),
    initialState: state,
    initialDigest: stateDigest(state),
    actions: [],
  };
}

export function gameJournalStartRecord(journal) {
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    recordType: "game_start",
    metadata: structuredClone(journal.metadata),
    initialState: structuredClone(journal.initialState),
    initialDigest: journal.initialDigest,
  };
}

export function gameJournalActionRecord(entry) {
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    recordType: "action",
    ...structuredClone(entry),
  };
}

export function gameJournalEndRecord(journal, outcome = null) {
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    recordType: "game_end",
    actionCount: journal.actions.length,
    finalDigest: journal.actions.at(-1)?.afterDigest || journal.initialDigest,
    outcome: outcome === null ? null : structuredClone(outcome),
  };
}

export function serializeGameJournalJsonl(journal, outcome = null) {
  const records = [
    gameJournalStartRecord(journal),
    ...journal.actions.map((entry) => gameJournalActionRecord(entry)),
    gameJournalEndRecord(journal, outcome),
  ];
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function parseGameJournalJsonl(jsonl) {
  const lines = String(jsonl).split(/\r?\n/).filter((line) => line.trim().length > 0);
  const records = lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSONL at line ${index + 1}`);
    }
  });
  if (records.length < 2 || records[0].recordType !== "game_start" || records.at(-1).recordType !== "game_end") {
    throw new Error("JSONL journal must start with game_start and end with game_end");
  }
  if (records.some((record) => record.schemaVersion !== JOURNAL_SCHEMA_VERSION || !JSONL_RECORD_TYPES.has(record.recordType))) {
    throw new Error("JSONL journal contains an unsupported record");
  }

  const start = records[0];
  const end = records.at(-1);
  const actions = records.slice(1, -1);
  if (actions.some((record, index) => record.recordType !== "action" || record.index !== index)) {
    throw new Error("JSONL journal action sequence is invalid");
  }
  if (end.actionCount !== actions.length) throw new Error("JSONL journal action count does not match");

  const journal = {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    metadata: structuredClone(start.metadata || {}),
    initialState: structuredClone(start.initialState),
    initialDigest: start.initialDigest,
    actions: actions.map(({ schemaVersion, recordType, ...entry }) => entry),
  };
  const replay = replayGameJournal(journal);
  if (!replay.ok) throw new Error(`JSONL journal replay failed at action ${replay.index}: ${replay.reason}`);
  if (replay.finalDigest !== end.finalDigest) throw new Error("JSONL journal final digest does not match");
  return { journal, outcome: structuredClone(end.outcome), replay };
}

export function dispatchRecordedAction(state, journal, player, action, options = {}) {
  const beforeDigest = stateDigest(state);
  const expectedDigest = journal.actions.at(-1)?.afterDigest || journal.initialDigest;
  if (beforeDigest !== expectedDigest) {
    throw new Error(`Journal state diverged before action ${journal.actions.length}`);
  }

  const result = dispatchAction(state, player, action, options);
  journal.actions.push({
    index: journal.actions.length,
    player,
    action: structuredClone(action),
    options: structuredClone(options),
    accepted: result.accepted,
    events: structuredClone(result.events),
    beforeDigest,
    afterDigest: stateDigest(state),
  });
  return result;
}

function replayFailure(index, reason, expected, actual, state) {
  return { ok: false, index, reason, expected, actual, state };
}

export function replayGameJournal(journal) {
  if (!journal || journal.schemaVersion !== JOURNAL_SCHEMA_VERSION || !Array.isArray(journal.actions)) {
    return replayFailure(-1, "invalid_journal", JOURNAL_SCHEMA_VERSION, journal?.schemaVersion, null);
  }

  const state = structuredClone(journal.initialState);
  const initialDigest = stateDigest(state);
  if (initialDigest !== journal.initialDigest) {
    return replayFailure(-1, "initial_digest_mismatch", journal.initialDigest, initialDigest, state);
  }

  for (let index = 0; index < journal.actions.length; index += 1) {
    const entry = journal.actions[index];
    const beforeDigest = stateDigest(state);
    if (beforeDigest !== entry.beforeDigest) {
      return replayFailure(index, "before_digest_mismatch", entry.beforeDigest, beforeDigest, state);
    }

    const result = dispatchAction(state, entry.player, structuredClone(entry.action), entry.options || {});
    if (result.accepted !== entry.accepted) {
      return replayFailure(index, "acceptance_mismatch", entry.accepted, result.accepted, state);
    }
    if (canonicalJson(result.events) !== canonicalJson(entry.events)) {
      return replayFailure(index, "event_mismatch", entry.events, result.events, state);
    }

    const afterDigest = stateDigest(state);
    if (afterDigest !== entry.afterDigest) {
      return replayFailure(index, "after_digest_mismatch", entry.afterDigest, afterDigest, state);
    }
  }

  return { ok: true, state, finalDigest: stateDigest(state), actionCount: journal.actions.length };
}
