import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateUpgradeSpendV11, refinementImprovementScoreV11 } from './optimizer-v11.js';

test('V0.11 totals exact recommended printing prices across swaps', () => {
  const result = estimateUpgradeSpendV11({
    swaps: [
      { recommendedPrinting: { priceUsd: 12.5 } },
      { recommendedPrinting: { priceUsd: 7.25 } },
      { recommendedPrinting: { priceUsd: null } },
    ],
  });
  assert.equal(result.estimatedSpendUsd, 19.75);
  assert.equal(result.unknownPriceCount, 1);
});

test('V0.11 rewards simulated and structural improvements', () => {
  const result = refinementImprovementScoreV11({
    simulation: {
      delta: {
        functionalKeepRate: 2,
        commanderUptimePercent: 3,
        protectionWinRate: 1,
        averageSpellsCast: 0.2,
      },
    },
    beforeMetrics: {
      interactionCount: 8,
      protectionCount: 2,
      drawCount: 8,
      rampCount: 8,
      tutorCount: 1,
      earlyPlayCount: 10,
      averageNonlandManaValue: 3.8,
    },
    afterMetrics: {
      interactionCount: 11,
      protectionCount: 4,
      drawCount: 10,
      rampCount: 10,
      tutorCount: 2,
      earlyPlayCount: 13,
      averageNonlandManaValue: 3.3,
    },
  });
  assert.ok(result.score > 0);
  assert.equal(result.significantRegression, false);
});

test('V0.11 flags material keep-rate regressions', () => {
  const result = refinementImprovementScoreV11({
    simulation: {
      delta: {
        functionalKeepRate: -5,
        commanderUptimePercent: 1,
        averageSpellsCast: 0.1,
      },
    },
    beforeMetrics: {},
    afterMetrics: {},
  });
  assert.equal(result.significantRegression, true);
});

function bracket5Metrics(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

function bracket5Pressure(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    targetPressure: { targetBracket: 5 },
    winRouteVerificationStatus: 'no-verified-route',
    atomicWinPackageInjected: false,
    selectedBracketTag: null,
    ...overrides,
  };
}

test('shared refinement score strongly prefers the first verified route over tutor #9 after the real tutor gate already passes', () => {
  const route = refinementImprovementScoreV11({
    simulation: { delta: {} },
    beforeMetrics: bracket5Metrics(),
    afterMetrics: bracket5Metrics(),
    v15TargetPressure: bracket5Pressure({
      atomicWinPackageInjected: true,
      selectedBracketTag: 'P',
    }),
  });
  const tutorNine = refinementImprovementScoreV11({
    simulation: { delta: {} },
    beforeMetrics: bracket5Metrics(),
    afterMetrics: bracket5Metrics({ tutorCount: 9 }),
    v15TargetPressure: bracket5Pressure(),
  });
  assert.equal(route.components.targetGatePriority, 24);
  assert.equal(tutorNine.components.targetGatePriority, 0);
  assert.ok(route.score > tutorNine.score + 20);
});

test('shared refinement score treats regression of an already-passing Bracket-5 gate as significant', () => {
  const result = refinementImprovementScoreV11({
    simulation: { delta: {} },
    beforeMetrics: bracket5Metrics({ fastManaCount: 3 }),
    afterMetrics: bracket5Metrics({ fastManaCount: 2 }),
    v15TargetPressure: bracket5Pressure(),
  });
  assert.equal(result.significantRegression, true);
  assert.ok((result.components.targetGatePriority ?? 0) < 0);
});

test('shared refinement score exposes positive cosmetic movement as zero target progress while Bracket-5 gates still fail', () => {
  const result = refinementImprovementScoreV11({
    simulation: { delta: { functionalKeepRate: 3 } },
    beforeMetrics: bracket5Metrics(),
    afterMetrics: bracket5Metrics({ tutorCount: 9 }),
    v15TargetPressure: bracket5Pressure(),
  });

  assert.ok(result.score > 0, 'cosmetic/simulation movement can still make the legacy aggregate score positive');
  assert.equal(result.zeroTargetProgressWhileFailedGatesRemain, true);
  assert.ok(result.targetGate.failedBefore.includes('verified-winning-combo'));
  assert.deepEqual(result.targetGate.repairedGates, []);
  assert.deepEqual(result.targetGate.advancedFailedGates, []);
});

test('shared refinement score does not activate the hard target-progress guard below Bracket 5', () => {
  const result = refinementImprovementScoreV11({
    simulation: { delta: { functionalKeepRate: 3 } },
    beforeMetrics: bracket5Metrics(),
    afterMetrics: bracket5Metrics({ tutorCount: 9 }),
    v15TargetPressure: bracket5Pressure({ targetPressure: { targetBracket: 4 } }),
  });

  assert.equal(result.targetGate.applicable, false);
  assert.equal(result.zeroTargetProgressWhileFailedGatesRemain, false);
  assert.ok(result.score > 0);
});

test('shared refinement score allows measurable movement toward a failed B5 gate', () => {
  const result = refinementImprovementScoreV11({
    simulation: { delta: {} },
    beforeMetrics: bracket5Metrics({ averageNonlandManaValue: 2.71 }),
    afterMetrics: bracket5Metrics({ averageNonlandManaValue: 2.65 }),
    v15TargetPressure: bracket5Pressure(),
  });

  assert.deepEqual(result.targetGate.advancedFailedGates, ['average-nonland-mv']);
  assert.equal(result.zeroTargetProgressWhileFailedGatesRemain, false);
  assert.ok(result.score > 0);
});

test('shared refinement score does not invent a B5 failure when the only unresolved construction evidence is unavailable', () => {
  const passingKnownMetrics = bracket5Metrics({ averageNonlandManaValue: 2.5 });
  const result = refinementImprovementScoreV11({
    simulation: { delta: { functionalKeepRate: 1 } },
    beforeMetrics: passingKnownMetrics,
    afterMetrics: passingKnownMetrics,
    v15TargetPressure: bracket5Pressure({ winRouteVerificationStatus: 'verification-unavailable' }),
  });

  assert.deepEqual(result.targetGate.failedBefore, []);
  assert.equal(result.zeroTargetProgressWhileFailedGatesRemain, false);
  assert.ok(result.score > 0);
});
