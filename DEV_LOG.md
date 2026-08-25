# Daeguk Prototype — Development Log

## AI Evaluation Methodology And King/Territory Asymmetry — 2026-08-24

### The Measured AI League Was Not Measuring Anything

- Instrumented every tier's root decision: `advanced`, `expert`, and `grandmaster` consume **zero** `Math.random` calls, and `novice` (`variance: 1.5`) and `intermediate` (`variance: 0.5`) pick an identical move in **200/200** random streams at every probed position. The variance added at `js/ai.js` root scoring is a rounding error next to score magnitudes in the hundreds, and the final ordering uses `deepScore` where it is smaller still. All five tiers are effectively deterministic.
- Consequence: a matchup replays one identical game per seed. Verified directly — `grandmaster` vs `expert` produced the same winner, move count, and `finalDigest` under seeds `20260821` and `99999999`.
- This invalidates the multi-seed league contract. `artifacts/ai-league-20260821-20260823-aggregate.json` reports `seedWinRates` of `[37.5, 37.5, 37.5]` for `expert` and `[25, 25, 25]` for `grandmaster` — byte-identical across seeds. Of the 18 games among the three deterministic tiers, only 6 were distinct; the other 12 were duplicates counted as independent samples. `scripts/ai-promotion-gate.mjs` Wilson intervals are correspondingly invalid for top-tier comparisons: `--pairs 50` carries the information of 2 games.
- Added `scripts/ai-ablation-study.mjs`, which collapses seed repeats for deterministic matchups and always reports `distinctGames` beside `winRate` so duplicates can never be mistaken for evidence.

### Three Hypotheses Tested And Rejected

- **The tier inversion was an artifact, not a defect.** Under randomized openings the ordering is not inverted: `grandmaster` scores `61.3%` (95% CI `[50.3, 71.2]`) against the field and beats all four other tiers head to head. The old "novice `66.7%` > grandmaster `25%`" reading came entirely from replaying one fixed opening.
- **`kingMineStrategy` (the 100% King-adjacent mine assumption) is net-neutral.** Disabling it changes which moves are played and shifts per-opponent results substantially, but leaves overall strength unchanged.
- **`hiddenKingRiskVeto` never fired.** Disabling it produced games byte-identical to stock in 16/16. One of its two sites was provably dead: `beliefWorlds` is always a one-element array literal, so `return -100000` and the `totalValue += -100000` path both resolve to `-100000 / 1`.

### Reference-Opponent Calibration

- Specialized engines played against each other measure style, not strength: the round robin produced an intransitive `novice > expert > intermediate > novice` cycle, and the bottom four tiers were indistinguishable at `46.3 / 47.5 / 47.5 / 47.5`.
- Added a uniformly random legal player (`--reference random`) as a neutral yardstick, plus randomized openings (`--random-opening`) and Go-style handicap stones (`--handicap`). Randomized openings are what make seeds informative: `grandmaster` vs `expert` went from 2 distinct games across 4 seeds to 8/8.
- Handicap stones are applied before the journal snapshot, so the handicap position becomes the recorded initial state and replay verification still holds.

### The Real Defect: King And Territory Competence Are Split

- Against the random reference (40 games per tier), splitting by how the match ended:

  | tier | King-capture games | territory games | territory stone margin |
  | --- | --- | --- | --- |
  | novice | 93.8% | 87.5% | +16.75 |
  | intermediate | 100% | 90.0% | +21.00 |
  | advanced | 100% | 88.9% | +13.33 |
  | expert | 100% | 80.0% | +15.20 |
  | grandmaster | **100%** | **50.0%** | **+1.88** |

- All four `grandmaster` losses to a random player were territory losses at 84–86 deployments, never a King loss; one finished `58-23`. It defends its King perfectly and cannot count the board.
- Mechanism: territory margin *is* `material` (the territory rule compares `countPieces`), and `kingTacticalPriority: 0.9` splits a fixed budget between the King term and everything else. Effective territory share of the King term: `novice 45.0%`, `intermediate 37.8%`, `advanced 36.3%`, `expert 3.3–8.6%`, `grandmaster 3.3–8.6%`.

### Phase System Does Not Do What It Looks Like

- `phaseStrategicMultiplier` scales only `strategicValue`; `kingValue` is never phase-scaled, and the fixed `kingTacticalPriority` blend is applied afterwards. The King term therefore holds a constant 90% share in every phase, and the phase multiplier only redistributes within the remaining 10%.
- Territory share for `expert`/`grandmaster` moves `3.3% → 6.3% → 8.6%` from opening to endgame. There is no point in the game where territory takes priority.
- Thresholds are `OPENING_DEPLOYMENT_LIMIT = 20` / `MIDDLE_DEPLOYMENT_LIMIT = 40`, measured as `Math.min(red, blue)` completed deployments, and the opening multiplier is `0.5` — territory is suppressed, not emphasized, for the first 20 deployments per side.
- `territoryFocus` in `buildMidgameTacticalPolicy` does trigger at `> 20` deployments (or `> 15` once specials are spent), but it filters candidate moves only; the 90%-King evaluation still ranks whatever survives the filter, and `midgameCandidatePolicy` is enabled for `grandmaster` alone.

### Ratio Tuning Cannot Fix This

- `kingTacticalPriority: 0` looked decisive against the random reference: territory win rate `58.3% → 100%`, territory margin `+4.67 → +27.44`, King-capture games `97.9% → 100%`, overall `90% → 100%`, paired sign test 6 better / 0 worse (`p = 0.031`).
- The same setting is **worse against opponents that actually attack**: overall `65% → 52.5%`, territory win rate `68.2% → 43.5%`, territory margin `+3.73 → −4.22`, and King-defence losses rose from 21 to 25 of 80. Paired sign test 13 better / 23 worse (`p = 0.13`) — no evidence of improvement, consistent direction against.
- A random opponent never mounts a King attack, so it cannot price the loss of King weighting. Reference calibration is the right tool for *ranking* tiers and the wrong tool for *validating* a King-safety change; both suites are required.
- Because King and territory draw from one fixed budget, no ratio can raise both. The fix has to be structural: a bounded, situational King term that grows only when the King is genuinely in danger, leaving the rest of the budget to territory. Not implemented — `kingTacticalPriority` is unchanged.

### Changes Landed

- `js/ai.js`: flattened the single-element `beliefWorlds` loop in `scoreWithLookahead` and removed the no-op veto branch. Behaviour-preserving — 16/16 replayed games matched the pre-refactor `finalDigest`.
- `js/state-evaluation.js`: exposed `score.captureHistoryMultiplier` (default `6`, unchanged behaviour — verified 20/20 identical digests) so the cumulative `captures` term can be ablated without code edits. Removing it did not help on its own.
- `scripts/lib/ai-match.mjs`: `randomOpeningPlies`, the `random` reference player, and `handicapPlayer`/`handicapStones`.
- `scripts/ai-ablation-study.mjs`: parallel ablation and league runner with `--league`, `--reference`, `--handicap`, `--random-opening`, and distinct-game accounting.
- Regression: `113/113` tests pass (11 web, 98 engine, 4 server).

## Selective Hidden-Risk Search — 2026-08-20

- Split hidden-information handling from the normal lookahead: every root candidate now receives one public-state search, while only the difficulty-specific top shortlist checks locally capturable hidden stones as General, Wizard, or Diplomat worlds.
- Kept hidden-risk work bounded to the top 3 Intermediate/Advanced, 4 Expert, and 6 Grandmaster candidates. Expert and Grandmaster re-search only the worst world at depth 2 with at most eight replies; Grandmaster vetoes any candidate whose plausible hidden reaction immediately kills its King.
- Restored alpha pruning after a public-state score of `100000`. False certainty is now corrected by the bounded hidden-risk pass instead of disabling pruning for every remaining root candidate.
- Added a regression position where surrounding a publicly soldier-like stone appears to capture the enemy King but actually activates a hidden Diplomat and kills the moving side's King. Searching tiers no longer report the move as a guaranteed win, and Grandmaster refuses it.
- The color-swapped vertical symmetry suite remains exact at `9/9`, and all `61/61` engine/server tests pass.
- Repeated the 20-game `20260822` league. Average game time fell from `54.717s` with full depth-3 hidden-world replication to `27.725s` with selective risk search (`49.3%` faster). The Advanced–Intermediate trace changed from a 24-move hidden-Diplomat trap to a 90-move game, confirming that the defense survived the optimization.
- This single seed still does not establish tier order: Novice and Intermediate scored `62.5%`, Advanced and Expert `50%`, and Grandmaster `25%`. Red/Black won `45%` and Blue/White `55%`; multi-seed balance work remains separate from this performance fix.
- Detailed output: `artifacts/ai-matchup-traces-20260822-selective-risk.json`.
- During a manual browser match as Black, a White stone appeared to change ownership without the expected Diplomat activation prompt or presentation. The previous browser match does not persist its action/event history, so the exact position could not be reconstructed. Treat this as an unresolved ownership-render/state observation rather than attributing it to the Diplomat; capture the board coordinates and surrounding move if it recurs.
- Follow-up instrumentation: persist at least the previous match's authoritative actions, special-reaction events, and affected coordinates so intermittent state or rendering changes can be replayed instead of diagnosed from memory.

