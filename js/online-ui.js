export function resetRpsButtons(rpsButtons) {
  rpsButtons.forEach((btn) => {
    btn.disabled = false;
    btn.classList.remove("selected");
  });
}

export function showNetworkRoomControls({ publicRoomList, networkRoomControls, networkRpsPicker }) {
  if (publicRoomList) publicRoomList.hidden = false;
  if (networkRoomControls) networkRoomControls.hidden = false;
  if (networkRpsPicker) networkRpsPicker.hidden = true;
}

export function showNetworkWaitingRoom({ publicRoomList, networkRoomControls, networkRpsPicker }) {
  if (publicRoomList) publicRoomList.hidden = true;
  if (networkRoomControls) networkRoomControls.hidden = true;
  if (networkRpsPicker) networkRpsPicker.hidden = true;
}

export function showNetworkRpsPicker({ publicRoomList, networkRoomControls, networkRpsPicker, rpsButtons }) {
  if (publicRoomList) publicRoomList.hidden = true;
  if (networkRoomControls) networkRoomControls.hidden = true;
  if (networkRpsPicker) networkRpsPicker.hidden = false;
  if (rpsButtons) resetRpsButtons(rpsButtons);
}

export function renderOpenRoomsList({
  openRooms,
  container,
  onJoin,
  text,
  boardName,
  displayBoardNumber,
}) {
  if (!container) return;
  container.innerHTML = "";
  if (!openRooms.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "public-room-empty";
    emptyMessage.textContent = text("noOpenRooms");
    container.append(emptyMessage);
    return;
  }
  openRooms.forEach((room, index) => {
    const button = document.createElement("button");
    button.className = "public-room-button";
    button.type = "button";
    button.dataset.roomCode = room.roomCode;
    button.innerHTML = `<span></span><small></small>`;
    button.querySelector("span").textContent = boardName(displayBoardNumber(room.boardNumber, index + 1));
    button.querySelector("small").textContent = text("boardWaiting");
    button.addEventListener("click", () => onJoin(room.roomCode));
    container.append(button);
  });
}

export function showRematchToast(toastElement) {
  if (!toastElement) return;
  toastElement.hidden = false;
  toastElement.classList.add("visible");
}

export function hideRematchToast(toastElement) {
  if (!toastElement) return;
  toastElement.hidden = true;
  toastElement.classList.remove("visible");
}
