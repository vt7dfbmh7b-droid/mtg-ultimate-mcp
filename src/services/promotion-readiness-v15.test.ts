import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessPromotionReadinessV15,
  type PromotionReadinessEvidenceV15,
} from './promotion-readiness-v15.js';

function evidence(overrides: Partial<PromotionReadinessEvidenceV15> = {}): PromotionReadinessEvidenceV15 {
  return {
    usefulness: 'shadow-gain-observed',
    usefulnessReasons: ['Neural shadow model met the sealed future-holdout criteria.'],
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
    ...overrides,
  };
}

test('successful genuine-future evidence becomes eligible for explicit human promotion review', () => {
  const result = assessPromotionReadinessV15(evidence());

  assert.equal(result.evidenceStatus, 'eligible-for-human-review');
  assert.equal(result.modelEvidencePassed, true);
  assert.equal(result.recommendedAction, 'request-explicit-promotion-review');
  assert.equal(result.automaticStablePromotionAllowed, false);
  assert.equal(result.stablePromotionAuthorized, false);
  assert.equal(result.requiresExplicitUserApproval, true);
  assert.deepEqual(result.blockers, []);
});

test('no demonstrated neural gain stays blocked instead of pretending CI equals model promotion', () => {
  const result = assessPromotionReadinessV15(evidence({
    usefulness: 'no-demonstrated-neural-gain',
    usefulnessReasons: ['Transparent baseline remains as good or better.'],
  }));

  assert.equal(result.evidenceStatus, 'blocked');
  assert.equal(result.modelEvidencePassed, false);
  assert.equal(result.recommendedAction, 'continue-evidence-collection');
  assert.match(result.blockers.join(' '), /not met the precommitted gain criteria/i);
});

test('a test-clock holdout cannot qualify for promotion review even with apparent neural gain', () => {
  const base = evidence();
  const result = assessPromotionReadinessV15(evidence({
    futureGate: { ...base.futureGate, sealClockAttested: false },
  }));

  assert.equal(result.evidenceStatus, 'blocked');
  assert.match(result.blockers.join(' '), /real system clock/i);
});

test('failed corpus quality remains a promotion blocker', () => {
  const result = assessPromotionReadinessV15(evidence({
    trainingQuality: {
      qualityGatePassed: false,
      blockers: ['insufficient source diversity'],
    },
  }));

  assert.equal(result.evidenceStatus, 'blocked');
  assert.match(result.blockers.join(' '), /insufficient source diversity/i);
});

test('promotion readiness refuses any tampered evaluation claiming automatic authorization', () => {
  const tampered = {
    ...evidence(),
    promotionAuthorized: true,
  } as unknown as PromotionReadinessEvidenceV15;

  assert.throws(
    () => assessPromotionReadinessV15(tampered),
    /refuses evaluations that claim automatic promotion authorization/i,
  );
});
