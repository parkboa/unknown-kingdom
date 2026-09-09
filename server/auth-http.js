import { publicPlayer } from './identity.js';

export function fixedWindowLimiter({ limit, intervalMs, maxKeys = 10000, now = Date.now }) {
  const windows = new Map();
  return key => {
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
}

export function createAuthHttpHandler(auth) {
  const allowRequest = fixedWindowLimiter({ limit: 30, intervalMs: 60000 });
  const allowGuest = fixedWindowLimiter({ limit: 5, intervalMs: 3600000 });
  return async (req, res) => {
    if (!req.url?.startsWith('/auth/')) return false;
    const reply = (status, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
      res.end(JSON.stringify(body));
    };
    if (!auth) { reply(503, { error: 'AUTH_NOT_CONFIGURED' }); return true; }
    const origin = req.headers.origin;
    if (!auth.config.origins.has(origin)) { reply(403, { error: 'ORIGIN_DENIED' }); return true; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      reply(204, null); return true;
    }
    // Do not trust arbitrary X-Forwarded-For headers. Edge CAPTCHA provides per-user abuse protection
    // behind proxies; this additional limit intentionally uses the actual socket peer.
    const ip = req.socket.remoteAddress;
    if (!allowRequest(ip)) { reply(429, { error: 'RATE_LIMITED' }); return true; }
    if (req.url !== '/auth/session' || req.method !== 'POST') { reply(404, { error: 'NOT_FOUND' }); return true; }
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
      if (!refresh && body.create !== true) { reply(401, { error: 'NO_SESSION' }); return true; }
      if (!refresh && !allowGuest(ip)) { reply(429, { error: 'RATE_LIMITED' }); return true; }
      if (body.captchaToken !== undefined && (typeof body.captchaToken !== 'string' || body.captchaToken.length > 4096)) throw new Error('Invalid captcha');
      const session = await auth.session(refresh, body.captchaToken);
      const data = { accessToken: session.accessToken, expiresAt: session.expiresAt, player: publicPlayer(session.player) };
      if (native) data.refreshToken = session.refreshToken;
      else res.setHeader('Set-Cookie', `${cookieName}=${session.refreshToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=2592000${auth.config.secureCookies ? '; Secure' : ''}`);
      reply(200, data);
    } catch { reply(401, { error: 'AUTH_FAILED' }); }
    return true;
  };
}
