import {
  createGameJournal,
  dispatchRecordedAction,
  replayGameJournal,
  serializeGameJournalJsonl,
} from "../packages/game-engine/src/index.js";

export function createPveJournalRecorder(initialState, metadata = {}) {
  let recordingState = structuredClone(initialState);
  const journal = createGameJournal(recordingState, metadata);

  return {
    record(player, action, options = { advanceTurn: true }) {
      return dispatchRecordedAction(recordingState, journal, player, action, options);
    },
    restore(actionCount) {
      const target = Math.max(0, Math.min(Number(actionCount) || 0, journal.actions.length));
      journal.actions = journal.actions.slice(0, target);
      const replay = replayGameJournal(journal);
      if (!replay.ok) throw new Error(`Could not restore PvE journal at action ${replay.index}: ${replay.reason}`);
      recordingState = replay.state;
      return target;
    },
    actionCount() {
      return journal.actions.length;
    },
    jsonl(outcome = null) {
      return serializeGameJournalJsonl(journal, outcome);
    },
    snapshot() {
      return structuredClone(journal);
    },
  };
}
