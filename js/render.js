import { DEPLOY_ORDER, PVE_HUMAN, SPECIALS } from "./config.js";

export function revealedSpecialType(piece) {
  return piece.revealed && piece.abilityUsed && SPECIALS.has(piece.originalType) ? piece.originalType : null;
}

export function viewerOwnsPiece(state, networkPlayer, piece) {
  if (state.mode === "pve") return piece.owner === PVE_HUMAN;
  return piece.owner === networkPlayer;
}

export function publicName(piece, unitLabels, text) {
  if (piece.type === "king") return unitLabels.king;
  const revealedType = revealedSpecialType(piece);
  if (revealedType) return `${unitLabels[revealedType]} (${text("used")})`;
  return unitLabels.soldier;
}

const UNIT_ICON_PATHS = {
  soldier: [
    "M8 9.5 12 7l4 2.5v7L12 19l-4-2.5z",
    "M12 3v4",
    "M8 10h8",
    "M12 12v7",
  ],
  general: [
    "m12 3 2.7 5.7 6.3.8-4.6 4.4 1.2 6.1-5.6-3-5.6 3 1.2-6.1-4.6-4.4 6.3-.8z",
  ],
  wizard: [
    "m12 6 4 6-4 6-4-6z",
    "M12 2v3M12 19v3M2 12h3M19 12h3",
    "m4.9 4.9 2 2m10.2 10.2 2 2m0-14.2-2 2M6.9 17.1l-2 2",
    "M12 2.5a9.5 9.5 0 0 1 9.5 9.5A9.5 9.5 0 0 1 12 21.5 9.5 9.5 0 0 1 2.5 12 9.5 9.5 0 0 1 12 2.5",
  ],
  diplomat: [
    "m3 11 4-4 4 2-2 2 3 3 3-3-2-2 4-2 4 4",
    "m3 11 5 6 2-2 2 2 2-2 2 1 5-7",
    "m8 17 2 2m2-2 2 2m2-3 2 1",
  ],
  king: [
    "m4 8 4 4 4-7 4 7 4-4-2 11H6z",
    "M6 16h12",
    "M12 5V2",
  ],
};

function createPieceIcon(type) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("piece-icon");

  for (const pathData of UNIT_ICON_PATHS[type] || UNIT_ICON_PATHS.soldier) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.append(path);
  }
  return svg;
}

function pieceElement(piece, context) {
  const element = document.createElement("div");
  const canSeeIdentity = viewerOwnsPiece(context.state, context.networkPlayer, piece);
  const revealedType = revealedSpecialType(piece);
  const visibleType = piece.type === "king" || revealedType || (canSeeIdentity && SPECIALS.has(piece.type) && !piece.abilityUsed)
    ? piece.type === "king" ? "king" : "special"
    : "soldier";
  element.className = `piece ${piece.owner} ${visibleType}`;
  if (canSeeIdentity && SPECIALS.has(piece.type) && !piece.abilityUsed) element.classList.add("special");
  if (revealedType) element.classList.add("used-special");

  const visibleIconType = piece.type === "king"
    ? "king"
    : revealedType || (canSeeIdentity && SPECIALS.has(piece.type) ? piece.type : "soldier");
  element.append(createPieceIcon(visibleIconType));
  const visibleName = revealedType
    ? `${context.unitLabels[revealedType]} (${context.text("used")})`
    : canSeeIdentity ? context.unitLabels[piece.type] || context.unitLabels.soldier : publicName(piece, context.unitLabels, context.text);
  element.title = `${context.sideName(piece.owner)} ${visibleName}`;
  return element;
}

