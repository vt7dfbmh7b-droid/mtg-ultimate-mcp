import type { RealCorpusQualityAuditV15 } from './real-corpus-quality-v15.js';
import type { SealedFutureModelEvaluationV15 } from './sealed-future-model-eval-v15.js';

export const PROMOTION_READINESS_SCHEMA_V15 = 'promotion-readiness-v15.1' as const;

export type PromotionEvidenceStatusV15 = 'blocked' | 'eligible-for-human-review';
export type PromotionRecommendedActionV15 = 'continue-evidence-collection' | 'request-explicit-promotion-review';

type EvaluationGateV15 = SealedFutureModelEvaluationV15['futureGate'];

/**
 * Narrow structural input so callers can pass a full sealed-future evaluation while
 * deterministic tests can exercise promotion policy without constructing model weights.
 */
export interface PromotionReadinessEvidenceV15 {
  usefulness: SealedFutureModelEvaluationV15['usefulness'];
  usefulnessReasons: string[];
  promotionAuthorized: false;
  futureGate: Pick<EvaluationGateV15,
    | 'sealClockAttested'
    | 'allHoldoutOutcomesOccurredAfterSeal'
    | 'allHoldoutEvidenceAvailableAfterSeal'
    | 'allHoldoutEvidenceAvailableByEvaluation'
    | 'featureContractMatchesSeal'
    | 'featureNormalizerMatchesSeal'
    | 'sourceTargetPoliciesPass'
    | 'leakageGroupsDisjoint'
    | 'providerEventsDisjoint'
    | 'pilotIdentitiesDisjoint'
    | 'exactDeckFingerprintsDisjoint'
  >;
  trainingQuality: Pick<RealCorpusQualityAuditV15, 'qualityGatePassed' | 'blockers'>;
  futureHoldoutQuality: Pick<RealCorpusQualityAuditV15, 'qualityGatePassed' | 'blockers'>;
}

export interface PromotionReadinessV15 {
  schemaVersion: typeof PROMOTION_READINESS_SCHEMA_V15;
  evidenceStatus: PromotionEvidenceStatusV15;
  modelEvidencePassed: boolean;
  recommendedAction: PromotionRecommendedActionV15;
  automaticStablePromotionAllowed: false;
  stablePromotionAuthorized: false;
  requiresExplicitUserApproval: true;
  blockers: string[];
  evidenceReasons: string[];
  policyReasons: readonly [
    'A successful shadow evaluation can qualify a model for promotion review, but cannot promote the stable runtime automatically.',
    'Stable runtime promotion remains a separate explicit release decision.'
  ];
}

function pushIfFalse(blockers: string[], value: boolean, message: string): void {
  if (!value) blockers.push(message);
}

/**
 * Converts a sealed-future model evaluation into an actionable release-readiness state.
 *
 * This deliberately does NOT turn a model result into stable authorization. The previous
 * `promotionAuthorized: false` contract remains a hard anti-auto-promotion guardrail.
 * What this adds is the missing intermediate state: evidence can now be declared strong
 * enough for an explicit human promotion review instead of remaining semantically
 * indistinguishable from a failed experiment forever.
 */
export function assessPromotionReadinessV15(evaluation: PromotionReadinessEvidenceV15): PromotionReadinessV15 {
  if (!evaluation || typeof evaluation !== 'object') throw new Error('Promotion readiness requires a sealed-future evaluation.');
  if ((evaluation as { promotionAuthorized?: unknown }).promotionAuthorized !== false) {
    throw new Error('V0.15 promotion readiness refuses evaluations that claim automatic promotion authorization.');
  }

  const blockers: string[] = [];

  pushIfFalse(blockers, evaluation.futureGate.sealClockAttested, 'Future holdout seal must be attested by the real system clock.');
  pushIfFalse(blockers, evaluation.futureGate.allHoldoutOutcomesOccurredAfterSeal, 'Every holdout outcome must occur after the holdout seal.');
  pushIfFalse(blockers, evaluation.futureGate.allHoldoutEvidenceAvailableAfterSeal, 'Every holdout evidence record must become source-available after the seal.');
  pushIfFalse(blockers, evaluation.futureGate.allHoldoutEvidenceAvailableByEvaluation, 'Every holdout evidence record must be source-available by evaluation time.');
  pushIfFalse(blockers, evaluation.futureGate.featureContractMatchesSeal, 'Future feature extractor contract must match the sealed contract.');
  pushIfFalse(blockers, evaluation.futureGate.featureNormalizerMatchesSeal, 'Future feature normalizer must match the training-fitted sealed fingerprint.');
  pushIfFalse(blockers, evaluation.futureGate.sourceTargetPoliciesPass, 'Future source/target policies must pass.');
  pushIfFalse(blockers, evaluation.futureGate.leakageGroupsDisjoint, 'Training and future leakage groups must be disjoint.');
  pushIfFalse(blockers, evaluation.futureGate.providerEventsDisjoint, 'Training and future provider events must be disjoint.');
  pushIfFalse(blockers, evaluation.futureGate.pilotIdentitiesDisjoint, 'Training and future pilot identities must be disjoint.');
  pushIfFalse(blockers, evaluation.futureGate.exactDeckFingerprintsDisjoint, 'Training and future exact deck fingerprints must be disjoint.');

  if (!evaluation.trainingQuality.qualityGatePassed) {
    blockers.push(...evaluation.trainingQuality.blockers.map((reason) => `Training corpus quality: ${reason}`));
    if (evaluation.trainingQuality.blockers.length === 0) blockers.push('Training corpus quality gate did not pass.');
  }
  if (!evaluation.futureHoldoutQuality.qualityGatePassed) {
    blockers.push(...evaluation.futureHoldoutQuality.blockers.map((reason) => `Future holdout quality: ${reason}`));
    if (evaluation.futureHoldoutQuality.blockers.length === 0) blockers.push('Future holdout quality gate did not pass.');
  }

  if (evaluation.usefulness === 'insufficient-future-evidence') {
    blockers.push('Genuine future evidence is still insufficient for a promotion review.');
  } else if (evaluation.usefulness === 'no-demonstrated-neural-gain') {
    blockers.push('The neural model has not met the precommitted gain criteria versus the transparent baseline.');
  }

  const modelEvidencePassed = blockers.length === 0 && evaluation.usefulness === 'shadow-gain-observed';

  return {
    schemaVersion: PROMOTION_READINESS_SCHEMA_V15,
    evidenceStatus: modelEvidencePassed ? 'eligible-for-human-review' : 'blocked',
    modelEvidencePassed,
    recommendedAction: modelEvidencePassed ? 'request-explicit-promotion-review' : 'continue-evidence-collection',
    automaticStablePromotionAllowed: false,
    stablePromotionAuthorized: false,
    requiresExplicitUserApproval: true,
    blockers,
    evidenceReasons: [...evaluation.usefulnessReasons],
    policyReasons: [
      'A successful shadow evaluation can qualify a model for promotion review, but cannot promote the stable runtime automatically.',
      'Stable runtime promotion remains a separate explicit release decision.',
    ],
  };
}
