import { getOnlineIdentity } from "./auth.js";
import { validateNetworkMessage } from "./protocol.js?v=progression-5";

export function createNetworkSession() {
  return {
    socket: null,
    connected: false,
    ready: false,
    opponentDisconnected: false,
    roomCode: "",
    boardNumber: null,
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

export function sendNetworkCommand(session, command) {
  if (!session.connected || session.socket?.readyState !== WebSocket.OPEN) return false;
  session.socket.send(JSON.stringify(command));
  return true;
}

export function disconnectNetwork(session) {
  session.cancelled = true;
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
  // Complete human verification before starting the server's WebSocket auth deadline.
  getOnlineIdentity(url).then(identity => {
    if (!session.cancelled) openSocket(identity);
  }).catch(error => {
    if (session.cancelled) return;
    onClose(session);
    // Closing the lobby resets its text; report failure after that reset.
    const code = error.code || error.name || 'AUTH_FAILED';
    console.warn('Guest authentication failed:', code);
    onStatus(unavailableMessage, session);
  });

  function openSocket(initialIdentity) {
    const socket = new WebSocket(url);
    session.socket = socket;

    let authPending = false;
    let started = false;
    let refreshTimer;
    async function authenticate(identity) {
      try {
        identity = identity === undefined ? await getOnlineIdentity(url) : identity;
        if (socket.readyState !== WebSocket.OPEN) return;
        if (identity) {
          authPending = true;
          socket.send(JSON.stringify({ type: 'authenticate', accessToken: identity.accessToken }));
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(authenticate, Math.max(1000, identity.expiresAt - Date.now() - 45000));
        } else {
          session.connected = true;
          started = true;
          socket.send(JSON.stringify(command));
        }
      } catch {
        onStatus(unavailableMessage, session);
        socket.close();
      }
    }
    socket.addEventListener("open", () => authenticate(initialIdentity));

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === 'authenticated' && authPending) {
          if (typeof message.player?.publicCode !== 'string' || typeof message.player?.nickname !== 'string') throw new Error('Invalid profile');
          authPending = false;
          session.connected = true;
          session.profile = message.player;
          if (!started) { started = true; socket.send(JSON.stringify(command)); }
          return;
        }
        if (!validateNetworkMessage(message)) {
          onStatus(invalidMessage, session);
          return;
        }
        onMessage(message);
      } catch {
        onStatus(invalidMessage, session);
      }
    });

    socket.addEventListener("close", (event) => {
      clearTimeout(refreshTimer);
      session.connected = false;
      session.ready = false;
      session.opponentDisconnected = false;
      onClose(session);
      if (!session.cancelled) {
        console.warn('Game connection closed:', event.code);
        onStatus(`${disconnectedMessage} (${event.code})`, session);
      }
    });

    socket.addEventListener("error", () => {
      onStatus(unavailableMessage, session);
    });
  }

  return session;
}
