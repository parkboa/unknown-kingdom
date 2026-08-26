/**
 * Deterministic tactical exam for the AI tiers.
 *
 * Full games answer "who wins", which at 80 games resolves nothing smaller than a 20pp gap —
 * the Stage 1 weight sweep produced 62.5%, 48.8%, 53.8% and 71.3% with every confidence
 * interval overlapping. A position with a verifiable right answer removes that variance: the
 * tier either finds the move or it does not, and one position is one bit of signal rather than
 * one noisy game.
 *
 * Every answer key is computed by the engine, never asserted by hand. Two earlier keys were
 * discarded for exactly that mistake and are worth remembering:
 *
 *   - "capture whatever is capturable" — taking one stone is often the worse move, so the key
 *     was scoring a preference, not a fact.
 *   - "a group with one empty neighbour is in atari" — own and neutral walls are liberties
 *     here, so wall-hugging groups were called dead while they were perfectly safe. Every tier
 *     ignoring the phantom rescue was correct, and the exam marked them all wrong.
 *
 * What survives is what the rules settle on their own: winning now, not losing now, and not
 * throwing a unit away for nothing.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  applyAction,
  canDeploy,
  collectGroup,
  countPieces,
  createGameState,
  getLegalActions,
  isSuicideDeployment,
  opponent,
  orthogonalPositions,
  SIZE,
} from "../packages/game-engine/src/index.js";
import { AI_RANK_SETTINGS, findAiDeployMove } from "../js/ai.js";
import { neighbors } from "../js/board.js";

const TIERS = ["novice", "intermediate", "advanced", "expert", "grandmaster"];
const SPECIAL_TYPES = ["general", "diplomat", "wizard"];

function optionValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(name);

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const inBounds = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;
const moveKey = (move) => `${move.unitType ?? move.type}:${move.row}:${move.col}`;

function legalDeployments(state, player) {
  return getLegalActions(state, player).filter((action) => action.type === "deploy");
}

/**
 * A copy with `player` to move.
 *
 * `getLegalActions` returns nothing for a player who is not on turn, so asking "what could the
 * opponent do here" needs the turn flipped first. Missing this made every threat scan come back
 * empty and every threat-based category report zero positions.
 */
function withTurn(state, player) {
  const next = structuredClone(state);
  next.turn = player;
  return next;
}

/**
 * Removes both sides' unplayed specials.
 *
 * This is what isolates the Go-like layer. The specials are the hidden information in this
 * game, and a surrounded special detonates and clears its neighbours, which makes a liberty
 * count unreliable in exactly the positions the exam is about. With the stock emptied the
 * remainder is open-information stone play: liberties, capture, connection. Kings already on
 * the board stay, and King capture remains a win — that is a rule, not a unit.
 */
function stripSpecials(state) {
  for (const player of ["red", "blue"]) {
    for (const type of SPECIAL_TYPES) state.stock[player][type] = 0;
    // Emptying the stock is not enough. `observedRemainingSpecialTypes` answers "could a
    // special still be hiding among the enemy's pieces", and it reads revealed pieces, the
    // information history and `specialsUsed` — never the stock, which is right for a real game
    // where deployed-but-unrevealed specials are exactly the threat. Left at 0 the AI believes
    // all three specials are still out there, and `findAiDeployMove` then vetoes a winning move
    // because it does not win in every hypothesised world. Measured on one such position:
    // expert and grandmaster both walked away from an immediate King capture, and both found it
    // once the count was marked spent. Aligning belief with reality is what makes this mode
    // open-information rather than merely special-free.
    state.stats.specialsUsed[player] = SPECIAL_TYPES.length;
  }
  return state;
}

/** Empty points adjacent to the group — the liberties an opponent can actually fill. */
function boardLiberties(state, group) {
  const seen = new Set();
  for (const [row, col] of group) {
    for (const [nextRow, nextCol] of orthogonalPositions(row, col)) {
      if (inBounds(nextRow, nextCol) && !state.board[nextRow][nextCol]) seen.add(`${nextRow}:${nextCol}`);
    }
  }
  return seen;
}

function ownGroups(state, owner) {
  const groups = [];
  const visited = new Set();
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (state.board[row][col]?.owner !== owner || visited.has(`${row}:${col}`)) continue;
      const group = collectGroup(state, row, col);
      for (const [groupRow, groupCol] of group) visited.add(`${groupRow}:${groupCol}`);
      groups.push(group);
    }
  }
  return groups;
}

