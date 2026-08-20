import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fingerprintExactDeckV15,
  type LearningOutcomeRecordV15,
  type LearningTargetV15,
} from './learning-corpus-v15.js';
import { evaluateNeuralOnTemporalCorpusV15 } from './neural-temporal-eval-v15.js';

const deckFingerprint = fingerprintExactDeckV15(`// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
99 Forest (M21) 272`);

function record(index: number, learningTarget: LearningTargetV15): LearningOutcomeRecordV15 {
  return {
    outcomeId: `outcome-${index}`,
    observedAt: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
    sourceId: index % 2 === 0 ? 'topdeck' : 'playgroup',
    evidenceClass: 'observed-results',
    independentGroup: `event-${index}`,
    leakageGroup: `event-${index}`,
    deckFingerprint,
    commanderNames: ['Kinnan, Bonder Prodigy'],
    features: {
      tournamentSupport: index % 2 === 0 ? 0.8 : -0.2,
      comboVerification: 1,
    },
    label: index % 3 === 0 ? 1 : 0,
    learningTarget,
  };
}

test('temporal model evaluation refuses to mix different outcome semantics into one classifier', () => {
  const records = Array.from({ length: 40 }, (_, index) => record(
    index,
    index % 2 === 0 ? 'event-top-cut' : 'match-win',
  ));
  const evaluation = evaluateNeuralOnTemporalCorpusV15(records, {
    epochs: 100,
    seed: 7,
    holdoutFraction: 0.2,
  });

  assert.equal(evaluation.corpusAudit.learningTargetCount, 2);
  assert.deepEqual(evaluation.corpusAudit.learningTargets, ['event-top-cut', 'match-win']);
  assert.equal(evaluation.neuralModel, null);
  assert.equal(evaluation.transparentModel, null);
  assert.equal(evaluation.neuralTemporalMetrics.examples, 0);
  assert.equal(evaluation.transparentTemporalMetrics.examples, 0);
  assert.ok(evaluation.evaluationWarnings.some((warning) => warning.includes('mixed learning targets')));
  assert.equal(evaluation.readiness.status, 'not-ready');
  assert.ok(evaluation.readiness.blockers.some((blocker) => blocker.includes('Mixed learning targets')));
});

test('legacy records without explicit target remain one backward-compatible target', () => {
  const records = Array.from({ length: 20 }, (_, index) => {
    const value = record(index, 'legacy-unspecified');
    delete value.learningTarget;
    return value;
  });
  const evaluation = evaluateNeuralOnTemporalCorpusV15(records, { epochs: 50, seed: 3 });

  assert.equal(evaluation.corpusAudit.learningTargetCount, 1);
  assert.deepEqual(evaluation.corpusAudit.learningTargets, ['legacy-unspecified']);
  assert.equal(evaluation.evaluationWarnings.some((warning) => warning.includes('mixed learning targets')), false);
});
