import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createAuthHttpHandler } from './auth-http.js';
import { normalizeAddress, requestClient } from './client-address.js';
import { authConfiguration, createAuthService } from './auth.js';

function fixture({ renderProxy = true, sessionError } = {}) {
  let time = 0;
  const calls = [], logs = [];
  const auth = {
    config: { origins: new Set(['capacitor://localhost', 'https://game.test']), secureCookies: true, renderProxy },
    session: async (refresh, captcha) => {
      calls.push({ refresh, captcha });
      if (sessionError) throw sessionError;
      return { accessToken: 'access', refreshToken: 'rotated', expiresAt: 100000,
        player: { id: 'private', publicCode: 'public', nickname: 'Guest' } };
    },
    deleteAccount: async () => ({ id: 'private' }),
  };
  const handler = createAuthHttpHandler(auth, { now: () => time, log: message => logs.push(message) });
  return {
    calls, logs, advance: ms => { time += ms; },
    async request({ visitor = '198.51.100.1', peer = '10.0.0.1', body = { create: true, captchaToken: 'proof' },
      origin = 'capacitor://localhost', method = 'POST', url = '/auth/session', headers = {} } = {}) {
      const req = Readable.from([JSON.stringify(body)]);
      Object.assign(req, { method, url, socket: { remoteAddress: peer },
        headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': visitor, ...headers } });
      const response = { headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
        writeHead(status, values) { this.status = status; for (const [key, value] of Object.entries(values)) this.setHeader(key, value); },
        end(data) { this.body = data ? JSON.parse(data) : null; } };
      await handler(req, response);
      return response;
    },
  };
}

test('Render ingress separates visitors sharing a socket peer and keeps existing sessions usable after creation cap', async () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) assert.equal((await f.request()).status, 200);
  const limited = await f.request();
  assert.equal(limited.status, 429);
  assert.deepEqual(limited.body, { error: 'RATE_LIMITED', scope: 'guest_creation', retryAfterSeconds: 3600 });
  assert.equal(limited.headers['retry-after'], '3600');
  assert.equal(limited.headers['access-control-expose-headers'], 'Retry-After');
  assert.equal((await f.request({ visitor: '198.51.100.2' })).status, 200);
  assert.equal((await f.request({ body: { refreshToken: 'saved-token' } })).status, 200);
  assert.deepEqual(f.calls.at(-1), { refresh: 'saved-token', captcha: undefined });
  assert.deepEqual(f.logs, ['Auth limiter address source: render-client']);
  f.advance(12500);
  assert.equal((await f.request()).headers['retry-after'], '3588');
  f.advance(3600000 - 12500);
  assert.equal((await f.request()).status, 200);
});

test('spoofed forwarding chains cannot bypass the trusted visitor bucket', async () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) {
    assert.equal((await f.request({ headers: { 'x-forwarded-for': `203.0.113.${i + 1}, 198.51.100.1` } })).status, 200);
  }
  assert.equal((await f.request({ headers: { 'x-forwarded-for': '203.0.113.99' } })).status, 429);
  for (const options of [{ renderProxy: true, peer: '203.0.113.1' }, { renderProxy: false, peer: '10.0.0.1' }]) {
    const direct = fixture(options);
    for (let i = 0; i < 10; i++) assert.equal((await direct.request({ peer: options.peer, visitor: `198.51.100.${i + 1}` })).status, 200);
    assert.equal((await direct.request({ peer: options.peer, visitor: '198.51.100.99' })).status, 429);
  }
});

test('missing or malformed trusted headers fall back to socket rather than caller X-Forwarded-For', async () => {
  const f = fixture();
  for (const visitor of [undefined, '', 'invalid', '198.51.100.1, 198.51.100.2', ['198.51.100.1'], 'fe80::1%eth0']) {
    const req = { socket: { remoteAddress: '::ffff:10.0.0.1' }, headers: { 'cf-connecting-ip': visitor, 'x-forwarded-for': '198.51.100.1' } };
    assert.deepEqual(requestClient(req, { renderProxy: true }), { address: '10.0.0.1', source: 'socket-peer' });
  }
  for (let i = 0; i < 10; i++) assert.equal((await f.request({ visitor: 'invalid' })).status, 200);
  assert.equal((await f.request({ visitor: '' })).status, 429);
});

