import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard, ScryfallList } from '../types/scryfall.js';
import {
  neutralUnrestrictedSearchUrlV15,
  neutralUnrestrictedStrataV15,
  sampleNeutralUnrestrictedStrataV15,
} from './neutral-unrestricted-pool-v15.js';

function card(name: string, index: number): ScryfallCard {
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
    prices: { usd: '0.10' },
    scryfall_uri: `https://scryfall.com/card/tst/${index + 1}`,
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
  const sampled = await sampleNeutralUnrestrictedStrataV15(strata, {
    maxCardsPerStratum: 10,
    minRequestGapMs: 0,
    requestSearch,
  });
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
    object: 'list',
    total_cards: 2,
    has_more: false,
    data: [card('Alpha', 1), card('Beta', 2)],
  });
  const sampled = await sampleNeutralUnrestrictedStrataV15([stratum], {
    maxCardsPerStratum: 20,
    minRequestGapMs: 0,
    requestSearch,
  });
  assert.equal(sampled.cards.length, 2);
  assert.equal(sampled.audit[0]?.exhaustive, true);
});
