import { randomBytes, randomUUID } from "node:crypto";

// Public identifiers are deliberately separate from authentication credentials.
// Persist this record transactionally; retry creation on a public_code collision.
export function createGuestPlayer() {
  const publicCode = randomBytes(10).toString("hex").toUpperCase();
  return {
    id: randomUUID(),
    publicCode,
    nickname: `Guest-${publicCode.slice(0, 6)}`,
    status: "active",
  };
}

// Explicit projection prevents credentials/provider subjects leaking into a
// lobby, opponent profile, reconnect snapshot, or future ranking response.
export function publicPlayer(player) {
  return { publicCode: player.publicCode, nickname: player.nickname };
}
