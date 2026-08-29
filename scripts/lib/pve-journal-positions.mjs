import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  dispatchAction,
  parseGameJournalJsonl,
} from "../../packages/game-engine/src/index.js";

function playerFromMetadata(metadata, key) {
  const player = metadata?.[key];
  if (player !== "red" && player !== "blue") {
    throw new Error(`PvE journal metadata.${key} must be red or blue`);
  }
  return player;
}

/**
 * Extract quiet AI-turn states produced by a real person's preceding PvE play.
 *
 * Parsing first verifies the complete journal and its state digests. We then replay it once more
 * to retain the state after each action. A state is eligible only after the AI has deployed its
 * King and all special transactions have settled, so an exam never asks for a normal deployment
 * while the authoritative engine is waiting for a reaction decision.
 */
export function positionsFromPveJournalJsonl(jsonl, sourceName = "pve-journal.jsonl") {
  const { journal } = parseGameJournalJsonl(jsonl);
  const humanPlayer = playerFromMetadata(journal.metadata, "humanPlayer");
  const aiPlayer = playerFromMetadata(journal.metadata, "aiPlayer");
  if (humanPlayer === aiPlayer) throw new Error("PvE journal humanPlayer and aiPlayer must differ");

  const state = structuredClone(journal.initialState);
  const positions = [];
  for (const entry of journal.actions) {
    const result = dispatchAction(state, entry.player, structuredClone(entry.action), entry.options || {});
    if (result.accepted !== entry.accepted) {
      throw new Error(`PvE journal replay acceptance changed at action ${entry.index}`);
    }

    const quiet = !state.pendingSpecial && !state.teleporting && !state.pendingKingSwap;
    if (!entry.accepted || state.winner || state.turn !== aiPlayer || !quiet) continue;
    if (!state.firstDeployDone?.[aiPlayer]) continue;

    positions.push({
      position: structuredClone(state),
      source: {
        kind: "pve-journal",
        file: basename(sourceName),
        gameId: journal.metadata?.gameId ?? null,
        actionIndex: entry.index,
        humanPlayer,
        aiPlayer,
        aiRank: journal.metadata?.aiRank ?? null,
      },
    });
  }
  return positions;
}

function journalFiles(inputPath) {
  const target = resolve(inputPath);
  const stats = statSync(target);
  if (stats.isFile()) return [target];
  if (!stats.isDirectory()) throw new Error(`--pve-journals is not a file or directory: ${inputPath}`);

  const files = readdirSync(target)
    .filter((name) => name.endsWith(".jsonl"))
    .sort()
    .map((name) => join(target, name));
  if (!files.length) throw new Error(`--pve-journals directory has no .jsonl files: ${inputPath}`);
  return files;
}

export function loadPveJournalPositions(inputPath) {
  const positions = journalFiles(inputPath).flatMap((filename) => positionsFromPveJournalJsonl(
    readFileSync(filename, "utf8"),
    filename,
  ));
  if (!positions.length) {
    throw new Error(`--pve-journals contains no quiet AI response positions: ${inputPath}`);
  }
  return positions;
}