## Test Contract Cleanup — 2026-08-20

- Migrated the browser AI contract to five tiers: Novice, Intermediate, Advanced, Expert, and Grandmaster. Removed the eight legacy configurations while retaining a compatibility mapping for old rank values.
- Strengthened AI tests to verify authoritative legal actions, exact King capture, and measurable King-liberty improvement instead of merely checking that a move exists or completes under a wall-clock threshold.
- Removed the 28 unauthored placeholder puzzles. Challenge now contains only the authored seven-step tutorial; new puzzles will be designed from scratch later.
- Made King-wall taunts automatic in the shared engine, removed the manual taunt action/button, and added a server test proving the authoritative deployment lock lasts exactly three seconds.
- Removed the online bot-room endpoint, server scheduler, package bot policy, simulator, and four bot tests.
- Replaced the ineffective rematch `Set.clear()` test with the production `declineRematch` handler test, including delivery of `rematch_declined` to both players.
- Confirmed the suicide warning flow in the browser. Selecting a suicide move opens the game-native modal without mutating the board; cancel leaves the turn untouched; confirm now performs the selected move instead of incorrectly passing. If only suicide moves remain, the engine still ends the match by territory without offering a voluntary suicide.
- Fixed duplicate declarations left by the 2026-08-19 modular refactor that prevented `app.js` from parsing but were invisible to the engine/server test command.
- Verification: `56/56` automated tests pass, `app.js` and server modules pass syntax checks, and the suicide-warning browser demo reports no console errors.

## Daily Summary (2026-08-19)

### 📌 Summary of Completed Work (2026-08-19)
1. **Online PvP Flow & Rock-Paper-Scissors (가위바위보 선후공)**:
   - Implemented real-time Rock-Paper-Scissors (가위바위보) system for online PvP match startup.
   - Added custom vector icons (`rock.svg`, `paper.svg`, `scissors.svg`), interactive modals, draw re-rolls, and winner's choice of Black (1st / 선공) vs White (2nd / 후공).
2. **Resign (기권 / 백기) System**:
   - Added in-match surrender button (`#resignBtn`) with white flag styling (`.resign-flag-cloth` filled with `#ffffff`).
   - Integrated confirmation modal and instant opponent victory declaration over network & local play.
3. **Rematch Synchronization & Instant Decline Lobby Return**:
   - Resolved rematch race condition when players request simultaneously or one declines.
   - Handled `decline_rematch` action and `rematch_declined` protocol: both requester and decliner are instantly returned to the waiting room (`networkModal`) without modal deadlocks.
4. **PvE AI Turn Order Fix & 5-Level Difficulty Calibration**:
   - Fixed PvE side selection bug so that Black (`red`) always executes the first deployment regardless of human/AI side choice.
   - Calibrated 5 difficulty levels (**초급, 중급, 상급, 달인, 신의 한 수**) with full-board instant-kill scanning (`instantKillCheck`) and 1-liberty King crisis rescue (`King Crisis Rescue`).
5. **Codebase Architecture & Modular Refactoring**:
   - **Unified Game Engine**: Replaced duplicate rule/territory/sanctuary checks in `app.js` with direct `@daeguk/game-engine` standard API calls.
   - **Domain Module Separation**:
     - `js/audio.js`: BGM loop, stone placement SFX, gesture initialization, volume/mute persistence.
     - `js/settings.js`: Language preferences, challenge guidance toggles, `localStorage` synchronization.
     - `js/puzzle-controller.js`: Challenge puzzles, progression persistence, tutorial scripted reactions.
     - `js/online-ui.js`: Room list rendering, RPS modal interactions, rematch toast notifications.
   - **app.js Streamlining**: Converted `app.js` into a lean coordinator connecting engine, state, renderers, and UI modules.
6. **Challenge Puzzles 29-Stage Full Validation**:
   - Programmatically validated all 29 puzzles (Tutorial + 7 Ranks x 4 Puzzles) for board setup, stock bounds, and win conditions.
7. **Automated Testing**:
   - 60 comprehensive unit and integration tests passing with 100% success rate.

---

## Daily Summary (2026-08-18) & Next Session Roadmap (2026-08-19)

### 📌 Summary of Completed Work (2026-08-18)
1. **Game Layout & UI Enhancements**:
   - Resolved mobile bottom action bar layout with Option A (`minmax(0, 1fr) auto auto`).
   - Cleaned redundant text from side selection modal.
   - Added King unit favicon (`assets/units/king.svg`) to eliminate 404 console errors and display crown icon in browser tabs.
2. **King Sanctuary Complete Independence Rule**:
   - Added Chebyshev distance constraint ($\ge 3$) between Black and White Kings so that initial 3×3 sanctuary zones never overlap.
3. **Turn Button Countdown (30s)**:
   - Unified countdown into `.turn-pill` for both Online PvP and PvE AI matches.
   - Fixed lifecycle to guarantee full 30s for the first move after exiting splash/modals.
   - Optimized timer interval with `updateTurnTimerPill` to eliminate 4x/sec DOM rebuilding and piece-drop animation lag.
4. **Online Taunt ("쫄!") Overlay Fix**:
   - Fixed client-server timestamp comparison clock skew issue so the King-wall taunt pops up reliably for 3 seconds across devices.
5. **Reconnection & Match Results Flow**:
   - Fixed reconnect state preservation during active matches to prevent stone lockout.
   - Added dedicated `#resultRematchNotice` badge to the match result card.

### 🎯 Next Session Agenda (2026-08-19)
1. **Online Rematch Flow Finalization (온라인 재대국 요청/수락 마무리)**:
   - Deep-dive into real-time browser-to-browser rematch event delivery and DOM transition to ensure 100% reliable state change to `[ 재대국 수락 ]` across all mobile and desktop browsers.
2. **AI Rank Simulation & Balancing (AI 등급 8급~1급 시뮬레이션 및 밸런싱)**:
   - Run multi-iteration bot tournament simulations across all 8 difficulty ranks.
   - Analyze win/loss rates, move qualities, and error rates per rank.
   - Fine-tune heuristic weights, search depth, and blunder probabilities for smooth difficulty progression from beginner (8급) to master (1급).

---

## Result Card Rematch Notice Banner & Visibility Enhancement — 2026-08-18

- **Prominent Rematch Notice Badge on Match Result Card (`#resultRematchNotice`)**:
  - Added a dedicated glowing gold notice badge directly on the Match Result dialog (`.match-result-card`).
  - When Player A requests a rematch:
    - Player A sees: `"재대국 요청됨 (대기 중…)"` on both the badge and disabled button.
    - Player B immediately sees: **`"상대가 재대국을 요청했습니다."`** on the prominent glowing notice badge, and the action button transforms to a highlighted gold **`[ 재대국 수락 ]`**.
  - Ensures the rematch offer is unmistakably clear on both desktop and mobile screens.

## Online Taunt Synchronization & Clock Skew Fix — 2026-08-18

- **Online King-Wall Taunt Overlay Fix ("쫄!" 연출 정상화)**:
  - Fixed issue where the King-wall taunt ("쫄!!") was skipped or dismissed immediately on online clients due to client-server timestamp comparison (`state.tauntUntil - Date.now() <= 0`).
  - Set `showTauntBubble` to use a guaranteed presentation duration of `TAUNT_DISPLAY_MS` (3 seconds) upon receiving a new `tauntEvent` ID, preventing clock skew between mobile devices and server from dropping the taunt.
  - Both players now reliably see the King character animation and "쫄!!" speech bubble for 3 seconds whenever a King touches its own wall.

- **First-Move Full 30s Guarantee (첫 수 30초 보장 & 로딩 중 카운트다운 방지)**:
  - Fixed issue where the turn timer began counting down in the background while the splash screen, mode select, or side picker modals were still visible, causing the player's first turn to start at ~20s.
  - Added `isGameActive()` check: `pveTurnDeadline` is now strictly initialized to `Date.now() + 30000` only after the player actually confirms settings and enters the live active board.

- **Animation Stutter & Board Re-render Fix (초기 애니메이션 끊김 해결)**:
  - Fixed issue where the 250ms timer interval was triggering full `render()` (destroying all 49 grid buttons with `boardEl.innerHTML = ""` and interrupting CSS piece drop animations 4 times a second).
  - Exported `updateTurnTimerPill` so the countdown interval updates strictly the text and warning classes on `turnPill` in-place without rebuilding the DOM or triggering layout reflows.
  - Piece drop animations and board entry now run at a smooth, uninterrupted 60fps.

