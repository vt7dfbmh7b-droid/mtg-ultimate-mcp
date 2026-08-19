import { createHash } from 'node:crypto';
import {
  MAX_DECK_FEATURE_SNAPSHOTS_V15,
  fitDeckFeatureNormalizerV15,
  type DeckFeatureNormalizerV15,
} from './deck-feature-snapshot-v15.js';
import type { ProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import { assertProvenancedHistoricalFeatureSnapshotV15 } from './historical-carddata-snapshot-validation-v15.js';
import {
  assertHistoricalLearningRecordEligibleV15,
  buildHistoricalLearningCorpusManifestV15,
  createHistoricalLearningRecordV15,
  type HistoricalLearningCorpusManifestV15,
  type HistoricalLearningRecordV15,
} from './historical-learning-corpus-v15.js';
import {
  buildLearningCorpusManifestV15,
  type LearningCorpusManifestV15,
} from './learning-corpus-manifest-v15.js';
import { ingestObservedLearningRecordsV15 } from './learning-corpus-ingestion-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import {
  planTemporalLeakagePartitionV15,
  type TemporalLeakagePartitionV15,
} from './learning-temporal-partition-v15.js';
import type { TemporalEvidenceProvenanceV15 } from './temporal-provenance-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import {
  materializeTopDeckLearningCandidateV15,
  validateTopDeckFeatureSnapshotV15,
  type TopDeckLearningLinkageV15,
} from './topdeck-learning-materializer-v15.js';

export const TOPDECK_HISTORICAL_OUTCOME_SOURCE_VERSION_V15 = 'topdeck-v2-materialized-outcome-v15.1' as const;

export interface TopDeckTemporalCorpusItemV15 {
  candidate: TopDeckLearningCandidateV15;
  snapshot: ProvenancedDeckFeatureSnapshotV15;
  linkage: TopDeckLearningLinkageV15 & {
    sourceRetrievedAt: string;
  };
}

export interface TopDeckTemporalCorpusV15 {
  partition: TemporalLeakagePartitionV15;
  normalizer: DeckFeatureNormalizerV15;
  ingestion: ReturnType<typeof ingestObservedLearningRecordsV15>;
  manifest: LearningCorpusManifestV15;
  historicalRecords: HistoricalLearningRecordV15[];
  historicalManifest: HistoricalLearningCorpusManifestV15;
}

