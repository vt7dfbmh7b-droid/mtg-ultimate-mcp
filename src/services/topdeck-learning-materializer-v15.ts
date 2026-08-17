import {
  DECK_FEATURE_EXTRACTOR_ID_V15,
  DECK_FEATURE_NORMALIZER_ID_V15,
  projectDeckFeatureSnapshotV15,
  type DeckFeatureNormalizerV15,
  type DeckFeatureSnapshotV15,
} from './deck-feature-snapshot-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import type { ObservedLearningSourceRecordV15 } from './learning-corpus-ingestion-v15.js';
import {
  enrichTopDeckLearningCandidateV15,
  type TopDeckLearningCandidateV15,
} from './topdeck-learning-adapter-v15.js';

export interface TopDeckLearningLinkageV15 {
  canonicalOutcomeId: string;
  independenceKey: string;
  leakageKey: string;
  sourceObservedAt: string;
  importance?: number;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function timestampMs(name: string, value: string): number {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty timestamp.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return ms;
}

function commanderKey(names: readonly string[]): string {
  return names.map(normalize).sort().join('|');
}

/**
 * Converts a strict TopDeck provider candidate plus a pre-outcome structural
 * feature snapshot into the generic observed-learning ingestion contract.
 *
 * This boundary deliberately accepts no caller-supplied model features. Features
 * are projected from the supplied, versioned deck snapshot with a normalizer
 * already fitted by the caller on training data only.
 */
export function materializeTopDeckLearningCandidateV15(
  candidate: TopDeckLearningCandidateV15,
  snapshot: DeckFeatureSnapshotV15,
  normalizer: DeckFeatureNormalizerV15,
  linkage: TopDeckLearningLinkageV15,
): ObservedLearningSourceRecordV15 {
  if (!candidate || typeof candidate !== 'object') throw new Error('candidate must be a TopDeck learning candidate.');
  if (!snapshot || typeof snapshot !== 'object') throw new Error('snapshot must be a deck feature snapshot.');

  const candidateFingerprint = fingerprintExactDeckV15(candidate.decklist);
  if (candidateFingerprint.toLocaleLowerCase() !== snapshot.deckFingerprint.toLocaleLowerCase()) {
    throw new Error('TopDeck candidate deck fingerprint does not match the supplied feature snapshot.');
  }
  if (commanderKey(candidate.commanderNames) !== commanderKey(snapshot.commanderNames)) {
    throw new Error('TopDeck candidate commander identity does not match the supplied feature snapshot.');
  }

  const snapshotAt = timestampMs('snapshot.availableAt', snapshot.availableAt);
  const outcomeAt = timestampMs('candidate.outcomeOccurredAt', candidate.outcomeOccurredAt);
  if (snapshotAt > outcomeAt) {
    throw new Error('Feature snapshot availableAt cannot occur after the TopDeck outcome being predicted.');
  }

  const features = projectDeckFeatureSnapshotV15(snapshot, normalizer);
  const featureExtractorId = `${DECK_FEATURE_EXTRACTOR_ID_V15}+${DECK_FEATURE_NORMALIZER_ID_V15}`;
  const observed = enrichTopDeckLearningCandidateV15(candidate, {
    canonicalOutcomeId: linkage.canonicalOutcomeId,
    independenceKey: linkage.independenceKey,
    leakageKey: linkage.leakageKey,
    sourceObservedAt: linkage.sourceObservedAt,
    featureExtractorId,
    features,
    ...(linkage.importance !== undefined ? { importance: linkage.importance } : {}),
  });

  return {
    ...observed,
    metadata: {
      ...(observed.metadata ?? {}),
      featureSnapshotAvailableAt: snapshot.availableAt,
      cardDataObservedAt: snapshot.cardDataObservedAt,
      featureNormalizerId: normalizer.normalizerId,
      featureNormalizerFitFingerprint: normalizer.fitFingerprint,
      featureNormalizerTrainingSnapshots: normalizer.fittedSnapshotCount,
    },
  };
}
