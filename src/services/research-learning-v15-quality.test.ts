import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateDeepLearningReadinessV15 } from './research-learning-v15.js';

const cleanPromotionCandidate = {
  labelledExamples: 3000,
  positiveExamples: 1600,
  negativeExamples: 1400,
  temporalCoverageDays: 365,
  independentEvidenceGroups: 8,
  evidenceClassCount: 5,
  duplicateRate: 0.03,
  leakageChecksPassed: true,
  transparentBaselineAccuracy: 0.76,
  candidateModelAccuracy: 0.82,
  transparentBaselineLogLoss: 0.52,
  candidateModelLogLoss: 0.44,
  temporalHoldoutExamples: 500,
  temporalHoldoutPositiveExamples: 260,
  temporalHoldoutNegativeExamples: 240,
} as const;

test('high conflicting-outcome rate blocks deep-learning experimentation and promotion', () => {
  const readiness = evaluateDeepLearningReadinessV15({
    ...cleanPromotionCandidate,
    conflictRate: 0.03,
    malformedRate: 0,
  });

  assert.equal(readiness.status, 'not-ready');
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('Conflicting outcome')));
});

test('high malformed-provenance rate blocks deep-learning experimentation and promotion', () => {
  const readiness = evaluateDeepLearningReadinessV15({
    ...cleanPromotionCandidate,
    conflictRate: 0,
    malformedRate: 0.06,
  });

  assert.equal(readiness.status, 'not-ready');
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('Malformed learning provenance')));
});

test('low quarantined conflict and malformed rates still permit a clean promotion candidate', () => {
  const readiness = evaluateDeepLearningReadinessV15({
    ...cleanPromotionCandidate,
    conflictRate: 0.01,
    malformedRate: 0.02,
  });

  assert.equal(readiness.status, 'promotion-ready');
  assert.equal(readiness.blockers.length, 0);
});
