import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/server.js';
import { createGuestAuth } from '../js/auth.js';
import { connectNetwork, disconnectNetwork } from '../js/network.js';

test('repeated lobby back/reentry with delayed close frames keeps the same identity', async t => {
  const origin = 'capacitor://localhost';
  const expiresAt = Date.now() + 300000;
  const player = { id: 'test-player', publicCode: 'TEST-SAME-ID', nickname: 'Guest', status: 'active' };
  let authRequests = 0;
  const auth = createGuestAuth({ config: { nativeBase: 'https://auth.test' }, native: true, locks: null,
    secureStorage: { get: async () => ({ value: 'test-refresh' }), set: async () => {} },
    fetcher: async () => {
      authRequests++;
      return { status: 200, ok: true, json: async () => ({
        accessToken: 'test-access', refreshToken: 'test-refresh-next', expiresAt, player,
      }) };
    },
  });
  const app = createGameServer({ authService: {
    config: { origins: new Set([origin]), secureCookies: true },
    authenticate: async token => { assert.equal(token, 'test-access'); return { player, expiresAt }; },
  }, env: { PORT: '0' } });
  const sessions = [];
  t.after(async () => {
    for (const session of sessions) disconnectNetwork(session);
    await app.close();
  });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const url = `ws://127.0.0.1:${app.server.address().port}/ws`;
  class NativeSocket extends WebSocket { constructor(address) { super(address, { origin }); } }
  async function enterLobby() {
    let session, timer;
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Lobby timeout')), 3000);
      session = connectNetwork({ type: 'list_rooms' }, {
        url, connectingMessage: 'connecting', disconnectedMessage: 'disconnected',
        unavailableMessage: 'unavailable', invalidMessage: 'invalid',
        getIdentity: () => auth.getSession(), WebSocketImpl: NativeSocket, storage: null,
        onClose: () => {},
        onStatus: status => { if (status !== 'connecting') reject(new Error(status)); },
        onMessage: message => { if (message.type === 'room_list') resolve(); },
      });
      sessions.push(session);
    }).finally(() => clearTimeout(timer));
    assert.equal(session.profile.publicCode, player.publicCode);
    return session;
  }
  let current = await enterLobby();
  for (let repeat = 0; repeat < 10; repeat++) {
    const old = current.socket;
    const write = old._socket.write.bind(old._socket);
    // Simulate delayed delivery of the close frame; all auth and game socket code is real.
    old._socket.write = (...args) => { setTimeout(() => write(...args), 300); return true; };
    disconnectNetwork(current);
    assert.equal(old.readyState, WebSocket.CLOSING);
    current = await enterLobby();
    assert.equal(old.readyState, WebSocket.CLOSED);
    assert.equal(current.connected, true);
  }
  assert.equal(authRequests, 1, 'reentry must reuse the cached identity, without new signups/refresh requests');
});
