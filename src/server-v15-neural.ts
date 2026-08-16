import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { createMtgServerV15 } from './server-v15.js';
import {
  auditLearningCorpusV15,
  fingerprintExactDeckV15,
  temporalSplitLearningCorpusV15,
  type LearningOutcomeRecordV15,
} from './services/learning-corpus-v15.js';
import {
  scoreCandidateWithNeuralV15,
  trainNeuralRankerV15,
  type NeuralRankerV15,
} from './services/neural-ranker-v15.js';
import type { LearningExampleV15, LearningFeatureV15 } from './services/research-learning-v15.js';

const jsonResult = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const errorResult = (error: unknown) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }],
  isError: true,
});

const learningFeatureSchema = z.object({
  simulationImprovement: z.number().min(-1).max(1).optional(),
  tournamentSupport: z.number().min(-1).max(1).optional(),
  crossClassResearch: z.number().min(-1).max(1).optional(),
  comboVerification: z.number().min(-1).max(1).optional(),
  manaEfficiency: z.number().min(-1).max(1).optional(),
  interactionEfficiency: z.number().min(-1).max(1).optional(),
  priceEfficiency: z.number().min(-1).max(1).optional(),
  communitySupport: z.number().min(-1).max(1).optional(),
});

const hardChecksSchema = z.object({
  commanderLegal: z.boolean(),
  fullyResolved: z.boolean(),
  exactCardCount: z.boolean(),
  printingPolicyCompliant: z.boolean(),
});

const neuralModelSchema = z.object({
  modelType: z.literal('two-hidden-layer-mlp'),
  version: z.literal(1),
  features: z.array(z.enum([
    'simulationImprovement',
    'tournamentSupport',
    'crossClassResearch',
    'comboVerification',
    'manaEfficiency',
    'interactionEfficiency',
    'priceEfficiency',
    'communitySupport',
  ])),
  hiddenLayerOne: z.number().int().min(2).max(32),
  hiddenLayerTwo: z.number().int().min(2).max(16),
  weights1: z.array(z.array(z.number())),
  bias1: z.array(z.number()),
  weights2: z.array(z.array(z.number())),
  bias2: z.array(z.number()),
  weights3: z.array(z.number()),
  bias3: z.number(),
  trainedExamples: z.number().int().min(0),
  holdoutExamples: z.number().int().min(0),
  holdoutAccuracy: z.number().min(0).max(1).nullable(),
  holdoutLogLoss: z.number().min(0).nullable(),
  transparentBaselineAccuracy: z.number().min(0).max(1).nullable(),
  accuracyImprovementOverBaseline: z.number().nullable(),
  shadowCandidate: z.boolean(),
  shadowReasons: z.array(z.string()),
  seed: z.number().int().min(1),
  guardrails: z.array(z.string()),
});

const corpusRecordSchema = z.object({
  outcomeId: z.string().min(1).max(500),
  observedAt: z.string().min(1).max(100),
  sourceId: z.string().min(1).max(100),
  evidenceClass: z.string().min(1).max(100),
  independentGroup: z.string().min(1).max(500),
  leakageGroup: z.string().min(1).max(500),
  deckFingerprint: z.string().min(1).max(256),
  commanderNames: z.array(z.string().min(1).max(256)).min(1).max(2),
  features: learningFeatureSchema,
  label: z.union([z.literal(0), z.literal(1)]),
  importance: z.number().min(0.1).max(5).optional(),
});

function compactFeatures(input: z.infer<typeof learningFeatureSchema>): Partial<Record<LearningFeatureV15, number>> {
  const output: Partial<Record<LearningFeatureV15, number>> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number' && Number.isFinite(value)) output[key as LearningFeatureV15] = value;
  }
  return output;
}

function normalizeExamples(examples: Array<{
  features: z.infer<typeof learningFeatureSchema>;
  label: 0 | 1;
  importance?: number | undefined;
}>): LearningExampleV15[] {
  return examples.map((example) => ({
    features: compactFeatures(example.features),
    label: example.label,
    ...(example.importance !== undefined ? { importance: example.importance } : {}),
  }));
}

