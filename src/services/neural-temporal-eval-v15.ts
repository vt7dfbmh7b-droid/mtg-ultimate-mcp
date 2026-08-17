import {
  auditLearningCorpusV15,
  temporalSplitLearningCorpusV15,
  type LearningOutcomeRecordV15,
} from './learning-corpus-v15.js';
import { detectMetagameDriftV15 } from './metagame-drift-v15.js';
import {
  scoreCandidateWithNeuralV15,
  trainNeuralRankerV15,
  type NeuralRankerOptionsV15,
} from './neural-ranker-v15.js';
import {
  evaluateDeepLearningReadinessV15,
  scoreCandidateWithLearningV15,
  trainAdaptiveRankerV15,
  type AdaptiveRankerV15,
  type LearningExampleV15,
} from './research-learning-v15.js';

export interface TemporalModelMetricsV15 {
  examples: number;
  positiveExamples: number;
  negativeExamples: number;
  correct: number;
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  accuracy: number | null;
  balancedAccuracy: number | null;
  logLoss: number | null;
  brierScore: number | null;
}

export interface NeuralTemporalEvaluationV15 {
  corpusAudit: ReturnType<typeof auditLearningCorpusV15>;
  metagameDrift: ReturnType<typeof detectMetagameDriftV15>;
  split: {
    trainingRecords: number;
    holdoutRecords: number;
    trainingPositiveExamples: number;
    trainingNegativeExamples: number;
    holdoutPositiveExamples: number;
    holdoutNegativeExamples: number;
    cutoff: string | null;
    leakageChecksPassed: boolean;
    overlappingLeakageGroups: string[];
  };
  neuralModel: ReturnType<typeof trainNeuralRankerV15> | null;
  transparentModel: AdaptiveRankerV15 | null;
  neuralTemporalMetrics: TemporalModelMetricsV15;
  transparentTemporalMetrics: TemporalModelMetricsV15;
  temporalAccuracyImprovement: number | null;
  temporalBalancedAccuracyImprovement: number | null;
  temporalLogLossImprovement: number | null;
  evaluationWarnings: string[];
  readiness: ReturnType<typeof evaluateDeepLearningReadinessV15>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function binaryLogLoss(label: number, probability: number): number {
  const p = clamp(probability, 1e-9, 1 - 1e-9);
  return -(label * Math.log(p) + (1 - label) * Math.log(1 - p));
}

function allHardChecksPass() {
  return {
    commanderLegal: true,
    fullyResolved: true,
    exactCardCount: true,
    printingPolicyCompliant: true,
  } as const;
}

function emptyMetrics(): TemporalModelMetricsV15 {
  return {
    examples: 0,
    positiveExamples: 0,
    negativeExamples: 0,
    correct: 0,
    truePositive: 0,
    trueNegative: 0,
    falsePositive: 0,
    falseNegative: 0,
    accuracy: null,
    balancedAccuracy: null,
    logLoss: null,
    brierScore: null,
  };
}

function finalizeMetrics(
  holdout: LearningExampleV15[],
  probabilities: number[],
): TemporalModelMetricsV15 {
  if (holdout.length === 0) return emptyMetrics();
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let loss = 0;
  let brier = 0;
  let positiveExamples = 0;

  for (let index = 0; index < holdout.length; index += 1) {
    const example = holdout[index];
    const probability = probabilities[index];
    if (!example || probability === undefined) throw new Error('Temporal metrics received mismatched examples and probabilities.');
    const prediction = probability >= 0.5 ? 1 : 0;
    if (example.label === 1) positiveExamples += 1;
    if (prediction === 1 && example.label === 1) truePositive += 1;
    else if (prediction === 0 && example.label === 0) trueNegative += 1;
    else if (prediction === 1 && example.label === 0) falsePositive += 1;
    else falseNegative += 1;
    loss += binaryLogLoss(example.label, probability);
    brier += (probability - example.label) ** 2;
  }

  const negativeExamples = holdout.length - positiveExamples;
  const correct = truePositive + trueNegative;
  const positiveRecall = positiveExamples > 0 ? truePositive / positiveExamples : null;
  const negativeRecall = negativeExamples > 0 ? trueNegative / negativeExamples : null;
  const balancedAccuracy = positiveRecall === null || negativeRecall === null
    ? null
    : (positiveRecall + negativeRecall) / 2;

  return {
    examples: holdout.length,
    positiveExamples,
    negativeExamples,
    correct,
    truePositive,
    trueNegative,
    falsePositive,
    falseNegative,
    accuracy: round(correct / holdout.length),
    balancedAccuracy: balancedAccuracy === null ? null : round(balancedAccuracy),
    logLoss: round(loss / holdout.length),
    brierScore: round(brier / holdout.length),
  };
}

function evaluateTransparent(model: AdaptiveRankerV15, holdout: LearningExampleV15[]): TemporalModelMetricsV15 {
  if (holdout.length === 0) return emptyMetrics();
  const probabilities: number[] = [];
  for (const example of holdout) {
    const scored = scoreCandidateWithLearningV15(example.features, model, allHardChecksPass());
    if (!scored.eligible || scored.probability === null) throw new Error('Transparent temporal evaluation unexpectedly failed hard gates.');
    probabilities.push(scored.probability);
  }
  return finalizeMetrics(holdout, probabilities);
}

function evaluateNeural(
  model: ReturnType<typeof trainNeuralRankerV15>,
  holdout: LearningExampleV15[],
): TemporalModelMetricsV15 {
  if (holdout.length === 0) return emptyMetrics();
  const probabilities: number[] = [];
  for (const example of holdout) {
    const scored = scoreCandidateWithNeuralV15(example.features, model, allHardChecksPass());
    if (!scored.eligible || scored.probability === null) throw new Error('Neural temporal evaluation unexpectedly failed hard gates.');
    probabilities.push(scored.probability);
  }
  return finalizeMetrics(holdout, probabilities);
}

function countLabels(examples: LearningExampleV15[]): { positive: number; negative: number } {
  const positive = examples.filter((example) => example.label === 1).length;
  return { positive, negative: examples.length - positive };
}

function nullableDifference(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : round(left - right);
}

export function evaluateNeuralOnTemporalCorpusV15(
  records: LearningOutcomeRecordV15[],
  options: NeuralRankerOptionsV15 & { holdoutFraction?: number } = {},
): NeuralTemporalEvaluationV15 {
  const corpusAudit = auditLearningCorpusV15(records);
  const metagameDrift = detectMetagameDriftV15(records);
  const holdoutFraction = Number.isFinite(options.holdoutFraction) ? options.holdoutFraction ?? 0.2 : 0.2;
  const split = temporalSplitLearningCorpusV15(records, holdoutFraction);
  const trainingExamples = split.trainingExamples;
  const holdoutExamples = split.holdoutExamples;
  const trainingLabels = countLabels(trainingExamples);
  const holdoutLabels = countLabels(holdoutExamples);
  const evaluationWarnings: string[] = [];

  if (trainingExamples.length < 10) evaluationWarnings.push('Too few leakage-safe training examples to evaluate either model.');
  if (trainingLabels.positive === 0 || trainingLabels.negative === 0) evaluationWarnings.push('Leakage-safe training data contains only one outcome class.');
  if (holdoutExamples.length === 0) evaluationWarnings.push('No leakage-safe future holdout examples are available.');
  if (holdoutExamples.length > 0 && (holdoutLabels.positive === 0 || holdoutLabels.negative === 0)) {
    evaluationWarnings.push('Future temporal holdout contains only one outcome class; ordinary accuracy is not sufficient promotion evidence.');
  }
  if (metagameDrift.severity === 'insufficient') {
    evaluationWarnings.push('Metagame drift cannot yet be measured reliably because the reference or recent window is too small.');
  } else if (metagameDrift.severity === 'moderate') {
    evaluationWarnings.push('Moderate metagame drift detected; both learned models should be re-tested on recent outcomes before relying on old calibration.');
  } else if (metagameDrift.severity === 'severe') {
    evaluationWarnings.push('Severe metagame drift detected; neural promotion is blocked until retraining and fresh temporal validation succeed.');
  }

  let neuralModel: ReturnType<typeof trainNeuralRankerV15> | null = null;
  let transparentModel: AdaptiveRankerV15 | null = null;
  let neuralTemporalMetrics = emptyMetrics();
  let transparentTemporalMetrics = emptyMetrics();

  if (trainingExamples.length >= 10 && holdoutExamples.length > 0) {
    neuralModel = trainNeuralRankerV15(trainingExamples, options);
    const neuralEpochs = Number.isFinite(options.epochs) ? options.epochs ?? 400 : 400;
    transparentModel = trainAdaptiveRankerV15(trainingExamples, {
      epochs: Math.min(500, Math.max(120, Math.trunc(neuralEpochs / 2))),
      learningRate: 0.08,
      l2: 0.01,
      minimumExamples: Math.max(10, trainingExamples.length + 1),
      minimumHoldoutAccuracy: 1,
    });
    neuralTemporalMetrics = evaluateNeural(neuralModel, holdoutExamples);
    transparentTemporalMetrics = evaluateTransparent(transparentModel, holdoutExamples);
  }

  const temporalAccuracyImprovement = nullableDifference(neuralTemporalMetrics.accuracy, transparentTemporalMetrics.accuracy);
  const temporalBalancedAccuracyImprovement = nullableDifference(
    neuralTemporalMetrics.balancedAccuracy,
    transparentTemporalMetrics.balancedAccuracy,
  );
  const temporalLogLossImprovement = neuralTemporalMetrics.logLoss === null || transparentTemporalMetrics.logLoss === null
    ? null
    : round(transparentTemporalMetrics.logLoss - neuralTemporalMetrics.logLoss);

  const baseReadiness = evaluateDeepLearningReadinessV15({
    labelledExamples: corpusAudit.uniqueRecords,
    positiveExamples: corpusAudit.positiveExamples,
    negativeExamples: corpusAudit.negativeExamples,
    temporalCoverageDays: corpusAudit.temporalCoverageDays,
    independentEvidenceGroups: corpusAudit.independentEvidenceGroups,
    evidenceClassCount: corpusAudit.evidenceClassCount,
    duplicateRate: corpusAudit.duplicateRate,
    conflictRate: corpusAudit.conflictRate,
    malformedRate: corpusAudit.malformedRate,
    leakageChecksPassed: split.leakageChecksPassed,
    transparentBaselineAccuracy: transparentTemporalMetrics.accuracy,
    candidateModelAccuracy: neuralTemporalMetrics.accuracy,
    transparentBaselineLogLoss: transparentTemporalMetrics.logLoss,
    candidateModelLogLoss: neuralTemporalMetrics.logLoss,
    temporalHoldoutExamples: holdoutExamples.length,
    temporalHoldoutPositiveExamples: holdoutLabels.positive,
    temporalHoldoutNegativeExamples: holdoutLabels.negative,
  });

  const readiness: ReturnType<typeof evaluateDeepLearningReadinessV15> = metagameDrift.severity === 'severe'
    ? {
        ...baseReadiness,
        status: baseReadiness.status === 'not-ready' ? 'not-ready' : 'experiment-ready',
        blockers: [
          ...baseReadiness.blockers,
          'Severe metagame drift blocks neural-model promotion until the model is retrained and wins again on fresh temporal holdout data.',
        ],
        guidance: 'Retrain both transparent and neural candidates on the shifted metagame, create a new leakage-safe future holdout, and require the neural candidate to re-earn its advantage before promotion.',
      }
    : baseReadiness;

  return {
    corpusAudit,
    metagameDrift,
    split: {
      trainingRecords: split.training.length,
      holdoutRecords: split.holdout.length,
      trainingPositiveExamples: trainingLabels.positive,
      trainingNegativeExamples: trainingLabels.negative,
      holdoutPositiveExamples: holdoutLabels.positive,
      holdoutNegativeExamples: holdoutLabels.negative,
      cutoff: split.cutoff,
      leakageChecksPassed: split.leakageChecksPassed,
      overlappingLeakageGroups: split.overlappingLeakageGroups,
    },
    neuralModel,
    transparentModel,
    neuralTemporalMetrics,
    transparentTemporalMetrics,
    temporalAccuracyImprovement,
    temporalBalancedAccuracyImprovement,
    temporalLogLossImprovement,
    evaluationWarnings,
    readiness,
  };
}
