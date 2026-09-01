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
- `informationStateForPlayer(state, player)`
- `informationStateKey(state, player)`
- `resampleFromInformationState(state, player, random)`
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

## Information-Set Contract

`stateForPlayer` is the executable player view used as the base for simulations. New games record each player's own accepted actions and filtered observations in a versioned `informationHistory`; the opponent's private history is removed from player views. `informationStateForPlayer` combines that perfect-recall history with the current observation while removing presentation-only fields such as selection, AI settings, localized logs, and taunt timers. It is intended for information-set comparison and hashing, not action dispatch. `informationStateKey` combines the acting player with the digest of that projection. Legacy journals without `informationHistory` remain replayable and use their original observation-only contract.

`resampleFromInformationState` fills the hidden opponent identities and stock into an executable sampled world. The default sampler constrains the number of possible specials by deployment opportunities, already observed specials, remaining types, and hidden stones. Its special-deployment probability is configurable, and a rule-consistent forced assignment is available for tactical probes. Every sampled world must retain the source information-state key, so an invalid sampler fails at the engine boundary instead of silently contaminating the search tree.

`npm run ai:estimate-hidden-prior` estimates deployment probability and per-type weights from replay journals with Beta/add-one smoothing. The current `experiments/hidden-special-prior.json` is explicitly provisional because it contains only three source games; it must not be treated as a calibrated population model until representative journals replace the loss-only sample.

The experimental IS-MCTS synchronizes each node's action edges with the legal candidate set from every determinization. Each edge tracks how often it was available; selection only considers actions legal in the current sampled world, and unavailable actions receive neither visits nor value. The root result is filtered against the actions legal in the actual root view. Optional root tactical probes force General, Wizard, and Diplomat hypotheses in adjacent hidden groups and combine mean value with lower-tail CVaR. Position-keyed candidate caching avoids repeating expensive rankings across equivalent determinizations.

The historical General and Wizard losses are executable suitability tests in `test/is-mcts-suitability.test.js`. For an independent OpenSpiel 2.0.2 cross-check, install `requirements-open-spiel.txt` in a virtual environment and run:

```sh
python3 -m venv .venv-open-spiel
.venv-open-spiel/bin/python -m pip install -r requirements-open-spiel.txt
OPEN_SPIEL_PYTHON=.venv-open-spiel/bin/python npm run ai:open-spiel-crosscheck
```

The command runs a one-decision imperfect-information tactical model with shared information states and inconsistent legal-action sets, then compares its safe decision with both historical engine scenarios. It writes `experiments/open-spiel-tactical-crosscheck.json`.

## Deterministic Journals

`dispatchRecordedAction` stores every attempted action with its ordered domain events and the full-state digest before and after the transition. `replayGameJournal` starts from the embedded initial state and reports the first acceptance, event, or state-digest divergence. Journals contain the authoritative state and must not be sent to an opponent; use player-filtered state and events at the network boundary.

JSONL journals use one `game_start` record, one `action` record per attempted action, and one `game_end` record. Schema version 2 uses `black` and `white` side IDs. Schema version 1 journals using `red` and `blue` are migrated when parsed and then verified against the current engine; historical source files remain unchanged. `scripts/lib/game-journal-jsonl.mjs` writes records incrementally so a long-running evaluation retains every completed action even if the process stops early.

`scripts/ai-promotion-gate.mjs` runs candidate-versus-baseline pairs with the same seed and swapped colors. It promotes only when the candidate's Wilson lower confidence bound reaches the configured score threshold, rejects when the upper bound falls below it, and otherwise continues until the maximum pair count.

## AI Evaluation Experiments

`js/state-evaluation.js` is the shared zero-sum state evaluator used by lookahead and search experiments. It scores terminal results, material, captures, King liberties, connectivity, influence, center control, and color-symmetric home position from either player's perspective.

The production Expert and Grandmaster heuristic tiers add phase-aware local strategy through `js/strategic-analysis.js`. A phase is opening through 20 completed deployments per side, middle through 40, and endgame thereafter. Both tiers inspect the last four observed opponent deployments. In a relevant local danger hypothesis, the most recent hidden stone is treated as a special with total probability `0.8`, divided across only the General, Wizard, and Diplomat identities still consistent with observations. Immediate King loss remains an absolute veto; otherwise a simultaneous King-versus-strategy conflict is blended with King tactics at `0.9` priority.

Middle- and endgame candidate ordering also classifies an enemy group's liberties by their shortest open route toward the enemy fortress, the AI fortress, or neither. It rewards blocking the enemy-fortress route and, when possible, closing other liberties while preserving the route toward the AI fortress. Expert searches three plies. Grandmaster searches a bounded fourth ply only for the top ranked candidates connected to a recent move, a King, or a wall tactic rather than extending every board action.

Grandmaster treats every unrevealed enemy stone orthogonally adjacent to its King as a `1.0` tactical special hypothesis while any observed-consistent enemy special type remains. It penalizes filling that group's liberties or blocking its shortest open connection to another enemy group: keeping the sacrifice alive prevents its capture reaction from firing. In parallel it rewards moves that reduce the number of empty placements needed to connect the allied King group to its own fortress wall. Once filtered observations show that General, Wizard, and Diplomat have all been revealed or activated, the King-adjacent mine assumption is disabled. These expensive route checks run for root move ordering only; exact engine transitions and the bounded three/four-ply line verify the consequences.

Run `npm run ai:validate-tactics` for the deterministic Grandmaster suitability suite. It checks all three hidden identities through one table-driven scene, preserves the mine's liberty and route to another enemy group, advances the King group toward its own wall, restores ordinary capture after all specials are spent, and rescues a King in atari without detonating an adjacent mine. The command writes `experiments/grandmaster-tactical-validation.json` and exits unsuccessfully if any scene fails.

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
- `information.js`: information-state projections, keys, and hidden-world resampling
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
- `timeout` is a timer-system action, not a player-legal action. It is accepted only for the current player with `{ authoritative: true }` and emits `match_ended` with reason `timeout`.

## Next Migration Steps

1. Add browser-orchestration coverage for Challenge objectives and tutorial progression.
2. Continue calibrating the five browser AI tiers with exact shared-engine transitions.

## Packaging

The engine is installed through the repository's npm workspaces. The authoritative
server lives in `server/`, declares `@daeguk/game-engine` as a dependency, and
imports this package through its public exports. The root lockfile and Render
Blueprint make the engine available from a clean checkout without relying on a
sibling repository path.
