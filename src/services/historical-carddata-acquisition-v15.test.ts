import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  acquirePinnedHistoricalCardDataV15,
  captureCurrentCardDataV15,
  extractDeckFeatureSnapshotFromCapturedCardDataV15,
  extractDeckFeatureSnapshotFromHistoricalCardDataV15,
  SCRYFALL_CARD_ARRAY_FORMAT_V15,
  type HistoricalCardDataArchivePinV15,
} from './historical-carddata-acquisition-v15.js';

function card(name: string, typeLine: string, cmc: number, oracleText = ''): ScryfallCard {
  return {
    id: `id-${name}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    released_at: '2024-01-01',
    mana_cost: cmc > 0 ? `{${cmc}}` : '',
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    rarity: 'common',
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
  };
}

const cards = [
  card('Acquisition Commander', 'Legendary Creature — Test', 2),
  card('Acquisition Land', 'Basic Land — Wastes', 0, '{T}: Add {C}.'),
  card('Acquisition Answer', 'Instant', 1, 'A deck can have any number of cards named Acquisition Answer.\nDestroy target creature.'),
  card('Acquisition Threat', 'Creature — Test', 3, 'A deck can have any number of cards named Acquisition Threat.'),
];

const decklist = [
  '// COMMANDER',
  '1 Acquisition Commander',
  '',
  '// MAIN',
  '34 Acquisition Land',
  '10 Acquisition Answer',
  '55 Acquisition Threat',
].join('\n');

const payloadText = JSON.stringify(cards);
const payloadBytes = new TextEncoder().encode(payloadText);
const payloadHash = createHash('sha256').update(payloadBytes).digest('hex');

function pin(overrides: Partial<HistoricalCardDataArchivePinV15> = {}): HistoricalCardDataArchivePinV15 {
  return {
    sourceId: 'audited-versioned-card-archive',
    sourceUri: 'https://archive.example.test/cards/2026-01-08/default-cards.json',
    sourceContentHash: payloadHash,
    archiveVersion: 'cards-2026-01-08',
    snapshotEffectiveAt: '2026-01-08T00:00:00.000Z',
    archivePublishedAt: '2026-01-08T06:00:00.000Z',
    format: SCRYFALL_CARD_ARRAY_FORMAT_V15,
    expectedByteLength: payloadBytes.byteLength,
    ...overrides,
  };
}

function successFetch(bytes = payloadBytes): typeof fetch {
  return (async () => new Response(bytes, {
    status: 200,
    headers: { 'content-length': String(bytes.byteLength) },
  })) as typeof fetch;
}

test('pinned historical acquisition verifies exact bytes, hash, length, and archive provenance', async () => {
  const result = await acquirePinnedHistoricalCardDataV15(
    pin(),
    '2026-01-10T00:00:00.000Z',
    { fetchImpl: successFetch(), now: '2026-08-20T00:00:00.000Z' },
  );

  assert.equal(result.byteLength, payloadBytes.byteLength);
  assert.deepEqual(result.bytes, payloadBytes);
  assert.deepEqual(result.cards, cards);
  assert.equal(result.integrity.expectedHash, payloadHash);
  assert.equal(result.integrity.actualHash, payloadHash);
  assert.equal(result.integrity.exactHashMatch, true);
  assert.equal(result.provenance.method, 'archived-versioned-snapshot');
  assert.equal(result.provenance.sourceContentHash, payloadHash);
  assert.equal(result.provenance.retrievedAt, '2026-08-20T00:00:00.000Z');
});

test('archive publication after the requested feature cutoff fails before network access', async () => {
  let requested = false;
  const fetchImpl = (async () => {
    requested = true;
    return new Response(payloadBytes, { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    acquirePinnedHistoricalCardDataV15(
      pin({
        snapshotEffectiveAt: '2026-01-08T00:00:00.000Z',
        archivePublishedAt: '2026-01-12T00:00:00.000Z',
      }),
      '2026-01-10T00:00:00.000Z',
      { fetchImpl, now: '2026-08-20T00:00:00.000Z' },
    ),
    /not eligible|published.*after|feature cutoff/i,
  );
  assert.equal(requested, false);
});

test('a mismatched content hash fails closed before card data can be used', async () => {
  await assert.rejects(
    acquirePinnedHistoricalCardDataV15(
      pin({ sourceContentHash: 'f'.repeat(64) }),
      '2026-01-10T00:00:00.000Z',
      { fetchImpl: successFetch(), now: '2026-08-20T00:00:00.000Z' },
    ),
    /SHA-256 mismatch/i,
  );
});

test('byte length and maximum-size guards reject truncated or unexpectedly large sources', async () => {
  await assert.rejects(
    acquirePinnedHistoricalCardDataV15(
      pin({ expectedByteLength: payloadBytes.byteLength + 1 }),
      '2026-01-10T00:00:00.000Z',
      { fetchImpl: successFetch(), now: '2026-08-20T00:00:00.000Z' },
    ),
    /byte|length|requires/i,
  );

  await assert.rejects(
    acquirePinnedHistoricalCardDataV15(
      pin(),
      '2026-01-10T00:00:00.000Z',
      { fetchImpl: successFetch(), maxBytes: payloadBytes.byteLength - 1, now: '2026-08-20T00:00:00.000Z' },
    ),
    /safety limit|too large|above/i,
  );
});

test('invalid JSON and invalid card shapes are never accepted as verified historical card data', async () => {
  const invalidJson = new TextEncoder().encode('{not-json');
  const invalidHash = createHash('sha256').update(invalidJson).digest('hex');
  await assert.rejects(
    acquirePinnedHistoricalCardDataV15(
      pin({ sourceContentHash: invalidHash, expectedByteLength: invalidJson.byteLength }),
      '2026-01-10T00:00:00.000Z',
      { fetchImpl: successFetch(invalidJson), now: '2026-08-20T00:00:00.000Z' },
    ),
    /not valid JSON/i,
  );

  const malformed = new TextEncoder().encode(JSON.stringify([{ name: 'Missing required fields' }]));
  const malformedHash = createHash('sha256').update(malformed).digest('hex');
  await assert.rejects(
    acquirePinnedHistoricalCardDataV15(
      pin({ sourceContentHash: malformedHash, expectedByteLength: malformed.byteLength }),
      '2026-01-10T00:00:00.000Z',
      { fetchImpl: successFetch(malformed), now: '2026-08-20T00:00:00.000Z' },
    ),
    /invalid Scryfall card/i,
  );
});

test('pinned acquisition is wired directly into provenanced historical feature extraction', async () => {
  const snapshot = await extractDeckFeatureSnapshotFromHistoricalCardDataV15(
    decklist,
    pin(),
    '2026-01-10T00:00:00.000Z',
    { fetchImpl: successFetch(), now: '2026-08-20T00:00:00.000Z' },
  );

  assert.equal(snapshot.historicalCardDataProvenance.method, 'archived-versioned-snapshot');
  assert.equal(snapshot.historicalCardDataProvenance.sourceContentHash, payloadHash);
  assert.equal(snapshot.historicalCommanderValidation.status, 'legal');
});

test('forward capture timestamps current bytes at observation time and cannot be backdated into historical features', async () => {
  const captured = await captureCurrentCardDataV15({
    sourceId: 'scryfall-default-cards-forward-capture',
    sourceUri: 'https://data.scryfall.test/default-cards.json',
    format: SCRYFALL_CARD_ARRAY_FORMAT_V15,
  }, {
    fetchImpl: successFetch(),
    now: '2026-08-20T00:00:00.000Z',
  });

  assert.equal(captured.provenance.method, 'contemporaneous-capture');
  assert.equal(captured.provenance.observedAt, '2026-08-20T00:00:00.000Z');
  assert.equal(captured.provenance.retrievedAt, '2026-08-20T00:00:00.000Z');
  assert.equal(captured.provenance.sourceContentHash, payloadHash);
  assert.equal(captured.integrity.expectedHash, null);

  assert.throws(
    () => extractDeckFeatureSnapshotFromCapturedCardDataV15(
      decklist,
      captured,
      '2026-08-19T23:59:59.000Z',
    ),
    /not eligible|observed after|future knowledge/i,
  );

  const futureSnapshot = extractDeckFeatureSnapshotFromCapturedCardDataV15(
    decklist,
    captured,
    '2026-08-21T00:00:00.000Z',
  );
  assert.equal(futureSnapshot.historicalCardDataProvenance.method, 'contemporaneous-capture');
  assert.equal(futureSnapshot.cardDataObservedAt, '2026-08-20T00:00:00.000Z');
});
