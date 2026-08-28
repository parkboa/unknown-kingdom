import { DEPLOY_ORDER, SPECIALS } from "./config.js";

export function teleportUiState(state, viewerSide, promptDismissed = false) {
  const canControl = Boolean(
    state?.teleporting
    && state.teleporting.owner === viewerSide,
  );
  return {
    canControl,
    showPrompt: canControl && !promptDismissed,
  };
}

export function isOpponentLastMoveCell(state, viewerSide, row, col) {
  const lastMove = state?.lastMove;
  return Boolean(
    lastMove?.player
    && lastMove.player !== viewerSide
    && lastMove.row === row
    && lastMove.col === col,
  );
}

export function viewerOwnsPiece(state, networkPlayer, piece, pveHumanPlayer = "blue") {
  if (state.mode === "pve" || state.mode === "puzzle") return piece.owner === pveHumanPlayer;
  if (state.mode === "tutorial") return piece.owner === "blue";
  return piece.owner === networkPlayer;
}

export function publicName(piece, unitLabels, text) {
  if (piece.type === "king") return unitLabels.king;
  return unitLabels.soldier;
}

function createPieceIcon(type) {
  const icon = document.createElement("span");
  const iconType = ["soldier", "general", "wizard", "diplomat", "king"].includes(type) ? type : "soldier";
  icon.className = "piece-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.style.setProperty("--piece-icon-image", `url("./assets/units/${iconType}.svg")`);
  return icon;
}

function pieceElement(piece, row, col, context) {
  const element = document.createElement("div");
  const canSeeIdentity = viewerOwnsPiece(context.state, context.networkPlayer, piece, context.pveHumanPlayer);
  const specialIdentityVisible = SPECIALS.has(piece.type) && !piece.abilityUsed && (canSeeIdentity || piece.revealed);
  const visibleType = piece.type === "king" || specialIdentityVisible
    ? piece.type === "king" ? "king" : "special"
    : "soldier";
  element.className = `piece ${piece.owner} ${visibleType}`;
  if (specialIdentityVisible) element.classList.add("special");

  const visibleIconType = piece.type === "king"
    ? "king"
    : specialIdentityVisible ? piece.type : "soldier";
  element.append(createPieceIcon(visibleIconType));
  const visibleName = (canSeeIdentity || piece.revealed) && !piece.abilityUsed
    ? context.unitLabels[piece.type] || context.unitLabels.soldier
    : publicName(piece, context.unitLabels, context.text);
  element.title = `${context.sideName(piece.owner)} ${visibleName}`;
  return element;
}

function createTauntOverlay(context) {
  if (!context.visibleTaunt) return null;
  const overlay = document.createElement("div");
  overlay.className = `taunt-overlay ${context.visibleTaunt.speakerOwner === "red" ? "black-taunt" : "white-taunt"}`;
  if (context.visibleTaunt.durationMs) overlay.style.setProperty("--taunt-duration", `${context.visibleTaunt.durationMs}ms`);
  const image = document.createElement("img");
  image.className = "taunt-character";
  image.alt = "";
  image.src = context.visibleTaunt.speakerOwner === "red"
    ? "./assets/taunts/kingb_zzol.png"
    : "./assets/taunts/kingw_zzol.png";
  const callout = document.createElement("span");
  callout.className = "taunt-callout";
  callout.textContent = context.text("tauntBubble");
  overlay.append(image, callout);
  return overlay;
}

