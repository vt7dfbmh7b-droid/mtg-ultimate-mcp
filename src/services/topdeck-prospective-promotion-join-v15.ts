import { extractDeckFeatureSnapshotFromScryfallForwardCaptureV15 } from './scryfall-forward-carddata-capture-v15.js';
import type { RetainedScryfallCardDataReplayV15 } from './retained-scryfall-carddata-replay-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import {
  prepareTopDeckPromotionGradeInputV15,
  type TopDeckPromotionGradePreparedInputV15,
} from './topdeck-promotion-grade-evidence-v15.js';
import type { TopDeckProspectivePreEventCaptureResultV15 } from './topdeck-prospective-capture-v15.js';
import type { TopDeckProspectiveCompletedCaptureV15 } from './topdeck-prospective-completed-capture-v15.js';

export const TOPDECK_PROSPECTIVE_PROMOTION_JOIN_SCHEMA_V15 = 'topdeck-prospective-promotion-join-v15.1' as const;

export type TopDeckProspectivePromotionJoinRejectionCodeV15 =
  | 'missing-pre-event-deck'
  | 'final-deck-changed'
  | 'predictor-carddata-too-late'
  | 'feature-snapshot-failed'
  | 'promotion-grade-evidence-failed';

export interface TopDeckProspectivePromotionJoinRejectionV15 {
  providerRecordId: string;
  code: TopDeckProspectivePromotionJoinRejectionCodeV15;
  reason: string;
}

export interface TopDeckProspectivePromotionJoinedRowV15 {
  providerRecordId: string;
  providerEventId: string;
  providerPlayerId: string;
  completedResponseContentHash: string;
  retainedCardDataManifestFingerprint: string;
  prepared: TopDeckPromotionGradePreparedInputV15;
}

