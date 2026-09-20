import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import pg from 'pg';
import { createGuestPlayer } from './identity.js';

export function authConfiguration(env = process.env) {
  const mode = env.AUTH_MODE || 'legacy';
  if (!['legacy', 'required'].includes(mode)) throw new Error('Invalid AUTH_MODE');
  if (mode === 'legacy') {
    if (env.SUPABASE_URL || env.DATABASE_URL) throw new Error('Set AUTH_MODE=required when configuring authentication');
    return null;
  }
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'DATABASE_URL', 'AUTH_ALLOWED_ORIGINS']) {
    if (!env[name]) throw new Error(`Missing ${name}`);
  }
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) throw new Error('Missing SUPABASE_SECRET_KEY');
  const url = new URL(env.SUPABASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/') throw new Error('Invalid Supabase URL');
  const database = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('Invalid database URL');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) && database.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error('Remote database requires sslmode=verify-full');
  }
  const origins = new Set(env.AUTH_ALLOWED_ORIGINS.split(',').map(v => v.trim()));
  if (origins.has('*') || origins.has('null') || origins.has('')) throw new Error('Explicit origins required');
  return { url: url.origin, key: env.SUPABASE_PUBLISHABLE_KEY, secretKey, databaseUrl: env.DATABASE_URL, origins,
    secureCookies: env.AUTH_INSECURE_LOCALHOST !== 'true' };
}

export async function verifyAccessToken(token, { issuer, key }) {
  if (typeof token !== 'string' || token.length > 8192) throw new Error('Invalid token');
  const { payload } = await jwtVerify(token, key, {
    issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'],
    requiredClaims: ['sub', 'exp', 'iat', 'session_id'], clockTolerance: 5,
  });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (payload.role !== 'authenticated' || !uuid.test(payload.sub) || !uuid.test(payload.session_id)) throw new Error('Invalid identity');
  return payload;
}

export function createIdentityStore(pool) {
  return {
    async resolve(claims) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Auth session removal (sign-out/revocation) and disabled users invalidate access immediately.
        const valid = await client.query('SELECT daeguk_private.session_is_active($1,$2) AS active', [claims.session_id, claims.sub]);
        if (!valid.rows[0]?.active) throw new Error('Session revoked');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${claims.iss}:${claims.sub}`]);
        let found = await client.query(`SELECT p.id, p.public_code AS "publicCode", p.nickname, p.status
          FROM daeguk_private.players p JOIN daeguk_private.identities i ON i.player_id=p.id
          WHERE i.issuer=$1 AND i.subject=$2`, [claims.iss, claims.sub]);
        if (!found.rowCount) {
          let player;
          for (let attempt = 0; attempt < 5; attempt++) {
            player = createGuestPlayer();
            const inserted = await client.query(`INSERT INTO daeguk_private.players(id, public_code, nickname)
              VALUES($1,$2,$3) ON CONFLICT(public_code) DO NOTHING RETURNING id`, [player.id, player.publicCode, player.nickname]);
            if (inserted.rowCount) break;
            player = null;
          }
          if (!player) throw new Error('Player allocation failed');
          await client.query('INSERT INTO daeguk_private.identities(player_id,issuer,subject) VALUES($1,$2,$3)', [player.id, claims.iss, claims.sub]);
          found = { rows: [player] };
        }
        if (found.rows[0].status !== 'active') throw new Error('Player disabled');
        await client.query('COMMIT');
        return found.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    async remove(claims, playerId) {
      const result = await pool.query(
        'SELECT daeguk_private.delete_player_identity($1,$2,$3) AS deleted',
        [claims.iss, claims.sub, playerId],
      );
      if (result.rows[0]?.deleted !== true) throw new Error('Player identity not found');
    },
  };
}

export function createAuthService(config) {
  // Never disable TLS certificate validation; use the Supabase pooler URL with sslmode=verify-full.
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5, connectionTimeoutMillis: 5000,
    statement_timeout: 5000, idle_in_transaction_session_timeout: 10000 });
  pool.on('error', () => console.error('Authentication database connection failed'));
  const issuer = `${config.url}/auth/v1`;
  const key = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { timeoutDuration: 5000 });
  const store = createIdentityStore(pool);
  const client = () => createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
  });
  const admin = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
  });
  return {
    config,
    async authenticate(token) {
      const claims = await verifyAccessToken(token, { issuer, key });
      return { player: await store.resolve(claims), expiresAt: claims.exp * 1000 };
    },
    async session(refreshToken, captchaToken) {
      const auth = client().auth;
      const result = refreshToken
        ? await auth.refreshSession({ refresh_token: refreshToken })
        : await auth.signInAnonymously({ options: { captchaToken } });
      if (result.error || !result.data.session) throw new Error('Authentication failed');
      const session = result.data.session;
      const identity = await this.authenticate(session.access_token);
      return { ...identity, accessToken: session.access_token, refreshToken: session.refresh_token };
    },
    async deleteAccount(refreshToken) {
      if (typeof refreshToken !== 'string' || !refreshToken) throw new Error('Session required');
      const result = await client().auth.refreshSession({ refresh_token: refreshToken });
      if (result.error || !result.data.session?.user?.id) throw new Error('Authentication failed');
      const session = result.data.session;
      const claims = await verifyAccessToken(session.access_token, { issuer, key });
      if (session.user.id !== claims.sub) throw new Error('Identity mismatch');
      const player = await store.resolve(claims);
      const deleted = await admin.auth.admin.deleteUser(claims.sub, false);
      if (deleted.error) throw new Error('Account deletion failed');
      await store.remove(claims, player.id);
      return player;
    },
    close: () => pool.end(),
  };
}
