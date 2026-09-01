import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, kingLibertyCount } from "../src/index.js";
import {
  evaluateState,
  evaluateStateDetailed,
  evaluateStateTransition,
  TERMINAL_STATE_VALUE,
} from "../../../js/state-evaluation.js";

function piece(owner, type, id) {
  return {
    id,
    owner,
    type,
    originalType: type,
    revealed: type === "king",
    abilityUsed: false,
    kingEscapeUsed: false,
  };
}

const settings = {
  score: {
    center: 2,
    home: 1,
    capture: 10,
    kingPressure: 12,
    kingSafety: 12,
    defense: 3,
    influence: 4,
    groupTactics: 5,
  },
};

test("common state evaluation is exactly zero-sum between colors", () => {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.board[0][4] = piece("black", "king", "black-king");
  state.board[8][4] = piece("white", "king", "white-king");
  state.board[3][4] = piece("black", "soldier", "black-soldier");
  state.board[6][5] = piece("white", "soldier", "white-soldier");
  state.stats.captures = { black: 2, white: 1 };

  assert.equal(evaluateState(state, "black", settings), -evaluateState(state, "white", settings));
});

test("terminal wins and losses have fixed opposite values", () => {
  const state = createGameState();
  state.winner = "black";
  assert.equal(evaluateState(state, "black", settings), TERMINAL_STATE_VALUE);
  assert.equal(evaluateState(state, "white", settings), -TERMINAL_STATE_VALUE);
});

test("state transition value uses the same common state evaluation", () => {
  const before = createGameState();
  before.firstDeployDone = { black: true, white: true };
  before.board[0][4] = piece("black", "king", "black-king");
  before.board[8][4] = piece("white", "king", "white-king");
  const after = structuredClone(before);
  after.board[4][4] = piece("black", "soldier", "black-center");

  const delta = evaluateStateTransition(before, after, "black", settings);
  assert.equal(delta, evaluateState(after, "black", settings) - evaluateState(before, "black", settings));
  assert.equal(delta, -evaluateStateTransition(before, after, "white", settings));
  assert.ok(evaluateStateDetailed(after, "black", settings).weighted.material > 0);
});

test("common evaluation respects explicit zero-weight ablations", () => {
  const state = createGameState();
  state.board[4][4] = piece("black", "soldier", "black-center");
  const result = evaluateStateDetailed(state, "black", {
    score: {
      capture: 0,
      kingSafety: 0,
      kingPressure: 0,
      groupTactics: 0,
      influence: 0,
      center: 0,
      home: 0,
    },
  });

  assert.equal(result.value, 0);
});

/**
 * Black's King is sealed against its own wall with no board liberty; White's stands in the open
 * with three. This is the pair the liberty count ranked backwards.
 */
function inversionState() {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  state.board[0][4] = piece("black", "king", "black-king");
  state.board[1][4] = piece("white", "soldier", "seal-south");
  state.board[0][3] = piece("white", "soldier", "seal-west");
  state.board[0][5] = piece("white", "soldier", "seal-east");
  state.board[5][4] = piece("white", "king", "white-king");
  state.board[4][4] = piece("black", "soldier", "black-centre");
  return state;
}

test("the terminal objective model ranks a wall-anchored King above an exposed one", () => {
  const state = inversionState();

  // Black's King cannot be taken by soldiers at all; White's is three moves from capture. The
  // liberty count says the opposite, because one wall liberty reads as fewer than three board
  // liberties.
  assert.ok(kingLibertyCount(state, "black") < kingLibertyCount(state, "white"));
  assert.ok(evaluateStateDetailed(state, "black", settings).features.kingLiberties < 0);

  const fixed = evaluateStateDetailed(state, "black", { ...settings, terminalObjectiveModel: true });
  assert.ok(fixed.features.kingLiberties > 0);

  // An out-of-reach King scores exactly 0, so safety stops drawing on the budget the
  // territory term will need.
  const safeOnly = evaluateStateDetailed(state, "white", { ...settings, terminalObjectiveModel: true });
  assert.equal(fixed.features.kingLiberties, -safeOnly.features.kingLiberties);
});

