import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HISTORICAL_LEARNING_RECORD_SCHEMA_V15,
  type HistoricalLearningRecordV15,
} from './historical-learning-corpus-v15.js';
import { evaluateNeuralOnHistoricalCorpusAsOfV15 } from './historical-neural-temporal-eval-v15.js';
import type { LearningOutcomeRecordV15 } from './learning-corpus-v15.js';
import {
  normalizeTemporalEvidenceProvenanceV15,
  type TemporalEvidenceProvenanceV15,
} from './temporal-provenance-v15.js';

const CARD_HASH = '1'.repeat(64);
const OUTCOME_HASH = '2'.repeat(64);
const DECK_HASH = '3'.repeat(64);
const SNAPSHOT_HASH = '4'.repeat(64);

function recordAt(index: number, overrides: { featureShift?: number; labelFlip?: boolean } = {}): HistoricalLearningRecordV15 {
  const outcomeMs = Date.UTC(2025, 0, 1) + index * 86_400_000;
  const outcomeAt = new Date(outcomeMs).toISOString();
  const predictorAt = new Date(outcomeMs - 86_400_000).toISOString();
  const sourceObservedAt = new Date(outcomeMs + 3_600_000).toISOString();
  const sourceRetrievedAt = new Date(outcomeMs + 3_660_000).toISOString();
  const patterns = [
    { a: -1, b: -1, label: 0 as const },
    { a: -1, b: 1, label: 1 as const },
    { a: 1, b: -1, label: 1 as const },
    { a: 1, b: 1, label: 0 as const },
  ];
  const pattern = patterns[index % patterns.length];
  if (!pattern) throw new Error('missing XOR pattern');
  const shift = overrides.featureShift ?? 0;
  const label = overrides.labelFlip ? (pattern.label === 1 ? 0 : 1) : pattern.label;

  const record: LearningOutcomeRecordV15 = {
    outcomeId: `historical-${index}`,
    observedAt: outcomeAt,
    sourceId: 'topdeck',
    evidenceClass: 'observed-results',
    independentGroup: `event-${index}`,
    leakageGroup: `event-${index}`,
    deckFingerprint: DECK_HASH,
    commanderNames: ['Kinnan, Bonder Prodigy'],
    features: {
      tournamentSupport: pattern.a + shift,
      comboVerification: pattern.b - shift,
    },
    label,
    learningTarget: 'event-top-cut',
    metadata: {
      sourceObservedAt,
      featureExtractorId: 'historical-fixture-raw-v1',
    },
  };
  const outcomeEvidenceProvenance: TemporalEvidenceProvenanceV15 = {
    mode: 'contemporaneous-snapshot',
    domain: 'tournament-outcome',
    sourceId: 'topdeck',
    sourceUri: `https://topdeck.gg/event/historical-${index}`,
    sourceRecordId: `standing-${index}`,
    sourceVersion: 'fixture-topdeck-v1',
    sourceContentHash: OUTCOME_HASH,
    sourceObservedAt,
    sourceRetrievedAt,
    validFrom: outcomeAt,
    truthStatus: 'verified-present',
  };
  const outcomeEvidence = normalizeTemporalEvidenceProvenanceV15(outcomeEvidenceProvenance);

  return {
    schemaVersion: HISTORICAL_LEARNING_RECORD_SCHEMA_V15,
    record,
    predictor: {
      availableAt: predictorAt,
      cardDataObservedAt: new Date(outcomeMs - 2 * 86_400_000).toISOString(),
      cardDataSnapshotFingerprint: SNAPSHOT_HASH,
      historicalCardDataMethod: 'contemporaneous-capture',
      historicalCardDataSourceId: 'fixture-card-archive',
      historicalCardDataSourceContentHash: CARD_HASH,
      historicalCommanderRuleset: 'Commander fixture rules',
      historicalCommanderLegalityStatus: 'legal',
    },
    outcomeEvidenceProvenance,
    outcomeEvidence,
    eligibleForHistoricalTraining: true,
    safeguards: {
      predictorProvenanceVerified: true,
      predictorAvailableBeforeOutcome: true,
      outcomeEvidenceTargetOnly: true,
      outcomeSourceAvailableNoEarlierThanOutcome: true,
      outcomeEvidenceReplayable: true,
      outcomeEvidenceModeAccepted: true,
    },
    reasons: [],
  };
}