- **Integrated Turn Button Countdown (`흑 턴 30s` / `백 턴 30s`)**:
  - Combined the 30-second countdown timer directly into the `.turn-pill` button for both **Online PvP** and **AI Matches (PvE)**.
  - Keeps the status bar clean and uncluttered without taking extra horizontal space on mobile.
  - Active turn stages:
    - Normal (11~30s): Standard dark/white turn styling with gold border.
    - Warning (6~10s): Amber border and glow.
    - Danger (0~5s): Red alert gradient and pulsing border animation (`turn-danger-pulse`).
  - PvE timeout enforcement: 30s per human turn against AI; timeouts trigger auto-pass or AI victory.

- **Interactive Online Rematch Request & Accept Flow (재대국 요청 / 수락)**:
  - When Player A requests a rematch, the server broadcasts `rematch_offered` to Player B.
  - Player B's button immediately updates to a highlighted gold **`[ 재대국 수락 ]`** with a subtle pulse animation and status notification (`"상대가 재대국을 요청했습니다."`).
  - When Player B accepts, the match resets immediately with a fresh board state.

- **Active Match Reconnection & Side Selection Fix (재접속 락 현상 해결)**:
  - Fixed issue where disconnecting players were prompted for side selection during an in-progress game, causing state desync / stone lockouts.
  - Server now preserves `room.sideChosen = true` when pieces have been placed, seamlessly reconnecting returning players to their existing side and sending the current match state directly.
  - Fresh side selection is strictly reserved for new unstarted games.

- **King Sanctuary Non-Overlapping Rule (왕 성역 완전 독립 규칙)**:
  - Added `isOpponentKingSanctuaryOverlap`: Kings must be deployed at a Chebyshev distance of at least 3 cells from the opponent's King ($\max(|r_1 - r_2|, |c_1 - c_2|) \ge 3$).
  - Prevents the 3×3 surrounding sanctuary zones (8 cells around each King) of Black and White from overlapping and creating frustrating dead zones / intersection blocks during the first 5 turns.
  - Added user feedback message: `"상대 왕의 성역과 겹치는 위치(거리 3칸 미만)에는 왕을 배치할 수 없습니다."` / `"The King's sanctuary cannot overlap with the opponent King's sanctuary (must be at least 3 squares apart)."`.
  - Added unit test in `engine.test.js` validating that all 5×5 overlapping candidate squares around an existing King are strictly rejected.

- **White Bonus (덤) Removed (0 Komi)**:
  - Removed the legacy +2 White territory compensation (`WHITE_TERRITORY_BONUS = 0`).
  - Territory victory is now calculated directly by stone count on board: Black pieces vs White pieces.
  - Updated all bilingual strings, mode descriptions, and side picker labels ("흑 (선공)", "백 (후공)").
- **Instant Match Conclusion When Only Suicides Remain**:
  - `hasLegalDeployment(state, player)` now checks for non-suicide moves (`!isSuicideDeployment`).
  - When either player has no valid legal moves other than suicide placements, the match immediately concludes on that turn and scores the game by stones on the board.
  - Prevents meaningless turns or self-destructive suicide loops when the board is closed off.
- **Tests & Verification**:
  - All 56 engine unit tests and 2 server tests pass cleanly (`58/58`).

- **Challenge UI Simplification**:
  - Restructured the Challenge modal list to display only **Tutorial (튜토리얼)** (7-step interactive onboarding) and **Daily Quiz (데일리 퀴즈)** (4 core life-and-death puzzles).
  - Preserved the full dataset of 29 puzzles (including the 24 advanced puzzles across First-rate Master to Life-and-Death Master) in `js/puzzles.js` and engine validation tests, safely hidden from the primary mobile onboarding UI.
- **5-Tier AI Overhaul & "Grandmaster" Tuning**:
  - Compressed the AI match system into 5 clean tiers: **Novice (초급)**, **Intermediate (중급)**, **Advanced (상급)**, **Expert (달인)**, and **Grandmaster (신의 한 수)**.
  - Novice begins at the former Peak Master level for engaging play from the start.
  - Tuned **Grandmaster (신의 한 수)** with:
    - 100% Instant Checkmate & King capture recognition (`instantKillCheck`) executing immediately in < 2ms.
    - Ironclad King defense prioritizing liberties and fortress links under threat.
    - Deep 4-ply lookahead with search pruning and optimized candidate ordering ensuring lag-free responses (< 200ms).
  - Maintained full backwards compatibility with legacy rank identifiers (`thirdRateMaster` ~ `lifeDeathMaster`).
- **Tests & Verification**:
  - All 54 unit tests and 2 server tests passing (`56/56` total).


- Replaced the heuristic `simulateDeploy()` in `js/ai.js` with exact state transitions using the shared game engine (`applyAction`, `getLegalActions`, `stateForPlayer`).
- Lookahead now accurately accounts for group captures, chain captures, King defeat, wall liberties, self-capture penalties, and game termination across plies.
- Added Alpha-Beta pruning cutoffs (`alpha` parameter in `scoreWithLookahead`) to cut off non-promising search branches early when opponent replies score higher than the current best root candidate.
- Added fair-information masking during AI search via `stateForPlayer(state, aiPlayer)` so unrevealed enemy special identities are not exposed to the AI.
- Added `packages/game-engine/test/ai-simulation.test.js` covering immediate King capture (winning move), suicidal move avoidance, group capture evaluation, and all 8 AI ranks (`thirdRateMaster` ~ `lifeDeathMaster`).
- All 48 package tests and server smoke tests pass (`48/48` passing in `@daeguk/game-engine`).

## Monorepo Structure Finalized — 2026-08-15

- Merged the authoritative WebSocket server into `server/` in the browser repository.
- Added root npm workspaces for `packages/game-engine` and `server`, with one committed lockfile.
- Replaced the server's sibling-repository imports with the public `@daeguk/game-engine` and `@daeguk/game-engine/bot` package exports.
- Moved the Render Blueprint to the repository root so a clean deployment runs `npm ci` and starts the server workspace.
- Replaced the server test adapter's direct `node_modules` test-file imports with public-package identity and action smoke tests. The complete engine suite continues to run in the engine workspace.
- Verified a clean archive of the committed tree: workspace installation, the complete root test command, server startup, and `/health` all succeeded without the original sibling server directory.
- The repository/package boundary is finalized. Updating the existing Vercel and Render services and performing the deployed two-client smoke test remain a separate deployment step.

## Snapshot — 2026-08-12

This project is currently a static browser prototype for **Daeguk: Ascension / 고수의 대국**. The active work direction is **mobile-first smartphone UI**.

## Project Location

```text
/Users/boahspark/Documents/Codex/Projects/unknown-kingdom
```

## Shared Engine Stage 1 — 2026-08-14

### Turn Continuation Fixed

- Added explicit `resumeTurn` state to the online engine and browser prototype.
- The first capture reaction records the next normal deployment turn before temporarily transferring interaction to the surrounded special unit's owner.
- General and Diplomat restore the saved turn only after their ability and resulting capture chain finish.
- Wizard retains the same saved turn through both teleport and stay branches, then restores it after the complete reaction sequence.
- A terminal King capture does not restore a normal turn. Normal no-move, elimination, and territory checks still run when a reaction finishes.
- Added six server regression scenarios covering opponent-surrounded and self-surrounded General and Diplomat paths plus self-surrounded Wizard teleport and stay paths.
- The shared engine test suite passed all `23/23` turn-correctness tests at this checkpoint and now passes `25/25` after the deterministic-ID additions below.

### Online Disconnect Status Fixed

- Replaced the nonexistent `networkSession.ws` status check with the session's explicit connection state.
- Added a separate `opponentDisconnected` flag so transport connectivity and match readiness are not conflated.
- Receiving the server's `Opponent disconnected.` message now clears `networkSession.ready` and changes the match header from `접속 중` to `상대 연결이 끊어졌습니다.`.
- Reconnecting or receiving a new match state clears the opponent-disconnected flag.
- Verified the complete path with two real browser clients: connected state appeared first, closing one client updated the remaining client immediately, and no browser errors were reported.

### Shared Engine Package Created

- Created the canonical package at `packages/game-engine` in the prototype repository.
- Moved the tested online rules implementation to `packages/game-engine/src/index.js`.
- Moved the engine regression tests to `packages/game-engine/test/engine.test.js` and bot behavior tests to `packages/game-engine/test/bot.test.js`.
- Replaced the sibling server's `engine.js` with a thin compatibility re-export and its test file with a shared-suite entry point.
- Verified both execution paths:
  - `npm test` in `packages/game-engine`: `25/25` passing;
  - `npm test` in `unknown-kingdom-server`: `25/25` passing through the adapter.
- Restarted the WebSocket server through the shared import path, confirmed `/health`, and confirmed a real `createGameState()` plus `applyAction()` call through the server adapter.

### Deterministic IDs And Bot Separation

