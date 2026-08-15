# Unknown Kingdom: Shadow Realm — Design Notes

## Visual Direction

- Keep the current top-view prototype until the rules and interactions are stable.
- The final game should use a 2.5D or 3D bird's-eye view.
- The human player's fortress should always appear at the bottom of the screen.
- In PvE, the human player is White and the AI is Black.
- Preserve the logical 9x9 grid and input coordinates when changing the camera presentation.

## Board and Fortress

- Build the fortress walls as visible architectural structures rather than flat colored bars.
- Walls act as same-color allied units in capture and connection calculations.
- Do not show wall-connected groups as invincible or protected with a permanent white outline.
- Consider a subtle connection effect when a unit touches or completes a chain to its wall.
- A connection effect should communicate attachment, not immunity.

## Units

- Replace prototype spheres with distinguishable unit characters or pieces.
- King, General, Wizard, and Diplomat need immediately recognizable silhouettes.
- Kings remain publicly visible throughout the match.
- Hidden enemy special units should look identical to ordinary Soldiers before activation.
- Own special units should remain identifiable.
- Use initials during the prototype phase:
  - `K` — King
  - `G` — General
  - `W` — Wizard
  - `D` — Diplomat

## Special Ability Reveal

- Reveal an enemy special unit when its ability activates.
- Use a strong activation animation that clearly identifies the unit type.
- After activation, the special unit becomes an ordinary Soldier in both rules and appearance.
- Returning to the ordinary Soldier appearance is intentional: it prevents players from mistaking the unit for a special piece with an unused ability.
- The activation animation and log should clearly identify the special type before it changes into a Soldier.

## Capture and Removal Feedback

- Make the exact captured or removed cells easy to identify.
- Briefly highlight affected units before changing or removing them.
- Use different effects for:
  - Territory capture and color conversion
  - General or Wizard removal
  - Diplomat conversion
  - King attack and escape
- Territory capture should visually show ownership flowing into the captured spaces.
- Avoid instantaneous changes that make players unsure which move caused the result.

## King Escape

- On the King's first attack, highlight both valid escape types:
  - Any friendly Soldier available for a swap
  - Any empty cell within three orthogonal spaces
- Visually distinguish swap targets from empty escape targets.
- Animate the King and Soldier crossing positions during a swap.
- For an empty-cell escape, use a short movement or teleport trail.
- A second King attack should use a decisive defeat animation.

## Wizard Sequence

- If a Wizard attacks a King, resolve the King's escape first.
- After the King finishes moving, highlight the Wizard's teleport destinations.
- Use separate visual phases so players do not confuse the King's movement with the Wizard's movement.

## Turn and Hidden Information

- Make the active team clearly visible without relying only on text.
- In PvE, never reveal the AI's hidden special unit through labels, logs, outlines, or selection details before activation.
- Public information such as the King and activated special units should remain consistently visible.
- Show unavailable or already deployed units clearly in the deploy controls.

## Match Result

- Display a result popup when the match ends.
- Include:
  - Winner
  - Victory reason
  - Final Black and White territory
  - Captures by each side
  - Special abilities used
  - Play Again button
- Victory reasons should distinguish King defeat, unit elimination, and territory scoring.

## Animation Priorities

1. Capture and removal location feedback
2. Special ability activation and reveal
3. One-life King defeat and fortress-wall taunt
4. Wall connection feedback
5. Match result presentation
6. Full bird's-eye camera and 3D environment

## Deferred Until Final Design

- Character models and detailed unit illustrations
- Final fortress architecture
- Particle effects, lighting, and sound
- Camera movement and bird's-eye perspective
- High-detail capture and destruction animations
- Mobile-specific layout and interaction polish

## 2026-08-12 Mobile UI Direction

### Product Focus

- Current design work is mobile-first, focused on smartphone screens.
- Tablet and desktop layouts are secondary until the core mobile game screen is stable.
- The app should eventually ship as a mobile game, so touch reach and safe-area layout take priority over desktop symmetry.

### Naming And Brand

- English title: **Daeguk: Ascension**.
- Korean title: **고수의 대국**.
- Use uploaded SVG logos instead of live text for splash and lobby branding:
  - `assets/ui/daeguk-logo-ko.svg`
  - `assets/ui/daeguk-logo-en.svg`
- Korean and English logo selection should follow the `lang` query/state.

### Splash Screen

- Splash uses the uploaded mountain-board artwork:
  - `assets/splash/daeguk-splash.png`
- Mobile splash art should render from a fixed art-size strategy rather than stretching freely:
  - phone baseline: about `800 x 874`
  - tablet can later use a larger proportional render such as `1200 x 1311`
- Current mobile logo target was tuned around `296 x 153`, centered horizontally, near `y = 64`.
- Avoid heavy vignette over the logo. If readability is needed, prefer a subtle overlay or logo SVG outline rather than CSS text stroke.

### Lobby

