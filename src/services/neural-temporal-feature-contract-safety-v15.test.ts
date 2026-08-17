import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fingerprintExactDeckV15,
  type LearningOutcomeRecordV15,
} from './learning-corpus-v15.js';
import { evaluateNeuralOnTemporalCorpusV15 } from './neural-temporal-eval-v15.js';

const deckFingerprint = fingerprintExactDeckV15(`// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
99 Forest (M21) 272`);

function record(
  index: number,
  options: {
    featureExtractorId?: string;
    featureNormalizerFitFingerprint?: string;
  } = {},
): LearningOutcomeRecordV15 {
  return {
    outcomeId: `feature-contract-outcome-${index}`,
    observedAt: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
    sourceId: 'topdeck',
    evidenceClass: 'observed-results',
    independentGroup: `feature-contract-event-${index}`,
    leakageGroup: `feature-contract-event-${index}`,
    deckFingerprint,
    commanderNames: ['Kinnan, Bonder Prodigy'],
    features: {
      manaEfficiency: index % 2 === 0 ? 0.4 : -0.4,
      interactionEfficiency: index % 3 === 0 ? 0.8 : -0.2,
    },
    label: index % 3 === 0 ? 1 : 0,
    learningTarget: 'event-top-cut',
    metadata: {
      ...(options.featureExtractorId !== undefined
        ? { featureExtractorId: options.featureExtractorId }
        : {}),
      ...(options.featureNormalizerFitFingerprint !== undefined
        ? { featureNormalizerFitFingerprint: options.featureNormalizerFitFingerprint }
        : {}),
    },
  };
}

test('temporal model evaluation refuses to mix different known feature extractor contracts', () => {
  const records = Array.from({ length: 40 }, (_, index) => record(index, {
    featureExtractorId: index % 2 === 0
      ? 'deck-structural-v15.2+deck-structural-minmax-v15.1'
      : 'deck-structural-v15.3+deck-structural-minmax-v15.1',
    featureNormalizerFitFingerprint: 'a'.repeat(64),
  }));

  const evaluation = evaluateNeuralOnTemporalCorpusV15(records, {
    epochs: 50,
    seed: 13,
    holdoutFraction: 0.2,
  });

  assert.equal(evaluation.neuralModel, null);
  assert.equal(evaluation.transparentModel, null);
  assert.equal(evaluation.neuralTemporalMetrics.examples, 0);
  assert.ok(evaluation.evaluationWarnings.some((warning) => warning.includes('mixed feature extractor contracts')));
  assert.ok(evaluation.readiness.blockers.some((blocker) => blocker.includes('Mixed feature extractor contracts')));
});

test('temporal model evaluation refuses to mix different frozen normalizer fits for the same normalized feature contract', () => {
  const records = Array.from({ length: 40 }, (_, index) => record(index, {
    featureExtractorId: 'deck-structural-v15.2+deck-structural-minmax-v15.1',
    featureNormalizerFitFingerprint: index % 2 === 0 ? 'a'.repeat(64) : 'b'.repeat(64),
  }));

  const evaluation = evaluateNeuralOnTemporalCorpusV15(records, {
    epochs: 50,
    seed: 17,
    holdoutFraction: 0.2,
  });

  assert.equal(evaluation.neuralModel, null);
  assert.equal(evaluation.transparentModel, null);
  assert.ok(evaluation.evaluationWarnings.some((warning) => warning.includes('mixed feature normalizer fits')));
  assert.ok(evaluation.readiness.blockers.some((blocker) => blocker.includes('Mixed feature normalizer fits')));
});

test('normalized structural feature records fail closed when some rows omit the normalizer fit fingerprint', () => {
  const records = Array.from({ length: 40 }, (_, index) => record(index, {
    featureExtractorId: 'deck-structural-v15.2+deck-structural-minmax-v15.1',
    ...(index % 2 === 0 ? { featureNormalizerFitFingerprint: 'c'.repeat(64) } : {}),
  }));

  const evaluation = evaluateNeuralOnTemporalCorpusV15(records, {
    epochs: 50,
    seed: 19,
  });

  assert.equal(evaluation.neuralModel, null);
  assert.equal(evaluation.transparentModel, null);
  assert.ok(evaluation.evaluationWarnings.some((warning) => warning.includes('missing feature normalizer provenance')));
  assert.ok(evaluation.readiness.blockers.some((blocker) => blocker.includes('Missing feature normalizer provenance')));
});

test('legacy records with no feature-contract metadata remain backward-compatible as one legacy feature contract', () => {
  const records = Array.from({ length: 40 }, (_, index) => record(index));
  const evaluation = evaluateNeuralOnTemporalCorpusV15(records, {
    epochs: 20,
    seed: 23,
  });

  assert.equal(evaluation.evaluationWarnings.some((warning) => warning.includes('mixed feature extractor contracts')), false);
  assert.equal(evaluation.evaluationWarnings.some((warning) => warning.includes('mixed feature normalizer fits')), false);
  assert.equal(evaluation.evaluationWarnings.some((warning) => warning.includes('missing feature normalizer provenance')), false);
});

test('known feature-contract records cannot be silently combined with legacy records that have no extractor identity', () => {
  const records = Array.from({ length: 40 }, (_, index) => index % 2 === 0
    ? record(index, {
        featureExtractorId: 'deck-structural-v15.2+deck-structural-minmax-v15.1',
        featureNormalizerFitFingerprint: 'd'.repeat(64),
      })
    : record(index));

  const evaluation = evaluateNeuralOnTemporalCorpusV15(records, {
    epochs: 50,
    seed: 29,
  });

  assert.equal(evaluation.neuralModel, null);
  assert.equal(evaluation.transparentModel, null);
  assert.ok(evaluation.evaluationWarnings.some((warning) => warning.includes('mixed feature extractor contracts')));
});
