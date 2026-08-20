import { createHash } from 'node:crypto';
import {
  assertHistoricalLearningRecordEligibleV15,
  buildHistoricalLearningCorpusManifestV15,
  type HistoricalLearningRecordV15,
} from './historical-learning-corpus-v15.js';
import { assessTemporalFeatureContractSafetyV15 } from './neural-temporal-eval-v15.js';
import type { NeuralRankerOptionsV15 } from './neural-ranker-v15.js';
import { auditRealCorpusQualityV15 } from './real-corpus-quality-v15.js';

export const FUTURE_HOLDOUT_SEAL_SCHEMA_V15 = 'future-holdout-seal-v15.1' as const;

export interface LockedNeuralOptionsV15 {
  hiddenLayerOne: number;
  hiddenLayerTwo: number;
  epochs: number;
  learningRate: number;
  l2: number;
  seed: number;
}

export interface LockedTransparentOptionsV15 {
  epochs: number;
  learningRate: number;
  l2: number;
}

export interface FutureHoldoutEvaluationPlanV15 {
  decisionThreshold: number;
  calibrationBins: number;
  neural: LockedNeuralOptionsV15;
  transparent: LockedTransparentOptionsV15;
  requiredMetrics: readonly ['accuracy', 'balanced-accuracy', 'log-loss', 'brier-score', 'auroc', 'expected-calibration-error'];
  minimumFutureHoldoutRecordsForUsefulnessClaim: 200;
  minimumFutureHoldoutMinorityShare: 0.2;
  minimumBalancedAccuracyGainOverTransparent: 0.02;
  minimumAuRocGainOverTransparent: 0.01;
  maximumLogLossRegressionVsTransparent: 0;
}

export interface FutureHoldoutSealV15 {
  schemaVersion: typeof FUTURE_HOLDOUT_SEAL_SCHEMA_V15;
  sealedAt: string;
  clockAttestation: 'system-clock' | 'injected-test-clock';
  trainingAsOf: string;
  learningTarget: string;
  trainingRecordCount: number;
  trainingPositiveRecords: number;
  trainingNegativeRecords: number;
  trainingOutcomeIds: string[];
  trainingHistoricalManifestHash: string;
  trainingHistoricalCorpusContentHash: string;
  trainingSourceIds: string[];
  trainingLineageFamilies: string[];
  featureExtractorContract: string;
  featureNormalizerFitFingerprint: string;
  trainingLeakageGroupDigest: string;
  evaluationPlan: FutureHoldoutEvaluationPlanV15;
  sealHash: string;
  guardrails: readonly [
    'Training corpus identity is content-addressed and may not change after sealing.',
    'Model hyperparameters, threshold, calibration bins, and success criteria are fixed before future outcomes are admitted.',
    'Future holdout outcomes must occur and become source-available after sealedAt.',
    'Future holdout features must use the exact training-fitted feature normalizer fingerprint.',
    'Training and future holdout leakage groups may not overlap.',
    'The seal is an application-level precommitment; repository/audit retention should preserve when the seal was created.'
  ];
}

