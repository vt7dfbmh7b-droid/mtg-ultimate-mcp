import assert from 'node:assert/strict';
import test from 'node:test';
import type { SealedFutureModelEvaluationV15 } from './sealed-future-model-eval-v15.js';
import { attachPromotionReadinessToFutureEvaluationV15 } from './promotion-aware-future-model-eval-v15.js';

function evaluation(usefulness: SealedFutureModelEvaluationV15['usefulness']): SealedFutureModelEvaluationV15 {
  return {
    usefulness,
    usefulnessReasons: [usefulness],
    promotionAuthorized: false,
    futureGate: {
      allHoldoutOutcomesOccurredAfterSeal: true,
      allHoldoutEvidenceAvailableAfterSeal: true,
      allHoldoutEvidenceAvailableByEvaluation: true,
      sealClockAttested: true,
      featureContractMatchesSeal: true,
      featureNormalizerMatchesSeal: true,
      sourceTargetPoliciesPass: true,
      leakageGroupsDisjoint: true,
      providerEventsDisjoint: true,
      pilotIdentitiesDisjoint: true,
      exactDeckFingerprintsDisjoint: true,
    },
    trainingQuality: { qualityGatePassed: true, blockers: [] },
    futureHoldoutQuality: { qualityGatePassed: true, blockers: [] },
  } as unknown as SealedFutureModelEvaluationV15;
}

test('promotion-aware wrapper exposes review readiness without changing evaluator authorization', () => {
  const source = evaluation('shadow-gain-observed');
  const result = attachPromotionReadinessToFutureEvaluationV15(source);

  assert.equal(result.evaluation, source);
  assert.equal(result.evaluation.promotionAuthorized, false);
  assert.equal(result.promotionReadiness.evidenceStatus, 'eligible-for-human-review');
  assert.equal(result.promotionReadiness.automaticStablePromotionAllowed, false);
  assert.equal(result.promotionReadiness.stablePromotionAuthorized, false);
  assert.equal(result.promotionReadiness.requiresExplicitUserApproval, true);
});

test('promotion-aware wrapper reports failed model evidence as blocked', () => {
  const result = attachPromotionReadinessToFutureEvaluationV15(evaluation('no-demonstrated-neural-gain'));

  assert.equal(result.promotionReadiness.evidenceStatus, 'blocked');
  assert.equal(result.promotionReadiness.recommendedAction, 'continue-evidence-collection');
});
