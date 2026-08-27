/**
 * Deterministic exam for how a tier spends its specials.
 *
 * The earlier tactics exam scores forced moves, where the engine settles the answer on its own.
 * Special placement is not forced — "plant here" is a preference, and an exam has no standing to
 * score a preference. The way round it is the one the objective-model probe used: constrain what
 * the tier may choose from, so the open question stops being *whether* to spend a special and
 * becomes *which square*, which the rules do answer.
 *
 * A reaction strikes or converts every enemy orthogonally adjacent to the special, and captures
 * an adjacent King outright. Every key below follows from that one sentence and is computed from
 * the position, never asserted.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  applyAction,
  canDeploy,
  collectGroup,
  countPieces,
  createGameState,
  findKingPosition,
  getLegalActions,
  groupHasLiberty,
  opponent,
  orthogonalPositions,
  SIZE,
} from "../packages/game-engine/src/index.js";
import { AI_RANK_SETTINGS, findAiDeployMove } from "../js/ai.js";
import { neighbors } from "../js/board.js";
import { diplomatConversionCapturesKing } from "../js/strategic-analysis.js";

const TIERS = ["novice", "intermediate", "advanced", "expert", "grandmaster"];
const SPECIALS = ["general", "diplomat", "wizard"];

const optionValue = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
};

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const inBounds = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;
const moveKey = (move) => `${move.unitType ?? move.type}:${move.row}:${move.col}`;
const legalDeployments = (state, player) =>
  getLegalActions(state, player).filter((action) => action.type === "deploy");

/** Legal placements of a special, which is the choice set every constrained category uses. */
function specialPlacements(state, player) {
  return legalDeployments(state, player).filter((action) => SPECIALS.includes(action.unitType));
}

function applyAndSettle(state, player, action) {
  const next = structuredClone(state);
  if (!applyAction(next, player, action)) return null;
  let guard = 0;
  while (next.pendingSpecial && !next.winner && guard < 6) {
    if (!applyAction(next, next.pendingSpecial.owner, { type: "activate_special" })) break;
    guard += 1;
  }
  return next;
}

/** The enemy King's own stones sitting orthogonally beside it — the guards a breach must clear. */
function kingGuards(state, enemy) {
  const king = findKingPosition(state, enemy);
  if (!king) return [];
  return orthogonalPositions(king.row, king.col)
    .filter(([row, col]) => inBounds(row, col))
    .filter(([row, col]) => {
      const piece = state.board[row][col];
      return piece?.owner === enemy && piece.type !== "king";
    });
}

/**
 * A square worth breaching from touches more than one guard at once.
 *
 * Structural, not simulated: a detonation hits every orthogonal neighbour, so the number of the
 * King's guards a square touches is the number it would clear. A diagonal touches exactly two,
 * which is why it is the best square against a King walled on all four sides.
 */
function guardsTouched(guards, row, col) {
  return guards.filter(([guardRow, guardCol]) =>
    Math.abs(guardRow - row) + Math.abs(guardCol - col) === 1).length;
}

/** Placements whose detonation would clear at least two of the King's guards. */
function classifyBreachSquare(state, player) {
  const enemy = opponent(player);
  const guards = kingGuards(state, enemy);
  if (guards.length < 2) return null;
  const choices = specialPlacements(state, player);
  if (choices.length < 2) return null;
  const correct = choices
    .filter((action) => guardsTouched(guards, action.row, action.col) >= 2)
    .map(moveKey);
  if (!correct.length || correct.length === choices.length) return null;
  return {
    category: "breach_square",
    choices: choices.map(moveKey),
    correct,
    detail: { guards: guards.length, breachSquares: correct.length, choices: choices.length },
  };
}

/**
 * Placements that become a mine the enemy King cannot survive.
 *
 * Verified by forcing the reaction rather than reasoning about it: the special is placed, its
 * group's liberties are filled by the enemy, and the resulting winner is read off the engine.
 */
