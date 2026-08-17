// Stable public facade for the shared authoritative rules engine.
export {
  applyAction,
  dispatchAction,
  getLegalActions,
  isSuicideDeployment,
} from "./actions.js";
export { eventsForPlayer } from "./events.js";
export { createGameState } from "./state.js";
export { stateForPlayer } from "./visibility.js";
export {
  kingLibertyCount,
  canDeploy,
  collectGroup,
  groupHasLiberty,
  wallOwnerForEdge,
  isSpecialLocked,
  isSpecialUnit,
} from "./board.js";
export { orthogonalPositions, opponent } from "./constants.js";

