import assert from 'node:assert/strict';
import test from 'node:test';
import {
  refinementImprovementScoreV11,
  requestedStructuralDeficitProgressV15,
} from './optimizer-v11.js';
import {
  candidateTargetGateProgressGateV15,
  refinementRoundLimitV12,
} from './optimizer-v12.js';

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

test('iterative refinement round limits can pursue the requested swap budget without an implicit five-round stop', () => {
  assert.equal(refinementRoundLimitV12(undefined, 30), 30);
  assert.equal(refinementRoundLimitV12(undefined, 12), 12);
  assert.equal(refinementRoundLimitV12(5, 30), 5, 'an explicit caller cap remains authoritative');
  assert.equal(refinementRoundLimitV12(100, 30), 30, 'the safety ceiling remains bounded');
});

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

test('V0.12 scoring recognizes measured progress toward an active structural deficit', () => {
  const failing = metrics({
    averageNonlandManaValue: 3.32,
    earlyPlayCount: 21,
    cheapInteractionCount: 2,
    fastManaCount: 1,
    tutorCount: 0,
    protectionCount: 2,
  });
  const candidate = plan({
    simulation: { delta: { functionalKeepRate: -2 } },
    beforeMetrics: failing,
    afterMetrics: { ...failing, protectionCount: 3 },
    v15TargetPressure: {
      targetPressure: { targetBracket: 4 },
      winRouteVerificationStatus: 'protected',
      atomicWinPackageInjected: false,
      selectedBracketTag: null,
    },
    sourceUpgradeAnalysis: {
      structuralDeficits: [{ role: 'protection', current: 2, target: 8 }],
    },
  });
  const score = refinementImprovementScoreV11(candidate);

  assert.equal(requestedStructuralDeficitProgressV15(candidate), 1);
  assert.equal(score.components.requestedStructuralProgress, 3);
  assert.ok(score.score > 0.1, 'one verified floor step must outweigh ordinary non-significant simulation noise');
  assert.equal(score.significantRegression, false);
  assert.equal(score.zeroTargetProgressWhileFailedGatesRemain, false);
  assert.equal(candidateTargetGateProgressGateV15(score).eligible, true);
});

test('structural deficit credit is bounded at the requested floor and does not reward unrelated churn', () => {
  const candidate = plan({
    beforeMetrics: metrics({ protectionCount: 2, drawCount: 22 }),
    afterMetrics: metrics({ protectionCount: 12, drawCount: 30 }),
    v15TargetPressure: {
      targetPressure: { targetBracket: 5 },
      winRouteVerificationStatus: 'protected',
    },
    sourceUpgradeAnalysis: {
      structuralDeficits: [{ role: 'protection', current: 2, target: 8 }],
    },
  });

  assert.equal(requestedStructuralDeficitProgressV15(candidate), 6);
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
