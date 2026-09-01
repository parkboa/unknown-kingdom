import {
  dispatchAction,
  getLegalActions,
  informationStateKey,
  resampleFromInformationState,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";
import { evaluateState } from "./state-evaluation.js";

function opponent(player) {
  return player === "black" ? "white" : "black";
}

function decisionPlayer(state) {
  return state.pendingSpecial?.owner || state.teleporting?.owner || state.turn;
}

function actionKey(action) {
  if (action.type === "deploy") return `deploy:${action.unitType}:${action.row}:${action.col}`;
  if (action.type === "wizard_teleport") return `wizard_teleport:${action.row}:${action.col}`;
  return action.type;
}

function applyClonedAction(state, player, action, recordInformationHistory = true) {
  const next = structuredClone(state);
  const result = dispatchAction(next, player, action, { recordInformationHistory });
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

function candidatePositionKey(state, player, limit, evaluationLimit) {
  const board = state.board.map((row) => row.map((piece) => piece
    ? `${piece.owner[0]}:${piece.type}:${piece.originalType}:${piece.revealed ? 1 : 0}:${piece.abilityUsed ? 1 : 0}:${piece.kingEscapeUsed ? 1 : 0}`
    : ".").join(",")).join(";");
  return [
    player,
    limit,
    evaluationLimit,
    state.turn,
    JSON.stringify(state.stock),
    JSON.stringify(state.firstDeployDone),
    JSON.stringify(state.deploymentCount),
    JSON.stringify(state.stats),
    JSON.stringify(state.pendingSpecial),
    JSON.stringify(state.teleporting),
    JSON.stringify(state.pendingKingSwap),
    JSON.stringify(state.pendingWizardTeleport),
    JSON.stringify(state.resumeTurn),
    state.winner,
    board,
  ].join("|");
}

function rankedActions(state, player, settings, limit, evaluationLimit, random, cache = null) {
  const cacheKey = cache ? candidatePositionKey(state, player, limit, evaluationLimit) : null;
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);
  const actions = getLegalActions(state, player);
  if (actions.length <= 1) {
    if (cacheKey) cache.set(cacheKey, actions);
    return actions;
  }
  const candidates = prefilterActions(state, player, actions, evaluationLimit, random);
  const ranked = candidates.map((action) => {
    const next = applyClonedAction(state, player, action, false);
    return {
      action,
      value: next ? evaluateState(next, player, settings) : -Infinity,
      jitter: random() * 1e-9,
    };
  });
  ranked.sort((a, b) => b.value - a.value || b.jitter - a.jitter);
  const result = ranked.slice(0, Math.max(1, limit)).map(({ action }) => action);
  if (cacheKey) cache.set(cacheKey, result);
  return result;
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
      options.actionCache,
    );
    if (!actions.length) break;
    const explore = random() < options.rolloutExploration;
    const action = explore ? actions[Math.floor(random() * actions.length)] : actions[0];
    const next = applyClonedAction(current, player, action, false);
    if (!next) break;
    current = next;
  }
  if (current.winner) {
    if (current.winner === "draw") return 0;
    return current.winner === rootPlayer ? 1 : -1;
  }
  return Math.tanh(evaluateState(current, rootPlayer, settings) / options.valueScale);
}

function createNode() {
  return {
    visits: 0,
    actions: new Map(),
  };
}

function lowerTailMean(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const count = Math.max(1, Math.ceil(sorted.length * quantile));
  return sorted.slice(0, count).reduce((sum, value) => sum + value, 0) / count;
}

