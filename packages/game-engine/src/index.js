// Stable public facade for the shared authoritative rules engine.
export {
  applyAction,
  dispatchAction,
  getLegalActions,
  isEnclosedPlacement,
  isSuicideDeployment,
} from "./actions.js";
export { eventsForPlayer } from "./events.js";
export { createGameState } from "./state.js";
export { stateForPlayer } from "./visibility.js";
export {
  informationStateForPlayer,
  informationStateKey,
  resampleFromInformationState,
} from "./information.js";
export {
  createGameJournal,
  dispatchRecordedAction,
  gameJournalActionRecord,
  gameJournalEndRecord,
  gameJournalStartRecord,
  parseGameJournalJsonl,
  replayGameJournal,
  serializeGameJournalJsonl,
  stateDigest,
} from "./replay.js";
export {
  activeKingZones,
  boardSignature,
  canDeploy,
  canDeployPosition,
  captureOwners,
  collectGroup,
  countPieces,
  findKingPosition,
  groupHasLiberty,
  hasEmptyCell,
  hasLegalDeployment,
  isOpponentKingSanctuaryOverlap,
  isSpecialLocked,
  isSpecialUnit,
  kingLibertyCount,
  touchesOwnWall,
  wallOwnerForEdge,
} from "./board.js";
export { orthogonalPositions, opponent, inBounds, neighbors, SIZE, DEPLOY_ORDER, PROTOCOL_VERSION } from "./constants.js";
export { declareWinner } from "./victory.js";
