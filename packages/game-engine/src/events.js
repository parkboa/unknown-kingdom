import { PLAYERS, SPECIALS } from "./constants.js";

function addLog(state, message) {
  state.log.push(message);
  state.log = state.log.slice(-40);
}

export function emitEvent(state, events, event, legacyMessage = null) {
  events?.push(event);
  if (legacyMessage) addLog(state, legacyMessage);
}

export function setTurn(state, turn, events, reason) {
  const previousTurn = state.turn;
  state.turn = turn;
  state.selected = null;
  if (previousTurn !== turn) {
    emitEvent(state, events, { type: "turn_changed", from: previousTurn, to: turn, reason });
  }
}

export function eventsForPlayer(events, player) {
  if (!Array.isArray(events) || !PLAYERS.includes(player)) return [];
  return events.map((event) => {
    const view = structuredClone(event);
    if (
      (view.type === "piece_deployed" || view.type === "piece_removed")
      && view.owner !== player
      && view.player !== player
      && SPECIALS.has(view.unitType)
      && !view.revealed
    ) {
      view.unitType = "soldier";
    }
    delete view.revealed;
    return view;
  });
}

