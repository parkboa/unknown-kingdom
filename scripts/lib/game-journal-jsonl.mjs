import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  createGameJournal,
  dispatchRecordedAction,
  gameJournalActionRecord,
  gameJournalEndRecord,
  gameJournalStartRecord,
} from "../../packages/game-engine/src/index.js";

function jsonlLine(record) {
  return `${JSON.stringify(record)}\n`;
}

export function createJsonlGameRecorder(outputPath, initialState, metadata = {}) {
  const journal = createGameJournal(initialState, metadata);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, jsonlLine(gameJournalStartRecord(journal)), "utf8");
  let finalized = false;

  return {
    journal,
    dispatch(state, player, action, options = {}) {
      if (finalized) throw new Error("Cannot record an action after game_end");
      const result = dispatchRecordedAction(state, journal, player, action, options);
      appendFileSync(outputPath, jsonlLine(gameJournalActionRecord(journal.actions.at(-1))), "utf8");
      return result;
    },
    finalize(outcome = null) {
      if (finalized) throw new Error("JSONL recorder is already finalized");
      appendFileSync(outputPath, jsonlLine(gameJournalEndRecord(journal, outcome)), "utf8");
      finalized = true;
      return journal;
    },
  };
}