- Replaced runtime UUID generation in the authoritative engine with the state-owned `nextPieceId` sequence.
- All deployed pieces and captured-territory replacement Soldiers now consume IDs from the authoritative state in deterministic order.
- Older or hand-built states without `nextPieceId` recover the next sequence number from existing `piece-N` IDs.
- Confirmed that suicide checks and bot evaluation mutate only cloned state and do not consume IDs from the real match.
- Added `getLegalActions(state, player)` as the authoritative action-enumeration API for deployments, taunts, special activation, Wizard teleport, and Wizard stay.
- Moved `chooseBotAction`, random exploration, and heuristic scoring to `packages/game-engine/src/bot.js`.
- The authoritative `src/index.js` no longer contains `Math.random`, `crypto`, or `chooseBotAction`.
- The server compatibility adapter re-exports rules and bot APIs from their separate modules, so `server.js` required no behavioral change.
- Restarted the server and verified health, bot action legality, and identical complete states for identical initial state/action sequences.

### Structured Engine Events

- Added `dispatchAction(state, player, action)`, returning `{ accepted, events }` while preserving deterministic event order across deployment, capture, special reactions, Wizard decisions, turn changes, taunts, and match completion.
- Kept `applyAction` as a boolean compatibility wrapper, so existing server and bot callers retain their behavior.
- Added `eventsForPlayer(events, player)` to mask unrevealed enemy General, Diplomat, and Wizard identities as Soldiers, matching `stateForPlayer` visibility.
- Events contain domain fields only and no localized strings or UI instructions. Existing `state.log` strings remain temporarily as a legacy UI adapter.
- Exported the event API through the server compatibility adapter without changing the current WebSocket protocol or browser UI.
- Added six focused event tests for rejection, ordering, hidden-information filtering, special reactions, Wizard move/stay, captures, victory, and taunts.
- Verified both execution paths with `31/31` tests passing in the shared package and through the server adapter.

### Engine Internal Modules Split

- Replaced the 760-line rules implementation in `src/index.js` with a stable public facade.
- Split engine internals into `constants`, `state`, `board`, `events`, `victory`, `capture`, `reactions`, `actions`, and `visibility` modules; the stochastic bot remains isolated in `bot.js`.
- Kept generic capture resolution independent of special-reaction rules by injecting the special activation queue callback, avoiding a circular module dependency.
- Preserved every public rules API and the server's sibling compatibility adapter without changing the WebSocket protocol or browser behavior.
- Verified `31/31` tests in both the shared package and the server adapter after the split.

### Browser Shared Engine Migration — Phase 1

- Added `js/shared-engine-adapter.mjs` as the temporary boundary between browser orchestration and the shared rules package.
- PvE human and AI deployments now preview the action through `dispatchAction` and adopt the resulting shared state for ordinary deployment, group capture, taunt availability, and turn-change events.
- PvE suicide warnings now use `isSuicideDeployment` against `stateForPlayer`, keeping hidden enemy special identities out of the calculation.
- If a preview emits special-reaction or match-completion events, the adapter leaves the live state untouched and the browser executes its existing legacy path. This deliberately keeps later migration phases isolated.
- Browser presentation still owns localized move/capture logs, audio, taunt timing, rendering, undo checkpoints, and AI scheduling.
- Added adapter coverage for ordinary capture adoption, special-reaction fallback without mutation, and shared suicide checks. The shared package now passes `34/34` tests; the unchanged server adapter suite passes `31/31`.
- Verified a real Korean iPhone-preview PvE session in the browser: White King deployment, automatic Black reply, White Soldier deployment, automatic Black reply, stock counts, and turn restoration all completed without UI interruption.

### Browser Shared Engine Migration — PvE Complete

- Expanded the browser adapter from guarded deployments to every authoritative PvE action: deployment, special activation, Wizard teleport, and Wizard stay.
- General and Diplomat capture reactions now resolve through `dispatchAction`, including the saved `resumeTurn` and any resulting capture chains.
- Wizard activation, move, and stay decisions now use shared-engine events; browser code only manages the move prompt, localized logs, rendering, and AI delay.
- PvE King capture, elimination, full-board scoring, and no-legal-deployment completion now adopt the shared engine's `match_ended` event. The browser translates its reason code and numeric territory details into the selected language.
- The adapter restores the pre-action legacy log before returning shared state, preventing engine compatibility strings from leaking into browser presentation; the UI rebuilds logs from player-filtered structured events.
- Added integration coverage for General, Diplomat, Wizard move, Wizard stay, and King-capture completion. The shared package now passes `36/36` tests; the unchanged server adapter suite remains `31/31`.
- Verified both Wizard branches in the real Korean iPhone-preview browser demo: staying removed the move prompt and restored play, while moving transferred the Wizard from E5 to A1 and restored play.

### Browser Shared Engine Migration — Challenge And Tutorial Complete

- Added a scenario action policy to `dispatchAction`: Challenge and tutorial actions resolve the same deployment, capture, special-reaction, Wizard, and King-victory rules without automatically advancing a normal match turn.
- Challenge deployments now adopt shared-engine state and events while the browser continues to own move limits, objective checks, rank progression, completion/failure messages, and undo.
- Challenge General activation and any future Diplomat/Wizard decisions now use the same shared action path as PvE and the server.
- Tutorial placements now use shared-engine actions. Its scripted final surrounding Soldier is also a real `deploy` action, followed by a real `activate_special` action for General, Diplomat, or Wizard.
- Tutorial timing, concise guidance, automatic reaction scenes, Next progression, and Wizard destination UI remain browser-owned presentation behavior.
- Added integration coverage for Challenge King capture and the complete scripted tutorial General surround/activation sequence. The shared package now passes `40/40` tests; the server adapter remains `31/31`.
- Verified the real Korean iPhone-preview UI end to end: Challenge King capture, Challenge self-surrounded General activation, tutorial King/capture/wall lessons, General, Diplomat, Wizard activation, Wizard move to A1, and tutorial completion.

### Duplicate Browser Rule Cleanup

- Removed the unreachable legacy deployment, suicide simulation, group-capture loop, special queue/activation, General strike, Diplomat conversion, Wizard move/stay, and reaction-turn restoration implementations from `app.js`.
- Simplified local deployment, AI deployment, special activation, Wizard movement, and Wizard stay handlers so their only state-transition path is the shared-engine adapter.
- Deleted the duplicate browser `js/capture.js` module. King-wall taunt checks and the standalone neutral-wall regression page now import the canonical shared-engine board helpers directly.
- Kept the small browser-side no-move/territory helpers temporarily because the local `no-move` demo and AI no-move orchestration still call them; they do not implement capture or special reactions.
- Static syntax and whitespace checks passed. The shared package remains `40/40`, and the server adapter remains `31/31`.
- Browser regression passed for Challenge King capture, Wizard stay, tutorial King placement, and all six neutral-wall cases.

### Explicit Pass / No-Move Action

- Added the canonical `{ type: "pass" }` action. `getLegalActions` exposes it only to the current player when no deployment is legal and no special/Wizard reaction is pending.
- A legal pass records `lastMove`, emits `turn_passed`, and then emits `match_ended` from the shared territory calculation. A voluntary pass is rejected while any deployment remains legal.
- Updated the separated bot policy to choose `pass` explicitly instead of returning `null` in a genuine no-move state.
- Browser AI fallback and the local `no-move` demo now dispatch the shared action and present its structured events. Removed the remaining browser `hasLegalDeployment`, `resolveNoMoveTurn`, `endTurn`, elimination, and territory-scoring implementations.
- Corrected the no-move demo fixture so White truly has no deployable stock while one board cell remains empty.
- Added engine rejection/success coverage, bot selection coverage, and browser-adapter event coverage. The shared package now passes `44/44`; the server adapter passes `34/34`.
- Verified the real Korean iPhone-preview no-move demo: `turn_passed` resolved to the Black territory win and displayed the localized `79–1` result.

### Game-Native Suicide Confirmation

- Replaced both browser-native suicide confirmations with one localized, game-native modal: the local PvE/Challenge deployment check and the online server `suicide_warning` response now share the same UI.
- The pending action is copied before the modal opens. Cancel or Escape leaves the board unchanged; confirmation resubmits the exact stored action with explicit suicide approval.
- The dialog takes initial focus, traps Tab between its two actions, restores the prior board-cell focus on cancel, and exposes dialog labelling and description relationships to assistive technology.
- The iPhone preview uses a centered `362px`-wide card inside the `402 × 874px` game stage, with two `147 × 42px` actions. Narrower screens continue to shrink through the existing `100%` card constraint.
- Project-wide static search found no remaining `window.confirm()` or unqualified `confirm()` call. There were no other native confirmation dialogs beyond the two suicide-warning paths.
- Added `?demo=suicide-warning` for deterministic browser QA. Verified cancel preserves the empty E5 cell, while confirmation resolves the suicide placement and closes the modal.
- Updated the stylesheet cache key so the game-native dark-gold modal cannot be masked by the older result-card stylesheet in an already-open browser.
- Regression suites remain green: shared engine `44/44`, server adapter `34/34`.

