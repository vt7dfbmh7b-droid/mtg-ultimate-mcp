import type { ProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import {
  planTopDeckLeakageLinkagesV15,
  type TopDeckLeakageLinkagePlanV15,
} from './topdeck-leakage-linkage-v15.js';
import {
  materializeTopDeckTemporalCorpusV15,
  type TopDeckTemporalCorpusV15,
} from './topdeck-temporal-corpus-v15.js';

export const TOPDECK_REAL_CORPUS_MATERIALIZER_SCHEMA_V15 = 'topdeck-real-corpus-materializer-v15.1' as const;

export interface TopDeckRealCorpusSnapshotInputV15 {
  candidate: TopDeckLearningCandidateV15;
  snapshot: ProvenancedDeckFeatureSnapshotV15;
}

export interface TopDeckRealCorpusMaterializationV15 {
  schemaVersion: typeof TOPDECK_REAL_CORPUS_MATERIALIZER_SCHEMA_V15;
  linkagePlan: TopDeckLeakageLinkagePlanV15;
  corpus: TopDeckTemporalCorpusV15;
  safeguards: readonly [
    'Leakage linkage is planned from provider event, pilot, and exact deck identities before normalization.',
    'Only provenanced historical deck snapshots enter strict historical materialization.',
    'The temporal split is performed before fitting the feature normalizer.',
    'Outcome labels are derived after structural feature projection and cannot feed predictor construction.'
  ];
}

/**
 * Preferred high-level boundary for real TopDeck training materialization.
 *
 * Callers provide provider candidates plus already-provenanced pre-outcome deck
 * snapshots. They do not get to hand-author independence/leakage keys. This
 * function derives those keys conservatively first, then delegates to the
 * existing strict historical temporal materializer.
 */
export function materializeTopDeckRealCorpusV15(
  inputs: TopDeckRealCorpusSnapshotInputV15[],
  options: {
    sourceObservedAt: string;
    sourceRetrievedAt: string;
    holdoutFraction?: number;
    providerRejected?: number;
  },
): TopDeckRealCorpusMaterializationV15 {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('At least one TopDeck real-corpus snapshot input is required.');
  const candidates = inputs.map((input) => input.candidate);
  const linkagePlan = planTopDeckLeakageLinkagesV15(candidates, {
    sourceObservedAt: options.sourceObservedAt,
    sourceRetrievedAt: options.sourceRetrievedAt,
  });
  const items = inputs.map((input) => {
    const linkage = linkagePlan.linkagesByProviderRecordId[input.candidate.providerRecordId];
    if (!linkage) throw new Error(`Missing planned TopDeck leakage linkage for provider record ${input.candidate.providerRecordId}.`);
    return {
      candidate: input.candidate,
      snapshot: input.snapshot,
      linkage,
    };
  });
  const corpus = materializeTopDeckTemporalCorpusV15(items, {
    ...(options.holdoutFraction !== undefined ? { holdoutFraction: options.holdoutFraction } : {}),
    ...(options.providerRejected !== undefined ? { providerRejected: options.providerRejected } : {}),
  });
  return {
    schemaVersion: TOPDECK_REAL_CORPUS_MATERIALIZER_SCHEMA_V15,
    linkagePlan,
    corpus,
    safeguards: [
      'Leakage linkage is planned from provider event, pilot, and exact deck identities before normalization.',
      'Only provenanced historical deck snapshots enter strict historical materialization.',
      'The temporal split is performed before fitting the feature normalizer.',
      'Outcome labels are derived after structural feature projection and cannot feed predictor construction.',
    ],
  };
}
