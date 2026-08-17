import type { ScryfallCard } from '../types/scryfall.js';
import {
  DECK_FEATURE_EXTRACTOR_ID_V15,
  extractDeckFeatureSnapshotV15,
  type DeckFeatureSnapshotV15,
} from './deck-feature-snapshot-v15.js';

export type HistoricalCardDataProvenanceV15 =
  | {
      method: 'contemporaneous-capture';
      sourceId: string;
      sourceUri: string;
      sourceContentHash: string;
      observedAt: string;
      retrievedAt: string;
    }
  | {
      method: 'archived-versioned-snapshot';
      sourceId: string;
      sourceUri: string;
      sourceContentHash: string;
      archiveVersion: string;
      snapshotEffectiveAt: string;
      archivePublishedAt: string;
      retrievedAt: string;
    }
  | {
      method: 'retrospective-current-data';
      sourceId: string;
      sourceUri: string;
      sourceContentHash: string;
      retrievedAt: string;
    };

export interface HistoricalCardDataAssessmentV15 {
  featureContractId: typeof DECK_FEATURE_EXTRACTOR_ID_V15;
  method: HistoricalCardDataProvenanceV15['method'];
  sourceId: string;
  sourceUri: string;
  sourceContentHash: string;
  sourceDataAvailableAt: string;
  retrievedAt: string;
  archiveVersion: string | null;
  snapshotEffectiveAt: string | null;
  eligibleForRichStructuralFeatures: boolean;
  reasons: string[];
}

export interface ProvenancedDeckFeatureSnapshotV15 extends DeckFeatureSnapshotV15 {
  historicalCardDataProvenance: HistoricalCardDataAssessmentV15;
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

function sourceUri(value: unknown): string {
  const text = required('sourceUri', value);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error('sourceUri must be an absolute http/https URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('sourceUri must be an absolute http/https URL.');
  }
  return parsed.toString();
}

function sourceHash(value: unknown): string {
  const text = required('sourceContentHash', value).toLocaleLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error('sourceContentHash must be a SHA-256 hex digest.');
  return text;
}

function baseFields(provenance: HistoricalCardDataProvenanceV15) {
  return {
    featureContractId: DECK_FEATURE_EXTRACTOR_ID_V15,
    method: provenance.method,
    sourceId: required('sourceId', provenance.sourceId),
    sourceUri: sourceUri(provenance.sourceUri),
    sourceContentHash: sourceHash(provenance.sourceContentHash),
  } as const;
}

/**
 * Decides whether a card-data source is temporally safe for the rich structural
 * feature contract. This contract uses Oracle/type/mana-derived role inference,
 * so source contents must have been observable before the prediction cutoff.
 * Retrieval can happen later only for an independently versioned archive that
 * was already published before that cutoff.
 */
export function assessHistoricalCardDataProvenanceV15(
  provenance: HistoricalCardDataProvenanceV15,
  featureAvailableAt: string,
): HistoricalCardDataAssessmentV15 {
  if (!provenance || typeof provenance !== 'object') throw new Error('Historical card-data provenance must be an object.');
  const featureAt = timestamp('featureAvailableAt', featureAvailableAt);
  const base = baseFields(provenance);

  if (provenance.method === 'contemporaneous-capture') {
    const observedAt = timestamp('observedAt', provenance.observedAt);
    const retrievedAt = timestamp('retrievedAt', provenance.retrievedAt);
    if (retrievedAt.ms < observedAt.ms) {
      throw new Error('retrievedAt cannot occur before observedAt for contemporaneous capture.');
    }
    const reasons = observedAt.ms > featureAt.ms
      ? ['Contemporaneous card data was observed after the feature cutoff and would introduce future knowledge.']
      : [];
    return {
      ...base,
      sourceDataAvailableAt: observedAt.iso,
      retrievedAt: retrievedAt.iso,
      archiveVersion: null,
      snapshotEffectiveAt: null,
      eligibleForRichStructuralFeatures: reasons.length === 0,
      reasons,
    };
  }

  if (provenance.method === 'archived-versioned-snapshot') {
    const archiveVersion = required('archiveVersion', provenance.archiveVersion);
    const effectiveAt = timestamp('snapshotEffectiveAt', provenance.snapshotEffectiveAt);
    const publishedAt = timestamp('archivePublishedAt', provenance.archivePublishedAt);
    const retrievedAt = timestamp('retrievedAt', provenance.retrievedAt);
    if (effectiveAt.ms > publishedAt.ms) {
      throw new Error('snapshotEffectiveAt cannot occur after archivePublishedAt.');
    }
    if (retrievedAt.ms < publishedAt.ms) {
      throw new Error('retrievedAt cannot occur before archivePublishedAt.');
    }
    const reasons: string[] = [];
    if (publishedAt.ms > featureAt.ms) {
      reasons.push('Archived card data was published after the feature cutoff and is not safe for historical rich features.');
    }
    if (effectiveAt.ms > featureAt.ms) {
      reasons.push('Archived snapshot effective time is after the feature cutoff.');
    }
    return {
      ...base,
      sourceDataAvailableAt: publishedAt.iso,
      retrievedAt: retrievedAt.iso,
      archiveVersion,
      snapshotEffectiveAt: effectiveAt.iso,
      eligibleForRichStructuralFeatures: reasons.length === 0,
      reasons,
    };
  }

  if (provenance.method === 'retrospective-current-data') {
    const retrievedAt = timestamp('retrievedAt', provenance.retrievedAt);
    return {
      ...base,
      sourceDataAvailableAt: retrievedAt.iso,
      retrievedAt: retrievedAt.iso,
      archiveVersion: null,
      snapshotEffectiveAt: null,
      eligibleForRichStructuralFeatures: false,
      reasons: [
        'Retrospective current data is not eligible for the rich Oracle-derived feature contract because it may contain future knowledge relative to the predicted event.',
      ],
    };
  }

  const exhaustive: never = provenance;
  throw new Error(`Unsupported historical card-data provenance method: ${String(exhaustive)}.`);
}

/**
 * Safe wrapper for historical feature extraction. It refuses rich feature
 * construction unless provenance establishes that the source contents were
 * available before the prediction cutoff.
 */
export function extractProvenancedDeckFeatureSnapshotV15(
  decklist: string,
  cards: ScryfallCard[],
  options: {
    availableAt: string;
    provenance: HistoricalCardDataProvenanceV15;
  },
): ProvenancedDeckFeatureSnapshotV15 {
  const assessment = assessHistoricalCardDataProvenanceV15(options.provenance, options.availableAt);
  if (!assessment.eligibleForRichStructuralFeatures) {
    throw new Error(`Historical card data is not eligible for rich structural features: ${assessment.reasons.join(' ')}`);
  }

  const snapshot = extractDeckFeatureSnapshotV15(decklist, cards, {
    availableAt: options.availableAt,
    cardDataObservedAt: assessment.sourceDataAvailableAt,
  });
  return {
    ...snapshot,
    historicalCardDataProvenance: assessment,
  };
}
