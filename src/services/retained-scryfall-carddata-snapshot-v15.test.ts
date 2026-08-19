import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { DiscoveredScryfallForwardCardDataCaptureV15 } from './scryfall-bulk-carddata-source-v15.js';
import {
  assertRetainedScryfallCardDataBytesV15,
  assertRetainedScryfallCardDataSnapshotManifestV15,
  contemporaneousProvenanceFromRetainedScryfallSnapshotV15,
  createRetainedScryfallCardDataSnapshotManifestV15,
  resolveRetainedScryfallCardDataSnapshotForCutoffV15,
  type RetainedScryfallCardDataSnapshotManifestV15,
} from './retained-scryfall-carddata-snapshot-v15.js';

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const artifactManifestDigest = `sha256:${'a'.repeat(64)}`;

function captureFixture(
  observedAt: string,
  bytes: Uint8Array,
  providerUpdatedAt = '2026-08-18T00:00:00.000Z',
): DiscoveredScryfallForwardCardDataCaptureV15 {
  const sourceHash = hash(bytes);
  const decodedHash = hash(new TextEncoder().encode(`decoded:${sourceHash}`));
  const sourceUri = `https://data.scryfall.io/default-cards/default-cards-${sourceHash.slice(0, 8)}.jsonl.gz`;
  return {
    discovery: {
      schemaVersion: 'scryfall-bulk-carddata-source-v15.2',
      sourceId: 'scryfall-default-cards',
      manifestUri: 'https://api.scryfall.com/bulk-data',
      discoveredAt: observedAt,
      providerObjectId: `provider-${sourceHash.slice(0, 8)}`,
      providerMetadataUri: 'https://api.scryfall.com/bulk-data/default-cards',
      providerUpdatedAt,
      providerCompressedSizeBytes: bytes.byteLength,
      downloadUri: sourceUri,
      requestPolicy: {
        userAgent: 'mtg-ultimate-mcp-test',
        accept: 'application/json;q=0.9,*/*;q=0.8',
        automaticRetries: 0,
      },
      temporalPolicy: 'current-provider-metadata-only-not-historical-proof',
    },
    capture: {
      schemaVersion: 'scryfall-forward-carddata-capture-v15.2',
      sourcePolicy: {} as never,
      acquisition: {
        format: 'scryfall-jsonl-gzip-v1',
        bytes,
        byteLength: bytes.byteLength,
        decodedByteLength: 123,
        cards: [],
        provenance: {
          method: 'contemporaneous-capture',
          sourceId: 'scryfall-default-cards',
          sourceUri,
          sourceContentHash: sourceHash,
          observedAt,
          retrievedAt: observedAt,
        },
        integrity: {
          algorithm: 'sha256',
          expectedHash: null,
          actualHash: sourceHash,
          exactHashMatch: true,
          expectedCompressedByteLength: bytes.byteLength,
          exactCompressedByteLengthMatch: true,
          decodedContentHash: decodedHash,
        },
      },
      safeguards: [] as unknown as DiscoveredScryfallForwardCardDataCaptureV15['capture']['safeguards'],
    },
  };
}

function retained(
  observedAt: string,
  text: string,
  providerUpdatedAt?: string,
): { manifest: RetainedScryfallCardDataSnapshotManifestV15; bytes: Uint8Array } {
  const bytes = new TextEncoder().encode(text);
  const input = captureFixture(observedAt, bytes, providerUpdatedAt);
  const sourceHash = input.capture.acquisition.integrity.actualHash;
  const manifest = createRetainedScryfallCardDataSnapshotManifestV15(input, {
    artifactReference: `ghcr.io/vt7dfbmh7b-droid/mtg-ultimate-mcp-carddata@${artifactManifestDigest}`,
    sourceLayerDigest: `sha256:${sourceHash}`,
  });
  return { manifest, bytes };
}

test('retained manifest binds exact source bytes to an immutable GHCR artifact without claiming retrospective archive status', () => {
  const { manifest, bytes } = retained('2026-08-20T00:00:00.000Z', 'snapshot-one');

  assert.equal(manifest.temporalMode, 'contemporaneous-capture');
  assert.equal(manifest.historicalArchiveVerified, false);
  assert.equal(manifest.storage.registry, 'ghcr.io');
  assert.match(manifest.storage.artifactReference, /@sha256:[a-f0-9]{64}$/);
  assert.equal(manifest.storage.sourceLayerDigest, `sha256:${hash(bytes)}`);
  assert.equal(manifest.sourceContentHash, hash(bytes));
  assertRetainedScryfallCardDataSnapshotManifestV15(manifest);
  assertRetainedScryfallCardDataBytesV15(manifest, bytes);
});

