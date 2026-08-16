import assert from 'node:assert/strict';
import { getUsdNzdRateV13 } from '../src/services/currency-v13.js';
import { getPreconStockV10, searchCommanderPreconsV10 } from '../src/services/precons-v10.js';
import { priceCardNzdV13 } from '../src/services/pricing-v13.js';
import { lookupCard } from '../src/services/scryfall.js';
import { sourceHealthDiagnosticsV12 } from '../src/services/source-health-v12.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  const health = await sourceHealthDiagnosticsV12({ includeReferenceSources: false });
  console.log('SOURCE HEALTH');
  console.log(JSON.stringify(health, null, 2));

  const sources = Array.isArray(health.sources) ? health.sources.map(asRecord) : [];
  for (const id of ['scryfall', 'commander-spellbook', 'mtgjson']) {
    const source = sources.find((entry) => entry.id === id);
    assert.ok(source, `source health should include ${id}`);
    assert.equal(source.state, 'healthy', `${id} live integration should be healthy`);
  }
  const edhTop16 = sources.find((entry) => entry.id === 'edhtop16');
  assert.ok(edhTop16, 'source health should include EDHTop16');
  assert.equal(edhTop16.state, 'reference-only', 'EDHTop16 should not be treated as a working legacy structured API');

  const fx = await getUsdNzdRateV13(true);
  assert.equal(fx.base, 'USD');
  assert.equal(fx.quote, 'NZD');
  assert.ok(fx.rate > 0, 'live USD→NZD exchange rate must be positive');
  assert.equal(fx.source, 'Frankfurter', 'normal live smoke should use the live FX source rather than a fallback');
  console.log(`\nFX: 1 USD = ${fx.rate} NZD (${fx.rateDate})`);

  const solRing = await lookupCard('Sol Ring', true);
  assert.equal(solRing.name, 'Sol Ring');
  assert.equal(solRing.legalities.commander, 'legal');
  console.log(`SCRYFALL: ${solRing.name} resolved from ${solRing.set.toUpperCase()} #${solRing.collector_number}`);

  const solRingPrice = await priceCardNzdV13({ set: solRing.set, collectorNumber: solRing.collector_number });
  assert.equal(solRingPrice.currency, 'NZD', 'current card-pricing output must be NZD first');
  const prices = Array.isArray(solRingPrice.prices) ? solRingPrice.prices.map(asRecord) : [];
  assert.ok(prices.some((price) => typeof price.priceNzd === 'number'), 'card price lookup should expose at least one converted NZD printing price when Scryfall has a price');
  assert.ok(prices.every((price) => !('priceUsd' in price)), 'current pricing output should not expose a bare USD price as the primary field');

  const catalogResult = await searchCommanderPreconsV10({
    query: 'Limit Break',
    limit: 20,
    forceRefresh: true,
  });
  const precons = Array.isArray(catalogResult.precons) ? catalogResult.precons.map(asRecord) : [];
  assert.ok(precons.length > 0, 'MTGJSON Commander catalog should contain Limit Break');

  const standard = precons.find((entry) => entry.productVariant === 'standard') ?? precons[0];
  assert.ok(standard, 'a Limit Break product entry should be available');
  const reference = typeof standard.fileName === 'string'
    ? standard.fileName
    : typeof standard.name === 'string'
      ? standard.name
      : '';
  assert.ok(reference, 'the selected precon should have a usable reference');

  const stock = await getPreconStockV10(reference);
  assert.equal(stock.cardCount, 100, 'stock Commander precon should contain 100 cards including commander(s)');
  assert.equal(typeof stock.stockDecklist, 'string');
  assert.match(String(stock.stockDecklist), /\/\/ COMMANDER/);
  assert.match(String(stock.stockDecklist), /\([A-Z0-9]+\)\s+[^\s]+\s+\*[FN]\*/m, 'stock list should preserve exact set/collector/finish identity');

  console.log(`MTGJSON: ${String(asRecord(stock.precon).name ?? reference)} resolved as a 100-card stock deck.`);
  console.log('\nLIVE SMOKE RESULT: PASS');
}

main().catch((error) => {
  console.error('\nLIVE SMOKE RESULT: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
