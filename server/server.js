import http from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { authConfiguration, createAuthService } from "./auth.js";
import { createAuthHttpHandler, fixedWindowLimiter } from "./auth-http.js";
import { publicPlayer } from "./identity.js";
import { WebSocketServer, WebSocket } from "ws";
import {
  applyAction,
  createGameState,
  dispatchAction,
  hasLegalDeployment,
  isEnclosedPlacement,
  PROTOCOL_VERSION,
  stateForPlayer,
} from "./engine.js";
import { declineRematch, startAutomaticTauntLock } from "./room-actions.js";

export function createGameServer({ authService, env = process.env, serverInstanceId = randomUUID() } = {}) {
const SPECIAL_UNIT_TYPES = new Set(["general", "diplomat", "wizard"]);
const PORT = Number(env.PORT || 4175);
const TAUNT_DISPLAY_MS = 3000;
const TURN_TIMEOUT_MS = 30000;
const configuredReconnectGraceMs = Number(env.RECONNECT_GRACE_MS || 120000);
const RECONNECT_GRACE_MS = Number.isFinite(configuredReconnectGraceMs)
  ? Math.max(1000, configuredReconnectGraceMs)
  : 120000;
const authConfig = authService?.config || authConfiguration(env);
const auth = authService || (authConfig ? createAuthService(authConfig) : null);
const authHttp = createAuthHttpHandler(auth);
const authenticatedSockets = new Map();
const rooms = new Map();
const lobbySockets = new Set();
let nextBoardNumber = 1;
let shuttingDown = false;

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function send(socket, message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function openRoomSummaries() {
  return Array.from(rooms.values())
    .filter((room) => !room.sideChosen && ["black", "white"].some(player => (
      !room.players[player] && !room.seatIds[player]
    )) && Boolean(room.players.black || room.players.white))
    .map((room) => ({
      roomCode: room.code,
      boardNumber: room.boardNumber,
      playerCount: Number(Boolean(room.players.black)) + Number(Boolean(room.players.white)),
    }))
    .sort((a, b) => a.boardNumber - b.boardNumber);
}

function sendRoomList(socket) {
  send(socket, { type: "room_list", rooms: openRoomSummaries(), serverInstanceId });
}

function broadcastRoomList() {
  for (const socket of lobbySockets) sendRoomList(socket);
}

function clearTurnTimer(room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
}

function resetTurnTimer(room, duration = TURN_TIMEOUT_MS) {
  clearTurnTimer(room);
  if (room.state.winner || !room.sideChosen || !room.players.black || !room.players.white) {
    room.turnDeadline = null;
    return;
  }
  const tauntDelay = Math.max(0, Number(room.state.tauntUntil || 0) - Date.now());
  const turnDuration = Math.max(1, duration) + tauntDelay;
  room.turnDeadline = Date.now() + turnDuration;

  room.turnTimer = setTimeout(() => {
    room.turnTimer = null;
    if (rooms.get(room.code) !== room || room.state.winner) return;
    const timedOutPlayer = room.state.turn;
    if (!timedOutPlayer) return;

    if (!hasLegalDeployment(room.state, timedOutPlayer)) {
      applyAction(room.state, timedOutPlayer, { type: "pass" });
    } else {
      dispatchAction(room.state, timedOutPlayer, { type: "timeout" }, { authoritative: true });
    }
    broadcastState(room);
  }, turnDuration);
}

function broadcastState(room, type = "state", { resumePausedTurn = false } = {}) {
  if (type === "match_start" || (room.sideChosen && !room.state.winner)) {
    resetTurnTimer(room, resumePausedTurn && room.pausedTurnMs ? room.pausedTurnMs : TURN_TIMEOUT_MS);
    room.pausedTurnMs = null;
  } else if (room.state.winner) {
    clearTurnTimer(room);
    room.turnDeadline = null;
  }
  for (const player of ["black", "white"]) {
    const socket = room.players[player];
    if (!socket) continue;
    const playerState = stateForPlayer(room.state, player);
    playerState.turnDeadline = room.turnDeadline;
    send(socket, {
      type,
      serverInstanceId,
      roomCode: room.code,
      boardNumber: room.boardNumber,
      player,
      opponentConnected: Boolean(room.players[player === "black" ? "white" : "black"]),
      turnDeadline: room.turnDeadline,
      state: playerState,
    });
  }
}

function clearReconnectTimer(room, player) {
  if (!room.reconnectTimers?.[player]) return;
  clearTimeout(room.reconnectTimers[player]);
  room.reconnectTimers[player] = null;
}

function deleteRoom(room) {
  if (rooms.get(room.code) !== room) return;
  clearTurnTimer(room);
  for (const player of ["black", "white"]) {
    clearReconnectTimer(room, player);
    if (room.players[player]?.membership?.roomCode === room.code) room.players[player].membership = null;
  }
  rooms.delete(room.code);
  broadcastRoomList();
}

function pauseTurnTimer(room) {
  if (room.turnDeadline) {
    room.pausedTurnMs = Math.max(1, room.turnDeadline - Date.now());
  }
  clearTurnTimer(room);
  room.turnDeadline = null;
}

function reserveSeatForReconnect(room, player) {
  clearReconnectTimer(room, player);
  room.reconnectTimers[player] = setTimeout(() => {
    room.reconnectTimers[player] = null;
    if (rooms.get(room.code) !== room || room.players[player]) return;
    const opponent = player === "black" ? "white" : "black";
    send(room.players[opponent], { type: "error", message: "Opponent did not reconnect." });
    deleteRoom(room);
  }, RECONNECT_GRACE_MS);
}

function requestRpsSelection(room) {
  room.rps = { black: null, white: null };
  for (const player of ["black", "white"]) {
    send(room.players[player], {
      type: "rps_start",
      serverInstanceId,
      roomCode: room.code,
      boardNumber: room.boardNumber,
      player,
    });
  }
}

function startAutomaticKingWallTaunt(room, player, action) {
  return startAutomaticTauntLock(room, player, action, Date.now(), TAUNT_DISPLAY_MS);
}

function tauntIsPlaying(room) {
  return Number(room.state.tauntUntil || 0) > Date.now();
}

function leaveRoom(socket, { preserveActiveSeat = false } = {}) {
  const membership = socket.membership;
  if (!membership) return;
  const room = rooms.get(membership.roomCode);
  if (!room) return;
  room.players[membership.player] = null;
  pauseTurnTimer(room);
  const hasStarted = Boolean(
    room.state.deploymentCount?.black > 0
    || room.state.deploymentCount?.white > 0
    || room.state.firstDeployDone?.black
    || room.state.firstDeployDone?.white,
  );
  const canResume = preserveActiveSeat && auth && Boolean(room.seatIds[membership.player]);
  if (!hasStarted && !canResume) {
    room.sideChosen = false;
  }
  const otherPlayer = membership.player === "black" ? "white" : "black";
  if (canResume) {
    send(room.players[otherPlayer], { type: "error", message: "Opponent disconnected." });
    reserveSeatForReconnect(room, membership.player);
  } else if (room.sideChosen) {
    send(room.players[otherPlayer], { type: "error", message: "Opponent did not reconnect." });
    socket.membership = null;
    deleteRoom(room);
    return;
  } else {
    send(room.players[otherPlayer], { type: "error", message: "Opponent disconnected." });
    clearReconnectTimer(room, membership.player);
    room.seatIds[membership.player] = null;
    if (!room.players.black && !room.players.white) deleteRoom(room);
  }
  socket.membership = null;
  broadcastRoomList();
}

const server = http.createServer(async (request, response) => {
  if (await authHttp(request, response)) return;
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  response.writeHead(404);
  response.end("Not found");
});

const webSocketServer = new WebSocketServer({ server, path: "/ws", maxPayload: 16384,
  verifyClient: ({ origin }, done) => done(!authConfig || authConfig.origins.has(origin), 403, "Origin denied") });
webSocketServer.on("connection", (socket) => {
  if (webSocketServer.clients.size > 500) { socket.close(1013, "Server busy"); return; }
  const allowMessage = fixedWindowLimiter({ limit: 60, intervalMs: 10000 });
  const authTimer = auth ? setTimeout(() => socket.close(4401, "Authentication required"), 20000) : null;
  let chain = Promise.resolve();
  let pending = 0;
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });

  async function handleMessage(rawMessage) {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      send(socket, { type: "error", message: "Invalid JSON." });
      return;
    }

    if (!message || typeof message !== "object" || Array.isArray(message)) {
      send(socket, { type: "error", message: "Invalid message." }); return;
    }
    if (auth) {
      if (message.type === "authenticate") {
        try {
          const identity = await auth.authenticate(message.accessToken);
          if (socket.readyState !== WebSocket.OPEN) return;
          if (socket.identity && socket.identity.player.id !== identity.player.id) throw new Error("Identity changed");
          const existing = authenticatedSockets.get(identity.player.id);
          if (existing && existing !== socket) throw new Error("Already connected");
          socket.identity = identity;
          socket.accessToken = message.accessToken;
          authenticatedSockets.set(identity.player.id, socket);
          clearTimeout(authTimer);
          send(socket, { type: "authenticated", player: publicPlayer(identity.player), expiresAt: identity.expiresAt, serverInstanceId });
        } catch { socket.close(4401, "Authentication failed"); }
        return;
      }
      if (!socket.identity || socket.identity.expiresAt <= Date.now()) {
        socket.close(4401, "Authentication required"); return;
      }
      try { await auth.authenticate(socket.accessToken); }
      catch { socket.close(4401, "Session invalid"); return; }
      if (socket.readyState !== WebSocket.OPEN) return;
    }

    if (message.type === "create_room") {
      if (message.protocolVersion !== PROTOCOL_VERSION) {
        send(socket, { type: "error", message: `Unsupported protocol version. Expected ${PROTOCOL_VERSION}.` });
        return;
      }
      if (rooms.size >= 500) { send(socket, { type: "error", message: "Server busy." }); return; }
      leaveRoom(socket);
      lobbySockets.delete(socket);
      const code = roomCode();
      const room = {
        code,
        boardNumber: nextBoardNumber++,
        state: createGameState(),
        players: { black: null, white: null },
        seatIds: { black: socket.identity?.player.id || null, white: null },
        sideChosen: false,
        rematch: new Set(),
        rps: { black: null, white: null },
        reconnectTimers: { black: null, white: null },
        pausedTurnMs: null,
      };
      room.players.black = socket;
      rooms.set(code, room);
      socket.membership = { roomCode: code, player: "black" };
      send(socket, { type: "room_created", roomCode: code, boardNumber: room.boardNumber, player: "black", serverInstanceId });
      broadcastRoomList();
      return;
    }

    if (message.type === "list_rooms") {
      leaveRoom(socket);
      lobbySockets.add(socket);
      sendRoomList(socket);
      return;
    }

    if (message.type === "join_room") {
      if (message.protocolVersion !== PROTOCOL_VERSION) {
        send(socket, { type: "error", message: `Unsupported protocol version. Expected ${PROTOCOL_VERSION}.` });
        return;
      }
      const code = typeof message.roomCode === "string" ? message.roomCode.trim().toUpperCase() : "";
      const room = rooms.get(code);
      if (!room || (room.players.black && room.players.white)) {
        send(socket, { type: "error", message: "Room is unavailable." });
        return;
      }
      const player = room.players.black ? "white" : "black";
      if (auth && room.seatIds[player] && room.seatIds[player] !== socket.identity.player.id) {
        send(socket, { type: "error", message: "Room is unavailable." }); return;
      }
      leaveRoom(socket);
      lobbySockets.delete(socket);
      room.seatIds[player] = socket.identity?.player.id || null;
      room.players[player] = socket;
      socket.membership = { roomCode: code, player };

      if (room.sideChosen) {
        // Reconnecting to active game or existing chosen sides
        broadcastState(room, "state");
      } else {
        requestRpsSelection(room);
      }
      broadcastRoomList();
      return;
    }

    if (message.type === "resume_room") {
      if (message.protocolVersion !== PROTOCOL_VERSION) {
        send(socket, { type: "error", message: `Unsupported protocol version. Expected ${PROTOCOL_VERSION}.` });
        return;
      }
      const code = typeof message.roomCode === "string" ? message.roomCode.trim().toUpperCase() : "";
      if (typeof message.serverInstanceId === "string" && message.serverInstanceId !== serverInstanceId) {
        send(socket, { type: "match_voided", reason: "server_restart", roomCode: code, serverInstanceId });
        return;
      }
      const room = rooms.get(code);
      const player = auth && room
        ? ["black", "white"].find(side => room.seatIds[side] === socket.identity.player.id)
        : null;
      if (!room || !player || room.players[player]) {
        send(socket, { type: "error", message: "Resume unavailable." });
        return;
      }
      leaveRoom(socket);
      lobbySockets.delete(socket);
      clearReconnectTimer(room, player);
      room.players[player] = socket;
      socket.membership = { roomCode: code, player };
      if (!room.sideChosen && room.players.black && room.players.white) {
        requestRpsSelection(room);
      } else if (!room.sideChosen) {
        send(socket, {
          type: "room_created",
          serverInstanceId,
          roomCode: room.code,
          boardNumber: room.boardNumber,
          player,
        });
      } else if (room.players.black && room.players.white) {
        broadcastState(room, "state", { resumePausedTurn: true });
      } else {
        const playerState = stateForPlayer(room.state, player);
        playerState.turnDeadline = null;
        send(socket, {
          type: "state",
          roomCode: room.code,
          boardNumber: room.boardNumber,
          player,
          opponentConnected: false,
          turnDeadline: null,
          state: playerState,
        });
      }
      broadcastRoomList();
      return;
    }

    if (message.type === "rps_choice" && socket.membership) {
      const room = rooms.get(socket.membership.roomCode);
      if (!room || room.code !== message.roomCode) {
        send(socket, { type: "error", message: "Invalid room." });
        return;
      }
      if (room.sideChosen) return;
      const player = socket.membership.player;
      if (!["scissors", "rock", "paper"].includes(message.choice)) {
        send(socket, { type: "error", message: "Invalid choice." });
        return;
      }
      if (!room.rps) room.rps = { black: null, white: null };
      room.rps[player] = message.choice;

      if (room.rps.black && room.rps.white) {
        const blackChoice = room.rps.black;
        const whiteChoice = room.rps.white;

        if (blackChoice === whiteChoice) {
          for (const p of ["black", "white"]) {
            send(room.players[p], {
              type: "rps_result",
              result: "draw",
              choices: { black: blackChoice, white: whiteChoice },
            });
          }
          room.rps = { black: null, white: null };
        } else {
          const blackWins = (blackChoice === "scissors" && whiteChoice === "paper")
            || (blackChoice === "rock" && whiteChoice === "scissors")
            || (blackChoice === "paper" && whiteChoice === "rock");

          if (!blackWins) {
            const blackSocket = room.players.black;
            const whiteSocket = room.players.white;
            [room.seatIds.black, room.seatIds.white] = [room.seatIds.white, room.seatIds.black];
            room.players.black = whiteSocket;
            room.players.white = blackSocket;
            whiteSocket.membership.player = "black";
            blackSocket.membership.player = "white";
          }

          for (const p of ["black", "white"]) {
            send(room.players[p], {
              type: "rps_result",
              result: "win",
              yourSide: p,
              choices: { black: blackChoice, white: whiteChoice },
            });
          }

          room.sideChosen = true;
          setTimeout(() => {
            if (rooms.get(room.code) === room) {
              broadcastState(room, "match_start");
            }
          }, 1400);
        }
      }
      return;
    }

    if (message.type !== "action" || !socket.membership) {
      send(socket, { type: "error", message: "Join a room first." });
      return;
    }

    const room = rooms.get(socket.membership.roomCode);
    if (!room || room.code !== message.roomCode) {
      send(socket, { type: "error", message: "Invalid room." });
      return;
    }
    if (!room.sideChosen) {
      send(socket, { type: "error", message: "Choose a side first." });
      return;
    }
    if (!room.players.black || !room.players.white) {
      send(socket, { type: "error", message: "Opponent disconnected." });
      return;
    }
    const player = socket.membership.player;
    if (message.action?.type === "decline_rematch") {
      declineRematch(room, player, send);
      return;
    }
    if (message.action?.type === "rematch") {
      room.rematch.add(player);
      if (room.rematch.size === 1) {
        for (const p of ["black", "white"]) {
          send(room.players[p], {
            type: "rematch_offered",
            byPlayer: player,
          });
        }
      } else if (room.rematch.size >= 2) {
        room.state = createGameState();
        room.rematch.clear();
        room.sideChosen = false;
        requestRpsSelection(room);
      }
      return;
    }
    if (message.action?.type === "deploy" && tauntIsPlaying(room)) {
      send(socket, { type: "error", message: "Taunt is still playing." });
      return;
    }
    if (
      message.action?.type === "deploy"
      && !message.action.confirmSuicide
      && ["soldier", "general", "diplomat", "wizard", "king"].includes(message.action.unitType)
      && Number.isInteger(message.action.row)
      && Number.isInteger(message.action.col)
      && message.action.row >= 0
      && message.action.row < 9
      && message.action.col >= 0
      && message.action.col < 9
      && !room.state.board[message.action.row][message.action.col]
      && isEnclosedPlacement(
        stateForPlayer(room.state, player),
        player,
        message.action.unitType,
        message.action.row,
        message.action.col,
      )
    ) {
      // A special fires and survives in an enclosed point, so the client must not describe
      // it as dying. `kind` is additive; older clients ignore it and show the plain warning.
      send(socket, {
        type: "suicide_warning",
        action: message.action,
        kind: SPECIAL_UNIT_TYPES.has(message.action.unitType) ? "special_detonation" : "suicide",
      });
      return;
    }
    if (!applyAction(room.state, player, message.action)) {
      send(socket, { type: "error", message: "Illegal action." });
      return;
    }
    startAutomaticKingWallTaunt(room, player, message.action);
    broadcastState(room);
  }
  socket.on("message", rawMessage => {
    if (!allowMessage("socket") || pending >= 8) { socket.close(1008, "Too many requests"); return; }
    pending++;
    chain = chain.then(() => socket.readyState === WebSocket.OPEN && handleMessage(rawMessage))
      .catch(() => socket.close(1011, "Request failed"))
      .finally(() => { pending--; });
  });

  socket.on("close", () => {
    clearTimeout(authTimer);
    if (socket.identity && authenticatedSockets.get(socket.identity.player.id) === socket) authenticatedSockets.delete(socket.identity.player.id);
    socket.accessToken = null;
    lobbySockets.delete(socket);
    leaveRoom(socket, { preserveActiveSeat: !shuttingDown });
  });
});

const heartbeat = setInterval(() => {
  for (const socket of webSocketServer.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 30000);

webSocketServer.on("close", () => clearInterval(heartbeat));

async function close() {
  shuttingDown = true;
  clearInterval(heartbeat);
  for (const room of rooms.values()) {
    clearTurnTimer(room);
    for (const player of ["black", "white"]) clearReconnectTimer(room, player);
  }
  for (const socket of webSocketServer.clients) socket.terminate();
  await new Promise(resolve => webSocketServer.close(resolve));
  if (server.listening) await new Promise(resolve => server.close(resolve));
  await auth?.close?.();
}
return { server, webSocketServer, close, port: PORT };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createGameServer();
  const shutdown = () => app.close().then(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  app.server.listen(app.port, "0.0.0.0", () => {
    console.log(`Unknown Kingdom server listening on ${app.server.address().port}`);
  });
}
