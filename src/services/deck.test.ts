import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildDeckPricing, isColorIdentitySubset, parseDecklist } from './deck.js';

function printing(
  set: string,
  collectorNumber: string,
  prices: Record<string, string | null>,
): ScryfallCard {
  return {
    id: `${set}-${collectorNumber}`,
    oracle_id: 'same-sol-ring-oracle-id',
    name: 'Sol Ring',
    lang: 'en',
    cmc: 1,
    mana_cost: '{1}',
    type_line: 'Artifact',
    oracle_text: '{T}: Add {C}{C}.',
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: set.toLowerCase(),
    set_name: `Test ${set}`,
    collector_number: collectorNumber,
    rarity: 'uncommon',
    finishes: ['nonfoil', 'foil'],
    foil: true,
    nonfoil: true,
    prices,
    scryfall_uri: `https://scryfall.com/card/${set.toLowerCase()}/${collectorNumber}`,
  };
}

test('parseDecklist preserves Commander and physical printing annotations', () => {
  const deck = parseDecklist(`
// COMMANDER
1 Edgar Markov (INR) 234

// MAIN
1 Sol Ring (CMM) 396
3 Swamp (NEO) 297 *F*
1 Blood Artist
`);

  assert.deepEqual(deck.commanders, [
    { name: 'Edgar Markov', quantity: 1, set: 'INR', collectorNumber: '234' },
  ]);
  assert.deepEqual(deck.main, [
    { name: 'Sol Ring', quantity: 1, set: 'CMM', collectorNumber: '396' },
    { name: 'Swamp', quantity: 3, set: 'NEO', collectorNumber: '297', finish: 'foil' },
    { name: 'Blood Artist', quantity: 1 },
  ]);
  assert.equal(deck.totalCommanders, 1);
  assert.equal(deck.totalMain, 5);
  assert.equal(deck.totalCards, 6);
});

test('different physical printings of the same card remain distinct entries', () => {
  const deck = parseDecklist(`
1 Sol Ring (CMM) 396
1 Sol Ring (LTC) 284 *F*
`);
  assert.equal(deck.main.length, 2);
  assert.equal(deck.main[0]?.set, 'CMM');
  assert.equal(deck.main[1]?.set, 'LTC');
  assert.equal(deck.main[1]?.finish, 'foil');
});

test('deck pricing uses the exact set, collector number, and requested finish', () => {
  const deck = parseDecklist(`
1 Sol Ring (AAA) 1 *F*
1 Sol Ring (BBB) 9 *N*
`);
  const result = buildDeckPricing(deck, [
    printing('AAA', '1', { usd: '2.00', usd_foil: '10.00' }),
    printing('BBB', '9', { usd: '5.00', usd_foil: '20.00' }),
  ]) as {
    estimatedDeckValueUsd: number;
    exactPrintingEntriesRequested: number;
    entries: Array<{
      set?: string;
      selectedUnitUsd?: number | null;
      resolvedPrinting?: { set: string; collectorNumber: string };
    }>;
  };

  assert.equal(result.exactPrintingEntriesRequested, 2);
  assert.equal(result.estimatedDeckValueUsd, 15);
  assert.equal(result.entries[0]?.resolvedPrinting?.set, 'AAA');
  assert.equal(result.entries[0]?.resolvedPrinting?.collectorNumber, '1');
  assert.equal(result.entries[0]?.selectedUnitUsd, 10);
  assert.equal(result.entries[1]?.resolvedPrinting?.set, 'BBB');
  assert.equal(result.entries[1]?.selectedUnitUsd, 5);
});

test('parseDecklist can promote supplied commander names', () => {
  const deck = parseDecklist('1 Atraxa, Praetors’ Voice\n1 Sol Ring', ['Atraxa, Praetors’ Voice']);
  assert.deepEqual(deck.commanders, [{ name: 'Atraxa, Praetors’ Voice', quantity: 1 }]);
  assert.deepEqual(deck.main, [{ name: 'Sol Ring', quantity: 1 }]);
});

test('parseDecklist recognizes commander tags', () => {
  const deck = parseDecklist('1 Kenrith, the Returned King # Commander\n1 Arcane Signet');
  assert.equal(deck.commanders[0]?.name, 'Kenrith, the Returned King');
  assert.equal(deck.main[0]?.name, 'Arcane Signet');
});

test('color identity subset validation is order independent', () => {
  assert.equal(isColorIdentitySubset(['W', 'B'], ['R', 'B', 'W']), true);
  assert.equal(isColorIdentitySubset(['U'], ['R', 'B', 'W']), false);
  assert.equal(isColorIdentitySubset([], ['R']), true);
});
