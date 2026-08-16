import assert from 'node:assert/strict';
import { getPreconStockV10, searchCommanderPreconsV10 } from '../src/services/precons-v10.js';
import { lookupCard } from '../src/services/scryfall.js';
import { sourceHealthDiagnosticsV12 } from '../src/services/source-health-v12.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function probePost(url: string): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        standing: { $lte: 1 },
        tourney_filter: { size: { $gte: 10_000 } },
      }),
      redirect: 'follow',
    });
    const text = await response.text();
    return {
      url,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      finalUrl: response.url,
      bodyStart: text.slice(0, 120),
    };
  } catch (error) {
    return { url, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  const health = await sourceHealthDiagnosticsV12({ includeReferenceSources: false });
  console.log('SOURCE HEALTH');
  console.log(JSON.stringify(health, null, 2));

  const postDiagnostics = await Promise.all([
    probePost('https://cedhtop16.com/api/req'),
    probePost('https://cedhtop16.com/api/req/'),
    probePost('https://cedhtop16.com/api/list_tourneys'),
    probePost('https://cedhtop16.com/api/list_tourneys/'),
  ]);
  console.log('\nEDHTOP16 POST ROUTE DIAGNOSTIC');
  console.log(JSON.stringify(postDiagnostics, null, 2));

  const sources = Array.isArray(health.sources) ? health.sources.map(asRecord) : [];
  for (const id of ['scryfall', 'commander-spellbook', 'mtgjson']) {
    const source = sources.find((entry) => entry.id === id);
    assert.ok(source, `source health should include ${id}`);
    assert.equal(source.state, 'healthy', `${id} live integration should be healthy`);
  }

  const solRing = await lookupCard('Sol Ring', true);
  assert.equal(solRing.name, 'Sol Ring');
  assert.equal(solRing.legalities.commander, 'legal');
  console.log(`\nSCRYFALL: ${solRing.name} resolved from ${solRing.set.toUpperCase()} #${solRing.collector_number}`);

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
  console.log('\nLIVE SMOKE RESULT: PASS (EDHTop16 route status reported separately)');
}

main().catch((error) => {
  console.error('\nLIVE SMOKE RESULT: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