/**
 * Applies one deployment to a copy and reports what it did.
 *
 * A deployment that traps a special leaves `pendingSpecial` set and the match undecided until
 * the reaction is activated, so `won` resolves that follow-up before answering. Without it a
 * win by special reaction reads as a quiet move and the win-now key misses it entirely.
 */
function simulate(state, player, action) {
  const next = structuredClone(state);
  const before = countPieces(next, opponent(player));
  const accepted = applyAction(next, player, {
    type: "deploy",
    unitType: action.unitType,
    row: action.row,
    col: action.col,
  });
  if (!accepted) return null;
  let guard = 0;
  while (next.pendingSpecial && !next.winner && guard < 8) {
    if (!applyAction(next, next.pendingSpecial.owner, { type: "activate_special" })) break;
    guard += 1;
  }
  return {
    state: next,
    captured: before - countPieces(next, opponent(player)),
    won: next.winner === player,
  };
}

/** Whether `player` has a deployment that wins immediately, given the move. */
function hasImmediateWin(state, player) {
  const view = state.turn === player ? state : withTurn(state, player);
  for (const action of legalDeployments(view, player)) {
    if (simulate(view, player, action)?.won) return true;
  }
  return false;
}

/**
 * A deployment wins on the spot. Nothing outranks winning, so this key needs no judgement:
 * the engine either sets `winner` or it does not.
 */
function classifyWinNow(state, player) {
  const winning = [];
  for (const action of legalDeployments(state, player)) {
    if (simulate(state, player, action)?.won) winning.push(moveKey(action));
  }
  if (!winning.length) return null;
  return { category: "win_now", scored: true, correct: winning, detail: { winningMoves: winning.length } };
}

/**
 * The opponent can win next move, and some replies stop it while others do not.
 *
 * Each candidate is played and then every enemy answer is re-scanned, so a move counts as a
 * defence only when no winning reply survives it — whether it blocks, captures the threat, or
 * wins the race outright. Positions where everything defends, or nothing does, are dropped:
 * they separate no one.
 */
function classifyMustDefend(state, player) {
  const enemy = opponent(player);
  if (!hasImmediateWin(state, enemy)) return null;
  const safe = [];
  let exposed = 0;
  for (const action of legalDeployments(state, player)) {
    const result = simulate(state, player, action);
    if (!result) continue;
    if (result.won) { safe.push(moveKey(action)); continue; }
    if (result.state.winner) { exposed += 1; continue; }
    if (hasImmediateWin(result.state, enemy)) exposed += 1;
    else safe.push(moveKey(action));
  }
  if (!safe.length || !exposed) return null;
  return {
    category: "must_defend",
    scored: true,
    correct: safe,
    detail: { defendingMoves: safe.length, losingMoves: exposed },
  };
}

/**
 * A group of the player's really is one move from death, verified by letting the opponent play
 * the killing point and watching the stones come off.
 *
 * Scored only when specials are stripped. Then territory is decided by raw stone count, so
 * losing stones is losing on the win condition itself; with specials in play a group can be
 * bait and abandoning it can be right, which is a preference the exam has no standing to
 * score. Single stones are excluded for the same reason — giving one up is ordinary.
 */
function classifyTrueAtari(state, player, { soldiersOnly }) {
  const enemy = opponent(player);
  // A group whose loss decides the match belongs to `must_defend`, which weighs every enemy
  // reply rather than this one group. Validation caught the difference: a King group in atari
  // fell through to here when nothing could save the match, and the key then demanded a
  // rescue that changes a lost position into a lost position. Tiers playing elsewhere were
  // right and the exam marked them wrong.
  if (hasImmediateWin(state, enemy)) return null;
  let victim = null;
  for (const group of ownGroups(state, player)) {
    if (group.length < 2) continue;
    if (group.some(([row, col]) => state.board[row][col]?.type === "king")) continue;
    const liberties = boardLiberties(state, group);
    if (liberties.size !== 1) continue;
    const [point] = [...liberties];
    const [row, col] = point.split(":").map(Number);
    const kill = simulate(withTurn(state, enemy), enemy, { unitType: "soldier", row, col });
    if (!kill) continue;
    const anchor = group[0];
    if (kill.state.board[anchor[0]][anchor[1]]?.owner === player) continue;
    victim = { group, point, anchor };
    break;
  }
  if (!victim) return null;

  const saving = [];
  const all = legalDeployments(state, player);
  for (const action of all) {
    const result = simulate(state, player, action);
    if (!result) continue;
    if (result.won) { saving.push(moveKey(action)); continue; }
    const [row, col] = victim.point.split(":").map(Number);
    if (result.state.board[victim.anchor[0]]?.[victim.anchor[1]]?.owner !== player) continue;
    if (!result.state.board[row][col]) {
      const kill = simulate(withTurn(result.state, enemy), enemy, { unitType: "soldier", row, col });
      if (kill && kill.state.board[victim.anchor[0]][victim.anchor[1]]?.owner !== player) continue;
    }
    // A rescue that hands over the match is not a rescue.
    if (hasImmediateWin(result.state, enemy)) continue;
    saving.push(moveKey(action));
  }
  if (!saving.length || saving.length === all.length) return null;
  return {
    category: "true_atari",
    scored: Boolean(soldiersOnly),
    correct: saving,
    detail: { groupSize: victim.group.length, killPoint: victim.point, savingMoves: saving.length },
  };
}

