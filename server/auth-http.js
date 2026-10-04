import { publicPlayer } from './identity.js';
import { requestClient, ingressSummary } from './client-address.js';

export function fixedWindowLimiter({ limit, intervalMs, maxKeys = 10000, now = Date.now }) {
  const windows = new Map();
  const allow = key => {
    const time = now();
    for (const [id, window] of windows) if (time >= window.until) windows.delete(id);
    let window = windows.get(key);
    if (!window) {
      if (windows.size >= maxKeys) return false;
      window = { count: 0, until: time + intervalMs };
      windows.set(key, window);
    }
    return ++window.count <= limit;
  };
  allow.retryAfter = key => Math.max(1, Math.ceil(((windows.get(key)?.until ?? now() + intervalMs) - now()) / 1000));
  return allow;
}

export function createAuthHttpHandler(auth, { onAccountDeleted = () => {}, now = Date.now, log = console.info } = {}) {
  const allowRequest = fixedWindowLimiter({ limit: 30, intervalMs: 60000, now });
  // Keep a per-network creation limit, with room for account-deletion verification.
  const allowGuest = fixedWindowLimiter({ limit: 10, intervalMs: 3600000, now });
  const reportedSources = new Set();
  return async (req, res) => {
    if (!req.url?.startsWith('/auth/')) return false;
    const reply = (status, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
      res.end(status === 204 ? undefined : JSON.stringify(body));
    };
    if (!auth) { reply(503, { error: 'AUTH_NOT_CONFIGURED' }); return true; }
    const origin = req.headers.origin;
    if (!auth.config.origins.has(origin)) { reply(403, { error: 'ORIGIN_DENIED' }); return true; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      reply(204, null); return true;
    }
    const client = requestClient(req, auth.config);
    const ip = client.address;
    const summary = auth.config.renderProxy ? JSON.stringify(ingressSummary(req)) : '';
    const classification = `${client.source} ${summary}`;
    if (auth.config.renderProxy && !reportedSources.has(classification) && reportedSources.size < 16) {
      reportedSources.add(classification);
      // Log the ingress classification once, never addresses, credentials or bodies.
      log(`Auth limiter address source: ${classification}`);
    }
    const limited = (scope, limiter) => {
      const retryAfterSeconds = limiter.retryAfter(ip);
      reply(429, { error: 'RATE_LIMITED', scope, retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });
    };
    if (!allowRequest(ip)) { limited('requests', allowRequest); return true; }
    const sessionRequest = req.url === '/auth/session' && req.method === 'POST';
    const deletionRequest = req.url === '/auth/account' && req.method === 'DELETE';
    if (!sessionRequest && !deletionRequest) { reply(404, { error: 'NOT_FOUND' }); return true; }
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') { reply(415, { error: 'JSON_REQUIRED' }); return true; }
    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 8192) { reply(413, { error: 'BODY_TOO_LARGE' }); return true; }
      }
      const body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
      const native = origin === 'capacitor://localhost';
      const cookieName = auth.config.secureCookies ? '__Host-daeguk-refresh' : 'daeguk-refresh';
      const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`));
      const refresh = native ? body.refreshToken : cookie?.slice(cookieName.length + 1);
      if (refresh !== undefined && (typeof refresh !== 'string' || !/^[A-Za-z0-9._~-]{1,4096}$/.test(refresh))) throw new Error('Invalid refresh');
      if (deletionRequest) {
        if (!refresh) { reply(401, { error: 'NO_SESSION' }); return true; }
        const player = await auth.deleteAccount(refresh);
        await onAccountDeleted(player);
        if (!native) res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${auth.config.secureCookies ? '; Secure' : ''}`);
        reply(204, null);
        return true;
      }
      if (!refresh && body.create !== true) { reply(401, { error: 'NO_SESSION' }); return true; }
      if (!refresh && !allowGuest(ip)) { limited('guest_creation', allowGuest); return true; }
      if (body.captchaToken !== undefined && (typeof body.captchaToken !== 'string' || body.captchaToken.length > 4096)) throw new Error('Invalid captcha');
      const session = await auth.session(refresh, body.captchaToken);
      const data = { accessToken: session.accessToken, expiresAt: session.expiresAt, player: publicPlayer(session.player) };
      if (native) data.refreshToken = session.refreshToken;
      else res.setHeader('Set-Cookie', `${cookieName}=${session.refreshToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=2592000${auth.config.secureCookies ? '; Secure' : ''}`);
      reply(200, data);
    } catch (error) {
      if (error?.status === 429) reply(429, { error: 'RATE_LIMITED', scope: 'upstream' });
      else reply(401, { error: 'AUTH_FAILED' });
    }
    return true;
  };
}
