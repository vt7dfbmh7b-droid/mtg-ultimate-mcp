import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROMOTION_CLAIM_SCOPE_V15,
  PROMOTION_FEATURES_V15,
  type FutureHoldoutEvaluationPlanV15,
} from './future-holdout-seal-v15.js';
import { assessPromotionEvaluationContractV15 } from './promotion-evaluation-contract-v15.js';
import type { SealedFutureModelEvaluationV15 } from './sealed-future-model-eval-v15.js';

const plan: FutureHoldoutEvaluationPlanV15 = {
  decisionThreshold: 0.5,
  calibrationBins: 10,
  neural: { hiddenLayerOne: 8, hiddenLayerTwo: 4, epochs: 400, learningRate: 0.035, l2: 0.001, seed: 20260816 },
  transparent: { epochs: 200, learningRate: 0.08, l2: 0.01 },
  requiredMetrics: ['accuracy', 'balanced-accuracy', 'log-loss', 'brier-score', 'auroc', 'expected-calibration-error'],
  promotionFeatures: PROMOTION_FEATURES_V15,
  claimScope: PROMOTION_CLAIM_SCOPE_V15,
  minimumTrainingRecordsForProductionSeal: 200,
  minimumTrainingMinorityShareForProductionSeal: 0.2,
  minimumTrainingUniqueEvents: 10,
  minimumTrainingUniquePilots: 20,
  maximumTrainingLeakageGroupShare: 0.25,
  requireCompleteTrainingEventIdentity: true,
  requireCompleteTrainingPilotIdentity: true,
  minimumFutureHoldoutRecordsForUsefulnessClaim: 200,
  minimumFutureHoldoutMinorityShare: 0.2,
  minimumFutureHoldoutUniqueEvents: 10,
  minimumFutureHoldoutUniquePilots: 20,
  maximumFutureHoldoutLeakageGroupShare: 0.25,
  requireCompleteFutureEventIdentity: true,
  requireCompleteFuturePilotIdentity: true,
  minimumNeuralBalancedAccuracy: 0.6,
  minimumNeuralAuRoc: 0.65,
  minimumBalancedAccuracyGainOverTransparent: 0.02,
  minimumAuRocGainOverTransparent: 0.01,
  maximumLogLossRegressionVsTransparent: 0,
  maximumBrierRegressionVsTransparent: 0,
  minimumBalancedAccuracyGainOverPrevalence: 0.05,
  maximumLogLossRegressionVsPrevalence: 0,
  maximumExpectedCalibrationError: 0.15,
};

function quality(records: number) {
  return {
    records,
    minorityShare: 0.4,
    eventCoverage: { uniqueEvents: 25, missingEventIdentityRecords: 0 },
    pilotCoverage: { uniquePilots: 80, missingPilotIdentityRecords: 0 },
    leakageCoverage: { maximumGroupShare: 0.1 },
  };
}

function evaluation(): SealedFutureModelEvaluationV15 {
  return {
    trainingRecords: 300,
    futureHoldoutRecords: 250,
    trainingQuality: quality(300),
    futureHoldoutQuality: quality(250),
    neuralMetrics: {
      balancedAccuracy: 0.68,
      auroc: 0.72,
      logLoss: 0.55,
      brierScore: 0.18,
      expectedCalibrationError: 0.08,
    },
    transparentMetrics: {
      balancedAccuracy: 0.64,
      auroc: 0.69,
      logLoss: 0.56,
      brierScore: 0.19,
    },
    prevalenceMetrics: {
      balancedAccuracy: 0.5,
      logLoss: 0.62,
    },
  } as unknown as SealedFutureModelEvaluationV15;
}

test('promotion evaluation contract accepts evidence that clears every frozen gate', () => {
  const result = assessPromotionEvaluationContractV15(evaluation(), plan);
  assert.equal(result.passed, true);
  assert.deepEqual(result.blockers, []);
});

test('promotion evaluation contract blocks weak absolute quality, calibration, baseline, and diversity', () => {
  const candidate = evaluation();
  candidate.neuralMetrics.balancedAccuracy = 0.55;
  candidate.neuralMetrics.auroc = 0.6;
  candidate.neuralMetrics.expectedCalibrationError = 0.2;
  candidate.neuralMetrics.logLoss = 0.7;
  candidate.futureHoldoutQuality.eventCoverage.uniqueEvents = 3;
  candidate.futureHoldoutQuality.pilotCoverage.missingPilotIdentityRecords = 1;
  const result = assessPromotionEvaluationContractV15(candidate, plan);
  assert.equal(result.passed, false);
  assert.match(result.blockers.join(' '), /absolute floor/i);
  assert.match(result.blockers.join(' '), /prevalence/i);
  assert.match(result.blockers.join(' '), /calibration/i);
  assert.match(result.blockers.join(' '), /unique events/i);
  assert.match(result.blockers.join(' '), /pilot identity/i);
});
