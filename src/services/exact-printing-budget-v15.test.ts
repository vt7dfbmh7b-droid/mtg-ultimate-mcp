import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import {
  auditExactPerCardBudgetV15,
  exactPrintingBudgetWitnessV15,
  exactPrintingPriceChoicesV15,
} from './exact-printing-budget-v15.js';

function card(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: 'card-1',
    oracle_id: 'oracle-1',
    name: 'Budget Test Card',
    lang: 'en',
    cmc: 2,
    type_line: 'Artifact',
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: 'https://scryfall.com/card/tst/1/test',
    finishes: ['nonfoil', 'foil'],
    prices: { usd: '12.00', usd_foil: '4.50', usd_etched: null },
    ...overrides,
  };
}

test('exact printing price choices keep finish identity and sort cheapest first', () => {
  assert.deepEqual(exactPrintingPriceChoicesV15(card()), [
    { finish: 'foil', priceUsd: 4.5 },
    { finish: 'nonfoil', priceUsd: 12 },
  ]);
});

test('hard per-card cap accepts an exact printing only with a priced finish at or below the cap', () => {
  const witness = exactPrintingBudgetWitnessV15(card(), 5);
  assert.equal(witness.status, 'within-cap');
  assert.equal(witness.finish, 'foil');
  assert.equal(witness.priceUsd, 4.5);
});

test('requested finish is audited instead of silently substituting a cheaper finish', () => {
  const witness = exactPrintingBudgetWitnessV15(card(), 5, 'nonfoil');
  assert.equal(witness.status, 'over-cap');
  assert.equal(witness.finish, 'nonfoil');
  assert.equal(witness.priceUsd, 12);
});

test('a price field for a finish the exact printing does not declare is not usable evidence', () => {
  const onlyNonfoil = card({ finishes: ['nonfoil'], prices: { usd: '12.00', usd_foil: '1.00' } });
  assert.deepEqual(exactPrintingPriceChoicesV15(onlyNonfoil), [{ finish: 'nonfoil', priceUsd: 12 }]);
  assert.equal(exactPrintingBudgetWitnessV15(onlyNonfoil, 5).status, 'over-cap');
  assert.equal(exactPrintingBudgetWitnessV15(onlyNonfoil, 5, 'foil').status, 'finish-unavailable');
});

test('missing price evidence fails closed rather than being treated as zero dollars', () => {
  const unpriced = card({ prices: { usd: null, usd_foil: null, usd_etched: null } });
  const witness = exactPrintingBudgetWitnessV15(unpriced, 20);
  assert.equal(witness.status, 'price-unavailable');
  assert.equal(witness.priceUsd, null);
});

test('post-build budget audit respects the exact deck finish marker', () => {
  const parsed = parseDecklist('// COMMANDER\n1 Budget Test Card (TST) 1 *F*');
  const audit = auditExactPerCardBudgetV15(parsed, [card()], 5);
  assert.equal(audit.status, 'compliant');
  assert.equal(audit.satisfied, true);
  assert.equal(audit.auditedEntries[0]?.finish, 'foil');
  assert.equal(audit.auditedEntries[0]?.priceUsd, 4.5);
});

test('post-build budget audit reports exact over-cap, unavailable-finish, unknown-price and unresolved failures', () => {
  const nonfoilParsed = parseDecklist('// COMMANDER\n1 Budget Test Card (TST) 1 *N*');
  assert.equal(auditExactPerCardBudgetV15(nonfoilParsed, [card()], 5).status, 'over-cap');

  const foilUnavailable = card({ finishes: ['nonfoil'], prices: { usd: '1.00', usd_foil: '0.50' } });
  const foilParsed = parseDecklist('// COMMANDER\n1 Budget Test Card (TST) 1 *F*');
  assert.equal(auditExactPerCardBudgetV15(foilParsed, [foilUnavailable], 5).status, 'finish-unavailable');

  const unpriced = card({ prices: { usd: null, usd_foil: null, usd_etched: null } });
  assert.equal(auditExactPerCardBudgetV15(nonfoilParsed, [unpriced], 5).status, 'price-unavailable');

  assert.equal(auditExactPerCardBudgetV15(nonfoilParsed, [], 5).status, 'unresolved');
});

test('invalid hard caps are rejected deterministically', () => {
  assert.throws(() => exactPrintingBudgetWitnessV15(card(), 0), /positive and finite/i);
  assert.throws(() => exactPrintingBudgetWitnessV15(card(), Number.NaN), /positive and finite/i);
});
