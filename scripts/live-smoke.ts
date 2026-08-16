import assert from 'node:assert/strict';
import { getPreconStockV10, searchCommanderPreconsV10 } from '../src/services/precons-v10.js';
import { lookupCard } from '../src/services/scryfall.js';
import { sourceHealthDiagnosticsV12 } from '../src/services/source-health-v12.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function probeUrl(url: string): Promise<{ url: string; status: number | null; ok: boolean; detail: string }> {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    return {
      url,
      status: response.status,
      ok: response.ok,
      detail: `${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      url,
      status: null,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const health = await sourceHealthDiagnosticsV12({ includeReferenceSources: false });
  console.log('SOURCE HEALTH');
  console.log(JSON.stringify(health, null, 2));

  const edhTop16HostProbes = await Promise.all([
    probeUrl('https://edhtop16.com/api/get_commanders'),
    probeUrl('https://cedhtop16.com/api/get_commanders'),
  ]);
  console.log('\nEDHTOP16 API HOST DIAGNOSTIC');
  console.log(JSON.stringify(edhTop16HostProbes, null, 2));

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
  console.log('\nLIVE SMOKE RESULT: PASS');
}

main().catch((error) => {
  console.error('\nLIVE SMOKE RESULT: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
