import type { FutureHoldoutEvaluationPlanV15 } from './future-holdout-seal-v15.js';
import type { SealedFutureModelEvaluationV15 } from './sealed-future-model-eval-v15.js';

export const PROMOTION_EVALUATION_CONTRACT_SCHEMA_V15 = 'promotion-evaluation-contract-v15.1' as const;

export interface PromotionEvaluationContractAssessmentV15 {
  schemaVersion: typeof PROMOTION_EVALUATION_CONTRACT_SCHEMA_V15;
  passed: boolean;
  blockers: string[];
}

function requiredMetric(name: string, value: number | null): number {
  if (value === null || !Number.isFinite(value)) throw new Error(`Promotion metric ${name} must be finite.`);
  return value;
}

function pushIf(blockers: string[], condition: boolean, message: string): void {
  if (condition) blockers.push(message);
}

/**
 * Applies the stronger precommitted review contract that sits above the legacy
 * shadow-usefulness signal. The legacy evaluator remains useful for diagnostics,
 * but none of its relative gains are enough for human promotion review unless
 * these absolute, baseline, calibration, and corpus-diversity gates also pass.
 */
export function assessPromotionEvaluationContractV15(
  evaluation: SealedFutureModelEvaluationV15,
  plan: FutureHoldoutEvaluationPlanV15,
): PromotionEvaluationContractAssessmentV15 {
  const blockers: string[] = [];
  const training = evaluation.trainingQuality;
  const future = evaluation.futureHoldoutQuality;

  pushIf(blockers, evaluation.trainingRecords < plan.minimumTrainingRecordsForProductionSeal,
    `Training corpus has ${evaluation.trainingRecords} records; requires at least ${plan.minimumTrainingRecordsForProductionSeal}.`);
  pushIf(blockers, training.minorityShare < plan.minimumTrainingMinorityShareForProductionSeal,
    `Training minority share ${training.minorityShare} is below ${plan.minimumTrainingMinorityShareForProductionSeal}.`);
  pushIf(blockers, training.eventCoverage.uniqueEvents < plan.minimumTrainingUniqueEvents,
    `Training corpus has ${training.eventCoverage.uniqueEvents} unique events; requires at least ${plan.minimumTrainingUniqueEvents}.`);
  pushIf(blockers, training.pilotCoverage.uniquePilots < plan.minimumTrainingUniquePilots,
    `Training corpus has ${training.pilotCoverage.uniquePilots} unique pilots; requires at least ${plan.minimumTrainingUniquePilots}.`);
  pushIf(blockers, training.leakageCoverage.maximumGroupShare > plan.maximumTrainingLeakageGroupShare,
    `Training maximum leakage-group share ${training.leakageCoverage.maximumGroupShare} exceeds ${plan.maximumTrainingLeakageGroupShare}.`);
  pushIf(blockers, plan.requireCompleteTrainingEventIdentity && training.eventCoverage.missingEventIdentityRecords > 0,
    'Training corpus contains records without explicit provider event identity.');
  pushIf(blockers, plan.requireCompleteTrainingPilotIdentity && training.pilotCoverage.missingPilotIdentityRecords > 0,
    'Training corpus contains records without explicit provider pilot identity.');

  pushIf(blockers, evaluation.futureHoldoutRecords < plan.minimumFutureHoldoutRecordsForUsefulnessClaim,
    `Future holdout has ${evaluation.futureHoldoutRecords} records; requires at least ${plan.minimumFutureHoldoutRecordsForUsefulnessClaim}.`);
  pushIf(blockers, future.minorityShare < plan.minimumFutureHoldoutMinorityShare,
    `Future holdout minority share ${future.minorityShare} is below ${plan.minimumFutureHoldoutMinorityShare}.`);
  pushIf(blockers, future.eventCoverage.uniqueEvents < plan.minimumFutureHoldoutUniqueEvents,
    `Future holdout has ${future.eventCoverage.uniqueEvents} unique events; requires at least ${plan.minimumFutureHoldoutUniqueEvents}.`);
  pushIf(blockers, future.pilotCoverage.uniquePilots < plan.minimumFutureHoldoutUniquePilots,
    `Future holdout has ${future.pilotCoverage.uniquePilots} unique pilots; requires at least ${plan.minimumFutureHoldoutUniquePilots}.`);
  pushIf(blockers, future.leakageCoverage.maximumGroupShare > plan.maximumFutureHoldoutLeakageGroupShare,
    `Future maximum leakage-group share ${future.leakageCoverage.maximumGroupShare} exceeds ${plan.maximumFutureHoldoutLeakageGroupShare}.`);
  pushIf(blockers, plan.requireCompleteFutureEventIdentity && future.eventCoverage.missingEventIdentityRecords > 0,
    'Future holdout contains records without explicit provider event identity.');
  pushIf(blockers, plan.requireCompleteFuturePilotIdentity && future.pilotCoverage.missingPilotIdentityRecords > 0,
    'Future holdout contains records without explicit provider pilot identity.');

  let neuralBalancedAccuracy: number;
  let neuralAuRoc: number;
  let neuralLogLoss: number;
  let neuralBrier: number;
  let neuralEce: number;
  let transparentBalancedAccuracy: number;
  let transparentAuRoc: number;
  let transparentLogLoss: number;
  let transparentBrier: number;
  let prevalenceBalancedAccuracy: number;
  let prevalenceLogLoss: number;
  try {
    neuralBalancedAccuracy = requiredMetric('neural balanced accuracy', evaluation.neuralMetrics.balancedAccuracy);
    neuralAuRoc = requiredMetric('neural AUROC', evaluation.neuralMetrics.auroc);
    neuralLogLoss = requiredMetric('neural log loss', evaluation.neuralMetrics.logLoss);
    neuralBrier = requiredMetric('neural Brier score', evaluation.neuralMetrics.brierScore);
    neuralEce = requiredMetric('neural expected calibration error', evaluation.neuralMetrics.expectedCalibrationError);
    transparentBalancedAccuracy = requiredMetric('transparent balanced accuracy', evaluation.transparentMetrics.balancedAccuracy);
    transparentAuRoc = requiredMetric('transparent AUROC', evaluation.transparentMetrics.auroc);
    transparentLogLoss = requiredMetric('transparent log loss', evaluation.transparentMetrics.logLoss);
    transparentBrier = requiredMetric('transparent Brier score', evaluation.transparentMetrics.brierScore);
    prevalenceBalancedAccuracy = requiredMetric('prevalence balanced accuracy', evaluation.prevalenceMetrics.balancedAccuracy);
    prevalenceLogLoss = requiredMetric('prevalence log loss', evaluation.prevalenceMetrics.logLoss);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : String(error));
    return { schemaVersion: PROMOTION_EVALUATION_CONTRACT_SCHEMA_V15, passed: false, blockers };
  }

  pushIf(blockers, neuralBalancedAccuracy < plan.minimumNeuralBalancedAccuracy,
    `Neural balanced accuracy ${neuralBalancedAccuracy} is below absolute floor ${plan.minimumNeuralBalancedAccuracy}.`);
  pushIf(blockers, neuralAuRoc < plan.minimumNeuralAuRoc,
    `Neural AUROC ${neuralAuRoc} is below absolute floor ${plan.minimumNeuralAuRoc}.`);
  pushIf(blockers, neuralBalancedAccuracy - transparentBalancedAccuracy < plan.minimumBalancedAccuracyGainOverTransparent,
    `Neural balanced-accuracy gain over transparent is below ${plan.minimumBalancedAccuracyGainOverTransparent}.`);
  pushIf(blockers, neuralAuRoc - transparentAuRoc < plan.minimumAuRocGainOverTransparent,
    `Neural AUROC gain over transparent is below ${plan.minimumAuRocGainOverTransparent}.`);
  pushIf(blockers, neuralLogLoss - transparentLogLoss > plan.maximumLogLossRegressionVsTransparent,
    `Neural log-loss regression versus transparent exceeds ${plan.maximumLogLossRegressionVsTransparent}.`);
  pushIf(blockers, neuralBrier - transparentBrier > plan.maximumBrierRegressionVsTransparent,
    `Neural Brier-score regression versus transparent exceeds ${plan.maximumBrierRegressionVsTransparent}.`);
  pushIf(blockers, neuralBalancedAccuracy - prevalenceBalancedAccuracy < plan.minimumBalancedAccuracyGainOverPrevalence,
    `Neural balanced-accuracy gain over prevalence is below ${plan.minimumBalancedAccuracyGainOverPrevalence}.`);
  pushIf(blockers, neuralLogLoss - prevalenceLogLoss > plan.maximumLogLossRegressionVsPrevalence,
    `Neural log-loss regression versus prevalence exceeds ${plan.maximumLogLossRegressionVsPrevalence}.`);
  pushIf(blockers, neuralEce > plan.maximumExpectedCalibrationError,
    `Neural expected calibration error ${neuralEce} exceeds ${plan.maximumExpectedCalibrationError}.`);

  return {
    schemaVersion: PROMOTION_EVALUATION_CONTRACT_SCHEMA_V15,
    passed: blockers.length === 0,
    blockers,
  };
}
