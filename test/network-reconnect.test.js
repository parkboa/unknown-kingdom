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

test("a server instance change voids the saved match and returns to the lobby", async () => {
  FakeSocket.instances = [];
  const storage = memoryStorage();
  const received = [];
  storage.setItem("daeguk.online.resume.v1", JSON.stringify({
    roomCode: "ABC123", boardNumber: 7, player: "black", publicCode: profile.publicCode,
    serverInstanceId: "server-before-restart",
  }));
  const session = connectNetwork({ type: "list_rooms", protocolVersion: 3 }, {
    url: "wss://game.test/ws", connectingMessage: "connecting", disconnectedMessage: "disconnected",
    unavailableMessage: "unavailable", invalidMessage: "invalid", onStatus() {},
    onMessage: message => received.push(message), onClose() {}, getIdentity: async () => identity,
    WebSocketImpl: FakeSocket, storage, reconnectDelays: [],
  });
  await tick();
  const socket = FakeSocket.instances[0];
  socket.receive({ type: "authenticated", player: profile, expiresAt: identity.expiresAt, serverInstanceId: "server-after-restart" });
  assert.deepEqual(socket.sent[1], {
    type: "resume_room", roomCode: "ABC123", protocolVersion: 3, serverInstanceId: "server-before-restart",
  });
  const voided = { type: "match_voided", reason: "server_restart", roomCode: "ABC123", serverInstanceId: "server-after-restart" };
  socket.receive(voided);
  assert.deepEqual(received, [voided]);
  assert.equal(session.matchVoided, true);
  assert.equal(session.roomCode, "");
  assert.equal(storage.getItem("daeguk.online.resume.v1"), null);
  assert.deepEqual(socket.sent[2], { type: "list_rooms" });
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
