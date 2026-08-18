import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard, ScryfallList } from '../types/scryfall.js';
import type { ResolvedPrintingPolicyV08 } from './printing-policy-v08.js';
import { selectBudgetEligiblePrintingV15 } from './budget-printing-selector-v15.js';

function card(name: string, set: string, collector: string, price: string | null, releasedAt: string): ScryfallCard {
  return {
    id: `${set}-${collector}`,
    oracle_id: 'oracle-basic',
    name,
    lang: 'en',
    cmc: 0,
    type_line: 'Basic Land — Island',
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    games: ['paper'],
    digital: false,
    set,
    set_name: set.toUpperCase(),
    collector_number: collector,
    rarity: 'common',
    finishes: ['nonfoil'],
    prices: { usd: price, usd_foil: null, usd_etched: null },
    released_at: releasedAt,
    scryfall_uri: `https://scryfall.com/card/${set}/${collector}`,
  };
}

function unrestrictedPolicy(): ResolvedPrintingPolicyV08 {
  return {
    family: null,
    familyPreset: null,
    allowedSetCodes: [],
    familyMatchedSetCodes: [],
    includePromos: true,
    includeSpecialReleases: true,
    exactSpecialPrintings: [],
    specialOracleNames: [],
    searchClause: '',
    explanation: 'Unrestricted.',
  };
}

test('budget selector exhausts physical-printing pages and can find a cheap older basic beyond the first page', async () => {
  const page2 = 'https://api.scryfall.com/cards/search?page=2';
  const seen: string[] = [];
  const requestPage = async (url: string): Promise<ScryfallList<ScryfallCard>> => {
    seen.push(url);
    if (seen.length === 1) {
      return {
        object: 'list',
        total_cards: 3,
        has_more: true,
        next_page: page2,
        data: [
          card('Island', 'new1', '1', null, '2026-01-01'),
          card('Island', 'new2', '2', '12.00', '2025-01-01'),
        ],
      };
    }
    return {
      object: 'list',
      total_cards: 3,
      has_more: false,
      data: [card('Island', 'old', '3', '0.20', '2015-01-01')],
    };
  };
  const oracle = card('Island', 'oracle', '0', null, '2026-01-01');
  const selected = await selectBudgetEligiblePrintingV15(oracle, unrestrictedPolicy(), 5, {
    maxPrintings: 10,
    maxPages: 3,
    minRequestGapMs: 0,
    requestPage,
  });
  assert.equal(seen.length, 2);
  assert.match(seen[0] ?? '', /unique=prints/);
  assert.equal(selected?.card.set, 'old');
  assert.equal(selected?.finish, 'nonfoil');
  assert.equal(selected?.priceUsd, 0.2);
});

test('budget selector fails closed when exhaustive physical printings have no priced finish under the cap', async () => {
  const requestPage = async (): Promise<ScryfallList<ScryfallCard>> => ({
    object: 'list',
    total_cards: 2,
    has_more: false,
    data: [
      card('Island', 'a', '1', null, '2026-01-01'),
      card('Island', 'b', '2', '12.00', '2025-01-01'),
    ],
  });
  const selected = await selectBudgetEligiblePrintingV15(
    card('Island', 'oracle', '0', null, '2026-01-01'),
    unrestrictedPolicy(),
    5,
    { minRequestGapMs: 0, requestPage },
  );
  assert.equal(selected, null);
});
