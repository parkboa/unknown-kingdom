import { getOnlineIdentity } from "./auth.js";
import { PROTOCOL_VERSION } from "./config.js";
import { validateNetworkMessage } from "./protocol.js?v=server-fault-1";

const RESUME_STORAGE_KEY = "daeguk.online.resume.v1";
const DEFAULT_RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000, ...Array(11).fill(10000)];
const DEFAULT_LOBBY_RECONNECT_DELAYS = [500, 1500];
// A replacement connection must wait for our previous close handshake. Keep this
// outside the session: the UI replaces its session immediately when going back.
const closingSockets = new Map();

function closeSessionSocket(session) {
  session.stopSocketTimers?.();
  const socket = session.socket;
  if (!socket || socket.readyState === 3) return;
  const pending = closingSockets.get(session.url) || new Set();
  const closed = session.socketClosed;
  pending.add(closed);
  closingSockets.set(session.url, pending);
  closed.then(() => {
    pending.delete(closed);
    if (!pending.size && closingSockets.get(session.url) === pending) closingSockets.delete(session.url);
  });
  socket.close();
}

async function waitForClosingSockets(url, timeoutMs) {
  const pending = closingSockets.get(url);
  if (!pending?.size) return;
  let timer;
  try {
    await Promise.race([
      Promise.all([...pending]),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('Previous connection is still closing'), { code: 'CLOSE_PENDING' })), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function readResumeTicket(storage) {
  try {
    const ticket = JSON.parse(storage?.getItem(RESUME_STORAGE_KEY) || "null");
    if (!ticket || typeof ticket.roomCode !== "string" || !["black", "white"].includes(ticket.player)) return null;
    return ticket;
  } catch {
    return null;
  }
}

function writeResumeTicket(storage, session) {
  if (!session.roomCode || !session.player || !session.profile?.publicCode) return;
  try {
    storage?.setItem(RESUME_STORAGE_KEY, JSON.stringify({
      roomCode: session.roomCode,
      boardNumber: session.boardNumber,
      player: session.player,
      publicCode: session.profile.publicCode,
      serverInstanceId: session.serverInstanceId || null,
    }));
  } catch {}
}

function clearResumeTicket(storage, roomCode) {
  try {
    const ticket = readResumeTicket(storage);
    if (!roomCode || !ticket || ticket.roomCode === roomCode) storage?.removeItem(RESUME_STORAGE_KEY);
  } catch {}
}

export function clearOnlineResumeTicket(storage = globalThis.localStorage) {
  clearResumeTicket(storage);
}

export function createNetworkSession() {
  return {
    socket: null,
    connected: false,
    ready: false,
    opponentDisconnected: false,
    roomCode: "",
    boardNumber: null,
    player: null,
    reconnectAttempt: 0,
    reconnectTimer: null,
    serverInstanceId: null,
    matchVoided: false,
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
  clearTimeout(session.reconnectTimer);
  if (session.roomCode) clearResumeTicket(session.storage || globalThis.localStorage, session.roomCode);
  closeSessionSocket(session);
  return createNetworkSession();
}

export function connectNetwork(command, {
  url,
  connectingMessage,
  disconnectedMessage,
  reconnectingMessage = disconnectedMessage,
  unavailableMessage,
  authenticationFailedMessage = 'Guest authentication failed. Please try again.',
  invalidMessage,
  onStatus,
  onMessage,
  onClose,
  getIdentity = getOnlineIdentity,
  WebSocketImpl = WebSocket,
  storage = globalThis.localStorage,
  reconnectDelays = DEFAULT_RECONNECT_DELAYS,
  lobbyReconnectDelays = DEFAULT_LOBBY_RECONNECT_DELAYS,
  closeWaitMs = 5000,
  connectionTimeoutMs = 30000,
}) {
  const session = createNetworkSession();
  session.storage = storage;
  session.url = url;
  let lobbyReconnectAttempt = 0;
  onStatus(connectingMessage);
  // Complete human verification before starting the server's WebSocket auth deadline.
  async function startConnection() {
    const identity = await getIdentity(url);
    if (session.cancelled) return;
    await waitForClosingSockets(url, closeWaitMs);
    if (!session.cancelled) openSocket(identity);
  }
  function reportConnectionFailure(error) {
    if (session.cancelled) return;
    onClose(session);
    if (error?.code === 'CLOSE_PENDING') {
      onStatus(`${unavailableMessage} (CLOSE_PENDING)`, session);
      return;
    }
    // Closing the lobby resets its text; report failure after that reset.
    const code = ['NATIVE_BRIDGE_UNAVAILABLE', 'RATE_LIMITED', 'ORIGIN_DENIED', 'AUTH_FAILED'].includes(error?.code)
      ? error.code : 'AUTH_FAILED';
    console.warn('Guest authentication failed:', code);
    onStatus(`${authenticationFailedMessage} (${code})`, session);
  }
  startConnection().catch(reportConnectionFailure);

  function openSocket(initialIdentity) {
    const socket = new WebSocketImpl(url);
    session.socket = socket;
    let resolveClosed;
    session.socketClosed = new Promise(resolve => { resolveClosed = resolve; });

    let authPending = false;
    let started = false;
    let refreshTimer;
    let timedOut = false;
    let ended = false;
    const isCurrent = () => !session.cancelled && !timedOut && !ended && session.socket === socket;
    const connectionTimer = setTimeout(() => {
      if (!isCurrent()) return;
      timedOut = true;
      session.connected = false;
      session.ready = false;
      closeSessionSocket(session);
      onClose(session, { reconnecting: false });
      onStatus(`${unavailableMessage} (CONNECTION_TIMEOUT)`, session);
    }, connectionTimeoutMs);
    session.stopSocketTimers = () => {
      clearTimeout(refreshTimer);
      clearTimeout(connectionTimer);
    };
    async function authenticate(identity) {
      try {
        identity = identity === undefined ? await getIdentity(url) : identity;
        if (!isCurrent() || socket.readyState !== WebSocketImpl.OPEN) return;
        if (identity) {
          authPending = true;
          socket.send(JSON.stringify({ type: 'authenticate', accessToken: identity.accessToken }));
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(authenticate, Math.max(1000, identity.expiresAt - Date.now() - 45000));
        } else {
          session.connected = true;
          started = true;
          clearTimeout(connectionTimer);
          socket.send(JSON.stringify(command));
        }
      } catch {
        if (!isCurrent()) return;
        onStatus(authenticationFailedMessage, session);
        socket.close();
      }
    }
    socket.addEventListener("open", () => authenticate(initialIdentity));

    socket.addEventListener("message", (event) => {
      if (!isCurrent()) return;
      try {
        const message = JSON.parse(event.data);
        if (message?.type === 'authenticated' && authPending) {
          if (typeof message.player?.publicCode !== 'string' || typeof message.player?.nickname !== 'string') throw new Error('Invalid profile');
          authPending = false;
          clearTimeout(connectionTimer);
          session.connected = true;
          session.profile = message.player;
          const previousServerInstanceId = session.serverInstanceId;
          session.serverInstanceId = typeof message.serverInstanceId === "string" ? message.serverInstanceId : null;
          if (!started) {
            started = true;
            const activeTicket = session.roomCode && session.player ? {
              roomCode: session.roomCode,
              boardNumber: session.boardNumber,
              player: session.player,
              publicCode: session.profile.publicCode,
              serverInstanceId: previousServerInstanceId || session.serverInstanceId,
            } : null;
            const ticket = activeTicket || (command.type === "list_rooms" ? readResumeTicket(storage) : null);
            if (ticket?.publicCode === message.player.publicCode) {
              session.roomCode = ticket.roomCode;
              session.boardNumber = ticket.boardNumber || null;
              session.player = ticket.player;
              socket.send(JSON.stringify({
                type: "resume_room",
                roomCode: ticket.roomCode,
                protocolVersion: PROTOCOL_VERSION,
                ...(ticket.serverInstanceId ? { serverInstanceId: ticket.serverInstanceId } : {}),
              }));
            } else {
              if (ticket) clearResumeTicket(storage);
              socket.send(JSON.stringify(command));
            }
          }
          return;
        }
        if (!validateNetworkMessage(message)) {
          onStatus(invalidMessage, session);
          return;
        }
        if (message.type === "error" && message.message === "Resume unavailable." && session.roomCode) {
          clearResumeTicket(storage, session.roomCode);
          session.roomCode = "";
          session.boardNumber = null;
          session.player = null;
          socket.send(JSON.stringify({ type: "list_rooms" }));
          return;
        }
        if (message.type === "match_voided" && message.reason === "server_restart" && session.roomCode) {
          clearResumeTicket(storage, session.roomCode);
          session.roomCode = "";
          session.boardNumber = null;
          session.player = null;
          session.matchVoided = true;
          session.serverInstanceId = message.serverInstanceId || session.serverInstanceId;
          onMessage(message, session);
          socket.send(JSON.stringify({ type: "list_rooms" }));
          return;
        }
        if (["room_created", "rps_start", "match_start", "state"].includes(message.type)) {
          session.roomCode = message.roomCode || session.roomCode;
          session.boardNumber = message.boardNumber || session.boardNumber;
          session.player = message.player || session.player;
          session.serverInstanceId = message.serverInstanceId || session.serverInstanceId;
        }
        if (["room_created", "rps_start", "match_start", "state"].includes(message.type)) {
          session.reconnectAttempt = 0;
          writeResumeTicket(storage, session);
        }
        onMessage(message, session);
      } catch {
        onStatus(invalidMessage, session);
      }
    });

    socket.addEventListener("close", (event) => {
      const wasCurrent = isCurrent();
      ended = true;
      resolveClosed();
      clearTimeout(refreshTimer);
      clearTimeout(connectionTimer);
      if (!wasCurrent) return;
      session.connected = false;
      session.ready = false;
      const canResume = Boolean(session.roomCode && session.player && session.profile?.publicCode);
      if (!session.cancelled && canResume && session.reconnectAttempt < reconnectDelays.length) {
        const delay = reconnectDelays[session.reconnectAttempt++];
        onClose(session, { reconnecting: true });
        onStatus(reconnectingMessage, session);
        session.reconnectTimer = setTimeout(() => {
          startConnection().catch(reportConnectionFailure);
        }, delay);
        return;
      }
      // Only the read-only lobby command is safe to replay without a room ticket.
      // Never retry a rejected credential (4401), or duplicate create/join commands.
      if (command.type === 'list_rooms' && !canResume && [1006, 1012, 1013].includes(event.code)
          && lobbyReconnectAttempt < lobbyReconnectDelays.length) {
        const delay = lobbyReconnectDelays[lobbyReconnectAttempt++];
        onClose(session, { reconnecting: true });
        onStatus(reconnectingMessage, session);
        session.reconnectTimer = setTimeout(() => startConnection().catch(reportConnectionFailure), delay);
        return;
      }
      onClose(session, { reconnecting: false });
      if (!session.cancelled) {
        console.warn('Game connection closed:', event.code);
        onStatus(`${disconnectedMessage} (${event.code})`, session);
      }
    });

    socket.addEventListener("error", () => {
      if (isCurrent()) onStatus(unavailableMessage, session);
    });
  }

  return session;
}
