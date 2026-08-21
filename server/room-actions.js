export function declineRematch(room, byPlayer, sendMessage) {
  room.rematch.clear();
  for (const player of ["red", "blue"]) {
    sendMessage(room.players[player], {
      type: "rematch_declined",
      byPlayer,
    });
  }
}

export function startAutomaticTauntLock(room, player, action, now, durationMs) {
  if (action?.type !== "deploy" || action.unitType !== "king") return false;
  const event = room.state.tauntEvent;
  if (!event || event.targetOwner !== player || event.row !== action.row || event.col !== action.col) return false;
  room.state.tauntUntil = now + durationMs;
  return true;
}
