# Test suite map

The 1.0 test suite is organized by responsibility rather than by implementation file.

## Browser application tests

- Root `test/*.test.js`: browser-facing modules, settings, render helpers, journals, and
  compatibility contracts that can run without a browser.
- `test/browser/critical-game-flows.spec.js`: short user-facing behavior paths and release
  regressions.
- `test/browser/challenge-tutorial.spec.js`: the one continuous guided tutorial match. It remains
  an end-to-end scenario because later steps depend on the authoritative state produced by earlier
  steps.
- `test/browser/layout-sweep.spec.js`: overflow and visible-copy checks at supported viewport and
  language combinations. It saves diagnostic screenshots but is not a pixel snapshot comparison.

## Shared engine tests

- `packages/game-engine/test/engine.test.js`: authoritative rules and turn transactions.
- `packages/game-engine/test/events.test.js`, `protocol.test.js`, and
  `information-state.test.js`: domain events, hidden information, and player-view contracts.
- AI test files: deterministic policy contracts and saved regression positions.
- `replay.test.js`: current journal round trips and compatibility boundaries.

## Server tests

- `server/engine.test.js`: server adapter and isolated room actions.
- The protocol v3 migration must add a real two-client WebSocket suite for room creation, joining,
  side assignment, actions, and rematches.

## Naming rules

- `behavior` tests assert what a user or API consumer observes.
- `layout` tests assert geometry, clipping, and overflow without pixel snapshots.
- `regression` tests name the bug or saved position they protect.
- `compatibility` tests name the older schema or protocol input they accept or reject.
- Tests must not scan application source text to prove runtime behavior.