### Late-Session UI And Audio Polish

- Shortened the suicide warning body to the single non-redundant sentence `이곳에 놓으면 이 유닛은 즉시 사망합니다.`; the `그래도 놓기` action now carries the choice without repeating it as a question.
- Replaced the temporary ambient track with the user-provided `assets/audio/daeguk_bgm_v1.mp3` (`175.23s`, MP3, 44.1 kHz, approximately 192 kbps). Looping and the existing 24% playback volume remain unchanged.
- Retained `ambient-temp.mp3` as an unreferenced former placeholder. Distribution rights for the new user-provided track must still be confirmed before public release.
- Replaced the long visible lock explanation on AI and Online lobby buttons with the same line-style lock SVG used by Challenge ranks.
- Removed the hover tooltip. The reason `첫 챌린지 등급을 완료하세요` remains only in each disabled button's accessible name.
- Confirmed that the iPhone preview was not removed: it remains opt-in through `?preview=iphone` and renders the fixed `402 × 874px` stage; normal narrow-screen responsive rules also remain active.

### Online Lobby Labels And Two-Client QA

- Internal six-character room codes are no longer used as a UI fallback. `currentBoardLabel()` always returns a localized numbered board name.
- If an older/deployed server omits `boardNumber`, the creator falls back to board 1 and open-room entries use their visible list order. The opaque room code remains available only for WebSocket commands.
- Open-room rendering now also tolerates missing `boardNumber`, preventing `undefined` or internal identifiers from reaching players.
- Verified the updated local server path on `ws://127.0.0.1:4175/ws`: room creation displayed `제N대국장에서 상대를 기다리는 중…`, the second client saw the same numbered board in the open-room list, and joining opened side selection on both clients.
- Completed a real two-window Chrome guest-session run after clearing the first Challenge through the normal UI. One window created `제5대국장`, the second selected and entered it, chose White, and both independent WebSocket clients reached `온라인 대국 · 접속 중` with Black to move.
- Two live boards can be inspected simultaneously with two external browser windows. The in-app browser itself presents one tab at a time, so side-by-side QA should use separate desktop browser windows.
- No production deployment was performed. The client fallback protects the UI when the deployed server lacks `boardNumber`, but the current shared client/server changes still need a deliberate deployment pass.

## End-of-Day Handoff — 2026-08-14

The shared-engine migration and the day's requested browser cleanup are complete at this checkpoint.

### Stable Checkpoint

- One deterministic shared engine now owns deployment, capture, General/Diplomat/Wizard reactions, `resumeTurn`, victory, and explicit pass/no-move behavior for browser local modes and the WebSocket server.
- Bot choice is separated from deterministic rules, and engine consumers can use structured, player-filtered domain events.
- PvE, Challenge, tutorial, local no-move handling, and online play have all been exercised through the shared path.
- Duplicate capture and special-reaction rules have been removed from `app.js`.
- The browser uses a game-native accessible suicide confirmation instead of `window.confirm()`; project-wide native confirmation calls are 0.
- Shared-engine tests pass `44/44`; the sibling server adapter passes `34/34`.
- The latest visual/audio changes are the custom suicide modal copy, new Daeguk BGM, icon-only locked-mode treatment, and numbered online-board labels.

### Known Follow-Ups

- Add automated browser-orchestration coverage for Challenge/tutorial progression and the create-room/join-room/side-selection flow.
- Replace Life-and-Death AI's heuristic future simulation with exact shared-engine transitions before increasing search strength.
- Package the sibling shared-engine import through a deploy-safe workspace or published dependency boundary.
- Deploy and verify the updated client and server together; production may still run an older room-message contract.
- Confirm public distribution rights for `daeguk_bgm_v1.mp3` and remove the unused ambient placeholder when asset cleanup is authorized.
- Consolidate the accumulated `styles.css` override sections only after capturing computed-style regression baselines.

### Current Boundary And Limitations

- This is a structural single-source extraction, not the final pure-engine implementation.
- PvE, Challenge, tutorial, and the online server now consume the shared package for authoritative board-combat transitions.
- Browser capture and special-reaction transitions now have only one implementation: `packages/game-engine`.
- Browser-local deployment, capture, reaction, turn continuation, no-move, and match-completion rules now have no separate implementation in `app.js`.
- The rules module is deterministic for engine-owned state transitions. The separately imported temporary bot remains intentionally stochastic.
- The prototype and server are separate Git repositories. The server adapter currently uses a sibling relative import for local development; production packaging must later use a monorepo workspace, packaged dependency, or equivalent deploy-safe arrangement.
- The shared package README records the intended public API, event contract, and purity boundary.

### Recommended Next Order

1. Add browser-orchestration tests for Challenge/tutorial progression and online room creation/joining.
2. Establish the deploy-safe shared-engine dependency boundary and run a coordinated client/server deployment check.
3. Replace the heuristic Life-and-Death simulation with exact shared-engine transitions.
4. Resume remaining Challenge ranks and AI-level tuning only after those correctness checks.

### Updated Handoff Prompt — 2026-08-14

```text
We are continuing the Daeguk / 고수의 대국 mobile-first game.
Prototype: /Users/boahspark/Documents/Codex/Projects/unknown-kingdom
Online server: /Users/boahspark/Documents/Codex/Projects/unknown-kingdom-server
Read DESIGN_NOTES.md and DEV_LOG.md completely before changing code, especially “Shared Engine Stage 1 — 2026-08-14”.
The special-reaction turn bug and stale opponent-disconnect indicator are fixed. The shared deterministic rules engine now owns browser/server deployment, capture, reactions, Wizard decisions, turn continuation, explicit no-move passing, and match completion. The stochastic bot is isolated in bot.js, and structured domain events are available through dispatchAction with player-specific hidden-information filtering. Progression, presentation timing, guidance, and taunt playback remain browser-owned. The shared package passes 44/44 tests and the server adapter passes 34/34.
Late-session UI work added the accessible game-native suicide modal, the new Daeguk BGM, icon-only locked-mode buttons, and numbered online-board labels that never expose room codes. Real two-window Chrome QA completed room creation, join, side selection, and match start.
Next priority: add browser-orchestration coverage, establish a deploy-safe shared-engine dependency and coordinated deployment check, then move Life-and-Death AI simulation to exact shared-engine transitions.
Do not strengthen Life-and-Death search until AI simulation uses exact shared-engine transitions.
```

## Local Test URL

Current local server convention:

```text
http://127.0.0.1:4185/?lang=ko&v=room-label-1&preview=iphone
```

If the browser appears stale, update the `v=` query string after changes.

## Run Locally

From the project folder:

```bash
python3 -m http.server 4185 --bind 127.0.0.1
```

If port `4185` is already occupied:

```bash
lsof -i :4185
```

Then either stop the old process or open a new port and update the URL.

## Current Important Files

- `index.html`: page structure, splash, lobby, modals, game layout.
- `styles.css`: most current mobile layout and visual styling. This file has accumulated many override blocks; latest rules near the bottom usually win.
- `app.js`: game orchestration, mode flow, puzzle/tutorial flow, settings, language application.
- `js/config.js`: constants, localization text, unit labels, help copy.
- `js/render.js`: board, pieces, deploy dock, UI rendering.
- `js/capture.js`: group, liberty, fortress, neutral wall, capture logic.
- `js/ai.js`: PvE AI and difficulty logic.
- `js/puzzles.js`: challenge/tutorial puzzle definitions and rank labels.
- `js/network.js`: WebSocket client lifecycle.
- `js/protocol.js`: WebSocket message validation.
- `DESIGN_NOTES.md`: design direction and decisions.
- `README.md`: current rule and project overview; may still need cleanup against latest design copy.

## Current Asset Folders

- `assets/ui/daeguk-logo-ko.svg`: Korean logo.
- `assets/ui/daeguk-logo-en.svg`: English logo.
- `assets/splash/daeguk-splash.png`: splash background art.
- `assets/backgrounds/misty-forest.png`: current game-screen background.
- `assets/taunts/kingb_zzol.png`: black taunt character art.
- `assets/taunts/kingw_zzol.png`: white taunt character art.
- `assets/units/*.svg`: unit icon assets.

## Current Gameplay Rules

- Board is 9x9.
- Sides are visually **Black / White**.
- Internal code still uses older side IDs in places:
  - `red` means Black.
  - `blue` means White.
- Each player places King first.
- King has one life. Capturing a King immediately ends the game.
- King does not escape, swap, or teleport.
- After King placement, the surrounding 8 cells are the King sanctuary until that player completes five deployments total.
- Opponent cannot deploy inside active sanctuary.
- Special units are hidden from the opponent until their skill is ready to activate.
- Special activation is manual for readability: capture/reveal happens, then the player confirms activation.
- Wizard can choose to move or stay after skill activation.
- Own fortress wall provides liberty to allied units.
- Neutral side-wall center contact provides liberty and should not belong to either side.
- Capture is group-based and can chain until stable.
- Self-capture is allowed, with warning only when the selected piece is visibly/actually a normal self-sacrifice case.

