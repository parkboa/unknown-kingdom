// Read-only service probes. No guest creation, token refresh, or account deletion.
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { WebSocket } from 'ws';

const env = parseEnv(await readFile(new URL('../server/.env', import.meta.url), 'utf8'));
const base = 'https://unknown-kingdom-server.onrender.com';
async function measure(stage, work) {
  const started = performance.now();
  try { return { stage, ...(await work()), milliseconds: Math.round(performance.now() - started) }; }
  catch (error) { return { stage, error: /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : error.name, milliseconds: Math.round(performance.now() - started) }; }
}
async function http(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  await response.arrayBuffer();
  return { status: response.status };
}
const results = await Promise.all([
  measure('render_health', () => http(`${base}/health`)),
  measure('native_session_without_credentials', () => http(`${base}/auth/session`, {
    method: 'POST', headers: { Origin: 'capacitor://localhost', 'Content-Type': 'application/json' },
    body: JSON.stringify({ create: false }),
  })),
  measure('supabase_auth_health', () => http(`${env.SUPABASE_URL}/auth/v1/health`, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY } })),
  measure('supabase_signing_keys', () => http(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)),
  measure('database_connect_and_select', async () => {
    const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 5000 });
    try { await client.connect(); await client.query('SELECT 1'); return { ok: true }; }
    finally { await client.end().catch(() => {}); }
  }),
  measure('native_websocket_open', () => new Promise((resolve, reject) => {
    const socket = new WebSocket(base.replace('https:', 'wss:') + '/ws', { origin: 'capacitor://localhost', handshakeTimeout: 15000 });
    socket.once('open', () => { resolve({ ok: true }); socket.close(); });
    socket.once('error', reject);
  })),
]);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
if (results.some(result => result.error)) process.exitCode = 1;
