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

  const initialType = revealedType || (canSeeIdentity ? piece.type : "");
  element.textContent = piece.type === "king" ? "K" : initialType === "general" ? "G" : initialType === "wizard" ? "W" : initialType === "diplomat" ? "D" : "";
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
