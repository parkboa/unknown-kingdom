import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  applyAction,
  createGameState,
  dispatchAction,
  hasLegalDeployment,
  isEnclosedPlacement,
  stateForPlayer,
} from "./engine.js";
import { declineRematch, startAutomaticTauntLock } from "./room-actions.js";

const SPECIAL_UNIT_TYPES = new Set(["general", "diplomat", "wizard"]);
const PORT = Number(process.env.PORT || 4175);
const TAUNT_DISPLAY_MS = 3000;
const TURN_TIMEOUT_MS = 30000;
const rooms = new Map();
const lobbySockets = new Set();
let nextBoardNumber = 1;

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
    .filter((room) => Boolean(room.players.red) !== Boolean(room.players.blue))
    .map((room) => ({
      roomCode: room.code,
      boardNumber: room.boardNumber,
      playerCount: Number(Boolean(room.players.red)) + Number(Boolean(room.players.blue)),
    }))
    .sort((a, b) => a.boardNumber - b.boardNumber);
}

function sendRoomList(socket) {
  send(socket, { type: "room_list", rooms: openRoomSummaries() });
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

function resetTurnTimer(room) {
  clearTurnTimer(room);
  if (room.state.winner || !room.sideChosen || !room.players.red || !room.players.blue) {
    room.turnDeadline = null;
    return;
  }
  const tauntDelay = Math.max(0, Number(room.state.tauntUntil || 0) - Date.now());
  const duration = TURN_TIMEOUT_MS + tauntDelay;
  room.turnDeadline = Date.now() + duration;

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
  }, duration);
}

function broadcastState(room, type = "state") {
  if (type === "match_start" || (room.sideChosen && !room.state.winner)) {
    resetTurnTimer(room);
  } else if (room.state.winner) {
    clearTurnTimer(room);
    room.turnDeadline = null;
  }
  for (const player of ["red", "blue"]) {
    const socket = room.players[player];
    if (!socket) continue;
    const playerState = stateForPlayer(room.state, player);
    playerState.turnDeadline = room.turnDeadline;
    send(socket, {
      type,
      roomCode: room.code,
      boardNumber: room.boardNumber,
      player,
      turnDeadline: room.turnDeadline,
      state: playerState,
    });
  }
}

function requestSideSelection(room) {
  for (const player of ["red", "blue"]) {
    send(room.players[player], {
      type: "side_selection",
      roomCode: room.code,
      boardNumber: room.boardNumber,
    });
  }
}

function requestRpsSelection(room) {
  room.rps = { red: null, blue: null };
  for (const player of ["red", "blue"]) {
    send(room.players[player], {
      type: "rps_start",
      roomCode: room.code,
      boardNumber: room.boardNumber,
    });
  }
}

function assignSelectedSide(room, socket, selectedSide) {
  if (room.sideChosen || !room.players.red || !room.players.blue) return false;
  const membership = socket.membership;
  if (!membership || !["red", "blue"].includes(selectedSide)) return false;

  if (membership.player !== selectedSide) {
    const otherSide = selectedSide === "red" ? "blue" : "red";
    const otherSocket = room.players[selectedSide];
    room.players[selectedSide] = socket;
    room.players[otherSide] = otherSocket;
    socket.membership.player = selectedSide;
    otherSocket.membership.player = otherSide;
  }

  room.sideChosen = true;
  broadcastState(room, "match_start");
  return true;
}

function startAutomaticKingWallTaunt(room, player, action) {
  return startAutomaticTauntLock(room, player, action, Date.now(), TAUNT_DISPLAY_MS);
}

function tauntIsPlaying(room) {
  return Number(room.state.tauntUntil || 0) > Date.now();
}

