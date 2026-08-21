import { PLAYERS, SPECIALS, opponent } from "./constants.js";
import { stateDigest } from "./replay.js";
import { stateForPlayer } from "./visibility.js";

const NON_INFORMATION_FIELDS = [
  "selected",
  "aiProfile",
  "aiThinking",
  "aiRank",
  "aiDifficulty",
  "aiSettings",
  "log",
  "tauntUntil",
];

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function weightedSampleWithoutReplacement(values, weights, count, random) {
  const pool = [...values];
  const result = [];
  while (pool.length && result.length < count) {
    const total = pool.reduce((sum, value) => sum + Math.max(0, Number(weights?.[value] ?? 1)), 0);
    if (total <= 0) return result.concat(shuffle(pool, random).slice(0, count - result.length));
    let threshold = random() * total;
    let selectedIndex = pool.length - 1;
    for (let index = 0; index < pool.length; index += 1) {
      threshold -= Math.max(0, Number(weights?.[pool[index]] ?? 1));
      if (threshold < 0) {
        selectedIndex = index;
        break;
      }
    }
    result.push(pool.splice(selectedIndex, 1)[0]);
  }
  return result;
}

function knownOpponentSpecials(world, player, hiddenPlayer) {
  const known = new Set();
  for (const piece of world.board.flat()) {
    if (piece?.owner === hiddenPlayer && piece.revealed && SPECIALS.has(piece.originalType || piece.type)) {
      known.add(piece.originalType || piece.type);
    }
  }
  for (const transition of world.informationHistory?.[player] || []) {
    for (const event of transition.events || []) {
      if (
        (event.owner === hiddenPlayer || event.player === hiddenPlayer)
        && SPECIALS.has(event.unitType)
      ) known.add(event.unitType);
    }
  }
  return known;
}

function sampleSpecialCount(opportunities, maximum, probability, random) {
  let count = 0;
  for (let index = 0; index < opportunities && count < maximum; index += 1) {
    if (random() < probability) count += 1;
  }
  return count;
}

export function informationStateForPlayer(state, player) {
  if (!PLAYERS.includes(player)) throw new TypeError(`Unknown player: ${player}`);
  const informationState = stateForPlayer(state, player);
  for (const field of NON_INFORMATION_FIELDS) delete informationState[field];
  return informationState;
}

export function informationStateKey(state, player) {
  return `${player}|${stateDigest(informationStateForPlayer(state, player))}`;
}

export function resampleFromInformationState(state, player, random = Math.random, options = {}) {
  if (!PLAYERS.includes(player)) throw new TypeError(`Unknown player: ${player}`);
  if (typeof random !== "function") throw new TypeError("Information-state resampler requires a random function");
  const sourceKey = informationStateKey(state, player);
  const world = stateForPlayer(state, player);
  const hiddenPlayer = opponent(player);
  const hiddenStones = [];
  const deployedSpecials = knownOpponentSpecials(world, player, hiddenPlayer);

  for (let row = 0; row < world.board.length; row += 1) {
    for (let col = 0; col < world.board[row].length; col += 1) {
      const piece = world.board[row][col];
      if (!piece || piece.owner !== hiddenPlayer) continue;
      const knownType = piece.originalType || piece.type;
      if (piece.revealed && SPECIALS.has(knownType)) deployedSpecials.add(knownType);
      else if (!piece.revealed && piece.type !== "king") hiddenStones.push({ row, col });
    }
  }

  const deployments = world.deploymentCount?.[hiddenPlayer] || 0;
  const remainingSpecials = [...SPECIALS].filter((type) => !deployedSpecials.has(type));
  const unlockedSpecialSlots = Math.max(0, deployments - 5 - deployedSpecials.size);
  const maxSampled = Math.min(hiddenStones.length, remainingSpecials.length, unlockedSpecialSlots);
  const probability = Math.max(0, Math.min(1, Number(options.specialDeploymentProbability ?? 0.35)));
  let sampledCount = sampleSpecialCount(unlockedSpecialSlots, maxSampled, probability, random);
  const forced = options.forcedAssignment;
  const forcedStoneIndex = forced
    ? hiddenStones.findIndex(({ row, col }) => row === forced.row && col === forced.col)
    : -1;
  if (forced && (maxSampled < 1 || forcedStoneIndex < 0 || !remainingSpecials.includes(forced.type))) {
    throw new Error("Forced hidden-special assignment is inconsistent with the information state");
  }
  if (forced) sampledCount = Math.max(1, sampledCount);
  const sampledTypes = weightedSampleWithoutReplacement(
    remainingSpecials.filter((type) => type !== forced?.type),
    options.specialTypeWeights,
    Math.max(0, sampledCount - (forced ? 1 : 0)),
    random,
  );
  const sampledStones = shuffle(hiddenStones.filter((_, index) => index !== forcedStoneIndex), random)
    .slice(0, Math.max(0, sampledCount - (forced ? 1 : 0)));
  if (forced) {
    sampledTypes.unshift(forced.type);
    sampledStones.unshift(hiddenStones[forcedStoneIndex]);
  }

  sampledStones.forEach(({ row, col }, index) => {
    const type = sampledTypes[index];
    world.board[row][col].type = type;
    world.board[row][col].originalType = type;
    deployedSpecials.add(type);
  });

  const kingUsed = world.firstDeployDone?.[hiddenPlayer] ? 1 : 0;
  const assumedSoldiersUsed = Math.max(0, deployments - kingUsed - deployedSpecials.size);
  world.stock[hiddenPlayer] = {
    soldier: Math.max(0, 77 - assumedSoldiersUsed),
    king: kingUsed ? 0 : 1,
    general: deployedSpecials.has("general") ? 0 : 1,
    diplomat: deployedSpecials.has("diplomat") ? 0 : 1,
    wizard: deployedSpecials.has("wizard") ? 0 : 1,
  };

  if (informationStateKey(world, player) !== sourceKey) {
    throw new Error("Resampled world is inconsistent with the player's information state");
  }
  return world;
}
