# Unknown Kingdom Prototype

Static browser prototype for validating the current Unknown Kingdom rules, UI, PvE, puzzle, and online PvP flows.

> Naming note: the UI uses **Black / White**. The code and WebSocket protocol still use the internal side IDs `red` and `blue`, where `red = Black` and `blue = White`.

## Structure

- `index.html`: static page shell and modals
- `styles.css`: board, stones, fortress, king sanctuary, and responsive UI styles
- `app.js`: browser-side game orchestration, mode flow, tutorial/puzzle flow, and UI events
- `js/config.js`: constants, localized text, unit labels, and help copy
- `js/state.js`: initial state and piece creation
- `js/board.js`: board-coordinate helpers
- `js/ai.js`: PvE AI move, teleport, and difficulty logic
- `js/network.js`: WebSocket connection lifecycle
- `js/protocol.js`: WebSocket message and server-state validation
- `js/render.js`: board and interface rendering
- `js/puzzles.js`: puzzle definitions and rank labels
- `js/shared-engine-adapter.mjs`: browser-local adapter for deterministic shared-engine actions and player-filtered events
- `packages/game-engine/`: canonical deterministic rules, structured events, visibility filtering, tests, and the separately exported bot policy
- `assets/units/*.svg`: unit icons

## Run Locally

```bash
python3 -m http.server 4173 --directory outputs/unknown-kingdom-prototype
```

Open:

```text
http://127.0.0.1:4173/
```

## Current Game Modes

- **Puzzle**: entry point for tutorial-style basic training and puzzle challenges.
- **PvE**: play against AI with selectable side and difficulty.
- **Online PvP**: private room-based network play through the WebSocket server.

PvE, Puzzle/Challenge, tutorial, and the online server all use `packages/game-engine` for authoritative deployment, capture, special-reaction, Wizard, turn, and victory transitions. The browser remains responsible for rendering, localization, audio, timers, undo, tutorial guidance, puzzle objectives, and rank progression.

## Implemented Rules

### Board And Sides

- The game uses a 9x9 board.
- Black starts at the top side; White starts at the bottom side.
- A player’s chosen side is displayed at the bottom of the board.
- Deployment is turn-based, with one unit placed per turn.
- Units can be placed on any empty cell unless blocked by a temporary king sanctuary.

### Units

- Each side has Soldiers, one King, and three special units: General, Diplomat, and Wizard.
- Each side must deploy its King as its first move.
- Kings are always public and visible.
- Opponent special units are hidden as ordinary stones until their skill is ready to activate.
- Own special units are identifiable by icon.
- Used special units become ordinary Soldiers after their ability resolves.

### King

- A King has one life.
- Capturing a King ends the match immediately.
- A King cannot escape, swap, or teleport.
- After a King is placed, the surrounding 8 cells become that King’s sanctuary until that player has completed five deployments total.
- The opponent cannot deploy inside the sanctuary during that period.
- The sanctuary is shown as a subtle 3x3 aura with crown marks around the King.
- Placing a King directly against its own fortress wall grants the opponent one taunt chance.

### Fortress Walls

- Own fortress walls provide liberty to allied units.
- A unit or group connected to its own fortress wall treats the wall direction as an open liberty and is not captured while that connection remains.
- A player can capture an enemy unit by surrounding it with allied units and their own fortress wall.
- Side-wall center rows are neutral; neutral wall contact gives liberty and does not belong to either side.

### Capture

- Capture is group-based.
- A surrounded enemy group is converted into the captor’s Soldier spaces.
- Chain captures continue until the board becomes stable.
- Full-board ties end as a draw.
- If the next player has no deployable unit or no valid placement, the game can pass/finish and decide by territory.
- Territory scoring includes the configured White second-player compensation.

### Suicide Placement

- Suicide placement is allowed.
- If the selected placement would immediately kill the placed unit, the UI shows a confirmation warning.
- The warning does not reveal hidden enemy special identities.
- If confirmed, the unit is placed and immediately removed when the rules require it.

### Special Units

