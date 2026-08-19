import {
  assertHistoricalLearningRecordEligibleV15,
  type HistoricalLearningRecordV15,
} from './historical-learning-corpus-v15.js';
import { learningTargetForRecordV15 } from './learning-corpus-v15.js';
import {
  assertFutureHoldoutSealV15,
  assertTrainingRecordsMatchFutureHoldoutSealV15,
  type FutureHoldoutSealV15,
} from './future-holdout-seal-v15.js';
import {
  scoreCandidateWithNeuralV15,
  trainNeuralRankerV15,
} from './neural-ranker-v15.js';
import {
  scoreCandidateWithLearningV15,
  trainAdaptiveRankerV15,
  type LearningExampleV15,
} from './research-learning-v15.js';
import { auditRealCorpusQualityV15, type RealCorpusQualityAuditV15 } from './real-corpus-quality-v15.js';
import { sourceCanTrainTargetV15 } from './real-outcome-source-inventory-v15.js';

export const SEALED_FUTURE_MODEL_EVAL_SCHEMA_V15 = 'sealed-future-model-eval-v15.1' as const;

export interface CalibrationBinV15 {
  lowerInclusive: number;
  upperInclusive: number;
  examples: number;
  meanProbability: number | null;
  observedPositiveRate: number | null;
  absoluteGap: number | null;
}

export interface FutureModelMetricsV15 {
  examples: number;
  positiveExamples: number;
  negativeExamples: number;
  accuracy: number | null;
  balancedAccuracy: number | null;
  logLoss: number | null;
  brierScore: number | null;
  auroc: number | null;
  expectedCalibrationError: number | null;
  accuracy95Ci: { lower: number; upper: number } | null;
  calibration: CalibrationBinV15[];
}

export interface FutureSubgroupEvaluationV15 {
  dimension: 'source' | 'commander' | 'field-size';
  key: string;
  examples: number;
  neural: FutureModelMetricsV15;
  transparent: FutureModelMetricsV15;
}

