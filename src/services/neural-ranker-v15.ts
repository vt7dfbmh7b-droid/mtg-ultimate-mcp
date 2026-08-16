import {
  LEARNING_FEATURES_V15,
  scoreCandidateWithLearningV15,
  trainAdaptiveRankerV15,
  type HardDeckChecksV15,
  type LearningExampleV15,
  type LearningFeatureV15,
} from './research-learning-v15.js';

export interface NeuralRankerOptionsV15 {
  hiddenLayerOne?: number;
  hiddenLayerTwo?: number;
  epochs?: number;
  learningRate?: number;
  l2?: number;
  seed?: number;
}

export interface NeuralRankerV15 {
  modelType: 'two-hidden-layer-mlp';
  version: 1;
  features: LearningFeatureV15[];
  hiddenLayerOne: number;
  hiddenLayerTwo: number;
  weights1: number[][];
  bias1: number[];
  weights2: number[][];
  bias2: number[];
  weights3: number[];
  bias3: number;
  trainedExamples: number;
  holdoutExamples: number;
  holdoutAccuracy: number | null;
  holdoutLogLoss: number | null;
  transparentBaselineAccuracy: number | null;
  accuracyImprovementOverBaseline: number | null;
  shadowCandidate: boolean;
  shadowReasons: string[];
  seed: number;
  guardrails: string[];
}

interface ForwardPassV15 {
  input: number[];
  hidden1: number[];
  hidden2: number[];
  output: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomMatrix(rows: number, columns: number, random: () => number, scale: number): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => (random() * 2 - 1) * scale));
}

function randomVector(length: number, random: () => number, scale: number): number[] {
  return Array.from({ length }, () => (random() * 2 - 1) * scale);
}

function featureVector(example: LearningExampleV15 | { features: Partial<Record<LearningFeatureV15, number>> }): number[] {
  return LEARNING_FEATURES_V15.map((feature) => clamp(example.features[feature] ?? 0, -1, 1));
}

function dot(weights: number[], values: number[]): number {
  let output = 0;
  for (let index = 0; index < weights.length; index += 1) output += (weights[index] ?? 0) * (values[index] ?? 0);
  return output;
}

function forward(model: NeuralRankerV15, features: number[]): ForwardPassV15 {
  const hidden1 = model.weights1.map((row, index) => Math.tanh(dot(row, features) + (model.bias1[index] ?? 0)));
  const hidden2 = model.weights2.map((row, index) => Math.tanh(dot(row, hidden1) + (model.bias2[index] ?? 0)));
  const output = sigmoid(dot(model.weights3, hidden2) + model.bias3);
  return { input: features, hidden1, hidden2, output };
}

function binaryLogLoss(label: number, prediction: number): number {
  const p = clamp(prediction, 1e-9, 1 - 1e-9);
  return -(label * Math.log(p) + (1 - label) * Math.log(1 - p));
}

function evaluate(model: NeuralRankerV15, examples: LearningExampleV15[]): { accuracy: number | null; logLoss: number | null } {
  if (examples.length === 0) return { accuracy: null, logLoss: null };
  let correct = 0;
  let loss = 0;
  for (const example of examples) {
    const prediction = forward(model, featureVector(example)).output;
    if ((prediction >= 0.5 ? 1 : 0) === example.label) correct += 1;
    loss += binaryLogLoss(example.label, prediction);
  }
  return { accuracy: correct / examples.length, logLoss: loss / examples.length };
}

