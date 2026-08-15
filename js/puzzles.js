export const PUZZLES = [
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
  {
    id: "capture-king-01",
    rank: "secondRateMaster",
    title: { en: "First Capture", ko: "첫 왕 포획" },
    description: {
      en: "Place a White Soldier to complete the surround and capture the Black King in one move.",
      ko: "백 병사를 놓아 흑 왕을 완전히 포위하고 1수 안에 포획하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "king", 4, 4],
      ["blue", "soldier", 3, 4],
      ["blue", "soldier", 5, 4],
      ["blue", "soldier", 4, 3],
    ],
    objective: { type: "winner", winner: "blue" },
  },
  {
    id: "wall-capture-01",
    rank: "firstRateMaster",
    title: { en: "Wall Capture", ko: "성벽 포획" },
    description: {
      en: "Use the White wall as an allied unit and capture the Black Soldier in one move.",
      ko: "백 성벽을 아군처럼 활용해 흑 병사를 1수 안에 포획하세요.",
    },
    player: "blue",
    maxMoves: 1,
    unit: "soldier",
    stock: {
      red: { soldier: 0, king: 0, general: 0, diplomat: 0, wizard: 0 },
      blue: { soldier: 1, king: 0, general: 0, diplomat: 0, wizard: 0 },
    },
    pieces: [
      ["red", "soldier", 8, 4],
      ["blue", "soldier", 7, 4],
      ["blue", "soldier", 8, 3],
    ],
    objective: { type: "cellOwner", row: 8, col: 4, owner: "blue" },
  },
  {
    id: "general-reversal-01",
    rank: "peakMaster",
    title: { en: "General's Reversal", ko: "장군의 반격" },
    description: {
      en: "Place the White General where it will be surrounded, then activate its skill to remove the adjacent Black Soldiers.",
      ko: "백 장군을 포위될 자리에 놓고 스킬을 발동해 인접한 흑 병사들을 제거하세요.",
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
    objective: { type: "captureAtLeast", owner: "blue", count: 2 },
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