test('canonical IPv6 and mapped IPv4 aliases share their network quota', async () => {
  assert.equal(normalizeAddress('::ffff:c000:201'), '192.0.2.1');
  assert.equal(normalizeAddress('::ffff:192.0.2.1'), '192.0.2.1');
  const f = fixture();
  for (let i = 0; i < 10; i++) assert.equal((await f.request({ visitor: i % 2 ? '2001:db8::1' : '2001:0DB8:0:0:0:0:0:1' })).status, 200);
  assert.equal((await f.request({ visitor: '2001:db8::1' })).status, 429);
});

test('request cap still protects refresh and deletion; denied origins and preflights do not consume it', async () => {
  const f = fixture();
  for (let i = 0; i < 35; i++) {
    assert.equal((await f.request({ origin: 'https://evil.test' })).status, 403);
    assert.equal((await f.request({ method: 'OPTIONS' })).status, 204);
  }
  for (let i = 0; i < 30; i++) assert.equal((await f.request({ body: { refreshToken: 'saved' } })).status, 200);
  const response = await f.request({ method: 'DELETE', url: '/auth/account', body: { refreshToken: 'saved' } });
  assert.equal(response.status, 429);
  assert.equal(response.body.scope, 'requests');
  assert.equal(response.headers['retry-after'], '60');
  assert.equal((await f.request({ visitor: '198.51.100.2', body: { refreshToken: 'saved' } })).status, 200);
  f.advance(60000);
  assert.equal((await f.request({ body: { refreshToken: 'saved' } })).status, 200);
});

test('failed creations consume the guest cap and CAPTCHA proof is forwarded unchanged', async () => {
  const f = fixture({ sessionError: new Error('CAPTCHA failed') });
  for (let i = 0; i < 10; i++) assert.equal((await f.request()).status, 401);
  assert.equal((await f.request()).status, 429);
  assert.equal(f.calls.length, 10);
  assert.equal(f.calls[0].captcha, 'proof');
});

test('upstream 429 remains distinguishable without leaking provider error details or inventing an expiry', async () => {
  const f = fixture({ sessionError: Object.assign(new Error('private provider credentials'), { status: 429 }) });
  const response = await f.request();
  assert.equal(response.status, 429);
  assert.deepEqual(response.body, { error: 'RATE_LIMITED', scope: 'upstream' });
  assert.equal(response.headers['retry-after'], undefined);
});

test('Supabase service preserves rate-limit status for signup and refresh before any database lookup', async t => {
  const originalFetch = globalThis.fetch;
  const service = createAuthService({ url: 'https://example.supabase.co', key: 'public-test-key', secretKey: 'secret-test-key', databaseUrl: 'postgres://localhost/db' });
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ code: 'over_request_rate_limit', msg: 'Too many requests' }), { status: 429, headers: { 'content-type': 'application/json' } });
  };
  t.after(async () => { globalThis.fetch = originalFetch; await service.close(); });
  for (const run of [() => service.session(undefined, 'captcha-proof'), () => service.session('saved-token'), () => service.deleteAccount('saved-token')]) {
    await assert.rejects(run, error => error.status === 429);
  }
  assert.equal(requests[0].body.gotrue_meta_security.captcha_token, 'captcha-proof');
  assert.equal(requests[1].body.refresh_token, 'saved-token');
});

test('Render trust is enabled only by the runtime marker', () => {
  const env = { AUTH_MODE: 'required', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SECRET_KEY: 'secret', DATABASE_URL: 'postgres://localhost/db', AUTH_ALLOWED_ORIGINS: 'capacitor://localhost' };
  assert.equal(authConfiguration(env).renderProxy, false);
  assert.equal(authConfiguration({ ...env, RENDER: 'false' }).renderProxy, false);
  assert.equal(authConfiguration({ ...env, RENDER: 'true' }).renderProxy, true);
});