export interface SealedFutureModelEvaluationV15 {
  schemaVersion: typeof SEALED_FUTURE_MODEL_EVAL_SCHEMA_V15;
  sealHash: string;
  sealedAt: string;
  evaluatedAt: string;
  learningTarget: string;
  trainingRecords: number;
  futureHoldoutRecords: number;
  trainingQuality: RealCorpusQualityAuditV15;
  futureHoldoutQuality: RealCorpusQualityAuditV15;
  futureGate: {
    allHoldoutOutcomesOccurredAfterSeal: true;
    allHoldoutEvidenceAvailableAfterSeal: true;
    allHoldoutEvidenceAvailableByEvaluation: true;
    sealClockAttested: boolean;
    featureContractMatchesSeal: true;
    featureNormalizerMatchesSeal: true;
    sourceTargetPoliciesPass: true;
    leakageGroupsDisjoint: true;
    providerEventsDisjoint: true;
    pilotIdentitiesDisjoint: true;
    exactDeckFingerprintsDisjoint: true;
  };
  prevalenceBaselineProbability: number;
  prevalenceMetrics: FutureModelMetricsV15;
  transparentModel: ReturnType<typeof trainAdaptiveRankerV15>;
  transparentMetrics: FutureModelMetricsV15;
  neuralModel: ReturnType<typeof trainNeuralRankerV15>;
  neuralMetrics: FutureModelMetricsV15;
  neuralImprovement: {
    accuracy: number | null;
    balancedAccuracy: number | null;
    logLoss: number | null;
    brierScore: number | null;
    auroc: number | null;
    expectedCalibrationError: number | null;
  };
  subgroups: FutureSubgroupEvaluationV15[];
  usefulness: 'insufficient-future-evidence' | 'no-demonstrated-neural-gain' | 'shadow-gain-observed';
  usefulnessReasons: string[];
  promotionAuthorized: false;
  warnings: string[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function timestamp(name: string, value: unknown): { iso: string; ms: number } {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty timestamp.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function toExample(record: HistoricalLearningRecordV15): LearningExampleV15 {
  return {
    features: { ...record.record.features },
    label: record.record.label,
    ...(record.record.importance !== undefined ? { importance: record.record.importance } : {}),
  };
}

function hardChecksPass() {
  return {
    commanderLegal: true,
    fullyResolved: true,
    exactCardCount: true,
    printingPolicyCompliant: true,
  } as const;
}

function binaryLogLoss(label: number, probability: number): number {
  const p = clamp(probability, 1e-9, 1 - 1e-9);
  return -(label * Math.log(p) + (1 - label) * Math.log(1 - p));
}

function wilson95(correct: number, total: number): { lower: number; upper: number } | null {
  if (total <= 0) return null;
  const z = 1.959963984540054;
  const p = correct / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const centre = (p + z2 / (2 * total)) / denominator;
  const half = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / denominator;
  return { lower: round(Math.max(0, centre - half)), upper: round(Math.min(1, centre + half)) };
}

function auroc(labels: number[], probabilities: number[]): number | null {
  const positives = labels.filter((label) => label === 1).length;
  const negatives = labels.length - positives;
  if (positives === 0 || negatives === 0) return null;
  const ranked = probabilities.map((probability, index) => ({ probability, label: labels[index] ?? 0 }));
  ranked.sort((a, b) => a.probability - b.probability);
  let rank = 1;
  let positiveRankSum = 0;
  for (let index = 0; index < ranked.length;) {
    let end = index + 1;
    while (end < ranked.length && ranked[end]?.probability === ranked[index]?.probability) end += 1;
    const startRank = rank;
    const endRank = rank + (end - index) - 1;
    const averageRank = (startRank + endRank) / 2;
    for (let cursor = index; cursor < end; cursor += 1) {
      if (ranked[cursor]?.label === 1) positiveRankSum += averageRank;
    }
    rank += end - index;
    index = end;
  }
  const value = (positiveRankSum - positives * (positives + 1) / 2) / (positives * negatives);
  return round(value);
}

function modelMetrics(
  labels: number[],
  probabilities: number[],
  threshold: number,
  calibrationBins: number,
): FutureModelMetricsV15 {
  if (labels.length !== probabilities.length) throw new Error('Metric labels and probabilities must have equal length.');
  const examples = labels.length;
  if (examples === 0) {
    return {
      examples: 0,
      positiveExamples: 0,
      negativeExamples: 0,
      accuracy: null,
      balancedAccuracy: null,
      logLoss: null,
      brierScore: null,
      auroc: null,
      expectedCalibrationError: null,
      accuracy95Ci: null,
      calibration: [],
    };
  }
  let correct = 0;
  let truePositive = 0;
  let trueNegative = 0;
  let loss = 0;
  let brier = 0;
  const positiveExamples = labels.filter((label) => label === 1).length;
  const negativeExamples = examples - positiveExamples;
  const binCounts = Array.from({ length: calibrationBins }, () => 0);
  const binProbabilities = Array.from({ length: calibrationBins }, () => 0);
  const binLabels = Array.from({ length: calibrationBins }, () => 0);

  for (let index = 0; index < examples; index += 1) {
    const label = labels[index] ?? 0;
    const probability = clamp(probabilities[index] ?? 0, 0, 1);
    const predicted = probability >= threshold ? 1 : 0;
    if (predicted === label) correct += 1;
    if (predicted === 1 && label === 1) truePositive += 1;
    if (predicted === 0 && label === 0) trueNegative += 1;
    loss += binaryLogLoss(label, probability);
    brier += (probability - label) ** 2;
    const bin = Math.min(calibrationBins - 1, Math.floor(probability * calibrationBins));
    binCounts[bin] = (binCounts[bin] ?? 0) + 1;
    binProbabilities[bin] = (binProbabilities[bin] ?? 0) + probability;
    binLabels[bin] = (binLabels[bin] ?? 0) + label;
  }

  const positiveRecall = positiveExamples > 0 ? truePositive / positiveExamples : null;
  const negativeRecall = negativeExamples > 0 ? trueNegative / negativeExamples : null;
  const balancedAccuracy = positiveRecall === null || negativeRecall === null ? null : (positiveRecall + negativeRecall) / 2;
  let ece = 0;
  const calibration: CalibrationBinV15[] = [];
  for (let index = 0; index < calibrationBins; index += 1) {
    const count = binCounts[index] ?? 0;
    const meanProbability = count > 0 ? (binProbabilities[index] ?? 0) / count : null;
    const observedPositiveRate = count > 0 ? (binLabels[index] ?? 0) / count : null;
    const gap = meanProbability === null || observedPositiveRate === null ? null : Math.abs(meanProbability - observedPositiveRate);
    if (gap !== null) ece += (count / examples) * gap;
    calibration.push({
      lowerInclusive: round(index / calibrationBins),
      upperInclusive: round((index + 1) / calibrationBins),
      examples: count,
      meanProbability: meanProbability === null ? null : round(meanProbability),
      observedPositiveRate: observedPositiveRate === null ? null : round(observedPositiveRate),
      absoluteGap: gap === null ? null : round(gap),
    });
  }

  return {
    examples,
    positiveExamples,
    negativeExamples,
    accuracy: round(correct / examples),
    balancedAccuracy: balancedAccuracy === null ? null : round(balancedAccuracy),
    logLoss: round(loss / examples),
    brierScore: round(brier / examples),
    auroc: auroc(labels, probabilities),
    expectedCalibrationError: round(ece),
    accuracy95Ci: wilson95(correct, examples),
    calibration,
  };
}

function difference(candidate: number | null, baseline: number | null, lowerIsBetter = false): number | null {
  if (candidate === null || baseline === null) return null;
  return round(lowerIsBetter ? baseline - candidate : candidate - baseline);
}

function metadataString(record: HistoricalLearningRecordV15, key: string): string | null {
  const value = record.record.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function metadataNumber(record: HistoricalLearningRecordV15, key: string): number | null {
  const value = record.record.metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fieldSizeBucket(record: HistoricalLearningRecordV15): string {
  const size = metadataNumber(record, 'fieldSize');
  if (size === null || !Number.isInteger(size) || size < 1) return 'missing';
  if (size < 16) return '1-15';
  if (size < 32) return '16-31';
  if (size < 64) return '32-63';
  if (size < 128) return '64-127';
  return '128+';
}

function commanderKey(record: HistoricalLearningRecordV15): string {
  return record.record.commanderNames.map((name) => name.trim()).sort().join(' / ');
}

function scoreTransparent(
  records: HistoricalLearningRecordV15[],
  model: ReturnType<typeof trainAdaptiveRankerV15>,
): number[] {
  return records.map((record) => {
    const score = scoreCandidateWithLearningV15(record.record.features, model, hardChecksPass());
    if (!score.eligible || score.probability === null) throw new Error('Transparent future-holdout scoring unexpectedly failed hard gates.');
    return score.probability;
  });
}

function scoreNeural(
  records: HistoricalLearningRecordV15[],
  model: ReturnType<typeof trainNeuralRankerV15>,
): number[] {
  return records.map((record) => {
    const score = scoreCandidateWithNeuralV15(record.record.features, model, hardChecksPass());
    if (!score.eligible || score.probability === null) throw new Error('Neural future-holdout scoring unexpectedly failed hard gates.');
    return score.probability;
  });
}

function identities(records: HistoricalLearningRecordV15[], key: 'providerEventId' | 'providerPlayerId'): Set<string> {
  return new Set(records.flatMap((record) => {
    const value = metadataString(record, key);
    return value ? [`${normalize(record.record.sourceId)}:${normalize(value)}`] : [];
  }));
}

function overlap(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => right.has(value)).sort();
}

function subgroupEvaluations(
  records: HistoricalLearningRecordV15[],
  transparentProbabilities: number[],
  neuralProbabilities: number[],
  threshold: number,
  calibrationBins: number,
): FutureSubgroupEvaluationV15[] {
  const groups = new Map<string, { dimension: FutureSubgroupEvaluationV15['dimension']; key: string; indices: number[] }>();
  const add = (dimension: FutureSubgroupEvaluationV15['dimension'], key: string, index: number) => {
    const mapKey = `${dimension}|${key}`;
    const group = groups.get(mapKey) ?? { dimension, key, indices: [] };
    group.indices.push(index);
    groups.set(mapKey, group);
  };
  const commanderCounts = new Map<string, number>();
  for (const record of records) {
    const commander = commanderKey(record);
    commanderCounts.set(commander, (commanderCounts.get(commander) ?? 0) + 1);
  }
  const topCommanders = new Set(
    [...commanderCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([key]) => key),
  );
  records.forEach((record, index) => {
    add('source', normalize(record.record.sourceId), index);
    add('field-size', fieldSizeBucket(record), index);
    const commander = commanderKey(record);
    if (topCommanders.has(commander)) add('commander', commander, index);
  });
  return [...groups.values()]
    .sort((a, b) => a.dimension.localeCompare(b.dimension) || b.indices.length - a.indices.length || a.key.localeCompare(b.key))
    .map((group) => {
      const labels = group.indices.map((index) => records[index]?.record.label ?? 0);
      const transparent = group.indices.map((index) => transparentProbabilities[index] ?? 0);
      const neural = group.indices.map((index) => neuralProbabilities[index] ?? 0);
      return {
        dimension: group.dimension,
        key: group.key,
        examples: group.indices.length,
        neural: modelMetrics(labels, neural, threshold, calibrationBins),
        transparent: modelMetrics(labels, transparent, threshold, calibrationBins),
      };
    });
}

/**
 * Evaluates exactly one precommitted model plan against genuinely later outcome
 * evidence. It does not perform a new temporal split and it does not accept new
 * tuning parameters: everything tunable was frozen into the seal before the
 * holdout outcomes occurred.
 */
export function evaluateSealedFutureHoldoutV15(
  seal: FutureHoldoutSealV15,
  trainingRecords: HistoricalLearningRecordV15[],
  futureHoldoutRecords: HistoricalLearningRecordV15[],
): SealedFutureModelEvaluationV15 {
  assertFutureHoldoutSealV15(seal);
  assertTrainingRecordsMatchFutureHoldoutSealV15(seal, trainingRecords);
  if (!Array.isArray(futureHoldoutRecords) || futureHoldoutRecords.length === 0) throw new Error('At least one future holdout record is required.');
  for (const record of futureHoldoutRecords) assertHistoricalLearningRecordEligibleV15(record);

  const sealTime = timestamp('seal.sealedAt', seal.sealedAt);
  const evaluationDate = new Date();
  if (!Number.isFinite(evaluationDate.getTime())) throw new Error('Evaluator system clock is invalid.');
  const evaluatedAt = { iso: evaluationDate.toISOString(), ms: evaluationDate.getTime() };
  for (const record of futureHoldoutRecords) {
    const outcome = timestamp('future.record.observedAt', record.record.observedAt);
    const available = timestamp('future.outcomeEvidence.sourceAvailableAt', record.outcomeEvidence.sourceAvailableAt);
    if (outcome.ms <= sealTime.ms) throw new Error(`Future holdout record ${record.record.outcomeId} did not occur after the precommitment seal.`);
    if (available.ms <= sealTime.ms) throw new Error(`Future holdout record ${record.record.outcomeId} was source-available before or at the precommitment seal.`);
    if (available.ms > evaluatedAt.ms) throw new Error(`Future holdout record ${record.record.outcomeId} claims source availability after the evaluator system clock.`);
    if (learningTargetForRecordV15(record.record) !== seal.learningTarget) {
      throw new Error(`Future holdout record ${record.record.outcomeId} uses a different learning target from the seal.`);
    }
    if (!sourceCanTrainTargetV15(record.record.sourceId, seal.learningTarget)) {
      throw new Error(`Future holdout source ${record.record.sourceId} is not enabled for strict ${seal.learningTarget} model evaluation.`);
    }
    if (metadataString(record, 'featureExtractorId') !== seal.featureExtractorContract) {
      throw new Error(`Future holdout record ${record.record.outcomeId} does not use the sealed feature extractor contract.`);
    }
    const normalizer = metadataString(record, 'featureNormalizerFitFingerprint')?.toLocaleLowerCase() ?? null;
    if (normalizer !== seal.featureNormalizerFitFingerprint) {
      throw new Error(`Future holdout record ${record.record.outcomeId} does not use the sealed training-fitted normalizer.`);
    }
  }

  const trainingLeakage = new Set(trainingRecords.map((record) => normalize(record.record.leakageGroup)));
  const futureLeakage = new Set(futureHoldoutRecords.map((record) => normalize(record.record.leakageGroup)));
  const leakageOverlap = overlap(trainingLeakage, futureLeakage);
  if (leakageOverlap.length > 0) throw new Error(`Training/future leakage groups overlap: ${leakageOverlap.slice(0, 10).join(', ')}.`);

  const eventOverlap = overlap(identities(trainingRecords, 'providerEventId'), identities(futureHoldoutRecords, 'providerEventId'));
  if (eventOverlap.length > 0) throw new Error(`Training/future provider event identities overlap: ${eventOverlap.slice(0, 10).join(', ')}.`);
  const pilotOverlap = overlap(identities(trainingRecords, 'providerPlayerId'), identities(futureHoldoutRecords, 'providerPlayerId'));
  if (pilotOverlap.length > 0) throw new Error(`Training/future pilot identities overlap: ${pilotOverlap.slice(0, 10).join(', ')}.`);
  const trainingDecks = new Set(trainingRecords.map((record) => record.record.deckFingerprint.toLocaleLowerCase()));
  const futureDecks = new Set(futureHoldoutRecords.map((record) => record.record.deckFingerprint.toLocaleLowerCase()));
  const deckOverlap = overlap(trainingDecks, futureDecks);
  if (deckOverlap.length > 0) throw new Error(`Training/future exact deck fingerprints overlap (${deckOverlap.length} deck(s)); the sealed generalization holdout requires unseen exact decks.`);

  const trainingQuality = auditRealCorpusQualityV15(trainingRecords);
  const futureHoldoutQuality = auditRealCorpusQualityV15(futureHoldoutRecords);
  const trainingExamples = trainingRecords.map(toExample);
  const transparentModel = trainAdaptiveRankerV15(trainingExamples, {
    ...seal.evaluationPlan.transparent,
    minimumExamples: Math.max(10, trainingExamples.length + 1),
    minimumHoldoutAccuracy: 1,
  });
  const neuralModel = trainNeuralRankerV15(trainingExamples, seal.evaluationPlan.neural);
  const transparentProbabilities = scoreTransparent(futureHoldoutRecords, transparentModel);
  const neuralProbabilities = scoreNeural(futureHoldoutRecords, neuralModel);
  const labels = futureHoldoutRecords.map((record) => record.record.label);
  const prevalence = trainingRecords.filter((record) => record.record.label === 1).length / trainingRecords.length;
  const prevalenceProbabilities = futureHoldoutRecords.map(() => prevalence);
  const threshold = seal.evaluationPlan.decisionThreshold;
  const bins = seal.evaluationPlan.calibrationBins;
  const prevalenceMetrics = modelMetrics(labels, prevalenceProbabilities, threshold, bins);
  const transparentMetrics = modelMetrics(labels, transparentProbabilities, threshold, bins);
  const neuralMetrics = modelMetrics(labels, neuralProbabilities, threshold, bins);
  const improvement = {
    accuracy: difference(neuralMetrics.accuracy, transparentMetrics.accuracy),
    balancedAccuracy: difference(neuralMetrics.balancedAccuracy, transparentMetrics.balancedAccuracy),
    logLoss: difference(neuralMetrics.logLoss, transparentMetrics.logLoss, true),
    brierScore: difference(neuralMetrics.brierScore, transparentMetrics.brierScore, true),
    auroc: difference(neuralMetrics.auroc, transparentMetrics.auroc),
    expectedCalibrationError: difference(neuralMetrics.expectedCalibrationError, transparentMetrics.expectedCalibrationError, true),
  };

  const reasons: string[] = [];
  const warnings = [...futureHoldoutQuality.warnings];
  const minorityShare = futureHoldoutRecords.length > 0
    ? Math.min(neuralMetrics.positiveExamples, neuralMetrics.negativeExamples) / futureHoldoutRecords.length
    : 0;
  let usefulness: SealedFutureModelEvaluationV15['usefulness'] = 'no-demonstrated-neural-gain';
  if (seal.clockAttestation !== 'system-clock') {
    reasons.push('The holdout seal used an injected test clock, so it cannot support a genuine future-evidence usefulness claim.');
  }
  if (futureHoldoutRecords.length < seal.evaluationPlan.minimumFutureHoldoutRecordsForUsefulnessClaim) {
    reasons.push(`Need at least ${seal.evaluationPlan.minimumFutureHoldoutRecordsForUsefulnessClaim} genuinely future holdout records before a usefulness claim.`);
  }
  if (minorityShare < seal.evaluationPlan.minimumFutureHoldoutMinorityShare) {
    reasons.push(`Future holdout minority share ${round(minorityShare)} is below the locked ${seal.evaluationPlan.minimumFutureHoldoutMinorityShare} requirement.`);
  }
  if (!futureHoldoutQuality.qualityGatePassed) reasons.push(...futureHoldoutQuality.blockers.map((reason) => `Future holdout quality: ${reason}`));
  if (neuralMetrics.auroc === null || transparentMetrics.auroc === null || neuralMetrics.balancedAccuracy === null || transparentMetrics.balancedAccuracy === null) {
    reasons.push('Future holdout lacks both outcome classes required for discrimination and balanced-accuracy comparison.');
  }
  if (reasons.length > 0) {
    usefulness = 'insufficient-future-evidence';
  } else {
    const balancedGain = improvement.balancedAccuracy ?? Number.NEGATIVE_INFINITY;
    const aucGain = improvement.auroc ?? Number.NEGATIVE_INFINITY;
    const logLossGain = improvement.logLoss ?? Number.NEGATIVE_INFINITY;
    if (balancedGain >= seal.evaluationPlan.minimumBalancedAccuracyGainOverTransparent
      && aucGain >= seal.evaluationPlan.minimumAuRocGainOverTransparent
      && logLossGain >= -seal.evaluationPlan.maximumLogLossRegressionVsTransparent) {
      usefulness = 'shadow-gain-observed';
      reasons.push('Neural shadow model met the precommitted future-holdout improvement criteria. This is evidence for continued shadow testing, not stable promotion.');
    } else {
      usefulness = 'no-demonstrated-neural-gain';
      reasons.push('Neural shadow model did not meet all precommitted balanced-accuracy, AUROC, and log-loss improvement criteria on the genuine future holdout.');
    }
  }
  if (trainingQuality.independentLineageFamilies < 2 || futureHoldoutQuality.independentLineageFamilies < 2) {
    warnings.push('Evaluation still lacks cross-lineage provider diversity; a model that works on one provider lineage may not generalize to other Commander populations.');
  }

  return {
    schemaVersion: SEALED_FUTURE_MODEL_EVAL_SCHEMA_V15,
    sealHash: seal.sealHash,
    sealedAt: seal.sealedAt,
    evaluatedAt: evaluatedAt.iso,
    learningTarget: seal.learningTarget,
    trainingRecords: trainingRecords.length,
    futureHoldoutRecords: futureHoldoutRecords.length,
    trainingQuality,
    futureHoldoutQuality,
    futureGate: {
      allHoldoutOutcomesOccurredAfterSeal: true,
      allHoldoutEvidenceAvailableAfterSeal: true,
      allHoldoutEvidenceAvailableByEvaluation: true,
      sealClockAttested: seal.clockAttestation === 'system-clock',
      featureContractMatchesSeal: true,
      featureNormalizerMatchesSeal: true,
      sourceTargetPoliciesPass: true,
      leakageGroupsDisjoint: true,
      providerEventsDisjoint: true,
      pilotIdentitiesDisjoint: true,
      exactDeckFingerprintsDisjoint: true,
    },
    prevalenceBaselineProbability: round(prevalence),
    prevalenceMetrics,
    transparentModel,
    transparentMetrics,
    neuralModel,
    neuralMetrics,
    neuralImprovement: improvement,
    subgroups: subgroupEvaluations(futureHoldoutRecords, transparentProbabilities, neuralProbabilities, threshold, bins),
    usefulness,
    usefulnessReasons: reasons,
    promotionAuthorized: false,
    warnings,
  };
}