test("the terminal objective flag leaves the default evaluation path untouched", () => {
  const state = inversionState();
  const off = evaluateStateDetailed(state, "black", settings);
  const on = evaluateStateDetailed(state, "black", { ...settings, terminalObjectiveModel: true });

  // The flag has to change something, or the A/B run measures nothing.
  assert.notEqual(off.features.kingLiberties, on.features.kingLiberties);

  // With the flag absent the feature still follows the liberty-count formula exactly.
  const libertyValue = (owner) => {
    const liberties = kingLibertyCount(state, owner);
    if (liberties <= 0) return -12;
    if (liberties === 1) return -8;
    if (liberties === 2) return -3;
    return Math.min(6, liberties - 2);
  };
  assert.equal(off.features.kingLiberties, libertyValue("black") - libertyValue("white"));

  // Both paths stay exactly zero-sum.
  for (const s of [settings, { ...settings, terminalObjectiveModel: true }]) {
    assert.equal(evaluateState(state, "black", s), -evaluateState(state, "white", s));
  }
});

test("the three Stage 1 flags isolate their features and reproduce the combined model", () => {
  const state = inversionState();
  for (let col = 0; col < 9; col += 1) {
    if (!state.board[7][col]) state.board[7][col] = piece("black", "soldier", `late-black-${col}`);
  }
  const baseSettings = { ...settings, kingTacticalPriority: 0.9 };
  const baseline = evaluateStateDetailed(state, "black", baseSettings);
  const kingOnly = evaluateStateDetailed(state, "black", { ...baseSettings, kingDangerModel: true });
  const territoryOnly = evaluateStateDetailed(state, "black", { ...baseSettings, territoryVerdictModel: true });
  const additiveOnly = evaluateStateDetailed(state, "black", { ...baseSettings, additiveObjectiveModel: true });

  assert.notEqual(kingOnly.features.kingLiberties, baseline.features.kingLiberties);
  assert.equal(kingOnly.features.territoryVerdict, 0);
  assert.equal(territoryOnly.features.kingLiberties, baseline.features.kingLiberties);
  assert.notEqual(territoryOnly.features.territoryVerdict, 0);
  assert.deepEqual(additiveOnly.features, baseline.features);
  assert.notEqual(additiveOnly.value, baseline.value);

  const split = evaluateStateDetailed(state, "black", {
    ...baseSettings,
    kingDangerModel: true,
    territoryVerdictModel: true,
    additiveObjectiveModel: true,
  });
  const combined = evaluateStateDetailed(state, "black", {
    ...baseSettings,
    terminalObjectiveModel: true,
  });
  assert.deepEqual(split, combined);
});

/**
 * Fills `filled` cells while holding Black's margin at exactly `margin`, so the only thing that
 * varies between two of these boards is how close the match is to a territory finish.
 * `filled` and `margin` must share parity for an exact split to exist.
 */
function filledBoard(filled, margin) {
  assert.equal((filled - margin) % 2, 0, "filled and margin must share parity");
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  const reds = (filled + margin) / 2;
  let placed = 0;
  for (let row = 0; row < 9 && placed < filled; row += 1) {
    for (let col = 0; col < 9 && placed < filled; col += 1) {
      state.board[row][col] = piece(placed < reds ? "black" : "white", "soldier", `s${placed}`);
      placed += 1;
    }
  }
  return state;
}

