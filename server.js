import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { applyAction, chooseBotAction, createGameState, isSuicideDeployment, stateForPlayer } from "./engine.js";

const PORT = Number(process.env.PORT || 4175);
const rooms = new Map();

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function preferredSide(message) {
  return message.preferredSide === "blue" ? "blue" : "red";
}

function send(socket, message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function broadcastState(room, type = "state") {
  for (const player of ["red", "blue"]) {
    const socket = room.players[player];
    if (!socket) continue;
    send(socket, {
      type,
      roomCode: room.code,
      player,
      state: stateForPlayer(room.state, player),
    });
  }
}

function scheduleBotTurn(room) {
  if (!room.botPlayer || room.botTimer || room.state.winner) return;
  const action = chooseBotAction(room.state, room.botPlayer);
  if (!action) return;

  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (rooms.get(room.code) !== room || !applyAction(room.state, room.botPlayer, action)) return;
    broadcastState(room);
    scheduleBotTurn(room);
  }, 450);
}

function leaveRoom(socket) {
  const membership = socket.membership;
  if (!membership) return;
  const room = rooms.get(membership.roomCode);
  if (!room) return;
  room.players[membership.player] = null;
  if (!room.players.red && !room.players.blue && room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
  const otherPlayer = membership.player === "red" ? "blue" : "red";
  send(room.players[otherPlayer], { type: "error", message: "Opponent disconnected." });
  if (!room.players.red && !room.players.blue) rooms.delete(room.code);
  socket.membership = null;
}

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  response.writeHead(404);
  response.end("Not found");
});

const webSocketServer = new WebSocketServer({ server, path: "/ws" });
webSocketServer.on("connection", (socket) => {
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });

  socket.on("message", (rawMessage) => {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      send(socket, { type: "error", message: "Invalid JSON." });
      return;
    }

    if (message.type === "create_room") {
      leaveRoom(socket);
      const code = roomCode();
      const player = preferredSide(message);
      const room = {
        code,
        state: createGameState(),
        players: { red: null, blue: null },
        botPlayer: null,
        botTimer: null,
        rematch: new Set(),
      };
      room.players[player] = socket;
      rooms.set(code, room);
      socket.membership = { roomCode: code, player };
      send(socket, { type: "room_created", roomCode: code, player });
      return;
    }

    if (message.type === "create_bot_room") {
      leaveRoom(socket);
      const code = roomCode();
      const room = {
        code,
        state: createGameState(),
        players: { red: null, blue: socket },
        botPlayer: "red",
        botTimer: null,
        rematch: new Set(),
      };
      rooms.set(code, room);
      socket.membership = { roomCode: code, player: "blue" };
      broadcastState(room, "match_start");
      scheduleBotTurn(room);
      return;
    }

    if (message.type === "join_room") {
      const code = typeof message.roomCode === "string" ? message.roomCode.trim().toUpperCase() : "";
      const room = rooms.get(code);
      if (!room || (room.players.red && room.players.blue) || room.botPlayer) {
        send(socket, { type: "error", message: "Room is unavailable." });
        return;
      }
      leaveRoom(socket);
      const player = room.players.red ? "blue" : "red";
      room.players[player] = socket;
      socket.membership = { roomCode: code, player };
      broadcastState(room, "match_start");
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
    const player = socket.membership.player;
    if (message.action?.type === "rematch") {
      if (room.botPlayer) {
        room.state = createGameState();
        broadcastState(room, "match_start");
        scheduleBotTurn(room);
        return;
      }
      room.rematch.add(player);
      if (room.rematch.size === 2) {
        room.state = createGameState();
        room.rematch.clear();
        broadcastState(room, "match_start");
      }
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
      && isSuicideDeployment(
        stateForPlayer(room.state, player),
        player,
        message.action.unitType,
        message.action.row,
        message.action.col,
      )
    ) {
      send(socket, { type: "suicide_warning", action: message.action });
      return;
    }
    if (!applyAction(room.state, player, message.action)) {
      send(socket, { type: "error", message: "Illegal action." });
      return;
    }
    broadcastState(room);
    scheduleBotTurn(room);
  });

  socket.on("close", () => leaveRoom(socket));
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

function shutdown() {
  clearInterval(heartbeat);
  for (const socket of webSocketServer.clients) socket.close(1012, "Server restarting");
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Unknown Kingdom server listening on ${PORT}`);
});
