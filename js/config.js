export const SIZE = 9;
export const SPECIALS = new Set(["general", "diplomat", "wizard"]);
export const DEPLOY_ORDER = ["soldier", "general", "diplomat", "wizard", "king"];
export const AI_PROFILES = ["balanced", "aggressive", "defensive"];
export const PVE_HUMAN = "blue";
export const PVE_AI = "red";

export const TEXT = {
  en: {
    deploy: "Deploy", language: "Language", chooseMode: "Choose Game Mode", chooseModeDescription: "Select how you want to start this match.",
    pveDescription: "Play as White against the Black AI", onlinePvp: "Online PvP", pvpDescription: "Create or join a private network room",
    networkLobby: "Network Lobby", networkPrompt: "Create a room or enter an invitation code.", roomCode: "Room code",
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
    roomWaiting: "Room {room}. Waiting for opponent…", roomPlayer: "Room {room} · You are {side}.",
    serverRejected: "The game server rejected the request.", enterRoomCode: "Enter a room code.",
    resultWin: "{side} Wins", allEliminated: "All enemy units were eliminated.",
    resultDraw: "Draw", draw: "Draw", boardFilled: "Board filled: Black {red} - White {blue}.",
    noLegalMoves: "No legal deployments remained: Black {red} - White {blue}.",
    autoPass: "{side} had no legal deployment and passed.",
    kingCapturedSecond: "{side} King was captured a second time.",
  },
  ko: {
    deploy: "유닛 배치", language: "언어", chooseMode: "게임 모드 선택", chooseModeDescription: "플레이할 게임 모드를 선택하세요.",
    pveDescription: "백 진영으로 흑 AI와 대결", onlinePvp: "온라인 PvP", pvpDescription: "비공개 방을 만들거나 참가",
    networkLobby: "온라인 대기실", networkPrompt: "방을 만들거나 초대 코드를 입력하세요.", roomCode: "방 코드",
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
    roomWaiting: "{room} 방에서 상대를 기다리는 중…", roomPlayer: "{room} 방 · 나의 진영: {side}",
    serverRejected: "게임 서버가 요청을 거절했습니다.", enterRoomCode: "방 코드를 입력하세요.",
    resultWin: "{side} 승리", allEliminated: "상대 유닛이 모두 제거되었습니다.",
    resultDraw: "무승부", draw: "무승부", boardFilled: "보드 종료: 흑 {red} - 백 {blue}.",
    noLegalMoves: "양쪽 모두 둘 수 없어 종료: 흑 {red} - 백 {blue}.",
    autoPass: "{side}은(는) 둘 수 있는 곳이 없어 자동으로 턴을 넘겼습니다.",
    kingCapturedSecond: "{side} 왕이 두 번째로 포획되었습니다.",
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