test("the territory verdict grows with board fill at a fixed stone margin", () => {
  const on = { ...settings, terminalObjectiveModel: true };
  const margin = 4;
  const values = [20, 40, 60, 72, 80].map((filled) =>
    evaluateStateDetailed(filledBoard(filled, margin), "black", on).features.territoryVerdict);

  for (let i = 1; i < values.length; i += 1) {
    assert.ok(values[i] > values[i - 1], `fill step ${i} must raise the verdict`);
  }

  // King captures finish at a median 27% fill, so the term has to stay out of the midgame...
  assert.ok(values[0] < 0.01, "an early board must not carry a territory verdict");
  // ...and be most of the margin by the time a territory finish is actually imminent.
  assert.ok(values[4] > margin * 0.5, "a nearly full board must nearly commit to the margin");
});

test("the territory verdict is exactly zero unless the terminal objective model is on", () => {
  for (const filled of [20, 60, 80]) {
    const state = filledBoard(filled, 4);
    const off = evaluateStateDetailed(state, "black", settings);
    assert.equal(off.features.territoryVerdict, 0);
    assert.equal(off.weighted.territoryVerdict, 0);
  }

  // The margin itself is unchanged; only its verdict weighting is gated.
  const state = filledBoard(60, 4);
  assert.equal(evaluateStateDetailed(state, "black", settings).features.material, 4);
  assert.equal(
    evaluateStateDetailed(state, "black", { ...settings, terminalObjectiveModel: true }).features.material,
    4,
  );
});

test("the additive combination stops a King penalty from erasing a strategic lead", () => {
  const state = createGameState();
  state.firstDeployDone = { black: true, white: true };
  // Black's King stands in the open, so the danger term is live rather than anchored to 0.
  state.board[4][4] = piece("black", "king", "black-king");
  state.board[3][4] = piece("white", "soldier", "presser");
  state.board[8][4] = piece("white", "king", "white-king");
  for (let col = 0; col < 9; col += 1) {
    state.board[6][col] = piece("black", "soldier", `black-wall-${col}`);
  }

  // The blend only bites when a tier actually sets a King priority; Grandmaster ships 0.9.
  const budgeted = { ...settings, kingTacticalPriority: 0.9 };
  const blended = evaluateStateDetailed(state, "black", budgeted);
  const additive = evaluateStateDetailed(state, "black", { ...budgeted, terminalObjectiveModel: true });

  // The premise of the test: this is a position where the King term is not zero, which is the
  // only case in which the two combinations can differ.
  assert.notEqual(blended.weighted.kingLiberties, 0);
  assert.notEqual(additive.weighted.kingLiberties, 0);

  const strategicSum = (result) => Object.entries(result.weighted)
    .filter(([key]) => key !== "kingLiberties" && key !== "territoryVerdict")
    .reduce((sum, [, component]) => sum + component, 0);
  assert.ok(strategicSum(blended) > 0, "Black must hold a positional lead here");

  // Under the fixed budget a King penalty smaller than the positional lead still outvotes it,
  // because the lead is only worth `1 - kingTacticalPriority` of itself.
  assert.ok(Math.abs(blended.weighted.kingLiberties) < strategicSum(blended));
  assert.ok(blended.value < additive.value);

  // Added rather than traded, so both terms can be large at once.
  assert.ok(additive.value > 0);
});

test("the additive path keeps the territory verdict out of the phase multiplier", () => {
  const on = { ...settings, terminalObjectiveModel: true, strategicContext: true };
  const state = filledBoard(72, 4);
  const result = evaluateStateDetailed(state, "black", on);

  // A settled stone count is not a matter of shape, so the phase multiplier must not touch it:
  // the verdict enters the total at exactly its weighted value.
  const strategicSum = Object.entries(result.weighted)
    .filter(([key]) => key !== "kingLiberties" && key !== "territoryVerdict")
    .reduce((sum, [, component]) => sum + component, 0);
  const withoutPhase = result.weighted.territoryVerdict + strategicSum + result.weighted.kingLiberties;
  const phaseApplied = result.value - withoutPhase;

  // Whatever the multiplier does, it moves only the strategic block.
  assert.ok(Math.abs(phaseApplied) < Math.abs(strategicSum) + 1e-9);
  assert.ok(result.weighted.territoryVerdict > 0);
});