- Lobby should use the same visual language as the dark-gold card system.
- Main mode labels:
  - Korean: `챌린지`, `AI 대국`, `온라인 대국`
  - English equivalents remain concise.
- Main lobby layout is centered rather than bottom-anchored for now.
- `AI 대국` and `온라인 대국` are locked until the player clears the first challenge rank.
- The Challenge entry opens a rank-selection card. Completed ranks remain replayable, and clearing a rank unlocks the next available challenge.
- The rank-selection card uses a single `Challenge / 챌린지` heading and shows four rank buttons at a time. On entry, completed ranks scroll out so the first unresolved rank appears first.
- Ranks without implemented puzzle content remain visible as `Coming soon / 준비 중`.
- AI and online lobby subcards use the same dark-gold panel, button, and selected-state language as the main lobby and Challenge card. Redundant eyebrow labels are omitted.
- The AI card is titled `AI Match / AI 대국`; difficulty comes first, followed by a separate preferred-side prompt above the Black and White buttons.
- AI rank choices are a single vertical column showing the player's first unresolved Challenge rank and the next three ranks. Completed ranks slide out of this four-rank window; all eight ranks now map directly to fixed AI configurations, with evaluation weights available for later tuning alongside the corresponding Challenge designs.
- AI strength is keyed directly by the eight rank identifiers and never by a button's current list position. Life-and-Death Master evaluates every legal root move, deeply compares the strongest 48 candidates through opponent reply and AI continuation, and uses zero random variance.
- Challenge Back, AI Back, Online Back, and Settings Close use one full-width footer-button style. Online Back occupies its own row below the two room actions.
- The online room-list Refresh control is a compact accessible icon button. The lobby Settings gear is geometrically centered inside its circular button.
- Music, sound effects, and Challenge guidance use the same checkbox setting row. Sound effects default to enabled and play a short stone/piece impact on every authoritative or local deployment.
- Third-rate Master is the complete rules-learning rank: King and sanctuary, basic capture, wall defense, wall-assisted capture, General, Diplomat, then Wizard and teleportation. Detailed special-unit explanations appear inside its guidance panel when Challenge guidance is enabled.
- AI and online matches do not show explanatory special-unit popups. Only required match controls, such as ability activation and Wizard teleport decisions, interrupt play.
- Challenge success and failure stay inside the board guidance panel; Challenge play never opens the match-result card. Completion is saved immediately and reflected by the rank check icon.
- AI and online matches use a dedicated dark-gold result card with a 362px outer width, 304px content, winner stone, concise reason, framed statistics, and 304x42px actions. Online rematch requests remain visible as a waiting state until both players accept.
- Online lobby action order follows the decision flow: Create, choose an open board, Enter, then Back.
- Card controls share role-based tokens: full-width actions `304 × 42`, two-way actions `147 × 42`, framed list rows `48px`, Settings rows `304 × 56`, and nested controls `34px`. Frame padding is `10px` with `8px` row gaps; scrolling lists expose four complete rows at a time.
- Settings is accessed by a white gear icon; language and sound controls move inside settings.

### Game Screen Layout

- The current target is an iPhone-style mobile viewport with safe-area awareness.
- The board must remain full-width within the mobile content column and keep its geometric ratio.
- Board size is width-driven. Increasing the height of status bars should push lower UI down rather than shrink the board.
- If vertical space becomes tight, the lower controls should compress or scroll before the board shrinks.
- Current intended vertical order:
  1. Mode / online status / rank bar
  2. Fixed-height match-information slot
  3. Board
  4. Unit selection dock
  5. Bottom action bar
- The mode / online status / rank bar should use the dark card style, matching the bottom action bar.
- The match-information slot is fixed at `84px` in every mode so the board never changes vertical position between Challenge, AI, and online play.
- In Challenge, the slot becomes a dark guidance card with a message area capped at two lines and a bottom-centered icon row. Rank, puzzle, and step labels are omitted because the mode/rank bar already supplies context. Progression uses a right-arrow icon. On completion only, an X returns to Challenge selection while the arrow starts the next challenge. The card must never overlay the board or reveal the match counters during Wizard movement.
- Special-unit lessons show only the concise placement objective before deployment. Placing General, Diplomat, or Wizard automatically begins its surrounding/ability scene without a separate readiness explanation or manual Next action.
- In AI and online matches, the same slot retains the piece counters and turn indicator and remains visually light or transparent.
- The bottom Home and Settings actions are icon-only in every game mode. Their localized names remain available through accessible labels and tooltips.
- Typography uses semantic size tokens instead of per-screen values: metadata `11px`, body/description `13px`, controls `14px`, small headings `18px`, and card titles `22px`. Challenge guidance uses `13px / 20px / 500` and remains capped at two lines.

### Game Screen Background

- Dark plain wood and solid brown backgrounds conflicted with the board UI.
- Current preferred direction is a low-contrast misty forest background:
  - `assets/backgrounds/misty-forest.png`