function renderBoard(context) {
  context.boardEl.innerHTML = "";
  for (let row = 0; row < context.state.board.length; row += 1) {
    for (let col = 0; col < context.state.board[row].length; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", context.coord(row, col));
      button.dataset.row = row;
      button.dataset.col = col;

      if (context.state.selected?.row === row && context.state.selected?.col === col) button.classList.add("selected");
      if (context.canDeploy(context.state.turn, context.currentUnitChoice(), row, col)) button.classList.add("valid");
      if (context.state.teleporting && !context.state.board[row][col]) button.classList.add("teleport");
      if (context.state.pendingKingSwap && context.kingEscapeType(context.state.pendingKingSwap.owner, context.state.pendingKingSwap.row, context.state.pendingKingSwap.col, row, col)) {
        button.classList.add("teleport");
      }

      const piece = context.state.board[row][col];
      if (piece) button.append(pieceElement(piece, context));
      button.addEventListener("click", () => context.selectCell(row, col));
      context.boardEl.append(button);
    }
  }
}

function renderDeployPicker(context) {
  context.unitInputs.forEach((input) => {
    const remaining = context.state.stock[context.state.turn][input.value];
    const label = input.closest("label");
    const status = label.querySelector("small");
    const exhausted = remaining <= 0;
    const firstMoveLocked = !context.state.firstDeployDone[context.state.turn] && input.value !== "king";
    const onlineLocked = context.state.mode === "pvp" && (!context.networkReady || context.state.turn !== context.networkPlayer);
    input.disabled = exhausted || firstMoveLocked || onlineLocked || context.state.aiThinking || Boolean(context.state.winner);
    label.classList.toggle("used", exhausted);
    label.classList.toggle("locked", firstMoveLocked);
    const baseOrder = DEPLOY_ORDER.indexOf(input.value);
    label.style.order = exhausted ? 200 + baseOrder : firstMoveLocked ? 100 + baseOrder : baseOrder;
    status.textContent = exhausted
      ? context.text("used")
      : firstMoveLocked
        ? context.text("kingFirst")
        : input.value === "king"
          ? context.text("available")
          : context.text("left", { count: remaining });
  });

  const selectedInput = document.querySelector("input[name='unit']:checked");
  if (selectedInput?.disabled) {
    const fallback = [...context.unitInputs].find((input) => !input.disabled);
    if (fallback) fallback.checked = true;
  }
}

function renderPanel(context) {
  context.turnPill.textContent = context.state.winner
    ? context.state.winner === "draw"
      ? context.text("draw")
      : context.text("wins", { side: context.sideName(context.state.winner) })
    : context.text("turn", { side: context.sideName(context.state.turn) }) + (context.state.aiThinking ? context.text("thinking") : "");
  context.turnPill.classList.toggle("blue", context.state.turn === "blue");
  context.turnPill.classList.toggle("draw", context.state.winner === "draw");
  context.redCount.textContent = context.countPieces("red");
  context.blueCount.textContent = context.countPieces("blue");
  context.networkStatusGroup.hidden = context.state.mode !== "pvp";
  context.networkStatusGroup.classList.toggle("connected", context.networkReady);
  context.undoBtn.disabled = context.state.mode === "pvp" || context.undoCount === 0;
  context.cancelTeleportBtn.hidden = !context.state.teleporting && !context.state.pendingKingSwap;

  context.resultModal.hidden = !context.state.winner;
  if (!context.state.winner) return;
  document.querySelector("#resultTitle").textContent = context.state.winner === "draw"
    ? context.text("resultDraw")
    : context.text("resultWin", { side: context.sideName(context.state.winner) });
  document.querySelector("#resultReason").textContent = context.localizeResultReason(context.state.resultReason);
  document.querySelector("#resultRedTerritory").textContent = context.countPieces("red");
  document.querySelector("#resultBlueTerritory").textContent = context.countPieces("blue");
  document.querySelector("#resultRedCaptures").textContent = context.state.stats.captures.red;
  document.querySelector("#resultBlueCaptures").textContent = context.state.stats.captures.blue;
  document.querySelector("#resultRedSpecials").textContent = context.state.stats.specialsUsed.red;
  document.querySelector("#resultBlueSpecials").textContent = context.state.stats.specialsUsed.blue;
}

export function renderGame(context) {
  renderDeployPicker(context);
  renderBoard(context);
  renderPanel(context);
}
