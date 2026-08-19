import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { extractProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import {
  createHistoricalLearningRecordV15,
  type HistoricalLearningRecordV15,
} from './historical-learning-corpus-v15.js';
import { fingerprintExactDeckV15, type LearningOutcomeRecordV15 } from './learning-corpus-v15.js';
import type { TemporalEvidenceProvenanceV15 } from './temporal-provenance-v15.js';
import {
  classifyRealOutcomeSourceRelationshipV15,
  realOutcomeSourceByIdV15,
  sourceCanTrainTargetV15,
} from './real-outcome-source-inventory-v15.js';
import { auditRealCorpusQualityV15 } from './real-corpus-quality-v15.js';
import {
  assertFutureHoldoutSealV15,
  assertTrainingRecordsMatchFutureHoldoutSealV15,
  createFutureHoldoutSealV15,
} from './future-holdout-seal-v15.js';
import { evaluateSealedFutureHoldoutV15 } from './sealed-future-model-eval-v15.js';

const CARD_HASH = 'c'.repeat(64);
const NORMALIZER_HASH = 'a'.repeat(64);
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

function deckFixture(prefix: string) {
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

interface HistoricalFixtureOptions {
  id: string;
  deckPrefix?: string;
  sourceId?: string;
  outcomeAt: string;
  label: 0 | 1;
  eventId?: string;
  pilotId?: string;
  leakageGroup?: string;
  fieldSize?: number;
  eventState?: string;
  archetype?: string;
  featureOne?: number;
  featureTwo?: number;
  sourceObservedAt?: string;
  normalizerFingerprint?: string;
}

function historicalFixture(options: HistoricalFixtureOptions): HistoricalLearningRecordV15 {
  const sourceId = options.sourceId ?? 'topdeck';
  const deck = deckFixture(options.deckPrefix ?? options.id);
  const outcomeMs = Date.parse(options.outcomeAt);
  const sourceObservedAt = options.sourceObservedAt ?? new Date(outcomeMs + 3_600_000).toISOString();
  const snapshot = extractProvenancedDeckFeatureSnapshotV15(deck.decklist, deck.cards, {
    availableAt: new Date(outcomeMs - 86_400_000).toISOString(),
    provenance: {
      method: 'archived-versioned-snapshot',
      sourceId: 'card-archive',
      sourceUri: `https://example.test/card-archive/${encodeURIComponent(options.id)}.json`,
      sourceContentHash: CARD_HASH,
      archiveVersion: 'cards-2025-12-30',
      snapshotEffectiveAt: '2025-12-30T00:00:00.000Z',
      archivePublishedAt: '2025-12-30T01:00:00.000Z',
      retrievedAt: '2026-08-19T00:00:00.000Z',
    },
  });
  const metadata: Record<string, string | number | boolean | null> = {
    sourceObservedAt,
    featureExtractorId: 'real-fixture-minmax-v1',
    featureNormalizerFitFingerprint: options.normalizerFingerprint ?? NORMALIZER_HASH,
    providerEventId: options.eventId ?? `event-${options.id}`,
    providerPlayerId: options.pilotId ?? `pilot-${options.id}`,
    fieldSize: options.fieldSize ?? 64,
    topCutSize: 16,
    standing: options.label === 1 ? 8 : 32,
  };
  if (options.eventState !== undefined) metadata.eventState = options.eventState;
  if (options.archetype !== undefined) metadata.archetype = options.archetype;
  const record: LearningOutcomeRecordV15 = {
    outcomeId: `outcome:${options.id}`,
    observedAt: options.outcomeAt,
    sourceId,
    evidenceClass: 'observed-results',
    independentGroup: options.eventId ?? `event-${options.id}`,
    leakageGroup: options.leakageGroup ?? options.eventId ?? `event-${options.id}`,
    deckFingerprint: fingerprintExactDeckV15(deck.decklist),
    commanderNames: [deck.commander],
    features: {
      manaEfficiency: options.featureOne ?? (options.label === 1 ? 0.8 : -0.8),
      interactionEfficiency: options.featureTwo ?? (options.label === 1 ? 0.6 : -0.6),
    },
    label: options.label,
    learningTarget: 'event-top-cut',
    metadata,
  };
  const provenance: TemporalEvidenceProvenanceV15 = {
    mode: 'contemporaneous-snapshot',
    domain: 'tournament-outcome',
    sourceId,
    sourceUri: sourceId === 'edhtop16'
      ? `https://edhtop16.com/tournament/${encodeURIComponent(options.id)}`
      : `https://topdeck.gg/event/${encodeURIComponent(options.id)}`,
    sourceRecordId: `${sourceId}:${options.id}`,
    sourceVersion: `${sourceId}-fixture-v1`,
    sourceContentHash: OUTCOME_HASH,
    sourceObservedAt,
    sourceRetrievedAt: new Date(Date.parse(sourceObservedAt) + 60_000).toISOString(),
    validFrom: options.outcomeAt,
    truthStatus: 'verified-present',
  };
  return createHistoricalLearningRecordV15(record, snapshot, provenance);
}

function datePlus(base: string, days: number): string {
  return new Date(Date.parse(base) + days * 86_400_000).toISOString();
}

test('real outcome source inventory keeps mirrors and different populations distinct', () => {
  const topdeck = realOutcomeSourceByIdV15('topdeck');
  assert.ok(topdeck);
  assert.equal(topdeck.trainingStatus, 'enabled-strict-historical');
  assert.equal(topdeck.attributionRequired, true);
  assert.equal(sourceCanTrainTargetV15('topdeck', 'event-top-cut'), true);
  assert.equal(sourceCanTrainTargetV15('edhtop16', 'event-top-cut'), false);
  assert.equal(sourceCanTrainTargetV15('playgroup', 'event-top-cut'), false);
  assert.equal(classifyRealOutcomeSourceRelationshipV15('topdeck', 'edhtop16'), 'shared-lineage');
  assert.equal(classifyRealOutcomeSourceRelationshipV15('topdeck', 'playgroup'), 'independent-different-population');
});

test('real corpus quality audit reports event, pilot, deck, region, bucket, and mirror-lineage concentration', () => {
  const records = [
    historicalFixture({ id: 'a1', deckPrefix: 'repeat-deck', outcomeAt: '2026-01-10T00:00:00.000Z', label: 1, eventId: 'event-a', pilotId: 'pilot-repeat', fieldSize: 12, eventState: 'CA', archetype: 'tempo' }),
    historicalFixture({ id: 'a2', outcomeAt: '2026-01-10T00:00:00.000Z', label: 0, eventId: 'event-a', pilotId: 'pilot-2', fieldSize: 12, eventState: 'CA' }),
    historicalFixture({ id: 'b1', deckPrefix: 'repeat-deck', outcomeAt: '2026-02-10T00:00:00.000Z', label: 1, eventId: 'event-b', pilotId: 'pilot-repeat', fieldSize: 40, eventState: 'NY', archetype: 'tempo' }),
    historicalFixture({ id: 'b2', outcomeAt: '2026-02-10T00:00:00.000Z', label: 0, eventId: 'event-b', pilotId: 'pilot-4', fieldSize: 40 }),
    historicalFixture({ id: 'c1', sourceId: 'edhtop16', outcomeAt: '2026-03-10T00:00:00.000Z', label: 1, eventId: 'event-c', pilotId: 'pilot-5', fieldSize: 80 }),
    historicalFixture({ id: 'c2', sourceId: 'edhtop16', outcomeAt: '2026-03-10T00:00:00.000Z', label: 0, eventId: 'event-c', pilotId: 'pilot-6', fieldSize: 80 }),
  ];
  const audit = auditRealCorpusQualityV15(records);
  assert.equal(audit.records, 6);
  assert.equal(audit.positiveRecords, 3);
  assert.equal(audit.negativeRecords, 3);
  assert.equal(audit.eventCoverage.uniqueEvents, 3);
  assert.equal(audit.eventCoverage.repeatedEvents, 3);
  assert.equal(audit.pilotCoverage.repeatedPilots, 1);
  assert.equal(audit.deckReuse.repeatedDeckFingerprints, 1);
  assert.equal(audit.deckReuse.deckFingerprintsAcrossMultipleEvents, 1);
  assert.equal(audit.metadataCoverage.recordsWithRegion, 3);
  assert.equal(audit.metadataCoverage.recordsWithArchetype, 2);
  assert.equal(audit.sourceLineageCollisions.length, 1);
  assert.deepEqual(audit.sourceLineageCollisions[0]?.sourceIds, ['edhtop16', 'topdeck']);
  assert.equal(audit.independentLineageFamilies, 1);
  assert.equal(audit.blockedSourceRecords, 2);
  assert.equal(audit.qualityGatePassed, false);
  assert.match(audit.blockers.join(' '), /not enabled for strict training/i);
  assert.ok(audit.eventCoverage.fieldSizeBuckets.some((bucket) => bucket.key === '1-15' && bucket.records === 2));
  assert.ok(audit.eventCoverage.fieldSizeBuckets.some((bucket) => bucket.key === '32-63' && bucket.records === 2));
  assert.ok(audit.eventCoverage.fieldSizeBuckets.some((bucket) => bucket.key === '64-127' && bucket.records === 2));
});

test('future holdout seal freezes training corpus, feature normalization, hyperparameters, threshold, and success criteria', () => {
  const training = Array.from({ length: 24 }, (_, index) => historicalFixture({
    id: `seal-train-${index}`,
    outcomeAt: datePlus('2026-01-01T00:00:00.000Z', index),
    label: index % 2 === 0 ? 1 : 0,
    eventId: `seal-event-${index}`,
    pilotId: `seal-pilot-${index}`,
    fieldSize: 64,
  }));
  const seal = createFutureHoldoutSealV15(training, '2026-02-01T00:00:00.000Z', {
    decisionThreshold: 0.55,
    neural: { epochs: 120, seed: 12345 },
    now: () => new Date('2026-02-02T00:00:00.000Z'),
  });
  assertFutureHoldoutSealV15(seal);
  assertTrainingRecordsMatchFutureHoldoutSealV15(seal, training);
  assert.equal(seal.trainingRecordCount, 24);
  assert.equal(seal.trainingPositiveRecords, 12);
  assert.equal(seal.trainingNegativeRecords, 12);
  assert.equal(seal.evaluationPlan.decisionThreshold, 0.55);
  assert.equal(seal.evaluationPlan.neural.epochs, 120);
  assert.equal(seal.evaluationPlan.neural.seed, 12345);
  assert.equal(seal.evaluationPlan.minimumFutureHoldoutRecordsForUsefulnessClaim, 200);
  assert.equal(seal.featureNormalizerFitFingerprint, NORMALIZER_HASH);

  const tamperedSeal = structuredClone(seal);
  tamperedSeal.evaluationPlan.decisionThreshold = 0.5;
  assert.throws(() => assertFutureHoldoutSealV15(tamperedSeal), /content hash.*modified/i);

  const modifiedTraining = structuredClone(training);
  const first = modifiedTraining[0];
  assert.ok(first);
  first.record.features.manaEfficiency = 0.123;
  assert.throws(
    () => assertTrainingRecordsMatchFutureHoldoutSealV15(seal, modifiedTraining),
    /training corpus content.*sealed historical manifest/i,
  );
});

test('sealed future evaluator uses only genuinely later unseen outcomes and remains advisory', () => {
  const training = Array.from({ length: 40 }, (_, index) => historicalFixture({
    id: `eval-train-${index}`,
    outcomeAt: datePlus('2026-01-01T00:00:00.000Z', index),
    label: index % 2 === 0 ? 1 : 0,
    eventId: `train-event-${index}`,
    pilotId: `train-pilot-${index}`,
    fieldSize: index % 3 === 0 ? 32 : 64,
    eventState: index % 2 === 0 ? 'CA' : 'NY',
    archetype: index % 2 === 0 ? 'proactive' : 'control',
  }));
  const seal = createFutureHoldoutSealV15(training, '2026-02-15T00:00:00.000Z', {
    neural: { epochs: 120, seed: 24680 },
    now: () => new Date('2026-03-01T00:00:00.000Z'),
  });
  const future = Array.from({ length: 24 }, (_, index) => historicalFixture({
    id: `eval-future-${index}`,
    outcomeAt: datePlus('2026-04-01T00:00:00.000Z', index),
    label: index % 2 === 0 ? 1 : 0,
    eventId: `future-event-${index}`,
    pilotId: `future-pilot-${index}`,
    fieldSize: index % 2 === 0 ? 48 : 96,
    eventState: index % 3 === 0 ? 'TX' : 'WA',
    archetype: index % 2 === 0 ? 'proactive' : 'control',
  }));

  const evaluation = evaluateSealedFutureHoldoutV15(seal, training, future);
  assert.equal(evaluation.trainingRecords, 40);
  assert.equal(evaluation.futureHoldoutRecords, 24);
  assert.equal(evaluation.futureGate.allHoldoutOutcomesOccurredAfterSeal, true);
  assert.equal(evaluation.futureGate.featureNormalizerMatchesSeal, true);
  assert.equal(evaluation.futureGate.pilotIdentitiesDisjoint, true);
  assert.equal(evaluation.neuralMetrics.examples, 24);
  assert.equal(evaluation.transparentMetrics.examples, 24);
  assert.equal(evaluation.prevalenceMetrics.examples, 24);
  assert.ok(evaluation.neuralMetrics.logLoss !== null);
  assert.ok(evaluation.neuralMetrics.brierScore !== null);
  assert.ok(evaluation.neuralMetrics.auroc !== null);
  assert.ok(evaluation.neuralMetrics.expectedCalibrationError !== null);
  assert.ok(evaluation.neuralMetrics.accuracy95Ci !== null);
  assert.equal(evaluation.neuralMetrics.calibration.length, seal.evaluationPlan.calibrationBins);
  assert.ok(evaluation.subgroups.some((group) => group.dimension === 'source' && group.key === 'topdeck'));
  assert.ok(evaluation.subgroups.some((group) => group.dimension === 'field-size'));
  assert.equal(evaluation.usefulness, 'insufficient-future-evidence');
  assert.match(evaluation.usefulnessReasons.join(' '), /at least 200 genuinely future holdout records/i);
  assert.equal(evaluation.promotionAuthorized, false);
});

test('sealed future evaluator rejects fake-future time, normalizer drift, repeated pilot, and exact-deck leakage', () => {
  const training = Array.from({ length: 20 }, (_, index) => historicalFixture({
    id: `guard-train-${index}`,
    outcomeAt: datePlus('2026-01-01T00:00:00.000Z', index),
    label: index % 2 === 0 ? 1 : 0,
    eventId: `guard-train-event-${index}`,
    pilotId: `guard-train-pilot-${index}`,
  }));
  const seal = createFutureHoldoutSealV15(training, '2026-02-01T00:00:00.000Z', {
    neural: { epochs: 20 },
    now: () => new Date('2026-03-01T00:00:00.000Z'),
  });
  const validFuture = historicalFixture({
    id: 'guard-future',
    outcomeAt: '2026-04-01T00:00:00.000Z',
    label: 1,
    eventId: 'guard-future-event',
    pilotId: 'guard-future-pilot',
  });

  const beforeSeal = historicalFixture({
    id: 'guard-before-seal',
    outcomeAt: '2026-02-20T00:00:00.000Z',
    label: 0,
    eventId: 'guard-before-event',
    pilotId: 'guard-before-pilot',
  });
  assert.throws(() => evaluateSealedFutureHoldoutV15(seal, training, [beforeSeal]), /did not occur after.*seal/i);

  const wrongNormalizer = structuredClone(validFuture);
  assert.ok(wrongNormalizer.record.metadata);
  wrongNormalizer.record.metadata.featureNormalizerFitFingerprint = 'e'.repeat(64);
  assert.throws(() => evaluateSealedFutureHoldoutV15(seal, training, [wrongNormalizer]), /training-fitted normalizer/i);

  const repeatedPilot = structuredClone(validFuture);
  assert.ok(repeatedPilot.record.metadata);
  repeatedPilot.record.metadata.providerPlayerId = 'guard-train-pilot-0';
  assert.throws(() => evaluateSealedFutureHoldoutV15(seal, training, [repeatedPilot]), /pilot identities overlap/i);

  const repeatedDeck = historicalFixture({
    id: 'guard-repeated-deck-outcome',
    deckPrefix: 'guard-train-0',
    outcomeAt: '2026-04-02T00:00:00.000Z',
    label: 0,
    eventId: 'guard-new-event',
    pilotId: 'guard-new-pilot',
  });
  assert.throws(() => evaluateSealedFutureHoldoutV15(seal, training, [repeatedDeck]), /exact deck fingerprints overlap/i);
});
