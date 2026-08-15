import {
  dispatchAction,
  eventsForPlayer,
  isSuicideDeployment,
  stateForPlayer,
} from "../packages/game-engine/src/index.js";

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

export function dispatchSharedPveAction(state, player, action, viewer) {
  if (state?.mode !== "pve") return { status: "unsupported", state: null, events: [] };
  return dispatchSharedLocalAction(state, player, action, viewer);
}

export function previewSharedPveDeployment(state, player, unitType, row, col, viewer = player) {
  return dispatchSharedPveAction(state, player, { type: "deploy", unitType, row, col }, viewer);
}

export function isSharedLocalSuicideDeployment(state, player, unitType, row, col) {
  if (!LOCAL_MODES.has(state?.mode)) return false;
  return isSuicideDeployment(stateForPlayer(state, player), player, unitType, row, col);
}

export function isSharedPveSuicideDeployment(state, player, unitType, row, col) {
  if (state?.mode !== "pve") return false;
  return isSharedLocalSuicideDeployment(state, player, unitType, row, col);
}
