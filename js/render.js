import { SPECIALS } from "./config.js";

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
    state?.mode !== "tutorial"
    && lastMove?.player
    && lastMove.player !== viewerSide
    && lastMove.row === row
    && lastMove.col === col,
  );
}

export function viewerOwnsPiece(state, networkPlayer, piece, pveHumanPlayer = "white") {
  if (state.mode === "pve" || state.mode === "puzzle") return piece.owner === pveHumanPlayer;
  if (state.mode === "tutorial") return piece.owner === "white";
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

export function visiblePieceIdentity(piece, canSeeIdentity = false) {
  const activeSpecialType = SPECIALS.has(piece.type)
    && !piece.abilityUsed
    && (canSeeIdentity || piece.revealed)
    ? piece.type
    : null;
  const retiredSpecialType = piece.revealed
    && piece.abilityUsed
    && SPECIALS.has(piece.originalType)
    ? piece.originalType
    : null;
  const specialType = activeSpecialType || retiredSpecialType;
  return {
    iconType: piece.type === "king" ? "king" : specialType || "soldier",
    isSpecial: Boolean(specialType),
    isRetiredSpecial: Boolean(retiredSpecialType),
  };
}

function pieceElement(piece, row, col, context, options = {}) {
  const element = document.createElement("div");
  const canSeeIdentity = viewerOwnsPiece(context.state, context.networkPlayer, piece, context.pveHumanPlayer);
  const identity = visiblePieceIdentity(piece, canSeeIdentity);
  const visibleType = piece.type === "king" || identity.isSpecial
    ? piece.type === "king" ? "king" : "special"
    : "soldier";
  element.className = `piece ${piece.owner} ${visibleType}`;
  if (identity.isSpecial) element.classList.add("special");
  if (identity.isRetiredSpecial) element.classList.add("retired-special");

  if (options.isSliced) {
    element.classList.add("slash-sliced", `dir-${options.direction || "north"}`);
  }
  if (options.isConverting) {
    element.classList.add("diplomat-converting");
  }
  if (options.isVanishing) {
    element.classList.add("wizard-vanishing");
  }

  element.append(createPieceIcon(identity.iconType));
  const visibleName = identity.isSpecial
    ? context.unitLabels[identity.iconType] || context.unitLabels.soldier
    : publicName(piece, context.unitLabels, context.text);
  element.title = `${context.sideName(piece.owner)} ${visibleName}`;
  return element;
}

export const CUTSCENE_IMAGES = {
  king: {
    black: "./assets/taunts/kingb_zzol.png",
    white: "./assets/taunts/kingw_zzol.png",
  },
  general: {
    black: "./assets/taunts/generalb.png",
    white: "./assets/taunts/generalw.png",
  },
  diplomat: {
    black: "./assets/taunts/diplomatb.png",
    white: "./assets/taunts/diplomatw.png",
  },
  wizard: {
    black: "./assets/taunts/wizardb.png",
    white: "./assets/taunts/wizardw.png",
  },
  guide: {
    black: "./assets/tutorial/soldier-guide.png",
    white: "./assets/tutorial/soldier-guide.png",
  },
  rules: {
    black: "./assets/tutorial/kings-confrontation.png",
    white: "./assets/tutorial/kings-confrontation.png",
  },
};

export const COIN_DESIGNS = {
  a: '<svg viewBox="0 0 48 48" fill="none"><defs><radialGradient id="coinGradA" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#ffffff"/><stop offset="25%" stop-color="#fff9a6"/><stop offset="65%" stop-color="#ffd700"/><stop offset="100%" stop-color="#d49b00"/></radialGradient></defs><circle cx="24" cy="24" r="20" fill="url(#coinGradA)" stroke="#c99000" stroke-width="1.5"/><circle cx="24" cy="24" r="16" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.75"/><path d="M 17 28 L 31 28 L 32 20 L 27 24 L 24 17 L 21 24 L 16 20 Z" fill="#9e7000" stroke="#fff176" stroke-width="0.9" stroke-linejoin="round"/></svg>',
  b: '<svg viewBox="0 0 48 48" fill="none"><defs><radialGradient id="coinGradB" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#ffffff"/><stop offset="25%" stop-color="#ffecb3"/><stop offset="70%" stop-color="#ffa000"/><stop offset="100%" stop-color="#ff6f00"/></radialGradient></defs><circle cx="24" cy="24" r="20" fill="url(#coinGradB)" stroke="#b24c00" stroke-width="1.5"/><circle cx="24" cy="24" r="17" fill="none" stroke="#ffe082" stroke-width="1" opacity="0.8"/><rect x="18" y="18" width="12" height="12" rx="1" fill="#3e2723" stroke="#ffd54f" stroke-width="1.2"/><rect x="19.5" y="19.5" width="9" height="9" fill="#1b120c"/></svg>',
  c: '<svg viewBox="0 0 48 48" fill="none"><defs><radialGradient id="coinGradC" cx="30%" cy="25%" r="75%"><stop offset="0%" stop-color="#ffffff"/><stop offset="30%" stop-color="#ffff72"/><stop offset="70%" stop-color="#ffd600"/><stop offset="100%" stop-color="#f57f17"/></radialGradient></defs><circle cx="24" cy="24" r="20" fill="url(#coinGradC)" stroke="#e65100" stroke-width="1.5"/><path d="M 24 10 L 38 24 L 24 38 L 10 24 Z" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.85"/><circle cx="24" cy="24" r="5" fill="#ffffff" opacity="0.9"/><path d="M 24 14 L 24 34 M 14 24 L 34 24" stroke="#ffeb3b" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

export let selectedCoinDesign = "a";
export function setCoinDesign(type) {
  if (COIN_DESIGNS[type]) selectedCoinDesign = type;
}

let cachedOverlayKey = "";
let cachedOverlayEl = null;

export function createTauntOverlay(context) {
  const item = context.visibleTaunt || context.visibleCutscene;
  if (!item) {
    cachedOverlayKey = "";
    cachedOverlayEl = null;
    return null;
  }
  const owner = item.speakerOwner || item.owner || "black";
  const unitType = item.unitType || "king";
  const itemKey = `${unitType}_${owner}_${item.id || item.durationMs || item.message || ""}_${item.hideDialogue ? "nodlg" : "dlg"}`;

  if (cachedOverlayEl && cachedOverlayKey === itemKey) {
    return cachedOverlayEl;
  }

  cachedOverlayKey = itemKey;
  const overlay = document.createElement("div");
  overlay.className = `taunt-overlay ${owner === "black" ? "black-taunt" : "white-taunt"} cutscene-${unitType}`;
  if (item.durationMs) overlay.style.setProperty("--taunt-duration", `${item.durationMs}ms`);
  if (item.persistent) overlay.classList.add("persistent-dialogue");

  const image = document.createElement("img");
  image.className = "taunt-character";
  image.alt = "";
  image.src = (unitType === "guide" ? "./assets/tutorial/soldier-guide.png" : null)
    || (unitType === "rules" ? "./assets/tutorial/kings-confrontation.png" : null)
    || CUTSCENE_IMAGES[unitType]?.[owner]
    || (owner === "black" ? "./assets/taunts/kingb_zzol.png" : "./assets/taunts/kingw_zzol.png");

  if (!item.hideDialogue) {
    const dialogueBox = document.createElement("div");
    dialogueBox.className = "taunt-dialogue-box";
    if (unitType === "guide" || item.persistent) {
      dialogueBox.classList.add("guide-dialogue-box");
    }

    const nameplateText = item.nameplate !== undefined
      ? item.nameplate
      : (unitType === "guide" ? context.text("tutorialGuideName") : (unitType === "rules" ? "" : (context.unitLabels[unitType] || unitType.toUpperCase())));

    if (nameplateText) {
      const nameplate = document.createElement("div");
      nameplate.className = "taunt-nameplate";
      nameplate.textContent = nameplateText;
      dialogueBox.append(nameplate);
    }

    const dialogueText = document.createElement("div");
    dialogueText.className = "taunt-dialogue-text";

    if (item.message) {
      dialogueText.textContent = item.message;
    } else if (unitType === "guide") {
      dialogueText.textContent = context.text("tutorialIntroDialogue");
    } else if (unitType === "king") {
      dialogueText.textContent = context.text("tauntBubble");
    } else if (unitType === "general") {
      dialogueText.textContent = context.text("generalTauntBubble");
    } else if (unitType === "diplomat") {
      dialogueText.textContent = context.text("diplomatTauntBubble");
    } else if (unitType === "wizard") {
      dialogueText.textContent = context.text("wizardTauntBubble");
    } else {
      dialogueText.textContent = context.unitLabels[unitType] || unitType;
    }

    dialogueBox.append(dialogueText);

    if (typeof item.introPage === "number" && item.totalPages > 1) {
      if (item.introPage > 0) {
        const previousBtn = document.createElement("button");
        previousBtn.type = "button";
        previousBtn.className = `dialogue-arrow-btn previous${item.introPage === item.totalPages - 1 ? " only-btn" : ""}`;
        previousBtn.setAttribute("aria-label", context.text("dialoguePrev") || "Back");
        previousBtn.title = context.text("dialoguePrev") || "Back";
        previousBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="15 6 7 12 15 18"></polygon></svg>';
        previousBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (typeof context.onDialoguePrev === "function") context.onDialoguePrev();
        });
        dialogueBox.append(previousBtn);
      }
      if (item.introPage < item.totalPages - 1) {
        const nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.className = "dialogue-arrow-btn next";
        nextBtn.setAttribute("aria-label", context.text("dialogueNext") || "Next");
        nextBtn.title = context.text("dialogueNext") || "Next";
        nextBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="9 6 17 12 9 18"></polygon></svg>';
        nextBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (typeof context.onDialogueNext === "function") context.onDialogueNext();
        });
        dialogueBox.append(nextBtn);
      }
    }

    overlay.append(image, dialogueBox);
  } else {
    overlay.append(image);
  }
  cachedOverlayEl = overlay;
  return overlay;
}

