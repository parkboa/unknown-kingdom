import { applyAction, chooseBotAction, createGameState } from "./engine.js";

const gameCount = Number.parseInt(process.argv[2] || "100", 10);
const maxActions = 250;

function stateSignature(state) {
  const board = state.board
    .map((row) => row.map((piece) => piece
      ? `${piece.owner}:${piece.type}:${piece.abilityUsed ? 1 : 0}`
      : ".").join(","))
    .join(";");
  const stock = ["red", "blue"]
    .map((player) => Object.values(state.stock[player]).join(","))
    .join("|");
  const teleport = state.teleporting
    ? `${state.teleporting.owner}:${state.teleporting.row}:${state.teleporting.col}`
    : "-";
  return `${state.turn}|${board}|${stock}|${teleport}`;
}

function classifyReason(reason) {
  if (/King was captured/i.test(reason)) return "king-capture";
  if (/Board filled/i.test(reason)) return "board-filled";
  if (/no legal deployment/i.test(reason)) return "no-legal-deployment";
  if (/All enemy units were eliminated/i.test(reason)) return "elimination";
  return "other";
}

function simulateGame(index) {
  const state = createGameState();
  const seen = new Map();
  let actions = 0;

  while (!state.winner && actions < maxActions) {
    const signature = stateSignature(state);
    const visits = (seen.get(signature) || 0) + 1;
    seen.set(signature, visits);
    if (visits > 3) {
      return {
        index,
        status: "stalled",
        actions,
        reason: "Repeated game state",
        state,
      };
    }

    const player = state.teleporting?.owner || state.turn;
    const action = chooseBotAction(state, player);
    if (!action) {
      return {
        index,
        status: "stalled",
        actions,
        reason: `No bot action for ${player}`,
        state,
      };
    }
    if (!applyAction(state, player, action)) {
      return {
        index,
        status: "invalid-action",
        actions,
        reason: `${player}: ${JSON.stringify(action)}`,
        state,
      };
    }
    actions += 1;
  }

  if (!state.winner) {
    return {
      index,
      status: "action-limit",
      actions,
      reason: `Exceeded ${maxActions} actions`,
      state,
    };
  }

  return {
    index,
    status: "completed",
    actions,
    winner: state.winner,
    reason: state.resultReason,
    reasonType: classifyReason(state.resultReason),
    redPieces: state.board.flat().filter((piece) => piece?.owner === "red").length,
    bluePieces: state.board.flat().filter((piece) => piece?.owner === "blue").length,
    captures: state.stats.captures,
    specialsUsed: state.stats.specialsUsed,
  };
}

const results = Array.from({ length: gameCount }, (_, index) => simulateGame(index + 1));
const completed = results.filter((result) => result.status === "completed");
const failures = results.filter((result) => result.status !== "completed");
const average = (values) => values.length
  ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
  : 0;
const countBy = (values, key) => Object.fromEntries(
  [...new Set(values.map((value) => value[key]))]
    .sort()
    .map((name) => [name, values.filter((value) => value[key] === name).length]),
);
const winnersByEnding = Object.fromEntries(
  [...new Set(completed.map((result) => result.reasonType))]
    .sort()
    .map((reasonType) => [
      reasonType,
      countBy(completed.filter((result) => result.reasonType === reasonType), "winner"),
    ]),
);
const whiteKomiOutcomes = Object.fromEntries(
  [1, 2, 3, 4].map((komi) => {
    const outcomes = completed.map((result) => {
      if (result.reasonType !== "board-filled") return result.winner;
      const adjustedBlue = result.bluePieces + komi;
      if (result.redPieces === adjustedBlue) return "draw";
      return result.redPieces > adjustedBlue ? "red" : "blue";
    });
    return [komi, countBy(outcomes.map((winner) => ({ winner })), "winner")];
  }),
);

const report = {
  requestedGames: gameCount,
  completedGames: completed.length,
  failedGames: failures.length,
  winners: countBy(completed, "winner"),
  endings: countBy(completed, "reasonType"),
  winnersByEnding,
  whiteKomiOutcomes,
  averageActions: average(completed.map((result) => result.actions)),
  shortestGame: completed.length ? Math.min(...completed.map((result) => result.actions)) : 0,
  longestGame: completed.length ? Math.max(...completed.map((result) => result.actions)) : 0,
  averageFinalPieces: {
    red: average(completed.map((result) => result.redPieces)),
    blue: average(completed.map((result) => result.bluePieces)),
  },
  averageCaptures: {
    red: average(completed.map((result) => result.captures.red)),
    blue: average(completed.map((result) => result.captures.blue)),
  },
  averageSpecialsUsed: {
    red: average(completed.map((result) => result.specialsUsed.red)),
    blue: average(completed.map((result) => result.specialsUsed.blue)),
  },
  failures: failures.map((result) => ({
    game: result.index,
    status: result.status,
    actions: result.actions,
    reason: result.reason,
    turn: result.state.turn,
    teleporting: result.state.teleporting,
  })),
};

console.log(JSON.stringify(report, null, 2));
