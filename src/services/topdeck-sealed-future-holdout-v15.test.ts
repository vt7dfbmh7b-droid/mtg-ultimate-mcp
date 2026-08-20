import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { createFutureHoldoutSealV15 } from './future-holdout-seal-v15.js';
import { extractProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import {
  materializeTopDeckPromotionCorpusFromJoinedEvidenceV15,
  type TopDeckPromotionJoinArtifactInputV15,
} from './topdeck-promotion-corpus-admission-v15.js';
import {
  prepareTopDeckPromotionGradeInputV15,
  type TopDeckEventEndEvidenceV15,
  type TopDeckPreEventDecklistEvidenceV15,
} from './topdeck-promotion-grade-evidence-v15.js';
import type {
  TopDeckProspectivePromotionJoinV15,
  TopDeckProspectivePromotionJoinedRowV15,
} from './topdeck-prospective-promotion-join-v15.js';
import { materializeTopDeckSealedFutureHoldoutV15 } from './topdeck-sealed-future-holdout-v15.js';

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function artifactReference(value: string): string {
  return `ghcr.io/test-owner/mtg-ultimate-mcp-topdeck-evidence@sha256:${hash(value)}`;
}

function card(name: string, typeLine: string, cmc: number, oracleText = ''): ScryfallCard {
  return {
    id: `id-${hash(name).slice(0, 20)}`,
    oracle_id: `oracle-${hash(name).slice(0, 20)}`,
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
    scryfall_uri: `https://scryfall.com/card/tst/1/${hash(name).slice(0, 12)}`,
  };
}

function joinedEvent(options: {
  id: string;
  eventStart: string;
  standing: number;
  cheapInteraction: number;
  playerId?: string;
  predictorAvailableAt?: string;
  deckPrefix?: string;
}): TopDeckPromotionJoinArtifactInputV15 {
  const prefix = options.deckPrefix ?? options.id;
  const commanderName = `${prefix} Commander`;
  const landName = `${prefix} Land`;
  const answerName = `${prefix} Answer`;
  const threatName = `${prefix} Threat`;
  const decklist = [
    '// COMMANDER',
    `1 ${commanderName}`,
    '',
    '// MAIN',
    `34 ${landName}`,
    `${options.cheapInteraction} ${answerName}`,
    `${65 - options.cheapInteraction} ${threatName}`,
  ].join('\n');
  const cards = [
    card(commanderName, 'Legendary Creature — Test', 2),
    card(landName, 'Basic Land — Wastes', 0, '{T}: Add {C}.'),
    card(answerName, 'Instant', 1, `A deck can have any number of cards named ${answerName}.\nDestroy target creature.`),
    card(threatName, 'Creature — Test', 4, `A deck can have any number of cards named ${threatName}.`),
  ];
  const eventStartMs = Date.parse(options.eventStart);
  const snapshotAt = options.predictorAvailableAt ?? new Date(eventStartMs - 60 * 60 * 1_000).toISOString();
  const snapshotMs = Date.parse(snapshotAt);
  const deckObservedAt = new Date(snapshotMs - 60 * 60 * 1_000).toISOString();
  const eventEndedAt = new Date(eventStartMs + 8 * 60 * 60 * 1_000).toISOString();
  const outcomeObservedAt = new Date(eventStartMs + 9 * 60 * 60 * 1_000).toISOString();
  const providerPlayerId = options.playerId ?? `player-${options.id}`;
  const providerRecordId = `${options.id}:standing:${providerPlayerId}`;
  const candidate: TopDeckLearningCandidateV15 = {
    sourceId: 'topdeck',
    providerEventId: options.id,
    providerPlayerId,
    providerRecordId,
    sourceUrl: `https://topdeck.gg/event/${options.id}`,
    outcomeOccurredAt: new Date(eventStartMs).toISOString(),
    standing: options.standing,
    fieldSize: 32,
    topCutSize: 8,
    decklist,
    commanderNames: [commanderName],
    metadata: {
      provider: 'topdeck-v2',
      tournamentName: options.id,
      wins: null,
      draws: null,
      losses: null,
      standingSource: 'provider-field',
      deckSource: 'inline-text',
    },
  };
  const snapshot = extractProvenancedDeckFeatureSnapshotV15(decklist, cards, {
    availableAt: snapshotAt,
    provenance: {
      method: 'contemporaneous-capture',
      sourceId: 'scryfall-default-cards',
      sourceUri: `https://data.scryfall.io/default-cards/${options.id}.jsonl.gz`,
      sourceContentHash: hash(`carddata:${options.id}`),
      observedAt: deckObservedAt,
      retrievedAt: deckObservedAt,
    },
  });
  const deckFingerprint = fingerprintExactDeckV15(decklist);
  const decklistEvidence: TopDeckPreEventDecklistEvidenceV15 = {
    schemaVersion: 'topdeck-pre-event-decklist-evidence-v15.1',
    sourceId: 'topdeck',
    providerEventId: options.id,
    providerPlayerId,
    providerRecordId,
    sourceUri: `https://topdeck.gg/api/v2/tournaments/${options.id}/standings`,
    sourceContentHash: hash(`deck-source:${options.id}`),
    deckFingerprint,
    observedAt: deckObservedAt,
    retrievedAt: deckObservedAt,
    method: 'contemporaneous-rest-decklist-capture',
  };
  const eventEndEvidence: TopDeckEventEndEvidenceV15 = {
    schemaVersion: 'topdeck-event-end-evidence-v15.1',
    sourceId: 'topdeck',
    providerEventId: options.id,
    sourceUri: `https://topdeck.gg/api/v2/tournaments/${options.id}/info`,
    sourceContentHash: hash(`end-source:${options.id}`),
    eventStartedAt: new Date(eventStartMs).toISOString(),
    eventEndedAt,
    observedAt: outcomeObservedAt,
    retrievedAt: outcomeObservedAt,
    providerStatus: 'Complete',
    method: 'provider-info-end-date-capture',
  };
  const prepared = prepareTopDeckPromotionGradeInputV15({ candidate, snapshot, decklistEvidence, eventEndEvidence });
  const row: TopDeckProspectivePromotionJoinedRowV15 = {
    providerRecordId,
    providerEventId: options.id,
    providerPlayerId,
    completedResponseContentHash: hash(`completed:${options.id}`),
    retainedCardDataManifestFingerprint: hash(`retained:${options.id}`),
    prepared,
  };
  const join: TopDeckProspectivePromotionJoinV15 = {
    schemaVersion: 'topdeck-prospective-promotion-join-v15.1',
    providerEventId: options.id,
    predictionCutoff: prepared.assessment.predictionCutoff,
    eventEndedAt: prepared.assessment.outcomeOccurredAt,
    featureAvailableAt: prepared.assessment.snapshotAvailableAt,
    finalCandidates: 1,
    joinedRows: [row],
    rejectedRows: [],
    safeguards: [
      'Only a captured pre-event TopDeck deck can be joined to a final candidate.',
      'The final provider deck fingerprint must exactly match the pre-event fingerprint.',
      'Retained Scryfall card truth and the exact decklist must both be available no later than the feature snapshot.',
      'The feature snapshot must be available no later than provider tournament start.',
      'Final target timing comes from provider-verified event end, never legacy startDate.',
    ],
  };
  return { artifactReference: artifactReference(options.id), join };
}

function sealedTraining() {
  const inputs: TopDeckPromotionJoinArtifactInputV15[] = [];
  for (let index = 0; index < 20; index += 1) {
    const day = String(index + 1).padStart(2, '0');
    inputs.push(joinedEvent({
      id: `train-${index + 1}`,
      eventStart: `2026-01-${day}T10:00:00Z`,
      standing: index % 2 === 0 ? 2 : 20,
      cheapInteraction: 4 + (index % 10),
    }));
  }
  const corpus = materializeTopDeckPromotionCorpusFromJoinedEvidenceV15(inputs, { holdoutFraction: 0.2 });
  const seal = createFutureHoldoutSealV15(
    corpus.historicalRecords,
    '2026-01-21T00:00:00.000Z',
    { now: () => new Date('2026-01-21T01:00:00.000Z') },
  );
  return { corpus, seal };
}

test('sealed future holdout uses the exact training normalizer without refitting future data', () => {
  const { corpus, seal } = sealedTraining();
  const future = joinedEvent({
    id: 'future-1',
    eventStart: '2026-02-01T10:00:00Z',
    standing: 1,
    cheapInteraction: 17,
  });
  const result = materializeTopDeckSealedFutureHoldoutV15({
    seal,
    trainingRecords: corpus.historicalRecords,
    trainingNormalizer: corpus.normalizer,
    futureJoinedEvidence: [future],
  });

  assert.equal(result.evidenceRows, 1);
  assert.equal(result.historicalRecords.length, 1);
  assert.equal(result.historicalRecords[0]?.record.metadata?.featureNormalizerFitFingerprint, seal.featureNormalizerFitFingerprint);
  assert.equal(result.historicalRecords[0]?.record.metadata?.futureHoldoutSealHash, seal.sealHash);
  assert.equal(result.historicalRecords[0]?.eligibleForHistoricalTraining, true);
  assert.equal(result.historicalManifest.eligibleRecordCount, 1);
  assert.equal(result.sealHash, seal.sealHash);
});

test('sealed future holdout rejects any normalizer other than the exact sealed training fit', () => {
  const { corpus, seal } = sealedTraining();
  const future = joinedEvent({ id: 'future-wrong-normalizer', eventStart: '2026-02-01T10:00:00Z', standing: 1, cheapInteraction: 17 });
  assert.throws(
    () => materializeTopDeckSealedFutureHoldoutV15({
      seal,
      trainingRecords: corpus.historicalRecords,
      trainingNormalizer: { ...corpus.normalizer, fitFingerprint: '0'.repeat(64) },
      futureJoinedEvidence: [future],
    }),
    /normalizer.*does not match.*seal/i,
  );
});

test('sealed future holdout rejects predictor evidence that was available before the seal', () => {
  const { corpus, seal } = sealedTraining();
  const future = joinedEvent({
    id: 'future-old-predictor',
    eventStart: '2026-02-01T10:00:00Z',
    standing: 1,
    cheapInteraction: 17,
    predictorAvailableAt: '2026-01-20T12:00:00.000Z',
  });
  assert.throws(
    () => materializeTopDeckSealedFutureHoldoutV15({
      seal,
      trainingRecords: corpus.historicalRecords,
      trainingNormalizer: corpus.normalizer,
      futureJoinedEvidence: [future],
    }),
    /predictor state was not genuinely future/i,
  );
});

test('sealed future holdout rejects a pilot reused from sealed training', () => {
  const { corpus, seal } = sealedTraining();
  const future = joinedEvent({
    id: 'future-reused-pilot',
    eventStart: '2026-02-01T10:00:00Z',
    standing: 1,
    cheapInteraction: 17,
    playerId: 'player-train-1',
  });
  assert.throws(
    () => materializeTopDeckSealedFutureHoldoutV15({
      seal,
      trainingRecords: corpus.historicalRecords,
      trainingNormalizer: corpus.normalizer,
      futureJoinedEvidence: [future],
    }),
    /reuses sealed training pilot/i,
  );
});

test('sealed future holdout rejects an exact deck fingerprint reused from sealed training', () => {
  const { corpus, seal } = sealedTraining();
  const future = joinedEvent({
    id: 'future-reused-deck',
    eventStart: '2026-02-01T10:00:00Z',
    standing: 1,
    cheapInteraction: 4,
    deckPrefix: 'train-1',
  });
  assert.throws(
    () => materializeTopDeckSealedFutureHoldoutV15({
      seal,
      trainingRecords: corpus.historicalRecords,
      trainingNormalizer: corpus.normalizer,
      futureJoinedEvidence: [future],
    }),
    /reuses a sealed training exact deck fingerprint/i,
  );
});
