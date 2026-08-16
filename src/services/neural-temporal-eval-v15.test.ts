import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintExactDeckV15, type LearningOutcomeRecordV15 } from './learning-corpus-v15.js';
import { evaluateNeuralOnTemporalCorpusV15 } from './neural-temporal-eval-v15.js';

const exactDeckFingerprint = fingerprintExactDeckV15(`// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
1 Sol Ring (CMM) 396
98 Forest (M21) 272`);

function temporalXorCorpus(size = 200): LearningOutcomeRecordV15[] {
  const patterns = [
    { a: -1, b: -1, label: 0 as const },
    { a: -1, b: 1, label: 1 as const },
    { a: 1, b: -1, label: 1 as const },
    { a: 1, b: 1, label: 0 as const },
  ];
  const start = Date.UTC(2025, 0, 1);
  return Array.from({ length: size }, (_, index) => {
    const pattern = patterns[index % patterns.length];
    if (!pattern) throw new Error('missing XOR pattern');
    return {
      outcomeId: `outcome-${index}`,
      observedAt: new Date(start + index * 86_400_000).toISOString(),
      sourceId: index % 2 === 0 ? 'topdeck' : 'playgroup',
      evidenceClass: index % 2 === 0 ? 'observed-results' : 'recorded-games',
      independentGroup: `event-${index}`,
      leakageGroup: `event-${index}`,
      deckFingerprint: exactDeckFingerprint,
      commanderNames: ['Kinnan, Bonder Prodigy'],
      features: {
        tournamentSupport: pattern.a,
        comboVerification: pattern.b,
      },
      label: pattern.label,
    };
  });
}

test('temporal evaluation measures neural and transparent models on the same unseen future records', () => {
  const evaluation = evaluateNeuralOnTemporalCorpusV15(temporalXorCorpus(), {
    epochs: 700,
    learningRate: 0.045,
    l2: 0.0005,
    seed: 42,
    holdoutFraction: 0.2,
  });

  assert.equal(evaluation.split.leakageChecksPassed, true);
  assert.equal(evaluation.split.trainingRecords, 160);
  assert.equal(evaluation.split.holdoutRecords, 40);
  assert.equal(evaluation.neuralTemporalMetrics.examples, 40);
  assert.equal(evaluation.transparentTemporalMetrics.examples, 40);
  assert.ok((evaluation.neuralTemporalMetrics.accuracy ?? 0) >= 0.95);
  assert.ok((evaluation.transparentTemporalMetrics.accuracy ?? 1) <= 0.75);
  assert.ok((evaluation.temporalAccuracyImprovement ?? 0) >= 0.2);
});

test('strong synthetic model performance still does not bypass real-data readiness requirements', () => {
  const evaluation = evaluateNeuralOnTemporalCorpusV15(temporalXorCorpus(), {
    epochs: 650,
    seed: 7,
  });

  assert.equal(evaluation.readiness.status, 'not-ready');
  assert.ok(evaluation.readiness.blockers.some((blocker) => blocker.includes('labelled examples')));
  assert.ok(evaluation.readiness.blockers.some((blocker) => blocker.includes('Temporal holdout')));
});
