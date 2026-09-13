import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { boundedScryfallSearchV15 } from './scryfall-paged-search-v15.js';
import { clearRetainedScryfallCardDataV15, getCardPrintings, getCardsByIdentifiers, installRetainedScryfallCardDataV15, searchCards } from './scryfall.js';
import { assertRetainedScryfallReplayCompleteV15, retainedScryfallDiagnosticsV15 } from './retained-scryfall-provider-v15.js';

// Synthetic grammar/control fixtures only. These are not retained provider or deck-quality evidence.
const card = (name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard => ({
  id: name, oracle_id: name, name, lang: 'en', set: 'aaa', set_name: 'Test', collector_number: name,
  type_line: 'Instant', oracle_text: 'Draw a card.', cmc: 2, color_identity: ['U'], keywords: [],
  legalities: { commander: 'legal' }, rarity: 'common', scryfall_uri: 'https://scryfall.com',
  games: ['paper'], released_at: '2025-01-01', ...overrides,
});
async function withCards(cards: ScryfallCard[], run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Unexpected live network escape'); };
  installRetainedScryfallCardDataV15(cards);
  try { await run(); } finally { clearRetainedScryfallCardDataV15(); globalThis.fetch = original; }
}

test('retained search preserves grouping, negation, quoted parentheses, exact names and hard filters', async () => {
  await withCards([
    card('Allowed (One)', { oracle_text: 'Draw a card. (Reminder words.)' }),
    card('Allowed Two', { set: 'bbb' }),
    card('Wrong identity', { set: 'bbb', color_identity: ['R'] }),
    card('Wrong legality', { legalities: { commander: 'banned' } }),
    card('Wrong set', { set: 'ccc' }),
    card('Wrong game', { games: ['arena'] }),
  ], async () => {
    const query = '(set:aaa OR set:bbb) f:commander id<=wu game:paper (o:draw OR o:counter)';
    assert.deepEqual((await searchCards(query)).map(c => c.name), ['Allowed (One)', 'Allowed Two']);
    assert.deepEqual((await searchCards(`${query} -(set:bbb OR o:counter) o:"(Reminder words.)"`)).map(c => c.name), ['Allowed (One)']);
    assert.deepEqual((await searchCards('!"Allowed (One)"')).map(c => c.name), ['Allowed (One)']);
    assert.deepEqual(await searchCards('Reminder'), [], 'bare words search names, not Oracle text');
  });
});

test('retained shared HTTP boundary serves exhaustive pagination and deduplicates after filtering', async () => {
  const cards = Array.from({ length: 181 }, (_, i) => card(`Card ${String(i).padStart(3, '0')}`, { edhrec_rank: i }));
  await withCards([...cards, ...cards.map(c => ({ ...c, id: `${c.id}-other`, set: 'bbb' }))], async () => {
    const all = await boundedScryfallSearchV15('f:commander game:paper id<=u', { maxCards: 500, minRequestGapMs: 0 });
    assert.equal(all.cards.length, 181);
    assert.equal(all.pagesFetched, 2);
    const prints = await boundedScryfallSearchV15('(set:aaa OR set:bbb) f:commander', { maxCards: 500, unique: 'prints', minRequestGapMs: 0 });
    assert.equal(prints.cards.length, 362);
    assert.equal((await searchCards('set:bbb', 50)).length, 50);
    const requests = retainedScryfallDiagnosticsV15().queryEvaluations;
    await searchCards('set:bbb', 50);
    assert.equal(retainedScryfallDiagnosticsV15().queryEvaluations, requests, 'repeat searches reuse compiled results');
    assertRetainedScryfallReplayCompleteV15();
  });
});

test('retained lookup and print ordering are independent of input order; phyrexian means mana symbols', async () => {
  const old = card('Engine', { id: 'old', mana_cost: '{U/P}', released_at: '2020-01-01' });
  const newer = { ...old, id: 'new', set: 'bbb', released_at: '2025-01-01' };
  await withCards([old, newer, card('Phyrexian in name only')], async () => {
    assert.deepEqual((await getCardPrintings('Engine')).map(c => c.id), ['new', 'old']);
    assert.equal((await getCardsByIdentifiers([{ name: 'Engine', set: 'aaa', collectorNumber: 'Engine' }])).cards[0]?.id, 'old');
    assert.deepEqual((await searchCards('is:phyrexian')).map(c => c.name), ['Engine']);
    assert.equal((await searchCards('id=u')).length, 2);
    assert.equal((await searchCards('id>w')).length, 0);
  });
});

test('unsupported replay queries fail closed even if a product caller catches the error', async () => {
  await withCards([card('One')], async () => {
    await assert.rejects(searchCards('unknown:value'), /Unsupported/);
    await assert.rejects(searchCards('(set:aaa OR)'), /malformed/);
    await assert.rejects(searchCards('o:"unterminated'), /malformed/);
    assert.throws(assertRetainedScryfallReplayCompleteV15, /incomplete/);
  });
});
