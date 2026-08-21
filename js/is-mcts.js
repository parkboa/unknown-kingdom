import {
  dispatchAction,
  getLegalActions,
  stateDigest,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";
import { evaluateState } from "./state-evaluation.js";

const SPECIAL_TYPES = ["general", "wizard", "diplomat"];

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function opponent(player) {
  return player === "red" ? "blue" : "red";
}

export function sampleInformationSetWorld(publicState, perspective, random = Math.random) {
  const world = structuredClone(publicState);
  const hiddenPlayer = opponent(perspective);
  const hiddenStones = [];
  const deployedSpecials = new Set();

  for (let row = 0; row < world.board.length; row += 1) {
    for (let col = 0; col < world.board[row].length; col += 1) {
      const piece = world.board[row][col];
      if (!piece || piece.owner !== hiddenPlayer) continue;
      const knownType = piece.originalType || piece.type;
      if (piece.revealed && SPECIAL_TYPES.includes(knownType)) deployedSpecials.add(knownType);
      else if (!piece.revealed && piece.type !== "king") hiddenStones.push({ row, col });
    }
  }

  const deployments = world.deploymentCount?.[hiddenPlayer] || 0;
  const remainingSpecials = SPECIAL_TYPES.filter((type) => !deployedSpecials.has(type));
  const unlockedSpecialSlots = deployments > 5 ? deployments - 5 : 0;
  const maxSampled = Math.min(hiddenStones.length, remainingSpecials.length, unlockedSpecialSlots);
  const sampledCount = maxSampled > 0 ? Math.floor(random() * (maxSampled + 1)) : 0;
  const sampledTypes = shuffle(remainingSpecials, random).slice(0, sampledCount);
  const sampledStones = shuffle(hiddenStones, random).slice(0, sampledCount);

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
  return world;
}

export function informationStateKey(state, player) {
  return `${player}|${stateDigest(stateForPlayer(state, player))}`;
}

function decisionPlayer(state) {
  return state.pendingSpecial?.owner || state.teleporting?.owner || state.turn;
}

function actionKey(action) {
  if (action.type === "deploy") return `deploy:${action.unitType}:${action.row}:${action.col}`;
  if (action.type === "wizard_teleport") return `wizard_teleport:${action.row}:${action.col}`;
  return action.type;
}

function applyClonedAction(state, player, action) {
  const next = structuredClone(state);
  const result = dispatchAction(next, player, action);
  return result.accepted ? next : null;
}

function cheapActionPriority(state, player, action, random) {
  if (action.type === "activate_special" || action.type === "wizard_stay" || action.type === "pass") return 100000;
  if (!Number.isInteger(action.row) || !Number.isInteger(action.col)) return 0;
  const enemy = opponent(player);
  const center = 8 - (Math.abs(action.row - 4) + Math.abs(action.col - 4));
  let adjacentAllies = 0;
  let adjacentEnemies = 0;
  let adjacentEnemyKing = 0;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const piece = state.board[action.row + dr]?.[action.col + dc];
    if (piece?.owner === player) adjacentAllies += 1;
    if (piece?.owner === enemy) {
      adjacentEnemies += 1;
      if (piece.type === "king") adjacentEnemyKing += 1;
    }
  }
  return adjacentEnemyKing * 1000 + adjacentEnemies * 30 + adjacentAllies * 6 + center + random() * 1e-6;
}

