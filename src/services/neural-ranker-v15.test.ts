import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreCandidateWithNeuralV15, trainNeuralRankerV15 } from './neural-ranker-v15.js';
import type { LearningExampleV15 } from './research-learning-v15.js';

function xorExamples(repetitions = 50): LearningExampleV15[] {
  const patterns = [
    { a: -1, b: -1, label: 0 as const },
    { a: -1, b: 1, label: 1 as const },
    { a: 1, b: -1, label: 1 as const },
    { a: 1, b: 1, label: 0 as const },
  ];
  const examples: LearningExampleV15[] = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (const pattern of patterns) {
      examples.push({
        label: pattern.label,
        features: {
          tournamentSupport: pattern.a,
          comboVerification: pattern.b,
        },
      });
    }
  }
  return examples;
}

test('two-hidden-layer neural ranker can learn a nonlinear interaction the transparent baseline cannot', () => {
  const model = trainNeuralRankerV15(xorExamples(), {
    epochs: 700,
    learningRate: 0.045,
    l2: 0.0005,
    seed: 42,
  });

  assert.equal(model.modelType, 'two-hidden-layer-mlp');
  assert.equal(model.holdoutExamples, 40);
  assert.ok((model.holdoutAccuracy ?? 0) >= 0.95);
  assert.ok((model.transparentBaselineAccuracy ?? 1) <= 0.75);
  assert.ok((model.accuracyImprovementOverBaseline ?? 0) >= 0.2);
  assert.equal(model.shadowCandidate, true);
});

test('neural training is deterministic for the same data and seed', () => {
  const options = { epochs: 300, learningRate: 0.04, l2: 0.001, seed: 99 };
  const left = trainNeuralRankerV15(xorExamples(20), options);
  const right = trainNeuralRankerV15(xorExamples(20), options);

  assert.deepEqual(left.weights1, right.weights1);
  assert.deepEqual(left.weights2, right.weights2);
  assert.deepEqual(left.weights3, right.weights3);
  assert.equal(left.holdoutAccuracy, right.holdoutAccuracy);
});

test('neural score is blocked before inference when hard deck gates fail', () => {
  const model = trainNeuralRankerV15(xorExamples(20), { epochs: 250, seed: 7 });
  const scored = scoreCandidateWithNeuralV15(
    { tournamentSupport: 1, comboVerification: -1 },
    model,
    {
      commanderLegal: true,
      fullyResolved: false,
      exactCardCount: true,
      printingPolicyCompliant: false,
    },
  );

  assert.equal(scored.eligible, false);
  assert.equal(scored.probability, null);
  assert.deepEqual(scored.failedGuardrails.sort(), ['fullyResolved', 'printingPolicyCompliant']);
});

test('non-finite feature and importance values cannot poison neural weights or inference', () => {
  const examples = xorExamples(20);
  const contaminated = examples.map((example, index) => index === 7
    ? {
        ...example,
        importance: Number.NaN,
        features: {
          ...example.features,
          priceEfficiency: Number.NaN,
          communitySupport: Number.POSITIVE_INFINITY,
        },
      }
    : example);

  const model = trainNeuralRankerV15(contaminated, { epochs: 250, seed: 71 });
  const allParameters = [
    ...model.weights1.flat(),
    ...model.bias1,
    ...model.weights2.flat(),
    ...model.bias2,
    ...model.weights3,
    model.bias3,
  ];
  assert.equal(allParameters.every(Number.isFinite), true);
  assert.equal(model.holdoutAccuracy === null || Number.isFinite(model.holdoutAccuracy), true);

  const scored = scoreCandidateWithNeuralV15(
    { tournamentSupport: Number.POSITIVE_INFINITY, comboVerification: Number.NaN },
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

test('non-finite neural hyperparameters fall back to safe defaults', () => {
  const model = trainNeuralRankerV15(xorExamples(10), {
    hiddenLayerOne: Number.NaN,
    hiddenLayerTwo: Number.POSITIVE_INFINITY,
    epochs: Number.NaN,
    learningRate: Number.NaN,
    l2: Number.NaN,
    seed: Number.NaN,
  });

  assert.equal(model.hiddenLayerOne, 8);
  assert.equal(model.hiddenLayerTwo, 4);
  assert.equal(model.seed, 20_260_816);
  assert.equal(model.weights1.length, 8);
  assert.equal(model.weights2.length, 4);
  assert.equal(model.weights1.flat().every(Number.isFinite), true);
  assert.equal(model.weights2.flat().every(Number.isFinite), true);
  assert.equal(model.weights3.every(Number.isFinite), true);
});
