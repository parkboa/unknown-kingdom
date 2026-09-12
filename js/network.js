import { getOnlineIdentity } from "./auth.js";
import { PROTOCOL_VERSION } from "./config.js";
import { validateNetworkMessage } from "./protocol.js?v=server-fault-1";

const RESUME_STORAGE_KEY = "daeguk.online.resume.v1";
const DEFAULT_RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000, ...Array(11).fill(10000)];

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
  if (session.socket) session.socket.close();
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
}) {
  const session = createNetworkSession();
  session.storage = storage;
  onStatus(connectingMessage);
  // Complete human verification before starting the server's WebSocket auth deadline.
  getIdentity(url).then(identity => {
    if (!session.cancelled) openSocket(identity);
  }).catch(error => {
    if (session.cancelled) return;
    onClose(session);
    // Closing the lobby resets its text; report failure after that reset.
    const code = ['NATIVE_BRIDGE_UNAVAILABLE', 'RATE_LIMITED', 'ORIGIN_DENIED', 'AUTH_FAILED'].includes(error?.code)
      ? error.code : 'AUTH_FAILED';
    console.warn('Guest authentication failed:', code);
    onStatus(`${authenticationFailedMessage} (${code})`, session);
  });

  function openSocket(initialIdentity) {
    const socket = new WebSocketImpl(url);
    session.socket = socket;

    let authPending = false;
    let started = false;
    let refreshTimer;
    async function authenticate(identity) {
      try {
        identity = identity === undefined ? await getIdentity(url) : identity;
        if (socket.readyState !== WebSocketImpl.OPEN) return;
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
        onStatus(authenticationFailedMessage, session);
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
          onMessage(message);
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
        onMessage(message);
      } catch {
        onStatus(invalidMessage, session);
      }
    });

    socket.addEventListener("close", (event) => {
      clearTimeout(refreshTimer);
      if (session.socket !== socket) return;
      session.connected = false;
      session.ready = false;
      const canResume = Boolean(session.roomCode && session.player && session.profile?.publicCode);
      if (!session.cancelled && canResume && session.reconnectAttempt < reconnectDelays.length) {
        const delay = reconnectDelays[session.reconnectAttempt++];
        onClose(session, { reconnecting: true });
        onStatus(reconnectingMessage, session);
        session.reconnectTimer = setTimeout(() => {
          getIdentity(url).then(identity => {
            if (!session.cancelled) openSocket(identity);
          }).catch(() => {
            if (!session.cancelled) openSocket(undefined);
          });
        }, delay);
        return;
      }
      onClose(session, { reconnecting: false });
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
