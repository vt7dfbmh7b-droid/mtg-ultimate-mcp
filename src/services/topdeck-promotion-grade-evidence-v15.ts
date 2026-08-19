import { createHash } from 'node:crypto';
import type { ProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import {
  materializeTopDeckRealCorpusV15,
  type TopDeckRealCorpusMaterializationV15,
} from './topdeck-real-corpus-materializer-v15.js';

export const TOPDECK_PROMOTION_GRADE_EVIDENCE_SCHEMA_V15 = 'topdeck-promotion-grade-evidence-v15.1' as const;
export const TOPDECK_PROMOTION_GRADE_DECKLIST_SCHEMA_V15 = 'topdeck-pre-event-decklist-evidence-v15.1' as const;
export const TOPDECK_PROMOTION_GRADE_OUTCOME_TIMING_SCHEMA_V15 = 'topdeck-event-end-evidence-v15.1' as const;

export interface TopDeckPreEventDecklistEvidenceV15 {
  schemaVersion: typeof TOPDECK_PROMOTION_GRADE_DECKLIST_SCHEMA_V15;
  sourceId: 'topdeck';
  providerEventId: string;
  providerPlayerId: string;
  providerRecordId: string;
  sourceUri: string;
  sourceContentHash: string;
  deckFingerprint: string;
  observedAt: string;
  retrievedAt: string;
  method: 'contemporaneous-rest-decklist-capture';
}

export interface TopDeckEventEndEvidenceV15 {
  schemaVersion: typeof TOPDECK_PROMOTION_GRADE_OUTCOME_TIMING_SCHEMA_V15;
  sourceId: 'topdeck';
  providerEventId: string;
  sourceUri: string;
  sourceContentHash: string;
  eventStartedAt: string;
  eventEndedAt: string;
  observedAt: string;
  retrievedAt: string;
  providerStatus: 'Complete';
  method: 'provider-info-end-date-capture' | 'signed-tournament-finished-event';
}

export interface TopDeckPromotionGradeEvidenceAssessmentV15 {
  schemaVersion: typeof TOPDECK_PROMOTION_GRADE_EVIDENCE_SCHEMA_V15;
  eligibleForPromotionGradeTraining: boolean;
  predictionCutoff: string;
  outcomeOccurredAt: string;
  decklistObservedAt: string;
  cardDataObservedAt: string;
  snapshotAvailableAt: string;
  outcomeEvidenceObservedAt: string;
  safeguards: {
    exactDeckIdentityBound: boolean;
    providerIdentitiesBound: boolean;
    decklistObservedByEventStart: boolean;
    cardDataObservedBySnapshot: boolean;
    decklistObservedBySnapshot: boolean;
    snapshotAvailableByEventStart: boolean;
    eventEndAfterStart: boolean;
    outcomeEvidenceObservedNoEarlierThanEnd: boolean;
    noPredictorEvidenceAfterEventStart: boolean;
  };
  reasons: string[];
}

export interface TopDeckPromotionGradeLearningCandidateV15 extends TopDeckLearningCandidateV15 {
  metadata: TopDeckLearningCandidateV15['metadata'] & {
    eventStartAt: string;
    outcomeTimestampSource: 'provider-event-end-evidence';
    preEventDecklistObservedAt: string;
    preEventDecklistSourceContentHash: string;
    eventEndEvidenceSourceContentHash: string;
  };
}

export interface TopDeckPromotionGradeSnapshotInputV15 {
  candidate: TopDeckLearningCandidateV15;
  snapshot: ProvenancedDeckFeatureSnapshotV15;
  decklistEvidence: TopDeckPreEventDecklistEvidenceV15;
  eventEndEvidence: TopDeckEventEndEvidenceV15;
}

export interface TopDeckPromotionGradePreparedInputV15 {
  candidate: TopDeckPromotionGradeLearningCandidateV15;
  snapshot: ProvenancedDeckFeatureSnapshotV15;
  assessment: TopDeckPromotionGradeEvidenceAssessmentV15;
}

export interface TopDeckPromotionGradeRealCorpusMaterializationV15 {
  schemaVersion: 'topdeck-promotion-grade-real-corpus-v15.1';
  evidenceAssessments: TopDeckPromotionGradeEvidenceAssessmentV15[];
  materialization: TopDeckRealCorpusMaterializationV15;
  safeguards: readonly [
    'Exact decklists must be independently observed no later than tournament start.',
    'Card data and decklist evidence must both exist no later than the feature snapshot timestamp.',
    'Feature snapshots must be available no later than tournament start.',
    'Final top-cut outcomes become temporally valid only at provider-verified tournament end.',
    'Completed-event decklists first observed after tournament start cannot be backdated into promotion-grade predictors.'
  ];
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

function absoluteHttpsUrl(name: string, value: unknown): string {
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

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function addReason(reasons: string[], condition: boolean, reason: string): boolean {
  if (!condition) reasons.push(reason);
  return condition;
}

function validateDecklistEvidenceShape(evidence: TopDeckPreEventDecklistEvidenceV15): void {
  if (!evidence || typeof evidence !== 'object') throw new Error('decklistEvidence must be an object.');
  if (evidence.schemaVersion !== TOPDECK_PROMOTION_GRADE_DECKLIST_SCHEMA_V15) throw new Error('Unsupported TopDeck pre-event decklist evidence schema.');
  if (evidence.sourceId !== 'topdeck') throw new Error('TopDeck decklist evidence sourceId must be topdeck.');
  if (evidence.method !== 'contemporaneous-rest-decklist-capture') throw new Error('TopDeck promotion-grade decklist evidence must be a contemporaneous REST capture.');
  required('decklistEvidence.providerEventId', evidence.providerEventId);
  required('decklistEvidence.providerPlayerId', evidence.providerPlayerId);
  required('decklistEvidence.providerRecordId', evidence.providerRecordId);
  absoluteHttpsUrl('decklistEvidence.sourceUri', evidence.sourceUri);
  sha256('decklistEvidence.sourceContentHash', evidence.sourceContentHash);
  sha256('decklistEvidence.deckFingerprint', evidence.deckFingerprint);
  const observed = timestamp('decklistEvidence.observedAt', evidence.observedAt);
  const retrieved = timestamp('decklistEvidence.retrievedAt', evidence.retrievedAt);
  if (retrieved.ms < observed.ms) throw new Error('TopDeck decklist evidence retrievedAt cannot occur before observedAt.');
}

function validateEventEndEvidenceShape(evidence: TopDeckEventEndEvidenceV15): void {
  if (!evidence || typeof evidence !== 'object') throw new Error('eventEndEvidence must be an object.');
  if (evidence.schemaVersion !== TOPDECK_PROMOTION_GRADE_OUTCOME_TIMING_SCHEMA_V15) throw new Error('Unsupported TopDeck event-end evidence schema.');
  if (evidence.sourceId !== 'topdeck') throw new Error('TopDeck event-end evidence sourceId must be topdeck.');
  if (evidence.providerStatus !== 'Complete') throw new Error('TopDeck promotion-grade event-end evidence requires provider status Complete.');
  if (evidence.method !== 'provider-info-end-date-capture' && evidence.method !== 'signed-tournament-finished-event') {
    throw new Error('Unsupported TopDeck event-end evidence method.');
  }
  required('eventEndEvidence.providerEventId', evidence.providerEventId);
  absoluteHttpsUrl('eventEndEvidence.sourceUri', evidence.sourceUri);
  sha256('eventEndEvidence.sourceContentHash', evidence.sourceContentHash);
  const start = timestamp('eventEndEvidence.eventStartedAt', evidence.eventStartedAt);
  const end = timestamp('eventEndEvidence.eventEndedAt', evidence.eventEndedAt);
  const observed = timestamp('eventEndEvidence.observedAt', evidence.observedAt);
  const retrieved = timestamp('eventEndEvidence.retrievedAt', evidence.retrievedAt);
  if (end.ms < start.ms) throw new Error('TopDeck event end cannot occur before event start.');
  if (retrieved.ms < observed.ms) throw new Error('TopDeck event-end evidence retrievedAt cannot occur before observedAt.');
}

/**
 * Promotion-grade target for the current event-top-cut experiment is explicitly
 * pre-event: the exact deck plus all rich card facts must be observable by event
 * start, while the final result is not considered to have occurred until the
 * provider-verified event end.
 *
 * `candidate.outcomeOccurredAt` is treated here as the legacy bulk-adapter event
 * start timestamp. The prepared candidate replaces that legacy timestamp with the
 * independently proven event-end timestamp before strict corpus materialization.
 */
export function assessTopDeckPromotionGradeEvidenceV15(
  input: TopDeckPromotionGradeSnapshotInputV15,
): TopDeckPromotionGradeEvidenceAssessmentV15 {
  if (!input || typeof input !== 'object') throw new Error('TopDeck promotion-grade input must be an object.');
  const { candidate, snapshot, decklistEvidence, eventEndEvidence } = input;
  validateDecklistEvidenceShape(decklistEvidence);
  validateEventEndEvidenceShape(eventEndEvidence);

  const eventStart = timestamp('candidate.outcomeOccurredAt (legacy event start)', candidate.outcomeOccurredAt);
  const eventEvidenceStart = timestamp('eventEndEvidence.eventStartedAt', eventEndEvidence.eventStartedAt);
  const eventEnd = timestamp('eventEndEvidence.eventEndedAt', eventEndEvidence.eventEndedAt);
  const deckObserved = timestamp('decklistEvidence.observedAt', decklistEvidence.observedAt);
  const snapshotAt = timestamp('snapshot.availableAt', snapshot.availableAt);
  const cardDataObserved = timestamp('snapshot.cardDataObservedAt', snapshot.cardDataObservedAt);
  const outcomeEvidenceObserved = timestamp('eventEndEvidence.observedAt', eventEndEvidence.observedAt);
  const candidateDeckFingerprint = fingerprintExactDeckV15(candidate.decklist).toLocaleLowerCase();
  const snapshotDeckFingerprint = sha256('snapshot.deckFingerprint', snapshot.deckFingerprint);
  const evidenceDeckFingerprint = sha256('decklistEvidence.deckFingerprint', decklistEvidence.deckFingerprint);
  const reasons: string[] = [];

  const exactDeckIdentityBound = addReason(
    reasons,
    candidateDeckFingerprint === snapshotDeckFingerprint && candidateDeckFingerprint === evidenceDeckFingerprint,
    'Candidate, feature snapshot, and pre-event decklist evidence do not bind the same exact deck fingerprint.',
  );
  const providerIdentitiesBound = addReason(
    reasons,
    normalized(candidate.providerEventId) === normalized(decklistEvidence.providerEventId)
      && normalized(candidate.providerEventId) === normalized(eventEndEvidence.providerEventId)
      && normalized(candidate.providerPlayerId) === normalized(decklistEvidence.providerPlayerId)
      && normalized(candidate.providerRecordId) === normalized(decklistEvidence.providerRecordId),
    'TopDeck provider event/player/record identities do not match across candidate and predictor/target evidence.',
  );
  addReason(
    reasons,
    eventStart.ms === eventEvidenceStart.ms,
    'Legacy TopDeck candidate start timestamp disagrees with provider event-end evidence startDate.',
  );
  const decklistObservedByEventStart = addReason(
    reasons,
    deckObserved.ms <= eventStart.ms,
    'Exact TopDeck decklist was first observed after tournament start and cannot support a pre-event predictor.',
  );
  const cardDataObservedBySnapshot = addReason(
    reasons,
    cardDataObserved.ms <= snapshotAt.ms,
    'Card data was observed after the claimed feature snapshot availability time.',
  );
  const decklistObservedBySnapshot = addReason(
    reasons,
    deckObserved.ms <= snapshotAt.ms,
    'Exact decklist was observed after the claimed feature snapshot availability time.',
  );
  const snapshotAvailableByEventStart = addReason(
    reasons,
    snapshotAt.ms <= eventStart.ms,
    'Feature snapshot became available after tournament start and is not a pre-event predictor.',
  );
  const eventEndAfterStart = addReason(
    reasons,
    eventEnd.ms >= eventStart.ms,
    'Provider event end occurs before tournament start.',
  );
  const outcomeEvidenceObservedNoEarlierThanEnd = addReason(
    reasons,
    outcomeEvidenceObserved.ms >= eventEnd.ms,
    'Final-event outcome evidence claims observation before the provider-verified tournament end.',
  );
  const noPredictorEvidenceAfterEventStart = addReason(
    reasons,
    cardDataObserved.ms <= eventStart.ms && deckObserved.ms <= eventStart.ms && snapshotAt.ms <= eventStart.ms,
    'At least one predictor input became available after tournament start.',
  );

  return {
    schemaVersion: TOPDECK_PROMOTION_GRADE_EVIDENCE_SCHEMA_V15,
    eligibleForPromotionGradeTraining: reasons.length === 0,
    predictionCutoff: eventStart.iso,
    outcomeOccurredAt: eventEnd.iso,
    decklistObservedAt: deckObserved.iso,
    cardDataObservedAt: cardDataObserved.iso,
    snapshotAvailableAt: snapshotAt.iso,
    outcomeEvidenceObservedAt: outcomeEvidenceObserved.iso,
    safeguards: {
      exactDeckIdentityBound,
      providerIdentitiesBound,
      decklistObservedByEventStart,
      cardDataObservedBySnapshot,
      decklistObservedBySnapshot,
      snapshotAvailableByEventStart,
      eventEndAfterStart,
      outcomeEvidenceObservedNoEarlierThanEnd,
      noPredictorEvidenceAfterEventStart,
    },
    reasons,
  };
}

export function prepareTopDeckPromotionGradeInputV15(
  input: TopDeckPromotionGradeSnapshotInputV15,
): TopDeckPromotionGradePreparedInputV15 {
  const assessment = assessTopDeckPromotionGradeEvidenceV15(input);
  if (!assessment.eligibleForPromotionGradeTraining) {
    throw new Error(`TopDeck row is not promotion-grade: ${assessment.reasons.join(' ')}`);
  }
  const decklistHash = sha256('decklistEvidence.sourceContentHash', input.decklistEvidence.sourceContentHash);
  const eventEndHash = sha256('eventEndEvidence.sourceContentHash', input.eventEndEvidence.sourceContentHash);
  return {
    candidate: {
      ...input.candidate,
      outcomeOccurredAt: assessment.outcomeOccurredAt,
      metadata: {
        ...input.candidate.metadata,
        eventStartAt: assessment.predictionCutoff,
        outcomeTimestampSource: 'provider-event-end-evidence',
        preEventDecklistObservedAt: assessment.decklistObservedAt,
        preEventDecklistSourceContentHash: decklistHash,
        eventEndEvidenceSourceContentHash: eventEndHash,
      },
    },
    snapshot: input.snapshot,
    assessment,
  };
}

/**
 * Preferred strict materializer for any corpus that may later support a promotion
 * claim. Legacy real-corpus materialization remains available for audit/research,
 * but this boundary requires independent pre-event decklist evidence and provider
 * event-end evidence before delegating to it.
 */
export function materializeTopDeckPromotionGradeRealCorpusV15(
  inputs: TopDeckPromotionGradeSnapshotInputV15[],
  options: {
    sourceObservedAt: string;
    sourceRetrievedAt: string;
    holdoutFraction?: number;
    providerRejected?: number;
  },
): TopDeckPromotionGradeRealCorpusMaterializationV15 {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('At least one TopDeck promotion-grade input is required.');
  const prepared = inputs.map(prepareTopDeckPromotionGradeInputV15);
  const materialization = materializeTopDeckRealCorpusV15(
    prepared.map((entry) => ({ candidate: entry.candidate, snapshot: entry.snapshot })),
    options,
  );
  return {
    schemaVersion: 'topdeck-promotion-grade-real-corpus-v15.1',
    evidenceAssessments: prepared.map((entry) => entry.assessment),
    materialization,
    safeguards: [
      'Exact decklists must be independently observed no later than tournament start.',
      'Card data and decklist evidence must both exist no later than the feature snapshot timestamp.',
      'Feature snapshots must be available no later than tournament start.',
      'Final top-cut outcomes become temporally valid only at provider-verified tournament end.',
      'Completed-event decklists first observed after tournament start cannot be backdated into promotion-grade predictors.',
    ],
  };
}

export function topDeckDecklistEvidenceContentHashV15(decklist: string): string {
  return createHash('sha256').update(decklist, 'utf8').digest('hex');
}
