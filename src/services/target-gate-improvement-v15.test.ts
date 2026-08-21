import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessPlanTargetGateImprovementV15,
  assessTargetGateImprovementV15,
} from './target-gate-improvement-v15.js';

function metrics(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    averageNonlandManaValue: 2.71,
    earlyPlayCount: 41,
    fastManaCount: 5,
    cheapInteractionCount: 13,
    tutorCount: 8,
    roleCounts: { 'free interaction': 1 },
    ...overrides,
  };
}

test('first verified full-table route outranks cosmetic tutor growth when tutor gate already passes', () => {
  const routeRepair = assessTargetGateImprovementV15({
    targetBracket: 5,
    beforeMetrics: metrics(),
    afterMetrics: metrics(),
    beforeRoute: { winRoute: 'absent', competitiveComboSignal: false },
    afterRoute: { winRoute: 'verified', competitiveComboSignal: false },
  });
  const tutorNine = assessTargetGateImprovementV15({
    targetBracket: 5,
    beforeMetrics: metrics(),
    afterMetrics: metrics({ tutorCount: 9 }),
    beforeRoute: { winRoute: 'absent', competitiveComboSignal: false },
    afterRoute: { winRoute: 'absent', competitiveComboSignal: false },
  });
  assert.deepEqual(routeRepair.repairedGates, ['verified-winning-combo']);
  assert.equal(routeRepair.score, 24);
  assert.equal(tutorNine.score, 0);
  assert.deepEqual(tutorNine.advancedFailedGates, []);
});

test('crossing the real mana-value gate dominates partial progress, while partial progress still beats cosmetic growth', () => {
  const crossing = assessTargetGateImprovementV15({
    targetBracket: 5,
    beforeMetrics: metrics({ averageNonlandManaValue: 2.71 }),
    afterMetrics: metrics({ averageNonlandManaValue: 2.59 }),
    beforeRoute: { winRoute: 'absent', competitiveComboSignal: false },
    afterRoute: { winRoute: 'absent', competitiveComboSignal: false },
  });
  const partial = assessTargetGateImprovementV15({
    targetBracket: 5,
    beforeMetrics: metrics({ averageNonlandManaValue: 2.71 }),
    afterMetrics: metrics({ averageNonlandManaValue: 2.65 }),
    beforeRoute: { winRoute: 'absent', competitiveComboSignal: false },
    afterRoute: { winRoute: 'absent', competitiveComboSignal: false },
  });
  assert.deepEqual(crossing.repairedGates, ['average-nonland-mv']);
  assert.equal(crossing.score, 10);
  assert.deepEqual(partial.advancedFailedGates, ['average-nonland-mv']);
  assert.ok(partial.score > 0);
  assert.ok(crossing.score > partial.score);
});

test('regressing an already-passing target gate is explicitly penalised', () => {
  const result = assessTargetGateImprovementV15({
    targetBracket: 5,
    beforeMetrics: metrics(),
    afterMetrics: metrics({ fastManaCount: 2 }),
    beforeRoute: { winRoute: 'absent', competitiveComboSignal: false },
    afterRoute: { winRoute: 'absent', competitiveComboSignal: false },
  });
  assert.deepEqual(result.regressedGates, ['fast-mana']);
  assert.equal(result.score, -16);
});

test('competitive R signal is independently rewarded when it becomes positively verified', () => {
  const result = assessTargetGateImprovementV15({
    targetBracket: 5,
    beforeMetrics: metrics(),
    afterMetrics: metrics(),
    beforeRoute: { winRoute: 'absent', competitiveComboSignal: false },
    afterRoute: { winRoute: 'verified', competitiveComboSignal: true },
  });
  assert.deepEqual(result.repairedGates, ['competitive-combo-signal', 'verified-winning-combo']);
  assert.equal(result.score, 38);
});

test('unavailable route evidence is ignored rather than converted into false absence', () => {
  const result = assessTargetGateImprovementV15({
    targetBracket: 5,
    beforeMetrics: metrics(),
    afterMetrics: metrics(),
    beforeRoute: { winRoute: 'unavailable', competitiveComboSignal: null },
    afterRoute: { winRoute: 'unavailable', competitiveComboSignal: null },
  });
  assert.deepEqual(result.ignoredUnverifiedGates, ['competitive-combo-signal', 'verified-winning-combo']);
  assert.equal(result.score, 0);
});

test('plan bridge only promotes a route when verified package provenance says it was injected atomically', () => {
  const result = assessPlanTargetGateImprovementV15({
    targetBracket: 5,
    beforeWinRouteStatus: 'no-verified-route',
    plan: {
      beforeMetrics: metrics(),
      afterMetrics: metrics(),
      v15TargetPressure: {
        atomicWinPackageInjected: true,
        selectedBracketTag: 'R',
      },
    },
  });
  assert.deepEqual(result.repairedGates, ['verified-winning-combo']);
  assert.equal(result.score, 24);
});

test('target-gate priority is inactive below Bracket 5', () => {
  const result = assessTargetGateImprovementV15({
    targetBracket: 4,
    beforeMetrics: metrics(),
    afterMetrics: metrics({ fastManaCount: 0, tutorCount: 0 }),
    beforeRoute: { winRoute: 'absent', competitiveComboSignal: false },
    afterRoute: { winRoute: 'verified', competitiveComboSignal: true },
  });
  assert.equal(result.applicable, false);
  assert.equal(result.score, 0);
  assert.deepEqual(result.repairedGates, []);
  assert.deepEqual(result.regressedGates, []);
});