test('resolver selects newest capture observed no later than the feature cutoff', () => {
  const first = retained('2026-08-20T00:00:00.000Z', 'first').manifest;
  const second = retained('2026-08-21T00:00:00.000Z', 'second').manifest;
  const third = retained('2026-08-22T00:00:00.000Z', 'third').manifest;

  const result = resolveRetainedScryfallCardDataSnapshotForCutoffV15(
    [third, first, second],
    '2026-08-21T12:00:00.000Z',
  );

  assert.equal(result.status, 'available');
  if (result.status !== 'available') return;
  assert.equal(result.selected.manifestFingerprint, second.manifestFingerprint);
  assert.equal(result.eligibleCaptures, 2);
  assert.equal(result.totalCaptures, 3);
});

test('provider updated_at never backdates a capture first observed later', () => {
  const laterCapture = retained(
    '2026-08-20T00:00:00.000Z',
    'current-file',
    '2026-08-18T00:00:00.000Z',
  ).manifest;

  const result = resolveRetainedScryfallCardDataSnapshotForCutoffV15(
    [laterCapture],
    '2026-08-19T23:59:59.000Z',
  );

  assert.equal(result.status, 'unavailable');
  if (result.status !== 'unavailable') return;
  assert.match(result.reason, /observed by the requested feature cutoff/i);
  assert.equal(result.earliestObservedAt, '2026-08-20T00:00:00.000Z');
});

test('empty retained inventory reports unavailable instead of manufacturing historical coverage', () => {
  const result = resolveRetainedScryfallCardDataSnapshotForCutoffV15([], '2026-08-20T00:00:00.000Z');
  assert.equal(result.status, 'unavailable');
  if (result.status !== 'unavailable') return;
  assert.equal(result.totalCaptures, 0);
  assert.equal(result.earliestObservedAt, null);
  assert.match(result.reason, /no retained/i);
});

test('retained bytes must match both exact byte length and SHA-256', () => {
  const { manifest, bytes } = retained('2026-08-20T00:00:00.000Z', 'trusted');
  assertRetainedScryfallCardDataBytesV15(manifest, bytes);

  assert.throws(
    () => assertRetainedScryfallCardDataBytesV15(manifest, new TextEncoder().encode('tampered')),
    /byte length|sourceContentHash/i,
  );
});

test('mutable GHCR tags are rejected; storage must be pinned by digest', () => {
  const bytes = new TextEncoder().encode('immutable');
  const input = captureFixture('2026-08-20T00:00:00.000Z', bytes);
  assert.throws(
    () => createRetainedScryfallCardDataSnapshotManifestV15(input, {
      artifactReference: 'ghcr.io/vt7dfbmh7b-droid/mtg-ultimate-mcp-carddata:latest',
      sourceLayerDigest: `sha256:${hash(bytes)}`,
    }),
    /immutable.*pinned by sha256/i,
  );
});

test('OCI source layer digest must be the digest of the exact captured provider bytes', () => {
  const bytes = new TextEncoder().encode('source');
  const input = captureFixture('2026-08-20T00:00:00.000Z', bytes);
  assert.throws(
    () => createRetainedScryfallCardDataSnapshotManifestV15(input, {
      artifactReference: `ghcr.io/vt7dfbmh7b-droid/mtg-ultimate-mcp-carddata@${artifactManifestDigest}`,
      sourceLayerDigest: `sha256:${'b'.repeat(64)}`,
    }),
    /must equal the SHA-256 of the exact captured/i,
  );
});

test('tampering with a retained manifest is detected by its canonical fingerprint', () => {
  const { manifest } = retained('2026-08-20T00:00:00.000Z', 'fingerprinted');
  const tampered = {
    ...manifest,
    providerUpdatedAt: '2026-08-17T00:00:00.000Z',
  };
  assert.throws(
    () => assertRetainedScryfallCardDataSnapshotManifestV15(tampered),
    /manifest fingerprint does not match/i,
  );
});

test('retained snapshot rehydrates only contemporaneous provenance, never archived-versioned provenance', () => {
  const { manifest } = retained('2026-08-20T00:00:00.000Z', 'provenance');
  const provenance = contemporaneousProvenanceFromRetainedScryfallSnapshotV15(manifest);

  assert.equal(provenance.method, 'contemporaneous-capture');
  assert.equal(provenance.observedAt, '2026-08-20T00:00:00.000Z');
  assert.equal(provenance.sourceContentHash, manifest.sourceContentHash);
});
