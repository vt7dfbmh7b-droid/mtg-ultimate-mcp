import { createHash } from 'node:crypto';
import type { HistoricalCardDataProvenanceV15 } from './historical-carddata-provenance-v15.js';
import type { DiscoveredScryfallForwardCardDataCaptureV15 } from './scryfall-bulk-carddata-source-v15.js';
import {
  SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15,
  SCRYFALL_JSONL_GZIP_FORMAT_V15,
} from './scryfall-forward-carddata-capture-v15.js';

export const RETAINED_SCRYFALL_CARD_DATA_SNAPSHOT_SCHEMA_V15 = 'retained-scryfall-carddata-snapshot-v15.1' as const;
export const RETAINED_SCRYFALL_CARD_DATA_MEDIA_TYPE_V15 = 'application/vnd.mtg-ultimate.scryfall-default-cards.v1+gzip' as const;

type ContemporaneousProvenanceV15 = Extract<HistoricalCardDataProvenanceV15, { method: 'contemporaneous-capture' }>;

export interface RetainedScryfallCardDataStorageEvidenceV15 {
  /** Immutable OCI manifest reference, never a mutable tag. */
  artifactReference: string;
  /** Digest of the exact retained .jsonl.gz layer bytes. */
  sourceLayerDigest: string;
}

export interface RetainedScryfallCardDataSnapshotManifestV15 {
  schemaVersion: typeof RETAINED_SCRYFALL_CARD_DATA_SNAPSHOT_SCHEMA_V15;
  sourceId: typeof SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15;
  format: typeof SCRYFALL_JSONL_GZIP_FORMAT_V15;
  temporalMode: 'contemporaneous-capture';
  historicalArchiveVerified: false;
  manifestUri: string;
  providerObjectId: string;
  providerMetadataUri: string;
  providerUpdatedAt: string;
  discoveredAt: string;
  sourceUri: string;
  sourceContentHash: string;
  sourceCompressedBytes: number;
  decodedContentHash: string;
  observedAt: string;
  retrievedAt: string;
  storage: {
    kind: 'oci-registry';
    registry: 'ghcr.io';
    artifactReference: string;
    sourceLayerDigest: string;
    mediaType: typeof RETAINED_SCRYFALL_CARD_DATA_MEDIA_TYPE_V15;
  };
  /** SHA-256 of the canonical manifest payload excluding this fingerprint field. */
  manifestFingerprint: string;
}

export type RetainedScryfallCardDataResolutionV15 =
  | {
      status: 'available';
      cutoff: string;
      selected: RetainedScryfallCardDataSnapshotManifestV15;
      eligibleCaptures: number;
      totalCaptures: number;
    }
  | {
      status: 'unavailable';
      cutoff: string;
      reason: string;
      totalCaptures: number;
      earliestObservedAt: string | null;
      latestObservedAt: string | null;
    };

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function timestamp(name: string, value: unknown): string {
  const text = required(name, value);
  const milliseconds = Date.parse(text);
  if (!Number.isFinite(milliseconds)) throw new Error(`${name} must be a valid timestamp.`);
  return new Date(milliseconds).toISOString();
}

function sha256Hex(name: string, value: unknown): string {
  const text = required(name, value).toLocaleLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${name} must be a SHA-256 hex digest.`);
  return text;
}

function sha256Digest(name: string, value: unknown): string {
  const text = required(name, value).toLocaleLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(text)) throw new Error(`${name} must be a sha256:<hex> digest.`);
  return text;
}

function positiveSafeInteger(name: string, value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`${name} must be a positive safe integer.`);
  return value as number;
}

function absoluteHttpsUrl(name: string, value: unknown): string {
  const text = required(name, value);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${name} must be an absolute HTTPS URL.`);
  return parsed.toString();
}

