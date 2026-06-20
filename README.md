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
