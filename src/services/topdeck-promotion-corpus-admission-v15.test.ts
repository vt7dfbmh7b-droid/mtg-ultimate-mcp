import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { extractProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import {
  prepareTopDeckPromotionGradeInputV15,
  type TopDeckEventEndEvidenceV15,
  type TopDeckPreEventDecklistEvidenceV15,
} from './topdeck-promotion-grade-evidence-v15.js';
import {
  materializeTopDeckPromotionCorpusFromJoinedEvidenceV15,
  type TopDeckPromotionJoinArtifactInputV15,
} from './topdeck-promotion-corpus-admission-v15.js';
import type {
  TopDeckProspectivePromotionJoinV15,
  TopDeckProspectivePromotionJoinedRowV15,
} from './topdeck-prospective-promotion-join-v15.js';

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

function eventInput(options: {
  id: string;
  eventStart: string;
  standing: number;
  cheapInteraction: number;
  artifactSeed?: string;
}): TopDeckPromotionJoinArtifactInputV15 {
  const commanderName = `${options.id} Commander`;
  const landName = `${options.id} Land`;
  const answerName = `${options.id} Answer`;
  const threatName = `${options.id} Threat`;
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
  const deckObservedAt = new Date(eventStartMs - 2 * 60 * 60 * 1_000).toISOString();
  const snapshotAt = new Date(eventStartMs - 60 * 60 * 1_000).toISOString();
  const eventEndedAt = new Date(eventStartMs + 8 * 60 * 60 * 1_000).toISOString();
  const outcomeObservedAt = new Date(eventStartMs + 9 * 60 * 60 * 1_000).toISOString();
  const providerPlayerId = `player-${options.id}`;
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
  const prepared = prepareTopDeckPromotionGradeInputV15({
    candidate,
    snapshot,
    decklistEvidence,
    eventEndEvidence,
  });
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
  return {
    artifactReference: artifactReference(options.artifactSeed ?? options.id),
    join,
  };
}

function corpusInputs(): TopDeckPromotionJoinArtifactInputV15[] {
  return [
    eventInput({ id: 'event-1', eventStart: '2026-01-01T10:00:00Z', standing: 2, cheapInteraction: 4 }),
    eventInput({ id: 'event-2', eventStart: '2026-01-10T10:00:00Z', standing: 20, cheapInteraction: 8 }),
    eventInput({ id: 'event-3', eventStart: '2026-01-20T10:00:00Z', standing: 3, cheapInteraction: 12 }),
    eventInput({ id: 'event-4', eventStart: '2026-02-01T10:00:00Z', standing: 18, cheapInteraction: 16 }),
    eventInput({ id: 'event-5', eventStart: '2026-03-01T10:00:00Z', standing: 1, cheapInteraction: 10 }),
  ];
}

test('promotion corpus admission revalidates joined rows and binds immutable evidence lineage into historical records', () => {
  const result = materializeTopDeckPromotionCorpusFromJoinedEvidenceV15(corpusInputs(), { holdoutFraction: 0.2 });

  assert.equal(result.joinArtifactCount, 5);
  assert.equal(result.joinedRows, 5);
  assert.equal(result.admittedRows, 5);
  assert.equal(result.partition.trainingIds.length, 4);
  assert.equal(result.partition.holdoutIds.length, 1);
  assert.equal(result.historicalManifest.recordCount, 5);
  assert.equal(result.historicalManifest.eligibleRecordCount, 5);
  assert.equal(result.historicalManifest.ineligibleRecordCount, 0);
  assert.match(result.evidenceLineageHash, /^[a-f0-9]{64}$/);
  assert.equal(result.conservativeOutcomeSourceObservedAt, '2026-03-01T19:00:00.000Z');

  for (const historical of result.historicalRecords) {
    const metadata = historical.record.metadata ?? {};
    assert.match(String(metadata.promotionEvidenceJoinArtifactReference ?? ''), /^ghcr\.io\/test-owner\/mtg-ultimate-mcp-topdeck-evidence@sha256:[a-f0-9]{64}$/);
    assert.match(String(metadata.promotionEvidenceCompletedSourceContentHash ?? ''), /^[a-f0-9]{64}$/);
    assert.match(String(metadata.promotionEvidenceRetainedCardDataManifestFingerprint ?? ''), /^[a-f0-9]{64}$/);
    assert.match(String(metadata.promotionEvidenceJoinContentHash ?? ''), /^[a-f0-9]{64}$/);
    assert.equal(historical.eligibleForHistoricalTraining, true);
  }
});

test('promotion corpus admission rejects mutable or wrong-package evidence references', () => {
  const inputs = corpusInputs();
  inputs[0] = { ...inputs[0]!, artifactReference: 'ghcr.io/test-owner/mtg-ultimate-mcp-topdeck-evidence:latest' };
  assert.throws(
    () => materializeTopDeckPromotionCorpusFromJoinedEvidenceV15(inputs, { holdoutFraction: 0.2 }),
    /immutable.*ghcr.*digest/i,
  );
});

test('promotion corpus admission rejects a serialized eligibility row whose timing was tampered after joining', () => {
  const inputs = corpusInputs();
  const first = inputs[0]!;
  const row = first.join.joinedRows[0]!;
  const tampered: TopDeckPromotionJoinArtifactInputV15 = {
    ...first,
    join: {
      ...first.join,
      joinedRows: [{
        ...row,
        prepared: {
          ...row.prepared,
          candidate: {
            ...row.prepared.candidate,
            outcomeOccurredAt: '2026-01-01T10:00:00.000Z',
          },
        },
      }],
    },
  };
  inputs[0] = tampered;
  assert.throws(
    () => materializeTopDeckPromotionCorpusFromJoinedEvidenceV15(inputs, { holdoutFraction: 0.2 }),
    /temporal fields.*no longer match/i,
  );
});

test('promotion corpus admission rejects duplicate provider records across immutable artifacts', () => {
  const inputs = corpusInputs();
  const duplicate = {
    artifactReference: artifactReference('duplicate-artifact'),
    join: {
      ...inputs[0]!.join,
      joinedRows: [...inputs[0]!.join.joinedRows],
    },
  } satisfies TopDeckPromotionJoinArtifactInputV15;
  assert.throws(
    () => materializeTopDeckPromotionCorpusFromJoinedEvidenceV15([...inputs, duplicate], { holdoutFraction: 0.2 }),
    /duplicate providerRecordId/i,
  );
});

test('historical manifest changes when the immutable joined-evidence artifact identity changes', () => {
  const first = corpusInputs();
  const second = corpusInputs();
  second[0] = { ...second[0]!, artifactReference: artifactReference('replacement-object') };

  const a = materializeTopDeckPromotionCorpusFromJoinedEvidenceV15(first, { holdoutFraction: 0.2 });
  const b = materializeTopDeckPromotionCorpusFromJoinedEvidenceV15(second, { holdoutFraction: 0.2 });

  assert.notEqual(a.evidenceLineageHash, b.evidenceLineageHash);
  assert.notEqual(a.historicalManifest.manifestHash, b.historicalManifest.manifestHash);
  assert.notEqual(a.historicalManifest.corpusContentHash, b.historicalManifest.corpusContentHash);
});
