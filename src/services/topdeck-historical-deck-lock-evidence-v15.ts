export const TOPDECK_HISTORICAL_DECK_LOCK_EVIDENCE_SCHEMA_V15 = 'topdeck-historical-deck-lock-evidence-v15.1' as const;

export type TopDeckHistoricalDeckLockEvidenceMethodV15 =
  | 'provider-versioned-lock-record'
  | 'signed-organizer-lock-export'
  | 'archived-event-page-deadline'
  | 'retrospective-current-event-page';

interface TopDeckHistoricalDeckLockEvidenceBaseV15 {
  schemaVersion: typeof TOPDECK_HISTORICAL_DECK_LOCK_EVIDENCE_SCHEMA_V15;
  sourceId: 'topdeck';
  providerEventId: string;
  sourceUri: string;
  sourceContentHash: string;
  retrievedAt: string;
}

/**
 * A provider-owned versioned record that binds one exact deck to one player/row
 * and proves that the provider recorded the deck as locked before play began.
 * Retrieval may happen later, but the provider record itself must have existed by
 * tournament start.
 */
export interface TopDeckProviderVersionedLockRecordV15 extends TopDeckHistoricalDeckLockEvidenceBaseV15 {
  method: 'provider-versioned-lock-record';
  providerPlayerId: string;
  providerRecordId: string;
  deckFingerprint: string;
  lockEffectiveAt: string;
  providerRecordedAt: string;
  versionId: string;
}

/**
 * A signed organizer/provider export can also bind the exact immutable deck, but
 * only when the attestation itself was created before play. A post-event signed
 * statement is still retrospective and therefore cannot qualify.
 */
export interface TopDeckSignedOrganizerLockExportV15 extends TopDeckHistoricalDeckLockEvidenceBaseV15 {
  method: 'signed-organizer-lock-export';
  providerPlayerId: string;
  providerRecordId: string;
  deckFingerprint: string;
  lockEffectiveAt: string;
  attestationCreatedAt: string;
  signatureAlgorithm: 'ed25519' | 'ecdsa-p256-sha256';
  signerKeyFingerprint: string;
}

/**
 * An independently archived event page can prove event policy/deadline timing,
 * but not that a particular player's exact final deck was submitted and locked by
 * that deadline. This evidence is useful for audit/research only.
 */
export interface TopDeckArchivedEventPageDeadlineV15 extends TopDeckHistoricalDeckLockEvidenceBaseV15 {
  method: 'archived-event-page-deadline';
  deadlineAt: string;
  archivePublishedAt: string;
  archiveVersion: string;
}

/**
 * A page fetched today may describe an old deadline, but current retrospective
 * text is not historical proof and must never be backdated into predictor state.
 */
export interface TopDeckRetrospectiveCurrentEventPageV15 extends TopDeckHistoricalDeckLockEvidenceBaseV15 {
  method: 'retrospective-current-event-page';
  claimedDeadlineAt: string;
}

export type TopDeckHistoricalDeckLockEvidenceV15 =
  | TopDeckProviderVersionedLockRecordV15
  | TopDeckSignedOrganizerLockExportV15
  | TopDeckArchivedEventPageDeadlineV15
  | TopDeckRetrospectiveCurrentEventPageV15;

export interface TopDeckHistoricalDeckLockExpectedIdentityV15 {
  providerEventId: string;
  providerPlayerId: string;
  providerRecordId: string;
  deckFingerprint: string;
  eventStartedAt: string;
}

