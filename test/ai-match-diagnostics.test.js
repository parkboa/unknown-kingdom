import assert from "node:assert/strict";
import { test } from "node:test";
import { playDeterministicAiMatch } from "../scripts/lib/ai-match.mjs";

test("AI match decision diagnostics expose the pre-deployment special planting context", () => {
  const decisions = [];
  playDeterministicAiMatch({
    redTier: "novice",
    blueTier: "intermediate",
    seed: 7,
    gameId: "decision-context-test",
    maxDeployments: 1,
    collectDecisionDiagnostics: true,
    onDecision: (decision) => decisions.push(decision),
  });

  assert.equal(decisions.length, 1);
  assert.deepEqual(decisions[0].decisionContext, {
    ownDeploymentCount: 0,
    enemyDeploymentCount: 0,
    occupiedCount: 0,
    remainingSpecials: { general: 1, wizard: 1, diplomat: 1 },
  });
});