export interface FutureHoldoutSealOptionsV15 {
  decisionThreshold?: number;
  calibrationBins?: number;
  neural?: NeuralRankerOptionsV15;
  transparent?: { epochs?: number; learningRate?: number; l2?: number };
  /** Deterministic test hook. Any seal created with this hook is permanently test-attested and cannot support a usefulness claim. */
  now?: () => Date;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function timestamp(name: string, value: unknown): { iso: string; ms: number } {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty timestamp.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedPlan(options: FutureHoldoutSealOptionsV15): FutureHoldoutEvaluationPlanV15 {
  const neural = options.neural ?? {};
  const transparent = options.transparent ?? {};
  return {
    decisionThreshold: clamp(finite(options.decisionThreshold, 0.5), 0.05, 0.95),
    calibrationBins: Math.max(5, Math.min(20, Math.trunc(finite(options.calibrationBins, 10)))),
    neural: {
      hiddenLayerOne: Math.max(2, Math.min(32, Math.trunc(finite(neural.hiddenLayerOne, 8)))),
      hiddenLayerTwo: Math.max(2, Math.min(16, Math.trunc(finite(neural.hiddenLayerTwo, 4)))),
      epochs: Math.max(1, Math.min(2_000, Math.trunc(finite(neural.epochs, 400)))),
      learningRate: clamp(finite(neural.learningRate, 0.035), 0.0001, 0.3),
      l2: clamp(finite(neural.l2, 0.001), 0, 0.1),
      seed: Math.max(1, Math.min(2_147_483_647, Math.trunc(finite(neural.seed, 20_260_816)))),
    },
    transparent: {
      epochs: Math.max(1, Math.min(500, Math.trunc(finite(transparent.epochs, 200)))),
      learningRate: clamp(finite(transparent.learningRate, 0.08), 0.001, 0.5),
      l2: clamp(finite(transparent.l2, 0.01), 0, 0.2),
    },
    requiredMetrics: ['accuracy', 'balanced-accuracy', 'log-loss', 'brier-score', 'auroc', 'expected-calibration-error'],
    minimumFutureHoldoutRecordsForUsefulnessClaim: 200,
    minimumFutureHoldoutMinorityShare: 0.2,
    minimumBalancedAccuracyGainOverTransparent: 0.02,
    minimumAuRocGainOverTransparent: 0.01,
    maximumLogLossRegressionVsTransparent: 0,
  };
}

function featureContract(records: HistoricalLearningRecordV15[]): { extractor: string; normalizer: string } {
  const safety = assessTemporalFeatureContractSafetyV15(records.map((record) => record.record));
  if (!safety.safe) throw new Error(`Future holdout sealing requires one leakage-safe feature contract: ${safety.reasons.join(' ')}`);
  if (safety.featureExtractorContracts.length !== 1) throw new Error('Future holdout sealing requires exactly one feature extractor contract.');
  if (safety.featureNormalizerFitFingerprints.length !== 1) throw new Error('Future holdout sealing requires exactly one explicit feature normalizer fit fingerprint.');
  const extractor = safety.featureExtractorContracts[0];
  const normalizer = safety.featureNormalizerFitFingerprints[0];
  if (!extractor || !normalizer || !/^[a-f0-9]{64}$/i.test(normalizer)) {
    throw new Error('Future holdout sealing requires a valid explicit training-fitted normalizer SHA-256 fingerprint.');
  }
  return { extractor, normalizer: normalizer.toLocaleLowerCase() };
}

function leakageDigest(records: HistoricalLearningRecordV15[]): string {
  return sha256(records.map((record) => normalize(record.record.leakageGroup)).sort().join('\n'));
}

export function createFutureHoldoutSealV15(
  trainingRecords: HistoricalLearningRecordV15[],
  trainingAsOf: string,
  options: FutureHoldoutSealOptionsV15 = {},
): FutureHoldoutSealV15 {
  if (!Array.isArray(trainingRecords) || trainingRecords.length < 20) {
    throw new Error('Future holdout sealing requires at least 20 strict historical training records.');
  }
  for (const record of trainingRecords) assertHistoricalLearningRecordEligibleV15(record);
  const asOf = timestamp('trainingAsOf', trainingAsOf);
  const clockAttestation: FutureHoldoutSealV15['clockAttestation'] = options.now ? 'injected-test-clock' : 'system-clock';
  const now = options.now ?? (() => new Date());
  const sealedDate = now();
  if (!(sealedDate instanceof Date) || !Number.isFinite(sealedDate.getTime())) throw new Error('now() must return a valid Date.');
  const sealedAt = { iso: sealedDate.toISOString(), ms: sealedDate.getTime() };
  if (sealedAt.ms < asOf.ms) throw new Error('sealedAt cannot be earlier than trainingAsOf.');

  for (const record of trainingRecords) {
    if (timestamp('record.record.observedAt', record.record.observedAt).ms > asOf.ms) {
      throw new Error(`Training record ${record.record.outcomeId} occurred after trainingAsOf.`);
    }
    if (timestamp('record.outcomeEvidence.sourceAvailableAt', record.outcomeEvidence.sourceAvailableAt).ms > asOf.ms) {
      throw new Error(`Training record ${record.record.outcomeId} was not independently source-available by trainingAsOf.`);
    }
  }

  const quality = auditRealCorpusQualityV15(trainingRecords);
  if (!quality.qualityGatePassed) throw new Error(`Training corpus failed the real-corpus quality gate: ${quality.blockers.join(' ')}`);
  const target = quality.learningTargets.length === 1 ? quality.learningTargets[0] : null;
  if (!target || target === 'legacy-unspecified') throw new Error('Future holdout sealing requires exactly one explicit non-legacy learning target.');
  const contract = featureContract(trainingRecords);
  const manifest = buildHistoricalLearningCorpusManifestV15(trainingRecords);

  const payload: Omit<FutureHoldoutSealV15, 'sealHash'> = {
    schemaVersion: FUTURE_HOLDOUT_SEAL_SCHEMA_V15,
    sealedAt: sealedAt.iso,
    clockAttestation,
    trainingAsOf: asOf.iso,
    learningTarget: target,
    trainingRecordCount: trainingRecords.length,
    trainingPositiveRecords: quality.positiveRecords,
    trainingNegativeRecords: quality.negativeRecords,
    trainingOutcomeIds: trainingRecords.map((record) => record.record.outcomeId).sort(),
    trainingHistoricalManifestHash: manifest.manifestHash,
    trainingHistoricalCorpusContentHash: manifest.corpusContentHash,
    trainingSourceIds: quality.sourceIds,
    trainingLineageFamilies: quality.lineageFamilies,
    featureExtractorContract: contract.extractor,
    featureNormalizerFitFingerprint: contract.normalizer,
    trainingLeakageGroupDigest: leakageDigest(trainingRecords),
    evaluationPlan: normalizedPlan(options),
    guardrails: [
      'Training corpus identity is content-addressed and may not change after sealing.',
      'Model hyperparameters, threshold, calibration bins, and success criteria are fixed before future outcomes are admitted.',
      'Future holdout outcomes must occur and become source-available after sealedAt.',
      'Future holdout features must use the exact training-fitted feature normalizer fingerprint.',
      'Training and future holdout leakage groups may not overlap.',
      'The seal is an application-level precommitment; repository/audit retention should preserve when the seal was created.',
    ],
  };
  return { ...payload, sealHash: sha256(stableStringify(payload)) };
}

export function assertFutureHoldoutSealV15(seal: FutureHoldoutSealV15): FutureHoldoutSealV15 {
  if (!seal || typeof seal !== 'object') throw new Error('Future holdout seal must be an object.');
  if (seal.schemaVersion !== FUTURE_HOLDOUT_SEAL_SCHEMA_V15) throw new Error(`Unsupported future holdout seal schema: ${String(seal.schemaVersion)}.`);
  timestamp('seal.sealedAt', seal.sealedAt);
  timestamp('seal.trainingAsOf', seal.trainingAsOf);
  if (seal.clockAttestation !== 'system-clock' && seal.clockAttestation !== 'injected-test-clock') {
    throw new Error(`Unsupported future holdout seal clock attestation: ${String(seal.clockAttestation)}.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(seal.sealHash)) throw new Error('Future holdout seal hash must be a SHA-256 digest.');
  const { sealHash, ...payload } = seal;
  if (sha256(stableStringify(payload)) !== sealHash.toLocaleLowerCase()) {
    throw new Error('Future holdout seal content hash does not match its payload; the precommitment was modified.');
  }
  for (const digest of [seal.trainingHistoricalManifestHash, seal.trainingHistoricalCorpusContentHash, seal.trainingLeakageGroupDigest, seal.featureNormalizerFitFingerprint]) {
    if (!/^[a-f0-9]{64}$/i.test(digest)) throw new Error('Future holdout seal contains malformed content-addressed provenance.');
  }
  return seal;
}

export function assertTrainingRecordsMatchFutureHoldoutSealV15(
  seal: FutureHoldoutSealV15,
  trainingRecords: HistoricalLearningRecordV15[],
): void {
  assertFutureHoldoutSealV15(seal);
  if (!Array.isArray(trainingRecords) || trainingRecords.length !== seal.trainingRecordCount) {
    throw new Error('Training record count no longer matches the future holdout seal.');
  }
  for (const record of trainingRecords) assertHistoricalLearningRecordEligibleV15(record);
  const manifest = buildHistoricalLearningCorpusManifestV15(trainingRecords);
  if (manifest.manifestHash !== seal.trainingHistoricalManifestHash || manifest.corpusContentHash !== seal.trainingHistoricalCorpusContentHash) {
    throw new Error('Training corpus content no longer matches the sealed historical manifest.');
  }
  const ids = trainingRecords.map((record) => record.record.outcomeId).sort();
  if (stableStringify(ids) !== stableStringify(seal.trainingOutcomeIds)) throw new Error('Training outcome identities no longer match the future holdout seal.');
  if (leakageDigest(trainingRecords) !== seal.trainingLeakageGroupDigest) throw new Error('Training leakage-group identity no longer matches the future holdout seal.');
  const contract = featureContract(trainingRecords);
  if (contract.extractor !== seal.featureExtractorContract || contract.normalizer !== seal.featureNormalizerFitFingerprint) {
    throw new Error('Training feature/normalizer contract no longer matches the future holdout seal.');
  }
}
