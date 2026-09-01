# Unknown Kingdom Server

Authoritative WebSocket server for Unknown Kingdom online PvP.

This package now lives inside the `unknown-kingdom` monorepo as an npm workspace
and depends on `@daeguk/game-engine` (`packages/game-engine`) as a real workspace
dependency instead of a relative sibling-repository import.

## Run

From the monorepo root:

```bash
npm ci
npm start --workspace=server
```

Or from this folder, after installing at the repo root at least once:

```bash
npm start
```

Defaults to port `4175`.

Endpoints:

- `GET /health`
- `WS /ws`

The server owns room state, validates actions, resolves captures and abilities, and sends each player a sanitized state that hides unrevealed enemy special units.

Online clients must use WebSocket protocol version 3. After two clients join,
rock-paper-scissors assigns the winner to Black and the other player to White.
Older protocol versions are rejected explicitly.

Current King rules:

- A King has one life; its first capture ends the match.
- A King deployed against its own fortress wall automatically triggers the opponent's taunt.
- Automatic King-wall taunts expose an authoritative `tauntUntil` timestamp; deployments remain locked for three seconds.

## Render

Create a Render Blueprint from the monorepo root (this repository). The root
`render.yaml` configures:

- Node.js web service
- `npm ci` build (installs and links all workspaces, including `@daeguk/game-engine`)
- `npm start --workspace=server` (runs this package's `start` script)
- `/health` health check

After deployment, connect the frontend with:

```text
https://unknown-kingdom.vercel.app/?server=wss://YOUR-SERVICE.onrender.com/ws
```
