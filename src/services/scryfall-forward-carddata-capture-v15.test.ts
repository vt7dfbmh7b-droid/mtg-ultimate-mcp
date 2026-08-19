import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15,
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

const payload = new TextEncoder().encode(JSON.stringify([card]));
const payloadHash = createHash('sha256').update(payload).digest('hex');

function successFetch(): typeof fetch {
  return (async () => new Response(payload, {
    status: 200,
    headers: { 'content-length': String(payload.byteLength) },
  })) as typeof fetch;
}

test('Scryfall forward capture applies source policy, observation time, and local content hash', async () => {
  const result = await captureScryfallDefaultCardsForwardV15(
    'https://data.scryfall.io/default-cards/default-cards-test.json',
    { fetchImpl: successFetch(), now: '2026-08-20T00:00:00.000Z' },
  );

  assert.equal(result.sourcePolicy.sourceId, SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15);
  assert.equal(result.sourcePolicy.historicalArchiveVerified, false);
  assert.equal(result.sourcePolicy.forwardCapture, 'enabled-contemporaneous-capture');
  assert.equal(result.acquisition.provenance.method, 'contemporaneous-capture');
  assert.equal(result.acquisition.provenance.observedAt, '2026-08-20T00:00:00.000Z');
  assert.equal(result.acquisition.provenance.retrievedAt, '2026-08-20T00:00:00.000Z');
  assert.equal(result.acquisition.provenance.sourceContentHash, payloadHash);
  assert.equal(result.acquisition.integrity.actualHash, payloadHash);
  assert.equal(result.acquisition.integrity.exactHashMatch, true);
  assert.deepEqual(result.acquisition.cards, [card]);
});

test('Scryfall forward capture rejects non-Scryfall and non-HTTPS bulk origins before network access', async () => {
  let requests = 0;
  const fetchImpl = (async () => {
    requests += 1;
    return new Response(payload, { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    captureScryfallDefaultCardsForwardV15(
      'https://example.test/default-cards.json',
      { fetchImpl, now: '2026-08-20T00:00:00.000Z' },
    ),
    /HTTPS \*\.scryfall\.io/i,
  );
  await assert.rejects(
    captureScryfallDefaultCardsForwardV15(
      'http://data.scryfall.io/default-cards.json',
      { fetchImpl, now: '2026-08-20T00:00:00.000Z' },
    ),
    /HTTPS \*\.scryfall\.io/i,
  );
  assert.equal(requests, 0);
});