/**
 * Nothing tactical is pending, but throwing a soldier away for nothing is available. The key is
 * negative: any move except a wasteful suicide counts. A floor check rather than a separator —
 * every tier is expected to pass, and a failure would mean the Stage 0 filter regressed.
 */
function classifySuicideAvoidance(state, player) {
  const wasteful = new Set();
  for (const action of legalDeployments(state, player)) {
    if (action.unitType !== "soldier") continue;
    if (isSuicideDeployment(state, player, action.unitType, action.row, action.col)) {
      wasteful.add(moveKey(action));
    }
  }
  if (!wasteful.size) return null;
  return {
    category: "avoid_suicide",
    scored: true,
    correct: null,
    forbidden: [...wasteful],
    detail: { wastefulMoves: wasteful.size },
  };
}

const CLASSIFIERS = [classifyWinNow, classifyMustDefend, classifyTrueAtari, classifySuicideAvoidance];

/**
 * Settings merged into every tier before it answers, so one knob can be swept across the exam
 * without disturbing how the sample was generated.
 */
let tierOverride = null;

function askTier(position, tier) {
  const state = structuredClone(position);
  state.aiRank = tier;
  delete state.aiSettings;
  if (tierOverride) state.aiSettings = { ...AI_RANK_SETTINGS[tier], ...tierOverride };
  const player = state.turn;
  return findAiDeployMove(state, {
    aiPlayer: player,
    humanPlayer: opponent(player),
    canDeploy: (owner, type, row, col) => canDeploy(state, owner, type, row, col),
    countPieces: (owner) => countPieces(state, owner),
    neighbors,
  });
}

/**
 * Random play almost never manufactures a real threat — 92 random playouts produced no win-now,
 * must-defend or atari position at all. Tactics appear when someone is trying to win, so
 * positions come from tier-vs-tier games after a random opening, sampled at every ply.
 */
function* sampledPositions(random, options) {
  const { games, openingPlies, maxPlies, soldiersOnly, endings } = options;
  for (let game = 0; game < games; game += 1) {
    const state = createGameState("pve", { aiRank: "grandmaster" });
    if (soldiersOnly) stripSpecials(state);
    const sides = {
      red: TIERS[Math.floor(random() * TIERS.length)],
      blue: TIERS[Math.floor(random() * TIERS.length)],
    };
    let ply = 0;
    for (; ply < maxPlies && !state.winner; ply += 1) {
      const player = state.turn;
      const quiet = !state.pendingSpecial && !state.teleporting && !state.pendingKingSwap;
      if (ply >= openingPlies && quiet && state.firstDeployDone[player]) yield structuredClone(state);

      let action = null;
      if (ply < openingPlies) {
        const choices = legalDeployments(state, player);
        action = choices.length ? choices[Math.floor(random() * choices.length)] : null;
      } else {
        const move = askTier(state, sides[player]);
        action = move ? { type: "deploy", unitType: move.type, row: move.row, col: move.col } : null;
      }
      if (!action || !applyAction(state, player, action)) break;
      while (state.pendingSpecial && !state.winner) {
        if (!applyAction(state, state.pendingSpecial.owner, { type: "activate_special" })) break;
      }
    }
    endings.push({ plies: ply, reason: state.resultReason || (state.winner ? "won" : "cut_off") });
  }
}

const GLYPH = { soldier: "s", king: "k", general: "g", diplomat: "d", wizard: "w" };

