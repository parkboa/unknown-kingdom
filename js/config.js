export const SIZE = 9;
export const WHITE_TERRITORY_BONUS = 2;
export const SPECIALS = new Set(["general", "diplomat", "wizard"]);
export const DEPLOY_ORDER = ["soldier", "general", "diplomat", "wizard", "king"];
export const AI_PROFILES = ["balanced", "aggressive", "defensive"];
export const PVE_HUMAN = "blue";
export const PVE_AI = "red";

export const TEXT = {
  en: {
    deploy: "Deploy", language: "Language", chooseMode: "Choose Game Mode", chooseModeDescription: "Select how you want to start this match.",
    tutorial: "Tutorial", tutorialDescription: "Learn the basic rules step by step", exitTutorial: "Exit", nextTutorial: "Next",
    tutorialStep: "Step {current} / {total}", tutorialKing: "Place your King on the highlighted square. The King is deployed first when the game begins.",
    tutorialWallDefense: "Your wall acts like an allied Soldier. Place a Black Soldier on the highlighted square to surround the White Soldier.",
    tutorialWallDefensePlaced: "A unit connected to its own wall cannot be captured. The White Soldier survived because it is connected to the White wall.",
    tutorialWallCapture: "Place a White Soldier on the highlighted square to surround the Black Soldier against your wall.",
    tutorialWallCapturePlaced: "An enemy unit surrounded together with your wall can be captured. The Black Soldier became a White Soldier.",
    tutorialCapture: "Place a White Soldier on the highlighted square to completely surround the Black Soldier.",
    tutorialGeneral: "Place the General on the highlighted square.",
    tutorialDiplomat: "Place the Diplomat on the highlighted square.",
    tutorialWizard: "Place the Wizard on the highlighted square.",
    tutorialWizardTeleport: "The Wizard's ability activated. When surrounded, it eliminates adjacent enemies and teleports to an empty square of your choice. Choose an empty square.",
    tutorialGeneralPlaced: "The General's ability activated. When surrounded, it eliminates adjacent enemies and then becomes a regular Soldier.",
    tutorialDiplomatPlaced: "The Diplomat's ability activated. When surrounded, it recruits adjacent enemies and then becomes a regular Soldier.",
    tutorialWizardPlaced: "Teleportation is complete. The Wizard became a regular Soldier.",
    tutorialGeneralReady: "The General has been deployed. Press Next to let Black capture it and activate its ability.",
    tutorialDiplomatReady: "The Diplomat has been deployed. Press Next to let Black capture it and activate its ability.",
    tutorialWizardReady: "The Wizard has been deployed. Press Next to let Black capture it and activate its ability.",
    tutorialBlackPreparing: "Black is preparing the fourth surrounding move…",
    tutorialSurroundComplete: "The surround is complete. The special ability will activate shortly…",
    tutorialCapturePlaced: "The Black unit was captured and the square is now occupied by a White Soldier.",
    tutorialComplete: "Tutorial complete. You learned King deployment, wall use, capture, and all three special-unit abilities.",
    pveDescription: "Play as White against the Black AI", onlinePvp: "Online PvP", pvpDescription: "Create or join a private network room",
    networkLobby: "Network Lobby", networkPrompt: "The first player chooses a side. The opponent is assigned the other side.", roomCode: "Room code",
    chooseSide: "Choose your side", blackSide: "Black", whiteSide: "White",
    enterCode: "Enter code", createRoom: "Create Room", joinRoom: "Join Room", back: "Back", specialUnit: "Special Unit",
    dontShowAgain: "Do not show this unit explanation again", gotIt: "Got It", matchComplete: "Match Complete",
    redTerritory: "Black territory", blueTerritory: "White territory", redCaptures: "Black captures", blueCaptures: "White captures",
    redSkills: "Black skills used", blueSkills: "White skills used", playAgain: "Play Again", cancelAbility: "Cancel Ability",
    undo: "Undo Last Move", newGame: "New Game", redUnits: "Black units", blueUnits: "White units",
    soldier: "Soldier", king: "King", general: "General", diplomat: "Diplomat", wizard: "Wizard",
    used: "Used", kingFirst: "King first", left: "{count} left", available: "Available",
    red: "Black", blue: "White", turn: "{side} turn", thinking: " thinking", wins: "{side} wins",
    hiddenUnit: "a hidden unit", notConnected: "The online match is not connected.", createOrJoin: "Create or join a room.",
    rematchWaiting: "Rematch requested. Waiting for opponent…", connecting: "Connecting to game server…",
    disconnected: "Disconnected from game server.", serverUnavailable: "Game server is unavailable. Online PvP requires the WebSocket server.",
    invalidServerResponse: "The game server sent an invalid response.",
    roomWaiting: "Room {room}. Waiting for opponent…", roomWaitingSide: "Room {room} · You chose {side}. Waiting for opponent…", roomPlayer: "Room {room} · You are {side}.",
    serverRejected: "The game server rejected the request.", enterRoomCode: "Enter a room code.",
    resultWin: "{side} Wins", allEliminated: "All enemy units were eliminated.",
    resultDraw: "Draw", draw: "Draw", boardFilled: "Board filled: Black {red} - White {blue} (+{bonus} second-player compensation).",
    noLegalMoves: "No legal deployments remained: Black {red} - White {blue} (+{bonus} second-player compensation).",
    autoPass: "{side} had no legal deployment and passed.", taunt: "Taunt!", tauntBubble: "Chicken!!",
    suicideWarning: "This unit will die immediately if placed here. Place it anyway?",
    kingCaptured: "{side} King was captured.",
  },
  ko: {
    deploy: "유닛 배치", language: "언어", chooseMode: "게임 모드 선택", chooseModeDescription: "플레이할 게임 모드를 선택하세요.",
    tutorial: "튜토리얼", tutorialDescription: "기본 규칙을 단계별로 연습", exitTutorial: "종료", nextTutorial: "다음",
    tutorialStep: "{current} / {total} 단계", tutorialKing: "강조된 칸에 왕을 놓으세요. 게임을 시작할 때 왕을 가장 먼저 배치합니다.",
    tutorialWallDefense: "자신의 성벽은 아군 병사처럼 작용합니다. 강조된 칸에 흑 병사를 놓아 백 병사를 포위하세요.",
    tutorialWallDefensePlaced: "내 유닛이 자신의 성벽에 연결되어 있으면 포획되지 않습니다. 백 병사는 백 성벽에 연결되어 살아남았습니다.",
    tutorialWallCapture: "강조된 칸에 백 병사를 놓아 흑 병사를 내 성벽과 함께 포위하세요.",
    tutorialWallCapturePlaced: "상대 유닛을 내 성벽과 함께 포위하면 포획할 수 있습니다. 흑 병사가 백 병사로 바뀌었습니다.",
    tutorialCapture: "강조된 칸에 백 병사를 놓아 흑 병사를 완전히 포위하세요.",
    tutorialGeneral: "강조된 칸에 장군을 놓으세요.",
    tutorialDiplomat: "강조된 칸에 외교관을 놓으세요.",
    tutorialWizard: "강조된 칸에 마법사를 놓으세요.",
    tutorialWizardTeleport: "마법사 스킬이 발동되었습니다. 마법사는 포위되면 인접한 적을 사살한 뒤 원하는 빈칸으로 순간이동할 수 있습니다. 원하는 빈칸을 선택하세요.",
    tutorialGeneralPlaced: "장군 스킬이 발동되었습니다. 장군은 포위되면 인접한 적을 사살한 뒤 일반 병사로 전환됩니다.",
    tutorialDiplomatPlaced: "외교관 스킬이 발동되었습니다. 외교관은 포위되면 인접한 적을 아군으로 포섭한 뒤 일반 병사로 전환됩니다.",
    tutorialWizardPlaced: "순간이동이 완료되었습니다. 마법사는 일반 병사로 전환됩니다.",
    tutorialGeneralReady: "장군을 배치했습니다. 다음을 누르면 흑이 장군을 포획하여 장군의 능력을 발동시킵니다.",
    tutorialDiplomatReady: "외교관을 배치했습니다. 다음을 누르면 흑이 외교관을 포획하여 외교관의 능력을 발동시킵니다.",
    tutorialWizardReady: "마법사를 배치했습니다. 다음을 누르면 흑이 마법사를 포획하여 마법사의 능력을 발동시킵니다.",
    tutorialBlackPreparing: "흑이 마지막 포위 수를 준비하고 있습니다…",
    tutorialSurroundComplete: "포위가 완성되었습니다. 잠시 후 특수 능력이 발동합니다…",
    tutorialCapturePlaced: "흑 병사가 포획되어 해당 칸이 백 병사로 바뀌었습니다.",
    tutorialComplete: "튜토리얼 완료! 왕 배치, 성벽 활용, 포획과 세 특수 유닛의 능력을 익혔습니다.",
    pveDescription: "백 진영으로 흑 AI와 대결", onlinePvp: "온라인 PvP", pvpDescription: "비공개 방을 만들거나 참가",
    networkLobby: "온라인 대기실", networkPrompt: "먼저 선택한 플레이어의 진영이 확정되고 상대는 반대 진영으로 배정됩니다.", roomCode: "방 코드",
    chooseSide: "진영 선택", blackSide: "흑", whiteSide: "백",
    enterCode: "코드 입력", createRoom: "방 만들기", joinRoom: "방 참가", back: "뒤로", specialUnit: "특수 유닛",
    dontShowAgain: "이 유닛 설명을 다시 표시하지 않기", gotIt: "확인", matchComplete: "경기 종료",
    redTerritory: "흑 영역", blueTerritory: "백 영역", redCaptures: "흑 포획", blueCaptures: "백 포획",
    redSkills: "흑 스킬 사용", blueSkills: "백 스킬 사용", playAgain: "다시 하기", cancelAbility: "스킬 취소",
    undo: "마지막 수 되돌리기", newGame: "새 게임", redUnits: "흑 유닛", blueUnits: "백 유닛",
    soldier: "병사", king: "왕", general: "장군", diplomat: "외교관", wizard: "마법사",
    used: "사용 완료", kingFirst: "왕 먼저", left: "{count}개", available: "사용 가능",
    red: "흑", blue: "백", turn: "{side} 턴", thinking: " 생각 중", wins: "{side} 승리",
    hiddenUnit: "숨겨진 유닛", notConnected: "온라인 경기에 연결되지 않았습니다.", createOrJoin: "방을 만들거나 참가하세요.",
    rematchWaiting: "재경기를 요청했습니다. 상대를 기다리는 중…", connecting: "게임 서버에 연결 중…",
    disconnected: "게임 서버 연결이 끊어졌습니다.", serverUnavailable: "게임 서버를 사용할 수 없습니다. 온라인 PvP에는 WebSocket 서버가 필요합니다.",
    invalidServerResponse: "게임 서버가 올바르지 않은 응답을 보냈습니다.",
    roomWaiting: "{room} 방에서 상대를 기다리는 중…", roomWaitingSide: "{room} 방 · 선택 진영: {side} · 상대를 기다리는 중…", roomPlayer: "{room} 방 · 나의 진영: {side}",
    serverRejected: "게임 서버가 요청을 거절했습니다.", enterRoomCode: "방 코드를 입력하세요.",
    resultWin: "{side} 승리", allEliminated: "상대 유닛이 모두 제거되었습니다.",
    resultDraw: "무승부", draw: "무승부", boardFilled: "보드 종료: 흑 {red} - 백 {blue} (후공 보정 +{bonus}).",
    noLegalMoves: "더 이상 둘 수 없어 종료: 흑 {red} - 백 {blue} (후공 보정 +{bonus}).",
    autoPass: "{side}은(는) 둘 수 있는 곳이 없어 자동으로 턴을 넘겼습니다.", taunt: "쫄!", tauntBubble: "쫄!!",
    suicideWarning: "이곳에 놓으면 이 유닛은 즉시 사망합니다. 그래도 놓겠습니까?",
    kingCaptured: "{side} 왕이 포획되었습니다.",
  },
};

export function createUnitLabels(language) {
  return {
    soldier: TEXT[language].soldier,
    king: TEXT[language].king,
    general: TEXT[language].general,
    diplomat: TEXT[language].diplomat,
    wizard: TEXT[language].wizard,
  };
}

export function createSpecialHelp(language) {
  return {
    general: language === "ko"
      ? "장군의 집단이 완전히 포위되면 포획 판정 전에 인접한 적 유닛을 제거합니다."
      : "When its group is fully surrounded, the General removes adjacent enemy units before capture is resolved.",
    diplomat: language === "ko"
      ? "외교관의 집단이 완전히 포위되면 포획 판정 전에 인접한 적 유닛을 아군 병사로 전환합니다."
      : "When its group is fully surrounded, the Diplomat converts adjacent enemy units into friendly Soldiers before capture is resolved.",
    wizard: language === "ko"
      ? "마법사의 집단이 완전히 포위되면 인접한 적을 제거하고 선택한 빈 칸으로 텔레포트합니다."
      : "When its group is fully surrounded, the Wizard removes adjacent enemies and then teleports to an empty cell you choose.",
  };
}