function normalizeCorpus(records: Array<z.infer<typeof corpusRecordSchema>>): LearningOutcomeRecordV15[] {
  return records.map((record) => ({
    outcomeId: record.outcomeId,
    observedAt: record.observedAt,
    sourceId: record.sourceId,
    evidenceClass: record.evidenceClass,
    independentGroup: record.independentGroup,
    leakageGroup: record.leakageGroup,
    deckFingerprint: record.deckFingerprint,
    commanderNames: record.commanderNames,
    features: compactFeatures(record.features),
    label: record.label,
    ...(record.importance !== undefined ? { importance: record.importance } : {}),
  }));
}

export function registerMtgNeuralToolsV15(server: McpServer): McpServer {
  server.registerTool(
    'fingerprint_exact_deck_v15',
    {
      title: 'Fingerprint an exact physical Commander deck for learning provenance',
      description: 'Create an order-independent SHA-256 fingerprint that remains sensitive to commander/main zone, quantities, card names, set codes, collector numbers and finishes. This helps stop learning examples from silently mixing different physical deck identities.',
      inputSchema: z.object({ decklist: z.string().min(1).max(100_000) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ decklist }) => {
      try {
        return jsonResult({ fingerprint: fingerprintExactDeckV15(decklist) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'audit_learning_corpus_v15',
    {
      title: 'Audit MTG learning data for duplicates, balance, diversity and leakage risk',
      description: 'Audit labelled outcome data before training. Reports conservative duplicate rate, label balance, temporal coverage, independent evidence groups, evidence-class diversity, leakage groups and malformed records.',
      inputSchema: z.object({ records: z.array(corpusRecordSchema).min(1).max(50_000) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ records }) => {
      try {
        const normalized = normalizeCorpus(records);
        return jsonResult({
          audit: auditLearningCorpusV15(normalized),
          temporalSplit: temporalSplitLearningCorpusV15(normalized, 0.2),
          guidance: 'Do not train a neural model on duplicated event/deck-history groups or evaluate it on closely related records seen during training. Temporal leakage-safe performance is the promotion signal that matters.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'train_neural_ranker_v15',
    {
      title: 'Train the experimental two-hidden-layer MTG neural shadow ranker',
      description: 'Train a deterministic two-hidden-layer neural ranker on labelled strategy/evidence features. It automatically compares holdout performance against the transparent logistic baseline and remains a shadow candidate unless it materially wins. This tool does not bypass legality, card-count, resolution or printing-policy gates.',
      inputSchema: z.object({
        examples: z.array(z.object({
          features: learningFeatureSchema,
          label: z.union([z.literal(0), z.literal(1)]),
          importance: z.number().min(0.1).max(5).optional(),
        })).min(1).max(50_000),
        hiddenLayerOne: z.number().int().min(2).max(32).optional().default(8),
        hiddenLayerTwo: z.number().int().min(2).max(16).optional().default(4),
        epochs: z.number().int().min(1).max(2_000).optional().default(400),
        learningRate: z.number().min(0.0001).max(0.3).optional().default(0.035),
        l2: z.number().min(0).max(0.1).optional().default(0.001),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ examples, hiddenLayerOne, hiddenLayerTwo, epochs, learningRate, l2, seed }) => {
      try {
        return jsonResult(trainNeuralRankerV15(normalizeExamples(examples), {
          hiddenLayerOne,
          hiddenLayerTwo,
          epochs,
          learningRate,
          l2,
          seed,
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'score_candidate_with_neural_v15',
    {
      title: 'Score an MTG candidate with the experimental neural shadow model',
      description: 'Run neural inference only after hard Commander legality, exact-size, resolution and physical-printing gates pass. A failed hard gate blocks inference completely.',
      inputSchema: z.object({
        features: learningFeatureSchema,
        model: neuralModelSchema,
        hardChecks: hardChecksSchema,
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ features, model, hardChecks }) => {
      try {
        return jsonResult(scoreCandidateWithNeuralV15(compactFeatures(features), model as NeuralRankerV15, hardChecks));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

export function createMtgServerV15Neural(): McpServer {
  return registerMtgNeuralToolsV15(createMtgServerV15());
}
