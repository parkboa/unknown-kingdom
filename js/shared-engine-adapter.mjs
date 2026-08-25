import {
  isEnclosedPlacement,
  dispatchAction,
  eventsForPlayer,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";

const SPECIALS = new Set(["general", "diplomat", "wizard"]);

const LOCAL_MODES = new Set(["pve", "puzzle", "tutorial"]);

export function dispatchSharedLocalAction(state, player, action, viewer, options = {}) {
  if (!LOCAL_MODES.has(state?.mode)) return { status: "unsupported", state: null, events: [] };
  const candidate = structuredClone(state);
  const legacyLog = structuredClone(state.log);
  const result = dispatchAction(candidate, player, action, options);
  if (!result.accepted) return { status: "rejected", state: null, events: [] };
  candidate.log = legacyLog;
  return {
    status: "accepted",
    state: candidate,
    events: result.events,
    visibleEvents: eventsForPlayer(result.events, viewer),
  };
}

/**
 * Classifies a placement into a cell that has no liberty of its own.
 *
 * Returns `null` for an ordinary move, `"suicide"` when the unit simply dies, and
 * `"special_detonation"` when a special lands there and fires on the spot — it survives and
 * clears its neighbours, so the plain suicide wording would be untrue.
 *
 * The check runs against the player-filtered state so it cannot leak hidden enemy identities.
 */
export function classifySharedLocalPlacement(state, player, unitType, row, col) {
  if (!LOCAL_MODES.has(state?.mode)) return null;
  const view = stateForPlayer(state, player);
  if (!isEnclosedPlacement(view, player, unitType, row, col)) return null;
  return SPECIALS.has(unitType) ? "special_detonation" : "suicide";
}