function leaveRoom(socket) {
  const membership = socket.membership;
  if (!membership) return;
  const room = rooms.get(membership.roomCode);
  if (!room) return;
  room.players[membership.player] = null;
  clearTurnTimer(room);
  const hasStarted = Boolean(
    room.state.deploymentCount?.red > 0
    || room.state.deploymentCount?.blue > 0
    || room.state.firstDeployDone?.red
    || room.state.firstDeployDone?.blue,
  );
  if (!hasStarted) {
    room.sideChosen = false;
  }
  const otherPlayer = membership.player === "red" ? "blue" : "red";
  send(room.players[otherPlayer], { type: "error", message: "Opponent disconnected." });
  if (!room.players.red && !room.players.blue) rooms.delete(room.code);
  socket.membership = null;
  broadcastRoomList();
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
      lobbySockets.delete(socket);
      const code = roomCode();
      const room = {
        code,
        boardNumber: nextBoardNumber++,
        state: createGameState(),
        players: { red: null, blue: null },
        sideChosen: false,
        sideSelectionEnabled: message.protocolVersion === 2,
        rematch: new Set(),
        rps: { red: null, blue: null },
      };
      room.players.red = socket;
      rooms.set(code, room);
      socket.membership = { roomCode: code, player: "red" };
      send(socket, { type: "room_created", roomCode: code, boardNumber: room.boardNumber });
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
      const code = typeof message.roomCode === "string" ? message.roomCode.trim().toUpperCase() : "";
      const room = rooms.get(code);
      if (!room || (room.players.red && room.players.blue)) {
        send(socket, { type: "error", message: "Room is unavailable." });
        return;
      }
      leaveRoom(socket);
      lobbySockets.delete(socket);
      const player = room.players.red ? "blue" : "red";
      room.players[player] = socket;
      socket.membership = { roomCode: code, player };

      if (room.sideChosen) {
        // Reconnecting to active game or existing chosen sides
        broadcastState(room, "state");
      } else if (room.sideSelectionEnabled && message.protocolVersion === 2) {
        requestRpsSelection(room);
      } else {
        room.sideChosen = true;
        broadcastState(room, "match_start");
      }
      broadcastRoomList();
      return;
    }

    if (message.type === "choose_side" && socket.membership) {
      const room = rooms.get(socket.membership.roomCode);
      if (!room || room.code !== message.roomCode) {
        send(socket, { type: "error", message: "Invalid room." });
        return;
      }
      if (room.sideChosen) return;
      if (!assignSelectedSide(room, socket, message.side)) {
        send(socket, { type: "error", message: "Side selection is unavailable." });
      }
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
      if (!room.rps) room.rps = { red: null, blue: null };
      room.rps[player] = message.choice;

      if (room.rps.red && room.rps.blue) {
        const redChoice = room.rps.red;
        const blueChoice = room.rps.blue;

        if (redChoice === blueChoice) {
          for (const p of ["red", "blue"]) {
            send(room.players[p], {
              type: "rps_result",
              result: "draw",
              choices: { red: redChoice, blue: blueChoice },
            });
          }
          room.rps = { red: null, blue: null };
        } else {
          const redWins = (redChoice === "scissors" && blueChoice === "paper")
            || (redChoice === "rock" && blueChoice === "scissors")
            || (redChoice === "paper" && blueChoice === "rock");

          if (!redWins) {
            const redSocket = room.players.red;
            const blueSocket = room.players.blue;
            room.players.red = blueSocket;
            room.players.blue = redSocket;
            blueSocket.membership.player = "red";
            redSocket.membership.player = "blue";
          }

          for (const p of ["red", "blue"]) {
            send(room.players[p], {
              type: "rps_result",
              result: "win",
              yourSide: p,
              choices: { red: redChoice, blue: blueChoice },
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
    const player = socket.membership.player;
    if (message.action?.type === "decline_rematch") {
      declineRematch(room, player, send);
      return;
    }
    if (message.action?.type === "rematch") {
      room.rematch.add(player);
      if (room.rematch.size === 1) {
        for (const p of ["red", "blue"]) {
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
  });

  socket.on("close", () => {
    lobbySockets.delete(socket);
    leaveRoom(socket);
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
