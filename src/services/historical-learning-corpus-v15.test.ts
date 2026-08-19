import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { extractProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import {
  assertHistoricalLearningRecordEligibleV15,
  buildHistoricalLearningCorpusManifestV15,
  createHistoricalLearningRecordV15,
  selectHistoricalLearningEvidenceAsOfV15,
} from './historical-learning-corpus-v15.js';
import { fingerprintExactDeckV15, type LearningOutcomeRecordV15 } from './learning-corpus-v15.js';
import type { TemporalEvidenceProvenanceV15 } from './temporal-provenance-v15.js';

const CARD_HASH = 'c'.repeat(64);
const OUTCOME_HASH = 'd'.repeat(64);

function card(name: string, typeLine: string, cmc: number, oracleText = ''): ScryfallCard {
  return {
    id: `id-${name}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    released_at: '2024-01-01',
    mana_cost: cmc > 0 ? `{${cmc}}` : '',
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    rarity: 'common',
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
  };
}

function fixture(prefix: string) {
  const commander = `${prefix} Commander`;
  const land = `${prefix} Land`;
  const threat = `${prefix} Threat`;
  const decklist = [
    '// COMMANDER',
    `1 ${commander}`,
    '',
    '// MAIN',
    `34 ${land}`,
    `65 ${threat}`,
  ].join('\n');
  const cards = [
    card(commander, 'Legendary Creature — Test', 2),
    card(land, 'Basic Land — Wastes', 0, '{T}: Add {C}.'),
    card(threat, 'Creature — Test', 3, `A deck can have any number of cards named ${threat}.`),
  ];
  return { commander, decklist, cards };
}

function historicalSnapshot(prefix: string, availableAt: string) {
  const value = fixture(prefix);
  return {
    ...value,
    snapshot: extractProvenancedDeckFeatureSnapshotV15(value.decklist, value.cards, {
      availableAt,
      provenance: {
        method: 'archived-versioned-snapshot',
        sourceId: 'card-archive',
        sourceUri: `https://example.test/card-archive/${encodeURIComponent(prefix)}.json`,
        sourceContentHash: CARD_HASH,
        archiveVersion: 'cards-2025-12-31',
        snapshotEffectiveAt: '2025-12-31T00:00:00.000Z',
        archivePublishedAt: '2025-12-31T01:00:00.000Z',
        retrievedAt: '2026-08-19T00:00:00.000Z',
      },
    }),
  };
}

function learningRecord(prefix: string, outcomeAt: string): LearningOutcomeRecordV15 {
  const value = fixture(prefix);
  return {
    outcomeId: `outcome:${prefix}`,
    observedAt: outcomeAt,
    sourceId: 'topdeck',
    evidenceClass: 'observed-results',
    independentGroup: `event:${prefix}`,
    leakageGroup: `event:${prefix}`,
    deckFingerprint: fingerprintExactDeckV15(value.decklist),
    commanderNames: [value.commander],
    features: { manaEfficiency: 0.2, interactionEfficiency: 0.3 },
    label: 1,
    learningTarget: 'event-top-cut',
    metadata: {
      sourceObservedAt: new Date(Date.parse(outcomeAt) + 86_400_000).toISOString(),
      featureExtractorId: 'fixture-v1',
    },
  };
}

function outcomeProvenance(
  prefix: string,
  outcomeAt: string,
  overrides: Partial<Extract<TemporalEvidenceProvenanceV15, { mode: 'contemporaneous-snapshot' }>> = {},
): TemporalEvidenceProvenanceV15 {
  const observedAt = new Date(Date.parse(outcomeAt) + 86_400_000).toISOString();
  return {
    mode: 'contemporaneous-snapshot',
    domain: 'tournament-outcome',
    sourceId: 'topdeck',
    sourceUri: `https://topdeck.gg/event/${prefix}`,
    sourceRecordId: `topdeck:${prefix}`,
    sourceVersion: 'topdeck-v2-candidate-v15.1',
    sourceContentHash: OUTCOME_HASH,
    sourceObservedAt: observedAt,
    sourceRetrievedAt: new Date(Date.parse(observedAt) + 60_000).toISOString(),
    validFrom: outcomeAt,
    truthStatus: 'verified-present',
    ...overrides,
  };
}