- Special abilities trigger only when the special unit’s group is fully surrounded.
- Special abilities are resolved manually for clarity: the owner must press the activation button when the skill is ready.
- Activation is mandatory. The button is a confirmation step so players can see which hidden unit was surrounded and what skill is resolving.
- Resolution order is: surround check, reveal special unit, wait for activation confirmation, resolve ability, recalculate captures, then continue chain captures.
- The opponent can see that a captured hidden unit is a special unit while the activation is pending.
- PvE delays AI special activation so the player can understand what happened.

Special abilities:

- **General**: when surrounded, removes adjacent enemy units, then becomes a Soldier.
- **Diplomat**: when surrounded, converts adjacent enemy units into friendly Soldiers, then becomes a Soldier.
- **Wizard**: when surrounded, removes adjacent enemy units, breaks the surround, and survives. It then becomes a Soldier and may teleport to a chosen empty cell or stay in place.

### Visibility And Help

- Special-unit explanations appear when a unit is first selected unless the user disables that help.
- “Do not show again” persists across games.
- Settings can reset special-unit explanations.
- Last placed stone is highlighted with a subtle scale animation.

### Undo

- Undo history stores up to 200 complete moves.
- In PvE, undo restores the state before the player move and the AI response.

## PvE

- The player can choose Black or White.
- The chosen player side is displayed at the bottom of the board.
- AI difficulties:
  - **Beginner**: for Third-rate to First-rate Masters.
  - **Intermediate**: for Peak, Transcendent, and Harmony Masters.
  - **Advanced**: for Profound and Life-and-Death Masters.
  - **Expert**: more aggressive King pressure and stronger tactical scoring.
- AI uses weighted unit choice, capture pressure, King pressure, own-King safety, and difficulty-based randomness.

## Puzzle And Rank

- Puzzle mode is the training/progression entry point.
- The first puzzle is basic training and replaces the older standalone tutorial entry.
- Challenge opens a rank-selection screen.
- Only the first rank is initially available. Clearing a rank unlocks the next implemented rank.
- Clearing the first rank permanently unlocks PvE and Online PvP in that browser.
- Implemented completion is stored locally under `daeguk-challenge-progress-v1`.
- Later puzzles can be tied to ranks:
  - Third-rate Master
  - Second-rate Master
  - First-rate Master
  - Peak Master
  - Transcendent Master
  - Harmony Master
  - Profound Master
  - Life-and-Death Master

## Settings

- Language and special-unit explanation preferences are functional.
- Music and effects are shown as coming soon until an audio system and sound assets are connected.

## Online PvP Server Contract

The browser connects to a WebSocket endpoint at `/ws`. The game server must be authoritative and send each player a sanitized state that excludes unrevealed enemy unit identities.

When a King is initially deployed against its own wall, the server automatically broadcasts the opponent's taunt event and rejects deployment actions for the 3-second presentation window.

For a separately hosted server, open the client once with:

```text
?server=wss://your-server.example.com/ws
```

The selected server URL is stored in the browser for later matches.

### Client Messages

```json
{ "type": "create_room", "protocolVersion": 2 }
{ "type": "join_room", "roomCode": "ABC123", "protocolVersion": 2 }
{ "type": "choose_side", "roomCode": "ABC123", "side": "blue" }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "deploy", "unitType": "soldier", "row": 4, "col": 4 } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "taunt" } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "activate_special" } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "wizard_teleport", "row": 2, "col": 5 } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "wizard_stay" } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "pass" } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "rematch" } }
```

Use `{ "type": "create_bot_room" }` only for server-side testing of a bot room. The public online PvP UI should prioritize human room creation and joining.

### Server Messages

```json
{ "type": "room_created", "roomCode": "ABC123" }
{ "type": "waiting", "roomCode": "ABC123" }
{ "type": "side_selection", "roomCode": "ABC123" }
{ "type": "match_start", "roomCode": "ABC123", "player": "blue", "state": {} }
{ "type": "state", "roomCode": "ABC123", "player": "blue", "state": {} }
{ "type": "error", "message": "Invalid room code." }
```

After both players join, the server sends `side_selection`. The first valid `choose_side` command claims that side and automatically assigns the opponent to the other side. The server is responsible for legal-move validation, captures, special reactions, hidden information, turn order, reconnects, and victory results.

## Known Internal Naming Debt

- The code still uses `red` and `blue` internally while the UI presents Black and White.
- Future cleanup should rename internal side IDs only after server/client protocol compatibility is planned.