function renderBoard(context) {
  context.boardEl.innerHTML = "";
  const { canControl: canControlTeleport } = teleportUiState(context.state, context.viewerSide);
  const kingZones = context.kingZones?.() || [];
  for (const zone of kingZones) {
    const overlay = document.createElement("div");
    overlay.className = `king-zone-cell ${zone.owner}-king-zone-cell`;
    if (zone.center) overlay.classList.add("king-zone-center");
    if (zone.corners?.topLeft) overlay.classList.add("corner-top-left");
    if (zone.corners?.topRight) overlay.classList.add("corner-top-right");
    if (zone.corners?.bottomLeft) overlay.classList.add("corner-bottom-left");
    if (zone.corners?.bottomRight) overlay.classList.add("corner-bottom-right");
    overlay.style.setProperty("--king-zone-top", `${(zone.row / context.state.board.length) * 100}%`);
    overlay.style.setProperty("--king-zone-left", `${(zone.col / context.state.board.length) * 100}%`);
    overlay.style.setProperty("--king-zone-width", `${(zone.colSpan / context.state.board.length) * 100}%`);
    overlay.style.setProperty("--king-zone-height", `${(zone.rowSpan / context.state.board.length) * 100}%`);
    overlay.setAttribute("aria-hidden", "true");
    context.boardEl.append(overlay);
  }
  for (let row = 0; row < context.state.board.length; row += 1) {
    for (let col = 0; col < context.state.board[row].length; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", context.coord(row, col));
      button.dataset.row = row;
      button.dataset.col = col;

      if (context.state.lastMove?.row === row && context.state.lastMove?.col === col) {
        button.classList.add("latest-move");
        if (isOpponentLastMoveCell(context.state, context.viewerSide, row, col)) {
          button.classList.add("last-move", `last-move-${context.state.lastMove.player}`);
        }
      }
      if (context.state.selected?.row === row && context.state.selected?.col === col) button.classList.add("selected");
      if (context.canDeploy(context.state.turn, context.currentUnitChoice(), row, col, { forHint: true })) button.classList.add("valid");
      if (canControlTeleport && !context.state.board[row][col]) button.classList.add("teleport");
      const piece = context.state.board[row][col];
      if (piece) button.append(pieceElement(piece, row, col, context));
      button.addEventListener("click", () => context.selectCell(row, col));
      context.boardEl.append(button);
    }
  }
  const tauntOverlay = createTauntOverlay(context);
  if (tauntOverlay) context.boardEl.append(tauntOverlay);
}

function renderDeployPicker(context) {
  context.deployDock?.classList.toggle("deploy-white", context.viewerSide === "blue");
  context.deployDock?.classList.toggle("deploy-black", context.viewerSide === "red");

  const stockOwner = context.state.mode === "pvp" ? context.networkPlayer : context.state.turn;
  const visibleStock = context.state.stock[stockOwner] || {};
  const deployments = context.state.deploymentCount?.[stockOwner] ?? (context.state.firstDeployDone[stockOwner] ? 1 : 0);

  context.unitInputs.forEach((input) => {
    const remaining = visibleStock[input.value] ?? 0;
    const label = input.closest("label");
    const status = label.querySelector("small");
    const exhausted = remaining <= 0;
    const isSpecial = SPECIALS.has(input.value);
    const firstMoveLocked = !context.state.firstDeployDone[stockOwner] && input.value !== "king";
    const specialLocked = isSpecial && context.state.mode !== "tutorial" && context.state.mode !== "puzzle" && deployments < 5;
    const locked = firstMoveLocked || specialLocked;
    const onlineLocked = context.state.mode === "pvp" && (!context.networkReady || context.state.turn !== context.networkPlayer);
    input.disabled = exhausted || locked || onlineLocked || context.state.aiThinking || Boolean(context.state.winner);
    label.classList.toggle("used", exhausted);
    label.classList.toggle("locked", locked && !exhausted);
    const baseOrder = DEPLOY_ORDER.indexOf(input.value);
    label.style.order = exhausted ? 200 + baseOrder : locked ? 100 + baseOrder : baseOrder;

    if (exhausted) {
      status.textContent = context.text("used");
    } else if (specialLocked || (firstMoveLocked && isSpecial)) {
      const lockIcon = document.createElement("span");
      lockIcon.className = "lock-icon";
      lockIcon.setAttribute("aria-label", context.text("rankLocked"));
      lockIcon.textContent = "🔒";
      status.replaceChildren(lockIcon);
    } else if (input.value === "king") {
      status.textContent = context.text("available");
    } else {
      status.textContent = context.text("left", { count: remaining });
    }
  });

  const selectedInput = document.querySelector("input[name='unit']:checked");
  if (selectedInput?.disabled) {
    const fallback = [...context.unitInputs].find((input) => !input.disabled);
    if (fallback) fallback.checked = true;
  }
}

