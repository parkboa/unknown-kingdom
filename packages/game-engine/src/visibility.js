import { PLAYERS, SPECIALS } from "./constants.js";

export function stateForPlayer(state, player) {
  if (!PLAYERS.includes(player)) throw new TypeError(`Unknown player: ${player}`);
  const view = structuredClone(state);
  const opponent = player === "black" ? "white" : "black";
  if (view.stock && Object.hasOwn(view.stock, opponent)) {
    view.stock[opponent] = null;
  }
  if (view.informationHistory) {
    view.informationHistory = {
      schemaVersion: view.informationHistory.schemaVersion,
      [player]: structuredClone(view.informationHistory[player] || []),
    };
  }
  if (view.pendingSpecial && view.pendingSpecial.owner !== player) {
    view.pendingSpecial = {
      row: view.pendingSpecial.row,
      col: view.pendingSpecial.col,
      owner: view.pendingSpecial.owner,
    };
  }
  for (const row of view.board) {
    for (const piece of row) {
      if (!piece || piece.owner === player || piece.type === "king" || piece.revealed) continue;
      piece.type = "soldier";
      piece.originalType = "soldier";
      piece.revealed = false;
      piece.abilityUsed = false;
    }
  }
  if (
    view.lastMove?.player === opponent
    && SPECIALS.has(view.lastMove.unitType)
  ) {
    const movedPiece = view.board[view.lastMove.row]?.[view.lastMove.col];
    if (!movedPiece?.revealed) view.lastMove.unitType = "soldier";
  }
  return view;
}
