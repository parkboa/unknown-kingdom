# Daeguk Game Engine

This package is the canonical rules source shared by the browser prototype, AI analysis, automated tests, and online server.

## Current Stage

The package provides a modular deterministic rules engine, structured domain events, and a separate temporary bot policy. The online server imports these modules through a thin compatibility adapter. Browser PvE, Challenge, and tutorial now use shared-engine transitions for deployment, capture, special reactions, Wizard decisions, turn continuation, explicit no-move passing, and match completion.

Engine-created pieces use the state-owned `nextPieceId` sequence. Given equivalent starting states and the same actions, rules transitions now produce equivalent complete states. Simulation on cloned state does not consume IDs from the authoritative state.

The bot remains intentionally stochastic, but all randomness and evaluation policy now live in `src/bot.js` rather than the authoritative rules module.

## Public API

- `createGameState()`
- `dispatchAction(state, player, action)` → `{ accepted, events }`
- `applyAction(state, player, action)`
- `eventsForPlayer(events, player)`
- `getLegalActions(state, player)`
- `isSuicideDeployment(state, player, type, row, col)`
- `stateForPlayer(state, player)`

The temporary bot API is exported separately through `@daeguk/game-engine/bot`:

- `chooseBotAction(state, player)`

`applyAction` remains a compatibility wrapper around `dispatchAction` and returns only the acceptance boolean. Existing `state.log` strings also remain temporarily for the current UI; new consumers should use events and localize them outside the engine.

## Domain Events

An accepted action returns its events in deterministic occurrence order. Rejected actions return an empty event list. Current event types are:

- `piece_deployed`
- `group_captured`
- `piece_removed`
- `pieces_converted`
- `special_revealed`
- `special_activated`
- `wizard_move_required`
- `wizard_moved`
- `wizard_stayed`
- `turn_passed`
- `turn_changed`
- `match_ended`
- `taunt_available`
- `taunt_used`

Events contain domain data rather than localized messages or UI commands. Before sending events to a client, call `eventsForPlayer`; it masks unrevealed enemy special types with `soldier`, matching `stateForPlayer`.

## Internal Modules

- `constants.js`: shared board and unit constants plus coordinate helpers
- `state.js`: initial state and deterministic piece creation
- `board.js`: board queries, groups, liberties, walls, and deployment legality
- `events.js`: event collection, turn events, legacy log bridging, and event visibility
- `victory.js`: turn completion, elimination, territory scoring, and match completion
- `capture.js`: generic group detection and occupation resolution
- `reactions.js`: General, Diplomat, Wizard, and `resumeTurn` reaction flow
- `actions.js`: action dispatch, legal-action enumeration, and suicide simulation
- `visibility.js`: player-specific hidden-information state views
- `index.js`: stable public facade only
- `bot.js`: separate stochastic bot policy

`capture.js` accepts the special-reaction queue function as an injected callback. This keeps generic capture resolution below reaction handling and avoids a circular module dependency.

## Engine Boundary

The completed pure engine must own legal actions, captures, reaction sequencing, Wizard decisions, King defeat, sanctuaries, wall liberties, suicide behavior, victory checks, turn continuation, and player-specific hidden-information views.

It must not depend on DOM APIs, `window`, browser storage, audio, timers, WebSockets, localized UI copy, or server room lifecycle state.

## Action Notes

- `pass` is exposed by `getLegalActions` only when the current player has no legal deployment and no reaction decision is pending.
- Dispatching `pass` emits `turn_passed`, then completes the match by territory with `match_ended`.
- A voluntary pass is not allowed while any legal deployment exists.

## Next Migration Steps

1. Add browser-orchestration coverage for Challenge objectives and tutorial progression.
2. Replace the temporary heuristic browser AI simulation with exact shared-engine transitions.
3. Package the engine through a deploy-safe workspace or dependency boundary.
