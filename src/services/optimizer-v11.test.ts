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