function classifyMinePlacement(state, player) {
  const enemy = opponent(player);
  if (!findKingPosition(state, enemy)) return null;
  const choices = specialPlacements(state, player);
  if (choices.length < 2) return null;
  const correct = [];
  for (const action of choices) {
    const placed = applyAndSettle(state, player, action);
    if (!placed) continue;
    if (placed.winner === player) { correct.push(moveKey(action)); continue; }
    const group = collectGroup(placed, action.row, action.col);
    if (!groupHasLiberty(placed, group, player)) continue;
    const triggered = forceTrigger(placed, player, enemy, action);
    if (triggered?.winner === player) correct.push(moveKey(action));
  }
  if (!correct.length || correct.length === choices.length) return null;
  return {
    category: "mine_placement",
    choices: choices.map(moveKey),
    correct,
    detail: { killingSquares: correct.length, choices: choices.length },
  };
}

/** Fills the special's remaining liberties with enemy stones and reports what the reaction did. */
function forceTrigger(state, player, enemy, action) {
  let working = structuredClone(state);
  for (let step = 0; step < 6; step += 1) {
    const group = collectGroup(working, action.row, action.col);
    if (!group.length) return working;
    const liberties = new Set();
    for (const [row, col] of group) {
      for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
        if (inBounds(nextRow, nextCol) && !working.board[nextRow][nextCol]) {
          liberties.add(`${nextRow}:${nextCol}`);
        }
      }
    }
    if (!liberties.size) return working;
    const [point] = [...liberties];
    const [row, col] = point.split(":").map(Number);
    working.turn = enemy;
    const next = applyAndSettle(working, enemy, { type: "deploy", unitType: "soldier", row, col });
    if (!next) return working;
    working = next;
    if (working.winner) return working;
  }
  return working;
}

/** Placements where turning the King's own guards closes the net around it. */
function classifyConversionCapture(state, player) {
  const enemy = opponent(player);
  const choices = specialPlacements(state, player);
  if (choices.length < 2) return null;
  const correct = choices
    .filter((action) => action.unitType === "diplomat"
      && diplomatConversionCapturesKing(state, player, enemy, action.row, action.col))
    .map(moveKey);
  if (!correct.length || correct.length === choices.length) return null;
  return {
    category: "conversion_capture",
    choices: choices.map(moveKey),
    correct,
    detail: { conversionSquares: correct.length, choices: choices.length },
  };
}

/**
 * With one of our specials still waiting on the board, every square beside its group is
 * forbidden.
 *
 * Negative key, and the only category that leaves the choice unconstrained, because "this move
 * hands the group another liberty" is a fact about any move at all. A mine fires when its group
 * runs out of liberties; feeding it more is how a tier disarms its own weapon.
 */
function classifyMineDiscipline(state, player) {
  const enemy = opponent(player);
  const mines = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state.board[row][col];
      if (piece?.owner !== player || !SPECIALS.includes(piece.type) || piece.abilityUsed) continue;
      const triggered = forceTrigger(state, player, enemy, { row, col });
      if (triggered?.winner === player) mines.push({ row, col });
    }
  }
  if (!mines.length) return null;
  const forbidden = new Set();
  for (const mine of mines) {
    for (const [row, col] of collectGroup(state, mine.row, mine.col)) {
      for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
        if (inBounds(nextRow, nextCol) && !state.board[nextRow][nextCol]) {
          forbidden.add(`${nextRow}:${nextCol}`);
        }
      }
    }
  }
  const choices = legalDeployments(state, player);
  const banned = choices.filter(({ row, col }) => forbidden.has(`${row}:${col}`)).map(moveKey);
  if (!banned.length || banned.length === choices.length) return null;
  return {
    category: "mine_discipline",
    choices: null,
    correct: null,
    forbidden: banned,
    detail: { mines: mines.length, forbiddenSquares: forbidden.size },
  };
}

const CLASSIFIERS = [
  classifyConversionCapture,
  classifyBreachSquare,
  classifyMinePlacement,
  classifyMineDiscipline,
];

function askTier(position, tier, choices) {
  const state = structuredClone(position);
  state.aiRank = tier;
  delete state.aiSettings;
  const player = state.turn;
  const allowed = choices ? new Set(choices) : null;
  return findAiDeployMove(state, {
    aiPlayer: player,
    humanPlayer: opponent(player),
    canDeploy: (owner, type, row, col) => (!allowed || allowed.has(`${type}:${row}:${col}`))
      && canDeploy(state, owner, type, row, col),
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });
}

