import { readFile, writeFile } from 'node:fs/promises';
import {
  assertEvaluationCodeIdentityMatchesSealV15,
  type FutureHoldoutSealV15,
} from '../src/services/future-holdout-seal-v15.js';
import { buildHistoricalLearningCorpusManifestV15 } from '../src/services/historical-learning-corpus-v15.js';
import { evaluatePromotionAwareSealedFutureHoldoutV15 } from '../src/services/promotion-aware-future-model-eval-v15.js';
import { currentPromotionRuntimeIdentityV15 } from '../src/services/promotion-runtime-identity-v15.js';
import type { TopDeckPromotionCorpusAdmissionV15 } from '../src/services/topdeck-promotion-corpus-admission-v15.js';
import type { TopDeckSealedFutureHoldoutV15 } from '../src/services/topdeck-sealed-future-holdout-v15.js';

const SEAL_PATH = process.env.TOPDECK_PROMOTION_SEAL_PRIVATE_PATH?.trim() || 'seal/topdeck-promotion-future-holdout-seal-private-v15.json';
const CORPUS_PATH = process.env.TOPDECK_PROMOTION_CORPUS_PRIVATE_PATH?.trim() || 'corpus/topdeck-promotion-corpus-private-v15.json';
const HOLDOUT_PATH = process.env.TOPDECK_FUTURE_HOLDOUT_PRIVATE_PATH?.trim() || 'future-holdout/topdeck-sealed-future-holdout-private-v15.json';
const PRIVATE_EVAL_PATH = process.env.TOPDECK_PROMOTION_EVAL_PRIVATE_PATH?.trim() || 'topdeck-promotion-future-evaluation-private-v15.json';
const AUDIT_PATH = process.env.TOPDECK_PROMOTION_EVAL_AUDIT_PATH?.trim() || 'topdeck-promotion-future-evaluation-audit-v15.json';

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function object(name: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

async function jsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function privateSeal(value: unknown): { corpusArtifactReference: string; seal: FutureHoldoutSealV15 } {
  const wrapper = object('private future holdout seal', value);
  if (wrapper.schemaVersion !== 'topdeck-promotion-future-holdout-seal-private-v15.2') {
    throw new Error(`Unsupported private future holdout seal schema: ${String(wrapper.schemaVersion)}.`);
  }
  return {
    corpusArtifactReference: required('seal.corpusArtifactReference', wrapper.corpusArtifactReference),
    seal: wrapper.seal as FutureHoldoutSealV15,
  };
}

function privateCorpus(value: unknown): TopDeckPromotionCorpusAdmissionV15 {
  const wrapper = object('private promotion corpus', value);
  if (wrapper.schemaVersion !== 'topdeck-promotion-corpus-private-v15.1') {
    throw new Error(`Unsupported private promotion corpus schema: ${String(wrapper.schemaVersion)}.`);
  }
  return wrapper.admission as TopDeckPromotionCorpusAdmissionV15;
}

function privateHoldout(value: unknown): {
  sealArtifactReference: string;
  corpusArtifactReference: string;
  holdout: TopDeckSealedFutureHoldoutV15;
} {
  const wrapper = object('private sealed future holdout', value);
  if (wrapper.schemaVersion !== 'topdeck-sealed-future-holdout-private-v15.2') {
    throw new Error(`Unsupported private sealed future holdout schema: ${String(wrapper.schemaVersion)}.`);
  }
  return {
    sealArtifactReference: required('holdout.sealArtifactReference', wrapper.sealArtifactReference),
    corpusArtifactReference: required('holdout.corpusArtifactReference', wrapper.corpusArtifactReference),
    holdout: wrapper.holdout as TopDeckSealedFutureHoldoutV15,
  };
}

function requireMatch(name: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`${name} does not match the immutable sealed evidence chain.`);
}