test('historical learning record keeps predictor provenance separate from later target-only outcome evidence', () => {
  const outcomeAt = '2026-01-10T00:00:00.000Z';
  const source = historicalSnapshot('safe', '2026-01-09T00:00:00.000Z');
  const historical = createHistoricalLearningRecordV15(
    learningRecord('safe', outcomeAt),
    source.snapshot,
    outcomeProvenance('safe', outcomeAt),
  );

  assert.equal(historical.eligibleForHistoricalTraining, true);
  assert.equal(historical.safeguards.predictorProvenanceVerified, true);
  assert.equal(historical.safeguards.predictorAvailableBeforeOutcome, true);
  assert.equal(historical.safeguards.outcomeEvidenceTargetOnly, true);
  assert.equal(historical.safeguards.outcomeSourceAvailableNoEarlierThanOutcome, true);
  assert.equal(historical.safeguards.outcomeEvidenceReplayable, true);
  assert.equal(historical.predictor.historicalCardDataMethod, 'archived-versioned-snapshot');
  assert.equal(historical.outcomeEvidence.mode, 'contemporaneous-snapshot');
  assertHistoricalLearningRecordEligibleV15(historical);
});

test('a predictor snapshot created after the outcome fails historical training eligibility', () => {
  const outcomeAt = '2026-01-10T00:00:00.000Z';
  const source = historicalSnapshot('late-predictor', '2026-01-11T00:00:00.000Z');
  const historical = createHistoricalLearningRecordV15(
    learningRecord('late-predictor', outcomeAt),
    source.snapshot,
    outcomeProvenance('late-predictor', outcomeAt),
  );

  assert.equal(historical.eligibleForHistoricalTraining, false);
  assert.equal(historical.safeguards.predictorAvailableBeforeOutcome, false);
  assert.match(historical.reasons.join(' '), /predictor snapshot.*after.*outcome|leak/i);
  assert.throws(() => assertHistoricalLearningRecordEligibleV15(historical), /not eligible.*predictor/i);
});

test('outcome evidence that claims availability before the event fails closed', () => {
  const outcomeAt = '2026-01-10T00:00:00.000Z';
  const source = historicalSnapshot('impossible-outcome', '2026-01-09T00:00:00.000Z');
  const record = learningRecord('impossible-outcome', outcomeAt);
  record.metadata = { ...record.metadata, sourceObservedAt: '2026-01-09T00:00:00.000Z' };
  const historical = createHistoricalLearningRecordV15(
    record,
    source.snapshot,
    outcomeProvenance('impossible-outcome', outcomeAt, {
      sourceObservedAt: '2026-01-09T00:00:00.000Z',
      sourceRetrievedAt: '2026-01-09T00:05:00.000Z',
    }),
  );

  assert.equal(historical.eligibleForHistoricalTraining, false);
  assert.equal(historical.safeguards.outcomeSourceAvailableNoEarlierThanOutcome, false);
  assert.match(historical.reasons.join(' '), /before.*outcome|temporal ordering/i);
});

test('retrospective or current-truth outcome evidence cannot become trusted historical training labels', () => {
  const outcomeAt = '2026-01-10T00:00:00.000Z';
  const source = historicalSnapshot('reconstructed', '2026-01-09T00:00:00.000Z');
  const record = learningRecord('reconstructed', outcomeAt);
  record.metadata = { ...record.metadata, sourceObservedAt: '2026-01-11T00:00:00.000Z' };
  const reconstruction: TemporalEvidenceProvenanceV15 = {
    mode: 'retrospective-reconstruction',
    domain: 'tournament-outcome',
    sourceId: 'topdeck',
    sourceUri: 'https://topdeck.gg/event/reconstructed',
    sourceVersion: 'reconstruction-v1',
    sourceContentHash: OUTCOME_HASH,
    sourceObservedAt: '2026-01-11T00:00:00.000Z',
    sourceRetrievedAt: '2026-08-19T00:00:00.000Z',
    reconstructionBasis: 'historical-sources',
    validFrom: outcomeAt,
    truthStatus: 'verified-present',
  };

  const historical = createHistoricalLearningRecordV15(record, source.snapshot, reconstruction);
  assert.equal(historical.eligibleForHistoricalTraining, false);
  assert.equal(historical.safeguards.outcomeEvidenceModeAccepted, false);
  assert.match(historical.reasons.join(' '), /contemporaneous|archived|retrospective/i);
});