function renderBoard(context) {
  context.boardEl.innerHTML = "";
  const { canControl: canControlTeleport } = teleportUiState(context.state, context.viewerSide);
  const tutorialTeleportTarget = context.tutorialTeleportTarget;
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
        if (context.deploymentAnimation?.row === row && context.deploymentAnimation?.col === col) {
          button.classList.add("latest-move");
        }
        if (isOpponentLastMoveCell(context.state, context.viewerSide, row, col)) {
          button.classList.add("last-move", `last-move-${context.state.lastMove.player}`);
        }
      }
      if (context.state.selected?.row === row && context.state.selected?.col === col) button.classList.add("selected");
      if (context.canDeploy(context.state.turn, context.currentUnitChoice(), row, col, { forHint: true })) button.classList.add("valid");
      const isTutorialTeleportTarget = tutorialTeleportTarget
        && tutorialTeleportTarget.row === row
        && tutorialTeleportTarget.col === col;
      const canTeleportHere = canControlTeleport
        && !context.state.board[row][col]
        && (!tutorialTeleportTarget || isTutorialTeleportTarget);
      if (canTeleportHere) {
        button.classList.add("teleport");
        if (isTutorialTeleportTarget) button.classList.add("valid");
      }

      let piece = context.state.board[row][col];
      let pieceOptions = {};
      const capturedKing = context.state.winner ? context.state.capturedKing : null;
      if (capturedKing?.row === row && capturedKing?.col === col) {
        piece = {
          id: capturedKing.pieceId || `captured-king-${row}-${col}`,
          owner: capturedKing.owner,
          type: "king",
          originalType: "king",
          revealed: true,
          abilityUsed: false,
          kingEscapeUsed: false,
        };
      }
      const skillEffect = context.activeSkillEffect;
      if (skillEffect?.type === "general_strike") {
        if (skillEffect.source.row === row && skillEffect.source.col === col && skillEffect.phase === "slash") {
          const emitter = document.createElement("div");
          emitter.className = "general-slash-emitter";
          const activeDirections = new Set(
            (skillEffect.targets || []).map((t) => t.direction).filter(Boolean),
          );
          const dirsToRender = activeDirections.size > 0 ? activeDirections : ["north", "south", "west", "east"];
          for (const dir of dirsToRender) {
            const flash = document.createElement("span");
            flash.className = `slash-flash slash-${dir}`;
            emitter.append(flash);
          }
          button.append(emitter);
        }
        const target = skillEffect.targets?.find((t) => t.row === row && t.col === col);
        if (target) {
          if (!piece) {
            piece = {
              id: target.pieceId || `target-${row}-${col}`,
              owner: target.owner,
              type: target.unitType || "soldier",
              revealed: Boolean(target.revealed),
              abilityUsed: false,
            };
          }
          if (skillEffect.phase === "slash") {
            pieceOptions = { isSliced: true, direction: target.direction };
          }
        }
      } else if (skillEffect?.type === "diplomat_conversion") {
        const target = skillEffect.targets?.find((t) => t.row === row && t.col === col);
        if (target) {
          if (skillEffect.phase === "cutin") {
            piece = {
              id: target.pieceId || `target-${row}-${col}`,
              owner: target.fromOwner,
              type: "soldier",
              revealed: true,
              abilityUsed: false,
            };
          } else if (skillEffect.phase === "bribe") {
            piece = {
              id: target.pieceId || `target-${row}-${col}`,
              owner: target.toOwner,
              type: "soldier",
              revealed: true,
              abilityUsed: false,
            };
            pieceOptions = { isConverting: true };

            const coin = document.createElement("span");
            coin.className = "diplomat-gold-coin";
            coin.innerHTML = COIN_DESIGNS[context.coinDesign || selectedCoinDesign || "a"] || COIN_DESIGNS.a;
            button.append(coin);

            const gleam = document.createElement("span");
            gleam.className = "diplomat-gold-gleam";
            button.append(gleam);
          }
        }
      } else if (skillEffect?.type === "wizard_vanish") {
        const target = skillEffect.targets?.find((t) => t.row === row && t.col === col);
        if (target) {
          if (!piece) {
            piece = {
              id: target.pieceId || `target-${row}-${col}`,
              owner: target.owner,
              type: target.unitType || "soldier",
              revealed: Boolean(target.revealed),
              abilityUsed: false,
            };
          }
          if (skillEffect.phase === "rune") {
            pieceOptions = { isVanishing: true };
            const rune = document.createElement("span");
            rune.className = "wizard-magic-rune";
            rune.innerHTML = '<svg viewBox="0 0 48 48" fill="none"><defs><radialGradient id="runeGlowGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f0abfc" stop-opacity="0.3"/><stop offset="70%" stop-color="#c084fc" stop-opacity="0.15"/><stop offset="100%" stop-color="#a855f7" stop-opacity="0"/></radialGradient></defs><circle cx="24" cy="24" r="22" fill="url(#runeGlowGrad)"/><circle cx="24" cy="24" r="21" stroke="#e879f9" stroke-width="1.2" stroke-dasharray="3 1.5"/><circle cx="24" cy="24" r="18" stroke="#c084fc" stroke-width="0.8"/><polygon points="24,6 39,33 9,33" fill="none" stroke="#f0abfc" stroke-width="0.8" opacity="0.85"/><polygon points="24,42 9,15 39,15" fill="none" stroke="#e879f9" stroke-width="0.8" opacity="0.85"/><circle cx="24" cy="24" r="9" stroke="#ffffff" stroke-width="1" opacity="0.9"/><circle cx="24" cy="6" r="1.5" fill="#ffffff"/><circle cx="24" cy="42" r="1.5" fill="#ffffff"/><circle cx="6" cy="24" r="1.5" fill="#ffffff"/><circle cx="42" cy="24" r="1.5" fill="#ffffff"/><circle cx="24" cy="24" r="3" fill="#ffffff" opacity="0.95"/></svg>';
            button.append(rune);
          }
        }
      }

      if (piece) button.append(pieceElement(piece, row, col, context, pieceOptions));
      button.addEventListener("click", () => context.selectCell(row, col));
      context.boardEl.append(button);
    }
  }
  const tauntOverlay = createTauntOverlay(context);
  if (tauntOverlay) context.boardEl.append(tauntOverlay);
}

