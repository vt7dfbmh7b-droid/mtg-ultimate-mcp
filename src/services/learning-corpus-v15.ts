import { createHash } from 'node:crypto';
import { parseDecklist, type DeckEntry } from './deck.js';
import type { LearningExampleV15, LearningFeatureV15 } from './research-learning-v15.js';

export interface LearningOutcomeRecordV15 {
  outcomeId: string;
  observedAt: string;
  sourceId: string;
  evidenceClass: string;
  independentGroup: string;
  leakageGroup: string;
  deckFingerprint: string;
  commanderNames: string[];
  features: Partial<Record<LearningFeatureV15, number>>;
  label: 0 | 1;
  importance?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface LearningCorpusAuditV15 {
  inputRecords: number;
  uniqueRecords: number;
  duplicateRecords: number;
  duplicateRate: number;
  conflictingRecords: number;
  conflictRate: number;
  positiveExamples: number;
  negativeExamples: number;
  minorityShare: number;
  temporalCoverageDays: number;
  independentEvidenceGroups: number;
  evidenceClassCount: number;
  leakageGroupCount: number;
  malformedRecords: number;
}

export interface TemporalLearningSplitV15 {
  training: LearningOutcomeRecordV15[];
  holdout: LearningOutcomeRecordV15[];
  cutoff: string | null;
  leakageChecksPassed: boolean;
  overlappingLeakageGroups: string[];
  trainingExamples: LearningExampleV15[];
  holdoutExamples: LearningExampleV15[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function entrySignature(zone: 'commander' | 'main', entry: DeckEntry): string {
  return [
    zone,
    entry.quantity,
    normalize(entry.name),
    entry.set?.toLocaleLowerCase() ?? '',
    entry.collectorNumber?.toLocaleLowerCase() ?? '',
    entry.finish ?? '',
  ].join('|');
}

export function fingerprintExactDeckV15(decklist: string): string {
  const parsed = parseDecklist(decklist);
  const signatures = [
    ...parsed.commanders.map((entry) => entrySignature('commander', entry)),
    ...parsed.main.map((entry) => entrySignature('main', entry)),
  ].sort();
  return createHash('sha256').update(signatures.join('\n')).digest('hex');
}

function timestampMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function outcomeKey(record: LearningOutcomeRecordV15): string {
  return `${normalize(record.independentGroup)}|${normalize(record.outcomeId)}`;
}

function validRecord(record: LearningOutcomeRecordV15): boolean {
  return Boolean(
    record.outcomeId.trim()
    && record.sourceId.trim()
    && record.evidenceClass.trim()
    && record.independentGroup.trim()
    && record.leakageGroup.trim()
    && record.deckFingerprint.trim()
    && timestampMs(record.observedAt) !== null
    && (record.label === 0 || record.label === 1),
  );
}

export function deduplicateLearningCorpusV15(records: LearningOutcomeRecordV15[]): {
  records: LearningOutcomeRecordV15[];
  duplicateRecords: LearningOutcomeRecordV15[];
  conflictingRecords: LearningOutcomeRecordV15[];
  malformedRecords: LearningOutcomeRecordV15[];
} {
  const groups = new Map<string, LearningOutcomeRecordV15[]>();
  const duplicateRecords: LearningOutcomeRecordV15[] = [];
  const conflictingRecords: LearningOutcomeRecordV15[] = [];
  const malformedRecords: LearningOutcomeRecordV15[] = [];

  for (const record of records) {
    if (!validRecord(record)) {
      malformedRecords.push(record);
      continue;
    }
    const key = outcomeKey(record);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const usable: LearningOutcomeRecordV15[] = [];
  for (const group of groups.values()) {
    const labels = new Set(group.map((record) => record.label));
    if (labels.size > 1) {
      conflictingRecords.push(...group);
      continue;
    }

    let strongest = group[0];
    if (!strongest) continue;
    for (let index = 1; index < group.length; index += 1) {
      const candidate = group[index];
      if (!candidate) continue;
      const strongestImportance = strongest.importance ?? 1;
      const candidateImportance = candidate.importance ?? 1;
      if (candidateImportance > strongestImportance) {
        duplicateRecords.push(strongest);
        strongest = candidate;
      } else {
        duplicateRecords.push(candidate);
      }
    }
    usable.push(strongest);
  }

  return {
    records: usable.sort((a, b) => (timestampMs(a.observedAt) ?? 0) - (timestampMs(b.observedAt) ?? 0)),
    duplicateRecords,
    conflictingRecords,
    malformedRecords,
  };
}

export function auditLearningCorpusV15(records: LearningOutcomeRecordV15[]): LearningCorpusAuditV15 {
  const deduped = deduplicateLearningCorpusV15(records);
  const usable = deduped.records;
  const positiveExamples = usable.filter((record) => record.label === 1).length;
  const negativeExamples = usable.length - positiveExamples;
  const times = usable.map((record) => timestampMs(record.observedAt)).filter((value): value is number => value !== null);
  const minTime = times.length > 0 ? Math.min(...times) : null;
  const maxTime = times.length > 0 ? Math.max(...times) : null;
  const temporalCoverageDays = minTime === null || maxTime === null ? 0 : (maxTime - minTime) / 86_400_000;
  const duplicateRecords = deduped.duplicateRecords.length;
  const conflictingRecords = deduped.conflictingRecords.length;
  return {
    inputRecords: records.length,
    uniqueRecords: usable.length,
    duplicateRecords,
    duplicateRate: records.length > 0 ? round(duplicateRecords / records.length) : 0,
    conflictingRecords,
    conflictRate: records.length > 0 ? round(conflictingRecords / records.length) : 0,
    positiveExamples,
    negativeExamples,
    minorityShare: usable.length > 0 ? round(Math.min(positiveExamples, negativeExamples) / usable.length) : 0,
    temporalCoverageDays: round(temporalCoverageDays, 2),
    independentEvidenceGroups: new Set(usable.map((record) => normalize(record.independentGroup))).size,
    evidenceClassCount: new Set(usable.map((record) => normalize(record.evidenceClass))).size,
    leakageGroupCount: new Set(usable.map((record) => normalize(record.leakageGroup))).size,
    malformedRecords: deduped.malformedRecords.length,
  };
}

function toExample(record: LearningOutcomeRecordV15): LearningExampleV15 {
  return {
    features: { ...record.features },
    label: record.label,
    ...(record.importance !== undefined ? { importance: record.importance } : {}),
  };
}

export function temporalSplitLearningCorpusV15(
  records: LearningOutcomeRecordV15[],
  holdoutFraction = 0.2,
): TemporalLearningSplitV15 {
  const usable = deduplicateLearningCorpusV15(records).records;
  if (usable.length === 0) {
    return {
      training: [],
      holdout: [],
      cutoff: null,
      leakageChecksPassed: true,
      overlappingLeakageGroups: [],
      trainingExamples: [],
      holdoutExamples: [],
    };
  }
  const fraction = Math.min(0.5, Math.max(0.05, holdoutFraction));
  const desiredHoldout = Math.max(1, Math.ceil(usable.length * fraction));
  const tentativeCut = Math.max(1, usable.length - desiredHoldout);
  const cutoffMs = timestampMs(usable[tentativeCut]?.observedAt ?? usable[usable.length - 1]?.observedAt ?? '') ?? 0;

  const latestByLeakageGroup = new Map<string, number>();
  for (const record of usable) {
    const group = normalize(record.leakageGroup);
    const time = timestampMs(record.observedAt) ?? 0;
    latestByLeakageGroup.set(group, Math.max(latestByLeakageGroup.get(group) ?? Number.NEGATIVE_INFINITY, time));
  }

  const training: LearningOutcomeRecordV15[] = [];
  const holdout: LearningOutcomeRecordV15[] = [];
  for (const record of usable) {
    const group = normalize(record.leakageGroup);
    const latest = latestByLeakageGroup.get(group) ?? 0;
    if (latest >= cutoffMs) holdout.push(record);
    else training.push(record);
  }

  const trainingGroups = new Set(training.map((record) => normalize(record.leakageGroup)));
  const holdoutGroups = new Set(holdout.map((record) => normalize(record.leakageGroup)));
  const overlappingLeakageGroups = [...trainingGroups].filter((group) => holdoutGroups.has(group)).sort();
  return {
    training,
    holdout,
    cutoff: new Date(cutoffMs).toISOString(),
    leakageChecksPassed: overlappingLeakageGroups.length === 0,
    overlappingLeakageGroups,
    trainingExamples: training.map(toExample),
    holdoutExamples: holdout.map(toExample),
  };
}
