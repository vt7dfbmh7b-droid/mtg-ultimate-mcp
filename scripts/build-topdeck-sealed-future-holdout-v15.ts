import { readFile, writeFile } from 'node:fs/promises';
import type { FutureHoldoutSealV15 } from '../src/services/future-holdout-seal-v15.js';
import type { TopDeckPromotionCorpusAdmissionV15, TopDeckPromotionJoinArtifactInputV15 } from '../src/services/topdeck-promotion-corpus-admission-v15.js';
import type { TopDeckProspectivePromotionJoinV15 } from '../src/services/topdeck-prospective-promotion-join-v15.js';
import { materializeTopDeckSealedFutureHoldoutV15 } from '../src/services/topdeck-sealed-future-holdout-v15.js';

const SEAL_PATH = process.env.TOPDECK_PROMOTION_SEAL_PRIVATE_PATH?.trim() || 'seal/topdeck-promotion-future-holdout-seal-private-v15.json';
const CORPUS_PATH = process.env.TOPDECK_PROMOTION_CORPUS_PRIVATE_PATH?.trim() || 'corpus/topdeck-promotion-corpus-private-v15.json';
const INDEX_PATH = process.env.TOPDECK_FUTURE_JOIN_INDEX_PATH?.trim() || 'future-joined-evidence-index-v15.json';
const PRIVATE_HOLDOUT_PATH = process.env.TOPDECK_FUTURE_HOLDOUT_PRIVATE_PATH?.trim() || 'topdeck-sealed-future-holdout-private-v15.json';
const AUDIT_PATH = process.env.TOPDECK_FUTURE_HOLDOUT_AUDIT_PATH?.trim() || 'topdeck-sealed-future-holdout-audit-v15.json';

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

function privateSeal(value: unknown): { corpusArtifactReference: string; seal: FutureHoldoutSealV15 } {
  const wrapper = object('private future holdout seal', value);
  if (wrapper.schemaVersion !== 'topdeck-promotion-future-holdout-seal-private-v15.1') {
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

function indexEntries(value: unknown): JoinedEvidenceIndexEntryV15[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Future joined evidence index must be a non-empty array.');
  if (value.length > 5_000) throw new Error('Future joined evidence index exceeds the 5,000-artifact safety limit.');
  return value.map((raw, index) => {
    const entry = object(`future joined evidence index ${index}`, raw);
    return {
      artifactReference: required(`future joined evidence index ${index}.artifactReference`, entry.artifactReference),
      path: required(`future joined evidence index ${index}.path`, entry.path),
    };
  });
}

function privateJoinedEvidence(value: unknown): TopDeckProspectivePromotionJoinV15 {
  const wrapper = object('private joined evidence', value);
  if (wrapper.schemaVersion !== 'topdeck-prospective-promotion-joined-private-v15.1') {
    throw new Error(`Unsupported private joined evidence schema: ${String(wrapper.schemaVersion)}.`);
  }
  return wrapper.join as TopDeckProspectivePromotionJoinV15;
}

async function main(): Promise<void> {
  const sealArtifactReference = required('TOPDECK_SEAL_ARTIFACT_REFERENCE', process.env.TOPDECK_SEAL_ARTIFACT_REFERENCE);
  const corpusArtifactReference = required('TOPDECK_CORPUS_ARTIFACT_REFERENCE', process.env.TOPDECK_CORPUS_ARTIFACT_REFERENCE);
  const storedSeal = privateSeal(await jsonFile(SEAL_PATH));
  if (storedSeal.corpusArtifactReference.toLocaleLowerCase() !== corpusArtifactReference.toLocaleLowerCase()) {
    throw new Error('Future holdout seal is bound to a different immutable training corpus artifact.');
  }
  const trainingCorpus = privateCorpus(await jsonFile(CORPUS_PATH));
  const entries = indexEntries(await jsonFile(INDEX_PATH));
  const futureJoinedEvidence: TopDeckPromotionJoinArtifactInputV15[] = [];
  for (const entry of entries) {
    futureJoinedEvidence.push({
      artifactReference: entry.artifactReference,
      join: privateJoinedEvidence(await jsonFile(entry.path)),
    });
  }

  const holdout = materializeTopDeckSealedFutureHoldoutV15({
    seal: storedSeal.seal,
    trainingRecords: trainingCorpus.historicalRecords,
    trainingNormalizer: trainingCorpus.normalizer,
    futureJoinedEvidence,
  });
  const privateHoldout = {
    schemaVersion: 'topdeck-sealed-future-holdout-private-v15.1',
    builtAt: new Date().toISOString(),
    sealArtifactReference,
    corpusArtifactReference,
    holdout,
  } as const;
  await writeFile(PRIVATE_HOLDOUT_PATH, `${JSON.stringify(privateHoldout, null, 2)}\n`, 'utf8');

  const positiveRecords = holdout.historicalRecords.filter((record) => record.record.label === 1).length;
  const negativeRecords = holdout.historicalRecords.length - positiveRecords;
  const minorityShare = holdout.historicalRecords.length > 0
    ? Math.min(positiveRecords, negativeRecords) / holdout.historicalRecords.length
    : 0;
  const audit = {
    schemaVersion: 'topdeck-sealed-future-holdout-audit-v15.1',
    status: 'sealed-future-holdout-built',
    builtAt: privateHoldout.builtAt,
    sealHash: holdout.sealHash,
    sealedAt: holdout.sealedAt,
    evidenceArtifactCount: holdout.evidenceArtifactCount,
    futureRecords: holdout.historicalRecords.length,
    positiveRecords,
    negativeRecords,
    minorityShare,
    historicalManifestHash: holdout.historicalManifest.manifestHash,
    historicalCorpusContentHash: holdout.historicalManifest.corpusContentHash,
    conservativeOutcomeSourceObservedAt: holdout.conservativeOutcomeSourceObservedAt,
    sealedNormalizerFitFingerprint: storedSeal.seal.featureNormalizerFitFingerprint,
    evaluationThresholds: {
      minimumFutureHoldoutRecords: storedSeal.seal.evaluationPlan.minimumFutureHoldoutRecordsForUsefulnessClaim,
      minimumFutureHoldoutMinorityShare: storedSeal.seal.evaluationPlan.minimumFutureHoldoutMinorityShare,
    },
    releaseAuthorization: {
      modelPromotionAuthorized: false,
      stableRuntimePromotionAuthorized: false,
      purpose: 'sealed-future-holdout-collection-only',
    },
    privacy: {
      sealArtifactReferencePersistedInAudit: false,
      corpusArtifactReferencePersistedInAudit: false,
      futureJoinedArtifactReferencesPersistedInAudit: false,
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
  console.error(`[TopDeck sealed future holdout build] ${message}`);
  process.exitCode = 1;
});