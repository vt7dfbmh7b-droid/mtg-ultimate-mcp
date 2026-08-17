import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLearningCorpusManifestV15,
  LEARNING_CORPUS_MANIFEST_SCHEMA_V15,
} from './learning-corpus-manifest-v15.js';
import {
  fingerprintExactDeckV15,
  type LearningOutcomeRecordV15,
} from './learning-corpus-v15.js';

const deckFingerprint = fingerprintExactDeckV15(`// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
99 Forest (M21) 272`);

function record(
  outcomeId: string,
  observedAt: string,
  label: 0 | 1,
  overrides: Partial<LearningOutcomeRecordV15> = {},
): LearningOutcomeRecordV15 {
  return {
    outcomeId,
    observedAt,
    sourceId: 'topdeck',
    evidenceClass: 'observed-results',
    independentGroup: `event:${outcomeId}`,
    leakageGroup: `event:${outcomeId}`,
    deckFingerprint,
    commanderNames: ['Kinnan, Bonder Prodigy'],
    features: { manaEfficiency: 0.2, interactionEfficiency: 0.4 },
    label,
    learningTarget: 'event-top-cut',
    metadata: {
      featureExtractorId: 'deck-structural-v15.1+deck-structural-minmax-v15.1',
      featureNormalizerFitFingerprint: 'a'.repeat(64),
      sourceUrl: `https://topdeck.gg/event/${outcomeId}`,
      providerPlayerId: `player-${outcomeId}`,
    },
    ...overrides,
  };
}

test('manifest is content-addressed and identical regardless of input order', () => {
  const records = [
    record('event-b', '2026-02-01T00:00:00.000Z', 0),
    record('event-a', '2026-01-01T00:00:00.000Z', 1),
    record('event-c', '2026-03-01T00:00:00.000Z', 1),
  ];
  const refreshAudit = {
    providerCandidates: 5,
    providerRejected: 1,
    ingestionAccepted: 3,
    ingestionRejected: 1,
  };

  const forward = buildLearningCorpusManifestV15(records, { refreshAudit });
  const reverse = buildLearningCorpusManifestV15([...records].reverse(), { refreshAudit });

  assert.equal(forward.schemaVersion, LEARNING_CORPUS_MANIFEST_SCHEMA_V15);
  assert.deepEqual(forward, reverse);
  assert.match(forward.corpusContentHash, /^[a-f0-9]{64}$/);
  assert.match(forward.manifestHash, /^[a-f0-9]{64}$/);
  assert.equal(forward.recordDigests.length, 3);
  assert.deepEqual(forward.temporalRange, {
    earliestObservedAt: '2026-01-01T00:00:00.000Z',
    latestObservedAt: '2026-03-01T00:00:00.000Z',
  });
});

test('exact duplicate leaves corpus content hash unchanged but changes audit-bearing manifest hash', () => {
  const original = record('event-a', '2026-01-01T00:00:00.000Z', 1);
  const base = buildLearningCorpusManifestV15([original]);
  const duplicated = buildLearningCorpusManifestV15([original, { ...original }]);

  assert.equal(base.corpusContentHash, duplicated.corpusContentHash);
  assert.notEqual(base.manifestHash, duplicated.manifestHash);
  assert.equal(duplicated.audit.uniqueRecords, 1);
  assert.equal(duplicated.audit.duplicateRecords, 1);
});

test('changing a usable label or predictor changes the corpus content hash', () => {
  const positive = buildLearningCorpusManifestV15([
    record('event-a', '2026-01-01T00:00:00.000Z', 1),
  ]);
  const negative = buildLearningCorpusManifestV15([
    record('event-a', '2026-01-01T00:00:00.000Z', 0),
  ]);
  const changedFeature = buildLearningCorpusManifestV15([
    record('event-a', '2026-01-01T00:00:00.000Z', 1, {
      features: { manaEfficiency: -0.7, interactionEfficiency: 0.4 },
    }),
  ]);

  assert.notEqual(positive.corpusContentHash, negative.corpusContentHash);
  assert.notEqual(positive.corpusContentHash, changedFeature.corpusContentHash);
});

test('manifest reports source/target/extractor coverage without embedding raw provider records or decklists', () => {
  const manifest = buildLearningCorpusManifestV15([
    record('event-a', '2026-01-01T00:00:00.000Z', 1),
    record('event-b', '2026-02-01T00:00:00.000Z', 0, {
      sourceId: 'independent-results',
      evidenceClass: 'recorded-games',
      learningTarget: 'match-win',
      metadata: {
        featureExtractorId: 'deck-structural-v15.1+deck-structural-minmax-v15.1',
        featureNormalizerFitFingerprint: 'b'.repeat(64),
        providerPlayerId: 'sensitive-provider-id',
      },
    }),
  ]);

  assert.deepEqual(manifest.sourceCounts, [
    { sourceId: 'independent-results', count: 1 },
    { sourceId: 'topdeck', count: 1 },
  ]);
  assert.deepEqual(manifest.learningTargetCounts, [
    { learningTarget: 'event-top-cut', count: 1 },
    { learningTarget: 'match-win', count: 1 },
  ]);
  assert.equal(manifest.featureExtractorCounts[0]?.count, 2);
  assert.deepEqual(manifest.featureNormalizerFitFingerprints, ['a'.repeat(64), 'b'.repeat(64)]);

  const serialized = JSON.stringify(manifest);
  assert.doesNotMatch(serialized, /decklist/i);
  assert.doesNotMatch(serialized, /sensitive-provider-id/);
  assert.doesNotMatch(serialized, /providerPlayerId/);
});

test('conflicting and malformed inputs are excluded from record digests but remain visible in audit counts', () => {
  const valid = record('event-good', '2026-01-01T00:00:00.000Z', 1);
  const conflictA = record('event-conflict', '2026-01-02T00:00:00.000Z', 1);
  const conflictB = record('event-conflict', '2026-01-02T00:00:00.000Z', 0);
  const malformed = record('event-bad', 'not-a-date', 1);

  const manifest = buildLearningCorpusManifestV15([valid, conflictA, conflictB, malformed]);
  assert.equal(manifest.audit.uniqueRecords, 1);
  assert.equal(manifest.audit.conflictingRecords, 2);
  assert.equal(manifest.audit.malformedRecords, 1);
  assert.equal(manifest.recordDigests.length, 1);
});

test('refresh audit rejects negative or non-integer counts', () => {
  const records = [record('event-a', '2026-01-01T00:00:00.000Z', 1)];
  assert.throws(
    () => buildLearningCorpusManifestV15(records, {
      refreshAudit: {
        providerCandidates: -1,
        providerRejected: 0,
        ingestionAccepted: 1,
        ingestionRejected: 0,
      },
    }),
    /refresh.*non-negative integer|non-negative integer.*refresh/i,
  );
});
