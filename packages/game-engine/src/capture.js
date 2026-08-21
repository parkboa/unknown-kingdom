import { SIZE, cellKey, opponent, sideLabel } from "./constants.js";
import {
  boardSignature,
  canDeployPosition,
  captureOwners,
  collectGroup,
  groupHasLiberty,
  incrementDeploymentCount,
} from "./board.js";
import { emitEvent } from "./events.js";
import { queueSpecialActivation } from "./reactions.js";
import { createPiece, occupiedSoldier } from "./state.js";
import { declareWinner } from "./victory.js";

export function isSuicideDeployment(state, player, type, row, col) {
  if (!canDeployPosition(state, player, type, row, col)) return false;
  const simulated = structuredClone(state);
  simulated.board[row][col] = createPiece(simulated, player, type);
  simulated.stock[player][type] -= 1;
  simulated.firstDeployDone[player] = true;
  incrementDeploymentCount(simulated, player);
  resolveCaptures(simulated, player, undefined, queueSpecialActivation);
  return simulated.board[row][col]?.owner !== player || simulated.winner === opponent(player);
}

function occupyGroup(state, group, captor, events) {
  const defender = state.board[group[0][0]][group[0][1]].owner;
  const captured = [];
  let occupied = 0;
  for (const [row, col] of group) {
    const piece = state.board[row][col];
    if (!piece) continue;
    captured.push({ pieceId: piece.id, row, col });
    if (piece.type === "king") {
      state.board[row][col] = occupiedSoldier(state, captor);
      state.stats.captures[captor] += 1;
      emitEvent(state, events, { type: "group_captured", captor, defender, pieces: captured });
      declareWinner(
        state,
        captor,
        `${sideLabel(defender)} King was captured at ${row},${col}.`,
        events,
        "king_captured",
        { defeatedPlayer: defender, captureMethod: "surround", row, col },
      );
      return;
    }
    state.board[row][col] = occupiedSoldier(state, captor);
    occupied += 1;
  }
  state.stats.captures[captor] += occupied;
  if (captured.length) emitEvent(state, events, { type: "group_captured", captor, defender, pieces: captured });
}

function resolveCapturedGroup(state, group, captor, events, queueSpecialActivation) {
  const defender = state.board[group[0][0]][group[0][1]].owner;
  if (queueSpecialActivation(state, group, defender, captor, events)) return;
  if (state.winner || state.teleporting || state.pendingSpecial || state.pendingKingSwap) return;
  const checked = new Set();
  for (const [row, col] of group) {
    if (state.board[row][col]?.owner !== defender) continue;
    const remaining = collectGroup(state, row, col);
    const key = remaining.map(([groupRow, groupCol]) => cellKey(groupRow, groupCol)).sort().join("|");
    if (checked.has(key)) continue;
    checked.add(key);
    if (!groupHasLiberty(state, remaining, defender)) occupyGroup(state, remaining, captor, events);
    if (state.winner || state.teleporting || state.pendingSpecial || state.pendingKingSwap) return;
  }
}

export function resolveCaptures(state, preferredCaptor, events, queueSpecialActivation) {
  const seen = new Set();
  const rowOrder = preferredCaptor === "blue"
    ? Array.from({ length: SIZE }, (_, index) => SIZE - 1 - index)
    : Array.from({ length: SIZE }, (_, index) => index);
  let changed = true;
  while (changed && !state.winner) {
    const signature = boardSignature(state);
    if (seen.has(signature)) break;
    seen.add(signature);
    changed = false;
    const checked = new Set();
    for (const row of rowOrder) {
      for (let col = 0; col < SIZE; col += 1) {
        const piece = state.board[row][col];
        if (!piece) continue;
        const group = collectGroup(state, row, col);
        const key = group.map(([groupRow, groupCol]) => cellKey(groupRow, groupCol)).sort().join("|");
        if (checked.has(key)) continue;
        checked.add(key);
        if (groupHasLiberty(state, group, piece.owner)) continue;
        const owners = captureOwners(state, group).filter((owner) => owner !== piece.owner);
        const captor = owners.includes(preferredCaptor) ? preferredCaptor : owners[0];
        if (!captor) continue;
        const before = boardSignature(state);
        resolveCapturedGroup(state, group, captor, events, queueSpecialActivation);
        if (state.winner || state.teleporting || state.pendingSpecial || state.pendingKingSwap) return;
        changed ||= before !== boardSignature(state);
      }
    }
  }
}
