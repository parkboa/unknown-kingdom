import test from "node:test";
import assert from "node:assert/strict";
import { createGuestPlayer, publicPlayer } from "./identity.js";

test("guest records have separate internal and public identifiers", () => {
  const player = createGuestPlayer();
  assert.match(player.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(player.publicCode, /^[0-9A-F]{20}$/);
  assert.equal(player.status, "active");
  assert.notEqual(createGuestPlayer().id, player.id);
});

test("public player projection excludes internal identity and credentials", () => {
  const player = { ...createGuestPlayer(), refreshHash: "secret", subject: "provider-id", sessionId: "private" };
  assert.deepEqual(publicPlayer(player), {
    publicCode: player.publicCode,
    nickname: player.nickname,
  });
  assert.equal(JSON.stringify(publicPlayer(player)).includes("secret"), false);
});