function corpus(size = 60): HistoricalLearningRecordV15[] {
  return Array.from({ length: size }, (_, index) => recordAt(index));
}

test('historical neural evaluation excludes outcomes whose evidence was not available by the requested as-of time', () => {
  const records = corpus();
  const cutoff = new Date(Date.UTC(2025, 0, 1) + 49 * 86_400_000 + 12 * 3_600_000).toISOString();
  const result = evaluateNeuralOnHistoricalCorpusAsOfV15(records, cutoff, {
    epochs: 120,
    seed: 42,
    holdoutFraction: 0.2,
  });

  assert.equal(result.inputRecords, 60);
  assert.equal(result.usableRecordsAsOf, 50);
  assert.equal(result.futureOrOutOfRangeRecordsAsOf, 10);
  assert.equal(result.selectedOutcomeIds.includes('historical-49'), true);
  assert.equal(result.selectedOutcomeIds.includes('historical-50'), false);
  assert.equal(result.excludedOutcomeIds.futureOrOutOfRange.includes('historical-50'), true);
  assert.equal(result.evaluation.corpusAudit.uniqueRecords, 50);
  assert.equal(result.provenanceGate.onlyEvidenceAvailableAsOfUsed, true);
  assert.equal(result.provenanceGate.retrospectiveReconstructionsUsedForTraining, false);
  assert.equal(result.provenanceGate.presentDayCurrentTruthUsedForHistoricalTraining, false);
  assert.ok(result.warnings.some((warning) => /not independently available/i.test(warning)));
});

test('changing only future records cannot change an earlier as-of model evaluation', () => {
  const ordinary = corpus();
  const changedFuture = ordinary.map((record, index) => index < 50
    ? record
    : recordAt(index, { featureShift: 50, labelFlip: true }));
  const cutoff = new Date(Date.UTC(2025, 0, 1) + 49 * 86_400_000 + 12 * 3_600_000).toISOString();
  const options = { epochs: 140, seed: 17, holdoutFraction: 0.2 };

  const left = evaluateNeuralOnHistoricalCorpusAsOfV15(ordinary, cutoff, options);
  const right = evaluateNeuralOnHistoricalCorpusAsOfV15(changedFuture, cutoff, options);

  assert.deepEqual(left.selectedOutcomeIds, right.selectedOutcomeIds);
  assert.deepEqual(left.evaluation.corpusAudit, right.evaluation.corpusAudit);
  assert.deepEqual(left.evaluation.split, right.evaluation.split);
  assert.deepEqual(left.evaluation.neuralTemporalMetrics, right.evaluation.neuralTemporalMetrics);
  assert.deepEqual(left.evaluation.transparentTemporalMetrics, right.evaluation.transparentTemporalMetrics);
});

test('runtime validation rejects a forged eligible flag with inconsistent raw and normalized provenance', () => {
  const valid = recordAt(0);
  const forged: HistoricalLearningRecordV15 = {
    ...valid,
    outcomeEvidenceProvenance: {
      ...valid.outcomeEvidenceProvenance,
      sourceContentHash: 'f'.repeat(64),
    },
  };

  assert.throws(
    () => evaluateNeuralOnHistoricalCorpusAsOfV15([forged], '2025-02-01T00:00:00Z'),
    /inconsistent raw and normalized outcome provenance/i,
  );
});

test('a plain generic learning row cannot be relabelled historical through a type cast', () => {
  const generic = recordAt(0).record as unknown as HistoricalLearningRecordV15;
  assert.throws(
    () => evaluateNeuralOnHistoricalCorpusAsOfV15([generic], '2025-02-01T00:00:00Z'),
    /schema|historical learning record|predictor provenance/i,
  );
});

test('historical model evaluation fails closed when no verified outcome source was available by as-of', () => {
  const records = corpus(12);
  assert.throws(
    () => evaluateNeuralOnHistoricalCorpusAsOfV15(records, '2024-12-01T00:00:00Z'),
    /No verified historical outcome evidence.*available|blocked.*newer evidence/i,
  );
});
