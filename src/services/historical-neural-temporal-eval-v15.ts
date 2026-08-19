import {
  assertHistoricalLearningRecordEligibleV15,
  selectHistoricalLearningEvidenceAsOfV15,
  type HistoricalLearningEvidenceSelectionV15,
  type HistoricalLearningRecordV15,
} from './historical-learning-corpus-v15.js';
import {
  evaluateNeuralOnTemporalCorpusV15,
  type NeuralTemporalEvaluationV15,
} from './neural-temporal-eval-v15.js';
import type { NeuralRankerOptionsV15 } from './neural-ranker-v15.js';

export const HISTORICAL_NEURAL_TEMPORAL_EVAL_SCHEMA_V15 = 'historical-neural-temporal-eval-v15.1' as const;

export interface HistoricalNeuralTemporalEvaluationV15 {
  schemaVersion: typeof HISTORICAL_NEURAL_TEMPORAL_EVAL_SCHEMA_V15;
  asOf: string;
  inputRecords: number;
  historicallyEligibleInputRecords: number;
  usableRecordsAsOf: number;
  unavailableRecordsAsOf: number;
  advisoryOnlyRecordsAsOf: number;
  futureOrOutOfRangeRecordsAsOf: number;
  selectedOutcomeIds: string[];
  excludedOutcomeIds: {
    unavailable: string[];
    advisoryOnly: string[];
    futureOrOutOfRange: string[];
  };
  provenanceGate: {
    allInputsHistoricallyEligible: true;
    onlyEvidenceAvailableAsOfUsed: true;
    retrospectiveReconstructionsUsedForTraining: false;
    presentDayCurrentTruthUsedForHistoricalTraining: false;
    unavailableEvidenceCountedAsAbsence: false;
  };
  evidenceSelection: HistoricalLearningEvidenceSelectionV15;
  evaluation: NeuralTemporalEvaluationV15;
  warnings: string[];
}

function normalizedTimestamp(name: string, value: unknown): { iso: string; ms: number } {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty timestamp.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function outcomeIds(records: HistoricalLearningRecordV15[]): string[] {
  return records.map((record) => record.record.outcomeId).sort();
}

/**
 * Historical model evaluation is deliberately a stricter API than ordinary
 * temporal evaluation. Callers cannot pass today's generic corpus plus an old
 * date and call the result historical. Every input must first satisfy the strict
 * historical record contract; then only outcome evidence independently available
 * by `asOf` is allowed into the existing leakage-safe temporal evaluator.
 *
 * Retrospective reconstructions, present-day current truth, unavailable evidence,
 * and future outcomes remain visible in the audit but are never training rows.
 */
export function evaluateNeuralOnHistoricalCorpusAsOfV15(
  records: HistoricalLearningRecordV15[],
  asOf: string,
  options: NeuralRankerOptionsV15 & { holdoutFraction?: number } = {},
): HistoricalNeuralTemporalEvaluationV15 {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('At least one historically provenanced learning record is required.');
  }
  const cutoff = normalizedTimestamp('asOf', asOf);

  for (const record of records) {
    if (!record || typeof record !== 'object') throw new Error('Every historical model-evaluation input must be a historical learning record.');
    assertHistoricalLearningRecordEligibleV15(record);
  }

  const evidenceSelection = selectHistoricalLearningEvidenceAsOfV15(records, cutoff.iso);
  if (evidenceSelection.usable.length === 0) {
    throw new Error(
      `No verified historical outcome evidence was independently available by ${cutoff.iso}; model evaluation is blocked rather than substituting newer evidence.`,
    );
  }

  for (const record of evidenceSelection.usable) {
    const predictorAt = normalizedTimestamp('record.predictor.availableAt', record.predictor.availableAt);
    if (predictorAt.ms > cutoff.ms) {
      throw new Error(
        `Internal historical evidence gate failure: selected record ${record.record.outcomeId} has predictor state available only after the requested as-of time.`,
      );
    }
    if (record.outcomeEvidence.mode === 'retrospective-reconstruction') {
      throw new Error('Internal historical evidence gate failure: retrospective reconstruction reached model training input.');
    }
    if (record.outcomeEvidence.mode === 'current-truth') {
      throw new Error('Internal historical evidence gate failure: present-day current truth reached historical model training input.');
    }
    if (record.outcomeEvidence.truthStatus !== 'verified-present') {
      throw new Error(
        `Internal historical evidence gate failure: ${record.outcomeEvidence.truthStatus} evidence reached observed-outcome training input.`,
      );
    }
  }

  const evaluation = evaluateNeuralOnTemporalCorpusV15(
    evidenceSelection.usable.map((record) => record.record),
    options,
  );
  const warnings: string[] = [];
  if (evidenceSelection.unavailable.length > 0) {
    warnings.push(
      `${evidenceSelection.unavailable.length} historical outcome record(s) had unavailable truth and were excluded without being treated as negative evidence.`,
    );
  }
  if (evidenceSelection.advisoryOnly.length > 0) {
    warnings.push(
      `${evidenceSelection.advisoryOnly.length} retrospective/current-proxy outcome record(s) were advisory only and excluded from model input.`,
    );
  }
  if (evidenceSelection.futureOrOutOfRange.length > 0) {
    warnings.push(
      `${evidenceSelection.futureOrOutOfRange.length} outcome record(s) were not independently available by the requested as-of time and were excluded.`,
    );
  }

  return {
    schemaVersion: HISTORICAL_NEURAL_TEMPORAL_EVAL_SCHEMA_V15,
    asOf: cutoff.iso,
    inputRecords: records.length,
    historicallyEligibleInputRecords: records.length,
    usableRecordsAsOf: evidenceSelection.usable.length,
    unavailableRecordsAsOf: evidenceSelection.unavailable.length,
    advisoryOnlyRecordsAsOf: evidenceSelection.advisoryOnly.length,
    futureOrOutOfRangeRecordsAsOf: evidenceSelection.futureOrOutOfRange.length,
    selectedOutcomeIds: outcomeIds(evidenceSelection.usable),
    excludedOutcomeIds: {
      unavailable: outcomeIds(evidenceSelection.unavailable),
      advisoryOnly: outcomeIds(evidenceSelection.advisoryOnly),
      futureOrOutOfRange: outcomeIds(evidenceSelection.futureOrOutOfRange),
    },
    provenanceGate: {
      allInputsHistoricallyEligible: true,
      onlyEvidenceAvailableAsOfUsed: true,
      retrospectiveReconstructionsUsedForTraining: false,
      presentDayCurrentTruthUsedForHistoricalTraining: false,
      unavailableEvidenceCountedAsAbsence: false,
    },
    evidenceSelection,
    evaluation,
    warnings,
  };
}
