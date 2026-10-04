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

### Authentication rate limits

The server allows 30 authentication requests per minute and 10 new guest creation
attempts per hour per network address. Failed creation attempts also count.
Refreshing an existing session does not use the creation quota. Account deletion
uses the general request quota. These fixed windows are process-local and reset
on restart; users behind the same NAT still share a quota.

On Render (`RENDER=true`), a private ingress socket may supply the Cloudflare
`CF-Connecting-IP` header as the visitor address. Direct connections and other
deployments use the socket address. Missing, multiple or malformed visitor headers
fall back to the socket address. `X-Forwarded-For` is never trusted: a caller can
insert values into that chain. IPv6 spelling variants and IPv4-mapped IPv6 are
normalized. This relies on Render's ingress routing through Cloudflare; if ingress
changes, revisit the trust boundary before enabling another forwarding header.
The server logs the selected source once per classification, without logging any
IP addresses, credentials or request bodies. `render-client` confirms that the
visitor header was usable; `socket-peer` on Render indicates the fallback path.

Local rejection returns HTTP 429 with `error: "RATE_LIMITED"`, `scope` of
`requests` or `guest_creation`, `retryAfterSeconds`, and a CORS-exposed
`Retry-After` header. Supabase HTTP 429 is preserved as HTTP 429 with
`scope: "upstream"`; no provider error detail or guessed expiry is returned.
Existing apps remain compatible, but need a separate update to display the retry
duration. CAPTCHA verification is still performed by Supabase on new guests.

This change separates native clients that contact Render directly. A web request
rewritten through Vercel can still appear as the Vercel egress address. Supabase
also sees this server's egress address because end-user IP forwarding is not
enabled there; its own anonymous signup limit remains independent of this local
quota. No Supabase setting, API key, subscription or CAPTCHA policy is changed.

References: [Render runtime marker](https://render.com/docs/environment-variables),
[Cloudflare visitor headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/),
[Supabase upstream limits](https://supabase.com/docs/guides/auth/rate-limits).
