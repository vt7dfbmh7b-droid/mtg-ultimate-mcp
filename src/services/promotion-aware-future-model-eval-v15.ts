import type { HistoricalLearningRecordV15 } from './historical-learning-corpus-v15.js';
import {
  assertPromotionFeatureProjectionV15,
  type FutureHoldoutSealV15,
} from './future-holdout-seal-v15.js';
import { assessPromotionEvaluationContractV15 } from './promotion-evaluation-contract-v15.js';
import {
  evaluateSealedFutureHoldoutV15,
  type SealedFutureModelEvaluationV15,
} from './sealed-future-model-eval-v15.js';
import {
  assessPromotionReadinessV15,
  type PromotionReadinessV15,
} from './promotion-readiness-v15.js';

export const PROMOTION_AWARE_FUTURE_EVAL_SCHEMA_V15 = 'promotion-aware-future-eval-v15.2' as const;

export interface PromotionAwareFutureModelEvaluationV15 {
  schemaVersion: typeof PROMOTION_AWARE_FUTURE_EVAL_SCHEMA_V15;
  evaluation: SealedFutureModelEvaluationV15;
  promotionReadiness: PromotionReadinessV15;
}

/**
 * Compatibility wrapper for callers that already hold a sealed-future evaluation.
 * It preserves the existing anti-auto-promotion behavior. The stronger precommitted
 * production contract is applied by evaluatePromotionAwareSealedFutureHoldoutV15,
 * which also receives the immutable seal.
 */
export function attachPromotionReadinessToFutureEvaluationV15(
  evaluation: SealedFutureModelEvaluationV15,
): PromotionAwareFutureModelEvaluationV15 {
  return {
    schemaVersion: PROMOTION_AWARE_FUTURE_EVAL_SCHEMA_V15,
    evaluation,
    promotionReadiness: assessPromotionReadinessV15(evaluation),
  };
}

function blockReadiness(readiness: PromotionReadinessV15, blockers: string[]): PromotionReadinessV15 {
  if (blockers.length === 0) return readiness;
  return {
    ...readiness,
    evidenceStatus: 'blocked',
    modelEvidencePassed: false,
    recommendedAction: 'continue-evidence-collection',
    automaticStablePromotionAllowed: false,
    stablePromotionAuthorized: false,
    requiresExplicitUserApproval: true,
    blockers: [...readiness.blockers, ...blockers],
  };
}

/**
 * Preferred production path for evaluating a genuine-future holdout.
 *
 * It keeps the legacy shadow-usefulness calculation for diagnostics, but human
 * promotion review is additionally gated by the exact sealed two-feature scope,
 * production corpus size/diversity, absolute quality floors, prevalence baseline,
 * transparent baseline, Brier score and calibration error. No successful result
 * can authorize stable promotion automatically.
 */
export function evaluatePromotionAwareSealedFutureHoldoutV15(
  seal: FutureHoldoutSealV15,
  trainingRecords: HistoricalLearningRecordV15[],
  futureHoldoutRecords: HistoricalLearningRecordV15[],
): PromotionAwareFutureModelEvaluationV15 {
  assertPromotionFeatureProjectionV15(trainingRecords);
  assertPromotionFeatureProjectionV15(futureHoldoutRecords);
  const evaluation = evaluateSealedFutureHoldoutV15(seal, trainingRecords, futureHoldoutRecords);
  const base = attachPromotionReadinessToFutureEvaluationV15(evaluation);
  const contract = assessPromotionEvaluationContractV15(evaluation, seal.evaluationPlan);
  return {
    ...base,
    promotionReadiness: blockReadiness(base.promotionReadiness, contract.blockers),
  };
}
