import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15,
  SCRYFALL_JSONL_GZIP_FORMAT_V15,
  captureScryfallDefaultCardsForwardV15,
} from './scryfall-forward-carddata-capture-v15.js';

const card: ScryfallCard = {
  id: 'capture-card',
  oracle_id: 'capture-oracle',
  name: 'Forward Capture Card',
  lang: 'en',
  released_at: '2024-01-01',
  mana_cost: '{1}',
  cmc: 1,
  type_line: 'Artifact',
  oracle_text: 'Test forward capture.',
  color_identity: [],
  keywords: [],
  legalities: { commander: 'legal' },
  set: 'tst',
  set_name: 'Test Set',
  collector_number: '1',
  rarity: 'common',
  scryfall_uri: 'https://scryfall.com/card/tst/1/forward-capture-card',
};

const jsonlPayload = new TextEncoder().encode(`${JSON.stringify(card)}\n`);
const compressedPayload = gzipSync(jsonlPayload);
const compressedPayloadHash = createHash('sha256').update(compressedPayload).digest('hex');
const decodedPayloadHash = createHash('sha256').update(jsonlPayload).digest('hex');
const staticUri = 'https://data.scryfall.io/default-cards/default-cards-test.jsonl.gz';

function successFetch(bytes: Uint8Array = compressedPayload, headers: Record<string, string> = {}): typeof fetch {
  return (async () => new Response(Uint8Array.from(bytes), {
    status: 200,
    headers: {
      'content-length': String(bytes.byteLength),
      ...headers,
    },
  })) as typeof fetch;
}

test('Scryfall forward capture hashes exact compressed bytes, bounds decompression, and parses JSON Lines', async () => {
  const result = await captureScryfallDefaultCardsForwardV15(
    staticUri,
    {
      fetchImpl: successFetch(),
      expectedCompressedBytes: compressedPayload.byteLength,
      now: '2026-08-20T00:00:00.000Z',
    },
  );

  assert.equal(result.sourcePolicy.sourceId, SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15);
  assert.equal(result.sourcePolicy.nativeFormat, 'scryfall-jsonl-gzip');
  assert.equal(result.sourcePolicy.historicalArchiveVerified, false);
  assert.equal(result.sourcePolicy.forwardCapture, 'enabled-contemporaneous-capture');
  assert.equal(result.acquisition.format, SCRYFALL_JSONL_GZIP_FORMAT_V15);
  assert.equal(result.acquisition.byteLength, compressedPayload.byteLength);
  assert.equal(result.acquisition.decodedByteLength, jsonlPayload.byteLength);
  assert.deepEqual(result.acquisition.bytes, Uint8Array.from(compressedPayload));
  assert.deepEqual(result.acquisition.cards, [card]);
  assert.equal(result.acquisition.provenance.method, 'contemporaneous-capture');
  assert.equal(result.acquisition.provenance.observedAt, '2026-08-20T00:00:00.000Z');
  assert.equal(result.acquisition.provenance.retrievedAt, '2026-08-20T00:00:00.000Z');
  assert.equal(result.acquisition.provenance.sourceContentHash, compressedPayloadHash);
  assert.equal(result.acquisition.integrity.actualHash, compressedPayloadHash);
  assert.equal(result.acquisition.integrity.decodedContentHash, decodedPayloadHash);
  assert.equal(result.acquisition.integrity.expectedCompressedByteLength, compressedPayload.byteLength);
  assert.equal(result.acquisition.integrity.exactCompressedByteLengthMatch, true);
});

test('Scryfall forward capture rejects non-Scryfall, non-HTTPS, and non-jsonl.gz origins before network access', async () => {
  let requests = 0;
  const fetchImpl = (async () => {
    requests += 1;
    return new Response(Uint8Array.from(compressedPayload), { status: 200 });
  }) as typeof fetch;

  for (const uri of [
    'https://example.test/default-cards.jsonl.gz',
    'http://data.scryfall.io/default-cards.jsonl.gz',
    'https://data.scryfall.io/default-cards/default-cards.json',
  ]) {
    await assert.rejects(
      captureScryfallDefaultCardsForwardV15(uri, { fetchImpl, now: '2026-08-20T00:00:00.000Z' }),
      /HTTPS \*\.scryfall\.io \.jsonl\.gz/i,
    );
  }
  assert.equal(requests, 0);
});

test('manifest compressed-size mismatch fails before decompression or card parsing', async () => {
  await assert.rejects(
    captureScryfallDefaultCardsForwardV15(staticUri, {
      fetchImpl: successFetch(),
      expectedCompressedBytes: compressedPayload.byteLength + 1,
      now: '2026-08-20T00:00:00.000Z',
    }),
    /manifest requires|byte-length|bytes/i,
  );
});

test('decoded output is bounded to prevent gzip expansion from bypassing source limits', async () => {
  await assert.rejects(
    captureScryfallDefaultCardsForwardV15(staticUri, {
      fetchImpl: successFetch(),
      maxDecodedBytes: jsonlPayload.byteLength - 1,
      now: '2026-08-20T00:00:00.000Z',
    }),
    /output safety limit|could not be decoded/i,
  );
});

test('invalid gzip and invalid JSON Lines fail closed', async () => {
  const notGzip = new TextEncoder().encode('not gzip');
  await assert.rejects(
    captureScryfallDefaultCardsForwardV15(staticUri, {
      fetchImpl: successFetch(notGzip),
      now: '2026-08-20T00:00:00.000Z',
    }),
    /gzip JSON Lines source could not be decoded/i,
  );

  const invalidJsonl = gzipSync(new TextEncoder().encode('{not-json}\n'));
  await assert.rejects(
    captureScryfallDefaultCardsForwardV15(staticUri, {
      fetchImpl: successFetch(invalidJsonl),
      now: '2026-08-20T00:00:00.000Z',
    }),
    /record 1 is not valid JSON/i,
  );
});

test('HTTP transport content encoding is rejected because it can obscure exact compressed provider bytes', async () => {
  await assert.rejects(
    captureScryfallDefaultCardsForwardV15(staticUri, {
      fetchImpl: successFetch(compressedPayload, { 'content-encoding': 'gzip' }),
      now: '2026-08-20T00:00:00.000Z',
    }),
    /exact provider file bytes cannot be proven/i,
  );
});