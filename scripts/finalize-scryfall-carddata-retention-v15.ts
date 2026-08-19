import { readFile, writeFile } from 'node:fs/promises';
import type { DiscoveredScryfallForwardCardDataCaptureV15 } from '../src/services/scryfall-bulk-carddata-source-v15.js';
import {
  assertRetainedScryfallCardDataBytesV15,
  createRetainedScryfallCardDataSnapshotManifestV15,
} from '../src/services/retained-scryfall-carddata-snapshot-v15.js';

const RAW_PATH = process.env.SCRYFALL_RETENTION_RAW_PATH?.trim() || 'scryfall-default-cards-retained.jsonl.gz';
const EVIDENCE_PATH = process.env.SCRYFALL_RETENTION_EVIDENCE_PATH?.trim() || 'scryfall-retention-candidate-v15.json';
const MANIFEST_PATH = process.env.SCRYFALL_RETENTION_MANIFEST_PATH?.trim() || 'scryfall-retained-snapshot-manifest-v15.json';

function record(name: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

async function main(): Promise<void> {
  const artifactReference = required('RAW_ARTIFACT_REFERENCE', process.env.RAW_ARTIFACT_REFERENCE);
  const evidenceJson = await readFile(EVIDENCE_PATH, 'utf8');
  const evidence = record('retention evidence', JSON.parse(evidenceJson) as unknown);
  if (evidence.schemaVersion !== 'scryfall-retention-candidate-v15.1') {
    throw new Error('Unsupported Scryfall retention candidate schema.');
  }
  const discovery = record('retention evidence discovery', evidence.discovery);
  const capture = record('retention evidence capture', evidence.capture);
  const acquisition = record('retention evidence acquisition', capture.acquisition);
  const integrity = record('retention evidence integrity', acquisition.integrity);
  const sourceHash = required('retention evidence source hash', integrity.actualHash).toLocaleLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sourceHash)) throw new Error('Retention evidence source hash must be SHA-256 hex.');

  const rawBytes = new Uint8Array(await readFile(RAW_PATH));
  const reconstructed = {
    discovery,
    capture: {
      schemaVersion: capture.schemaVersion,
      sourcePolicy: capture.sourcePolicy,
      acquisition: {
        ...acquisition,
        bytes: rawBytes,
        cards: [],
      },
      safeguards: [],
    },
  } as unknown as DiscoveredScryfallForwardCardDataCaptureV15;

  const manifest = createRetainedScryfallCardDataSnapshotManifestV15(reconstructed, {
    artifactReference,
    sourceLayerDigest: `sha256:${sourceHash}`,
  });
  assertRetainedScryfallCardDataBytesV15(manifest, rawBytes);
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    manifestFingerprint: manifest.manifestFingerprint,
    sourceId: manifest.sourceId,
    observedAt: manifest.observedAt,
    sourceContentHash: manifest.sourceContentHash,
    sourceCompressedBytes: manifest.sourceCompressedBytes,
    artifactReference: manifest.storage.artifactReference,
    historicalArchiveVerified: manifest.historicalArchiveVerified,
    manifestPath: MANIFEST_PATH,
  }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[Scryfall retention finalize] ${message}`);
  process.exitCode = 1;
});
