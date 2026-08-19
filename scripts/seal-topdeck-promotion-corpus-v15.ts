import { readFile, writeFile } from 'node:fs/promises';
import { createFutureHoldoutSealV15 } from '../src/services/future-holdout-seal-v15.js';
import {
  materializeTopDeckPromotionCorpusFromJoinedEvidenceV15,
  type TopDeckPromotionCorpusAdmissionV15,
  type TopDeckPromotionJoinArtifactInputV15,
} from '../src/services/topdeck-promotion-corpus-admission-v15.js';
import type { TopDeckProspectivePromotionJoinV15 } from '../src/services/topdeck-prospective-promotion-join-v15.js';

const CORPUS_PATH = process.env.TOPDECK_PROMOTION_CORPUS_PRIVATE_PATH?.trim() || 'corpus/topdeck-promotion-corpus-private-v15.json';
const INDEX_PATH = process.env.TOPDECK_PROMOTION_JOIN_INDEX_PATH?.trim() || 'joined-evidence-index-v15.json';
const PRIVATE_SEAL_PATH = process.env.TOPDECK_PROMOTION_SEAL_PRIVATE_PATH?.trim() || 'topdeck-promotion-future-holdout-seal-private-v15.json';
const AUDIT_PATH = process.env.TOPDECK_PROMOTION_SEAL_AUDIT_PATH?.trim() || 'topdeck-promotion-future-holdout-seal-audit-v15.json';

interface JoinedEvidenceIndexEntryV15 {
  artifactReference: string;
  path: string;
}

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

function privateCorpus(value: unknown): TopDeckPromotionCorpusAdmissionV15 {
  const wrapper = object('private promotion corpus', value);
  if (wrapper.schemaVersion !== 'topdeck-promotion-corpus-private-v15.1') {
    throw new Error(`Unsupported private promotion corpus schema: ${String(wrapper.schemaVersion)}.`);
  }
  if (!wrapper.admission || typeof wrapper.admission !== 'object' || Array.isArray(wrapper.admission)) {
    throw new Error('Private promotion corpus is missing admission payload.');
  }
  return wrapper.admission as TopDeckPromotionCorpusAdmissionV15;
}

function indexEntries(value: unknown): JoinedEvidenceIndexEntryV15[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Joined evidence index must be a non-empty array.');
  return value.map((raw, index) => {
    const entry = object(`joined evidence index ${index}`, raw);
    return {
      artifactReference: required(`joined evidence index ${index}.artifactReference`, entry.artifactReference),
      path: required(`joined evidence index ${index}.path`, entry.path),
    };
  });
}

function privateJoinedEvidence(value: unknown): TopDeckProspectivePromotionJoinV15 {
  const wrapper = object('private joined evidence', value);
  if (wrapper.schemaVersion !== 'topdeck-prospective-promotion-joined-private-v15.1') {
    throw new Error(`Unsupported private joined evidence schema: ${String(wrapper.schemaVersion)}.`);
  }
  if (!wrapper.join || typeof wrapper.join !== 'object' || Array.isArray(wrapper.join)) {
    throw new Error('Private joined evidence is missing join payload.');
  }
  return wrapper.join as TopDeckProspectivePromotionJoinV15;
}

function requireMatch(name: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`Replayed promotion corpus ${name} does not match the stored private corpus.`);
}