export function updateTurnTimerPill(turnPill, context) {
  if (!turnPill) return;
  let turnText = "";
  let isDanger = false;
  let isWarning = false;

  if (context.state.winner) {
    turnText = context.state.winner === "draw"
      ? context.text("draw")
      : context.text("wins", { side: context.sideName(context.state.winner) });
  } else {
    const side = context.sideName(context.state.turn);
    const deadline = context.state.mode === "pvp" ? context.onlineTurnDeadline : context.pveTurnDeadline;
    if (deadline && (context.state.mode === "pvp" || (context.state.mode === "pve" && context.state.turn === context.pveHumanPlayer))) {
      const remainingMs = Math.max(0, deadline - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);
      turnText = context.text("turnWithTime", { side, time: remainingSec });
      isDanger = remainingSec <= 5;
      isWarning = remainingSec > 5 && remainingSec <= 10;
    } else {
      turnText = context.text("turn", { side });
    }
  }

  if (turnPill.textContent !== turnText) {
    turnPill.textContent = turnText;
  }
  turnPill.classList.toggle("blue", (context.state.winner ? context.state.winner === "blue" : context.state.turn === "blue"));
  turnPill.classList.toggle("draw", context.state.winner === "draw");
  turnPill.classList.toggle("danger", isDanger);
  turnPill.classList.toggle("warning", isWarning);
}

function renderPanel(context) {
  updateTurnTimerPill(context.turnPill, context);
  const teleportUi = teleportUiState(context.state, context.viewerSide, context.wizardMovePromptDismissed);
  context.redCount.textContent = context.countPieces("red");
  context.blueCount.textContent = context.countPieces("blue");
  if (context.modeInfo) context.modeInfo.textContent = context.modeLabel;
  if (context.rankInfo) context.rankInfo.textContent = context.rankLabel;
  if (context.connectionInfo) {
    context.connectionInfo.hidden = context.state.mode !== "pvp";
    context.connectionInfo.classList.toggle("connected", context.networkReady);
    context.connectionInfo.classList.toggle("disconnected", context.state.mode === "pvp" && !context.networkReady && !context.networkConnecting);
  }
  if (context.connectionInfoText) context.connectionInfoText.textContent = context.connectionLabel;
  context.networkStatusGroup.hidden = context.state.mode !== "pvp";
  context.networkStatusGroup.classList.toggle("connected", context.networkReady);
  context.undoBtn.disabled = context.state.mode === "pvp" || context.undoCount === 0 || Boolean(context.state.winner);
  if (context.resignBtn) {
    context.resignBtn.disabled = Boolean(context.state.winner) || (context.state.mode === "pvp" && !context.networkReady);
  }
  if (context.confirmTeleportBtn) context.confirmTeleportBtn.hidden = !teleportUi.showPrompt;
  context.cancelTeleportBtn.hidden = !teleportUi.canControl;

  const showMatchResult = Boolean(
    context.state.winner
    && context.showMatchResult
    && context.networkModalHidden !== false
  );
  context.resultModal.hidden = !showMatchResult;
  if (!showMatchResult) return;
  context.resultModal.dataset.outcome = context.state.winner;
  document.querySelector("#resultTitle").textContent = context.state.winner === "draw"
    ? context.text("resultDraw")
    : context.text("resultWin", { side: context.sideName(context.state.winner) });
  document.querySelector("#resultReason").textContent = context.localizeResultReason(context.state.resultReason);
  document.querySelector("#resultRedTerritory").textContent = context.countPieces("red");
  document.querySelector("#resultBlueTerritory").textContent = context.countPieces("blue");
  document.querySelector("#resultRedCaptures").textContent = context.state.stats.captures.red;
  document.querySelector("#resultBlueCaptures").textContent = context.state.stats.captures.blue;
}

export function renderGame(context) {
  renderDeployPicker(context);
  renderBoard(context);
  renderPanel(context);
}