function prefilterActions(state, player, actions, evaluationLimit, random) {
  if (actions.length <= evaluationLimit) return actions;
  return actions
    .map((action) => ({ action, priority: cheapActionPriority(state, player, action, random) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, evaluationLimit)
    .map(({ action }) => action);
}

function rankedActions(state, player, settings, limit, evaluationLimit, random) {
  const actions = getLegalActions(state, player);
  if (actions.length <= 1) return actions;
  const candidates = prefilterActions(state, player, actions, evaluationLimit, random);
  const ranked = candidates.map((action) => {
    const next = applyClonedAction(state, player, action);
    return {
      action,
      value: next ? evaluateState(next, player, settings) : -Infinity,
      jitter: random() * 1e-9,
    };
  });
  ranked.sort((a, b) => b.value - a.value || b.jitter - a.jitter);
  return ranked.slice(0, Math.max(1, limit)).map(({ action }) => action);
}

function rollout(state, rootPlayer, settings, options, random) {
  let current = state;
  for (let depth = 0; depth < options.rolloutDepth && !current.winner; depth += 1) {
    const player = decisionPlayer(current);
    const actions = rankedActions(
      current,
      player,
      settings,
      options.rolloutCandidateLimit,
      options.rolloutEvaluationLimit,
      random,
    );
    if (!actions.length) break;
    const explore = random() < options.rolloutExploration;
    const action = explore ? actions[Math.floor(random() * actions.length)] : actions[0];
    const next = applyClonedAction(current, player, action);
    if (!next) break;
    current = next;
  }
  if (current.winner) {
    if (current.winner === "draw") return 0;
    return current.winner === rootPlayer ? 1 : -1;
  }
  return Math.tanh(evaluateState(current, rootPlayer, settings) / options.valueScale);
}

function createNode(state, player, settings, options, random, root) {
  const limit = root ? options.rootCandidateLimit : options.treeCandidateLimit;
  const evaluationLimit = root ? options.rootEvaluationLimit : options.treeEvaluationLimit;
  const actions = rankedActions(state, player, settings, limit, evaluationLimit, random);
  return {
    visits: 0,
    actions: new Map(actions.map((action) => [actionKey(action), {
      action,
      visits: 0,
      valueSum: 0,
    }])),
  };
}

function selectEdge(node, maximizing, exploration) {
  const unvisited = [...node.actions.values()].find((edge) => edge.visits === 0);
  if (unvisited) return unvisited;
  let best = null;
  let bestScore = -Infinity;
  for (const edge of node.actions.values()) {
    const mean = edge.valueSum / edge.visits;
    const exploitation = maximizing ? mean : -mean;
    const score = exploitation + exploration * Math.sqrt(Math.log(node.visits + 1) / edge.visits);
    if (score > bestScore) {
      best = edge;
      bestScore = score;
    }
  }
  return best;
}

export function findIsMctsAction(state, {
  aiPlayer,
  settings = {},
  iterations = 64,
  random = Math.random,
  rootCandidateLimit = 24,
  treeCandidateLimit = 12,
  rolloutCandidateLimit = 6,
  rootEvaluationLimit = 40,
  treeEvaluationLimit = 24,
  rolloutEvaluationLimit = 12,
  rolloutDepth = 10,
  rolloutExploration = 0.15,
  exploration = Math.SQRT2,
  valueScale = 4000,
} = {}) {
  const publicState = state.stock?.[opponent(aiPlayer)] === null
    ? structuredClone(state)
    : stateForPlayer(state, aiPlayer);
  const options = {
    rootCandidateLimit,
    treeCandidateLimit,
    rolloutCandidateLimit,
    rootEvaluationLimit,
    treeEvaluationLimit,
    rolloutEvaluationLimit,
    rolloutDepth,
    rolloutExploration,
    exploration,
    valueScale,
  };
  const tree = new Map();
  const rootKey = informationStateKey(sampleInformationSetWorld(publicState, aiPlayer, random), aiPlayer);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let world = sampleInformationSetWorld(publicState, aiPlayer, random);
    const path = [];

    for (let depth = 0; depth < rolloutDepth && !world.winner; depth += 1) {
      const player = decisionPlayer(world);
      const key = informationStateKey(world, player);
      let node = tree.get(key);
      if (!node) {
        node = createNode(world, player, settings, options, random, key === rootKey);
        tree.set(key, node);
      }
      if (!node.actions.size) break;
      const edge = selectEdge(node, player === aiPlayer, exploration);
      path.push({ node, edge });
      const next = applyClonedAction(world, player, edge.action);
      if (!next) break;
      world = next;
      if (edge.visits === 0) break;
    }

    const value = rollout(world, aiPlayer, settings, options, random);
    for (const { node, edge } of path) {
      node.visits += 1;
      edge.visits += 1;
      edge.valueSum += value;
    }
  }

  const root = tree.get(rootKey);
  if (!root?.actions.size) return null;
  const ranked = [...root.actions.values()].sort((a, b) =>
    b.visits - a.visits
    || (b.visits ? b.valueSum / b.visits : -Infinity) - (a.visits ? a.valueSum / a.visits : -Infinity)
    || actionKey(a.action).localeCompare(actionKey(b.action)));
  const selected = ranked[0];
  return {
    action: structuredClone(selected.action),
    visits: selected.visits,
    meanValue: selected.visits ? selected.valueSum / selected.visits : 0,
    iterations,
    nodeCount: tree.size,
    root: ranked.map((edge) => ({
      action: structuredClone(edge.action),
      visits: edge.visits,
      meanValue: edge.visits ? edge.valueSum / edge.visits : 0,
    })),
  };
}