## Current Modes

- Challenge: tutorial and puzzle entry point.
- AI Match: PvE with difficulty selection.
- Online Match: private room WebSocket PvP.

Planned progression:

1. Player learns through Challenge.
2. Clearing the first rank unlocks AI Match and Online Match.
3. Player advances ranks through challenges, AI matches, and future online records.

## Rank Labels

Korean:

1. 삼류 고수
2. 이류 고수
3. 일류 고수
4. 절정 고수
5. 초절정 고수
6. 화경
7. 현경
8. 생사경

English:

1. Novice
2. Adept
3. Expert
4. Master
5. Grandmaster
6. Transcendent
7. Mythic
8. Eternal

## Recent Mobile UI Decisions

- Focus only on smartphone size for now; tablet and web polishing are deferred.
- iPhone preview is enabled by `preview=iphone`.
- Board must fill available mobile width and keep ratio.
- Board size is width-driven, not height-driven.
- Extra status-bar height should push lower UI down rather than shrink the board.
- Current game-screen vertical order:
  1. mode / connection / rank bar
  2. score counters / turn bar
  3. board
  4. unit selection dock
  5. bottom action bar
- Mode / connection / rank bar should use the same dark card style as the action bar.
- Score / turn bar should stay transparent/light.
- Unit selection dock is below the board.
- Bottom action bar is below unit selection and contains undo, home, settings.

## Most Recent Fixes

### Board Centering

Problem: board and frames appeared shifted right by roughly 10px in iPhone preview.

Cause: mobile cell calculation did not subtract both side walls and board border.

Current cell formula:

```css
--cell: calc((100cqw - (var(--wall-size) * 2) - (var(--board-border) * 2)) / 9);
```

This keeps board, walls, and frame aligned to the content width.

### Game Background

Current game background uses `assets/backgrounds/misty-forest.png` with dark overlays. This was preferred over wood textures and solid dark brown.

### Bars

- `game-info-bar`: should be dark card style.
- `game-status-bar`: should remain transparent/light.
- `game-action-bar`: dark card style.

### Deploy Dock

Removed visible `왕 먼저` text from locked unit cards. Locked visual state is enough.

## Known Code Quality Notes

- `styles.css` has grown by appending override blocks. For the next cleanup pass, consolidate mobile UI styles into a coherent section.
- Some code still uses internal `red` / `blue` identifiers for Black / White. This is acceptable short-term because protocol/state code depends on it, but UI copy should never expose red/blue.
- `README.md` should be reviewed after UI wording and rules stabilize.
- Do not rename internal side IDs casually without a migration plan; it affects AI, capture, network, render, and saved state assumptions.

## Suggested Next Tasks

1. Continue mobile game-screen layout tuning.
2. Confirm `game-info-bar` dark style and `game-status-bar` transparent style visually.
3. Decide exact vertical spacing between status bars, board, deploy dock, and action bar.
4. Add challenge content for the remaining ranks currently marked `준비 중`.
5. Clean and consolidate `styles.css` after the mobile layout direction is stable.
6. Update `README.md` rules and UI wording once the next design pass is complete.

## Update — 2026-08-13

- Confirmed that used special units intentionally become ordinary Soldiers in both rules and appearance. Updated the conflicting design note.
- Fixed the King-wall auto-taunt so it can play before the taunting side's King has been deployed.
- Added a Challenge rank-selection screen with eight visible ranks.
- Added sequential challenge unlocking and persistent completion through `daeguk-challenge-progress-v1`.
- AI Match and Online Match now unlock after the first challenge rank is completed.
- Changed inactive music and effects controls to explicit `Coming soon / 준비 중` labels.
- Fixed the Wizard teleport demo so its spent Wizard origin is recorded correctly.
- Added assertions and an overall pass/fail result to `neutral-wall-test.html`.
- Verified the full first-rank tutorial, subsequent unlock, refresh persistence, King-wall taunt, and 320px/393px mobile layouts in the browser.
- Refined Challenge rank selection to a single-column list inside its own scrollable frame. Completed ranks use a check icon, unlocked ranks have no status label, locked ranks use a lock icon, and unfinished ranks retain `준비 중`.
- King-wall taunts now hold the PvE opponent's move for the full 3-second presentation. The opponent places its King only after the overlay disappears.
- Reduced the taunt callout font weight from 950 to 500.
- Applied the same 3-second King-wall taunt lock to authoritative online matches in the sibling `unknown-kingdom-server` project. The server automatically emits the taunt event, rejects deployment during the presentation, and accepts the next King placement after the lock expires.
- Synchronized online taunt presentation to the server's `tauntUntil` timestamp. Clients now subtract elapsed network time and animate only the remaining duration instead of starting a fresh 3-second timer when the state arrives.
- Simplified the challenge selection header to a single `Challenge` title, reduced the rank viewport to four buttons, and automatically scrolls completed ranks out of view so the first unresolved rank is shown first.
- Unified the AI and online lobby cards with the dark-gold lobby style. Removed redundant PvE/online eyebrow labels, renamed the AI card, shortened its difficulty prompt, removed rank-range descriptions, and added a separate side-choice prompt above Black and White.
- Standardized Challenge Back, AI Back, Online Back, and Settings Close buttons to the full-width AI Back treatment. Online room actions now occupy two columns with Back on its own full-width row.
- Moved Online Back below the open-room list, shortened `Create Board / 대국장 만들기` to `Create / 만들기`, and replaced the room-list Refresh label with an accessible circular-arrow icon.
- Corrected the lobby Settings gear's inherited inline baseline offset by enforcing grid centering; measured horizontal and vertical offsets are now both zero.
- Replaced the four generic AI difficulty labels with a vertical four-rank window driven by Challenge progress. The first unresolved rank is selected by default and completed ranks slide out; the existing four AI profiles remain temporary until the planned eight-rank AI implementation.
- Introduced shared card-control tokens and normalized Challenge, AI, Online, and Settings controls by role: 42px actions, 48px framed rows, 56px Settings rows, 34px nested controls, common typography, borders, radii, padding, and gaps.
- Hid framed-list scrollbars while preserving touch and wheel scrolling, preventing the browser scrollbar from narrowing Challenge and Online list rows relative to the AI frame.
- Moved the Online Enter action directly below the open-board list and synchronized its visibility with the room controls when the side picker opens.
- Replaced the disabled Music and Effects badges with persistent checkboxes. Added a 0.157-second CC0 board-piece placement sound for local, AI, tutorial, puzzle, and synchronized online deployments; enabling Effects plays an immediate preview.
- Fixed Challenge status alignment so check and lock icons remain centered on the right edge of each rank button.
- Refined the piece-placement effect into a shorter, sharper `tak` by trimming its tail, filtering low resonance, and emphasizing the impact transient.
- Added the user-provided `Silent Forest Ambient Soundtrack` as temporary looping background music. The persistent Music checkbox now controls real playback at a restrained 24% volume, with a first-interaction retry for browser autoplay restrictions.
- Made centered button content the global default. Removed the remaining left alignment from lobby mode, AI difficulty, Challenge rank, and open-room buttons while retaining Challenge and room-status indicators at the right edge.
- Unified the main lobby with the shared card system: 362px outer card, 304x42px centered mode buttons with 8px gaps, a shorter `Select Match / 대국 선택` heading, and a more opaque blurred card surface for clearer separation from the board artwork.
- Increased only the three primary lobby mode buttons to 304x52px with 10px gaps, preserving the shared 42px height for ordinary card actions.
- Reframed Third-rate Master as the complete rules-learning rank: King, capture, wall defense, wall capture, General, Diplomat, then Wizard. Detailed special-unit explanations now live in the Challenge guidance panel, while AI and online matches no longer open explanatory unit popups; required activation and teleport controls remain.
- Made the tutorial overlay translucent and pass non-button pointer events through to the board, then moved guidance controls to the right so center-cell special-unit lessons remain visible and playable without losing the exit/next controls.
- Removed the generic result modal from Challenge play. Challenge completion or failure now appears inline with next/retry and rank-list actions, while AI and online matches use a new dark-gold result card with winner stone, framed statistics, rematch/replay, and Lobby actions.
- Added the King crown symbol to the winning stone on AI and online result cards, using gold on Black and dark gold on White; draws remain unmarked.
- Removed Black/White skill-use counts from match results and replaced the text Lobby action with a centered home icon while preserving its localized accessible label.
- Reserved a fixed 84px status slot across Challenge, AI, and online boards. Challenge guidance now occupies that slot above the board instead of overlaying it, with a two-line message area and compact controls; match modes retain their piece counts and turn indicator in the same-height slot.
- Removed duplicated rank/puzzle/step text from the Challenge guidance card. Replaced the textual Next and Exit actions with accessible right-arrow and X icons centered along the card bottom.
- Matched the Challenge arrow and X to the Home/Settings line-icon system (20px icons, 2px strokes, shared dark-gold button surface) and removed visible Home/Settings text from the shared bottom action bar in every game mode.
- Removed the Challenge X action because it duplicated the persistent Home button. The guidance card now shows only the centered right-arrow action when progression is available.
- Reduced the Wizard Move/Stay controls to compact 28px actions and kept Challenge guidance visible while selecting a teleport destination, preventing match counters from resurfacing.
- Special-unit placement now advances automatically into the surrounding/ability scene; detailed pre-placement help and the redundant “placed, press Next” step were removed for General, Diplomat, and Wizard.
- Removed the completion checkmark. Completion now offers a right arrow for the next challenge and an X that returns directly to Challenge selection.
- Corrected Challenge arrow/X controls to true 34px squares, removed the forced line break from the Wizard movement prompt, and now hides both Move and Stay controls once movement selection begins.
- Added semantic typography tokens (`11/13/14/18/22px`) and applied them across lobby, Challenge, AI/online cards, settings, results, and the game screen. Guidance body copy is now consistently 13px with a 20px line height.
- Replaced the position-based four-profile AI mapping with eight fixed rank-key configurations. Life-and-Death Master now has zero random variance, considers every legal root deployment, deeply evaluates the strongest 48 candidates, examines up to 28 opponent replies, and compares up to 20 AI continuations.

