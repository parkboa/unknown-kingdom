# Daeguk Game Engine

This package is the canonical rules source shared by the browser prototype, AI analysis, automated tests, and online server.

## Current Stage

The package provides a modular deterministic rules engine and structured domain events. The online server imports the engine through a thin compatibility adapter. Browser PvE, Challenge, and tutorial use shared-engine transitions for deployment, capture, special reactions, Wizard decisions, turn continuation, explicit no-move passing, and match completion.

Engine-created pieces use the state-owned `nextPieceId` sequence. Given equivalent starting states and the same actions, rules transitions now produce equivalent complete states. Simulation on cloned state does not consume IDs from the authoritative state.

## Public API

- `createGameState()`
- `dispatchAction(state, player, action)` → `{ accepted, events }`
- `applyAction(state, player, action)`
- `eventsForPlayer(events, player)`
- `getLegalActions(state, player)`
- `isSuicideDeployment(state, player, type, row, col)`
- `stateForPlayer(state, player)`
- `createGameJournal(initialState, metadata)`
- `dispatchRecordedAction(state, journal, player, action)`
- `replayGameJournal(journal)`
- `stateDigest(state)`
- `serializeGameJournalJsonl(journal, outcome)`
- `parseGameJournalJsonl(jsonl)`

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
- `taunt_used`

Events contain domain data rather than localized messages or UI commands. Before sending events to a client, call `eventsForPlayer`; it masks unrevealed enemy special types with `soldier`, matching `stateForPlayer`.

`stateForPlayer` keeps the viewer's stock, replaces the opponent's stock with `null`, and masks hidden special identities on both board pieces and `lastMove`. The returned view is suitable for clients and information-set AI, but it is not an authoritative state for applying both players' actions.

## Deterministic Journals

`dispatchRecordedAction` stores every attempted action with its ordered domain events and the full-state digest before and after the transition. `replayGameJournal` starts from the embedded initial state and reports the first acceptance, event, or state-digest divergence. Journals contain the authoritative state and must not be sent to an opponent; use player-filtered state and events at the network boundary.

JSONL journals use one `game_start` record, one `action` record per attempted action, and one `game_end` record. `scripts/lib/game-journal-jsonl.mjs` writes these records incrementally so a long-running evaluation retains every completed action even if the process stops early.

`scripts/ai-promotion-gate.mjs` runs candidate-versus-baseline pairs with the same seed and swapped colors. It promotes only when the candidate's Wilson lower confidence bound reaches the configured score threshold, rejects when the upper bound falls below it, and otherwise continues until the maximum pair count.

## AI Evaluation Experiments

`js/state-evaluation.js` is the shared zero-sum state evaluator used by lookahead and search experiments. It scores terminal results, material, captures, King liberties, connectivity, influence, center control, and color-symmetric home position from either player's perspective.

`js/is-mcts.js` is an experimental information-set MCTS implementation. Every iteration resamples a possible hidden-special world, keys tree nodes by the acting player and their visible information state, and uses the shared evaluator for action ordering and rollout values. `experiments/is-mcts-candidate.json` can be passed to the promotion gate with `--candidate-settings`; it is an experiment profile, not a production difficulty preset.

`npm run ai:is-mcts-benchmark` measures fast, balanced, and deep budgets on deterministic opening and hidden-midgame positions. `experiments/is-mcts-tier-budgets.json` records the current proposed five-tier allocation. Expert and Grandmaster IS-MCTS profiles remain disabled in production until they beat their same-tier heuristic baselines through the promotion gate.

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
- `replay.js`: canonical state digests plus action journal recording and verification
- `index.js`: stable public facade only

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
2. Continue calibrating the five browser AI tiers with exact shared-engine transitions.

## Packaging

The engine is installed through the repository's npm workspaces. The authoritative
server lives in `server/`, declares `@daeguk/game-engine` as a dependency, and
imports this package through its public exports. The root lockfile and Render
Blueprint make the engine available from a clean checkout without relying on a
sibling repository path.
