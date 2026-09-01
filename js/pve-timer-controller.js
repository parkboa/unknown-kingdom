export function resolvePveTurnDeadline({
  currentDeadline,
  now,
  limitMs,
  developerMode,
  timerEnabled,
  mode,
  winner,
  gameActive,
  turn,
  humanPlayer,
}) {
  if (developerMode || (mode === "pve" && !timerEnabled)) return null;
  if (mode !== "pve" || winner || !gameActive) return null;
  if (turn !== humanPlayer) return null;
  return currentDeadline ?? now + limitMs;
}

export function pveDeadlineAction(hasLegalMove) {
  return hasLegalMove
    ? { action: { type: "timeout" }, options: { authoritative: true } }
    : { action: { type: "pass" }, options: undefined };
}
