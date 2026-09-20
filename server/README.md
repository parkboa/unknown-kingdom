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

## Match reconnection

Authenticated seats are reserved after a socket drops. The client can send
`resume_room` with the room code and protocol version to reclaim only the seat
owned by the same player identity. While either player is absent, the room turn
timer is paused and actions are rejected. The default grace period is 120 seconds
and can be changed with `RECONNECT_GRACE_MS` (minimum 1000 ms).

Room state is currently process-local. A server restart, redeploy, or request
routed to a different server instance cannot resume the match.

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

## Guest authentication

Requires Node.js 22 or later. See [guest auth setup](../docs/GUEST_AUTH_SETUP.md) and
[environment template](.env.example). Authentication is staged behind `AUTH_MODE=required`;
the checked-in client remains disabled until database, same-origin proxy and deployment
configuration are ready. The SQL migration is applied explicitly, never on server startup.
Account deletion additionally requires `002_account_deletion.sql` and a server-only
`SUPABASE_SECRET_KEY`; never expose that key to browser or mobile assets.
