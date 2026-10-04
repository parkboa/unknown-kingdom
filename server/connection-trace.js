const EVENTS = new Set([
  'opened', 'auth_started', 'auth_verified', 'auth_failed', 'duplicate_rejected',
  'auth_deadline', 'lobby_started', 'lobby_authorized', 'lobby_rejected',
  'lobby_sent', 'closed', 'heartbeat_terminated', 'request_failed',
]);

// Process-local counters correlate lifecycle events without logging player IDs,
// credentials, addresses, close reasons, or any content supplied by the client.
export function createConnectionTrace(connectionId, { log = console.info, now = () => performance.now() } = {}) {
  const started = now();
  return (event, details = {}) => {
    if (!EVENTS.has(event)) return;
    const entry = { connectionId, event, elapsedMs: Math.max(0, Math.round(now() - started)) };
    if (Number.isFinite(details.durationMs)) entry.durationMs = Math.max(0, Math.round(details.durationMs));
    if (Number.isInteger(details.code) && details.code >= 1000 && details.code <= 4999) entry.code = details.code;
    if (typeof details.authenticated === 'boolean') entry.authenticated = details.authenticated;
    if (Number.isInteger(details.previousState) && details.previousState >= 0 && details.previousState <= 3) entry.previousState = details.previousState;
    try { log('Game connection stage:', JSON.stringify(entry)); } catch {}
  };
}
