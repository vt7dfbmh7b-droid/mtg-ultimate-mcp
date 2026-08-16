import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDeepResearchPlanV15,
  evaluateDeepLearningReadinessV15,
  scoreCandidateWithLearningV15,
  scoreResearchObservationV15,
  synthesizeDeepResearchV15,
  trainAdaptiveRankerV15,
  type LearningExampleV15,
} from './research-learning-v15.js';

test('deep research collapses dependent copies instead of double counting one dataset', () => {
  const synthesis = synthesizeDeepResearchV15([
    {
      sourceId: 'topdeck',
      focus: 'competitive',
      subject: 'Card A',
      claim: 'improves tournament performance',
      independentGroup: 'same-event-feed',
      structured: true,
      sampleSize: 80,
    },
    {
      sourceId: 'edhtop16',
      focus: 'competitive',
      subject: 'Card A',
      claim: 'improves tournament performance',
      independentGroup: 'same-event-feed',
      sampleSize: 80,
    },
  ])[0];

  assert.ok(synthesis);
  assert.equal(synthesis.independentGroupCount, 1);
  assert.equal(synthesis.observations.length, 1);
  assert.ok(synthesis.researchGaps.some((gap) => gap.includes('one independent')));
  assert.ok(synthesis.confidence <= 0.55, 'one independent evidence group must not receive high confidence');
});

test('deep research keeps strong contradictory evidence visible as disputed', () => {
  const synthesis = synthesizeDeepResearchV15([
    {
      sourceId: 'topdeck',
      focus: 'competitive',
      subject: 'Commander X',
      claim: 'is strongly positioned',
      polarity: 'support',
      independentGroup: 'tournament-results',
      structured: true,
      sampleSize: 200,
      ageDays: 3,
    },
    {
      sourceId: 'playgroup',
      focus: 'recorded-games',
      subject: 'Commander X',
      claim: 'is strongly positioned',
      polarity: 'oppose',
      independentGroup: 'paper-games',
      sampleSize: 300,
      ageDays: 3,
    },
  ])[0];

  assert.ok(synthesis);
  assert.equal(synthesis.verdict, 'disputed');
  assert.ok(synthesis.supportWeight > 0);
  assert.ok(synthesis.opposeWeight > 0);
});

test('fast-changing pricing evidence decays much faster than stable rules evidence', () => {
  const stalePrice = scoreResearchObservationV15({
    sourceId: 'scryfall',
    focus: 'pricing',
    subject: 'Sol Ring',
    claim: 'reference price is current',
    ageDays: 60,
  });
  const oldRules = scoreResearchObservationV15({
    sourceId: 'wizards',
    focus: 'rules',
    subject: 'Commander',
    claim: 'deck construction rule is current',
    ageDays: 60,
  });

  assert.ok(stalePrice.freshness < 0.2);
  assert.ok(oldRules.freshness > 0.98);
  assert.ok(stalePrice.score < oldRules.score);
});

test('non-finite research outcome strength falls back safely instead of poisoning evidence scores', () => {
  const scored = scoreResearchObservationV15({
    sourceId: 'topdeck',
    focus: 'competitive',
    subject: 'Commander X',
    claim: 'has current tournament support',
    outcomeStrength: Number.NaN,
    sampleSize: 100,
  });

  assert.equal(Number.isFinite(scored.score), true);
  assert.ok(scored.score > 0);
});

test('deep research plan deliberately spans different evidence classes', () => {
  const plan = buildDeepResearchPlanV15(['competitive', 'decklists', 'combos']);
  assert.ok(plan.sources.length >= 5);
  assert.ok(plan.evidenceClasses.includes('observed-results'));
  assert.ok(plan.evidenceClasses.includes('curated'));
  assert.ok(plan.evidenceClasses.includes('community'));
});

function syntheticExamples(): LearningExampleV15[] {
  const examples: LearningExampleV15[] = [];
  for (let index = 0; index < 50; index += 1) {
    const positive = index % 2 === 0;
    examples.push({
      label: positive ? 1 : 0,
      features: {
        tournamentSupport: positive ? 0.9 : -0.9,
        comboVerification: positive ? 0.8 : -0.7,
        simulationImprovement: positive ? 0.7 : -0.6,
        communitySupport: positive ? 0.2 : 0.4,
      },
    });
  }
  return examples;
}

test('adaptive ranker learns from labelled outcomes but requires holdout evaluation', () => {
  const model = trainAdaptiveRankerV15(syntheticExamples());
  assert.equal(model.modelType, 'transparent-logistic-ranker');
  assert.equal(model.holdoutExamples, 10);
  assert.notEqual(model.holdoutAccuracy, null);
  assert.ok((model.holdoutAccuracy ?? 0) >= 0.9);
  assert.equal(model.promotable, true);
  assert.ok(model.weights.tournamentSupport > 0);
  assert.ok(model.weights.comboVerification > 0);
});

test('small datasets cannot silently promote learned weights', () => {
  const model = trainAdaptiveRankerV15(syntheticExamples().slice(0, 10));
  assert.equal(model.promotable, false);
  assert.ok(model.promotionReasons.length > 0);
});

