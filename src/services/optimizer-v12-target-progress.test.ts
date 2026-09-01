import assert from 'node:assert/strict';
import test from 'node:test';
import { refinementImprovementScoreV11 } from './optimizer-v11.js';
import { candidateTargetGateProgressGateV15 } from './optimizer-v12.js';

function metrics(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    interactionCount: 18,
    protectionCount: 13,
    drawCount: 22,
    rampCount: 31,
    tutorCount: 8,
    earlyPlayCount: 41,
    averageNonlandManaValue: 2.71,
    fastManaCount: 5,
    cheapInteractionCount: 13,
    roleCounts: { 'free interaction': 1 },
    ...overrides,
  };
}

function plan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    simulation: { delta: { functionalKeepRate: 4 } },
    beforeMetrics: metrics(),
    afterMetrics: metrics({ tutorCount: 9 }),
    v15TargetPressure: {
      targetPressure: { targetBracket: 5 },
      winRouteVerificationStatus: 'no-verified-route',
      atomicWinPackageInjected: false,
      selectedBracketTag: null,
    },
    ...overrides,
  };
}

test('V0.12 iterative candidate gate rejects a positive-scoring package with zero Bracket-5 target progress', () => {
  const score = refinementImprovementScoreV11(plan());
  const gate = candidateTargetGateProgressGateV15(score);

  assert.ok(score.score > 0);
  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'package-does-not-repair-or-advance-failed-bracket-5-target-gate');
});

test('V0.12 iterative candidate gate accepts measurable progress toward a failed Bracket-5 gate', () => {
  const score = refinementImprovementScoreV11(plan({
    afterMetrics: metrics({ averageNonlandManaValue: 2.65 }),
  }));
  const gate = candidateTargetGateProgressGateV15(score);

  assert.deepEqual(score.targetGate.advancedFailedGates, ['average-nonland-mv']);
  assert.equal(gate.eligible, true);
});

test('V0.12 iterative candidate gate rejects cosmetic movement while Bracket-4 optimized gates still fail', () => {
  const failing = metrics({
    averageNonlandManaValue: 3.32,
    earlyPlayCount: 21,
    cheapInteractionCount: 2,
    fastManaCount: 1,
    tutorCount: 0,
  });
  const score = refinementImprovementScoreV11(plan({
    beforeMetrics: failing,
    afterMetrics: { ...failing, drawCount: 23 },
    v15TargetPressure: {
      targetPressure: { targetBracket: 4 },
      winRouteVerificationStatus: 'no-verified-route',
      atomicWinPackageInjected: false,
      selectedBracketTag: null,
    },
  }));
  const gate = candidateTargetGateProgressGateV15(score);

  assert.equal(score.targetGate.applicable, true);
  assert.equal(score.zeroTargetProgressWhileFailedGatesRemain, true);
  assert.equal(gate.eligible, false);
});

test('V0.12 iterative candidate gate accepts measurable Bracket-4 curve progress', () => {
  const failing = metrics({
    averageNonlandManaValue: 3.32,
    earlyPlayCount: 21,
    cheapInteractionCount: 2,
    fastManaCount: 1,
    tutorCount: 0,
  });
  const score = refinementImprovementScoreV11(plan({
    beforeMetrics: failing,
    afterMetrics: { ...failing, averageNonlandManaValue: 3.29 },
    v15TargetPressure: {
      targetPressure: { targetBracket: 4 },
      winRouteVerificationStatus: 'no-verified-route',
      atomicWinPackageInjected: false,
      selectedBracketTag: null,
    },
  }));
  const gate = candidateTargetGateProgressGateV15(score);

  assert.deepEqual(score.targetGate.advancedFailedGates, ['average-nonland-mv']);
  assert.equal(score.zeroTargetProgressWhileFailedGatesRemain, false);
  assert.equal(gate.eligible, true);
});

test('V0.12 iterative candidate gate leaves Bracket-3 scoring unchanged', () => {
  const score = refinementImprovementScoreV11(plan({
    v15TargetPressure: {
      targetPressure: { targetBracket: 3 },
      winRouteVerificationStatus: 'no-verified-route',
      atomicWinPackageInjected: false,
      selectedBracketTag: null,
    },
  }));
  const gate = candidateTargetGateProgressGateV15(score);

  assert.equal(score.targetGate.applicable, false);
  assert.equal(gate.eligible, true);
  assert.equal(gate.reason, 'bracket-5-target-progress-gate-not-applicable');
});

test('V0.12 iterative candidate gate permits tie-breaker scoring after every known Bracket-5 construction gate passes', () => {
  const passing = metrics({ averageNonlandManaValue: 2.5 });
  const score = refinementImprovementScoreV11(plan({
    beforeMetrics: passing,
    afterMetrics: passing,
    v15TargetPressure: {
      targetPressure: { targetBracket: 5 },
      winRouteVerificationStatus: 'protected',
      atomicWinPackageInjected: false,
      selectedBracketTag: null,
    },
  }));
  const gate = candidateTargetGateProgressGateV15(score);

  assert.deepEqual(score.targetGate.failedBefore, []);
  assert.equal(score.zeroTargetProgressWhileFailedGatesRemain, false);
  assert.equal(gate.eligible, true);
});