function nonEmpty(name: string, value: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be non-empty.`);
}

function timestamp(name: string, value: string): number {
  nonEmpty(name, value);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return ms;
}

function sourceObservedPreflight(item: TopDeckTemporalCorpusItemV15): void {
  nonEmpty('canonicalOutcomeId', item.linkage.canonicalOutcomeId);
  nonEmpty('independenceKey', item.linkage.independenceKey);
  nonEmpty('leakageKey', item.linkage.leakageKey);
  nonEmpty('sourceObservedAt', item.linkage.sourceObservedAt);
  nonEmpty('sourceRetrievedAt', item.linkage.sourceRetrievedAt);
  const observedMs = timestamp('sourceObservedAt', item.linkage.sourceObservedAt);
  const retrievedMs = timestamp('sourceRetrievedAt', item.linkage.sourceRetrievedAt);
  const outcomeMs = timestamp('candidate.outcomeOccurredAt', item.candidate.outcomeOccurredAt);
  if (observedMs < outcomeMs) throw new Error('sourceObservedAt cannot occur before the TopDeck outcome.');
  if (retrievedMs < observedMs) throw new Error('sourceRetrievedAt cannot occur before sourceObservedAt.');
  if (item.linkage.importance !== undefined
    && (!Number.isFinite(item.linkage.importance) || item.linkage.importance < 0.1 || item.linkage.importance > 5)) {
    throw new Error('TopDeck linkage importance must be between 0.1 and 5.');
  }
}

function historicalProvenanceMetadata(snapshot: ProvenancedDeckFeatureSnapshotV15): Record<string, string | number | boolean | null> {
  const provenance = snapshot.historicalCardDataProvenance;
  const commanderValidation = snapshot.historicalCommanderValidation;
  return {
    historicalCardDataMethod: provenance.method,
    historicalCardDataSourceId: provenance.sourceId,
    historicalCardDataSourceUri: provenance.sourceUri,
    historicalCardDataSourceContentHash: provenance.sourceContentHash,
    historicalCardDataSourceAvailableAt: provenance.sourceDataAvailableAt,
    historicalCardDataRetrievedAt: provenance.retrievedAt,
    historicalCardDataArchiveVersion: provenance.archiveVersion,
    historicalCardDataSnapshotEffectiveAt: provenance.snapshotEffectiveAt,
    historicalCommanderRuleset: commanderValidation.ruleset,
    historicalCommanderLegalityStatus: commanderValidation.status,
    historicalCommanderCount: commanderValidation.commanderCount,
    historicalCommanderPairingMethod: commanderValidation.pairingMethod,
  };
}

function topDeckOutcomeContentHash(candidate: TopDeckLearningCandidateV15): string {
  const canonical = {
    sourceId: candidate.sourceId,
    providerEventId: candidate.providerEventId,
    providerPlayerId: candidate.providerPlayerId,
    providerRecordId: candidate.providerRecordId,
    sourceUrl: candidate.sourceUrl,
    outcomeOccurredAt: candidate.outcomeOccurredAt,
    standing: candidate.standing,
    fieldSize: candidate.fieldSize,
    topCutSize: candidate.topCutSize,
    deckFingerprint: fingerprintExactDeckV15(candidate.decklist),
    commanderNames: [...candidate.commanderNames].map((name) => name.trim()).sort(),
    provider: candidate.metadata.provider,
    tournamentName: candidate.metadata.tournamentName,
    wins: candidate.metadata.wins,
    draws: candidate.metadata.draws,
    losses: candidate.metadata.losses,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function topDeckOutcomeTemporalProvenanceV15(
  item: TopDeckTemporalCorpusItemV15,
): TemporalEvidenceProvenanceV15 {
  sourceObservedPreflight(item);
  return {
    mode: 'contemporaneous-snapshot',
    domain: 'tournament-outcome',
    sourceId: item.candidate.sourceId,
    sourceUri: item.candidate.sourceUrl,
    sourceRecordId: item.candidate.providerRecordId,
    sourceVersion: TOPDECK_HISTORICAL_OUTCOME_SOURCE_VERSION_V15,
    sourceContentHash: topDeckOutcomeContentHash(item.candidate),
    sourceObservedAt: item.linkage.sourceObservedAt,
    sourceRetrievedAt: item.linkage.sourceRetrievedAt,
    validFrom: item.candidate.outcomeOccurredAt,
    truthStatus: 'verified-present',
  };
}

/**
 * End-to-end deterministic TopDeck corpus materialization with a crucial order:
 * 1. require and validate historical card-data provenance and Commander legality;
 * 2. preflight candidate/snapshot identity plus source observation/retrieval time;
 * 3. plan leakage-safe temporal membership without using labels/features;
 * 4. fit the feature normalizer on planned training snapshots only;
 * 5. transform both training and future holdout snapshots with that frozen fit;
 * 6. derive labels through the generic ingestion boundary;
 * 7. bind each accepted row to replayable, target-only outcome provenance;
 * 8. build both the legacy content manifest and strict historical manifest.
 */
export function materializeTopDeckTemporalCorpusV15(
  items: TopDeckTemporalCorpusItemV15[],
  options: {
    holdoutFraction?: number;
    providerRejected?: number;
  } = {},
): TopDeckTemporalCorpusV15 {
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one TopDeck temporal corpus item is required.');
  if (items.length > MAX_DECK_FEATURE_SNAPSHOTS_V15) {
    throw new Error(`At most ${MAX_DECK_FEATURE_SNAPSHOTS_V15} TopDeck temporal corpus items may be materialized at once.`);
  }

  for (const item of items) {
    if (!item || typeof item !== 'object') throw new Error('Each TopDeck temporal corpus item must be an object.');
    sourceObservedPreflight(item);
    assertProvenancedHistoricalFeatureSnapshotV15(item.snapshot);
    validateTopDeckFeatureSnapshotV15(item.candidate, item.snapshot);
  }

  const partition = planTemporalLeakagePartitionV15(
    items.map((item) => ({
      id: item.linkage.canonicalOutcomeId,
      observedAt: item.candidate.outcomeOccurredAt,
      leakageGroup: item.linkage.leakageKey,
    })),
    options.holdoutFraction,
  );
  if (!partition.leakageChecksPassed) {
    throw new Error(`Temporal leakage partition contains overlapping leakage groups: ${partition.overlappingLeakageGroups.join(', ')}.`);
  }
  if (partition.trainingIds.length === 0) {
    throw new Error('Temporal leakage grouping leaves no historical training snapshots; normalization cannot be fitted leakage-safely.');
  }

  const trainingIds = new Set(partition.trainingIds);
  const trainingSnapshots = items
    .filter((item) => trainingIds.has(item.linkage.canonicalOutcomeId))
    .map((item) => item.snapshot);
  const normalizer = fitDeckFeatureNormalizerV15(trainingSnapshots);
  if (normalizer.fittedSnapshotCount !== partition.trainingIds.length) {
    throw new Error('Training snapshot count does not match the pre-feature temporal partition.');
  }

  const observed = items.map((item) => {
    const materialized = materializeTopDeckLearningCandidateV15(
      item.candidate,
      item.snapshot,
      normalizer,
      item.linkage,
    );
    return {
      ...materialized,
      metadata: {
        ...(materialized.metadata ?? {}),
        sourceRetrievedAt: new Date(timestamp('sourceRetrievedAt', item.linkage.sourceRetrievedAt)).toISOString(),
        historicalOutcomeSourceVersion: TOPDECK_HISTORICAL_OUTCOME_SOURCE_VERSION_V15,
        historicalOutcomeSourceContentHash: topDeckOutcomeContentHash(item.candidate),
        ...historicalProvenanceMetadata(item.snapshot),
      },
    };
  });
  const ingestion = ingestObservedLearningRecordsV15(observed);
  if (ingestion.rejected.length > 0) {
    const reasons = [...new Set(ingestion.rejected.map((entry) => `${entry.code}: ${entry.reason}`))];
    throw new Error(`TopDeck temporal corpus ingestion rejected ${ingestion.rejected.length} record(s): ${reasons.join('; ')}`);
  }
  if (ingestion.accepted.length !== items.length) {
    throw new Error('TopDeck temporal corpus ingestion accepted count does not match preflight item count.');
  }

  const historicalRecords = ingestion.accepted.map((record, index) => {
    const item = items[index];
    if (!item) throw new Error(`Missing TopDeck temporal corpus item for accepted record index ${index}.`);
    if (record.outcomeId !== item.linkage.canonicalOutcomeId) {
      throw new Error('TopDeck accepted-record order/identity changed before historical provenance binding.');
    }
    return assertHistoricalLearningRecordEligibleV15(createHistoricalLearningRecordV15(
      record,
      item.snapshot,
      topDeckOutcomeTemporalProvenanceV15(item),
    ));
  });

  const providerRejected = options.providerRejected ?? 0;
  if (!Number.isInteger(providerRejected) || providerRejected < 0) {
    throw new Error('providerRejected must be a non-negative integer.');
  }
  const manifest = buildLearningCorpusManifestV15(ingestion.accepted, {
    refreshAudit: {
      providerCandidates: items.length,
      providerRejected,
      ingestionAccepted: ingestion.accepted.length,
      ingestionRejected: ingestion.rejected.length,
    },
  });
  const historicalManifest = buildHistoricalLearningCorpusManifestV15(historicalRecords);
  if (historicalManifest.ineligibleRecordCount !== 0) {
    throw new Error('Strict TopDeck historical corpus contains an ineligible historical learning record.');
  }

  return {
    partition,
    normalizer,
    ingestion,
    manifest,
    historicalRecords,
    historicalManifest,
  };
}
