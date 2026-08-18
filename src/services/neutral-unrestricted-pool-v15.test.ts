import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard, ScryfallList } from '../types/scryfall.js';
import type { ResolvedPrintingPolicyV08 } from './printing-policy-v08.js';
import {
  discoverNeutralUnrestrictedPoolV15,
  neutralUnrestrictedSearchUrlV15,
  neutralUnrestrictedStrataV15,
  sampleNeutralUnrestrictedStrataV15,
} from './neutral-unrestricted-pool-v15.js';

function card(name: string, index: number, overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: `id-${index}`,
    oracle_id: `oracle-${index}`,
    name,
    lang: 'en',
    cmc: 2,
    type_line: 'Creature — Test',
    oracle_text: 'Draw a card.',
    colors: ['R'],
    color_identity: ['R'],
    keywords: [],
    legalities: { commander: 'legal' },
    games: ['paper'],
    digital: false,
    promo: false,
    nonfoil: true,
    foil: true,
    finishes: ['nonfoil', 'foil'],
    set: 'tst',
    set_name: 'Test Set',
    collector_number: String(index + 1),
    rarity: 'common',
    prices: { usd: '0.10', usd_foil: null, usd_etched: null },
    scryfall_uri: `https://scryfall.com/card/tst/${index + 1}`,
    ...overrides,
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
    explanation: 'No themed printing-family restriction is active.',
  };
}

test('neutral unrestricted strata are deterministic, stratified, and never EDHREC ordered', () => {
  const strata = neutralUnrestrictedStrataV15(['R'], 'combat-tokens', false);
  assert.equal(strata.length, 15);
  assert.deepEqual(strata, neutralUnrestrictedStrataV15(['R'], 'combat-tokens', false));
  assert.deepEqual([...new Set(strata.map((item) => item.family))].sort(), ['archetype', 'early', 'lands', 'late', 'mid']);
  assert.ok(strata.every((item) => item.query.includes('f:commander game:paper id<=r')));
  assert.ok(strata.every((item) => item.query.includes('-is:promo')));
  assert.ok(strata.some((item) => item.family === 'archetype' && item.query.includes('o:token')));
  assert.ok(strata.some((item) => item.order === 'name' && item.direction === 'asc'));
  assert.ok(strata.some((item) => item.order === 'released' && item.direction === 'asc'));
  assert.ok(strata.some((item) => item.order === 'released' && item.direction === 'desc'));
  for (const stratum of strata) {
    const url = neutralUnrestrictedSearchUrlV15(stratum);
    assert.equal(/order=edhrec/i.test(url), false);
    assert.equal(/edhrec/i.test(stratum.query), false);
  }
});

test('colorless unrestricted strata use explicit Scryfall colorless identity syntax', () => {
  const strata = neutralUnrestrictedStrataV15([], 'big-mana');
  assert.equal(strata.length, 15);
  assert.ok(strata.every((item) => item.query.includes('f:commander game:paper id:c')));
  assert.ok(strata.every((item) => !item.query.includes('id<=c')));
});

test('sampling is explicitly bounded and reports non-exhaustive strata instead of pretending full discovery', async () => {
  const strata = neutralUnrestrictedStrataV15(['R'], 'combat-tokens').slice(0, 2);
  const providerCards = Array.from({ length: 12 }, (_, index) => card(`Card ${index}`, index));
  const requested: string[] = [];
  const requestSearch = async (url: string): Promise<ScryfallList<ScryfallCard>> => {
    requested.push(url);
    return {
      object: 'list',
      total_cards: 500,
      has_more: true,
      next_page: 'https://api.scryfall.com/cards/search?page=2',
      data: providerCards,
    };
  };
  const sampled = await sampleNeutralUnrestrictedStrataV15(strata, { maxCardsPerStratum: 10, minRequestGapMs: 0, requestSearch });
  assert.equal(requested.length, 2);
  assert.equal(sampled.cards.length, 20);
  assert.equal(sampled.audit.length, 2);
  assert.ok(sampled.audit.every((item) => item.sampledCards === 10));
  assert.ok(sampled.audit.every((item) => item.providerPageCards === 12));
  assert.ok(sampled.audit.every((item) => item.providerTotalCards === 500));
  assert.ok(sampled.audit.every((item) => item.exhaustive === false));
});

test('sampling can truthfully report an exhaustive small stratum', async () => {
  const [stratum] = neutralUnrestrictedStrataV15(['R'], 'big-mana');
  assert.ok(stratum);
  const requestSearch = async (): Promise<ScryfallList<ScryfallCard>> => ({
    object: 'list', total_cards: 2, has_more: false, data: [card('Alpha', 1), card('Beta', 2)],
  });
  const sampled = await sampleNeutralUnrestrictedStrataV15([stratum], { maxCardsPerStratum: 20, minRequestGapMs: 0, requestSearch });
  assert.equal(sampled.cards.length, 2);
  assert.equal(sampled.audit[0]?.exhaustive, true);
});

test('budgeted unrestricted discovery admits only sampled exact printings with a verified finish under cap', async () => {
  const cheap = card('Cheap', 1, { prices: { usd: '2.00', usd_foil: '1.50' } });
  const expensive = card('Expensive', 2, { prices: { usd: '12.00', usd_foil: '9.00' } });
  const unknown = card('Unknown', 3, { prices: { usd: null, usd_foil: null, usd_etched: null } });
  const requestSearch = async (): Promise<ScryfallList<ScryfallCard>> => ({
    object: 'list', total_cards: 3, has_more: false, data: [cheap, expensive, unknown],
  });
  const pool = await discoverNeutralUnrestrictedPoolV15(['r'], 'combat-tokens', unrestrictedPolicy(), {
    maxUsdPerCard: 5,
    minEligibleNonlands: 1,
    minEligibleLands: 0,
    maxCardsPerStratum: 10,
    minRequestGapMs: 0,
    requestSearch,
    basicCards: [],
  });
  assert.deepEqual(pool.cards.map((entry) => entry.name), ['Cheap']);
  assert.equal(pool.provenance.budgetCapUsd, 5);
  assert.equal(pool.provenance.budgetFilterMode, 'exact-sampled-printing');
  assert.ok(pool.provenance.budgetRejectedOverCap > 0);
  assert.ok(pool.provenance.budgetRejectedUnknownPrice > 0);
  assert.equal(pool.provenance.popularityOrdered, false);
  assert.equal(pool.provenance.edhrecOrdered, false);
});

test('budgeted unrestricted discovery fails closed when filtering leaves too few candidates', async () => {
  const expensive = card('Expensive', 2, { prices: { usd: '12.00' } });
  const requestSearch = async (): Promise<ScryfallList<ScryfallCard>> => ({ object: 'list', total_cards: 1, has_more: false, data: [expensive] });
  await assert.rejects(
    discoverNeutralUnrestrictedPoolV15(['R'], 'combat-tokens', unrestrictedPolicy(), {
      maxUsdPerCard: 5,
      minEligibleNonlands: 1,
      minEligibleLands: 0,
      maxCardsPerStratum: 10,
      minRequestGapMs: 0,
      requestSearch,
      basicCards: [],
    }),
    /insufficient eligible candidates.*US\$5/i,
  );
});