test('transparent ranker rejects non-finite influence by falling back to safe numeric defaults', () => {
  const examples = syntheticExamples().map((example, index) => index === 7
    ? {
        ...example,
        importance: Number.NaN,
        features: {
          ...example.features,
          tournamentSupport: Number.NaN,
          communitySupport: Number.POSITIVE_INFINITY,
        },
      }
    : example);
  const model = trainAdaptiveRankerV15(examples, {
    epochs: Number.NaN,
    learningRate: Number.NaN,
    l2: Number.NaN,
    minimumExamples: Number.NaN,
    minimumHoldoutAccuracy: Number.NaN,
  });

  assert.equal(Object.values(model.weights).every(Number.isFinite), true);
  assert.equal(Number.isFinite(model.bias), true);
  assert.equal(model.holdoutAccuracy === null || Number.isFinite(model.holdoutAccuracy), true);

  const scored = scoreCandidateWithLearningV15(
    { tournamentSupport: Number.NaN, comboVerification: Number.POSITIVE_INFINITY },
    model,
    {
      commanderLegal: true,
      fullyResolved: true,
      exactCardCount: true,
      printingPolicyCompliant: true,
    },
  );
  assert.equal(scored.eligible, true);
  assert.notEqual(scored.probability, null);
  assert.equal(Number.isFinite(scored.probability), true);
});

test('learned score can never override Commander legality or printing policy', () => {
  const model = trainAdaptiveRankerV15(syntheticExamples());
  const blocked = scoreCandidateWithLearningV15(
    {
      tournamentSupport: 1,
      comboVerification: 1,
      simulationImprovement: 1,
    },
    model,
    {
      commanderLegal: false,
      fullyResolved: true,
      exactCardCount: true,
      printingPolicyCompliant: false,
    },
  );

  assert.equal(blocked.eligible, false);
  assert.equal(blocked.probability, null);
  assert.deepEqual(blocked.failedGuardrails.sort(), ['commanderLegal', 'printingPolicyCompliant']);
});

test('deep-learning readiness blocks small duplicated or leaky datasets', () => {
  const readiness = evaluateDeepLearningReadinessV15({
    labelledExamples: 300,
    positiveExamples: 270,
    negativeExamples: 30,
    temporalCoverageDays: 30,
    independentEvidenceGroups: 1,
    evidenceClassCount: 1,
    duplicateRate: 0.3,
    leakageChecksPassed: false,
    transparentBaselineAccuracy: 0.74,
    candidateModelAccuracy: 0.82,
    temporalHoldoutExamples: 50,
  });

  assert.equal(readiness.status, 'not-ready');
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('labelled examples')));
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('Duplicate')));
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('leakage')));
});

test('clean corpus can be experiment-ready before a neural candidate or baseline exists', () => {
  const readiness = evaluateDeepLearningReadinessV15({
    labelledExamples: 1000,
    positiveExamples: 520,
    negativeExamples: 480,
    temporalCoverageDays: 180,
    independentEvidenceGroups: 6,
    evidenceClassCount: 4,
    duplicateRate: 0.02,
    leakageChecksPassed: true,
    transparentBaselineAccuracy: null,
    candidateModelAccuracy: null,
    temporalHoldoutExamples: 0,
  });

  assert.equal(readiness.status, 'experiment-ready');
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('neural candidate')));
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('Transparent baseline')));
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('Temporal holdout')));
});

test('deep-learning promotion requires a clean temporal win over transparent baseline', () => {
  const readiness = evaluateDeepLearningReadinessV15({
    labelledExamples: 3000,
    positiveExamples: 1600,
    negativeExamples: 1400,
    temporalCoverageDays: 365,
    independentEvidenceGroups: 8,
    evidenceClassCount: 5,
    duplicateRate: 0.03,
    leakageChecksPassed: true,
    transparentBaselineAccuracy: 0.76,
    candidateModelAccuracy: 0.8,
    temporalHoldoutExamples: 500,
  });

  assert.equal(readiness.status, 'promotion-ready');
  assert.equal(readiness.blockers.length, 0);
  assert.ok(readiness.readinessScore > 0.9);
});

test('deep-learning candidate cannot promote if it does not beat transparent baseline', () => {
  const readiness = evaluateDeepLearningReadinessV15({
    labelledExamples: 3000,
    positiveExamples: 1600,
    negativeExamples: 1400,
    temporalCoverageDays: 365,
    independentEvidenceGroups: 8,
    evidenceClassCount: 5,
    duplicateRate: 0.03,
    leakageChecksPassed: true,
    transparentBaselineAccuracy: 0.8,
    candidateModelAccuracy: 0.805,
    temporalHoldoutExamples: 500,
  });

  assert.notEqual(readiness.status, 'promotion-ready');
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('does not materially beat')));
});

test('deep-learning candidate cannot promote without a transparent baseline comparison', () => {
  const readiness = evaluateDeepLearningReadinessV15({
    labelledExamples: 3000,
    positiveExamples: 1600,
    negativeExamples: 1400,
    temporalCoverageDays: 365,
    independentEvidenceGroups: 8,
    evidenceClassCount: 5,
    duplicateRate: 0.03,
    leakageChecksPassed: true,
    transparentBaselineAccuracy: null,
    candidateModelAccuracy: 0.9,
    temporalHoldoutExamples: 500,
  });

  assert.equal(readiness.status, 'experiment-ready');
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('Transparent baseline')));
});

test('deep-learning readiness rejects inconsistent label totals', () => {
  const readiness = evaluateDeepLearningReadinessV15({
    labelledExamples: 3000,
    positiveExamples: 2500,
    negativeExamples: 1500,
    temporalCoverageDays: 365,
    independentEvidenceGroups: 8,
    evidenceClassCount: 5,
    duplicateRate: 0.03,
    leakageChecksPassed: true,
    transparentBaselineAccuracy: 0.76,
    candidateModelAccuracy: 0.82,
    temporalHoldoutExamples: 500,
  });

  assert.equal(readiness.status, 'not-ready');
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('label counts')));
});