export interface TopDeckHistoricalDeckLockAssessmentV15 {
  schemaVersion: typeof TOPDECK_HISTORICAL_DECK_LOCK_EVIDENCE_SCHEMA_V15;
  method: TopDeckHistoricalDeckLockEvidenceMethodV15;
  evidenceClass: 'exact-deck-lock' | 'event-policy-only' | 'retrospective-advisory';
  eligibleForPromotionGradeDeckReconstruction: boolean;
  sourceId: 'topdeck';
  sourceUri: string;
  sourceContentHash: string;
  sourceDataAvailableAt: string;
  deckStateEffectiveAt: string | null;
  retrievedAt: string;
  safeguards: {
    exactDeckIdentityBound: boolean;
    providerIdentitiesBound: boolean;
    lockEffectiveByEventStart: boolean;
    attestationRecordedByEventStart: boolean;
    retrievalNotBeforeAttestation: boolean;
    immutableSourceIdentityBound: boolean;
    notRetrospectiveCurrentText: boolean;
  };
  reasons: string[];
}

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function timestamp(name: string, value: unknown): { iso: string; ms: number } {
  const text = required(name, value);
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function httpsUrl(name: string, value: unknown): string {
  const text = required(name, value);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${name} must be an absolute HTTPS URL.`);
  return parsed.toString();
}

function sha256(name: string, value: unknown): string {
  const text = required(name, value).toLocaleLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${name} must be a SHA-256 hex digest.`);
  return text;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function addReason(reasons: string[], condition: boolean, reason: string): boolean {
  if (!condition) reasons.push(reason);
  return condition;
}

function validateBase(evidence: TopDeckHistoricalDeckLockEvidenceV15): {
  sourceUri: string;
  sourceContentHash: string;
  retrievedAt: { iso: string; ms: number };
} {
  if (!evidence || typeof evidence !== 'object') throw new Error('TopDeck historical deck-lock evidence must be an object.');
  if (evidence.schemaVersion !== TOPDECK_HISTORICAL_DECK_LOCK_EVIDENCE_SCHEMA_V15) {
    throw new Error('Unsupported TopDeck historical deck-lock evidence schema.');
  }
  if (evidence.sourceId !== 'topdeck') throw new Error('Historical deck-lock evidence sourceId must be topdeck.');
  required('evidence.providerEventId', evidence.providerEventId);
  return {
    sourceUri: httpsUrl('evidence.sourceUri', evidence.sourceUri),
    sourceContentHash: sha256('evidence.sourceContentHash', evidence.sourceContentHash),
    retrievedAt: timestamp('evidence.retrievedAt', evidence.retrievedAt),
  };
}

function validateExpected(expected: TopDeckHistoricalDeckLockExpectedIdentityV15) {
  if (!expected || typeof expected !== 'object') throw new Error('Expected historical deck identity must be an object.');
  return {
    providerEventId: required('expected.providerEventId', expected.providerEventId),
    providerPlayerId: required('expected.providerPlayerId', expected.providerPlayerId),
    providerRecordId: required('expected.providerRecordId', expected.providerRecordId),
    deckFingerprint: sha256('expected.deckFingerprint', expected.deckFingerprint),
    eventStartedAt: timestamp('expected.eventStartedAt', expected.eventStartedAt),
  };
}

/**
 * Assesses whether a later-retrieved TopDeck artifact can safely reconstruct the
 * exact deck state that existed before an event started.
 *
 * This is intentionally stricter than proving that an event merely had a decklist
 * deadline. Promotion-grade reconstruction requires a source record that binds the
 * exact deck fingerprint, player, provider row, and event, plus a provider/signed
 * attestation that itself existed by tournament start. Current retrospective text
 * and deadline-only pages are never enough.
 */
export function assessTopDeckHistoricalDeckLockEvidenceV15(
  evidence: TopDeckHistoricalDeckLockEvidenceV15,
  expectedIdentity: TopDeckHistoricalDeckLockExpectedIdentityV15,
): TopDeckHistoricalDeckLockAssessmentV15 {
  const base = validateBase(evidence);
  const expected = validateExpected(expectedIdentity);
  const eventMatches = normalize(evidence.providerEventId) === normalize(expected.providerEventId);
  const reasons: string[] = [];

  if (evidence.method === 'provider-versioned-lock-record') {
    const playerId = required('evidence.providerPlayerId', evidence.providerPlayerId);
    const recordId = required('evidence.providerRecordId', evidence.providerRecordId);
    const deckFingerprint = sha256('evidence.deckFingerprint', evidence.deckFingerprint);
    const lockEffectiveAt = timestamp('evidence.lockEffectiveAt', evidence.lockEffectiveAt);
    const recordedAt = timestamp('evidence.providerRecordedAt', evidence.providerRecordedAt);
    required('evidence.versionId', evidence.versionId);
    if (recordedAt.ms < lockEffectiveAt.ms) {
      throw new Error('providerRecordedAt cannot occur before lockEffectiveAt.');
    }
    if (base.retrievedAt.ms < recordedAt.ms) {
      throw new Error('retrievedAt cannot occur before providerRecordedAt.');
    }

    const exactDeckIdentityBound = addReason(
      reasons,
      deckFingerprint === expected.deckFingerprint,
      'Provider lock record does not bind the exact final deck fingerprint.',
    );
    const providerIdentitiesBound = addReason(
      reasons,
      eventMatches
        && normalize(playerId) === normalize(expected.providerPlayerId)
        && normalize(recordId) === normalize(expected.providerRecordId),
      'Provider lock record event/player/record identity does not match the candidate.',
    );
    const lockEffectiveByEventStart = addReason(
      reasons,
      lockEffectiveAt.ms <= expected.eventStartedAt.ms,
      'Provider deck lock became effective after tournament start.',
    );
    const attestationRecordedByEventStart = addReason(
      reasons,
      recordedAt.ms <= expected.eventStartedAt.ms,
      'Provider lock record was first recorded after tournament start and is retrospective.',
    );

    return {
      schemaVersion: TOPDECK_HISTORICAL_DECK_LOCK_EVIDENCE_SCHEMA_V15,
      method: evidence.method,
      evidenceClass: 'exact-deck-lock',
      eligibleForPromotionGradeDeckReconstruction: reasons.length === 0,
      sourceId: 'topdeck',
      sourceUri: base.sourceUri,
      sourceContentHash: base.sourceContentHash,
      sourceDataAvailableAt: recordedAt.iso,
      deckStateEffectiveAt: lockEffectiveAt.iso,
      retrievedAt: base.retrievedAt.iso,
      safeguards: {
        exactDeckIdentityBound,
        providerIdentitiesBound,
        lockEffectiveByEventStart,
        attestationRecordedByEventStart,
        retrievalNotBeforeAttestation: true,
        immutableSourceIdentityBound: true,
        notRetrospectiveCurrentText: true,
      },
      reasons,
    };
  }

  if (evidence.method === 'signed-organizer-lock-export') {
    const playerId = required('evidence.providerPlayerId', evidence.providerPlayerId);
    const recordId = required('evidence.providerRecordId', evidence.providerRecordId);
    const deckFingerprint = sha256('evidence.deckFingerprint', evidence.deckFingerprint);
    const lockEffectiveAt = timestamp('evidence.lockEffectiveAt', evidence.lockEffectiveAt);
    const attestationCreatedAt = timestamp('evidence.attestationCreatedAt', evidence.attestationCreatedAt);
    const signerKeyFingerprint = sha256('evidence.signerKeyFingerprint', evidence.signerKeyFingerprint);
    if (evidence.signatureAlgorithm !== 'ed25519' && evidence.signatureAlgorithm !== 'ecdsa-p256-sha256') {
      throw new Error('Unsupported signed organizer lock-export algorithm.');
    }
    if (!signerKeyFingerprint) throw new Error('Signed organizer lock export must bind a signer key fingerprint.');
    if (attestationCreatedAt.ms < lockEffectiveAt.ms) {
      throw new Error('attestationCreatedAt cannot occur before lockEffectiveAt.');
    }
    if (base.retrievedAt.ms < attestationCreatedAt.ms) {
      throw new Error('retrievedAt cannot occur before attestationCreatedAt.');
    }

    const exactDeckIdentityBound = addReason(
      reasons,
      deckFingerprint === expected.deckFingerprint,
      'Signed lock export does not bind the exact final deck fingerprint.',
    );
    const providerIdentitiesBound = addReason(
      reasons,
      eventMatches
        && normalize(playerId) === normalize(expected.providerPlayerId)
        && normalize(recordId) === normalize(expected.providerRecordId),
      'Signed lock export event/player/record identity does not match the candidate.',
    );
    const lockEffectiveByEventStart = addReason(
      reasons,
      lockEffectiveAt.ms <= expected.eventStartedAt.ms,
      'Signed deck lock became effective after tournament start.',
    );
    const attestationRecordedByEventStart = addReason(
      reasons,
      attestationCreatedAt.ms <= expected.eventStartedAt.ms,
      'Signed lock attestation was created after tournament start and is retrospective.',
    );

    return {
      schemaVersion: TOPDECK_HISTORICAL_DECK_LOCK_EVIDENCE_SCHEMA_V15,
      method: evidence.method,
      evidenceClass: 'exact-deck-lock',
      eligibleForPromotionGradeDeckReconstruction: reasons.length === 0,
      sourceId: 'topdeck',
      sourceUri: base.sourceUri,
      sourceContentHash: base.sourceContentHash,
      sourceDataAvailableAt: attestationCreatedAt.iso,
      deckStateEffectiveAt: lockEffectiveAt.iso,
      retrievedAt: base.retrievedAt.iso,
      safeguards: {
        exactDeckIdentityBound,
        providerIdentitiesBound,
        lockEffectiveByEventStart,
        attestationRecordedByEventStart,
        retrievalNotBeforeAttestation: true,
        immutableSourceIdentityBound: true,
        notRetrospectiveCurrentText: true,
      },
      reasons,
    };
  }

  if (evidence.method === 'archived-event-page-deadline') {
    const deadlineAt = timestamp('evidence.deadlineAt', evidence.deadlineAt);
    const publishedAt = timestamp('evidence.archivePublishedAt', evidence.archivePublishedAt);
    required('evidence.archiveVersion', evidence.archiveVersion);
    if (base.retrievedAt.ms < publishedAt.ms) throw new Error('retrievedAt cannot occur before archivePublishedAt.');
    addReason(reasons, eventMatches, 'Archived event page does not match the candidate event.');
    addReason(reasons, deadlineAt.ms <= expected.eventStartedAt.ms, 'Archived event deadline occurs after tournament start.');
    addReason(reasons, publishedAt.ms <= expected.eventStartedAt.ms, 'Archived event page was first archived after tournament start.');
    reasons.push('Event-level deadline evidence does not prove that this exact player deck was submitted and immutable by the deadline.');

    return {
      schemaVersion: TOPDECK_HISTORICAL_DECK_LOCK_EVIDENCE_SCHEMA_V15,
      method: evidence.method,
      evidenceClass: 'event-policy-only',
      eligibleForPromotionGradeDeckReconstruction: false,
      sourceId: 'topdeck',
      sourceUri: base.sourceUri,
      sourceContentHash: base.sourceContentHash,
      sourceDataAvailableAt: publishedAt.iso,
      deckStateEffectiveAt: deadlineAt.iso,
      retrievedAt: base.retrievedAt.iso,
      safeguards: {
        exactDeckIdentityBound: false,
        providerIdentitiesBound: false,
        lockEffectiveByEventStart: deadlineAt.ms <= expected.eventStartedAt.ms,
        attestationRecordedByEventStart: publishedAt.ms <= expected.eventStartedAt.ms,
        retrievalNotBeforeAttestation: true,
        immutableSourceIdentityBound: true,
        notRetrospectiveCurrentText: true,
      },
      reasons,
    };
  }

  if (evidence.method === 'retrospective-current-event-page') {
    const claimedDeadlineAt = timestamp('evidence.claimedDeadlineAt', evidence.claimedDeadlineAt);
    addReason(reasons, eventMatches, 'Current event page does not match the candidate event.');
    reasons.push('Current retrospective event-page text cannot prove what exact deck state was fixed before the historical event.');

    return {
      schemaVersion: TOPDECK_HISTORICAL_DECK_LOCK_EVIDENCE_SCHEMA_V15,
      method: evidence.method,
      evidenceClass: 'retrospective-advisory',
      eligibleForPromotionGradeDeckReconstruction: false,
      sourceId: 'topdeck',
      sourceUri: base.sourceUri,
      sourceContentHash: base.sourceContentHash,
      sourceDataAvailableAt: base.retrievedAt.iso,
      deckStateEffectiveAt: claimedDeadlineAt.iso,
      retrievedAt: base.retrievedAt.iso,
      safeguards: {
        exactDeckIdentityBound: false,
        providerIdentitiesBound: false,
        lockEffectiveByEventStart: claimedDeadlineAt.ms <= expected.eventStartedAt.ms,
        attestationRecordedByEventStart: false,
        retrievalNotBeforeAttestation: true,
        immutableSourceIdentityBound: false,
        notRetrospectiveCurrentText: false,
      },
      reasons,
    };
  }

  const exhaustive: never = evidence;
  throw new Error(`Unsupported TopDeck historical deck-lock evidence method: ${String(exhaustive)}.`);
}
