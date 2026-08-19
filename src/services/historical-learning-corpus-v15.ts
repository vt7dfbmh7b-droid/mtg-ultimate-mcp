import { createHash } from 'node:crypto';
import type { ProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import { assertProvenancedHistoricalFeatureSnapshotV15 } from './historical-carddata-snapshot-validation-v15.js';
import type { LearningOutcomeRecordV15 } from './learning-corpus-v15.js';
import {
  assessTemporalEvidenceAsOfV15,
  normalizeTemporalEvidenceProvenanceV15,
  type NormalizedTemporalEvidenceProvenanceV15,
  type TemporalEvidenceAssessmentV15,
  type TemporalEvidenceProvenanceV15,
} from './temporal-provenance-v15.js';

export const HISTORICAL_LEARNING_RECORD_SCHEMA_V15 = 'historical-learning-record-v15.1' as const;
export const HISTORICAL_LEARNING_MANIFEST_SCHEMA_V15 = 'historical-learning-manifest-v15.1' as const;

export interface HistoricalLearningRecordV15 {
  schemaVersion: typeof HISTORICAL_LEARNING_RECORD_SCHEMA_V15;
  record: LearningOutcomeRecordV15;
  predictor: {
    availableAt: string;
    cardDataObservedAt: string;
    cardDataSnapshotFingerprint: string;
    historicalCardDataMethod: ProvenancedDeckFeatureSnapshotV15['historicalCardDataProvenance']['method'];
    historicalCardDataSourceId: string;
    historicalCardDataSourceContentHash: string;
    historicalCommanderRuleset: string;
    historicalCommanderLegalityStatus: ProvenancedDeckFeatureSnapshotV15['historicalCommanderValidation']['status'];
  };
  outcomeEvidenceProvenance: TemporalEvidenceProvenanceV15;
  outcomeEvidence: NormalizedTemporalEvidenceProvenanceV15;
  eligibleForHistoricalTraining: boolean;
  safeguards: {
    predictorProvenanceVerified: true;
    predictorAvailableBeforeOutcome: boolean;
    outcomeEvidenceTargetOnly: true;
    outcomeSourceAvailableNoEarlierThanOutcome: boolean;
    outcomeEvidenceReplayable: boolean;
    outcomeEvidenceModeAccepted: boolean;
  };
  reasons: string[];
}

export interface HistoricalLearningCorpusManifestV15 {
  schemaVersion: typeof HISTORICAL_LEARNING_MANIFEST_SCHEMA_V15;
  recordCount: number;
  eligibleRecordCount: number;
  ineligibleRecordCount: number;
  corpusContentHash: string;
  manifestHash: string;
  recordDigests: string[];
  predictorRange: {
    earliestAvailableAt: string | null;
    latestAvailableAt: string | null;
  };
  outcomeEvidenceRange: {
    earliestSourceAvailableAt: string | null;
    latestSourceAvailableAt: string | null;
  };
  outcomeEvidenceModeCounts: Array<{ mode: string; count: number }>;
  outcomeEvidenceSourceVersions: string[];
  replayableRecords: number;
  reconstructionRecords: number;
}

export interface HistoricalLearningEvidenceSelectionV15 {
  asOf: string;
  usable: HistoricalLearningRecordV15[];
  unavailable: HistoricalLearningRecordV15[];
  advisoryOnly: HistoricalLearningRecordV15[];
  futureOrOutOfRange: HistoricalLearningRecordV15[];
  assessments: Array<{
    outcomeId: string;
    assessment: TemporalEvidenceAssessmentV15;
  }>;
}

function timestamp(name: string, value: unknown): { iso: string; ms: number } {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty timestamp.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function commanderKey(names: readonly string[]): string {
  return names.map(normalize).sort().join('|');
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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function temporalRange(values: string[]): { earliest: string | null; latest: string | null } {
  const times = values.map((value) => Date.parse(value)).filter((value) => Number.isFinite(value));
  if (times.length === 0) return { earliest: null, latest: null };
  return {
    earliest: new Date(Math.min(...times)).toISOString(),
    latest: new Date(Math.max(...times)).toISOString(),
  };
}

function modeCounts(records: HistoricalLearningRecordV15[]): Array<{ mode: string; count: number }> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const mode = record.outcomeEvidence.mode;
    counts.set(mode, (counts.get(mode) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mode, count]) => ({ mode, count }));
}

function canonicalLearningRecord(record: LearningOutcomeRecordV15): Record<string, unknown> {
  return {
    outcomeId: record.outcomeId,
    observedAt: record.observedAt,
    sourceId: record.sourceId,
    evidenceClass: record.evidenceClass,
    independentGroup: record.independentGroup,
    leakageGroup: record.leakageGroup,
    deckFingerprint: record.deckFingerprint,
    commanderNames: [...record.commanderNames].sort(),
    features: { ...record.features },
    label: record.label,
    learningTarget: record.learningTarget ?? 'legacy-unspecified',
    importance: record.importance ?? 1,
    metadata: { ...(record.metadata ?? {}) },
  };
}

function recordDigest(record: HistoricalLearningRecordV15): string {
  return sha256(stableStringify({
    schemaVersion: record.schemaVersion,
    record: canonicalLearningRecord(record.record),
    predictor: record.predictor,
    outcomeEvidence: record.outcomeEvidence,
    eligibleForHistoricalTraining: record.eligibleForHistoricalTraining,
    safeguards: record.safeguards,
    reasons: record.reasons,
  }));
}

/**
 * Binds a generic observed learning row to independently proven historical
 * predictor state and separately proven outcome-source provenance. Outcome
 * evidence remains target-only: it may occur after the predictor snapshot, but
 * it can never be treated as if it had been available to the predictor.
 */
export function createHistoricalLearningRecordV15(
  record: LearningOutcomeRecordV15,
  snapshot: ProvenancedDeckFeatureSnapshotV15,
  outcomeEvidenceProvenance: TemporalEvidenceProvenanceV15,
): HistoricalLearningRecordV15 {
  if (!record || typeof record !== 'object') throw new Error('record must be a learning outcome record.');
  assertProvenancedHistoricalFeatureSnapshotV15(snapshot);

  if (record.deckFingerprint.toLocaleLowerCase() !== snapshot.deckFingerprint.toLocaleLowerCase()) {
    throw new Error('Learning record deck fingerprint does not match the provenanced historical predictor snapshot.');
  }
  if (commanderKey(record.commanderNames) !== commanderKey(snapshot.commanderNames)) {
    throw new Error('Learning record commander identity does not match the provenanced historical predictor snapshot.');
  }

  const predictorAt = timestamp('snapshot.availableAt', snapshot.availableAt);
  const outcomeAt = timestamp('record.observedAt', record.observedAt);
  const outcomeEvidence = normalizeTemporalEvidenceProvenanceV15(outcomeEvidenceProvenance);
  if (normalize(outcomeEvidence.sourceId) !== normalize(record.sourceId)) {
    throw new Error(`Outcome evidence sourceId ${outcomeEvidence.sourceId} does not match learning record sourceId ${record.sourceId}.`);
  }
  if (outcomeEvidence.domain !== 'tournament-outcome' && outcomeEvidence.domain !== 'recorded-game') {
    throw new Error('Historical learning outcome evidence must use tournament-outcome or recorded-game domain.');
  }

  const sourceAvailableAt = timestamp('outcomeEvidence.sourceAvailableAt', outcomeEvidence.sourceAvailableAt);
  const reasons: string[] = [];
  const predictorAvailableBeforeOutcome = predictorAt.ms <= outcomeAt.ms;
  if (!predictorAvailableBeforeOutcome) {
    reasons.push('Predictor snapshot became available after the observed outcome and would leak target-era information into features.');
  }

  const outcomeSourceAvailableNoEarlierThanOutcome = sourceAvailableAt.ms >= outcomeAt.ms;
  if (!outcomeSourceAvailableNoEarlierThanOutcome) {
    reasons.push('Outcome source claims availability before the event outcome occurred; temporal ordering cannot be trusted.');
  }

  const outcomeEvidenceModeAccepted = outcomeEvidence.mode === 'contemporaneous-snapshot'
    || outcomeEvidence.mode === 'archived-versioned-snapshot';
  if (!outcomeEvidenceModeAccepted) {
    reasons.push('Trusted historical training requires contemporaneous or independently versioned archived outcome evidence, not current truth or retrospective reconstruction.');
  }
  if (outcomeEvidence.truthStatus !== 'verified-present') {
    reasons.push(`Observed learning labels require verified-present outcome evidence; received ${outcomeEvidence.truthStatus}.`);
  }
  if (!outcomeEvidence.replayable) {
    reasons.push('Outcome evidence is not deterministically replayable because source version/content hash provenance is incomplete.');
  }

  const metadataObservedAt = record.metadata?.sourceObservedAt;
  if (typeof metadataObservedAt === 'string') {
    const metadataTime = timestamp('record.metadata.sourceObservedAt', metadataObservedAt);
    const evidenceObservedAt = timestamp('outcomeEvidence.sourceObservedAt', outcomeEvidence.sourceObservedAt);
    if (metadataTime.ms !== evidenceObservedAt.ms) {
      reasons.push('Generic ingestion sourceObservedAt disagrees with the typed outcome evidence provenance.');
    }
  }

  const eligibleForHistoricalTraining = reasons.length === 0;
  return {
    schemaVersion: HISTORICAL_LEARNING_RECORD_SCHEMA_V15,
    record,
    predictor: {
      availableAt: predictorAt.iso,
      cardDataObservedAt: snapshot.cardDataObservedAt,
      cardDataSnapshotFingerprint: snapshot.cardDataSnapshotFingerprint,
      historicalCardDataMethod: snapshot.historicalCardDataProvenance.method,
      historicalCardDataSourceId: snapshot.historicalCardDataProvenance.sourceId,
      historicalCardDataSourceContentHash: snapshot.historicalCardDataProvenance.sourceContentHash,
      historicalCommanderRuleset: snapshot.historicalCommanderValidation.ruleset,
      historicalCommanderLegalityStatus: snapshot.historicalCommanderValidation.status,
    },
    outcomeEvidenceProvenance,
    outcomeEvidence,
    eligibleForHistoricalTraining,
    safeguards: {
      predictorProvenanceVerified: true,
      predictorAvailableBeforeOutcome,
      outcomeEvidenceTargetOnly: true,
      outcomeSourceAvailableNoEarlierThanOutcome,
      outcomeEvidenceReplayable: outcomeEvidence.replayable,
      outcomeEvidenceModeAccepted,
    },
    reasons,
  };
}

export function assertHistoricalLearningRecordEligibleV15(
  record: HistoricalLearningRecordV15,
): HistoricalLearningRecordV15 {
  if (!record.eligibleForHistoricalTraining) {
    throw new Error(`Historical learning record ${record.record.outcomeId} is not eligible for training: ${record.reasons.join(' ')}`);
  }
  return record;
}

/**
 * Filters already-observed outcomes for a retrospective evidence query. A later
 * tournament result is not visible to an earlier as-of date merely because it is
 * present in today's corpus. Verified unavailable/advisory states stay distinct.
 */
export function selectHistoricalLearningEvidenceAsOfV15(
  records: HistoricalLearningRecordV15[],
  asOf: string,
): HistoricalLearningEvidenceSelectionV15 {
  if (!Array.isArray(records)) throw new Error('records must be an array.');
  const normalizedAsOf = timestamp('asOf', asOf).iso;
  const output: HistoricalLearningEvidenceSelectionV15 = {
    asOf: normalizedAsOf,
    usable: [],
    unavailable: [],
    advisoryOnly: [],
    futureOrOutOfRange: [],
    assessments: [],
  };

  for (const record of records) {
    const assessment = assessTemporalEvidenceAsOfV15(record.outcomeEvidenceProvenance, normalizedAsOf);
    output.assessments.push({ outcomeId: record.record.outcomeId, assessment });
    if (assessment.usableForClaim) output.usable.push(record);
    else if (assessment.historicalUsability === 'unavailable') output.unavailable.push(record);
    else if (assessment.historicalUsability === 'advisory-only' || assessment.historicalUsability === 'current-only') {
      output.advisoryOnly.push(record);
    } else output.futureOrOutOfRange.push(record);
  }
  return output;
}

export function buildHistoricalLearningCorpusManifestV15(
  records: HistoricalLearningRecordV15[],
): HistoricalLearningCorpusManifestV15 {
  if (!Array.isArray(records)) throw new Error('records must be an array.');
  const recordDigests = records.map(recordDigest).sort();
  const corpusContentHash = sha256(recordDigests.join('\n'));
  const predictor = temporalRange(records.map((record) => record.predictor.availableAt));
  const evidence = temporalRange(records.map((record) => record.outcomeEvidence.sourceAvailableAt));
  const sourceVersions = [...new Set(records.flatMap((record) =>
    record.outcomeEvidence.sourceVersion ? [record.outcomeEvidence.sourceVersion] : []))].sort();
  const withoutHash = {
    schemaVersion: HISTORICAL_LEARNING_MANIFEST_SCHEMA_V15,
    recordCount: records.length,
    eligibleRecordCount: records.filter((record) => record.eligibleForHistoricalTraining).length,
    ineligibleRecordCount: records.filter((record) => !record.eligibleForHistoricalTraining).length,
    corpusContentHash,
    recordDigests,
    predictorRange: {
      earliestAvailableAt: predictor.earliest,
      latestAvailableAt: predictor.latest,
    },
    outcomeEvidenceRange: {
      earliestSourceAvailableAt: evidence.earliest,
      latestSourceAvailableAt: evidence.latest,
    },
    outcomeEvidenceModeCounts: modeCounts(records),
    outcomeEvidenceSourceVersions: sourceVersions,
    replayableRecords: records.filter((record) => record.outcomeEvidence.replayable).length,
    reconstructionRecords: records.filter((record) => record.outcomeEvidence.mode === 'retrospective-reconstruction').length,
  };
  return {
    ...withoutHash,
    manifestHash: sha256(stableStringify(withoutHash)),
  };
}
