import { validateNetworkMessage } from "./protocol.js";

export function createNetworkSession() {
  return {
    socket: null,
    connected: false,
    ready: false,
    roomCode: "",
    player: null,
  };
}

export function buildNetworkUrl(location, overrideUrl = "") {
  if (overrideUrl) {
    const url = new URL(overrideUrl);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") throw new Error("Invalid WebSocket protocol.");
    if (!url.pathname || url.pathname === "/") url.pathname = "/ws";
    return url.toString();
  }
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
}

export function sendNetworkAction(session, action) {
  if (!session.ready || session.socket?.readyState !== WebSocket.OPEN) return false;
  session.socket.send(JSON.stringify({
    type: "action",
    roomCode: session.roomCode,
    action,
  }));
  return true;
}

export function disconnectNetwork(session) {
  if (session.socket) session.socket.close();
  return createNetworkSession();
}

export function connectNetwork(command, {
  url,
  connectingMessage,
  disconnectedMessage,
  unavailableMessage,
  invalidMessage,
  onStatus,
  onMessage,
  onClose,
}) {
  const session = createNetworkSession();
  onStatus(connectingMessage);
  const socket = new WebSocket(url);
  session.socket = socket;

  socket.addEventListener("open", () => {
    session.connected = true;
    socket.send(JSON.stringify(command));
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      if (!validateNetworkMessage(message)) {
        onStatus(invalidMessage, session);
        return;
      }
      onMessage(message);
    } catch {
      onStatus(invalidMessage, session);
    }
  });

  socket.addEventListener("close", () => {
    session.connected = false;
    session.ready = false;
    onStatus(disconnectedMessage, session);
    onClose(session);
  });

  socket.addEventListener("error", () => {
    onStatus(unavailableMessage, session);
  });

  return session;
}