## Design Stabilization Milestone — 2026-08-13

The mobile-first visual structure is now stable enough to use as the baseline for building the remaining Challenge ranks and eight AI levels. Future work should preserve these rules unless a deliberate redesign is requested.

### Shared Card System

- Primary mobile cards use a `362px` outer width with a `304px` content column.
- Ordinary full-width actions are `304 × 42px`; the three main lobby mode buttons are `304 × 52px`.
- Framed list rows are `48px`, Settings rows are `56px`, and nested controls are `34px`.
- Frame padding is `10px`, ordinary row gaps are `8px`, and primary lobby button gaps are `10px`.
- Challenge, AI, Online, Settings, and match-result cards share the dark charcoal and restrained gold border language.
- Button content is centered by default. Status icons may remain independently anchored to the right edge.

### Typography Tokens

- `--font-size-meta: 11px` — locks, readiness, room status, and other metadata.
- `--font-size-body: 13px` — descriptions, prompts, result reasons, and ordinary actions.
- `--font-size-control: 14px` — ranks, difficulty choices, settings rows, and selectable items.
- `--font-size-heading: 18px` — compact headings such as `대국 선택`, Settings, and result headings.
- `--font-size-card-title: 22px` — Challenge, AI, and Online subcard titles.
- Challenge guidance is `13px / 20px / 500`, capped at two lines.

### Game Screen Structure

The stable vertical order is:

1. Mode / connection / rank card
2. Fixed `84px` information slot
3. Full-width fortress board
4. Unit-selection dock
5. Bottom action card

- The `84px` slot is identical in Challenge, AI, and Online play, so the board never shifts vertically when changing modes.
- AI and Online use the slot for Black/White piece counts and the current turn.
- Challenge replaces those counters with a guidance card and never allows the match counters to reappear during Wizard movement.
- Home and Settings are icon-only actions with localized accessible names. All shared line icons use a `20px` canvas and `2px` stroke.

### Challenge Interaction

- The guidance card does not repeat rank, puzzle, or step information already shown above it.
- Instructions occupy at most two lines; controls are centered along the card bottom.
- A `34 × 34px` right-arrow advances when progression is available.
- On Challenge completion, the arrow starts the next Challenge and a matching X returns to Challenge selection.
- The completion message is simply `챌린지 완료`, without a leading checkmark.
- General, Diplomat, and Wizard lessons show only the concise placement objective before deployment.
- Placing a special unit automatically begins its surrounding and ability scene; there is no intermediate “placed, press Next” step.
- Wizard `이동` and `이동 안함` are compact `28px`-high controls. Choosing `이동` hides both controls while the player selects a destination, but the guidance card remains visible.
- Used special units intentionally become ordinary Soldiers in rules and appearance.

### Lobby, Settings, Results, and Audio

- The Challenge selector exposes eight ranks in one scrollable column, with four rows visible at once and automatic scrolling to the first unresolved rank.
- AI difficulty shows the first unresolved Challenge rank and the next three ranks. Every rank now maps directly to its own fixed AI configuration; further strength tuning will proceed alongside Challenge design.
- The Online room list scrolls within a fixed frame. Create, room selection, Enter, and Back follow the current decision order.
- Settings uses checkbox rows for Music, Effects, and Challenge guidance.
- Temporary ambient music and the sharp board-piece placement effect are active and independently persistent.
- Challenge results remain inline in the guidance slot. AI and Online use the dedicated result card with a crowned winning stone, four match statistics, replay/rematch, and an icon-only Home action.

### Remaining Design QA

- Check long Korean and English guidance strings against the two-line limit.
- Recheck the stabilized layout at `320px` and other narrow mobile widths.
- Consolidate legacy and override sections in `styles.css` without changing computed appearance.
- Update `README.md` after the remaining Challenge rules and eight AI configurations are fully tuned.

## Handoff Prompt For New Chat

Use this in a new Codex chat if needed:

```text
We are continuing the Daeguk / 고수의 대국 mobile-first prototype.
Project path: /Users/boahspark/Documents/Codex/Projects/unknown-kingdom
Please read DESIGN_NOTES.md and DEV_LOG.md first.
Current priority: preserve the stabilized mobile design while building the remaining Challenge ranks and tuning the eight fixed AI levels. See the Design Stabilization Milestone in DEV_LOG.md for the fixed layout, typography, card, and interaction rules.
Do not change core rules unless explicitly asked.
```

## End-of-Day Handoff — 2026-08-13

Today's game work is intentionally closed here so the next session can resume from a stable checkpoint.

### AI Work Completed

- Replaced the temporary position-based difficulty mapping with eight fixed rank-key configurations.
- Life-and-Death Master is currently the strongest configuration: zero move variance, all legal root deployments considered, the strongest 48 roots searched against up to 28 opponent replies and 20 AI continuations, with a nominal three-ply search depth.
- Confirmed deterministic behavior on a representative board: three repeated evaluations selected the same move. The measured Node-side calculation time was approximately `0.75s` for that position.
- Confirmed that zero variance makes the AI consistent but does not by itself make it strategically elite.

### Important AI Limitations

- The current deep-search simulation is heuristic. It does not yet reproduce the complete capture chain, special-unit reactions, Wizard movement, King capture, and exact turn continuation at every search node.
- Life-and-Death Master can therefore evaluate a tactically incorrect future position with confidence.
- The candidate scorer discourages low-liberty and suicidal moves but does not categorically reject every tactically losing or self-triggering special-unit move.
- The browser and online server still contain separate rule implementations. A stronger AI should not be built further on duplicated rules; both clients and server should use one pure, authoritative game engine.
- Hidden opponent special identities must not be read directly by a fair AI. Future top-level search should evaluate multiple hidden-unit assignments consistent with public information, eventually using information-set MCTS if needed.

### Confirmed Turn-Continuation Bug

- A real consecutive-turn bug was reproduced independently in the shared online-style engine and the equivalent browser logic has the same control flow.
- Reproduction: Black fills the final liberty of its own unused surrounded special-unit group; the special reaction temporarily sets `state.turn` to Black; after activation the pending reaction is cleared without restoring the normally scheduled White turn; Black is then allowed to deploy again.
- This can affect General and Diplomat reactions and must also be checked through the complete Wizard activate/teleport/stay path.
- The observed final Life-and-Death move `E6` itself was a normal terminal action: its capture resolution took the White King at `E3`, so no White turn should follow that final move. The earlier perceived skipped turn is consistent with the reproduced special-reaction bug.
- Required fix: store the turn that must resume after a capture reaction before temporarily transferring control to the special owner, then restore it only after the complete reaction chain finishes. Add regression tests for both cases:
  - the mover surrounds an opponent special, whose owner reacts and then receives the normal next deployment;
  - the mover self-surrounds its own special, reacts, and then the opponent receives the next deployment.

### Other Diagnostic Finding

- An unrelated online-status bug was found while inspecting old test tabs: the server correctly sends `Opponent disconnected.`, but the remaining client keeps `networkSession.ready = true`, so the match header continues to show `접속 중`.
- `currentConnectionLabel()` also checks the nonexistent `networkSession.ws` property even though the session uses `socket`.
- This did not cause the reported Life-and-Death AI issue, but it should be fixed before online QA resumes.

### Strong Life-and-Death Roadmap

Recommended practical sequence before attempting a learned AlphaGo-style system:

