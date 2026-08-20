import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import {
  assessTopDeckPromotionGradeEvidenceV15,
  prepareTopDeckPromotionGradeInputV15,
  topDeckDecklistEvidenceContentHashV15,
  type TopDeckEventEndEvidenceV15,
  type TopDeckPreEventDecklistEvidenceV15,
} from './topdeck-promotion-grade-evidence-v15.js';

const decklist = [
  '// COMMANDER',
  '1 Test Commander',
  '',
  '// MAIN',
  '99 Wastes',
].join('\n');
const deckFingerprint = fingerprintExactDeckV15(decklist);

function candidate(): TopDeckLearningCandidateV15 {
  return {
    sourceId: 'topdeck',
    providerEventId: 'event-1',
    providerPlayerId: 'player-1',
    providerRecordId: 'event-1:standing:player-1',
    sourceUrl: 'https://topdeck.gg/event/event-1',
    // Legacy bulk adapter currently stores provider startDate here. The promotion
    // boundary replaces it with verified event end only after evidence passes.
    outcomeOccurredAt: '2026-08-20T10:00:00.000Z',
    standing: 4,
    fieldSize: 32,
    topCutSize: 8,
    decklist,
    commanderNames: ['Test Commander'],
    metadata: {
      provider: 'topdeck-v2',
      tournamentName: 'Promotion Test',
      wins: 4,
      draws: 0,
      losses: 1,
      standingSource: 'provider-field',
      deckSource: 'topdeck-deckobj',
      deckObjectSchemaVersion: 'topdeck-deckobj-id-count-v15.1',
    },
  };
}

function snapshot(
  availableAt = '2026-08-20T09:45:00.000Z',
  cardDataObservedAt = '2026-08-20T09:00:00.000Z',
): ProvenancedDeckFeatureSnapshotV15 {
  return {
    deckFingerprint,
    commanderNames: ['Test Commander'],
    availableAt,
    cardDataObservedAt,
  } as unknown as ProvenancedDeckFeatureSnapshotV15;
}

function deckEvidence(observedAt = '2026-08-20T09:30:00.000Z'): TopDeckPreEventDecklistEvidenceV15 {
  return {
    schemaVersion: 'topdeck-pre-event-decklist-evidence-v15.1',
    sourceId: 'topdeck',
    providerEventId: 'event-1',
    providerPlayerId: 'player-1',
    providerRecordId: 'event-1:standing:player-1',
    sourceUri: 'https://topdeck.gg/api/v2/tournaments/event-1/standings',
    sourceContentHash: topDeckDecklistEvidenceContentHashV15(decklist),
    deckFingerprint,
    observedAt,
    retrievedAt: observedAt,
    method: 'contemporaneous-rest-decklist-capture',
  };
}

function eventEndEvidence(
  observedAt = '2026-08-20T18:05:00.000Z',
  endedAt = '2026-08-20T18:00:00.000Z',
): TopDeckEventEndEvidenceV15 {
  return {
    schemaVersion: 'topdeck-event-end-evidence-v15.1',
    sourceId: 'topdeck',
    providerEventId: 'event-1',
    sourceUri: 'https://topdeck.gg/api/v2/tournaments/event-1/info',
    sourceContentHash: 'a'.repeat(64),
    eventStartedAt: '2026-08-20T10:00:00.000Z',
    eventEndedAt: endedAt,
    observedAt,
    retrievedAt: observedAt,
    providerStatus: 'Complete',
    method: 'provider-info-end-date-capture',
  };
}

test('pre-event decklist + card data + provider event end qualifies the row for promotion-grade training', () => {
  const result = assessTopDeckPromotionGradeEvidenceV15({
    candidate: candidate(),
    snapshot: snapshot(),
    decklistEvidence: deckEvidence(),
    eventEndEvidence: eventEndEvidence(),
  });

  assert.equal(result.eligibleForPromotionGradeTraining, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.predictionCutoff, '2026-08-20T10:00:00.000Z');
  assert.equal(result.outcomeOccurredAt, '2026-08-20T18:00:00.000Z');
  assert.equal(result.safeguards.noPredictorEvidenceAfterEventStart, true);
});

test('completed-event decklist first observed after tournament start cannot be backdated into a pre-event predictor', () => {
  const result = assessTopDeckPromotionGradeEvidenceV15({
    candidate: candidate(),
    snapshot: snapshot('2026-08-20T09:45:00.000Z'),
    decklistEvidence: deckEvidence('2026-08-20T18:05:00.000Z'),
    eventEndEvidence: eventEndEvidence(),
  });

  assert.equal(result.eligibleForPromotionGradeTraining, false);
  assert.equal(result.safeguards.decklistObservedByEventStart, false);
  assert.equal(result.safeguards.decklistObservedBySnapshot, false);
  assert.match(result.reasons.join(' '), /first observed after tournament start/i);
});

