import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  SCRYFALL_BULK_DISCOVERY_ACCEPT_V15,
  discoverAndCaptureScryfallDefaultCardsForwardV15,
  discoverScryfallDefaultCardsV15,
} from './scryfall-bulk-carddata-source-v15.js';

const staticUri = 'https://data.scryfall.io/default-cards/default-cards-20260820.json';

function manifestEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'default-cards-object',
    type: 'default_cards',
    updated_at: '2026-08-20T01:02:03.000Z',
    download_uri: staticUri,
    size: 123456789,
    content_type: 'application/json',
    content_encoding: 'gzip',
    ...overrides,
  };
}

function manifest(entries: unknown[] = [manifestEntry()]): unknown {
  return {
    object: 'list',
    has_more: false,
    data: entries,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const capturedCard: ScryfallCard = {
  id: 'captured-card',
  oracle_id: 'captured-oracle',
  name: 'Captured Card',
  lang: 'en',
  released_at: '2024-01-01',
  mana_cost: '{1}',
  cmc: 1,
  type_line: 'Artifact',
  oracle_text: 'Captured prospectively.',
  color_identity: [],
  keywords: [],
  legalities: { commander: 'legal' },
  set: 'tst',
  set_name: 'Test Set',
  collector_number: '1',
  rarity: 'common',
  scryfall_uri: 'https://scryfall.com/card/tst/1/captured-card',
};
const cardPayload = new TextEncoder().encode(JSON.stringify([capturedCard]));
const cardPayloadHash = createHash('sha256').update(cardPayload).digest('hex');

test('Scryfall bulk discovery sends required headers and returns only validated current-provider metadata', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    requestInit = init;
    return jsonResponse(manifest());
  }) as typeof fetch;

  const result = await discoverScryfallDefaultCardsV15({
    fetchImpl,
    userAgent: 'mtg-ultimate-mcp-test/1.0',
    now: '2026-08-20T02:00:00.000Z',
  });

  assert.equal(requestUrl, 'https://api.scryfall.com/bulk-data');
  const headers = new Headers(requestInit?.headers);
  assert.equal(headers.get('user-agent'), 'mtg-ultimate-mcp-test/1.0');
  assert.equal(headers.get('accept'), SCRYFALL_BULK_DISCOVERY_ACCEPT_V15);
  assert.equal(result.sourceId, 'scryfall-default-cards');
  assert.equal(result.manifestUri, 'https://api.scryfall.com/bulk-data');
  assert.equal(result.discoveredAt, '2026-08-20T02:00:00.000Z');
  assert.equal(result.providerObjectId, 'default-cards-object');
  assert.equal(result.providerUpdatedAt, '2026-08-20T01:02:03.000Z');
  assert.equal(result.providerSizeBytes, 123456789);
  assert.equal(result.providerContentType, 'application/json');
  assert.equal(result.providerContentEncoding, 'gzip');
  assert.equal(result.downloadUri, staticUri);
  assert.equal(result.requestPolicy.automaticRetries, 0);
  assert.equal(result.temporalPolicy, 'current-provider-metadata-only-not-historical-proof');
});

test('manifest shape, missing entries, and duplicate default_cards entries fail closed', async () => {
  const cases: Array<{ payload: unknown; pattern: RegExp }> = [
    { payload: [], pattern: /object containing a data array/i },
    { payload: { data: [] }, pattern: /does not contain a default_cards entry/i },
    {
      payload: manifest([manifestEntry(), manifestEntry({ id: 'duplicate' })]),
      pattern: /exactly one is required/i,
    },
  ];

  for (const item of cases) {
    const fetchImpl = (async () => jsonResponse(item.payload)) as typeof fetch;
    await assert.rejects(
      discoverScryfallDefaultCardsV15({ fetchImpl, now: '2026-08-20T02:00:00.000Z' }),
      item.pattern,
    );
  }
});

test('malformed default_cards metadata cannot become a trusted static download', async () => {
  const badEntries: Array<{ entry: Record<string, unknown>; pattern: RegExp }> = [
    { entry: manifestEntry({ updated_at: 'not-a-date' }), pattern: /updated_at must be a valid timestamp/i },
    { entry: manifestEntry({ download_uri: 'http://data.scryfall.io/default-cards.json' }), pattern: /absolute HTTPS \*\.scryfall\.io/i },
    { entry: manifestEntry({ download_uri: 'https://example.test/default-cards.json' }), pattern: /absolute HTTPS \*\.scryfall\.io/i },
    { entry: manifestEntry({ size: -1 }), pattern: /size must be a positive safe integer/i },
    { entry: manifestEntry({ content_type: '' }), pattern: /content_type must be a non-empty string/i },
  ];

  for (const item of badEntries) {
    const fetchImpl = (async () => jsonResponse(manifest([item.entry]))) as typeof fetch;
    await assert.rejects(
      discoverScryfallDefaultCardsV15({ fetchImpl, now: '2026-08-20T02:00:00.000Z' }),
      item.pattern,
    );
  }
});

test('HTTP and invalid-JSON provider failures are classified without accepting partial metadata', async () => {
  await assert.rejects(
    discoverScryfallDefaultCardsV15({
      fetchImpl: (async () => new Response('unavailable', { status: 503, statusText: 'Unavailable' })) as typeof fetch,
      now: '2026-08-20T02:00:00.000Z',
    }),
    /HTTP 503/i,
  );

  await assert.rejects(
    discoverScryfallDefaultCardsV15({
      fetchImpl: (async () => new Response('{not-json', { status: 200 })) as typeof fetch,
      now: '2026-08-20T02:00:00.000Z',
    }),
    /not valid JSON/i,
  );
});

test('discovery and forward capture use one observation timestamp but never promote provider updated_at to historical proof', async () => {
  const requested: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    if (url === 'https://api.scryfall.com/bulk-data') return jsonResponse(manifest());
    if (url === staticUri) {
      return new Response(cardPayload, {
        status: 200,
        headers: { 'content-length': String(cardPayload.byteLength) },
      });
    }
    return new Response('unexpected', { status: 404 });
  }) as typeof fetch;

  const result = await discoverAndCaptureScryfallDefaultCardsForwardV15({
    fetchImpl,
    userAgent: 'mtg-ultimate-mcp-test/1.0',
    now: '2026-08-20T02:00:00.000Z',
  });

  assert.deepEqual(requested, ['https://api.scryfall.com/bulk-data', staticUri]);
  assert.equal(result.discovery.providerUpdatedAt, '2026-08-20T01:02:03.000Z');
  assert.equal(result.discovery.discoveredAt, '2026-08-20T02:00:00.000Z');
  assert.equal(result.discovery.temporalPolicy, 'current-provider-metadata-only-not-historical-proof');
  assert.equal(result.capture.acquisition.provenance.method, 'contemporaneous-capture');
  assert.equal(result.capture.acquisition.provenance.observedAt, '2026-08-20T02:00:00.000Z');
  assert.equal(result.capture.acquisition.provenance.retrievedAt, '2026-08-20T02:00:00.000Z');
  assert.equal(result.capture.acquisition.provenance.sourceContentHash, cardPayloadHash);
  assert.equal(result.capture.sourcePolicy.historicalArchiveVerified, false);
});
