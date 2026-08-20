import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessTopDeckHistoricalDeckLockEvidenceV15,
  type TopDeckArchivedEventPageDeadlineV15,
  type TopDeckHistoricalDeckLockExpectedIdentityV15,
  type TopDeckProviderVersionedLockRecordV15,
  type TopDeckRetrospectiveCurrentEventPageV15,
  type TopDeckSignedOrganizerLockExportV15,
} from './topdeck-historical-deck-lock-evidence-v15.js';

const DECK_HASH = 'a'.repeat(64);
const SOURCE_HASH = 'b'.repeat(64);

function expected(): TopDeckHistoricalDeckLockExpectedIdentityV15 {
  return {
    providerEventId: 'event-1',
    providerPlayerId: 'player-1',
    providerRecordId: 'event-1:standing:player-1',
    deckFingerprint: DECK_HASH,
    eventStartedAt: '2026-08-20T10:00:00.000Z',
  };
}

function providerRecord(overrides: Partial<TopDeckProviderVersionedLockRecordV15> = {}): TopDeckProviderVersionedLockRecordV15 {
  return {
    schemaVersion: 'topdeck-historical-deck-lock-evidence-v15.1',
    sourceId: 'topdeck',
    providerEventId: 'event-1',
    providerPlayerId: 'player-1',
    providerRecordId: 'event-1:standing:player-1',
    sourceUri: 'https://topdeck.gg/api/audit/event-1/player-1/deck-lock/v17',
    sourceContentHash: SOURCE_HASH,
    deckFingerprint: DECK_HASH,
    lockEffectiveAt: '2026-08-20T09:00:00.000Z',
    providerRecordedAt: '2026-08-20T09:00:01.000Z',
    retrievedAt: '2026-08-22T12:00:00.000Z',
    versionId: 'deck-lock-v17',
    method: 'provider-versioned-lock-record',
    ...overrides,
  };
}

function signedExport(overrides: Partial<TopDeckSignedOrganizerLockExportV15> = {}): TopDeckSignedOrganizerLockExportV15 {
  return {
    schemaVersion: 'topdeck-historical-deck-lock-evidence-v15.1',
    sourceId: 'topdeck',
    providerEventId: 'event-1',
    providerPlayerId: 'player-1',
    providerRecordId: 'event-1:standing:player-1',
    sourceUri: 'https://topdeck.gg/exports/event-1/deck-locks/player-1.json',
    sourceContentHash: SOURCE_HASH,
    deckFingerprint: DECK_HASH,
    lockEffectiveAt: '2026-08-20T09:00:00.000Z',
    attestationCreatedAt: '2026-08-20T09:00:01.000Z',
    retrievedAt: '2026-08-22T12:00:00.000Z',
    signatureAlgorithm: 'ed25519',
    signerKeyFingerprint: 'c'.repeat(64),
    method: 'signed-organizer-lock-export',
    ...overrides,
  };
}

test('later retrieval of a provider-versioned exact deck lock can qualify when the provider recorded it before event start', () => {
  const result = assessTopDeckHistoricalDeckLockEvidenceV15(providerRecord(), expected());

  assert.equal(result.eligibleForPromotionGradeDeckReconstruction, true);
  assert.equal(result.evidenceClass, 'exact-deck-lock');
  assert.equal(result.sourceDataAvailableAt, '2026-08-20T09:00:01.000Z');
  assert.equal(result.deckStateEffectiveAt, '2026-08-20T09:00:00.000Z');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.safeguards.exactDeckIdentityBound, true);
  assert.equal(result.safeguards.providerIdentitiesBound, true);
});

test('a deck lock that becomes effective after event start is not promotion-grade', () => {
  const result = assessTopDeckHistoricalDeckLockEvidenceV15(providerRecord({
    lockEffectiveAt: '2026-08-20T10:05:00.000Z',
    providerRecordedAt: '2026-08-20T10:05:01.000Z',
  }), expected());

  assert.equal(result.eligibleForPromotionGradeDeckReconstruction, false);
  assert.equal(result.safeguards.lockEffectiveByEventStart, false);
  assert.match(result.reasons.join(' '), /lock became effective after tournament start/i);
});

test('a post-start provider record cannot retrospectively bless an earlier claimed lock', () => {
  const result = assessTopDeckHistoricalDeckLockEvidenceV15(providerRecord({
    providerRecordedAt: '2026-08-20T10:05:00.000Z',
  }), expected());

  assert.equal(result.eligibleForPromotionGradeDeckReconstruction, false);
  assert.equal(result.safeguards.attestationRecordedByEventStart, false);
  assert.match(result.reasons.join(' '), /first recorded after tournament start/i);
});

