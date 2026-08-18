import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { resolveNeutralThemeIntentV15 } from './neutral-theme-v15.js';
import { selectNeutralThemeSeedCandidatesV15 } from './neutral-themed-deck-builder-v15.js';

function card(
  name: string,
  oracleText: string,
  options: { cmc?: number; typeLine?: string; edhrecRank?: number; oracleId?: string } = {},
): ScryfallCard {
  return {
    object: 'card',
    id: `id-${name}`,
    oracle_id: options.oracleId ?? `oracle-${name}`,
    name,
    lang: 'en',
    released_at: '2026-01-01',
    uri: `https://api.scryfall.com/cards/id-${name}`,
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
    layout: 'normal',
    highres_image: true,
    image_status: 'highres_scan',
    mana_cost: '{1}{W}',
    cmc: options.cmc ?? 2,
    type_line: options.typeLine ?? 'Creature — Warrior',
    oracle_text: oracleText,
    colors: ['W'],
    color_identity: ['W'],
    keywords: [],
    legalities: { commander: 'legal' } as ScryfallCard['legalities'],
    games: ['paper'],
    reserved: false,
    foil: false,
    nonfoil: true,
    finishes: ['nonfoil'],
    oversized: false,
    promo: false,
    reprint: false,
    variation: false,
    set_id: 'set-test',
    set: 'tst',
    set_name: 'Test',
    set_type: 'expansion',
    set_uri: 'https://api.scryfall.com/sets/test',
    set_search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Atst&unique=prints',
    scryfall_set_uri: 'https://scryfall.com/sets/tst',
    rulings_uri: `https://api.scryfall.com/cards/id-${name}/rulings`,
    prints_search_uri: `https://api.scryfall.com/cards/search?order=released&q=oracleid%3Aoracle-${name}&unique=prints`,
    collector_number: '1',
    digital: false,
    rarity: 'rare',
    flavor_text: '',
    card_back_id: 'back',
    artist: 'Test Artist',
    artist_ids: [],
    illustration_id: 'illustration',
    border_color: 'black',
    frame: '2015',
    full_art: false,
    textless: false,
    booster: true,
    story_spotlight: false,
    edhrec_rank: options.edhrecRank,
    prices: { usd: '1.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    related_uris: {},
    purchase_uris: {},
  } as ScryfallCard;
}

test('theme seed selection keeps only matching nonland cards and respects exclusions/protected cards', async () => {
  const intent = await resolveNeutralThemeIntentV15('tokens');
  const cards = [
    card('Token Maker', 'Create two 1/1 Soldier creature tokens.'),
    card('Protected Token Maker', 'Create a 1/1 Soldier creature token.'),
    card('Excluded Token Maker', 'Create a Treasure token.'),
    card('Plain Warrior', 'Vigilance'),
    card('Token Land', 'Create a Treasure token.', { typeLine: 'Land' }),
  ];
  const selected = selectNeutralThemeSeedCandidatesV15(cards, intent, {
    archetype: 'combat-tokens',
    needed: 5,
    protectedNames: ['Protected Token Maker'],
    excludedNames: ['Excluded Token Maker'],
  });
  assert.deepEqual(selected.map((entry) => entry.name), ['Token Maker']);
});

test('theme seed ranking ignores EDHREC rank and prefers actual archetype/role utility', async () => {
  const intent = await resolveNeutralThemeIntentV15('tokens');
  const popularButWeak = card('Popular Vanilla Token Card', 'Create a 1/1 creature token.', { cmc: 6, edhrecRank: 1 });
  const usefulButUnpopular = card('Useful Token Engine', 'Create a 1/1 creature token. Draw two cards.', { cmc: 2, edhrecRank: 999999 });
  const selected = selectNeutralThemeSeedCandidatesV15([popularButWeak, usefulButUnpopular], intent, {
    archetype: 'combat-tokens',
    needed: 1,
  });
  assert.equal(selected[0]?.name, 'Useful Token Engine');
});

test('theme seed selection deduplicates Oracle identities before enforcing density', async () => {
  const intent = await resolveNeutralThemeIntentV15('tokens');
  const firstPrinting = card('Same Token Card', 'Create a 1/1 creature token.', { oracleId: 'shared-oracle' });
  const firstPrices = firstPrinting.prices;
  assert.ok(firstPrices, 'test fixture must expose prices');
  firstPrices.usd = '2.00';

  const cheaperPrinting = card('Same Token Card', 'Create a 1/1 creature token.', { oracleId: 'shared-oracle' });
  cheaperPrinting.id = 'second-printing';
  const cheaperPrices = cheaperPrinting.prices;
  assert.ok(cheaperPrices, 'test fixture must expose prices');
  cheaperPrices.usd = '0.50';

  const selected = selectNeutralThemeSeedCandidatesV15([firstPrinting, cheaperPrinting], intent, {
    archetype: 'combat-tokens',
    needed: 2,
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.id, 'second-printing');
});
