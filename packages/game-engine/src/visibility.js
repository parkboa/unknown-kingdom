export function stateForPlayer(state, player) {
  const view = structuredClone(state);
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
  return view;
}

