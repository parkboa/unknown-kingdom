import { fork } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AI_RANK_SETTINGS, AI_TIER_ORDER } from "../js/ai.js";
import { playDeterministicAiMatch } from "./lib/ai-match.mjs";

const selfPath = fileURLToPath(import.meta.url);

function optionValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function numberOption(name, fallback) {
  const value = Number(optionValue(name, fallback));
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
}

/**
 * Expands a seed list, accepting both `a,b,c` and inclusive `a..b` ranges.
 *
 * Parsing used to be `parseInt` per comma-separated item, which reads `1..30` as `1` and
 * silently measures one seed instead of thirty. A run that quietly loses 90% of its sample
 * still writes a plausible-looking report, so anything unparseable throws instead.
 */
function parseSeedSpec(spec) {
  const seeds = [];
  for (const rawPart of String(spec).split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const range = part.match(/^(\d+)\.\.(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end < start) throw new Error(`--seeds range must ascend: ${part}`);
      for (let seed = start; seed <= end; seed += 1) seeds.push(seed >>> 0);
      continue;
    }
    if (!/^\d+$/.test(part)) throw new Error(`--seeds accepts numbers or a..b ranges: ${part}`);
    seeds.push(Number(part) >>> 0);
  }
  if (!seeds.length) throw new Error("--seeds produced no seeds");
  return [...new Set(seeds)];
}

function mergeSettings(tier, overridePath) {
  const base = structuredClone(AI_RANK_SETTINGS[tier]);
  if (!overridePath) return base;
  const override = JSON.parse(readFileSync(resolve(overridePath), "utf8"));
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    throw new Error(`${overridePath} must contain a JSON object`);
  }
  return {
    ...base,
    ...override,
    typeWeights: { ...base.typeWeights, ...(override.typeWeights || {}) },
    score: { ...base.score, ...(override.score || {}) },
  };
}

/**
 * A tier only consumes entropy when it applies positional variance, so a matchup
 * between two zero-variance tiers replays the exact same game for every seed.
 * Extra seeds would inflate the sample without adding a single new position.
 *
 * Measured 2026-08-24: every tier picks an identical move across 200 random streams,
 * so in practice this returns false for all five tiers. Randomized openings are what
 * actually make seeds informative.
 */
function usesRandomness(settings) {
  if (!settings) return true; // the random reference player
  return (settings.variance || 0) > 0 || settings.considerAllTypes === false;
}

const RANDOM_TIER = "random";
const isKnownTier = (tier) => tier === RANDOM_TIER || AI_TIER_ORDER.includes(tier);
// The random player has no rank settings; a null settings object selects it downstream.
const tierSettings = (tier) => (tier === RANDOM_TIER ? null : AI_RANK_SETTINGS[tier]);