function hiddenOpponentGroupStones(state, player, action) {
  if (action.type !== "deploy") return [];
  const enemy = opponent(player);
  const queue = [];
  const seen = new Set();
  const hidden = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const row = action.row + dr;
    const col = action.col + dc;
    if (state.board[row]?.[col]?.owner === enemy) queue.push([row, col]);
  }
  while (queue.length) {
    const [row, col] = queue.shift();
    const key = `${row}:${col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const piece = state.board[row]?.[col];
    if (!piece || piece.owner !== enemy) continue;
    if (!piece.revealed && piece.type === "soldier") hidden.push({ row, col });
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (state.board[nextRow]?.[nextCol]?.owner === enemy) queue.push([nextRow, nextCol]);
    }
  }
  if (!hidden.length) return [];
  const probe = structuredClone(state);
  const probeResult = dispatchAction(probe, player, action, {
    advanceTurn: false,
    recordInformationHistory: false,
  });
  if (!probeResult.accepted) return [];
  const remainingIds = new Set(probe.board.flat().filter(Boolean).map(({ id }) => id));
  if (!hidden.some(({ row, col }) => !remainingIds.has(state.board[row][col].id))) return [];
  let king = null;
  for (let row = 0; row < state.board.length && !king; row += 1) {
    const col = state.board[row].findIndex((piece) => piece?.owner === player && piece.type === "king");
    if (col >= 0) king = { row, col };
  }
  return hidden.sort((a, b) => {
    const dangerA = king ? Math.abs(a.row - king.row) + Math.abs(a.col - king.col) : 0;
    const dangerB = king ? Math.abs(b.row - king.row) + Math.abs(b.col - king.col) : 0;
    return dangerA - dangerB || a.row - b.row || a.col - b.col;
  });
}

function hiddenOpponentThreatStones(state, player) {
  let king = null;
  for (let row = 0; row < state.board.length && !king; row += 1) {
    const col = state.board[row].findIndex((piece) => piece?.owner === player && piece.type === "king");
    if (col >= 0) king = { row, col };
  }
  if (!king) return [];
  const enemy = opponent(player);
  const threats = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const row = king.row + dr;
    const col = king.col + dc;
    const piece = state.board[row]?.[col];
    if (piece?.owner === enemy && !piece.revealed && piece.type === "soldier") {
      threats.push({ row, col });
    }
  }
  return threats;
}

function evaluateRootRisks(root, publicState, aiPlayer, settings, options, random, resampleWorld, rootKey) {
  if (options.riskWeight <= 0 || options.riskCandidateLimit <= 0) return false;
  const candidates = [...root.actions.values()]
    .sort((a, b) => b.visits - a.visits)
    .slice(0, options.riskCandidateLimit);
  const specialTypes = ["general", "wizard", "diplomat"];
  for (const edge of candidates) {
    const tacticalStones = [
      ...hiddenOpponentGroupStones(publicState, aiPlayer, edge.action),
      ...hiddenOpponentThreatStones(publicState, aiPlayer),
    ].filter(({ row, col }, index, stones) =>
      stones.findIndex((stone) => stone.row === row && stone.col === col) === index);
    const assignments = tacticalStones
      .flatMap(({ row, col }) => specialTypes.map((type) => ({ row, col, type })))
      .slice(0, options.riskWorldLimit);
    edge.riskValues = [];
    for (const forcedAssignment of assignments) {
      let world;
      try {
        world = resampleWorld(publicState, aiPlayer, random, {
          forcedAssignment,
          specialDeploymentProbability: options.specialDeploymentProbability,
          specialTypeWeights: options.specialTypeWeights,
        });
      } catch (error) {
        if (/Forced hidden-special assignment is inconsistent/.test(error.message)) continue;
        throw error;
      }
      if (informationStateKey(world, aiPlayer) !== rootKey) {
        throw new Error("IS-MCTS risk resampler returned a world outside the root information state");
      }
      const next = applyClonedAction(world, aiPlayer, edge.action, false);
      if (!next) continue;
      edge.riskValues.push(rollout(next, aiPlayer, settings, {
        ...options,
        rolloutDepth: options.riskRolloutDepth,
      }, random));
    }
  }
  return candidates.some((edge) => edge.riskValues?.length);
}

function synchronizeAvailableActions(node, state, player, settings, options, random, root) {
  const limit = root ? options.rootCandidateLimit : options.treeCandidateLimit;
  const evaluationLimit = root ? options.rootEvaluationLimit : options.treeEvaluationLimit;
  const actions = rankedActions(state, player, settings, limit, evaluationLimit, random, options.actionCache);
  const availableKeys = new Set();
  for (const action of actions) {
    const key = actionKey(action);
    availableKeys.add(key);
    let edge = node.actions.get(key);
    if (!edge) {
      edge = { action: structuredClone(action), visits: 0, availability: 0, valueSum: 0 };
      node.actions.set(key, edge);
    }
    edge.availability += 1;
  }
  return availableKeys;
}

function selectEdge(node, availableKeys, maximizing, exploration) {
  const availableEdges = [...availableKeys].map((key) => node.actions.get(key));
  const unvisited = availableEdges.find((edge) => edge.visits === 0);
  if (unvisited) return unvisited;
  let best = null;
  let bestScore = -Infinity;
  for (const edge of availableEdges) {
    const mean = edge.valueSum / edge.visits;
    const exploitation = maximizing ? mean : -mean;
    const score = exploitation + exploration * Math.sqrt(Math.log(edge.availability + 1) / edge.visits);
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
  riskWeight = 0,
  riskQuantile = 0.25,
  riskCandidateLimit = 0,
  riskWorldLimit = 6,
  riskRolloutDepth = 4,
  specialDeploymentProbability = 0.35,
  specialTypeWeights = null,
  resampleWorld = resampleFromInformationState,
} = {}) {
  const publicState = stateForPlayer(state, aiPlayer);
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
    riskWeight: Math.max(0, Math.min(1, riskWeight)),
    riskQuantile: Math.max(Number.EPSILON, Math.min(1, riskQuantile)),
    riskCandidateLimit: Math.max(0, Math.floor(riskCandidateLimit)),
    riskWorldLimit: Math.max(0, Math.floor(riskWorldLimit)),
    riskRolloutDepth: Math.max(1, Math.floor(riskRolloutDepth)),
    specialDeploymentProbability,
    specialTypeWeights,
    actionCache: new Map(),
  };
  const tree = new Map();
  const rootKey = informationStateKey(publicState, aiPlayer);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let world = resampleWorld(publicState, aiPlayer, random, {
      specialDeploymentProbability,
      specialTypeWeights,
    });
    if (informationStateKey(world, aiPlayer) !== rootKey) {
      throw new Error("IS-MCTS resampler returned a world outside the root information state");
    }
    const path = [];

    for (let depth = 0; depth < rolloutDepth && !world.winner; depth += 1) {
      const player = decisionPlayer(world);
      const key = informationStateKey(world, player);
      let node = tree.get(key);
      if (!node) {
        node = createNode();
        tree.set(key, node);
      }
      const availableKeys = synchronizeAvailableActions(
        node,
        world,
        player,
        settings,
        options,
        random,
        key === rootKey,
      );
      if (!availableKeys.size) break;
      const edge = selectEdge(node, availableKeys, player === aiPlayer, exploration);
      const next = applyClonedAction(world, player, edge.action);
      if (!next) break;
      path.push({ node, edge });
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
  const rootRiskEvaluated = evaluateRootRisks(
    root,
    publicState,
    aiPlayer,
    settings,
    options,
    random,
    resampleWorld,
    rootKey,
  );
  const legalRootKeys = new Set(getLegalActions(publicState, aiPlayer).map((action) => actionKey(action)));
  const ranked = [...root.actions.values()].filter((edge) =>
    legalRootKeys.has(actionKey(edge.action))
    && (!rootRiskEvaluated || (edge.riskValues?.length || 0) > 0));
  for (const edge of ranked) {
    const mean = edge.visits ? edge.valueSum / edge.visits : -Infinity;
    edge.cvar = lowerTailMean(edge.riskValues || [], options.riskQuantile);
    edge.selectionScore = edge.cvar === null
      ? mean
      : mean * (1 - options.riskWeight) + edge.cvar * options.riskWeight;
  }
  ranked.sort((a, b) => options.riskWeight > 0
    ? b.selectionScore - a.selectionScore || b.visits - a.visits || actionKey(a.action).localeCompare(actionKey(b.action))
    : b.visits - a.visits
      || b.selectionScore - a.selectionScore
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
      availability: edge.availability,
      meanValue: edge.visits ? edge.valueSum / edge.visits : 0,
      riskSamples: edge.riskValues?.length || 0,
      cvar: edge.cvar,
      selectionScore: edge.selectionScore,
    })),
  };
}