- The forest background should remain darkened enough that cards, board, and stones stay readable.

### Board And Frame

- The board frame must be centered exactly; previous right-shift was caused by not accounting for wall width and board border in the cell calculation.
- Mobile cell calculation should include both side walls and board border:
  - `--cell: calc((100cqw - (var(--wall-size) * 2) - (var(--board-border) * 2)) / 9)`
- The board should fill the available mobile width but not overflow the phone preview frame.
- Board, wall, and grid alignment are more important than decorative frame thickness.

### Unit Selection Dock

- Unit selection is below the board.
- The dock should not show the title `유닛 배치`.
- King is removed from the normal unit selection list after first placement logic; visible unit cards focus on Soldiers and special units.
- Deploy stones should match the player side color:
  - Black player sees black deploy stones.
  - White player sees white deploy stones.
- Locked deploy cards should look disabled; explanatory text like `왕 먼저` is not needed.

### Bottom Action Bar

- Bottom action bar sits under the unit selection dock.
- It should use the dark-gold lobby card style.
- Current labels:
  - `한수 물리기`
  - `홈`
  - `설정`
- Undo uses text rather than a back-arrow icon because it means undo last move, not navigation.

### Wizard Skill Popup

- Wizard movement choice should be shown as a centered popup/card, not as a top control.
- Korean copy:
  - `마법사 스킬이 발동되었습니다.`
  - `원하는 빈칸으로 이동할 수 있습니다.`
- Buttons should sit below the message, centered:
  - `이동`
  - `이동 안함`
- Popup height should grow to fit text rather than force internal scrolling.

### Taunt Art

- King-wall taunt uses character images:
  - `assets/taunts/kingb_zzol.png`
  - `assets/taunts/kingw_zzol.png`
- Taunt should trigger only when a King is initially placed against its own wall.
- It must not trigger when later Soldiers or other units touch the wall.
- Taunt display duration target: about 3 seconds.
- Hold the opponent's next placement until the 3-second taunt presentation finishes, then resume the turn.
- In online matches, the server sends the authoritative `tauntUntil` timestamp. Each client displays only the remaining time so message latency does not extend the presentation beyond the server's lock.

### UI Text Rules

- Buttons: 1–2 words.
- Descriptions: short, action-oriented, ideally under 40 Korean characters where possible.
- Korean UI copy should generally use `~하세요` tone.
- English descriptions use sentence punctuation; buttons do not need periods.
- Avoid redundant instructional text when state can be communicated visually.
- Risky game actions must use game-native confirmation cards rather than browser `window.confirm()` UI. Suicide confirmation is centered over the game stage, keeps keyboard focus inside its Cancel/Confirm actions, and must not mutate match state before explicit approval.

## AI Engine Architecture Decision — 2026-08-13

- Correct rules simulation takes priority over additional nominal search depth.
- Local play, AI analysis, automated tests, and the online server should execute actions through one pure authoritative engine.
- The pure engine must not depend on DOM APIs, `window`, browser storage, audio, timers, or network sockets.
- Every simulated action must include the same capture chains, special reactions, Wizard choices, King victory rules, walls, sanctuaries, suicide behavior, and turn continuation as a real match.
- Special reactions temporarily transfer interaction to the surrounded unit's owner but must retain an explicit `resumeTurn` for the next normal deployment. A self-triggered special must never grant its owner an extra normal deployment.
- A no-legal-deployment state is represented by the explicit engine action `pass`; it is illegal as a voluntary action while any deployment remains available and it immediately resolves the existing territory-finish rule.
- AI ranks should increasingly differ through reliable search budget, exact depth, candidate breadth, tactical extensions, and evaluation quality. Random variance should not be the main definition of strength.
- Life-and-Death Master remains deterministic and should eventually use iterative deepening, transposition caching, tactical extensions, and a `2–3s` mobile-safe calculation budget in a Web Worker.
- Unrevealed enemy special identities are private information. AI search must use only public information and legal probability assumptions; it must not obtain strength by reading hidden types directly.
- Learned policy/value models and MCTS are a long-term option after an exact engine, self-play runner, replay format, and Elo evaluation pipeline exist.

## Native App Readiness Decision — 2026-08-13

- Continue building the game as a web-first application for now; add the final Capacitor iOS and Android projects after core rules, Challenge content, AI, save migrations, and online synchronization stabilize.
- New code should already respect native-app boundaries:
  - pure game engine;
  - UI adapter;
  - versioned persistence adapter;
  - audio lifecycle adapter;
  - environment-based network configuration;
  - pause/resume and connection-recovery handling.
- Preserve mobile safe-area support, full touch operation, narrow-device layouts, and a non-blocking AI worker path.
- Development may show all `준비 중` ranks for planning, but release builds must hide unfinished content and remove placeholders before store review.
- Create native signing, icons, splash screens, store metadata, and physical-device release builds near submission so they use the current Apple and Google SDK requirements.
