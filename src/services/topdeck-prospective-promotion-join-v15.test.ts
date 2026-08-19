import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import type { ScryfallForwardCardDataCaptureV15 } from './scryfall-forward-carddata-capture-v15.js';
import type { RetainedScryfallCardDataReplayV15 } from './retained-scryfall-carddata-replay-v15.js';
import { TOPDECK_V2_ATTRIBUTION_V15, type TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import type { TopDeckProspectiveCompletedCaptureV15 } from './topdeck-prospective-completed-capture-v15.js';
import type { TopDeckProspectivePreEventCaptureResultV15 } from './topdeck-prospective-capture-v15.js';
import { joinTopDeckProspectivePromotionEvidenceV15 } from './topdeck-prospective-promotion-join-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';

const tournamentId = 'future-edh-1';
const playerId = 'player-1';
const providerRecordId = `${tournamentId}:standing:${playerId}`;
const eventStart = '2026-08-20T10:00:00.000Z';
const eventEnd = '2026-08-20T18:00:00.000Z';
const decklist = ['// COMMANDER', '1 Test Commander', '', '// MAIN', '99 Wastes'].join('\n');
const commanderNames = ['Test Commander'];
const deckFingerprint = fingerprintExactDeckV15(decklist);

const commander: ScryfallCard = {
  id: 'commander-card',
  oracle_id: 'commander-oracle',
  name: 'Test Commander',
  lang: 'en',
  released_at: '2020-01-01',
  mana_cost: '{2}',
  cmc: 2,
  type_line: 'Legendary Creature — Human',
  oracle_text: 'Vigilance',
  color_identity: [],
  keywords: ['Vigilance'],
  legalities: { commander: 'legal' },
  set: 'tst',
  set_name: 'Test Set',
  collector_number: '1',
  rarity: 'rare',
  power: '2',
  toughness: '2',
  scryfall_uri: 'https://scryfall.com/card/tst/1/test-commander',
};

const wastes: ScryfallCard = {
  id: 'wastes-card',
  oracle_id: 'wastes-oracle',
  name: 'Wastes',
  lang: 'en',
  released_at: '2020-01-01',
  mana_cost: '',
  cmc: 0,
  type_line: 'Basic Land — Wastes',
  oracle_text: '{T}: Add {C}.',
  color_identity: [],
  keywords: [],
  legalities: { commander: 'legal' },
  produced_mana: ['C'],
  set: 'tst',
  set_name: 'Test Set',
  collector_number: '2',
  rarity: 'common',
  scryfall_uri: 'https://scryfall.com/card/tst/2/wastes',
};

function retainedCardData(observedAt = '2026-08-20T08:00:00.000Z'): RetainedScryfallCardDataReplayV15 {
  const capture = {
    schemaVersion: 'scryfall-forward-carddata-capture-v15.2',
    sourcePolicy: {} as never,
    acquisition: {
      format: 'scryfall-jsonl-gzip-v1',
      bytes: new Uint8Array([1]),
      byteLength: 1,
      decodedByteLength: 1,
      cards: [commander, wastes],
      provenance: {
        method: 'contemporaneous-capture',
        sourceId: 'scryfall-default-cards',
        sourceUri: 'https://data.scryfall.io/default-cards/test.jsonl.gz',
        sourceContentHash: 'a'.repeat(64),
        observedAt,
        retrievedAt: observedAt,
      },
      integrity: {
        algorithm: 'sha256',
        expectedHash: null,
        actualHash: 'a'.repeat(64),
        exactHashMatch: true,
        expectedCompressedByteLength: null,
        exactCompressedByteLengthMatch: true,
        decodedContentHash: 'b'.repeat(64),
      },
    },
    safeguards: [
      'Only current Scryfall gzip JSON Lines bytes from an HTTPS *.scryfall.io static-file origin are accepted.',
      'The observation timestamp is assigned at capture time and cannot be supplied by the source descriptor.',
      'The SHA-256 provenance hash covers the exact compressed source bytes before decompression.',
      'Compressed and decoded byte limits are enforced before parsed cards can feed rich feature extraction.',
      'This forward capture does not make Scryfall a verified retrospective historical archive.',
    ],
  } as ScryfallForwardCardDataCaptureV15;
  return {
    schemaVersion: 'retained-scryfall-carddata-replay-v15.1',
    manifestFingerprint: 'c'.repeat(64),
    capture,
    replayVerified: true,
  };
}

function preEvent(): Extract<TopDeckProspectivePreEventCaptureResultV15, { status: 'captured' }> {
  return {
    schemaVersion: 'topdeck-prospective-pre-event-capture-v15.1',
    status: 'captured',
    source: 'topdeck-v2',
    attribution: TOPDECK_V2_ATTRIBUTION_V15,
    providerEventId: tournamentId,
    eventStartAt: eventStart,
    capturedAt: '2026-08-20T08:30:00.000Z',
    providerStatus: 'Not Started',
    infoSourceUri: `https://topdeck.gg/api/v2/tournaments/${tournamentId}/info`,
    infoSourceContentHash: 'd'.repeat(64),
    standingsSourceUri: `https://topdeck.gg/api/v2/tournaments/${tournamentId}/standings`,
    standingsSourceContentHash: 'e'.repeat(64),
    decks: [{
      providerEventId: tournamentId,
      providerPlayerId: playerId,
      providerRecordId,
      decklist,
      commanderNames,
      deckFingerprint,
      evidence: {
        schemaVersion: 'topdeck-pre-event-decklist-evidence-v15.1',
        sourceId: 'topdeck',
        providerEventId: tournamentId,
        providerPlayerId: playerId,
        providerRecordId,
        sourceUri: `https://topdeck.gg/api/v2/tournaments/${tournamentId}/standings`,
        sourceContentHash: 'e'.repeat(64),
        deckFingerprint,
        observedAt: '2026-08-20T08:30:00.000Z',
        retrievedAt: '2026-08-20T08:30:00.000Z',
        method: 'contemporaneous-rest-decklist-capture',
      },
    }],
    rejectedStandingRows: 0,
    safeguards: [
      'Tournament status must still be Not Started when the capture is observed.',
      'Capture observation time must be no later than provider startDate.',
      'Only strict TopDeck deckObj Commander lists are retained; external deck URLs are never followed.',
      'Exact deck fingerprints and provider response hashes are preserved for replay/audit.',
      'No automatic HTTP retries are performed.',
    ],
  };
}

function candidate(overrides: Partial<TopDeckLearningCandidateV15> = {}): TopDeckLearningCandidateV15 {
  return {
    sourceId: 'topdeck',
    providerEventId: tournamentId,
    providerPlayerId: playerId,
    providerRecordId,
    sourceUrl: `https://topdeck.gg/event/${tournamentId}`,
    outcomeOccurredAt: eventStart,
    standing: 1,
    fieldSize: 1,
    topCutSize: 1,
    decklist,
    commanderNames,
    metadata: {
      provider: 'topdeck-v2',
      tournamentName: 'Future EDH',
      wins: 4,
      draws: 0,
      losses: 1,
      standingSource: 'provider-field',
      deckSource: 'topdeck-deckobj',
      deckObjectSchemaVersion: 'topdeck-deckobj-id-count-v15.1',
    },
    ...overrides,
  };
}

function completed(finalCandidate = candidate()): TopDeckProspectiveCompletedCaptureV15 {
  return {
    schemaVersion: 'topdeck-prospective-completed-capture-v15.1',
    source: 'topdeck-v2',
    attribution: TOPDECK_V2_ATTRIBUTION_V15,
    providerEventId: tournamentId,
    capturedAt: '2026-08-20T19:00:00.000Z',
    sourceUri: 'https://topdeck.gg/api/v2/tournaments',
    sourceContentHash: 'f'.repeat(64),
    eventEndEvidence: {
      schemaVersion: 'topdeck-event-end-evidence-v15.1',
      sourceId: 'topdeck',
      providerEventId: tournamentId,
      sourceUri: `https://topdeck.gg/api/v2/tournaments/${tournamentId}/info`,
      sourceContentHash: '1'.repeat(64),
      eventStartedAt: eventStart,
      eventEndedAt: eventEnd,
      observedAt: '2026-08-20T19:00:00.000Z',
      retrievedAt: '2026-08-20T19:00:00.000Z',
      providerStatus: 'Complete',
      method: 'provider-info-end-date-capture',
    },
    candidates: [finalCandidate],
    rejected: [],
    safeguards: [
      'Provider status must be Complete and endDate must be independently captured before final standings are admitted.',
      'The completed tournament response is fetched by exact TID and hashed over the exact response bytes.',
      'Every adapted candidate must bind the requested event identity and the provider startDate captured by event-end evidence.',
      'No automatic HTTP retries are performed.',
    ],
  };
}

test('prospective join produces a promotion-grade row only when pre-event deck, retained card truth, and final deck all match', () => {
  const result = joinTopDeckProspectivePromotionEvidenceV15({
    preEvent: preEvent(),
    completed: completed(),
    retainedCardData: retainedCardData(),
  });

  assert.equal(result.featureAvailableAt, '2026-08-20T08:30:00.000Z');
  assert.equal(result.finalCandidates, 1);
  assert.equal(result.rejectedRows.length, 0);
  assert.equal(result.joinedRows.length, 1);
  assert.equal(result.joinedRows[0]?.prepared.assessment.eligibleForPromotionGradeTraining, true);
  assert.equal(result.joinedRows[0]?.prepared.candidate.outcomeOccurredAt, eventEnd);
  assert.equal(result.joinedRows[0]?.prepared.candidate.metadata.eventStartAt, eventStart);
  assert.equal(result.joinedRows[0]?.completedResponseContentHash, 'f'.repeat(64));
});

test('prospective join rejects a final deck that changed from the pre-event fingerprint', () => {
  const changedDeck = ['// COMMANDER', '1 Other Commander', '', '// MAIN', '99 Wastes'].join('\n');
  const result = joinTopDeckProspectivePromotionEvidenceV15({
    preEvent: preEvent(),
    completed: completed(candidate({ decklist: changedDeck, commanderNames: ['Other Commander'] })),
    retainedCardData: retainedCardData(),
  });

  assert.equal(result.joinedRows.length, 0);
  assert.equal(result.rejectedRows[0]?.code, 'final-deck-changed');
});

test('prospective join rejects retained card truth first observed after tournament start', () => {
  const result = joinTopDeckProspectivePromotionEvidenceV15({
    preEvent: preEvent(),
    completed: completed(),
    retainedCardData: retainedCardData('2026-08-20T11:00:00.000Z'),
  });

  assert.equal(result.joinedRows.length, 0);
  assert.equal(result.rejectedRows[0]?.code, 'predictor-carddata-too-late');
});