test('feature snapshot cannot claim availability before the exact decklist was observed', () => {
  const result = assessTopDeckPromotionGradeEvidenceV15({
    candidate: candidate(),
    snapshot: snapshot('2026-08-20T09:15:00.000Z'),
    decklistEvidence: deckEvidence('2026-08-20T09:30:00.000Z'),
    eventEndEvidence: eventEndEvidence(),
  });

  assert.equal(result.eligibleForPromotionGradeTraining, false);
  assert.equal(result.safeguards.decklistObservedBySnapshot, false);
  assert.match(result.reasons.join(' '), /decklist was observed after the claimed feature snapshot/i);
});

test('feature snapshot cannot claim availability before card data was captured', () => {
  const result = assessTopDeckPromotionGradeEvidenceV15({
    candidate: candidate(),
    snapshot: snapshot('2026-08-20T09:15:00.000Z', '2026-08-20T09:30:00.000Z'),
    decklistEvidence: deckEvidence('2026-08-20T09:00:00.000Z'),
    eventEndEvidence: eventEndEvidence(),
  });

  assert.equal(result.eligibleForPromotionGradeTraining, false);
  assert.equal(result.safeguards.cardDataObservedBySnapshot, false);
});

test('mismatched deck fingerprint is rejected even if timestamps look safe', () => {
  const evidence = { ...deckEvidence(), deckFingerprint: 'b'.repeat(64) };
  const result = assessTopDeckPromotionGradeEvidenceV15({
    candidate: candidate(),
    snapshot: snapshot(),
    decklistEvidence: evidence,
    eventEndEvidence: eventEndEvidence(),
  });

  assert.equal(result.eligibleForPromotionGradeTraining, false);
  assert.equal(result.safeguards.exactDeckIdentityBound, false);
});

test('mismatched provider identities are rejected', () => {
  const evidence = { ...deckEvidence(), providerPlayerId: 'other-player' };
  const result = assessTopDeckPromotionGradeEvidenceV15({
    candidate: candidate(),
    snapshot: snapshot(),
    decklistEvidence: evidence,
    eventEndEvidence: eventEndEvidence(),
  });

  assert.equal(result.eligibleForPromotionGradeTraining, false);
  assert.equal(result.safeguards.providerIdentitiesBound, false);
});

test('provider startDate disagreement is rejected rather than silently changing the prediction cutoff', () => {
  const timing = { ...eventEndEvidence(), eventStartedAt: '2026-08-20T10:05:00.000Z' };
  const result = assessTopDeckPromotionGradeEvidenceV15({
    candidate: candidate(),
    snapshot: snapshot(),
    decklistEvidence: deckEvidence(),
    eventEndEvidence: timing,
  });

  assert.equal(result.eligibleForPromotionGradeTraining, false);
  assert.match(result.reasons.join(' '), /start timestamp disagrees/i);
});

test('final outcome evidence must be observed no earlier than provider-verified event end', () => {
  const result = assessTopDeckPromotionGradeEvidenceV15({
    candidate: candidate(),
    snapshot: snapshot(),
    decklistEvidence: deckEvidence(),
    eventEndEvidence: eventEndEvidence('2026-08-20T17:59:00.000Z'),
  });

  assert.equal(result.eligibleForPromotionGradeTraining, false);
  assert.equal(result.safeguards.outcomeEvidenceObservedNoEarlierThanEnd, false);
});

test('prepared promotion-grade candidate replaces legacy startDate outcome timestamp with provider event end', () => {
  const result = prepareTopDeckPromotionGradeInputV15({
    candidate: candidate(),
    snapshot: snapshot(),
    decklistEvidence: deckEvidence(),
    eventEndEvidence: eventEndEvidence(),
  });

  assert.equal(result.candidate.outcomeOccurredAt, '2026-08-20T18:00:00.000Z');
  assert.equal(result.candidate.metadata.eventStartAt, '2026-08-20T10:00:00.000Z');
  assert.equal(result.candidate.metadata.outcomeTimestampSource, 'provider-event-end-evidence');
  assert.equal(result.candidate.metadata.preEventDecklistObservedAt, '2026-08-20T09:30:00.000Z');
});
