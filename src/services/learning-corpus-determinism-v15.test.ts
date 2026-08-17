import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deduplicateLearningCorpusV15,
  fingerprintExactDeckV15,
  temporalSplitLearningCorpusV15,
  type LearningOutcomeRecordV15,
} from './learning-corpus-v15.js';

const fingerprint = fingerprintExactDeckV15(`// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
99 Forest (M21) 272`);

function record(overrides: Partial<LearningOutcomeRecordV15> = {}): LearningOutcomeRecordV15 {
  return {
    outcomeId: 'event-1-player-1',
    observedAt: '2026-01-01T00:00:00.000Z',
    sourceId: 'topdeck',
    evidenceClass: 'observed-results',
    independentGroup: 'event-1',
    leakageGroup: 'event-1',
    deckFingerprint: fingerprint,
    commanderNames: ['Kinnan, Bonder Prodigy'],
    features: { manaEfficiency: 0.2, interactionEfficiency: 0.4 },
    label: 1,
    learningTarget: 'event-top-cut',
    importance: 1,
    metadata: {
      sourceRecordId: 'topdeck:event-1:p1',
      featureExtractorId: 'deck-structural-v15.1+deck-structural-minmax-v15.1',
    },
    ...overrides,
  };
}

test('equal-importance mirrors select the same canonical survivor regardless of input order', () => {
  const topdeck = record();
  const mirror = record({
    sourceId: 'mirror-source',
    metadata: {
      sourceRecordId: 'mirror:event-1:p1',
      featureExtractorId: 'deck-structural-v15.1+deck-structural-minmax-v15.1',
    },
  });

  const forward = deduplicateLearningCorpusV15([topdeck, mirror]);
  const reverse = deduplicateLearningCorpusV15([mirror, topdeck]);

  assert.equal(forward.records.length, 1);
  assert.equal(reverse.records.length, 1);
  assert.deepEqual(forward.records, reverse.records);
  assert.deepEqual(forward.duplicateRecords, reverse.duplicateRecords);
});

test('temporal split membership is reproducible when equal timestamps and input order are reversed', () => {
  const records = [
    record({ outcomeId: 'outcome-b', independentGroup: 'group-b', leakageGroup: 'group-b', label: 0 }),
    record({ outcomeId: 'outcome-a', independentGroup: 'group-a', leakageGroup: 'group-a', label: 1 }),
    record({ outcomeId: 'outcome-d', independentGroup: 'group-d', leakageGroup: 'group-d', label: 0 }),
    record({ outcomeId: 'outcome-c', independentGroup: 'group-c', leakageGroup: 'group-c', label: 1 }),
    record({ outcomeId: 'outcome-f', independentGroup: 'group-f', leakageGroup: 'group-f', label: 0 }),
    record({ outcomeId: 'outcome-e', independentGroup: 'group-e', leakageGroup: 'group-e', label: 1 }),
  ];

  const forward = temporalSplitLearningCorpusV15(records, 0.34);
  const reverse = temporalSplitLearningCorpusV15([...records].reverse(), 0.34);

  assert.deepEqual(
    forward.training.map((entry) => entry.outcomeId),
    reverse.training.map((entry) => entry.outcomeId),
  );
  assert.deepEqual(
    forward.holdout.map((entry) => entry.outcomeId),
    reverse.holdout.map((entry) => entry.outcomeId),
  );
  assert.equal(forward.cutoff, reverse.cutoff);
});
