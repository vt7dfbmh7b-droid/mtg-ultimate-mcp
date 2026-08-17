import {
  MAX_DECK_FEATURE_SNAPSHOTS_V15,
  fitDeckFeatureNormalizerV15,
  type DeckFeatureNormalizerV15,
} from './deck-feature-snapshot-v15.js';
import type { ProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import { assertProvenancedHistoricalFeatureSnapshotV15 } from './historical-carddata-snapshot-validation-v15.js';
import {
  buildLearningCorpusManifestV15,
  type LearningCorpusManifestV15,
} from './learning-corpus-manifest-v15.js';
import { ingestObservedLearningRecordsV15 } from './learning-corpus-ingestion-v15.js';
import {
  planTemporalLeakagePartitionV15,
  type TemporalLeakagePartitionV15,
} from './learning-temporal-partition-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import {
  materializeTopDeckLearningCandidateV15,
  validateTopDeckFeatureSnapshotV15,
  type TopDeckLearningLinkageV15,
} from './topdeck-learning-materializer-v15.js';

export interface TopDeckTemporalCorpusItemV15 {
  candidate: TopDeckLearningCandidateV15;
  snapshot: ProvenancedDeckFeatureSnapshotV15;
  linkage: TopDeckLearningLinkageV15;
}

export interface TopDeckTemporalCorpusV15 {
  partition: TemporalLeakagePartitionV15;
  normalizer: DeckFeatureNormalizerV15;
  ingestion: ReturnType<typeof ingestObservedLearningRecordsV15>;
  manifest: LearningCorpusManifestV15;
}

function nonEmpty(name: string, value: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be non-empty.`);
}

function sourceObservedPreflight(item: TopDeckTemporalCorpusItemV15): void {
  nonEmpty('canonicalOutcomeId', item.linkage.canonicalOutcomeId);
  nonEmpty('independenceKey', item.linkage.independenceKey);
  nonEmpty('leakageKey', item.linkage.leakageKey);
  nonEmpty('sourceObservedAt', item.linkage.sourceObservedAt);
  const observedMs = Date.parse(item.linkage.sourceObservedAt);
  const outcomeMs = Date.parse(item.candidate.outcomeOccurredAt);
  if (!Number.isFinite(observedMs)) throw new Error('sourceObservedAt must be a valid timestamp.');
  if (!Number.isFinite(outcomeMs)) throw new Error('candidate.outcomeOccurredAt must be a valid timestamp.');
  if (observedMs < outcomeMs) throw new Error('sourceObservedAt cannot occur before the TopDeck outcome.');
  if (item.linkage.importance !== undefined
    && (!Number.isFinite(item.linkage.importance) || item.linkage.importance < 0.1 || item.linkage.importance > 5)) {
    throw new Error('TopDeck linkage importance must be between 0.1 and 5.');
  }
}

function historicalProvenanceMetadata(snapshot: ProvenancedDeckFeatureSnapshotV15): Record<string, string | number | boolean | null> {
  const provenance = snapshot.historicalCardDataProvenance;
  return {
    historicalCardDataMethod: provenance.method,
    historicalCardDataSourceId: provenance.sourceId,
    historicalCardDataSourceUri: provenance.sourceUri,
    historicalCardDataSourceContentHash: provenance.sourceContentHash,
    historicalCardDataSourceAvailableAt: provenance.sourceDataAvailableAt,
    historicalCardDataRetrievedAt: provenance.retrievedAt,
    historicalCardDataArchiveVersion: provenance.archiveVersion,
    historicalCardDataSnapshotEffectiveAt: provenance.snapshotEffectiveAt,
  };
}

/**
 * End-to-end deterministic TopDeck corpus materialization with a crucial order:
 * 1. require and validate historical card-data provenance;
 * 2. preflight candidate/snapshot identity and time provenance;
 * 3. plan leakage-safe temporal membership without using labels/features;
 * 4. fit the feature normalizer on planned training snapshots only;
 * 5. transform both training and future holdout snapshots with that frozen fit;
 * 6. derive labels through the generic ingestion boundary;
 * 7. build a content-addressed manifest.
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
        ...historicalProvenanceMetadata(item.snapshot),
      },
    };
  });
  const ingestion = ingestObservedLearningRecordsV15(observed);
  if (ingestion.rejected.length > 0) {
    const reasons = [...new Set(ingestion.rejected.map((entry) => `${entry.code}: ${entry.reason}`))];
    throw new Error(`TopDeck temporal corpus ingestion rejected ${ingestion.rejected.length} record(s): ${reasons.join('; ')}`);
  }

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

  return {
    partition,
    normalizer,
    ingestion,
    manifest,
  };
}
