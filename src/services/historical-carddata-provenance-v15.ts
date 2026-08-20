import type { ScryfallCard } from '../types/scryfall.js';
import {
  DECK_FEATURE_EXTRACTOR_ID_V15,
  extractDeckFeatureSnapshotV15,
  type DeckFeatureSnapshotV15,
} from './deck-feature-snapshot-v15.js';
import { validateCommanderDeckAsOfV15 } from './commander-rules-temporal-v15.js';
import { parseDecklist, type DeckEntry } from './deck.js';

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

export interface HistoricalCommanderValidationSummaryV15 {
  ruleset: string;
  status: 'legal' | 'illegal' | 'incomplete';
  isLegal: boolean;
  commanderCount: number;
  commanderColorIdentity: string[];
  pairingMethod: string;
  unresolvedEntries: number;
  commanderLegalityViolations: number;
  colorIdentityViolations: number;
  singletonViolations: number;
}

export interface ProvenancedDeckFeatureSnapshotV15 extends DeckFeatureSnapshotV15 {
  historicalCardDataProvenance: HistoricalCardDataAssessmentV15;
  historicalCommanderValidation: HistoricalCommanderValidationSummaryV15;
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

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function releaseMs(card: ScryfallCard): number | null {
  if (!card.released_at) return null;
  const ms = Date.parse(`${card.released_at}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : null;
}

function matchesEntry(card: ScryfallCard, entry: DeckEntry): boolean {
  if (normalize(card.name) !== normalize(entry.name)) return false;
  if (entry.set && card.set.toLocaleLowerCase() !== entry.set.toLocaleLowerCase()) return false;
  if (entry.collectorNumber
    && card.collector_number.toLocaleLowerCase() !== entry.collectorNumber.toLocaleLowerCase()) return false;
  return true;
}

function historicalCandidateCompare(a: ScryfallCard, b: ScryfallCard): number {
  const releaseDifference = (releaseMs(b) ?? Number.NEGATIVE_INFINITY) - (releaseMs(a) ?? Number.NEGATIVE_INFINITY);
  if (releaseDifference !== 0) return releaseDifference;
  const setDifference = a.set.toLocaleLowerCase().localeCompare(b.set.toLocaleLowerCase());
  if (setDifference !== 0) return setDifference;
  const collectorDifference = a.collector_number.toLocaleLowerCase().localeCompare(b.collector_number.toLocaleLowerCase());
  if (collectorDifference !== 0) return collectorDifference;
  return a.id.localeCompare(b.id);
}

function selectHistoricalCardForEntry(
  entry: DeckEntry,
  cards: ScryfallCard[],
  featureAvailableAtMs: number,
): ScryfallCard {
  const candidates = cards.filter((card) => matchesEntry(card, entry));
  if (candidates.length === 0) {
    throw new Error(`Could not resolve historical card entry ${entry.name}.`);
  }

  const exactPrinting = Boolean(entry.set && entry.collectorNumber);
  if (exactPrinting) {
    const exact = [...candidates].sort(historicalCandidateCompare)[0];
    if (!exact) throw new Error(`Could not resolve exact historical printing ${entry.name}.`);
    const releasedAt = releaseMs(exact);
    if (releasedAt === null) {
      throw new Error(`Exact historical printing ${entry.name} has no release date, so its existence before the feature cutoff cannot be proven.`);
    }
    if (releasedAt > featureAvailableAtMs) {
      throw new Error(`Exact historical printing ${entry.name} was released after the feature cutoff.`);
    }
    return exact;
  }

  const eligible = candidates
    .filter((card) => {
      const releasedAt = releaseMs(card);
      return releasedAt !== null && releasedAt <= featureAvailableAtMs;
    })
    .sort(historicalCandidateCompare);
  const selected = eligible[0];
  if (!selected) {
    throw new Error(`No historical printing with a release date proves ${entry.name} existed by the feature cutoff.`);
  }
  return selected;
}

function selectHistoricalFeatureCardsV15(
  decklist: string,
  cards: ScryfallCard[],
  featureAvailableAt: string,
): ScryfallCard[] {
  const featureAt = timestamp('featureAvailableAt', featureAvailableAt);
  const parsed = parseDecklist(decklist);
  const selected = new Map<string, ScryfallCard>();
  for (const entry of [...parsed.commanders, ...parsed.main]) {
    const card = selectHistoricalCardForEntry(entry, cards, featureAt.ms);
    selected.set(card.id, card);
  }
  return [...selected.values()];
}

function summarizeCommanderValidation(
  result: ReturnType<typeof validateCommanderDeckAsOfV15>,
): HistoricalCommanderValidationSummaryV15 {
  const pairingMethod = typeof result.pairing.method === 'string' ? result.pairing.method : 'unknown';
  return {
    ruleset: result.ruleset,
    status: result.status,
    isLegal: result.isLegal,
    commanderCount: result.commanderCount,
    commanderColorIdentity: [...result.commanderColorIdentity],
    pairingMethod,
    unresolvedEntries: result.unresolvedEntries.length,
    commanderLegalityViolations: result.commanderLegalityViolations.length,
    colorIdentityViolations: result.colorIdentityViolations.length,
    singletonViolations: result.singletonViolations.length,
  };
}

function commanderValidationFailureReason(summary: HistoricalCommanderValidationSummaryV15): string {
  const details: string[] = [];
  if (summary.unresolvedEntries > 0) details.push(`${summary.unresolvedEntries} unresolved entries`);
  if (summary.commanderLegalityViolations > 0) details.push(`${summary.commanderLegalityViolations} Commander legality violations`);
  if (summary.colorIdentityViolations > 0) details.push(`${summary.colorIdentityViolations} color identity violations`);
  if (summary.singletonViolations > 0) details.push(`${summary.singletonViolations} singleton/copy-count violations`);
  if (summary.commanderCount === 2 && summary.pairingMethod === 'none') details.push('invalid two-commander pairing');
  return details.length > 0 ? details.join(', ') : 'commander eligibility, pairing, deck size, or another construction rule failed';
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
 * available before the prediction cutoff. Name-only deck entries are resolved
 * only to dated printings that existed by the cutoff; exact set/collector lines
 * remain exact. Historical Commander construction is validated through dated
 * rule gates so a later eligibility expansion cannot leak backward.
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

  const historicalCards = selectHistoricalFeatureCardsV15(decklist, cards, options.availableAt);
  const parsed = parseDecklist(decklist);
  const commanderRules = validateCommanderDeckAsOfV15(parsed, historicalCards, options.availableAt);
  const historicalCommanderValidation = summarizeCommanderValidation(commanderRules);
  if (!historicalCommanderValidation.isLegal) {
    throw new Error(`Historical Commander construction is ${historicalCommanderValidation.status}: ${commanderValidationFailureReason(historicalCommanderValidation)}.`);
  }

  const snapshot = extractDeckFeatureSnapshotV15(decklist, historicalCards, {
    availableAt: options.availableAt,
    cardDataObservedAt: assessment.sourceDataAvailableAt,
  });
  return {
    ...snapshot,
    historicalCardDataProvenance: assessment,
    historicalCommanderValidation,
  };
}