/** Renders the board so a human can check whether the answer key is actually right. */
function renderPosition(item) {
  const lines = [];
  const correct = new Set(item.correct || []);
  const forbidden = new Set(item.forbidden || []);
  const killPoint = item.detail?.killPoint;
  lines.push(`--- ${item.id} [${item.category}${item.scored ? "" : ", unscored"}] ${item.player} to move`);
  lines.push(`    ${JSON.stringify(item.detail)}`);
  lines.push("      0 1 2 3 4 5 6 7 8");
  for (let row = 0; row < SIZE; row += 1) {
    const cells = [];
    for (let col = 0; col < SIZE; col += 1) {
      const piece = item.position.board[row][col];
      if (piece) {
        const glyph = GLYPH[piece.type] || "?";
        cells.push(piece.owner === "red" ? glyph.toUpperCase() : glyph);
        continue;
      }
      const key = `${row}:${col}`;
      if (killPoint === key) cells.push("!");
      else if ([...correct].some((move) => move.endsWith(`:${row}:${col}`))) cells.push("*");
      else if ([...forbidden].some((move) => move.endsWith(`:${row}:${col}`))) cells.push("x");
      else cells.push(".");
    }
    lines.push(`   ${row}  ${cells.join(" ")}`);
  }
  lines.push("    RED uppercase / blue lowercase, * = keyed correct, x = forbidden, ! = killing point");
  return lines.join("\n");
}

/** Two-sided exact McNemar over positions where exactly one of the pair was right. */
function mcnemar(a, b) {
  let onlyA = 0;
  let onlyB = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    if (a[i]) onlyA += 1; else onlyB += 1;
  }
  const n = onlyA + onlyB;
  if (!n) return { onlyA, onlyB, p: 1 };
  const choose = (total, k) => {
    let value = 1;
    for (let i = 0; i < k; i += 1) value = value * (total - i) / (i + 1);
    return value;
  };
  const observed = choose(n, onlyA) * 0.5 ** n;
  let p = 0;
  for (let i = 0; i <= n; i += 1) {
    const mass = choose(n, i) * 0.5 ** n;
    if (mass <= observed + 1e-12) p += mass;
  }
  return { onlyA, onlyB, p: Math.min(1, p) };
}

/**
 * Pins the global RNG for the whole run.
 *
 * `findAiDeployMove` reaches for `Math.random()` when it picks a unit type, and every tier does
 * — not only the ones carrying positional variance. Left alone, two processes sample two
 * different sets of games, and a variant sweep ends up comparing tiers on different exams. The
 * first attempt at this sweep produced 23 positions in two runs and 36 in the other two for
 * exactly that reason.
 */
function pinRandom(seed) {
  const next = seededRandom(seed ^ 0x5f3759df);
  Math.random = next;
}