function immutableGhcrReference(value: unknown): string {
  const text = required('artifactReference', value).toLocaleLowerCase();
  if (!/^ghcr\.io\/[a-z0-9._-]+(?:\/[a-z0-9._-]+)+@sha256:[a-f0-9]{64}$/.test(text)) {
    throw new Error('artifactReference must be an immutable ghcr.io repository reference pinned by sha256 digest.');
  }
  return text;
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function manifestPayload(manifest: Omit<RetainedScryfallCardDataSnapshotManifestV15, 'manifestFingerprint'>): string {
  return JSON.stringify(manifest);
}

function manifestFingerprint(manifest: Omit<RetainedScryfallCardDataSnapshotManifestV15, 'manifestFingerprint'>): string {
  return createHash('sha256').update(manifestPayload(manifest), 'utf8').digest('hex');
}

function withoutFingerprint(
  manifest: RetainedScryfallCardDataSnapshotManifestV15,
): Omit<RetainedScryfallCardDataSnapshotManifestV15, 'manifestFingerprint'> {
  const { manifestFingerprint: _fingerprint, ...payload } = manifest;
  return payload;
}

function assertLinkedDiscoveryAndCapture(input: DiscoveredScryfallForwardCardDataCaptureV15): void {
  const { discovery, capture } = input;
  const provenance = capture.acquisition.provenance;
  if (discovery.sourceId !== SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15 || provenance.sourceId !== SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15) {
    throw new Error('Retained snapshot requires the Scryfall default-cards source.');
  }
  if (capture.acquisition.format !== SCRYFALL_JSONL_GZIP_FORMAT_V15) {
    throw new Error('Retained snapshot requires the Scryfall gzip JSON Lines format.');
  }
  if (discovery.downloadUri !== provenance.sourceUri) {
    throw new Error('Scryfall discovery download URI does not match the captured source URI.');
  }
  if (discovery.providerCompressedSizeBytes !== capture.acquisition.byteLength) {
    throw new Error('Scryfall provider compressed size does not match the captured byte length.');
  }
  if (capture.acquisition.integrity.actualHash !== provenance.sourceContentHash) {
    throw new Error('Scryfall capture integrity hash does not match provenance.');
  }
  if (!capture.acquisition.integrity.exactCompressedByteLengthMatch) {
    throw new Error('Scryfall capture did not match the provider compressed byte length.');
  }
  if (timestamp('discovery.discoveredAt', discovery.discoveredAt) !== timestamp('capture.observedAt', provenance.observedAt)) {
    throw new Error('Scryfall discovery and capture must share one contemporaneous observation timestamp.');
  }
}

export function createRetainedScryfallCardDataSnapshotManifestV15(
  input: DiscoveredScryfallForwardCardDataCaptureV15,
  storageEvidence: RetainedScryfallCardDataStorageEvidenceV15,
): RetainedScryfallCardDataSnapshotManifestV15 {
  assertLinkedDiscoveryAndCapture(input);
  const { discovery, capture } = input;
  const provenance = capture.acquisition.provenance;
  const sourceContentHash = sha256Hex('sourceContentHash', provenance.sourceContentHash);
  const sourceLayerDigest = sha256Digest('sourceLayerDigest', storageEvidence.sourceLayerDigest);
  if (sourceLayerDigest !== `sha256:${sourceContentHash}`) {
    throw new Error('Retained OCI source layer digest must equal the SHA-256 of the exact captured .jsonl.gz bytes.');
  }

  const payload: Omit<RetainedScryfallCardDataSnapshotManifestV15, 'manifestFingerprint'> = {
    schemaVersion: RETAINED_SCRYFALL_CARD_DATA_SNAPSHOT_SCHEMA_V15,
    sourceId: SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15,
    format: SCRYFALL_JSONL_GZIP_FORMAT_V15,
    temporalMode: 'contemporaneous-capture',
    historicalArchiveVerified: false,
    manifestUri: absoluteHttpsUrl('manifestUri', discovery.manifestUri),
    providerObjectId: required('providerObjectId', discovery.providerObjectId),
    providerMetadataUri: absoluteHttpsUrl('providerMetadataUri', discovery.providerMetadataUri),
    providerUpdatedAt: timestamp('providerUpdatedAt', discovery.providerUpdatedAt),
    discoveredAt: timestamp('discoveredAt', discovery.discoveredAt),
    sourceUri: absoluteHttpsUrl('sourceUri', provenance.sourceUri),
    sourceContentHash,
    sourceCompressedBytes: positiveSafeInteger('sourceCompressedBytes', capture.acquisition.byteLength),
    decodedContentHash: sha256Hex('decodedContentHash', capture.acquisition.integrity.decodedContentHash),
    observedAt: timestamp('observedAt', provenance.observedAt),
    retrievedAt: timestamp('retrievedAt', provenance.retrievedAt),
    storage: {
      kind: 'oci-registry',
      registry: 'ghcr.io',
      artifactReference: immutableGhcrReference(storageEvidence.artifactReference),
      sourceLayerDigest,
      mediaType: RETAINED_SCRYFALL_CARD_DATA_MEDIA_TYPE_V15,
    },
  };

  return { ...payload, manifestFingerprint: manifestFingerprint(payload) };
}

export function assertRetainedScryfallCardDataSnapshotManifestV15(
  manifest: RetainedScryfallCardDataSnapshotManifestV15,
): void {
  if (manifest.schemaVersion !== RETAINED_SCRYFALL_CARD_DATA_SNAPSHOT_SCHEMA_V15) throw new Error('Unsupported retained Scryfall snapshot schema.');
  if (manifest.sourceId !== SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15) throw new Error('Retained snapshot sourceId must be scryfall-default-cards.');
  if (manifest.format !== SCRYFALL_JSONL_GZIP_FORMAT_V15) throw new Error('Retained snapshot format must be Scryfall gzip JSON Lines.');
  if (manifest.temporalMode !== 'contemporaneous-capture') throw new Error('Retained snapshot must remain a contemporaneous capture.');
  if (manifest.historicalArchiveVerified !== false) throw new Error('Forward-retained Scryfall data cannot claim retrospective archive verification.');

  absoluteHttpsUrl('manifestUri', manifest.manifestUri);
  required('providerObjectId', manifest.providerObjectId);
  absoluteHttpsUrl('providerMetadataUri', manifest.providerMetadataUri);
  timestamp('providerUpdatedAt', manifest.providerUpdatedAt);
  timestamp('discoveredAt', manifest.discoveredAt);
  absoluteHttpsUrl('sourceUri', manifest.sourceUri);
  const sourceContentHash = sha256Hex('sourceContentHash', manifest.sourceContentHash);
  positiveSafeInteger('sourceCompressedBytes', manifest.sourceCompressedBytes);
  sha256Hex('decodedContentHash', manifest.decodedContentHash);
  timestamp('observedAt', manifest.observedAt);
  timestamp('retrievedAt', manifest.retrievedAt);
  if (timestamp('discoveredAt', manifest.discoveredAt) !== timestamp('observedAt', manifest.observedAt)) {
    throw new Error('Retained snapshot discovery and observation timestamps must match.');
  }
  if (timestamp('retrievedAt', manifest.retrievedAt) !== timestamp('observedAt', manifest.observedAt)) {
    throw new Error('Retained snapshot retrieval and observation timestamps must match for this capture contract.');
  }

  if (manifest.storage.kind !== 'oci-registry' || manifest.storage.registry !== 'ghcr.io') {
    throw new Error('Retained snapshot storage must use ghcr.io OCI storage.');
  }
  immutableGhcrReference(manifest.storage.artifactReference);
  const sourceLayerDigest = sha256Digest('sourceLayerDigest', manifest.storage.sourceLayerDigest);
  if (sourceLayerDigest !== `sha256:${sourceContentHash}`) {
    throw new Error('Retained OCI source layer digest does not match sourceContentHash.');
  }
  if (manifest.storage.mediaType !== RETAINED_SCRYFALL_CARD_DATA_MEDIA_TYPE_V15) {
    throw new Error('Retained snapshot storage media type is not recognized.');
  }

  const expectedFingerprint = manifestFingerprint(withoutFingerprint(manifest));
  if (sha256Hex('manifestFingerprint', manifest.manifestFingerprint) !== expectedFingerprint) {
    throw new Error('Retained snapshot manifest fingerprint does not match its canonical payload.');
  }
}

export function assertRetainedScryfallCardDataBytesV15(
  manifest: RetainedScryfallCardDataSnapshotManifestV15,
  bytes: Uint8Array,
): void {
  assertRetainedScryfallCardDataSnapshotManifestV15(manifest);
  if (!(bytes instanceof Uint8Array)) throw new Error('Retained snapshot bytes must be a Uint8Array.');
  if (bytes.byteLength !== manifest.sourceCompressedBytes) {
    throw new Error(`Retained snapshot byte length ${bytes.byteLength} does not match manifest ${manifest.sourceCompressedBytes}.`);
  }
  const actualHash = hashBytes(bytes);
  if (actualHash !== manifest.sourceContentHash) {
    throw new Error('Retained snapshot bytes do not match the manifest sourceContentHash.');
  }
}

export function contemporaneousProvenanceFromRetainedScryfallSnapshotV15(
  manifest: RetainedScryfallCardDataSnapshotManifestV15,
): ContemporaneousProvenanceV15 {
  assertRetainedScryfallCardDataSnapshotManifestV15(manifest);
  return {
    method: 'contemporaneous-capture',
    sourceId: manifest.sourceId,
    sourceUri: manifest.sourceUri,
    sourceContentHash: manifest.sourceContentHash,
    observedAt: manifest.observedAt,
    retrievedAt: manifest.retrievedAt,
  };
}

export function resolveRetainedScryfallCardDataSnapshotForCutoffV15(
  manifests: RetainedScryfallCardDataSnapshotManifestV15[],
  cutoff: string,
): RetainedScryfallCardDataResolutionV15 {
  if (!Array.isArray(manifests)) throw new Error('manifests must be an array.');
  const cutoffIso = timestamp('cutoff', cutoff);
  const cutoffMs = Date.parse(cutoffIso);

  for (const manifest of manifests) assertRetainedScryfallCardDataSnapshotManifestV15(manifest);
  const ordered = [...manifests].sort((a, b) => {
    const timeDifference = Date.parse(a.observedAt) - Date.parse(b.observedAt);
    if (timeDifference !== 0) return timeDifference;
    return a.manifestFingerprint.localeCompare(b.manifestFingerprint);
  });
  const eligible = ordered.filter((manifest) => Date.parse(manifest.observedAt) <= cutoffMs);
  const selected = eligible.at(-1);
  if (!selected) {
    return {
      status: 'unavailable',
      cutoff: cutoffIso,
      reason: manifests.length === 0
        ? 'No retained Scryfall contemporaneous captures exist.'
        : 'No retained Scryfall contemporaneous capture was observed by the requested feature cutoff.',
      totalCaptures: manifests.length,
      earliestObservedAt: ordered[0]?.observedAt ?? null,
      latestObservedAt: ordered.at(-1)?.observedAt ?? null,
    };
  }
  return {
    status: 'available',
    cutoff: cutoffIso,
    selected,
    eligibleCaptures: eligible.length,
    totalCaptures: manifests.length,
  };
}
