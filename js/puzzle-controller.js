import { DEPLOY_ORDER, SIZE } from "./config.js";
import { inBounds } from "./board.js";
import { AI_RANK_ORDER, PUZZLES, RANK_ORDER } from "./puzzles.js";

export const CHALLENGE_PROGRESS_KEY = "daeguk-challenge-progress-v1";
export const TUTORIAL_SPECIAL_SURROUND_DELAY_MS = 1400;
export const TUTORIAL_SPECIAL_ACTIVATE_DELAY_MS = 1800;

export const TUTORIAL_STEPS = [
  { owner: "white", unitType: "king", row: 7, col: 4, setup: "empty" },
  { owner: "white", unitType: "soldier", row: 4, col: 4, setup: "empty" },
  { owner: "white", unitType: "soldier", row: 8, col: 3, setup: "wall-defense" },
  { owner: "white", unitType: "soldier", row: 7, col: 5, setup: "wall-capture" },
  { owner: "white", unitType: "soldier", row: 4, col: 5, setup: "capture" },
  { owner: "white", unitType: "general", row: 4, col: 4, setup: "special", reaction: true },
];

export let challengeProgress = loadChallengeProgress();

export function loadChallengeProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHALLENGE_PROGRESS_KEY) || "{}");
    const completed = Array.isArray(saved.completedPuzzleIds)
      ? saved.completedPuzzleIds.filter((id) => typeof id === "string" && PUZZLES.some((p) => p.id === id))
      : [];
    const defeatedAiRanks = Array.isArray(saved.defeatedAiRanks)
      ? [...new Set(saved.defeatedAiRanks.filter((rank) => AI_RANK_ORDER.includes(rank)))]
      : [];
    return {
      completedPuzzleIds: completed,
      defeatedAiRanks,
      tutorialCompleted: saved.tutorialCompleted === true,
    };
  } catch {
    return { completedPuzzleIds: [], defeatedAiRanks: [], tutorialCompleted: false };
  }
}

export function saveChallengeProgress() {
  localStorage.setItem(CHALLENGE_PROGRESS_KEY, JSON.stringify(challengeProgress));
}

export function markPuzzleComplete(index) {
  const puzzle = PUZZLES[index];
  if (!puzzle) return;
  let changed = false;
  if (!challengeProgress.completedPuzzleIds.includes(puzzle.id)) {
    challengeProgress.completedPuzzleIds.push(puzzle.id);
    changed = true;
  }
  if (puzzle.type === "tutorial" && !challengeProgress.tutorialCompleted) {
    challengeProgress.tutorialCompleted = true;
    changed = true;
  }
  if (!changed) return;
  saveChallengeProgress();
}

export function isTutorialComplete() {
  return challengeProgress.tutorialCompleted === true;
}

export function markTutorialComplete() {
  const tutorialIndex = PUZZLES.findIndex((puzzle) => puzzle.type === "tutorial");
  if (tutorialIndex < 0) return false;
  const wasComplete = isTutorialComplete();
  markPuzzleComplete(tutorialIndex);
  return !wasComplete;
}

export function arePrimaryModesUnlocked() {
  return isTutorialComplete();
}

export function isAiRankUnlocked(rankKey) {
  if (!arePrimaryModesUnlocked()) return false;
  const rankIndex = AI_RANK_ORDER.indexOf(rankKey);
  if (rankIndex < 0) return false;
  if (rankIndex === 0) return true;
  return challengeProgress.defeatedAiRanks.includes(AI_RANK_ORDER[rankIndex - 1]);
}

export function markAiRankDefeated(rankKey) {
  if (!isAiRankUnlocked(rankKey) || challengeProgress.defeatedAiRanks.includes(rankKey)) return false;
  challengeProgress.defeatedAiRanks.push(rankKey);
  saveChallengeProgress();
  return true;
}

export function isPuzzleComplete(index) {
  const puzzle = PUZZLES[index];
  return Boolean(puzzle && challengeProgress.completedPuzzleIds.includes(puzzle.id));
}

export function isPuzzleUnlocked(index) {
  if (index === 0) return true;
  const prevPuzzle = PUZZLES[index - 1];
  return Boolean(prevPuzzle && challengeProgress.completedPuzzleIds.includes(prevPuzzle.id));
}

export function firstUnresolvedRankIndex() {
  const unresolvedIndex = RANK_ORDER.findIndex((rankKey) => {
    const rankPuzzles = PUZZLES.filter((p) => p.rank === rankKey);
    return rankPuzzles.some((p) => !challengeProgress.completedPuzzleIds.includes(p.id));
  });
  return unresolvedIndex >= 0 ? unresolvedIndex : RANK_ORDER.length - 1;
}

export function localizedPuzzleText(value, language = "ko") {
  return typeof value === "string" ? value : value?.[language] || value?.en || "";
}

export function createEmptyStock() {
  return {
    black: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
    white: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
  };
}

export function normalizePuzzleStock(stock = {}) {
  const normalized = createEmptyStock();
  for (const owner of ["black", "white"]) {
    for (const unitType of DEPLOY_ORDER) {
      normalized[owner][unitType] = Math.max(0, Number(stock[owner]?.[unitType] || 0));
    }
  }
  return normalized;
}

export function isValidPuzzlePiece(piece) {
  if (!Array.isArray(piece) || piece.length !== 4) return false;
  const [owner, type, row, col] = piece;
  return ["black", "white"].includes(owner)
    && DEPLOY_ORDER.includes(type)
    && Number.isInteger(row)
    && Number.isInteger(col)
    && inBounds(row, col);
}