/** Tier-versus-tier games, sampled every ply, same as the tactics exam. */
function* sampledPositions(random, { games, openingPlies, maxPlies }) {
  for (let game = 0; game < games; game += 1) {
    const state = createGameState("pve", { aiRank: "grandmaster" });
    const sides = {
      red: TIERS[Math.floor(random() * TIERS.length)],
      blue: TIERS[Math.floor(random() * TIERS.length)],
    };
    for (let ply = 0; ply < maxPlies && !state.winner; ply += 1) {
      const player = state.turn;
      const quiet = !state.pendingSpecial && !state.teleporting && !state.pendingKingSwap;
      if (ply >= openingPlies && quiet && state.firstDeployDone[player]) yield structuredClone(state);

      let action = null;
      if (ply < openingPlies) {
        const options = legalDeployments(state, player);
        action = options.length ? options[Math.floor(random() * options.length)] : null;
      } else {
        const move = askTier(state, sides[player], null);
        action = move ? { type: "deploy", unitType: move.type, row: move.row, col: move.col } : null;
      }
      if (!action || !applyAction(state, player, action)) break;
      while (state.pendingSpecial && !state.winner) {
        if (!applyAction(state, state.pendingSpecial.owner, { type: "activate_special" })) break;
      }
    }
  }
}

function main() {
  const seed = Number(optionValue("--seed", "20260827"));
  const target = Number(optionValue("--positions", "60"));
  const games = Number(optionValue("--games", "40"));
  const maxPlies = Number(optionValue("--max-plies", "80"));
  const openingPlies = Number(optionValue("--opening", "6"));
  const perCategory = Number(optionValue("--per-category", "20"));
  const outputPath = optionValue("--output", "experiments/special-doctrine-probe.json");

  const random = seededRandom(seed);
  // `findAiDeployMove` reaches for `Math.random()` when it picks a unit type, so the global RNG
  // has to be pinned or two runs sample two different sets of games.
  Math.random = seededRandom(seed ^ 0x5f3759df);

  const exam = [];
  const counts = {};
  let scanned = 0;
  for (const position of sampledPositions(random, { games, openingPlies, maxPlies })) {
    if (exam.length >= target) break;
    scanned += 1;
    for (const classify of CLASSIFIERS) {
      const verdict = classify(position, position.turn);
      if (!verdict) continue;
      if ((counts[verdict.category] || 0) >= perCategory) break;
      counts[verdict.category] = (counts[verdict.category] || 0) + 1;
      exam.push({ id: `s${exam.length + 1}`, position, ...verdict });
      break;
    }
  }

  process.stderr.write(`${exam.length} positions from ${scanned} sampled plies ${JSON.stringify(counts)}\n`);

  const scores = {};
  for (const tier of TIERS) scores[tier] = {};
  const answers = [];
  for (const item of exam) {
    const record = {
      id: item.id,
      category: item.category,
      detail: item.detail,
      correct: item.correct,
      forbidden: item.forbidden,
      byTier: {},
    };
    for (const tier of TIERS) {
      const move = askTier(item.position, tier, item.choices);
      const key = move ? moveKey({ unitType: move.type, row: move.row, col: move.col }) : null;
      const passed = item.correct
        ? Boolean(key && item.correct.includes(key))
        : Boolean(key && !item.forbidden.includes(key));
      const bucket = (scores[tier][item.category] ??= { total: 0, passed: 0 });
      bucket.total += 1;
      if (passed) bucket.passed += 1;
      record.byTier[tier] = { move: key, passed };
    }
    answers.push(record);
  }

  const categories = [...new Set(exam.map((item) => item.category))];
  process.stdout.write(`\n${"tier".padEnd(14)}${categories.map((c) => c.padStart(20)).join("")}\n`);
  for (const tier of TIERS) {
    const cells = categories.map((category) => {
      const bucket = scores[tier][category];
      return bucket
        ? `${bucket.passed}/${bucket.total} (${Math.round(bucket.passed / bucket.total * 100)}%)`.padStart(20)
        : "-".padStart(20);
    });
    process.stdout.write(`${tier.padEnd(14)}${cells.join("")}\n`);
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    seed,
    positions: exam.length,
    sampledPlies: scanned,
    categoryCounts: counts,
    categories,
    scores,
    answers,
  };
  const outFile = resolve(outputPath);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stderr.write(`\nWrote ${outFile}\n`);
}

main();
