import { WHITE_TERRITORY_BONUS, opponent, sideLabel } from "./constants.js";
import { countPieces, hasEmptyCell, hasLegalDeployment } from "./board.js";
import { emitEvent, setTurn } from "./events.js";

export function declareWinner(state, winner, legacyReason, events, reason = "king_captured", details = {}) {
  if (state.winner) return;
  state.winner = winner;
  state.resultReason = legacyReason;
  emitEvent(
    state,
    events,
    { type: "match_ended", winner, reason, ...details },
    `${sideLabel(winner)} wins. ${legacyReason}`,
  );
}

function finishByTerritory(state, prefix, trigger, events) {
  const black = countPieces(state, "black");
  const white = countPieces(state, "white");
  const legacyReason = `${prefix}: Black ${black} - White ${white}.`;
  const details = { trigger, black, white, secondPlayerBonus: WHITE_TERRITORY_BONUS };
  if (black === white) {
    state.winner = "draw";
    state.resultReason = legacyReason;
    emitEvent(state, events, { type: "match_ended", winner: "draw", reason: "territory", ...details });
  } else {
    declareWinner(state, black > white ? "black" : "white", legacyReason, events, "territory", details);
  }
}

export function finishNoLegalDeployment(state, player, events) {
  state.lastMove = { player, action: "pass" };
  emitEvent(
    state,
    events,
    { type: "turn_passed", player, reason: "no_legal_deployment" },
    `${sideLabel(player)} has no legal deployment and passes.`,
  );
  finishByTerritory(state, `${sideLabel(player)} has no legal deployment`, "no_legal_deployment", events);
}

export function startTurn(state, next, events, reason) {
  if (state.winner) return;
  if (!hasEmptyCell(state)) {
    finishByTerritory(state, "Board filled", "board_filled", events);
    return;
  }
  if (countPieces(state, next) === 0 && state.firstDeployDone[next]) {
    declareWinner(
      state,
      opponent(next),
      "All enemy units were eliminated.",
      events,
      "elimination",
      { defeatedPlayer: next },
    );
    return;
  }
  if (!hasLegalDeployment(state, next)) {
    finishByTerritory(state, `${sideLabel(next)} has no legal deployment`, "no_legal_deployment", events);
    return;
  }
  setTurn(state, next, events, reason);
}

export function endTurn(state, events) {
  startTurn(state, opponent(state.turn), events, "action_complete");
}

export function declareResignation(state, player, events) {
  const winner = opponent(player);
  declareWinner(
    state,
    winner,
    `${sideLabel(player)} resigned.`,
    events,
    "resignation",
    { resigningPlayer: player },
  );
}

export function declareTimeout(state, player, events) {
  const winner = opponent(player);
  declareWinner(
    state,
    winner,
    "Time limit exceeded (30s).",
    events,
    "timeout",
    { defeatedPlayer: player },
  );
}