function renderDeployPicker(context) {
  context.deployDock?.classList.toggle("deploy-white", context.viewerSide === "white");
  context.deployDock?.classList.toggle("deploy-black", context.viewerSide === "black");

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
    label.classList.toggle("tutorial-target", context.tutorialUnitHighlight === input.value && !input.checked);
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
  turnPill.classList.toggle("white", (context.state.winner ? context.state.winner === "white" : context.state.turn === "white"));
  turnPill.classList.toggle("draw", context.state.winner === "draw");
  turnPill.classList.toggle("danger", isDanger);
  turnPill.classList.toggle("warning", isWarning);
}

function renderPanel(context) {
  updateTurnTimerPill(context.turnPill, context);
  const teleportUi = teleportUiState(context.state, context.viewerSide, context.wizardMovePromptDismissed);
  context.blackCount.textContent = context.countPieces("black");
  context.whiteCount.textContent = context.countPieces("white");
  if (context.modeInfo) context.modeInfo.textContent = context.modeLabel;
  if (context.rankInfo) {
    context.rankInfo.textContent = context.rankLabel;
    context.rankInfo.hidden = context.state.mode === "pvp";
  }
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
}

export function renderGame(context) {
  renderDeployPicker(context);
  renderBoard(context);
  renderPanel(context);
}