export interface TopDeckProspectivePromotionJoinV15 {
  schemaVersion: typeof TOPDECK_PROSPECTIVE_PROMOTION_JOIN_SCHEMA_V15;
  providerEventId: string;
  predictionCutoff: string;
  eventEndedAt: string;
  featureAvailableAt: string;
  finalCandidates: number;
  joinedRows: TopDeckProspectivePromotionJoinedRowV15[];
  rejectedRows: TopDeckProspectivePromotionJoinRejectionV15[];
  safeguards: readonly [
    'Only a captured pre-event TopDeck deck can be joined to a final candidate.',
    'The final provider deck fingerprint must exactly match the pre-event fingerprint.',
    'Retained Scryfall card truth and the exact decklist must both be available no later than the feature snapshot.',
    'The feature snapshot must be available no later than provider tournament start.',
    'Final target timing comes from provider-verified event end, never legacy startDate.'
  ];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function timestamp(name: string, value: string): { iso: string; ms: number } {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function laterTimestamp(a: string, b: string): string {
  const left = timestamp('timestamp a', a);
  const right = timestamp('timestamp b', b);
  return left.ms >= right.ms ? left.iso : right.iso;
}

function sameEvent(expected: string, actual: string, context: string): void {
  if (normalize(expected) !== normalize(actual)) throw new Error(`${context} event identity does not match ${expected}.`);
}

/**
 * Joins independently captured prospective evidence into strict promotion-grade
 * row inputs. It does not fit or evaluate a model; it only proves predictor/target
 * timing and exact deck identity so rows can later enter a batch corpus safely.
 */
export function joinTopDeckProspectivePromotionEvidenceV15(input: {
  preEvent: TopDeckProspectivePreEventCaptureResultV15;
  completed: TopDeckProspectiveCompletedCaptureV15;
  retainedCardData: RetainedScryfallCardDataReplayV15;
}): TopDeckProspectivePromotionJoinV15 {
  if (!input || typeof input !== 'object') throw new Error('Prospective promotion join input must be an object.');
  if (input.preEvent.status !== 'captured') throw new Error('Prospective promotion join requires a captured pre-event TopDeck result.');
  sameEvent(input.preEvent.providerEventId, input.completed.providerEventId, 'Completed capture');
  sameEvent(input.preEvent.providerEventId, input.completed.eventEndEvidence.providerEventId, 'Event-end evidence');

  const eventStart = timestamp('preEvent.eventStartAt', input.preEvent.eventStartAt);
  const evidenceStart = timestamp('completed.eventEndEvidence.eventStartedAt', input.completed.eventEndEvidence.eventStartedAt);
  if (eventStart.ms !== evidenceStart.ms) throw new Error('Pre-event and completed TopDeck evidence disagree on tournament start time.');
  const eventEnd = timestamp('completed.eventEndEvidence.eventEndedAt', input.completed.eventEndEvidence.eventEndedAt);
  if (eventEnd.ms < eventStart.ms) throw new Error('Completed TopDeck event end cannot occur before start.');

  const cardDataObservedAt = input.retainedCardData.capture.acquisition.provenance.observedAt;
  const featureAvailableAt = laterTimestamp(input.preEvent.capturedAt, cardDataObservedAt);
  const featureAt = timestamp('featureAvailableAt', featureAvailableAt);
  const preEventByRecord = new Map(input.preEvent.decks.map((deck) => [normalize(deck.providerRecordId), deck]));
  const joinedRows: TopDeckProspectivePromotionJoinedRowV15[] = [];
  const rejectedRows: TopDeckProspectivePromotionJoinRejectionV15[] = [];

  for (const candidate of input.completed.candidates) {
    const preEventDeck = preEventByRecord.get(normalize(candidate.providerRecordId));
    if (!preEventDeck) {
      rejectedRows.push({
        providerRecordId: candidate.providerRecordId,
        code: 'missing-pre-event-deck',
        reason: 'No exact pre-event deck capture exists for this final TopDeck candidate.',
      });
      continue;
    }

    const finalFingerprint = fingerprintExactDeckV15(candidate.decklist).toLocaleLowerCase();
    if (finalFingerprint !== preEventDeck.deckFingerprint.toLocaleLowerCase()) {
      rejectedRows.push({
        providerRecordId: candidate.providerRecordId,
        code: 'final-deck-changed',
        reason: 'Final TopDeck deck fingerprint does not exactly match the pre-event captured deck.',
      });
      continue;
    }

    if (featureAt.ms > eventStart.ms) {
      rejectedRows.push({
        providerRecordId: candidate.providerRecordId,
        code: 'predictor-carddata-too-late',
        reason: 'The combined deck/card-data predictor state first became available after tournament start.',
      });
      continue;
    }

    let snapshot;
    try {
      snapshot = extractDeckFeatureSnapshotFromScryfallForwardCaptureV15(
        preEventDeck.decklist,
        input.retainedCardData.capture,
        featureAvailableAt,
      );
    } catch (error) {
      rejectedRows.push({
        providerRecordId: candidate.providerRecordId,
        code: 'feature-snapshot-failed',
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    let prepared: TopDeckPromotionGradePreparedInputV15;
    try {
      prepared = prepareTopDeckPromotionGradeInputV15({
        candidate,
        snapshot,
        decklistEvidence: preEventDeck.evidence,
        eventEndEvidence: input.completed.eventEndEvidence,
      });
    } catch (error) {
      rejectedRows.push({
        providerRecordId: candidate.providerRecordId,
        code: 'promotion-grade-evidence-failed',
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    joinedRows.push({
      providerRecordId: candidate.providerRecordId,
      providerEventId: candidate.providerEventId,
      providerPlayerId: candidate.providerPlayerId,
      completedResponseContentHash: input.completed.sourceContentHash,
      retainedCardDataManifestFingerprint: input.retainedCardData.manifestFingerprint,
      prepared,
    });
  }

  return {
    schemaVersion: TOPDECK_PROSPECTIVE_PROMOTION_JOIN_SCHEMA_V15,
    providerEventId: input.preEvent.providerEventId,
    predictionCutoff: eventStart.iso,
    eventEndedAt: eventEnd.iso,
    featureAvailableAt,
    finalCandidates: input.completed.candidates.length,
    joinedRows,
    rejectedRows,
    safeguards: [
      'Only a captured pre-event TopDeck deck can be joined to a final candidate.',
      'The final provider deck fingerprint must exactly match the pre-event fingerprint.',
      'Retained Scryfall card truth and the exact decklist must both be available no later than the feature snapshot.',
      'The feature snapshot must be available no later than provider tournament start.',
      'Final target timing comes from provider-verified event end, never legacy startDate.',
    ],
  };
}