function main() {
  const seed = Number(optionValue("--seed", "20260826"));
  const target = Number(optionValue("--positions", "60"));
  const maxPlies = Number(optionValue("--max-plies", "80"));
  const games = Number(optionValue("--games", "12"));
  const openingPlies = Number(optionValue("--opening", "6"));
  const perCategory = Number(optionValue("--per-category", "0"));
  const soldiersOnly = hasFlag("--soldiers-only");
  const dump = hasFlag("--dump-positions");
  const overridePath = optionValue("--tier-override");
  const pendingOverride = overridePath ? JSON.parse(readFileSync(resolve(overridePath), "utf8")) : null;
  const outputPath = optionValue("--output", "experiments/ai-tactics-suite.json");
  const random = seededRandom(seed);
  pinRandom(seed);

  const caps = {
    // Wasteful suicides are everywhere and every tier passes them, so left uncapped they fill
    // the exam and crowd out the categories that actually separate tiers.
    avoid_suicide: Math.max(3, Math.floor(target * 0.15)),
  };
  if (perCategory > 0) for (const name of ["win_now", "must_defend", "true_atari"]) caps[name] = perCategory;

  const exam = [];
  const counts = {};
  const endings = [];
  let scanned = 0;

  for (const position of sampledPositions(random, { games, openingPlies, maxPlies, soldiersOnly, endings })) {
    if (exam.length >= target) break;
    scanned += 1;
    const player = position.turn;
    for (const classify of CLASSIFIERS) {
      const verdict = classify(position, player, { soldiersOnly });
      if (!verdict) continue;
      const seen = counts[verdict.category] || 0;
      if (caps[verdict.category] && seen >= caps[verdict.category]) break;
      counts[verdict.category] = seen + 1;
      exam.push({ id: `p${exam.length + 1}`, player, position, ...verdict });
      break;
    }
  }

  const mode = soldiersOnly ? "soldiers-only" : "all-units";
  process.stderr.write(`[${mode}] ${exam.length} positions from ${scanned} sampled plies ${JSON.stringify(counts)}\n`);
  process.stderr.write(`game endings: ${JSON.stringify(endings.map((e) => `${e.plies}:${e.reason}`.slice(0, 42)))}\n`);

  if (dump) for (const item of exam) process.stderr.write(`${renderPosition(item)}\n\n`);

  // Applied only now. `askTier` also drives the games that produce the sample, so setting this
  // before sampling would hand each variant a different exam and make the comparison meaningless.
  tierOverride = pendingOverride;

  const scores = {};
  const outcomes = {};
  for (const tier of TIERS) { scores[tier] = {}; outcomes[tier] = []; }
  const answers = [];

  for (const item of exam) {
    const record = {
      id: item.id,
      category: item.category,
      scored: item.scored,
      detail: item.detail,
      correct: item.correct,
      forbidden: item.forbidden,
      // A compact board for reading, and the whole state for replaying. Reconstructing from the
      // board alone is not faithful: stock, `stats.specialsUsed`, `deploymentCount` and the
      // information history all steer the belief model, and a rebuilt position scored nothing
      // like the original.
      board: item.position.board.map((row) => row.map((piece) => (piece ? `${piece.owner === "red" ? "R" : "b"}${piece.type}` : null))),
      turn: item.position.turn,
      position: item.position,
      byTier: {},
    };
    for (const tier of TIERS) {
      const move = askTier(item.position, tier);
      const key = move ? moveKey(move) : null;
      const passed = item.correct
        ? Boolean(key && item.correct.includes(key))
        : Boolean(key && !item.forbidden.includes(key));
      record.byTier[tier] = { move: key, passed };
      if (!item.scored) continue;
      const bucket = (scores[tier][item.category] ??= { total: 0, passed: 0 });
      bucket.total += 1;
      if (passed) bucket.passed += 1;
      outcomes[tier].push(passed);
    }
    answers.push(record);
  }

  const categories = [...new Set(exam.filter((item) => item.scored).map((item) => item.category))];
  const unscored = [...new Set(exam.filter((item) => !item.scored).map((item) => item.category))];

  process.stdout.write(`\n[${mode}] scored categories\n`);
  process.stdout.write(`${"tier".padEnd(14)}${categories.map((c) => c.padStart(16)).join("")}${"overall".padStart(12)}\n`);
  for (const tier of TIERS) {
    const cells = categories.map((category) => {
      const bucket = scores[tier][category];
      return bucket
        ? `${bucket.passed}/${bucket.total} (${Math.round(bucket.passed / bucket.total * 100)}%)`.padStart(16)
        : "-".padStart(16);
    });
    const total = Object.values(scores[tier]).reduce((sum, b) => sum + b.total, 0);
    const hit = Object.values(scores[tier]).reduce((sum, b) => sum + b.passed, 0);
    const overall = total ? `${Math.round(hit / total * 100)}%` : "-";
    process.stdout.write(`${tier.padEnd(14)}${cells.join("")}${overall.padStart(12)}\n`);
  }
  if (unscored.length) process.stdout.write(`\nreported but not scored: ${unscored.join(", ")}\n`);

  const comparisons = [];
  if (outcomes.grandmaster.length) {
    process.stdout.write(`\npaired against grandmaster (exact McNemar)\n`);
    for (const tier of TIERS) {
      if (tier === "grandmaster") continue;
      const test = mcnemar(outcomes.grandmaster, outcomes[tier]);
      comparisons.push({ tier, ...test });
      process.stdout.write(`  ${tier.padEnd(14)} gm-only ${String(test.onlyA).padStart(3)}  ${tier.slice(0, 4)}-only ${String(test.onlyB).padStart(3)}  p = ${test.p.toFixed(4)}\n`);
    }
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode,
    tierOverride,
    seed,
    positions: exam.length,
    sampledPlies: scanned,
    categoryCounts: counts,
    scoredCategories: categories,
    unscoredCategories: unscored,
    gameEndings: endings,
    scores,
    comparisons,
    answers,
  };
  const outFile = resolve(outputPath);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stderr.write(`\nWrote ${outFile}\n`);
}

// Exported so the answer keys can be exercised on hand-built positions; `main` only runs when
// this file is the entry point, not when a check imports it.
export {
  classifyWinNow,
  classifyMustDefend,
  classifyTrueAtari,
  classifySuicideAvoidance,
  hasImmediateWin,
  simulate,
  stripSpecials,
  withTurn,
};

if (import.meta.url === `file://${process.argv[1]}`) main();
