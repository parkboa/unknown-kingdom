# Unknown Kingdom Server

Authoritative WebSocket server for Unknown Kingdom online PvP.

## Run

```bash
npm install
npm start
```

Defaults to port `4175`.

Endpoints:

- `GET /health`
- `WS /ws`

The server owns room state, validates actions, resolves captures and abilities, and sends each player a sanitized state that hides unrevealed enemy special units.

Current King rules:

- A King has one life; its first capture ends the match.
- A King deployed against its own fortress wall grants the opponent one `taunt` action.

Send `{ "type": "create_bot_room" }` to create an authoritative online match with the human as White and the server bot as Black.

The online bot uses a normal-difficulty heuristic: immediate King captures, King liberties, captures, group connections, central influence, special-unit conservation, and a randomized choice among the top five moves. Move scoring uses only the bot's sanitized public view.

## Render

Create a Render Blueprint from this repository. `render.yaml` configures:

- Node.js web service
- `npm ci` build
- `npm start`
- `/health` health check

After deployment, connect the frontend with:

```text
https://unknown-kingdom.vercel.app/?server=wss://YOUR-SERVICE.onrender.com/ws
```
