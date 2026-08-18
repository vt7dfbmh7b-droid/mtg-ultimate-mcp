import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard, ScryfallList } from '../types/scryfall.js';
import { boundedScryfallSearchV15 } from './scryfall-paged-search-v15.js';

function card(name: string): ScryfallCard {
  return {
    id: `id-${name}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    cmc: 3,
    type_line: 'Legendary Creature — Test',
    oracle_text: '',
    color_identity: ['U'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: name,
    rarity: 'rare',
    scryfall_uri: `https://scryfall.com/card/tst/${name}`,
  };
}

function page(data: ScryfallCard[], hasMore: boolean, nextPage?: string, totalCards = data.length): ScryfallList<ScryfallCard> {
  return {
    object: 'list',
    total_cards: totalCards,
    has_more: hasMore,
    ...(nextPage ? { next_page: nextPage } : {}),
    data,
  };
}

test('bounded discovery follows every page and preserves provider order until exhaustion', async () => {
  const seen: string[] = [];
  const second = 'https://api.scryfall.com/cards/search?page=2';
  const result = await boundedScryfallSearchV15('is:commander set:tst', {
    maxCards: 10,
    maxPages: 3,
    requestPage: async (url) => {
      seen.push(url);
      if (seen.length === 1) return page([card('A'), card('B')], true, second, 3);
      return page([card('C')], false, undefined, 3);
    },
  });

  assert.equal(result.exhaustiveWithinBounds, true);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.providerTotalCards, 3);
  assert.equal(result.unique, 'cards');
  assert.deepEqual(result.cards.map((entry) => entry.name), ['A', 'B', 'C']);
  assert.equal(seen.length, 2);
});

test('bounded discovery can explicitly exhaust physical printings instead of Oracle-card representatives', async () => {
  let firstUrl = '';
  const result = await boundedScryfallSearchV15('!"Island" game:paper', {
    unique: 'prints',
    maxCards: 10,
    requestPage: async (url) => {
      firstUrl = url;
      return page([card('Island')], false);
    },
  });
  assert.equal(result.unique, 'prints');
  assert.match(firstUrl, /unique=prints/);
});

test('bounded discovery refuses silent card truncation', async () => {
  await assert.rejects(
    boundedScryfallSearchV15('is:commander set:tst', {
      maxCards: 2,
      maxPages: 3,
      requestPage: async () => page([card('A'), card('B'), card('C')], false, undefined, 3),
    }),
    /2-card safety ceiling/i,
  );
});

test('bounded discovery refuses a page-count truncation before provider exhaustion', async () => {
  await assert.rejects(
    boundedScryfallSearchV15('is:commander set:tst', {
      maxCards: 20,
      maxPages: 1,
      requestPage: async () => page([card('A')], true, 'https://api.scryfall.com/cards/search?page=2', 2),
    }),
    /1-page safety ceiling/i,
  );
});

test('bounded discovery rejects malformed pagination and foreign next-page URLs', async () => {
  await assert.rejects(
    boundedScryfallSearchV15('is:commander set:tst', {
      requestPage: async () => page([card('A')], true, undefined, 2),
    }),
    /without a next_page/i,
  );

  await assert.rejects(
    boundedScryfallSearchV15('is:commander set:tst', {
      requestPage: async () => page([card('A')], true, 'https://example.com/cards/search?page=2', 2),
    }),
    /outside the configured Scryfall API origin/i,
  );
});

test('bounded discovery rejects repeated next-page URLs instead of looping', async () => {
  const repeated = 'https://api.scryfall.com/cards/search?page=2';
  let calls = 0;
  await assert.rejects(
    boundedScryfallSearchV15('is:commander set:tst', {
      maxPages: 5,
      requestPage: async () => {
        calls += 1;
        return page([card(String(calls))], true, repeated, 5);
      },
    }),
    /repeated a page URL/i,
  );
  assert.equal(calls, 2);
});