if (process.argv.includes("--help")) {
  process.stdout.write(`Usage: node scripts/ai-ablation-study.mjs [options]\n\n\
  --base <tier>         Tier the variants modify (default: grandmaster)\n\
  --variants <list>     Comma-separated name=path.json pairs; "stock" needs no path\n\
  --opponents <list>    Comma-separated opponent tiers (default: novice,intermediate,advanced,expert)\n\
  --seeds <list>        Comma-separated seeds for non-deterministic matchups\n\
  --random-opening <n>  Random legal King/Soldier plies before the AIs take over\n\
  --league <tiers>      Round-robin among these tiers instead of variant testing\n\
  --reference <tier>    Rank every league tier against this one yardstick only\n\
  --handicap <n>        Free stones granted to the reference opponent before play\n\
  --max-deployments <n> Per-game deployment cap (default: 120)\n\
  --workers <n>         Parallel worker processes (default: 6)\n\
  --output <path>       Write the JSON summary\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Worker mode: play one assigned game and report it back to the parent.
// ---------------------------------------------------------------------------
if (process.argv.includes("--worker")) {
  process.on("message", (job) => {
    if (job.done) {
      process.exit(0);
    }
    try {
      const result = playDeterministicAiMatch({
        redTier: job.redTier,
        blueTier: job.blueTier,
        redSettings: job.redSettings,
        blueSettings: job.blueSettings,
        seed: job.seed,
        gameId: job.gameId,
        maxDeployments: job.maxDeployments,
        randomOpeningPlies: job.randomOpeningPlies,
        handicapPlayer: job.handicapPlayer,
        handicapStones: job.handicapStones,
      });
      process.send({ jobIndex: job.jobIndex, ok: true, result });
    } catch (error) {
      process.send({ jobIndex: job.jobIndex, ok: false, error: String(error?.message || error) });
    }
  });
} else {
  const baseTier = optionValue("--base", "grandmaster");
  if (!AI_TIER_ORDER.includes(baseTier)) {
    throw new Error(`--base must be one of: ${AI_TIER_ORDER.join(", ")}`);
  }
  const variantSpec = optionValue("--variants", "stock");
  const opponents = optionValue("--opponents", "novice,intermediate,advanced,expert")
    .split(",").map((value) => value.trim()).filter(Boolean);
  for (const tier of opponents) {
    if (!isKnownTier(tier)) throw new Error(`Unknown opponent tier: ${tier}`);
  }
  const seeds = parseSeedSpec(optionValue("--seeds", "20260821,20260822,20260823"));
  const randomOpeningPlies = Math.max(0, Math.floor(numberOption("--random-opening", 0)));
  const handicapStones = Math.max(0, Math.floor(numberOption("--handicap", 0)));
  const maxDeployments = Math.floor(numberOption("--max-deployments", 120));
  const workerCount = Math.max(1, Math.floor(numberOption("--workers", 6)));
  const outputValue = optionValue("--output");
  const outputPath = outputValue ? resolve(outputValue) : null;

  const leagueSpec = optionValue("--league", null);
  const leagueTiers = leagueSpec
    ? leagueSpec.split(",").map((value) => value.trim()).filter(Boolean)
    : null;
  if (leagueTiers) {
    for (const tier of leagueTiers) {
      if (!isKnownTier(tier)) throw new Error(`Unknown league tier: ${tier}`);
    }
  }

  const variants = leagueTiers ? [] : variantSpec.split(",").map((entry) => {
    const [name, path] = entry.split("=").map((value) => value.trim());
    return { name, path: path || null, settings: mergeSettings(baseTier, path || null) };
  });

  // Build the job list, collapsing seed repeats wherever both sides are deterministic.
  const jobs = [];
  // League mode plays each unordered tier pair once per seed in both colors, so a
  // matchup is never counted twice the way a variant x opponent grid would.
  // A reference opponent turns the league into a calibration ladder: every tier faces
  // the same neutral yardstick instead of each other, so style matchups cannot decide
  // the ordering.
  const referenceTier = optionValue("--reference", null);
  if (referenceTier && !isKnownTier(referenceTier)) {
    throw new Error(`Unknown reference tier: ${referenceTier}`);
  }
  const leaguePairs = [];
  if (leagueTiers) {
    if (referenceTier) {
      for (const tier of leagueTiers) {
        if (tier !== referenceTier) leaguePairs.push([tier, referenceTier]);
      }
    } else {
      for (let left = 0; left < leagueTiers.length; left += 1) {
        for (let right = left + 1; right < leagueTiers.length; right += 1) {
          leaguePairs.push([leagueTiers[left], leagueTiers[right]]);
        }
      }
    }
  }
  for (const [first, second] of leaguePairs) {
    const stochastic = randomOpeningPlies > 0
      || usesRandomness(tierSettings(first))
      || usesRandomness(tierSettings(second));
    for (const seed of stochastic ? seeds : seeds.slice(0, 1)) {
      for (const [redTier, blueTier] of [[first, second], [second, first]]) {
        jobs.push({
          jobIndex: jobs.length,
          league: true,
          redTier,
          blueTier,
          redSettings: tierSettings(redTier),
          blueSettings: tierSettings(blueTier),
          stochastic,
          seed,
          maxDeployments,
          randomOpeningPlies,
          handicapStones,
          // The reference opponent is the side that receives the free stones.
          handicapPlayer: handicapStones > 0 && referenceTier
            ? (redTier === referenceTier ? "red" : "blue")
            : null,
          gameId: `${redTier}-R-vs-${blueTier}-B-h${handicapStones}-${seed}`,
        });
      }
    }
  }
  for (const variant of variants) {
    for (const opponent of opponents) {
      const opponentSettings = tierSettings(opponent);
      const stochastic = randomOpeningPlies > 0
        || usesRandomness(variant.settings)
        || usesRandomness(opponentSettings);
      const jobSeeds = stochastic ? seeds : seeds.slice(0, 1);
      for (const seed of jobSeeds) {
        for (const variantColor of ["red", "blue"]) {
          jobs.push({
            jobIndex: jobs.length,
            variant: variant.name,
            opponent,
            variantColor,
            stochastic,
            seed,
            maxDeployments,
            randomOpeningPlies,
            gameId: `${variant.name}-vs-${opponent}-${variantColor}-${seed}`,
            redTier: variantColor === "red" ? baseTier : opponent,
            blueTier: variantColor === "blue" ? baseTier : opponent,
            redSettings: variantColor === "red" ? variant.settings : opponentSettings,
            blueSettings: variantColor === "blue" ? variant.settings : opponentSettings,
          });
        }
      }
    }
  }

  process.stderr.write(`Scheduled ${jobs.length} games across ${variants.length} variants on ${workerCount} workers.\n`);

  const games = new Array(jobs.length).fill(null);
  let nextJob = 0;
  let finished = 0;
  const startedAt = Date.now();

  await new Promise((resolveAll) => {
    let liveWorkers = 0;
    const spawnWorker = () => {
      const worker = fork(selfPath, ["--worker"], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
      liveWorkers += 1;

      const assign = () => {
        if (nextJob >= jobs.length) {
          worker.send({ done: true });
          return;
        }
        worker.send(jobs[nextJob]);
        nextJob += 1;
      };

      worker.on("message", (message) => {
        const job = jobs[message.jobIndex];
        finished += 1;
        // Settings are identical across every game of a variant, so they live in the
        // payload header rather than being repeated in each of hundreds of records.
        const { redSettings, blueSettings, ...jobRecord } = job;
        if (message.ok) {
          games[message.jobIndex] = { ...jobRecord, ...message.result, error: null };
        } else {
          games[message.jobIndex] = { ...jobRecord, winner: null, error: message.error };
        }
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        process.stderr.write(
          `[${finished}/${jobs.length}] ${job.gameId}: `
          + `${message.ok ? `winner=${message.result.winner} deploys=${message.result.deployments}` : `ERROR ${message.error}`}`
          + ` · ${elapsed}s elapsed\n`,
        );
        assign();
      });

      worker.on("exit", () => {
        liveWorkers -= 1;
        if (liveWorkers === 0) resolveAll();
      });

      assign();
    };

    for (let index = 0; index < Math.min(workerCount, jobs.length); index += 1) spawnWorker();
  });

  // ---------------------------------------------------------------------------
  // Aggregate. distinctGames counts unique final digests so that deterministic
  // repeats can never be mistaken for independent evidence.
  // ---------------------------------------------------------------------------
  const summary = variants.map((variant) => {
    const variantGames = games.filter((game) => game?.variant === variant.name);
    const scored = variantGames.filter((game) => game.winner && !game.error);
    const points = scored.reduce((total, game) => total
      + (game.winner === "draw" ? 0.5 : game.winner === game.variantColor ? 1 : 0), 0);
    const digests = new Set(scored.map((game) => game.finalDigest));
    const byOpponent = Object.fromEntries(opponents.map((opponent) => {
      const subset = scored.filter((game) => game.opponent === opponent);
      const subsetPoints = subset.reduce((total, game) => total
        + (game.winner === "draw" ? 0.5 : game.winner === game.variantColor ? 1 : 0), 0);
      return [opponent, {
        games: subset.length,
        points: subsetPoints,
        winRate: subset.length ? Number(((subsetPoints / subset.length) * 100).toFixed(1)) : null,
        distinctGames: new Set(subset.map((game) => game.finalDigest)).size,
        deterministic: subset.length ? !subset[0].stochastic : null,
      }];
    }));
    return {
      variant: variant.name,
      settingsPath: variant.path,
      games: scored.length,
      distinctGames: digests.size,
      points,
      winRate: scored.length ? Number(((points / scored.length) * 100).toFixed(1)) : null,
      errors: variantGames.filter((game) => game.error).length,
      averageDeployments: scored.length
        ? Number((scored.reduce((total, game) => total + game.deployments, 0) / scored.length).toFixed(1))
        : null,
      kingCaptureWins: scored.filter((game) => game.winner === game.variantColor
        && /King was captured/i.test(game.reason || "")).length,
      territoryWins: scored.filter((game) => game.winner === game.variantColor
        && !/King was captured/i.test(game.reason || "")).length,
      byOpponent,
    };
  });

  // League standings score each tier across every game it appeared in, on either colour.
  const leagueStandings = leagueTiers ? leagueTiers.map((tier) => {
    const played = games.filter((game) => game && !game.error && game.winner
      && (game.redTier === tier || game.blueTier === tier));
    let points = 0;
    let territoryWins = 0;
    let kingCaptureWins = 0;
    let marginTotal = 0;
    const winDeployments = [];
    for (const game of played) {
      const side = game.redTier === tier ? "red" : "blue";
      const gamePoints = game.winner === "draw" ? 0.5 : game.winner === side ? 1 : 0;
      points += gamePoints;
      // Final stone differential: the quantity the territory rule actually compares.
      const own = side === "red" ? game.finalPieces?.red : game.finalPieces?.blue;
      const foe = side === "red" ? game.finalPieces?.blue : game.finalPieces?.red;
      marginTotal += (own ?? 0) - (foe ?? 0);
      if (gamePoints === 1) {
        winDeployments.push(game.deployments);
        if (/King was captured/i.test(game.reason || "")) kingCaptureWins += 1;
        else territoryWins += 1;
      }
    }
    return {
      tier,
      games: played.length,
      distinctGames: new Set(played.map((game) => game.finalDigest)).size,
      points,
      winRate: played.length ? Number(((points / played.length) * 100).toFixed(1)) : null,
      territoryWins,
      kingCaptureWins,
      averageStoneMargin: played.length ? Number((marginTotal / played.length).toFixed(2)) : null,
      averageWinDeployments: winDeployments.length
        ? Number((winDeployments.reduce((total, value) => total + value, 0) / winDeployments.length).toFixed(1))
        : null,
      averageDeployments: played.length
        ? Number((played.reduce((total, game) => total + game.deployments, 0) / played.length).toFixed(1))
        : null,
    };
  }) : null;

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: leagueTiers ? "league" : "variants",
    baseTier: leagueTiers ? null : baseTier,
    leagueTiers,
    opponents: leagueTiers ? null : opponents,
    seeds,
    randomOpeningPlies,
    referenceTier,
    handicapStones,
    maxDeployments,
    note: "Matchups between two zero-variance tiers are deterministic; extra seeds are collapsed. "
      + "Compare winRate only alongside distinctGames.",
    leagueStandings,
    summary,
    games,
  };
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, serialized, "utf8");
  }

  if (leagueStandings) {
    process.stdout.write(
      `\n${"tier".padEnd(16)}${"games".padStart(6)}${"distinct".padStart(10)}${"win%".padStart(8)}`
      + `${"terr".padStart(6)}${"king".padStart(6)}${"margin".padStart(9)}${"winDeploys".padStart(12)}\n`,
    );
    for (const row of leagueStandings) {
      process.stdout.write(
        `${row.tier.padEnd(16)}${String(row.games).padStart(6)}${String(row.distinctGames).padStart(10)}`
        + `${String(row.winRate ?? "-").padStart(8)}${String(row.territoryWins).padStart(6)}`
        + `${String(row.kingCaptureWins).padStart(6)}${String(row.averageStoneMargin ?? "-").padStart(9)}`
        + `${String(row.averageWinDeployments ?? "-").padStart(12)}\n`,
      );
    }
    if (outputPath) process.stdout.write(`\nWrote ${outputPath}\n`);
    process.exit(0);
  }

  process.stdout.write(`\n${"variant".padEnd(22)}${"games".padStart(6)}${"distinct".padStart(10)}${"win%".padStart(8)}${"terr".padStart(6)}${"king".padStart(6)}  per-opponent win%\n`);
  for (const row of summary) {
    const perOpponent = opponents
      .map((opponent) => `${opponent.slice(0, 4)}:${row.byOpponent[opponent].winRate ?? "-"}`)
      .join("  ");
    process.stdout.write(
      `${row.variant.padEnd(22)}${String(row.games).padStart(6)}${String(row.distinctGames).padStart(10)}`
      + `${String(row.winRate ?? "-").padStart(8)}${String(row.territoryWins).padStart(6)}${String(row.kingCaptureWins).padStart(6)}  ${perOpponent}\n`,
    );
  }
  if (outputPath) process.stdout.write(`\nWrote ${outputPath}\n`);
}