async function main(): Promise<void> {
  const sealArtifactReference = required('TOPDECK_SEAL_ARTIFACT_REFERENCE', process.env.TOPDECK_SEAL_ARTIFACT_REFERENCE);
  const futureHoldoutArtifactReference = required('TOPDECK_FUTURE_HOLDOUT_ARTIFACT_REFERENCE', process.env.TOPDECK_FUTURE_HOLDOUT_ARTIFACT_REFERENCE);
  const storedSeal = privateSeal(await jsonFile(SEAL_PATH));
  assertEvaluationCodeIdentityMatchesSealV15(storedSeal.seal, await currentPromotionRuntimeIdentityV15());
  const trainingCorpus = privateCorpus(await jsonFile(CORPUS_PATH));
  const future = privateHoldout(await jsonFile(HOLDOUT_PATH));

  requireMatch('Future holdout seal artifact reference', future.sealArtifactReference.toLocaleLowerCase(), sealArtifactReference.toLocaleLowerCase());
  requireMatch('Future holdout corpus artifact reference', future.corpusArtifactReference.toLocaleLowerCase(), storedSeal.corpusArtifactReference.toLocaleLowerCase());
  requireMatch('Future holdout seal hash', future.holdout.sealHash, storedSeal.seal.sealHash);
  requireMatch('Training historical manifest hash', trainingCorpus.historicalManifest.manifestHash, storedSeal.seal.trainingHistoricalManifestHash);
  requireMatch('Training historical corpus content hash', trainingCorpus.historicalManifest.corpusContentHash, storedSeal.seal.trainingHistoricalCorpusContentHash);
  requireMatch('Training normalizer fingerprint', trainingCorpus.normalizer.fitFingerprint, storedSeal.seal.featureNormalizerFitFingerprint);

  const replayedFutureManifest = buildHistoricalLearningCorpusManifestV15(future.holdout.historicalRecords);
  requireMatch('Future historical manifest hash', replayedFutureManifest.manifestHash, future.holdout.historicalManifest.manifestHash);
  requireMatch('Future historical corpus content hash', replayedFutureManifest.corpusContentHash, future.holdout.historicalManifest.corpusContentHash);
  for (const record of future.holdout.historicalRecords) {
    requireMatch('Future record seal hash', record.record.metadata?.futureHoldoutSealHash, storedSeal.seal.sealHash);
    requireMatch('Future record sealed training manifest hash', record.record.metadata?.sealedTrainingManifestHash, storedSeal.seal.trainingHistoricalManifestHash);
    requireMatch('Future record sealed training corpus hash', record.record.metadata?.sealedTrainingCorpusContentHash, storedSeal.seal.trainingHistoricalCorpusContentHash);
    requireMatch('Future record sealed normalizer fingerprint', record.record.metadata?.sealedTrainingNormalizerFitFingerprint, storedSeal.seal.featureNormalizerFitFingerprint);
  }

  const result = evaluatePromotionAwareSealedFutureHoldoutV15(
    storedSeal.seal,
    trainingCorpus.historicalRecords,
    future.holdout.historicalRecords,
  );
  const privateEvaluation = {
    schemaVersion: 'topdeck-promotion-future-evaluation-private-v15.2',
    evaluatedAt: result.evaluation.evaluatedAt,
    sealArtifactReference,
    corpusArtifactReference: storedSeal.corpusArtifactReference,
    futureHoldoutArtifactReference,
    trainingHistoricalManifestHash: trainingCorpus.historicalManifest.manifestHash,
    futureHistoricalManifestHash: replayedFutureManifest.manifestHash,
    result,
  } as const;
  await writeFile(PRIVATE_EVAL_PATH, `${JSON.stringify(privateEvaluation, null, 2)}\n`, 'utf8');

  const evaluation = result.evaluation;
  const audit = {
    schemaVersion: 'topdeck-promotion-future-evaluation-audit-v15.2',
    status: result.promotionReadiness.evidenceStatus,
    evaluatedAt: evaluation.evaluatedAt,
    sealHash: evaluation.sealHash,
    learningTarget: evaluation.learningTarget,
    claimScope: storedSeal.seal.evaluationPlan.claimScope,
    promotionFeatures: storedSeal.seal.evaluationPlan.promotionFeatures,
    evaluationCodeIdentity: storedSeal.seal.evaluationCodeIdentity,
    trainingRecords: evaluation.trainingRecords,
    futureHoldoutRecords: evaluation.futureHoldoutRecords,
    usefulness: evaluation.usefulness,
    usefulnessReasons: evaluation.usefulnessReasons,
    neuralMetrics: {
      accuracy: evaluation.neuralMetrics.accuracy,
      balancedAccuracy: evaluation.neuralMetrics.balancedAccuracy,
      logLoss: evaluation.neuralMetrics.logLoss,
      brierScore: evaluation.neuralMetrics.brierScore,
      auroc: evaluation.neuralMetrics.auroc,
      expectedCalibrationError: evaluation.neuralMetrics.expectedCalibrationError,
    },
    transparentMetrics: {
      accuracy: evaluation.transparentMetrics.accuracy,
      balancedAccuracy: evaluation.transparentMetrics.balancedAccuracy,
      logLoss: evaluation.transparentMetrics.logLoss,
      brierScore: evaluation.transparentMetrics.brierScore,
      auroc: evaluation.transparentMetrics.auroc,
      expectedCalibrationError: evaluation.transparentMetrics.expectedCalibrationError,
    },
    prevalenceMetrics: {
      balancedAccuracy: evaluation.prevalenceMetrics.balancedAccuracy,
      logLoss: evaluation.prevalenceMetrics.logLoss,
    },
    neuralImprovement: evaluation.neuralImprovement,
    futureQualityGatePassed: evaluation.futureHoldoutQuality.qualityGatePassed,
    futureQualityWarnings: evaluation.futureHoldoutQuality.warnings,
    promotionReadiness: result.promotionReadiness,
    releaseAuthorization: {
      legacyEvaluationPromotionAuthorized: evaluation.promotionAuthorized,
      automaticStablePromotionAllowed: result.promotionReadiness.automaticStablePromotionAllowed,
      stablePromotionAuthorized: result.promotionReadiness.stablePromotionAuthorized,
      requiresExplicitUserApproval: result.promotionReadiness.requiresExplicitUserApproval,
    },
    privacy: {
      sealArtifactReferencePersistedInAudit: false,
      corpusArtifactReferencePersistedInAudit: false,
      futureHoldoutArtifactReferencePersistedInAudit: false,
      subgroupCommanderKeysPersistedInAudit: false,
      providerOutcomeIdsPersistedInAudit: false,
      playerIdentifiersPersistedInAudit: false,
      decklistsPersistedInAudit: false,
      cardNamesPersistedInAudit: false,
    },
  } as const;
  await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(audit, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[TopDeck promotion future evaluation] ${message}`);
  process.exitCode = 1;
});
