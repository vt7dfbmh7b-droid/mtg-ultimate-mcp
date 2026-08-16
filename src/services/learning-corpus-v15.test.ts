import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditLearningCorpusV15,
  deduplicateLearningCorpusV15,
  fingerprintExactDeckV15,
  temporalSplitLearningCorpusV15,
  type LearningOutcomeRecordV15,
} from './learning-corpus-v15.js';

const deckA = `// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
1 Sol Ring (CMM) 396
98 Forest (M21) 272`;

const deckAReordered = `// MAIN
98 Forest (M21) 272
1 Sol Ring (CMM) 396

// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192`;

const deckDifferentPrinting = `// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
1 Sol Ring (CMM) 397
98 Forest (M21) 272`;

function record(overrides: Partial<LearningOutcomeRecordV15> = {}): LearningOutcomeRecordV15 {
  return {
    outcomeId: 'event-1-player-1',
    observedAt: '2026-01-01T00:00:00.000Z',
    sourceId: 'topdeck',
    evidenceClass: 'observed-results',
    independentGroup: 'topdeck-event-1',
    leakageGroup: 'event-1',
    deckFingerprint: fingerprintExactDeckV15(deckA),
    commanderNames: ['Kinnan, Bonder Prodigy'],
    features: { tournamentSupport: 0.8, comboVerification: 1 },
    label: 1,
    ...overrides,
  };
}

test('exact deck fingerprint is order-independent but printing-sensitive', () => {
  assert.equal(fingerprintExactDeckV15(deckA), fingerprintExactDeckV15(deckAReordered));
  assert.notEqual(fingerprintExactDeckV15(deckA), fingerprintExactDeckV15(deckDifferentPrinting));
});

test('learning corpus deduplicates the same observed outcome but not the same deck in a different event', () => {
  const original = record();
  const mirror = record({ sourceId: 'mirror', importance: 0.5 });
  const differentEvent = record({
    outcomeId: 'event-2-player-1',
    observedAt: '2026-01-08T00:00:00.000Z',
    independentGroup: 'topdeck-event-2',
    leakageGroup: 'event-2',
  });
  const deduped = deduplicateLearningCorpusV15([original, mirror, differentEvent]);

  assert.equal(deduped.records.length, 2);
  assert.equal(deduped.duplicateRecords.length, 1);
  assert.ok(deduped.records.some((entry) => entry.outcomeId === 'event-2-player-1'));
});

test('temporal split keeps a leakage group entirely on one side of the holdout boundary', () => {
  const records = [
    record({ outcomeId: 'a', observedAt: '2026-01-01T00:00:00Z', leakageGroup: 'series-a', independentGroup: 'group-a' }),
    record({ outcomeId: 'b', observedAt: '2026-01-10T00:00:00Z', leakageGroup: 'series-b', independentGroup: 'group-b', label: 0 }),
    record({ outcomeId: 'c', observedAt: '2026-01-20T00:00:00Z', leakageGroup: 'series-a', independentGroup: 'group-a' }),
    record({ outcomeId: 'd', observedAt: '2026-01-30T00:00:00Z', leakageGroup: 'series-c', independentGroup: 'group-c', label: 0 }),
    record({ outcomeId: 'e', observedAt: '2026-02-10T00:00:00Z', leakageGroup: 'series-d', independentGroup: 'group-d' }),
  ];
  const split = temporalSplitLearningCorpusV15(records, 0.2);
  const trainingGroups = new Set(split.training.map((entry) => entry.leakageGroup));
  const holdoutGroups = new Set(split.holdout.map((entry) => entry.leakageGroup));

  assert.equal(split.leakageChecksPassed, true);
  for (const group of trainingGroups) assert.equal(holdoutGroups.has(group), false);
  assert.ok(split.holdout.some((entry) => entry.leakageGroup === 'series-a'), 'series-a must move wholly to holdout because it crosses the temporal boundary');
  assert.equal(split.training.some((entry) => entry.leakageGroup === 'series-a'), false);
});

test('learning corpus audit reports duplicate, balance, diversity and temporal coverage signals', () => {
  const records = [
    record({ outcomeId: 'a', observedAt: '2026-01-01T00:00:00Z', independentGroup: 'group-a', leakageGroup: 'event-a', label: 1 }),
    record({ outcomeId: 'b', observedAt: '2026-02-01T00:00:00Z', independentGroup: 'group-b', leakageGroup: 'event-b', label: 0, evidenceClass: 'recorded-games', sourceId: 'playgroup' }),
    record({ outcomeId: 'c', observedAt: '2026-03-01T00:00:00Z', independentGroup: 'group-c', leakageGroup: 'event-c', label: 1, evidenceClass: 'community', sourceId: 'moxfield' }),
    record({ outcomeId: 'a', observedAt: '2026-01-01T00:00:00Z', independentGroup: 'group-a', leakageGroup: 'event-a', label: 1 }),
  ];
  const audit = auditLearningCorpusV15(records);

  assert.equal(audit.inputRecords, 4);
  assert.equal(audit.uniqueRecords, 3);
  assert.equal(audit.duplicateRecords, 1);
  assert.equal(audit.positiveExamples, 2);
  assert.equal(audit.negativeExamples, 1);
  assert.equal(audit.independentEvidenceGroups, 3);
  assert.equal(audit.evidenceClassCount, 3);
  assert.ok(audit.temporalCoverageDays >= 59);
});
