import test from "node:test";
import assert from "node:assert/strict";

import { createGameState, stateForPlayer } from "../packages/game-engine/src/index.js";
import { connectNetwork, disconnectNetwork } from "../js/network.js";

class FakeSocket {
  static OPEN = 1;
  static instances = [];

  constructor() {
    this.readyState = FakeSocket.OPEN;
    this.listeners = new Map();
    this.sent = [];
    FakeSocket.instances.push(this);
    queueMicrotask(() => this.emit("open", {}));
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(raw) {
    this.sent.push(JSON.parse(raw));
  }

  receive(value) {
    this.emit("message", { data: JSON.stringify(value) });
  }

  close(code = 1000) {
    if (this.readyState !== FakeSocket.OPEN) return;
    this.readyState = 3;
    this.emit("close", { code });
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

const identity = {
  accessToken: "access-token",
  expiresAt: Date.now() + 300000,
};
const profile = { publicCode: "PUBLIC-ALICE", nickname: "Guest" };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function lobbyOptions(overrides = {}) {
  return {
    url: 'wss://game.test/ws', connectingMessage: 'connecting',
    reconnectingMessage: 'reconnecting', disconnectedMessage: 'disconnected',
    unavailableMessage: 'unavailable', invalidMessage: 'invalid',
    onStatus() {}, onMessage() {}, onClose() {},
    getIdentity: async () => identity, WebSocketImpl: FakeSocket,
    storage: memoryStorage(), ...overrides,
  };
}

class SlowClosingSocket extends FakeSocket {
  close() { this.readyState = 2; }
  finishClose() { this.readyState = 3; this.emit('close', { code: 1000 }); }
}

test('rapid lobby reentry waits for the old close handshake and ignores its late events', async () => {
  FakeSocket.instances = [];
  const oldMessages = [], oldStatuses = [], oldCloses = [];
  const first = connectNetwork({ type: 'list_rooms' }, lobbyOptions({
    WebSocketImpl: SlowClosingSocket,
    onMessage: message => oldMessages.push(message),
    onStatus: status => oldStatuses.push(status),
    onClose: () => oldCloses.push(true),
  }));
  await tick();
  const old = first.socket;
  old.receive({ type: 'authenticated', player: profile });
  disconnectNetwork(first);
  const second = connectNetwork({ type: 'list_rooms' }, lobbyOptions());
  await tick();
  assert.equal(FakeSocket.instances.length, 1);
  old.receive({ type: 'room_list', rooms: [] });
  old.emit('error', {});
  assert.deepEqual(oldMessages, []);
  assert.deepEqual(oldStatuses, ['connecting']);
  old.finishClose();
  await tick();
  assert.equal(FakeSocket.instances.length, 2);
  assert.deepEqual(oldCloses, []);
  assert.equal(second.socket.sent[0].type, 'authenticate');
  disconnectNetwork(second);
});

test('going back again while awaiting the previous close never opens a cancelled connection', async () => {
  FakeSocket.instances = [];
  const first = connectNetwork({ type: 'list_rooms' }, lobbyOptions({ WebSocketImpl: SlowClosingSocket }));
  await tick();
  disconnectNetwork(first);
  const cancelled = connectNetwork({ type: 'list_rooms' }, lobbyOptions());
  await tick();
  disconnectNetwork(cancelled);
  const current = connectNetwork({ type: 'list_rooms' }, lobbyOptions());
  first.socket.finishClose();
  await tick();
  assert.equal(FakeSocket.instances.length, 2);
  assert.equal(cancelled.socket, null);
  assert.equal(current.socket.sent[0].type, 'authenticate');
  disconnectNetwork(current);
});

test('a stalled close fails within a bound instead of opening a duplicate socket', async () => {
  FakeSocket.instances = [];
  const first = connectNetwork({ type: 'list_rooms' }, lobbyOptions({ WebSocketImpl: SlowClosingSocket }));
  await tick();
  disconnectNetwork(first);
  const statuses = [];
  const second = connectNetwork({ type: 'list_rooms' }, lobbyOptions({
    closeWaitMs: 5, onStatus: status => statuses.push(status),
  }));
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.deepEqual(statuses, ['connecting', 'unavailable (CLOSE_PENDING)']);
  assert.equal(second.socket, null);
  assert.equal(FakeSocket.instances.length, 1);
  first.socket.finishClose();
  disconnectNetwork(second);
});

test('lobby transport failures retry only the configured number of times', async () => {
  FakeSocket.instances = [];
  const statuses = [];
  const messages = [];
  const session = connectNetwork({ type: 'list_rooms' }, lobbyOptions({
    lobbyReconnectDelays: [0, 0], onStatus: status => statuses.push(status),
    onMessage: message => messages.push(message),
  }));
  await tick();
  for (let attempt = 0; attempt < 3; attempt++) {
    const old = session.socket;
    old.close(1006);
    old.receive({ type: 'room_list', rooms: [] });
    await tick(); await tick();
  }
  assert.equal(FakeSocket.instances.length, 3);
  assert.deepEqual(messages, []);
  assert.deepEqual(statuses, ['connecting', 'reconnecting', 'reconnecting', 'disconnected (1006)']);
  disconnectNetwork(session);
});

test('credential rejection and mutating lobby commands are never automatically replayed', async () => {
  for (const [type, code] of [['list_rooms', 4401], ['create_room', 1006], ['join_room', 1006]]) {
    FakeSocket.instances = [];
    const statuses = [];
    const session = connectNetwork({ type }, lobbyOptions({
      lobbyReconnectDelays: [0], onStatus: status => statuses.push(status),
    }));
    await tick();
    session.socket.close(code);
    await tick(); await tick();
    assert.equal(FakeSocket.instances.length, 1);
    assert.equal(statuses.at(-1), `disconnected (${code})`);
    disconnectNetwork(session);
  }
});

test('a pending identity refresh cannot authenticate after going back', async () => {
  FakeSocket.instances = [];
  let finishRefresh, calls = 0;
  const session = connectNetwork({ type: 'list_rooms' }, lobbyOptions({
    getIdentity: async () => ++calls === 1
      ? { ...identity, expiresAt: Date.now() + 45000 }
      : new Promise(resolve => { finishRefresh = resolve; }),
    WebSocketImpl: SlowClosingSocket,
  }));
  await tick();
  session.socket.receive({ type: 'authenticated', player: profile });
  await new Promise(resolve => setTimeout(resolve, 1050));
  assert.equal(calls, 2);
  const socket = session.socket;
  disconnectNetwork(session);
  // A late native refresh result must be ignored even if close has not reached the peer.
  socket.readyState = FakeSocket.OPEN;
  finishRefresh(identity);
  await tick();
  assert.equal(socket.sent.filter(message => message.type === 'authenticate').length, 1);
  socket.finishClose();
});

test('a stalled WebSocket authentication has a deadline and ignores late success', async () => {
  FakeSocket.instances = [];
  const statuses = [], messages = [];
  const session = connectNetwork({ type: 'list_rooms' }, lobbyOptions({
    connectionTimeoutMs: 10, onStatus: status => statuses.push(status),
    onMessage: message => messages.push(message),
  }));
  await new Promise(resolve => setTimeout(resolve, 25));
  session.socket.receive({ type: 'authenticated', player: profile });
  session.socket.receive({ type: 'room_list', rooms: [] });
  assert.equal(session.connected, false);
  assert.deepEqual(messages, []);
  assert.equal(statuses.at(-1), 'unavailable (CONNECTION_TIMEOUT)');
  disconnectNetwork(session);
});

test("unexpected socket closure resumes the saved room instead of creating a new match", async () => {
  FakeSocket.instances = [];
  const storage = memoryStorage();
  const closeEvents = [];
  const session = connectNetwork({ type: "create_room", protocolVersion: 3 }, {
    url: "wss://game.test/ws",
    connectingMessage: "connecting",
    reconnectingMessage: "reconnecting",
    disconnectedMessage: "disconnected",
    unavailableMessage: "unavailable",
    invalidMessage: "invalid",
    onStatus() {},
    onMessage() {},
    onClose: (_session, details) => closeEvents.push(details),
    getIdentity: async () => identity,
    WebSocketImpl: FakeSocket,
    storage,
    reconnectDelays: [0],
  });

  await tick();
  const first = FakeSocket.instances[0];
  assert.equal(first.sent[0].type, "authenticate");
  first.receive({ type: "authenticated", player: profile, expiresAt: identity.expiresAt, serverInstanceId: "server-before-restart" });
  assert.equal(first.sent[1].type, "create_room");
  first.receive({ type: "room_created", roomCode: "ABC123", boardNumber: 7, player: "black" });
  const visibleState = stateForPlayer(createGameState(), "black");
  first.receive({
    type: "match_start",
    roomCode: "ABC123",
    boardNumber: 7,
    player: "black",
    opponentConnected: true,
    state: visibleState,
  });

  first.close(1006);
  await tick();
  await tick();
  const second = FakeSocket.instances[1];
  assert.deepEqual(closeEvents, [{ reconnecting: true }]);
  second.receive({ type: "authenticated", player: profile, expiresAt: identity.expiresAt, serverInstanceId: "server-after-restart" });
  assert.deepEqual(second.sent[1], { type: "resume_room", roomCode: "ABC123", protocolVersion: 3, serverInstanceId: "server-before-restart" });

  disconnectNetwork(session);
});

test("a fresh online session uses the persisted resume ticket after a reload", async () => {
  FakeSocket.instances = [];
  const storage = memoryStorage();
  storage.setItem("daeguk.online.resume.v1", JSON.stringify({
    roomCode: "ABC123",
    boardNumber: 7,
    player: "black",
    publicCode: profile.publicCode,
  }));
  const session = connectNetwork({ type: "list_rooms", protocolVersion: 3 }, {
    url: "wss://game.test/ws",
    connectingMessage: "connecting",
    disconnectedMessage: "disconnected",
    unavailableMessage: "unavailable",
    invalidMessage: "invalid",
    onStatus() {},
    onMessage() {},
    onClose() {},
    getIdentity: async () => identity,
    WebSocketImpl: FakeSocket,
    storage,
    reconnectDelays: [],
  });

  await tick();
  const socket = FakeSocket.instances[0];
  socket.receive({ type: "authenticated", player: profile, expiresAt: identity.expiresAt });
  assert.deepEqual(socket.sent[1], { type: "resume_room", roomCode: "ABC123", protocolVersion: 3 });
  socket.receive({ type: "error", message: "Resume unavailable." });
  assert.deepEqual(socket.sent[2], { type: "list_rooms" });
  assert.equal(storage.getItem("daeguk.online.resume.v1"), null);
  disconnectNetwork(session);
});

test("a server instance change voids the saved match and returns to the lobby", async () => {
  FakeSocket.instances = [];
  const storage = memoryStorage();
  const received = [];
  storage.setItem("daeguk.online.resume.v1", JSON.stringify({
    roomCode: "ABC123",
    boardNumber: 7,
    player: "black",
    publicCode: profile.publicCode,
    serverInstanceId: "server-before-restart",
  }));
  const session = connectNetwork({ type: "list_rooms", protocolVersion: 3 }, {
    url: "wss://game.test/ws",
    connectingMessage: "connecting",
    disconnectedMessage: "disconnected",
    unavailableMessage: "unavailable",
    invalidMessage: "invalid",
    onStatus() {},
    onMessage: message => received.push(message),
    onClose() {},
    getIdentity: async () => identity,
    WebSocketImpl: FakeSocket,
    storage,
    reconnectDelays: [],
  });

  await tick();
  const socket = FakeSocket.instances[0];
  socket.receive({
    type: "authenticated",
    player: profile,
    expiresAt: identity.expiresAt,
    serverInstanceId: "server-after-restart",
  });
  assert.deepEqual(socket.sent[1], {
    type: "resume_room",
    roomCode: "ABC123",
    protocolVersion: 3,
    serverInstanceId: "server-before-restart",
  });

  const voided = {
    type: "match_voided",
    reason: "server_restart",
    roomCode: "ABC123",
    serverInstanceId: "server-after-restart",
  };
  socket.receive(voided);

  assert.deepEqual(received, [voided]);
  assert.equal(session.matchVoided, true);
  assert.equal(session.roomCode, "");
  assert.equal(storage.getItem("daeguk.online.resume.v1"), null);
  assert.deepEqual(socket.sent[2], { type: "list_rooms" });
  disconnectNetwork(session);
});
