import { DECK_FEATURE_EXTRACTOR_ID_V15, type DeckFeatureSnapshotV15 } from './deck-feature-snapshot-v15.js';
import type { ProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';

function timestamp(name: string, value: unknown): { iso: string; ms: number } {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a valid timestamp.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function validSourceUri(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Runtime guard for workflows that require historical/as-of feature provenance.
 * The low-level structural extractor remains usable for unit/current analysis,
 * but historical corpus materialization must pass this stronger contract.
 */
export function assertProvenancedHistoricalFeatureSnapshotV15(
  snapshot: DeckFeatureSnapshotV15 | ProvenancedDeckFeatureSnapshotV15,
): asserts snapshot is ProvenancedDeckFeatureSnapshotV15 {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('A provenanced historical feature snapshot is required.');
  const candidate = snapshot as Partial<ProvenancedDeckFeatureSnapshotV15>;
  const provenance = candidate.historicalCardDataProvenance;
  if (!provenance || typeof provenance !== 'object') {
    throw new Error('Historical corpus materialization requires a provenanced snapshot with a historical card-data provenance assessment.');
  }
  if (snapshot.extractorId !== DECK_FEATURE_EXTRACTOR_ID_V15
    || provenance.featureContractId !== DECK_FEATURE_EXTRACTOR_ID_V15) {
    throw new Error('Historical provenance feature contract does not match the active structural extractor contract.');
  }
  if (!provenance.eligibleForRichStructuralFeatures) {
    throw new Error('Historical provenance assessment is not eligible for rich structural features.');
  }
  if (!Array.isArray(provenance.reasons) || provenance.reasons.length !== 0) {
    throw new Error('Historical provenance is contradictory: an eligible assessment must contain no failure reasons.');
  }
  if (provenance.method === 'retrospective-current-data') {
    throw new Error('Retrospective current card data cannot be used in the rich historical structural corpus.');
  }
  if (typeof provenance.sourceId !== 'string' || !provenance.sourceId.trim()) {
    throw new Error('Historical provenance sourceId must be non-empty.');
  }
  if (!/^[a-f0-9]{64}$/i.test(provenance.sourceContentHash)) {
    throw new Error('Historical provenance sourceContentHash must be a SHA-256 digest.');
  }
  if (!validSourceUri(provenance.sourceUri)) {
    throw new Error('Historical provenance sourceUri must be an absolute http/https URL.');
  }
  const featureAt = timestamp('snapshot.availableAt', snapshot.availableAt);
  const dataAt = timestamp('historicalCardDataProvenance.sourceDataAvailableAt', provenance.sourceDataAvailableAt);
  const retrievedAt = timestamp('historicalCardDataProvenance.retrievedAt', provenance.retrievedAt);
  const recordedAt = timestamp('snapshot.cardDataObservedAt', snapshot.cardDataObservedAt);
  if (dataAt.iso !== recordedAt.iso) {
    throw new Error('Historical provenance source availability time must exactly match snapshot.cardDataObservedAt.');
  }
  if (dataAt.ms > featureAt.ms) {
    throw new Error('Historical card data became available after the feature cutoff.');
  }
  if (retrievedAt.ms < dataAt.ms) {
    throw new Error('Historical card data retrieval cannot occur before source availability.');
  }
  if (provenance.method === 'archived-versioned-snapshot') {
    if (typeof provenance.archiveVersion !== 'string' || !provenance.archiveVersion.trim()) {
      throw new Error('Archived historical provenance requires a non-empty archiveVersion.');
    }
    const effectiveAt = timestamp('historicalCardDataProvenance.snapshotEffectiveAt', provenance.snapshotEffectiveAt);
    if (effectiveAt.ms > dataAt.ms) {
      throw new Error('Archived snapshot effective time cannot occur after its published availability time.');
    }
  }

  const commanderValidation = candidate.historicalCommanderValidation;
  if (!commanderValidation || typeof commanderValidation !== 'object') {
    throw new Error('Historical corpus materialization requires a stored Commander validation summary.');
  }
  if (typeof commanderValidation.ruleset !== 'string' || !commanderValidation.ruleset.trim()) {
    throw new Error('Historical Commander validation ruleset must be non-empty.');
  }
  if (commanderValidation.status !== 'legal' || commanderValidation.isLegal !== true) {
    throw new Error('Historical Commander validation must be unequivocally legal before corpus materialization.');
  }
  if (!Number.isInteger(commanderValidation.commanderCount)
    || commanderValidation.commanderCount < 1
    || commanderValidation.commanderCount > 2) {
    throw new Error('Historical Commander validation commanderCount must be one or two.');
  }
  if (!Array.isArray(commanderValidation.commanderColorIdentity)
    || commanderValidation.commanderColorIdentity.some((color) => typeof color !== 'string')) {
    throw new Error('Historical Commander validation color identity must be a string array.');
  }
  if (typeof commanderValidation.pairingMethod !== 'string' || !commanderValidation.pairingMethod.trim()) {
    throw new Error('Historical Commander validation pairingMethod must be non-empty.');
  }
  const violationCounts = [
    commanderValidation.unresolvedEntries,
    commanderValidation.commanderLegalityViolations,
    commanderValidation.colorIdentityViolations,
    commanderValidation.singletonViolations,
  ];
  if (!violationCounts.every(nonNegativeInteger)) {
    throw new Error('Historical Commander validation violation counts must be non-negative integers.');
  }
  if (violationCounts.some((count) => count !== 0)) {
    throw new Error('Historical Commander validation is contradictory: a legal snapshot cannot contain stored violations.');
  }
}
