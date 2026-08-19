import type { HistoricalLearningRecordV15 } from './historical-learning-corpus-v15.js';
import type { FutureHoldoutSealV15 } from './future-holdout-seal-v15.js';
import {
  evaluateSealedFutureHoldoutV15,
  type SealedFutureModelEvaluationV15,
} from './sealed-future-model-eval-v15.js';
import {
  assessPromotionReadinessV15,
  type PromotionReadinessV15,
} from './promotion-readiness-v15.js';

export const PROMOTION_AWARE_FUTURE_EVAL_SCHEMA_V15 = 'promotion-aware-future-eval-v15.1' as const;

export interface PromotionAwareFutureModelEvaluationV15 {
  schemaVersion: typeof PROMOTION_AWARE_FUTURE_EVAL_SCHEMA_V15;
  evaluation: SealedFutureModelEvaluationV15;
  promotionReadiness: PromotionReadinessV15;
}

/**
 * Adds the missing release-control interpretation to the existing sealed future
 * evaluator without changing its legacy anti-auto-promotion contract.
 *
 * `evaluation.promotionAuthorized` intentionally remains false. A genuinely strong
 * future evaluation may instead move `promotionReadiness.evidenceStatus` to
 * `eligible-for-human-review`, after which stable runtime promotion is still a
 * separate explicit user-approved release action.
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

/**
 * Preferred promotion-aware path for evaluating a precommitted genuine-future
 * holdout. It preserves every assertion and metric in the existing evaluator, then
 * classifies whether the evidence is still blocked or has earned explicit human
 * promotion review.
 */
export function evaluatePromotionAwareSealedFutureHoldoutV15(
  seal: FutureHoldoutSealV15,
  trainingRecords: HistoricalLearningRecordV15[],
  futureHoldoutRecords: HistoricalLearningRecordV15[],
): PromotionAwareFutureModelEvaluationV15 {
  return attachPromotionReadinessToFutureEvaluationV15(
    evaluateSealedFutureHoldoutV15(seal, trainingRecords, futureHoldoutRecords),
  );
}