function emptyModel(
  hiddenLayerOne: number,
  hiddenLayerTwo: number,
  seed: number,
  random: () => number,
): NeuralRankerV15 {
  const inputCount = LEARNING_FEATURES_V15.length;
  const scale1 = Math.sqrt(2 / Math.max(1, inputCount + hiddenLayerOne));
  const scale2 = Math.sqrt(2 / Math.max(1, hiddenLayerOne + hiddenLayerTwo));
  const scale3 = Math.sqrt(2 / Math.max(1, hiddenLayerTwo + 1));
  return {
    modelType: 'two-hidden-layer-mlp',
    version: 1,
    features: [...LEARNING_FEATURES_V15],
    hiddenLayerOne,
    hiddenLayerTwo,
    weights1: randomMatrix(hiddenLayerOne, inputCount, random, scale1),
    bias1: Array.from({ length: hiddenLayerOne }, () => 0),
    weights2: randomMatrix(hiddenLayerTwo, hiddenLayerOne, random, scale2),
    bias2: Array.from({ length: hiddenLayerTwo }, () => 0),
    weights3: randomVector(hiddenLayerTwo, random, scale3),
    bias3: 0,
    trainedExamples: 0,
    holdoutExamples: 0,
    holdoutAccuracy: null,
    holdoutLogLoss: null,
    transparentBaselineAccuracy: null,
    accuracyImprovementOverBaseline: null,
    shadowCandidate: false,
    shadowReasons: [],
    seed,
    guardrails: [
      'Neural ranking never overrides Commander legality.',
      'Neural ranking never overrides exact 100-card validation.',
      'Neural ranking never overrides unresolved-card failures.',
      'Neural ranking never overrides exact physical-printing restrictions.',
      'The neural model remains experimental until it beats the transparent baseline on unseen data and passes the separate deep-learning readiness gate.',
    ],
  };
}