test('changing only source version/content provenance changes the historical corpus content hash', () => {
  const outcomeAt = '2026-01-10T00:00:00.000Z';
  const source = historicalSnapshot('hash', '2026-01-09T00:00:00.000Z');
  const record = learningRecord('hash', outcomeAt);
  const first = createHistoricalLearningRecordV15(record, source.snapshot, outcomeProvenance('hash', outcomeAt));
  const second = createHistoricalLearningRecordV15(record, source.snapshot, outcomeProvenance('hash', outcomeAt, {
    sourceVersion: 'topdeck-v2-candidate-v15.2',
    sourceContentHash: 'e'.repeat(64),
  }));

  const firstManifest = buildHistoricalLearningCorpusManifestV15([first]);
  const secondManifest = buildHistoricalLearningCorpusManifestV15([second]);
  assert.notEqual(firstManifest.corpusContentHash, secondManifest.corpusContentHash);
  assert.notEqual(firstManifest.manifestHash, secondManifest.manifestHash);
  assert.deepEqual(firstManifest.outcomeEvidenceSourceVersions, ['topdeck-v2-candidate-v15.1']);
  assert.equal(firstManifest.replayableRecords, 1);
});

test('later tournament outcomes present in today’s corpus are excluded from an earlier as-of evidence query', () => {
  const januaryOutcome = '2026-01-05T00:00:00.000Z';
  const marchOutcome = '2026-03-05T00:00:00.000Z';
  const january = historicalSnapshot('january', '2026-01-04T00:00:00.000Z');
  const march = historicalSnapshot('march', '2026-03-04T00:00:00.000Z');
  const janRecord = createHistoricalLearningRecordV15(
    learningRecord('january', januaryOutcome),
    january.snapshot,
    outcomeProvenance('january', januaryOutcome),
  );
  const marchRecord = createHistoricalLearningRecordV15(
    learningRecord('march', marchOutcome),
    march.snapshot,
    outcomeProvenance('march', marchOutcome),
  );

  const selected = selectHistoricalLearningEvidenceAsOfV15(
    [janRecord, marchRecord],
    '2026-02-01T00:00:00.000Z',
  );
  assert.deepEqual(selected.usable.map((entry) => entry.record.outcomeId), ['outcome:january']);
  assert.deepEqual(selected.futureOrOutOfRange.map((entry) => entry.record.outcomeId), ['outcome:march']);
  assert.equal(selected.unavailable.length, 0);
  assert.equal(selected.advisoryOnly.length, 0);
});

test('manifest exposes temporal/source-version coverage without embedding raw decklists', () => {
  const aOutcome = '2026-01-10T00:00:00.000Z';
  const bOutcome = '2026-02-10T00:00:00.000Z';
  const a = historicalSnapshot('manifest-a', '2026-01-09T00:00:00.000Z');
  const b = historicalSnapshot('manifest-b', '2026-02-09T00:00:00.000Z');
  const records = [
    createHistoricalLearningRecordV15(learningRecord('manifest-a', aOutcome), a.snapshot, outcomeProvenance('manifest-a', aOutcome)),
    createHistoricalLearningRecordV15(learningRecord('manifest-b', bOutcome), b.snapshot, outcomeProvenance('manifest-b', bOutcome)),
  ];
  const manifest = buildHistoricalLearningCorpusManifestV15(records);

  assert.equal(manifest.recordCount, 2);
  assert.equal(manifest.eligibleRecordCount, 2);
  assert.equal(manifest.ineligibleRecordCount, 0);
  assert.equal(manifest.replayableRecords, 2);
  assert.equal(manifest.reconstructionRecords, 0);
  assert.deepEqual(manifest.outcomeEvidenceModeCounts, [{ mode: 'contemporaneous-snapshot', count: 2 }]);
  assert.match(manifest.corpusContentHash, /^[a-f0-9]{64}$/);
  assert.match(manifest.manifestHash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(manifest), /\/\/ COMMANDER|manifest-a Commander/i);
});
