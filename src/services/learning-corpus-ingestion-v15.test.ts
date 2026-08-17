import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditLearningCorpusV15,
  deduplicateLearningCorpusV15,
  fingerprintExactDeckV15,
  temporalSplitLearningCorpusV15,
} from './learning-corpus-v15.js';
import {
  ingestObservedLearningRecordsV15,
  type ObservedLearningSourceRecordV15,
} from './learning-corpus-ingestion-v15.js';

const kinnanDeck = `// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
99 Forest (M21) 272`;

const kinnanDeck99 = `// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
98 Forest (M21) 272`;

function eventRecord(overrides: Partial<ObservedLearningSourceRecordV15> = {}): ObservedLearningSourceRecordV15 {
  return {
    sourceId: 'topdeck',
    sourceRecordId: 'topdeck-event-1-player-1',
    sourceUrl: 'https://topdeck.gg/event/event-1',
    canonicalOutcomeId: 'event-1-player-1',
    independenceKey: 'event-1',
    leakageKey: 'event-1',
    outcomeOccurredAt: '2026-01-10T00:00:00.000Z',
    sourceObservedAt: '2026-01-11T00:00:00.000Z',
    decklist: kinnanDeck,
    expectedCommanderNames: ['Kinnan, Bonder Prodigy'],
    featureExtractorId: 'fixture-features-v1',
    features: { tournamentSupport: 0.8, comboVerification: 1 },
    outcome: { kind: 'event-top-cut', standing: 8, fieldSize: 64, topCutSize: 8 },
    ...overrides,
  };
}

test('event result ingestion derives provenance, exact deck fingerprint, target and label', () => {
  const result = ingestObservedLearningRecordsV15([eventRecord()]);

  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted.length, 1);
  const accepted = result.accepted[0]!;
  assert.equal(accepted.sourceId, 'topdeck');
  assert.equal(accepted.evidenceClass, 'observed-results');
  assert.equal(accepted.learningTarget, 'event-top-cut');
  assert.equal(accepted.label, 1);
  assert.equal(accepted.observedAt, '2026-01-10T00:00:00.000Z');
  assert.equal(accepted.deckFingerprint, fingerprintExactDeckV15(kinnanDeck));
  assert.deepEqual(accepted.commanderNames, ['Kinnan, Bonder Prodigy']);
  assert.equal(accepted.metadata?.sourceObservedAt, '2026-01-11T00:00:00.000Z');
  assert.equal(accepted.metadata?.featureExtractorId, 'fixture-features-v1');
  assert.equal(accepted.metadata?.standing, 8);
});

test('event top-cut label is derived from standing rather than supplied by the caller', () => {
  const result = ingestObservedLearningRecordsV15([
    eventRecord({
      sourceRecordId: 'outside-cut',
      canonicalOutcomeId: 'outside-cut',
      outcome: { kind: 'event-top-cut', standing: 9, fieldSize: 64, topCutSize: 8 },
    }),
  ]);

  assert.equal(result.accepted[0]?.label, 0);
  assert.equal(result.accepted[0]?.learningTarget, 'event-top-cut');
});

test('match outcome creates a distinct learning target and objective win label', () => {
  const result = ingestObservedLearningRecordsV15([
    eventRecord({
      sourceId: 'playgroup',
      sourceRecordId: 'game-44-seat-2',
      sourceUrl: 'https://playgroup.gg/game/44',
      canonicalOutcomeId: 'game-44-seat-2',
      independenceKey: 'game-44',
      leakageKey: 'game-44',
      outcome: { kind: 'match-win', won: false },
    }),
  ]);

  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted[0]?.learningTarget, 'match-win');
  assert.equal(result.accepted[0]?.label, 0);
  assert.equal(result.accepted[0]?.evidenceClass, 'observed-results');
});