test('provider lock record must bind the exact final deck fingerprint', () => {
  const result = assessTopDeckHistoricalDeckLockEvidenceV15(providerRecord({
    deckFingerprint: 'd'.repeat(64),
  }), expected());

  assert.equal(result.eligibleForPromotionGradeDeckReconstruction, false);
  assert.equal(result.safeguards.exactDeckIdentityBound, false);
});

test('provider lock record must bind event, player and provider record identity', () => {
  const result = assessTopDeckHistoricalDeckLockEvidenceV15(providerRecord({
    providerPlayerId: 'player-2',
  }), expected());

  assert.equal(result.eligibleForPromotionGradeDeckReconstruction, false);
  assert.equal(result.safeguards.providerIdentitiesBound, false);
});

test('pre-event signed exact-deck lock export can qualify even when retrieved later', () => {
  const result = assessTopDeckHistoricalDeckLockEvidenceV15(signedExport(), expected());

  assert.equal(result.eligibleForPromotionGradeDeckReconstruction, true);
  assert.equal(result.evidenceClass, 'exact-deck-lock');
  assert.equal(result.safeguards.attestationRecordedByEventStart, true);
});

test('post-event signed statement is retrospective even if it claims an earlier lock', () => {
  const result = assessTopDeckHistoricalDeckLockEvidenceV15(signedExport({
    attestationCreatedAt: '2026-08-20T18:05:00.000Z',
    retrievedAt: '2026-08-20T18:06:00.000Z',
  }), expected());

  assert.equal(result.eligibleForPromotionGradeDeckReconstruction, false);
  assert.equal(result.safeguards.attestationRecordedByEventStart, false);
});

test('archived event deadline is policy evidence only and cannot prove a specific final deck was locked', () => {
  const evidence: TopDeckArchivedEventPageDeadlineV15 = {
    schemaVersion: 'topdeck-historical-deck-lock-evidence-v15.1',
    sourceId: 'topdeck',
    providerEventId: 'event-1',
    sourceUri: 'https://web.archive.org/web/20260820080000/https://topdeck.gg/event/event-1',
    sourceContentHash: SOURCE_HASH,
    deadlineAt: '2026-08-20T09:00:00.000Z',
    archivePublishedAt: '2026-08-20T08:00:00.000Z',
    retrievedAt: '2026-08-22T12:00:00.000Z',
    archiveVersion: '20260820080000',
    method: 'archived-event-page-deadline',
  };
  const result = assessTopDeckHistoricalDeckLockEvidenceV15(evidence, expected());

  assert.equal(result.evidenceClass, 'event-policy-only');
  assert.equal(result.eligibleForPromotionGradeDeckReconstruction, false);
  assert.equal(result.safeguards.exactDeckIdentityBound, false);
  assert.match(result.reasons.join(' '), /does not prove that this exact player deck/i);
});

test('current retrospective event page is always advisory and cannot be backdated', () => {
  const evidence: TopDeckRetrospectiveCurrentEventPageV15 = {
    schemaVersion: 'topdeck-historical-deck-lock-evidence-v15.1',
    sourceId: 'topdeck',
    providerEventId: 'event-1',
    sourceUri: 'https://topdeck.gg/event/event-1',
    sourceContentHash: SOURCE_HASH,
    claimedDeadlineAt: '2026-08-20T09:00:00.000Z',
    retrievedAt: '2026-08-22T12:00:00.000Z',
    method: 'retrospective-current-event-page',
  };
  const result = assessTopDeckHistoricalDeckLockEvidenceV15(evidence, expected());

  assert.equal(result.evidenceClass, 'retrospective-advisory');
  assert.equal(result.eligibleForPromotionGradeDeckReconstruction, false);
  assert.equal(result.safeguards.notRetrospectiveCurrentText, false);
});

test('retrieval cannot precede the provider lock record it claims to retrieve', () => {
  assert.throws(
    () => assessTopDeckHistoricalDeckLockEvidenceV15(providerRecord({
      retrievedAt: '2026-08-20T08:59:00.000Z',
    }), expected()),
    /retrievedAt cannot occur before providerRecordedAt/i,
  );
});

test('malformed content hashes fail closed', () => {
  assert.throws(
    () => assessTopDeckHistoricalDeckLockEvidenceV15(providerRecord({ sourceContentHash: 'not-a-hash' }), expected()),
    /SHA-256/i,
  );
});
