import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import type { ScryfallCard } from '../types/scryfall.js';
import type { DiscoveredScryfallForwardCardDataCaptureV15 } from './scryfall-bulk-carddata-source-v15.js';
import { replayRetainedScryfallCardDataSnapshotV15 } from './retained-scryfall-carddata-replay-v15.js';
import { createRetainedScryfallCardDataSnapshotManifestV15 } from './retained-scryfall-carddata-snapshot-v15.js';

const card: ScryfallCard = {
  id: 'retained-replay-card',
  oracle_id: 'retained-replay-oracle',
  name: 'Retained Replay Card',
  lang: 'en',
  released_at: '2024-01-01',
  mana_cost: '{1}',
  cmc: 1,
  type_line: 'Artifact',
  oracle_text: 'Replay exact retained bytes.',
  color_identity: [],
  keywords: [],
  legalities: { commander: 'legal' },
  set: 'tst',
  set_name: 'Test Set',
  collector_number: '1',
  rarity: 'common',
  scryfall_uri: 'https://scryfall.com/card/tst/1/retained-replay-card',
};

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function fixture(decodedHashOverride?: string) {
  const decoded = new TextEncoder().encode(`${JSON.stringify(card)}\n`);
  const bytes = gzipSync(decoded);
  const sourceHash = hash(bytes);
  const observedAt = '2026-08-20T01:00:00.000Z';
  const sourceUri = 'https://data.scryfall.io/default-cards/default-cards-retained-replay.jsonl.gz';
  const input = {
    discovery: {
      schemaVersion: 'scryfall-bulk-carddata-source-v15.2',
      sourceId: 'scryfall-default-cards',
      manifestUri: 'https://api.scryfall.com/bulk-data',
      discoveredAt: observedAt,
      providerObjectId: 'retained-replay-provider',
      providerMetadataUri: 'https://api.scryfall.com/bulk-data/default-cards',
      providerUpdatedAt: '2026-08-20T00:30:00.000Z',
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
        decodedByteLength: decoded.byteLength,
        cards: [card],
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
          decodedContentHash: decodedHashOverride ?? hash(decoded),
        },
      },
      safeguards: [] as unknown as DiscoveredScryfallForwardCardDataCaptureV15['capture']['safeguards'],
    },
  } satisfies DiscoveredScryfallForwardCardDataCaptureV15;

  const manifest = createRetainedScryfallCardDataSnapshotManifestV15(input, {
    artifactReference: `ghcr.io/vt7dfbmh7b-droid/mtg-ultimate-mcp-carddata@sha256:${'a'.repeat(64)}`,
    sourceLayerDigest: `sha256:${sourceHash}`,
  });
  return { bytes: Uint8Array.from(bytes), manifest };
}

test('retained bytes replay through the live parser with original contemporaneous provenance', async () => {
  const { bytes, manifest } = fixture();
  const result = await replayRetainedScryfallCardDataSnapshotV15(manifest, bytes);

  assert.equal(result.replayVerified, true);
  assert.equal(result.manifestFingerprint, manifest.manifestFingerprint);
  assert.equal(result.capture.acquisition.cards.length, 1);
  assert.equal(result.capture.acquisition.cards[0]?.name, card.name);
  assert.equal(result.capture.acquisition.provenance.observedAt, manifest.observedAt);
  assert.equal(result.capture.acquisition.integrity.actualHash, manifest.sourceContentHash);
});

test('retained replay fails if decoded contents do not match the manifest evidence', async () => {
  const { bytes, manifest } = fixture('b'.repeat(64));
  await assert.rejects(
    replayRetainedScryfallCardDataSnapshotV15(manifest, bytes),
    /decoded-content hash does not match/i,
  );
});

test('retained replay rejects changed source bytes before parsing', async () => {
  const { manifest } = fixture();
  await assert.rejects(
    replayRetainedScryfallCardDataSnapshotV15(manifest, new TextEncoder().encode('tampered')),
    /byte length|sourceContentHash/i,
  );
});
