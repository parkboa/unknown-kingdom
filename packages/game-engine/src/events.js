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

export function recordInformationTransition(state, actor, action, events) {
  const history = state.informationHistory;
  if (!history || history.schemaVersion !== 1) return;
  for (const player of PLAYERS) {
    if (!Array.isArray(history[player])) continue;
    history[player].push({
      actor,
      ownAction: actor === player ? structuredClone(action) : null,
      events: eventsForPlayer(events, player),
    });
  }
}
