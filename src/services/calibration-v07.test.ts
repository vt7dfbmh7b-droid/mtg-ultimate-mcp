import assert from 'node:assert/strict';
import test from 'node:test';
import { calibratePressureFromMetricsV07, calibratePressureFromTournamentAnalysisV07 } from './calibration-v07.js';

test('maps low-interaction structures to lower pressure and dense structures higher', () => {
  const low = calibratePressureFromMetricsV07({ interactionCount: 5, cheapInteractionCount: 2, protectionCount: 1 });
  const high = calibratePressureFromMetricsV07({ interactionCount: 18, cheapInteractionCount: 13, protectionCount: 7, tutorCount: 9, fastManaCount: 5 });
  assert.equal(low.selectedPressure, 'casual');
  assert.equal(['optimized', 'cedh'].includes(high.selectedPressure), true);
  assert.equal(high.structuralPressureScore > low.structuralPressureScore, true);
});

test('reads the high-performing cohort from tournament analysis', () => {
  const result = calibratePressureFromTournamentAnalysisV07({
    highPerformingCohort: {
      averageMetrics: {
        interactionCount: 14,
        cheapInteractionCount: 9,
        protectionCount: 5,
        tutorCount: 6,
        fastManaCount: 3,
      },
    },
  });
  assert.notEqual(result, null);
  assert.equal(result?.confidence, 'medium');
});
