import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { WebSocket } from "ws";

const serverDirectory = fileURLToPath(new URL(".", import.meta.url));

function nextMessage(socket, predicate = () => true, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const receivedMessages = [];
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for a WebSocket message; received: ${receivedMessages.join(", ") || "none"}.`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("error", onError);
    }

    function onMessage(rawMessage) {
      const message = JSON.parse(rawMessage.toString());
      receivedMessages.push(message.message ? `${message.type} (${message.message})` : message.type);
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    socket.on("message", onMessage);
    socket.on("error", onError);
  });
}

async function connect(url) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  return socket;
}

async function startServer() {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: serverDirectory,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out starting test server.\n${output}`));
    }, 5000);

    function onOutput(chunk) {
      output += chunk.toString();
      const match = output.match(/listening on (\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve({ child, port: Number(match[1]) });
    }

    child.stdout.on("data", onOutput);
    child.stderr.on("data", onOutput);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      if (code === 0 || output.match(/listening on (\d+)/)) return;
      clearTimeout(timeout);
      reject(new Error(`Test server exited with code ${code}.\n${output}`));
    });
  });
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

async function sendActionAndReadBoth(sender, black, white, roomCode, action) {
  const blackState = nextMessage(black, ({ type }) => type === "state");
  const whiteState = nextMessage(white, ({ type }) => type === "state");
  send(sender, { type: "action", roomCode, action });
  return Promise.all([blackState, whiteState]);
}

test("protocol v3 completes a two-client Black/White match handshake and hides special identities", async (t) => {
  const { child, port } = await startServer();
  const sockets = [];
  t.after(async () => {
    for (const socket of sockets) socket.close();
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => {});
  });

  const url = `ws://127.0.0.1:${port}/ws`;
  const legacy = await connect(url);
  sockets.push(legacy);
  const versionError = nextMessage(legacy, ({ type }) => type === "error");
  send(legacy, { type: "create_room", protocolVersion: 2 });
  assert.match((await versionError).message, /Expected 3/);

  const black = await connect(url);
  const white = await connect(url);
  sockets.push(black, white);

  const roomCreated = nextMessage(black, ({ type }) => type === "room_created");
  send(black, { type: "create_room", protocolVersion: 3 });
  const { roomCode } = await roomCreated;

  const blackRpsStart = nextMessage(black, ({ type }) => type === "rps_start");
  const whiteRpsStart = nextMessage(white, ({ type }) => type === "rps_start");
  send(white, { type: "join_room", roomCode, protocolVersion: 3 });
  await Promise.all([blackRpsStart, whiteRpsStart]);

  const blackRpsResult = nextMessage(black, ({ type }) => type === "rps_result");
  const whiteRpsResult = nextMessage(white, ({ type }) => type === "rps_result");
  const blackMatchStart = nextMessage(black, ({ type }) => type === "match_start");
  const whiteMatchStart = nextMessage(white, ({ type }) => type === "match_start");
  send(black, { type: "rps_choice", roomCode, choice: "rock" });
  send(white, { type: "rps_choice", roomCode, choice: "scissors" });

  assert.equal((await blackRpsResult).yourSide, "black");
  assert.equal((await whiteRpsResult).yourSide, "white");
  const [blackStart, whiteStart] = await Promise.all([blackMatchStart, whiteMatchStart]);
  assert.equal(blackStart.player, "black");
  assert.equal(whiteStart.player, "white");
  assert.equal(blackStart.state.stock.white, null);
  assert.equal(whiteStart.state.stock.black, null);

  await sendActionAndReadBoth(black, black, white, roomCode, {
    type: "deploy", unitType: "king", row: 1, col: 4,
  });

  await sendActionAndReadBoth(white, black, white, roomCode, {
    type: "deploy", unitType: "king", row: 7, col: 4,
  });

  const setupMoves = [
    [black, 1, 0], [white, 7, 0],
    [black, 1, 1], [white, 7, 1],
    [black, 1, 2], [white, 7, 2],
    [black, 2, 0], [white, 6, 0],
  ];
  for (const [sender, row, col] of setupMoves) {
    await sendActionAndReadBoth(sender, black, white, roomCode, {
      type: "deploy", unitType: "soldier", row, col,
    });
  }

  const [blackView, whiteView] = await sendActionAndReadBoth(black, black, white, roomCode, {
    type: "deploy", unitType: "general", row: 2, col: 2,
  });
  assert.equal(blackView.state.board[2][2].type, "general");
  assert.equal(whiteView.state.board[2][2].type, "soldier");
});
