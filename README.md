# Unknown Kingdom: Shadow Realm Prototype

Static local prototype for validating the MVP rules from `Unknown Kingdom: Shadow Realm`.

## Structure

- `app.js`: game orchestration, capture rules, and special-unit reactions
- `js/config.js`: constants, labels, and localized text
- `js/state.js`: initial state and piece creation
- `js/board.js`: board-coordinate helpers
- `js/ai.js`: PvE move selection
- `js/network.js`: WebSocket connection lifecycle
- `js/protocol.js`: WebSocket message and server-state validation
- `js/render.js`: board and interface rendering
- `js/i18n.js`: translation helper

## Run

```bash
python3 -m http.server 4173 --directory outputs/unknown-kingdom-prototype
```

Open:

```text
http://127.0.0.1:4173/
```

## Implemented

- 9x9 game board
- Basic PvE and network-only PvP modes
- PvE uses Blue as the human player at the bottom and Red as the AI opponent at the top
- Alternating deployment turns
- Free deployment on any empty cell
- Suicide placements are prohibited unless capture or a special reaction leaves the deployed unit alive
- Each side must deploy its King as its first move
- Kings remain publicly visible for the entire match
- Own major units display initials; opponent hidden units look identical to Soldiers
- Opponent special identities are only disclosed in the activation moment/log
- Activated special units remain visibly identified on the board with their original initial and a used marker
- Online PvP uses private room creation/joining and never falls back to local two-player play
- Group capture: surrounded groups become the captor's soldier spaces
- Fortress walls count like same-color soldiers on their board edges
- Wall connection is part of normal liberty and capture calculation, not a separate invincibility effect
- General, Diplomat, and Wizard one-use abilities
- Special abilities cannot be activated manually and trigger only when their group is fully surrounded
- Wizard teleport destinations are chosen by the player, including capture reactions
- When a Wizard attacks a King, the King resolves its escape before the Wizard chooses a teleport destination
- King first-attack escape by swapping with any friendly Soldier or moving to an empty cell within 3 spaces
- PvE AI automatically selects a Soldier swap or nearby empty escape cell for the King's first attack
- PvE AI randomly uses balanced, aggressive, or defensive deployment behavior with weighted unit choices
- Capture resolution pauses while a King escape is pending; a second King capture ends the game instead of converting the King
- Diplomat conversion follows the same King rule: first attack swaps with a Soldier, second attack wins
- King death and unit-elimination win states
- Full-board ties end as a draw
- A player with no legal deployment automatically passes; if neither side can deploy, territory decides the result
- Match result popup with victory reason, territory, captures, skill usage, and replay
- Undo history for up to 200 complete moves; PvE restores the position before the player's move and AI response

## Online PvP Server Contract

The browser connects to a WebSocket endpoint at `/ws`. The game server must be authoritative and send each player a sanitized state that excludes unrevealed enemy unit identities.

For a separately hosted server, open the client once with:

```text
?server=wss://your-server.example.com/ws
```

The selected server URL is stored in the browser for later matches.

Client messages:

```json
{ "type": "create_room" }
{ "type": "join_room", "roomCode": "ABC123" }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "deploy", "unitType": "soldier", "row": 4, "col": 4 } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "king_escape", "row": 3, "col": 4 } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "wizard_teleport", "row": 2, "col": 5 } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "rematch" } }
```

Server messages:

```json
{ "type": "room_created", "roomCode": "ABC123" }
{ "type": "waiting", "roomCode": "ABC123" }
{ "type": "match_start", "roomCode": "ABC123", "player": "blue", "state": {} }
{ "type": "state", "roomCode": "ABC123", "player": "blue", "state": {} }
{ "type": "error", "message": "Invalid room code." }
```

The server is responsible for legal-move validation, captures, special reactions, hidden information, turn order, reconnects, and victory results.