test('mirrors of the same underlying result do not multiply independent evidence', () => {
  const topdeck = eventRecord();
  const edhTop16 = eventRecord({
    sourceId: 'edhtop16',
    sourceRecordId: 'edhtop16-event-1-player-1',
    sourceUrl: 'https://edhtop16.com/tournament/event-1',
  });
  const ingested = ingestObservedLearningRecordsV15([topdeck, edhTop16]);
  assert.equal(ingested.accepted.length, 2);

  const deduped = deduplicateLearningCorpusV15(ingested.accepted);
  assert.equal(deduped.records.length, 1);
  assert.equal(deduped.duplicateRecords.length, 1);
  assert.equal(deduped.conflictingRecords.length, 0);

  const audit = auditLearningCorpusV15(ingested.accepted);
  assert.equal(audit.uniqueRecords, 1);
  assert.equal(audit.independentEvidenceGroups, 1);
  assert.equal(audit.learningTargetCount, 1);
  assert.deepEqual(audit.learningTargets, ['event-top-cut']);
});

test('different learning targets with the same external identity are not silently treated as the same label', () => {
  const ingested = ingestObservedLearningRecordsV15([
    eventRecord(),
    eventRecord({
      sourceRecordId: 'topdeck-event-1-player-1-match',
      sourceUrl: 'https://topdeck.gg/event/event-1/match',
      outcome: { kind: 'match-win', won: true },
    }),
  ]);
  const deduped = deduplicateLearningCorpusV15(ingested.accepted);
  const audit = auditLearningCorpusV15(ingested.accepted);

  assert.equal(deduped.records.length, 2);
  assert.equal(audit.learningTargetCount, 2);
  assert.deepEqual(audit.learningTargets, ['event-top-cut', 'match-win']);
});

test('community decklist sources are rejected as performance-outcome evidence', () => {
  const result = ingestObservedLearningRecordsV15([
    eventRecord({
      sourceId: 'edhrec',
      sourceRecordId: 'edhrec-list-1',
      sourceUrl: 'https://edhrec.com/deckpreview/example',
    }),
  ]);

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0]?.code, 'wrong-evidence-class');
});

test('registered source identity is checked against the supplied provenance URL', () => {
  const result = ingestObservedLearningRecordsV15([
    eventRecord({ sourceUrl: 'https://example.com/fake-topdeck-result' }),
  ]);

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0]?.code, 'source-url-mismatch');
});

test('partial decklists are quarantined instead of receiving a fabricated exact fingerprint', () => {
  const result = ingestObservedLearningRecordsV15([
    eventRecord({ decklist: kinnanDeck99 }),
  ]);

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0]?.code, 'invalid-decklist');
  assert.match(result.rejected[0]?.reason ?? '', /exactly 100 cards/);
});

test('commander identity mismatch between source metadata and decklist is quarantined', () => {
  const result = ingestObservedLearningRecordsV15([
    eventRecord({ expectedCommanderNames: ['Najeela, the Blade-Blossom'] }),
  ]);

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0]?.code, 'invalid-commander-identity');
});

test('source observation cannot predate the claimed outcome', () => {
  const result = ingestObservedLearningRecordsV15([
    eventRecord({ sourceObservedAt: '2026-01-09T00:00:00Z' }),
  ]);

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0]?.code, 'invalid-timestamp-order');
});

test('invalid event bounds and non-finite derived features are quarantined individually', () => {
  const result = ingestObservedLearningRecordsV15([
    eventRecord({
      sourceRecordId: 'bad-standing',
      canonicalOutcomeId: 'bad-standing',
      outcome: { kind: 'event-top-cut', standing: 65, fieldSize: 64, topCutSize: 8 },
    }),
    eventRecord({
      sourceRecordId: 'bad-feature',
      canonicalOutcomeId: 'bad-feature',
      features: { tournamentSupport: Number.NaN },
    }),
    eventRecord({
      sourceRecordId: 'good',
      canonicalOutcomeId: 'good',
    }),
  ]);

  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.equal(result.rejected.some((entry) => entry.code === 'invalid-outcome'), true);
  assert.equal(result.rejected.some((entry) => entry.code === 'invalid-features'), true);
});

