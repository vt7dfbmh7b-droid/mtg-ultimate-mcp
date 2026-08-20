import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import {
  materializeTopDeckPromotionCorpusFromJoinedEvidenceV15,
  type TopDeckPromotionJoinArtifactInputV15,
} from '../src/services/topdeck-promotion-corpus-admission-v15.js';
import type { TopDeckProspectivePromotionJoinV15 } from '../src/services/topdeck-prospective-promotion-join-v15.js';

const INDEX_PATH = process.env.TOPDECK_PROMOTION_JOIN_INDEX_PATH?.trim() || 'joined-evidence-index-v15.json';
const PRIVATE_CORPUS_PATH = process.env.TOPDECK_PROMOTION_CORPUS_PRIVATE_PATH?.trim() || 'topdeck-promotion-corpus-private-v15.json';
const AUDIT_PATH = process.env.TOPDECK_PROMOTION_CORPUS_AUDIT_PATH?.trim() || 'topdeck-promotion-corpus-audit-v15.json';

interface JoinedEvidenceIndexEntryV15 {
  artifactReference: string;
  path: string;
}

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function asObject(name: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function jsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function parseIndex(value: unknown): JoinedEvidenceIndexEntryV15[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Joined evidence index must contain at least one entry.');
  if (value.length > 5_000) throw new Error('Joined evidence index exceeds the 5,000-artifact safety limit.');
  const paths = new Set<string>();
  return value.map((raw, index) => {
    const entry = asObject(`joined evidence index ${index}`, raw);
    const artifactReference = required(`joined evidence index ${index}.artifactReference`, entry.artifactReference);
    const path = required(`joined evidence index ${index}.path`, entry.path);
    if (paths.has(path)) throw new Error(`Joined evidence index reuses local path ${path}.`);
    paths.add(path);
    return { artifactReference, path };
  });
}

function privateJoinedEvidence(value: unknown): TopDeckProspectivePromotionJoinV15 {
  const wrapper = asObject('private joined evidence', value);
  if (wrapper.schemaVersion !== 'topdeck-prospective-promotion-joined-private-v15.1') {
    throw new Error(`Unsupported private joined evidence schema: ${String(wrapper.schemaVersion)}.`);
  }
  const join = wrapper.join;
  if (!join || typeof join !== 'object' || Array.isArray(join)) throw new Error('Private joined evidence is missing join payload.');
  return join as TopDeckProspectivePromotionJoinV15;
}

async function main(): Promise<void> {
  const index = parseIndex(await jsonFile(INDEX_PATH));
  const inputs: TopDeckPromotionJoinArtifactInputV15[] = [];
  for (const entry of index) {
    inputs.push({
      artifactReference: entry.artifactReference,
      join: privateJoinedEvidence(await jsonFile(entry.path)),
    });
  }

  const admission = materializeTopDeckPromotionCorpusFromJoinedEvidenceV15(inputs);
  const privateCorpus = {
    schemaVersion: 'topdeck-promotion-corpus-private-v15.1',
    builtAt: new Date().toISOString(),
    admission,
  } as const;
  const privateText = `${JSON.stringify(privateCorpus, null, 2)}\n`;
  await writeFile(PRIVATE_CORPUS_PATH, privateText, 'utf8');

  const audit = {
    schemaVersion: 'topdeck-promotion-corpus-audit-v15.1',
    status: 'strict-promotion-corpus-built',
    builtAt: privateCorpus.builtAt,
    joinArtifactCount: admission.joinArtifactCount,
    joinedRows: admission.joinedRows,
    admittedRows: admission.admittedRows,
    trainingRows: admission.partition.trainingIds.length,
    temporalHoldoutRows: admission.partition.holdoutIds.length,
    evidenceLineageHash: admission.evidenceLineageHash,
    learningManifestHash: admission.learningManifest.manifestHash,
    historicalManifestHash: admission.historicalManifest.manifestHash,
    historicalCorpusContentHash: admission.historicalManifest.corpusContentHash,
    featureNormalizerFitFingerprint: admission.normalizer.fitFingerprint,
    conservativeOutcomeSourceObservedAt: admission.conservativeOutcomeSourceObservedAt,
    privateCorpusContentHash: sha256(privateText),
    releaseAuthorization: {
      modelPromotionAuthorized: false,
      stableRuntimePromotionAuthorized: false,
      purpose: 'strict-corpus-construction-only',
    },
    privacy: {
      joinedArtifactReferencesPersistedInAudit: false,
      providerEventIdsPersistedInAudit: false,
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
  console.error(`[TopDeck promotion corpus build] ${message}`);
  process.exitCode = 1;
});