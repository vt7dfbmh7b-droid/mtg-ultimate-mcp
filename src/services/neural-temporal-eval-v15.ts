import {
  auditLearningCorpusV15,
  temporalSplitLearningCorpusV15,
  type LearningOutcomeRecordV15,
} from './learning-corpus-v15.js';
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
  correct: number;
  accuracy: number | null;
  logLoss: number | null;
}

export interface NeuralTemporalEvaluationV15 {
  corpusAudit: ReturnType<typeof auditLearningCorpusV15>;
  split: {
    trainingRecords: number;
    holdoutRecords: number;
    cutoff: string | null;
    leakageChecksPassed: boolean;
    overlappingLeakageGroups: string[];
  };
  neuralModel: ReturnType<typeof trainNeuralRankerV15> | null;
  transparentModel: AdaptiveRankerV15 | null;
  neuralTemporalMetrics: TemporalModelMetricsV15;
  transparentTemporalMetrics: TemporalModelMetricsV15;
  temporalAccuracyImprovement: number | null;
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
  return { examples: 0, correct: 0, accuracy: null, logLoss: null };
}

function evaluateTransparent(model: AdaptiveRankerV15, holdout: LearningExampleV15[]): TemporalModelMetricsV15 {
  if (holdout.length === 0) return emptyMetrics();
  let correct = 0;
  let loss = 0;
  for (const example of holdout) {
    const scored = scoreCandidateWithLearningV15(example.features, model, allHardChecksPass());
    if (!scored.eligible || scored.probability === null) throw new Error('Transparent temporal evaluation unexpectedly failed hard gates.');
    const prediction = scored.probability >= 0.5 ? 1 : 0;
    if (prediction === example.label) correct += 1;
    loss += binaryLogLoss(example.label, scored.probability);
  }
  return {
    examples: holdout.length,
    correct,
    accuracy: round(correct / holdout.length),
    logLoss: round(loss / holdout.length),
  };
}

function evaluateNeural(
  model: ReturnType<typeof trainNeuralRankerV15>,
  holdout: LearningExampleV15[],
): TemporalModelMetricsV15 {
  if (holdout.length === 0) return emptyMetrics();
  let correct = 0;
  let loss = 0;
  for (const example of holdout) {
    const scored = scoreCandidateWithNeuralV15(example.features, model, allHardChecksPass());
    if (!scored.eligible || scored.probability === null) throw new Error('Neural temporal evaluation unexpectedly failed hard gates.');
    const prediction = scored.probability >= 0.5 ? 1 : 0;
    if (prediction === example.label) correct += 1;
    loss += binaryLogLoss(example.label, scored.probability);
  }
  return {
    examples: holdout.length,
    correct,
    accuracy: round(correct / holdout.length),
    logLoss: round(loss / holdout.length),
  };
}

export function evaluateNeuralOnTemporalCorpusV15(
  records: LearningOutcomeRecordV15[],
  options: NeuralRankerOptionsV15 & { holdoutFraction?: number } = {},
): NeuralTemporalEvaluationV15 {
  const corpusAudit = auditLearningCorpusV15(records);
  const split = temporalSplitLearningCorpusV15(records, options.holdoutFraction ?? 0.2);
  const trainingExamples = split.trainingExamples;
  const holdoutExamples = split.holdoutExamples;

  let neuralModel: ReturnType<typeof trainNeuralRankerV15> | null = null;
  let transparentModel: AdaptiveRankerV15 | null = null;
  let neuralTemporalMetrics = emptyMetrics();
  let transparentTemporalMetrics = emptyMetrics();

  if (trainingExamples.length >= 10 && holdoutExamples.length > 0) {
    neuralModel = trainNeuralRankerV15(trainingExamples, options);
    transparentModel = trainAdaptiveRankerV15(trainingExamples, {
      epochs: Math.min(500, Math.max(120, Math.trunc((options.epochs ?? 400) / 2))),
      learningRate: 0.08,
      l2: 0.01,
      minimumExamples: Math.max(10, trainingExamples.length + 1),
      minimumHoldoutAccuracy: 1,
    });
    neuralTemporalMetrics = evaluateNeural(neuralModel, holdoutExamples);
    transparentTemporalMetrics = evaluateTransparent(transparentModel, holdoutExamples);
  }

  const temporalAccuracyImprovement = neuralTemporalMetrics.accuracy === null || transparentTemporalMetrics.accuracy === null
    ? null
    : round(neuralTemporalMetrics.accuracy - transparentTemporalMetrics.accuracy);
  const readiness = evaluateDeepLearningReadinessV15({
    labelledExamples: corpusAudit.uniqueRecords,
    positiveExamples: corpusAudit.positiveExamples,
    negativeExamples: corpusAudit.negativeExamples,
    temporalCoverageDays: corpusAudit.temporalCoverageDays,
    independentEvidenceGroups: corpusAudit.independentEvidenceGroups,
    evidenceClassCount: corpusAudit.evidenceClassCount,
    duplicateRate: corpusAudit.duplicateRate,
    leakageChecksPassed: split.leakageChecksPassed,
    transparentBaselineAccuracy: transparentTemporalMetrics.accuracy,
    candidateModelAccuracy: neuralTemporalMetrics.accuracy,
    temporalHoldoutExamples: holdoutExamples.length,
  });

  return {
    corpusAudit,
    split: {
      trainingRecords: split.training.length,
      holdoutRecords: split.holdout.length,
      cutoff: split.cutoff,
      leakageChecksPassed: split.leakageChecksPassed,
      overlappingLeakageGroups: split.overlappingLeakageGroups,
    },
    neuralModel,
    transparentModel,
    neuralTemporalMetrics,
    transparentTemporalMetrics,
    temporalAccuracyImprovement,
    readiness,
  };
}