test('duplicate rows from the same source are quarantined before corpus-level cross-source deduplication', () => {
  const row = eventRecord();
  const result = ingestObservedLearningRecordsV15([row, row]);

  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0]?.code, 'duplicate-source-record');
  assert.equal(result.audit.rejectionCounts['duplicate-source-record'], 1);
});

test('all participants from one event remain in one leakage group across the temporal split', () => {
  const inputs: ObservedLearningSourceRecordV15[] = [
    eventRecord({
      sourceRecordId: 'early-a', canonicalOutcomeId: 'early-a', independenceKey: 'event-early', leakageKey: 'event-early',
      outcomeOccurredAt: '2026-01-01T00:00:00Z', sourceObservedAt: '2026-01-02T00:00:00Z',
    }),
    eventRecord({
      sourceRecordId: 'mid-a', canonicalOutcomeId: 'mid-a', independenceKey: 'event-mid', leakageKey: 'event-mid',
      outcomeOccurredAt: '2026-02-01T00:00:00Z', sourceObservedAt: '2026-02-02T00:00:00Z',
      outcome: { kind: 'event-top-cut', standing: 9, fieldSize: 64, topCutSize: 8 },
    }),
    eventRecord({
      sourceRecordId: 'late-1', canonicalOutcomeId: 'late-1', independenceKey: 'event-late', leakageKey: 'event-late',
      outcomeOccurredAt: '2026-03-01T00:00:00Z', sourceObservedAt: '2026-03-02T00:00:00Z',
    }),
    eventRecord({
      sourceRecordId: 'late-2', canonicalOutcomeId: 'late-2', independenceKey: 'event-late', leakageKey: 'event-late',
      outcomeOccurredAt: '2026-03-01T00:05:00Z', sourceObservedAt: '2026-03-02T00:00:00Z',
      outcome: { kind: 'event-top-cut', standing: 20, fieldSize: 64, topCutSize: 8 },
    }),
  ];
  const ingested = ingestObservedLearningRecordsV15(inputs);
  const split = temporalSplitLearningCorpusV15(ingested.accepted, 0.25);

  assert.equal(ingested.rejected.length, 0);
  assert.equal(split.leakageChecksPassed, true);
  const lateInTraining = split.training.filter((entry) => entry.leakageGroup === 'event-late').length;
  const lateInHoldout = split.holdout.filter((entry) => entry.leakageGroup === 'event-late').length;
  assert.equal(lateInTraining === 0 || lateInHoldout === 0, true);
  assert.equal(lateInTraining + lateInHoldout, 2);
});

test('ingestion audit exposes accepted sources and targets without counting rejected rows', () => {
  const result = ingestObservedLearningRecordsV15([
    eventRecord(),
    eventRecord({
      sourceId: 'playgroup',
      sourceRecordId: 'game-1',
      sourceUrl: 'https://playgroup.gg/game/1',
      canonicalOutcomeId: 'game-1',
      independenceKey: 'game-1',
      leakageKey: 'game-1',
      outcome: { kind: 'match-win', won: true },
    }),
    eventRecord({
      sourceId: 'edhrec',
      sourceRecordId: 'rejected',
      sourceUrl: 'https://edhrec.com/deckpreview/rejected',
    }),
  ]);

  assert.equal(result.audit.inputRecords, 3);
  assert.equal(result.audit.acceptedRecords, 2);
  assert.equal(result.audit.rejectedRecords, 1);
  assert.deepEqual(result.audit.sourceCounts, { topdeck: 1, playgroup: 1 });
  assert.equal(result.audit.learningTargetCounts['event-top-cut'], 1);
  assert.equal(result.audit.learningTargetCounts['match-win'], 1);
});