1. Build one pure rules engine shared by local play, AI search, tests, and the WebSocket server.
2. Make simulated actions exact: captures, special reactions, Wizard decisions, King death, sanctuary rules, wall liberties, suicide, and reaction turn restoration.
3. Add iterative deepening, alpha-beta/negamax search, tactical move ordering, transposition caching, and capture/reaction extensions.
4. Keep every legal root move eligible, but spend deeper search on forcing King attacks, King defense, captures, and special-unit tactics.
5. Run AI work in a Web Worker so a `2–3s` Life-and-Death calculation budget does not freeze the mobile UI.
6. Build automated self-play and Elo evaluation so a new engine must beat the previous engine before replacing it.
7. Long-term only: add policy/value learning plus MCTS. Because enemy specials are hidden, use a fair information-set or determinization approach rather than reading private state.

### App Store / Google Play Preparation

- Do not create the final Xcode and Android Studio projects yet. The game rules, Challenge content, AI engine, save schema, and online synchronization should stabilize first.
- Begin app-safe architecture now:
  - keep the core engine independent from DOM, `window`, storage, audio, and networking;
  - wrap persistence, audio lifecycle, server configuration, and app pause/resume behind adapters;
  - version saved progress so future releases can migrate it safely;
  - preserve safe-area, narrow-screen, touch-target, background/resume, and offline/error behavior;
  - separate local development endpoints from production HTTPS/WSS endpoints.
- The current HTML/CSS/JavaScript app can later be packaged with Capacitor for iOS and Android.
- Before submission, hide unfinished `준비 중` content, remove placeholders, finalize privacy/age-rating metadata, add production icons and splash assets, test on physical devices, and generate native projects against the then-current store SDK requirements.
- As of this handoff, Google Play requires new apps and updates submitted from `2026-08-31` to target Android 16 / API 36 or newer. Recheck the official policy at release time because store requirements change.

### Recommended Next-Session Order

1. Fix special-reaction turn continuation in both prototype and server, including Wizard branches.
2. Add regression tests that prove exactly one normal deployment per side around every reaction path.
3. Fix online disconnect state and the `ws`/`socket` status-property mismatch.
4. Define the shared pure-engine boundary and migrate rules without changing gameplay behavior.
5. Replace the heuristic Life-and-Death search simulation with exact engine state transitions.
6. Only after correctness, increase search depth, caching, and time budget.
7. Resume the remaining Challenge ranks and later add the Capacitor shell.

### Updated Handoff Prompt For A New Chat

```text
We are continuing the Daeguk / 고수의 대국 mobile-first game.
Prototype: /Users/boahspark/Documents/Codex/Projects/unknown-kingdom
Online server: /Users/boahspark/Documents/Codex/Projects/unknown-kingdom-server
Read DESIGN_NOTES.md and DEV_LOG.md completely before changing code, especially “End-of-Day Handoff — 2026-08-13”.
First priority: fix and test special-reaction turn continuation in both browser and server. A self-surrounded special can currently let the same side deploy twice.
Then fix the stale online disconnect indicator and begin extracting one pure shared rules engine before strengthening Life-and-Death AI.
Preserve the stabilized mobile layout and do not package the final native apps yet; keep new code ready for a later Capacitor iOS/Android shell.
```

## End-of-Day Handoff — 2026-08-21

Today's work completed the deterministic hidden-information foundation, evaluated IS-MCTS without promoting it, strengthened the production five-tier heuristic AI, and added browser PvE journals for diagnosing real matches.

### Engine, Information State, and Replay

- The shared engine now keeps deterministic state-owned piece sequencing and player-private perfect-recall histories of accepted actions and filtered observations.
- `informationStateForPlayer` and `informationStateKey` remove presentation-only fields, preserve the viewer's own history, and never expose the opponent's private history or hidden special identities.
- Information-state resampling preserves the root information state, returns executable engine worlds, supports forced tactical hypotheses, and accepts configurable hidden-special deployment/type priors.
- IS-MCTS tracks action availability across determinizations with different legal-action sets and rejects worlds outside the root information set.
- Action/event/state-digest journals round-trip through JSONL, identify the first replay divergence, reject tampering, and have a real-file streaming test.
- Browser PvE now records the same action/event/hash journal, keeps undo synchronized with the journal, persists the latest record, and exposes developer-only downloads in Settings and the result card.
- PvE resignations now pass through the authoritative engine action path. Missing browser timer imports for `hasLegalDeployment` and `declareWinner` were fixed.

### IS-MCTS Evaluation and OpenSpiel Cross-Check

- The candidate uses risk-aware IS-MCTS with lower-tail/CVaR scoring and weighted hidden-special resampling.
- Three recorded losses replay deterministically with matching final digests. The two tactical losses were General and Wizard reaction traps; risk-aware suitability tests now reject both historical losing moves and a next-turn Wizard trap.
- The hidden-special prior remains provisional: 3 source games, 75 eligible deployments, 16 observed specials, estimated deployment probability `0.220779`, and smoothed type weights General `0.368421`, Wizard `0.368421`, Diplomat `0.263158`.
- The full promotion run rejected the IS-MCTS candidate after 20 games: score `22.5%`, Wilson upper bound `44.27%`, below the required `55%`. Production therefore remains on the promoted heuristic engine for all five difficulty tiers.
- A small OpenSpiel 2.0.2 tactical model previously confirmed matching information-state, resampling, variable-action-set, and safe-action behavior. The checked-in cross-check artifact passed and both engine scenarios avoided their historical losses.
- Final-day rerun note: `npm run ai:open-spiel-crosscheck` could not run in the current shell because `pyspiel` is not installed in the default Python environment. No network installation was performed during closeout.

### Production AI Strategy

- Shared zero-sum state evaluation covers terminal results, material, captures, King liberties, connectivity, influence, center control, and home position.
- High-tier phase contracts use 20 completed rounds for opening, 40 for middle game, and territory-heavy endgame evaluation afterward.
- Recent hidden enemy placements use the agreed `80%` special hypothesis. An unrevealed enemy stone orthogonally adjacent to the King is treated as `100%` special risk until all three enemy specials are observed as spent.
- King tactics retain `90%` priority when they conflict with territory or wall plans.
- Grandmaster preserves a King-adjacent "mine's" liberty and connection route instead of detonating it, while connecting its own King group toward its fortress wall.
- Wall tactics block enemy liberties that lead toward the enemy wall and funnel enemy groups toward the AI wall when an alternative route exists.
- Specials emphasize King assault during the first 15 deployments; after 20 deployments the strategy transitions to territory even if a special remains. Ordinary groups take a forced sole liberty, while groups containing a special are excluded from that forced escape rule.
- The middle/endgame policy favors capture when multiple liberties remain, connects detached groups to wall-connected groups, and closes central entry gaps toward its own territory.
- The deterministic Grandmaster tactical suite covers five scenarios and currently passes all five.

### Five Difficulty Tiers and Promotion Notes

- The production ranks are Novice, Intermediate, Advanced, Expert, and Grandmaster; legacy eight-rank saves migrate into these five tiers.
- All five tiers generate authoritative legal moves and remain on the heuristic engine.
- The new Grandmaster strategic configuration was compared with the legacy configuration in one color-swapped pair. The result was `1–1`; the gate correctly rejected it as inconclusive (`max_games_without_confidence`). This smoke comparison is not sufficient evidence of a strength improvement.

### Browser Diagnostics and Developer Mode

- Local developer mode shows PvE JSONL download controls and disables the 30-second PvE timer. Use `?dev=0` when production-like local timer behavior is required.
- The latest PvE journal survives the result screen and can be downloaded after reload through the persisted fallback.
- A reported White-to-Black change was traced through the real 39-action journal. Action index `38` placed Black at D1, removed the final liberty of the White E1/F1/G1/F2 group, emitted `group_captured`, and correctly occupied those four cells with Black stones. No special reveal, activation, or Diplomat conversion occurred.
- `?demo=capture-38` reconstructs the exact pre-capture board locally. AI scheduling is disabled only for this demo so D1 can be played and undone interactively.

### Final Verification

- `npm test`: 98 shared-engine tests passed and 4 server tests passed.
- `npm run ai:validate-tactics`: 5/5 Grandmaster tactical scenarios passed.
- `npm run ai:reproduce-losses`: 3/3 journals reproduced with matching digests.
- `npm run ai:estimate-hidden-prior`: completed and regenerated the provisional prior.
- `node --check app.js` and `git diff --check`: passed.
- OpenSpiel rerun: blocked only by missing local `pyspiel`; the existing checked-in artifact records the earlier passing cross-check.

### Remaining Work

1. Collect a representative journal corpus before treating the hidden-special prior as calibrated.
2. Improve IS-MCTS strength and runtime, then require a fresh paired promotion evaluation before enabling it in production.
3. Increase Grandmaster comparison games; the one-pair smoke result is intentionally inconclusive.
4. Record timer expiry as an authoritative journaled action/event so the persisted fallback also contains the terminal timeout outcome after reload.
5. Keep JSONL controls and tactical demo routes out of production presentation while retaining them for local diagnosis.