export function trainNeuralRankerV15(
  examples: LearningExampleV15[],
  options: NeuralRankerOptionsV15 = {},
): NeuralRankerV15 {
  const hiddenLayerOne = Math.max(2, Math.min(32, Math.trunc(options.hiddenLayerOne ?? 8)));
  const hiddenLayerTwo = Math.max(2, Math.min(16, Math.trunc(options.hiddenLayerTwo ?? 4)));
  const epochs = Math.max(1, Math.min(2_000, Math.trunc(options.epochs ?? 400)));
  const learningRate = clamp(options.learningRate ?? 0.035, 0.0001, 0.3);
  const l2 = clamp(options.l2 ?? 0.001, 0, 0.1);
  const seed = Math.max(1, Math.min(2_147_483_647, Math.trunc(options.seed ?? 20_260_816)));
  const random = mulberry32(seed);
  const model = emptyModel(hiddenLayerOne, hiddenLayerTwo, seed, random);
  const training = examples.filter((_, index) => index % 5 !== 0);
  const holdout = examples.filter((_, index) => index % 5 === 0);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const example of training) {
      const pass = forward(model, featureVector(example));
      const importance = clamp(example.importance ?? 1, 0.1, 5);
      const deltaOutput = (pass.output - example.label) * importance;

      const deltaHidden2 = model.weights3.map((weight, index) =>
        weight * deltaOutput * (1 - (pass.hidden2[index] ?? 0) ** 2));
      const deltaHidden1 = model.weights1.map((_, hidden1Index) => {
        let propagated = 0;
        for (let hidden2Index = 0; hidden2Index < model.hiddenLayerTwo; hidden2Index += 1) {
          propagated += (model.weights2[hidden2Index]?.[hidden1Index] ?? 0) * (deltaHidden2[hidden2Index] ?? 0);
        }
        return propagated * (1 - (pass.hidden1[hidden1Index] ?? 0) ** 2);
      });

      for (let hidden2Index = 0; hidden2Index < model.hiddenLayerTwo; hidden2Index += 1) {
        const activation = pass.hidden2[hidden2Index] ?? 0;
        const oldWeight = model.weights3[hidden2Index] ?? 0;
        model.weights3[hidden2Index] = oldWeight - learningRate * (deltaOutput * activation + l2 * oldWeight);
      }
      model.bias3 -= learningRate * deltaOutput;

      for (let hidden2Index = 0; hidden2Index < model.hiddenLayerTwo; hidden2Index += 1) {
        const row = model.weights2[hidden2Index];
        if (!row) continue;
        const delta = deltaHidden2[hidden2Index] ?? 0;
        for (let hidden1Index = 0; hidden1Index < model.hiddenLayerOne; hidden1Index += 1) {
          const oldWeight = row[hidden1Index] ?? 0;
          row[hidden1Index] = oldWeight - learningRate * (delta * (pass.hidden1[hidden1Index] ?? 0) + l2 * oldWeight);
        }
        model.bias2[hidden2Index] = (model.bias2[hidden2Index] ?? 0) - learningRate * delta;
      }

      for (let hidden1Index = 0; hidden1Index < model.hiddenLayerOne; hidden1Index += 1) {
        const row = model.weights1[hidden1Index];
        if (!row) continue;
        const delta = deltaHidden1[hidden1Index] ?? 0;
        for (let inputIndex = 0; inputIndex < pass.input.length; inputIndex += 1) {
          const oldWeight = row[inputIndex] ?? 0;
          row[inputIndex] = oldWeight - learningRate * (delta * (pass.input[inputIndex] ?? 0) + l2 * oldWeight);
        }
        model.bias1[hidden1Index] = (model.bias1[hidden1Index] ?? 0) - learningRate * delta;
      }
    }
  }

  const evaluation = evaluate(model, holdout);
  const baseline = trainAdaptiveRankerV15(examples, {
    epochs: Math.min(500, Math.max(120, Math.trunc(epochs / 2))),
    learningRate: 0.08,
    l2: 0.01,
    minimumExamples: Math.max(10, examples.length + 1),
    minimumHoldoutAccuracy: 1,
  });
  const baselineAccuracy = baseline.holdoutAccuracy;
  const improvement = evaluation.accuracy === null || baselineAccuracy === null
    ? null
    : evaluation.accuracy - baselineAccuracy;
  const shadowReasons: string[] = [];
  if (holdout.length < 20) shadowReasons.push('Need at least 20 unseen holdout examples before treating the neural model as a meaningful shadow candidate.');
  if (evaluation.accuracy === null || evaluation.accuracy < 0.75) shadowReasons.push('Neural holdout accuracy is below 75%.');
  if (improvement === null || improvement < 0.02) shadowReasons.push('Neural model does not beat the transparent baseline by at least two percentage points on the same holdout split.');

  model.trainedExamples = training.length;
  model.holdoutExamples = holdout.length;
  model.holdoutAccuracy = evaluation.accuracy === null ? null : round(evaluation.accuracy);
  model.holdoutLogLoss = evaluation.logLoss === null ? null : round(evaluation.logLoss);
  model.transparentBaselineAccuracy = baselineAccuracy === null ? null : round(baselineAccuracy);
  model.accuracyImprovementOverBaseline = improvement === null ? null : round(improvement);
  model.shadowCandidate = shadowReasons.length === 0;
  model.shadowReasons = shadowReasons;

  model.weights1 = model.weights1.map((row) => row.map((value) => round(value)));
  model.bias1 = model.bias1.map((value) => round(value));
  model.weights2 = model.weights2.map((row) => row.map((value) => round(value)));
  model.bias2 = model.bias2.map((value) => round(value));
  model.weights3 = model.weights3.map((value) => round(value));
  model.bias3 = round(model.bias3);
  return model;
}

export function scoreCandidateWithNeuralV15(
  features: Partial<Record<LearningFeatureV15, number>>,
  model: NeuralRankerV15,
  hardChecks: HardDeckChecksV15,
): { eligible: boolean; probability: number | null; failedGuardrails: string[]; shadowModel: boolean } {
  const transparentGate = scoreCandidateWithLearningV15(features, {
    modelType: 'transparent-logistic-ranker',
    version: 1,
    weights: Object.fromEntries(LEARNING_FEATURES_V15.map((feature) => [feature, 0])) as Record<LearningFeatureV15, number>,
    bias: 0,
    trainedExamples: 0,
    holdoutExamples: 0,
    holdoutAccuracy: null,
    promotable: false,
    promotionReasons: [],
    guardrails: [],
  }, hardChecks);
  if (!transparentGate.eligible) {
    return {
      eligible: false,
      probability: null,
      failedGuardrails: transparentGate.failedGuardrails,
      shadowModel: model.shadowCandidate,
    };
  }
  const probability = forward(model, featureVector({ features })).output;
  return {
    eligible: true,
    probability: round(probability),
    failedGuardrails: [],
    shadowModel: model.shadowCandidate,
  };
}
