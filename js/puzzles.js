export const PUZZLES = [
  // ==========================================
  // 1. 삼류 고수 (Third-rate Master) - 기본 수련 (튜토리얼 7단계)
  // ==========================================
  {
    id: "basic-tutorial-01",
    type: "tutorial",
    rank: "thirdRateMaster",
    title: { en: "Basic Training", ko: "기본 수련" },
    description: {
      en: "Practice the basic rules, wall use, capture, and special-unit skills step by step.",
      ko: "기본 규칙, 성벽 활용, 포획, 특수 유닛 스킬을 단계별로 연습하세요.",
    },
  },

  // ==========================================
  // 2. 이류 고수 (Second-rate Master) - 기본 포획 & 사활 기초 (4문제)
  // ==========================================
  {
    id: "atari-capture-01",
    rank: "secondRateMaster",
    title: { en: "Single Atari", ko: "첫 단수 포획" },
    description: {
      en: "The Black Soldier at (4,4) has only one liberty at (4,5). Capture it in 1 move.",
      ko: "활로가 1개만 남은 흑 병사의 마지막 활로(4,5)를 막아 1수 안에 포획하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 4, 4],
      ["blue", "soldier", 3, 4],
      ["blue", "soldier", 5, 4],
      ["blue", "soldier", 4, 3],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 1 },
  },
  {
    id: "corner-wall-trap-01",
    rank: "secondRateMaster",
    title: { en: "Corner Wall Trap", ko: "성벽 구석 가두기" },
    description: {
      en: "Black Soldiers at (8,0) and (8,1) are pinned on your wall. Place at (8,2) to capture both!",
      ko: "백 성벽 구석에 갇힌 흑 병사 2기를 (8,2)에 착수하여 1수 안에 동시 포획하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 8, 0],
      ["red", "soldier", 8, 1],
      ["blue", "soldier", 7, 0],
      ["blue", "soldier", 7, 1],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 2 },
  },
  {
    id: "double-atari-01",
    rank: "secondRateMaster",
    title: { en: "Double Atari Strike", ko: "양단수 걸기" },
    description: {
      en: "Place a White Soldier at (4,4) to strike the shared intersection and capture the enemy piece.",
      ko: "두 흑 병사의 공통 활로인 (4,4)에 착수하여 양단수를 걸고 포획하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 4, 3],
      ["red", "soldier", 4, 5],
      ["blue", "soldier", 3, 3],
      ["blue", "soldier", 5, 3],
      ["blue", "soldier", 4, 2],
      ["blue", "soldier", 3, 5],
      ["blue", "soldier", 5, 5],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 1 },
  },
  {
    id: "cutting-escape-01",
    rank: "secondRateMaster",
    title: { en: "Cutting the Escape", ko: "탈출로 차단 포획" },
    description: {
      en: "Block the single path connecting the Black Soldier to its allies at (2,4) to complete the surround.",
      ko: "아군 진영으로 탈출하려는 흑 병사의 연결로인 (2,4)를 차단하고 포획하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 3, 4],
      ["red", "soldier", 1, 4],
      ["blue", "soldier", 3, 3],
      ["blue", "soldier", 3, 5],
      ["blue", "soldier", 4, 4],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 1 },
  },

  // ==========================================
  // 3. 일류 고수 (First-rate Master) - 왕 사냥 & 외통수 기초 (4문제)
  // ==========================================
  {
    id: "mate-in-one-01",
    rank: "firstRateMaster",
    title: { en: "Checkmate in 1", ko: "1수 외통수" },
    description: {
      en: "The Black King at (3,3) has only 1 liberty at (3,4). Strike at (3,4) to win the match!",
      ko: "3방향이 포위된 흑 왕의 마지막 활로인 (3,4)를 찔러 1수 안에 승리하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 3, 3],
      ["blue", "soldier", 2, 3],
      ["blue", "soldier", 4, 3],
      ["blue", "soldier", 3, 2],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "wall-king-capture-01",
    rank: "firstRateMaster",
    title: { en: "Trapped at the Wall", ko: "성벽 등진 왕 포획" },
    description: {
      en: "The Black King at (7,4) is pinned near the White wall. Close the gate at (8,4) to capture the King.",
      ko: "백 성벽 근처에 고립된 흑 왕의 퇴로인 (8,4)를 막아 포획하고 승리하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 7, 4],
      ["blue", "soldier", 6, 4],
      ["blue", "soldier", 7, 3],
      ["blue", "soldier", 7, 5],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "pincer-king-01",
    rank: "firstRateMaster",
    title: { en: "Pincer Strike", ko: "호위벽 틈새 찌르기" },
    description: {
      en: "Pierce the King's guard by deploying at (4,4) to capture the Black King at (4,5).",
      ko: "적 호위병 사이 빈틈인 (4,4)에 착수하여 흑 왕을 단숨에 포획하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 4, 5],
      ["blue", "soldier", 3, 5],
      ["blue", "soldier", 5, 5],
      ["blue", "soldier", 4, 6],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "sanctuary-expired-01",
    rank: "firstRateMaster",
    title: { en: "Sanctuary Expired", ko: "성역 해제 급습" },
    description: {
      en: "The enemy sanctuary has expired! Strike at (2,4) to complete the King's capture.",
      ko: "상대의 왕 성역이 해제되었습니다. 즉시 인접한 급소(2,4)를 찔러 승리하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 2, 4],
      ["blue", "soldier", 1, 4],
      ["blue", "soldier", 3, 4],
      ["blue", "soldier", 2, 3],
    ],
    objective: { type: "winner", winner: "blue" },
  },

  // ==========================================
  // 4. 절정 고수 (Peak Master) - 장군의 역습 & 자폭 전술 (4문제)
  // ==========================================
  {
    id: "general-blast-3-01",
    rank: "peakMaster",
    title: { en: "One Against Four", ko: "일석삼조" },
    description: {
      en: "Place the General at (4,4) where it will be surrounded by 4 Black Soldiers, eliminating them all!",
      ko: "4개의 흑 병사 한가운데인 (4,4)에 장군을 투입해 자폭으로 4기를 동시 격파하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "general",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 1, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 3, 4],
      ["red", "soldier", 5, 4],
      ["red", "soldier", 4, 3],
      ["red", "soldier", 4, 5],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 4 },
  },
  {
    id: "general-guard-demolition-01",
    rank: "peakMaster",
    title: { en: "Guard Demolition", ko: "호위벽 폭파" },
    description: {
      en: "Deploy your General at (4,3) between the enemy guards to blast through the defense.",
      ko: "흑 왕의 호위병들 사이인 (4,3)에 장군을 던져 자폭으로 호위망을 파괴하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "general",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 1, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 3, 3],
      ["red", "soldier", 5, 3],
      ["red", "soldier", 4, 2],
      ["blue", "soldier", 4, 4],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 3 },
  },
  {
    id: "general-corner-mine-01",
    rank: "peakMaster",
    title: { en: "Corner Minefield", ko: "성벽 구석 지뢰 덫" },
    description: {
      en: "Place a General at (1,1) against the Black wall to trigger an explosive counter-attack.",
      ko: "흑 성벽 근처 (1,1)에 장군을 배치하여 포위망을 역이용해 적들을 격파하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "general",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 1, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 0, 1],
      ["red", "soldier", 1, 0],
      ["red", "soldier", 1, 2],
      ["red", "soldier", 2, 1],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 3 },
  },
  {
    id: "general-blast-to-mate-01",
    rank: "peakMaster",
    title: { en: "Blast to Checkmate", ko: "자폭 후 킬각" },
    description: {
      en: "Detonate the General at (3,4) to vaporize the surrounding enemy cluster.",
      ko: "장군을 (3,4)에 투입해 자폭으로 적 핵심 병력을 제거하고 승기를 잡으세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "general",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 1, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 2, 4],
      ["red", "soldier", 4, 4],
      ["red", "soldier", 3, 3],
      ["red", "soldier", 3, 5],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 4 },
  },

  // ==========================================
  // 5. 초절정 고수 (Transcendent Master) - 외교관의 회유 & 진영 전향 (4문제)
  // ==========================================
  {
    id: "diplomat-conversion-3-01",
    rank: "transcendentMaster",
    title: { en: "Mass Conversion", ko: "호위병 전향" },
    description: {
      en: "Place the Diplomat at (4,4). When surrounded, recruit all 4 Black Soldiers into White allies!",
      ko: "4개의 흑 병사 한가운데(4,4)에 외교관을 투입해 모두 백색 아군으로 전향시키세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "diplomat",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 1, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 3, 4],
      ["red", "soldier", 5, 4],
      ["red", "soldier", 4, 3],
      ["red", "soldier", 4, 5],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 4 },
  },
  {
    id: "diplomat-instant-mate-01",
    rank: "transcendentMaster",
    title: { en: "Instant King Siege", ko: "전향군으로 즉시 왕 포위" },
    description: {
      en: "Deploy the Diplomat at (4,4) to convert the guards, instantly completing the surround of the Black King at (4,2)!",
      ko: "외교관을 (4,4)에 투입해 흑 왕의 호위병을 전향시켜 그 즉시 흑 왕(4,2)을 포위하고 승리하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "diplomat",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 1, wizard: 0 },
    },
    pieces: [
      ["red", "king", 4, 2],
      ["red", "soldier", 4, 3],
      ["red", "soldier", 3, 4],
      ["red", "soldier", 5, 4],
      ["blue", "soldier", 4, 5],
      ["blue", "soldier", 3, 2],
      ["blue", "soldier", 5, 2],
      ["blue", "soldier", 4, 1],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "diplomat-rescue-01",
    rank: "transcendentMaster",
    title: { en: "Rescue by Persuasion", ko: "아군 구출 작전" },
    description: {
      en: "Deploy your Diplomat at (3,2) to convert the besiegers and rescue your friendly troop at (2,2).",
      ko: "포위 위기에 빠진 아군(2,2) 옆 (3,2)에 외교관을 투입해 적을 포섭하고 구출하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "diplomat",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 1, wizard: 0 },
    },
    pieces: [
      ["blue", "soldier", 2, 2],
      ["red", "soldier", 4, 2],
      ["red", "soldier", 3, 1],
      ["red", "soldier", 3, 3],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 3 },
  },
  {
    id: "diplomat-center-flip-01",
    rank: "transcendentMaster",
    title: { en: "Center Reversal", ko: "중앙 요충지 장악" },
    description: {
      en: "Infiltrate the central enemy bastion at (6,5) with a Diplomat to flip all 4 foes into allies.",
      ko: "중앙 적진 한복판(6,5)에 외교관을 침투시켜 4기의 적을 아군으로 전향시키세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "diplomat",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 1, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 5, 5],
      ["red", "soldier", 7, 5],
      ["red", "soldier", 6, 4],
      ["red", "soldier", 6, 6],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 4 },
  },

  // ==========================================
  // 6. 화경 (Harmony Master) - 마법사의 비도 & 공간 도약 (4문제)
  // ==========================================
  {
    id: "wizard-assassinate-01",
    rank: "harmonyMaster",
    title: { en: "Shadow Teleport Strike", ko: "암살 텔레포트" },
    description: {
      en: "Place Wizard at (7,5) to activate teleportation, then leap to (1,2) to checkmate the Black King at (1,1)!",
      ko: "마법사를 (7,5)에 놓아 포위 발동 후, (1,2)로 순간이동하여 흑 왕(1,1)을 즉시 암살하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "wizard",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 1 },
    },
    pieces: [
      ["red", "king", 1, 1],
      ["blue", "soldier", 0, 1],
      ["blue", "soldier", 2, 1],
      ["blue", "soldier", 1, 0],
      ["red", "soldier", 6, 5],
      ["red", "soldier", 8, 5],
      ["red", "soldier", 7, 4],
      ["red", "soldier", 7, 6],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "wizard-escape-to-wall-01",
    rank: "harmonyMaster",
    title: { en: "Escape to Safety", ko: "성벽 연결 탈출" },
    description: {
      en: "Deploy Wizard at (4,4) to escape the encirclement and teleport safely to your wall at (8,4).",
      ko: "마법사를 (4,4)에 배치해 포위망을 뚫고 아군 성벽 옆 (8,4)로 안전하게 도약하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "wizard",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 1 },
    },
    pieces: [
      ["red", "soldier", 3, 4],
      ["red", "soldier", 5, 4],
      ["red", "soldier", 4, 3],
      ["red", "soldier", 4, 5],
    ],
    objective: { type: "cellOwner", row: 8, col: 4, owner: "blue" },
  },
  {
    id: "wizard-breach-fortress-01",
    rank: "harmonyMaster",
    title: { en: "Fortress Breach", ko: "진형 파고들기" },
    description: {
      en: "Place Wizard at (4,3) to destroy 4 enemy Soldiers with its powerful counter-blast.",
      ko: "마법사를 (4,3)에 놓아 포위망을 역이용해 4기의 적 병사를 일거에 격멸하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "wizard",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 1 },
    },
    pieces: [
      ["red", "soldier", 3, 3],
      ["red", "soldier", 5, 3],
      ["red", "soldier", 4, 2],
      ["red", "soldier", 4, 4],
    ],
    objective: { type: "captureAtLeast", owner: "blue", count: 4 },
  },
  {
    id: "wizard-stay-choice-01",
    rank: "harmonyMaster",
    title: { en: "The Power of Stillness", ko: "체류(Stay)의 묘수" },
    description: {
      en: "Deploy Wizard at (2,4), wipe out surrounding enemies, and choose STAY to hold the strongpoint!",
      ko: "마법사를 (2,4)에 배치해 적들을 격퇴한 후 이동하지 않고 체류(Stay)하여 요충지를 지키세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "wizard",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 1 },
    },
    pieces: [
      ["red", "soldier", 1, 4],
      ["red", "soldier", 3, 4],
      ["red", "soldier", 2, 3],
      ["red", "soldier", 2, 5],
    ],
    objective: { type: "cellOwner", row: 2, col: 4, owner: "blue" },
  },

  // ==========================================
  // 7. 현경 (Profound Master) - 2~3수 연계 수읽기 (4문제)
  // ==========================================
  {
    id: "feint-and-strike-01",
    rank: "profoundMaster",
    title: { en: "Feint & Strike", ko: "성동격서" },
    description: {
      en: "Surround the Black King at (4,4) by sealing the remaining two open liberties.",
      ko: "흑 왕(4,4)의 열린 두 활로를 침착하게 막아 외통수를 완성하세요.",
    },
    player: "blue",
    maxMoves: 2,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 2, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 4, 4],
      ["blue", "soldier", 3, 4],
      ["blue", "soldier", 5, 4],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "general-sacrifice-mate-01",
    rank: "profoundMaster",
    title: { en: "Sacrificial Breakthrough", ko: "장군 희생타 연계" },
    description: {
      en: "Place your General to blast through the guard at (3,3), then deliver the final blow to the King!",
      ko: "장군으로 방어벽(3,3)을 폭파하여 길을 연 뒤 흑 왕을 포획하여 승리하세요.",
    },
    player: "blue",
    maxMoves: 2,
    unit: "general",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 1, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 3, 2],
      ["red", "soldier", 3, 3],
      ["red", "soldier", 2, 4],
      ["red", "soldier", 4, 4],
      ["blue", "soldier", 2, 2],
      ["blue", "soldier", 4, 2],
      ["blue", "soldier", 3, 1],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "double-threat-01",
    rank: "profoundMaster",
    title: { en: "Double Threat", ko: "양수겸장" },
    description: {
      en: "Complete the siege of the cornered Black King at (6,6) in 2 decisive moves.",
      ko: "구석에 몰린 흑 왕(6,6)의 탈출로를 2수 안에 봉쇄하여 승리하세요.",
    },
    player: "blue",
    maxMoves: 2,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 2, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 6, 6],
      ["blue", "soldier", 5, 6],
      ["blue", "soldier", 7, 6],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "taunt-bluff-mate-01",
    rank: "profoundMaster",
    title: { en: "Wall Pressure Checkmate", ko: "성벽 압박 외통" },
    description: {
      en: "Tighten the encirclement around the Black King at (7,2) against the White wall.",
      ko: "백 성벽 근처의 흑 왕(7,2)을 성벽과 연계하여 2수 안에 포획하세요.",
    },
    player: "blue",
    maxMoves: 2,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 2, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 7, 2],
      ["blue", "soldier", 6, 2],
      ["blue", "soldier", 8, 2],
    ],
    objective: { type: "winner", winner: "blue" },
  },

  // ==========================================
  // 8. 생사경 (Life-and-Death Master) - 신의 한 수 (4문제)
  // ==========================================
  {
    id: "ultimate-combo-01",
    rank: "lifeDeathMaster",
    title: { en: "Peerless Dominion", ko: "천하무쌍" },
    description: {
      en: "Deploy the Diplomat at (4,4) to convert the flank, then seal the King at (4,3) for victory!",
      ko: "외교관을 (4,4)에 투입해 적 호위병을 전향시킨 뒤 흑 왕(4,3)을 완벽히 포위해 승리하세요.",
    },
    player: "blue",
    maxMoves: 2,
    unit: "diplomat",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 1, wizard: 0 },
    },
    pieces: [
      ["red", "king", 4, 3],
      ["red", "soldier", 4, 4],
      ["red", "soldier", 3, 5],
      ["red", "soldier", 5, 5],
      ["blue", "soldier", 3, 3],
      ["blue", "soldier", 5, 3],
      ["blue", "soldier", 4, 2],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "escape-from-death-01",
    rank: "lifeDeathMaster",
    title: { en: "Escape from the Abyss", ko: "사경탈출" },
    description: {
      en: "Trigger Wizard teleport at (6,4) and leap to (1,5) to checkmate the Black King at (1,4)!",
      ko: "마법사를 (6,4)에 배치해 포위 발동 후 (1,5)로 순간이동하여 흑 왕(1,4)을 역으로 포획하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "wizard",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 1 },
    },
    pieces: [
      ["red", "king", 1, 4],
      ["blue", "soldier", 0, 4],
      ["blue", "soldier", 2, 4],
      ["blue", "soldier", 1, 3],
      ["red", "soldier", 7, 4],
      ["red", "soldier", 5, 4],
      ["red", "soldier", 6, 3],
      ["red", "soldier", 6, 5],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "silent-assassination-01",
    rank: "lifeDeathMaster",
    title: { en: "Master of Shadows", ko: "암살의 극의" },
    description: {
      en: "Trigger Wizard at (3,4) to break through and teleport to (8,5) to surround the King at (8,4)!",
      ko: "마법사를 (3,4)에 배치해 포위망을 뚫고 (8,5)로 도약하여 성벽의 흑 왕(8,4)을 암살하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "wizard",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 1 },
    },
    pieces: [
      ["red", "king", 8, 4],
      ["blue", "soldier", 7, 4],
      ["blue", "soldier", 8, 3],
      ["red", "soldier", 2, 4],
      ["red", "soldier", 4, 4],
      ["red", "soldier", 3, 3],
      ["red", "soldier", 3, 5],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "life-and-death-duel-01",
    rank: "lifeDeathMaster",
    title: { en: "The Final Arbiter", ko: "생사결" },
    description: {
      en: "Close the final two avenues of escape around the Black King at (4,4) to achieve true Mastery.",
      ko: "흑 왕(4,4)의 남은 활로를 차단하고 대국의 궁극에 도달하세요.",
    },
    player: "blue",
    maxMoves: 2,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 2, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 4, 4],
      ["blue", "soldier", 3, 4],
      ["blue", "soldier", 5, 4],
    ],
    objective: { type: "winner", winner: "blue" },
  },
];

export const RANK_LABELS = {
  en: {
    thirdRateMaster: "Third-rate Master",
    secondRateMaster: "Second-rate Master",
    firstRateMaster: "First-rate Master",
    peakMaster: "Peak Master",
    transcendentMaster: "Transcendent Master",
    harmonyMaster: "Harmony Master",
    profoundMaster: "Profound Master",
    lifeDeathMaster: "Life-and-Death Master",
  },
  ko: {
    thirdRateMaster: "삼류 고수",
    secondRateMaster: "이류 고수",
    firstRateMaster: "일류 고수",
    peakMaster: "절정 고수",
    transcendentMaster: "초절정 고수",
    harmonyMaster: "화경",
    profoundMaster: "현경",
    lifeDeathMaster: "생사경",
  },
};

export const RANK_ORDER = [
  "thirdRateMaster",
  "secondRateMaster",
  "firstRateMaster",
  "peakMaster",
  "transcendentMaster",
  "harmonyMaster",
  "profoundMaster",
  "lifeDeathMaster",
];
