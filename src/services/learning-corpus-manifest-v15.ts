import { createHash } from 'node:crypto';
import {
  auditLearningCorpusV15,
  deduplicateLearningCorpusV15,
  learningTargetForRecordV15,
  type LearningCorpusAuditV15,
  type LearningOutcomeRecordV15,
  type LearningTargetV15,
} from './learning-corpus-v15.js';

export const LEARNING_CORPUS_MANIFEST_SCHEMA_V15 = 'learning-corpus-manifest-v15.1' as const;

export interface LearningCorpusRefreshAuditV15 {
  providerCandidates: number;
  providerRejected: number;
  ingestionAccepted: number;
  ingestionRejected: number;
}

export interface LearningCorpusManifestV15 {
  schemaVersion: typeof LEARNING_CORPUS_MANIFEST_SCHEMA_V15;
  corpusContentHash: string;
  manifestHash: string;
  recordDigests: string[];
  audit: LearningCorpusAuditV15;
  temporalRange: {
    earliestObservedAt: string | null;
    latestObservedAt: string | null;
  };
  sourceCounts: Array<{ sourceId: string; count: number }>;
  evidenceClassCounts: Array<{ evidenceClass: string; count: number }>;
  learningTargetCounts: Array<{ learningTarget: LearningTargetV15; count: number }>;
  featureExtractorCounts: Array<{ featureExtractorId: string; count: number }>;
  featureNormalizerFitFingerprints: string[];
  refreshAudit: LearningCorpusRefreshAuditV15 | null;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function canonicalRecordForHash(record: LearningOutcomeRecordV15): Record<string, unknown> {
  const observedMs = Date.parse(record.observedAt);
  const observedAt = Number.isFinite(observedMs) ? new Date(observedMs).toISOString() : record.observedAt;
  return {
    outcomeId: normalize(record.outcomeId),
    observedAt,
    sourceId: normalize(record.sourceId),
    evidenceClass: normalize(record.evidenceClass),
    independentGroup: normalize(record.independentGroup),
    leakageGroup: normalize(record.leakageGroup),
    deckFingerprint: record.deckFingerprint.toLocaleLowerCase(),
    commanderNames: record.commanderNames.map(normalize).sort(),
    features: Object.fromEntries(
      Object.entries(record.features)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    label: record.label,
    learningTarget: learningTargetForRecordV15(record),
    importance: record.importance ?? 1,
    metadata: Object.fromEntries(
      Object.entries(record.metadata ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

function recordDigest(record: LearningOutcomeRecordV15): string {
  return sha256(stableStringify(canonicalRecordForHash(record)));
}

function countBy<T extends string>(values: T[]): Array<{ value: T; count: number }> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, count }));
}

function temporalRange(records: LearningOutcomeRecordV15[]): LearningCorpusManifestV15['temporalRange'] {
  const times = records
    .map((record) => Date.parse(record.observedAt))
    .filter((value) => Number.isFinite(value));
  if (times.length === 0) return { earliestObservedAt: null, latestObservedAt: null };
  return {
    earliestObservedAt: new Date(Math.min(...times)).toISOString(),
    latestObservedAt: new Date(Math.max(...times)).toISOString(),
  };
}

function validateRefreshAudit(audit: LearningCorpusRefreshAuditV15): LearningCorpusRefreshAuditV15 {
  for (const [key, value] of Object.entries(audit)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`refreshAudit.${key} must be a non-negative integer.`);
    }
  }
  return { ...audit };
}

export function buildLearningCorpusManifestV15(
  records: LearningOutcomeRecordV15[],
  options: { refreshAudit?: LearningCorpusRefreshAuditV15 } = {},
): LearningCorpusManifestV15 {
  if (!Array.isArray(records)) throw new Error('records must be an array.');
  const deduped = deduplicateLearningCorpusV15(records);
  const usable = deduped.records;
  const audit = auditLearningCorpusV15(records);
  const recordDigests = usable.map(recordDigest).sort();
  const corpusContentHash = sha256(recordDigests.join('\n'));

  const sourceCounts = countBy(usable.map((record) => normalize(record.sourceId)))
    .map(({ value, count }) => ({ sourceId: value, count }));
  const evidenceClassCounts = countBy(usable.map((record) => normalize(record.evidenceClass)))
    .map(({ value, count }) => ({ evidenceClass: value, count }));
  const learningTargetCounts = countBy(usable.map(learningTargetForRecordV15))
    .map(({ value, count }) => ({ learningTarget: value, count }));
  const featureExtractorCounts = countBy(
    usable.flatMap((record) => {
      const value = record.metadata?.featureExtractorId;
      return typeof value === 'string' && value.trim() ? [value.trim()] : [];
    }),
  ).map(({ value, count }) => ({ featureExtractorId: value, count }));
  const featureNormalizerFitFingerprints = [...new Set(
    usable.flatMap((record) => {
      const value = record.metadata?.featureNormalizerFitFingerprint;
      return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value) ? [value.toLocaleLowerCase()] : [];
    }),
  )].sort();

  const refreshAudit = options.refreshAudit ? validateRefreshAudit(options.refreshAudit) : null;
  const withoutManifestHash = {
    schemaVersion: LEARNING_CORPUS_MANIFEST_SCHEMA_V15,
    corpusContentHash,
    recordDigests,
    audit,
    temporalRange: temporalRange(usable),
    sourceCounts,
    evidenceClassCounts,
    learningTargetCounts,
    featureExtractorCounts,
    featureNormalizerFitFingerprints,
    refreshAudit,
  };
  const manifestHash = sha256(stableStringify(withoutManifestHash));

  return {
    ...withoutManifestHash,
    manifestHash,
  };
}