async function main(): Promise<void> {
  const corpusArtifactReference = required('TOPDECK_CORPUS_ARTIFACT_REFERENCE', process.env.TOPDECK_CORPUS_ARTIFACT_REFERENCE);
  const stored = privateCorpus(await jsonFile(CORPUS_PATH));
  const entries = indexEntries(await jsonFile(INDEX_PATH));
  const inputs: TopDeckPromotionJoinArtifactInputV15[] = [];
  for (const entry of entries) {
    inputs.push({
      artifactReference: entry.artifactReference,
      join: privateJoinedEvidence(await jsonFile(entry.path)),
    });
  }

  const replayed = materializeTopDeckPromotionCorpusFromJoinedEvidenceV15(inputs);
  requireMatch('evidenceLineageHash', replayed.evidenceLineageHash, stored.evidenceLineageHash);
  requireMatch('admittedRows', replayed.admittedRows, stored.admittedRows);
  requireMatch('learningManifest.manifestHash', replayed.learningManifest.manifestHash, stored.learningManifest.manifestHash);
  requireMatch('learningManifest.corpusContentHash', replayed.learningManifest.corpusContentHash, stored.learningManifest.corpusContentHash);
  requireMatch('historicalManifest.manifestHash', replayed.historicalManifest.manifestHash, stored.historicalManifest.manifestHash);
  requireMatch('historicalManifest.corpusContentHash', replayed.historicalManifest.corpusContentHash, stored.historicalManifest.corpusContentHash);
  requireMatch('normalizer.fitFingerprint', replayed.normalizer.fitFingerprint, stored.normalizer.fitFingerprint);
  requireMatch('conservativeOutcomeSourceObservedAt', replayed.conservativeOutcomeSourceObservedAt, stored.conservativeOutcomeSourceObservedAt);

  const storedArtifacts = [...stored.joinArtifacts].sort();
  const replayedArtifacts = [...replayed.joinArtifacts].sort();
  if (JSON.stringify(storedArtifacts) !== JSON.stringify(replayedArtifacts)) {
    throw new Error('Replayed promotion corpus immutable join-artifact set does not match the stored private corpus.');
  }

  const trainingAsOf = new Date().toISOString();
  const seal = createFutureHoldoutSealV15(replayed.historicalRecords, trainingAsOf);
  if (seal.clockAttestation !== 'system-clock') {
    throw new Error('Production promotion seal must be system-clock attested.');
  }
  const privateSeal = {
    schemaVersion: 'topdeck-promotion-future-holdout-seal-private-v15.1',
    corpusArtifactReference,
    evidenceLineageHash: replayed.evidenceLineageHash,
    historicalManifestHash: replayed.historicalManifest.manifestHash,
    historicalCorpusContentHash: replayed.historicalManifest.corpusContentHash,
    seal,
  } as const;
  await writeFile(PRIVATE_SEAL_PATH, `${JSON.stringify(privateSeal, null, 2)}\n`, 'utf8');

  const audit = {
    schemaVersion: 'topdeck-promotion-future-holdout-seal-audit-v15.1',
    status: 'future-holdout-precommitment-sealed',
    sealedAt: seal.sealedAt,
    trainingAsOf: seal.trainingAsOf,
    clockAttestation: seal.clockAttestation,
    learningTarget: seal.learningTarget,
    trainingRecordCount: seal.trainingRecordCount,
    trainingPositiveRecords: seal.trainingPositiveRecords,
    trainingNegativeRecords: seal.trainingNegativeRecords,
    trainingHistoricalManifestHash: seal.trainingHistoricalManifestHash,
    trainingHistoricalCorpusContentHash: seal.trainingHistoricalCorpusContentHash,
    featureNormalizerFitFingerprint: seal.featureNormalizerFitFingerprint,
    evidenceLineageHash: replayed.evidenceLineageHash,
    sealHash: seal.sealHash,
    futureEvaluationRequirements: {
      minimumFutureHoldoutRecords: seal.evaluationPlan.minimumFutureHoldoutRecordsForUsefulnessClaim,
      minimumFutureHoldoutMinorityShare: seal.evaluationPlan.minimumFutureHoldoutMinorityShare,
      minimumBalancedAccuracyGainOverTransparent: seal.evaluationPlan.minimumBalancedAccuracyGainOverTransparent,
      minimumAuRocGainOverTransparent: seal.evaluationPlan.minimumAuRocGainOverTransparent,
      maximumLogLossRegressionVsTransparent: seal.evaluationPlan.maximumLogLossRegressionVsTransparent,
    },
    releaseAuthorization: {
      modelPromotionAuthorized: false,
      stableRuntimePromotionAuthorized: false,
      purpose: 'future-holdout-precommitment-only',
    },
    privacy: {
      corpusArtifactReferencePersistedInAudit: false,
      joinedArtifactReferencesPersistedInAudit: false,
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
  console.error(`[TopDeck promotion corpus seal] ${message}`);
  process.exitCode = 1;
});