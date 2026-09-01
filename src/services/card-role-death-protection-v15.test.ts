import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  inferCardRoles,
  normalizeScryfallSearchQueryV15,
  PROTECTION_SEARCH_CLAUSE_V15,
} from './scryfall.js';

function card(name: string, oracleText: string): ScryfallCard {
  return {
    id: name,
    name,
    lang: 'en',
    cmc: 1,
    type_line: 'Instant',
    oracle_text: oracleText,
    color_identity: ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'common',
    prices: { usd: '0.10' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('temporary dies-and-return shields count as protection rather than generic recursion alone', () => {
  const malakirLike = card(
    'Temporary Death Shield',
    'Choose target creature. You lose 2 life. Until end of turn, that creature gains “When this creature dies, return it to the battlefield tapped under its owner’s control.”',
  );
  const roles = new Set(inferCardRoles(malakirLike));
  assert.equal(roles.has('protection'), true);
  assert.equal(roles.has('graveyard recursion'), true);
});

test('ordinary reanimation is not mislabeled as protection', () => {
  const riseAgainLike = card('Ordinary Reanimation', 'Return target creature card from your graveyard to the battlefield.');
  const roles = new Set(inferCardRoles(riseAgainLike));
  assert.equal(roles.has('graveyard recursion'), true);
  assert.equal(roles.has('protection'), false);
});

test('regeneration and enchanted death-return shields count as protection', () => {
  const regenerate = card('Regenerate', 'Regenerate target creature.');
  assert.equal(new Set(inferCardRoles(regenerate)).has('protection'), true);

  const aura = {
    ...card('Protective Aura', 'When enchanted creature dies, return that card to the battlefield under your control.'),
    type_line: 'Enchantment — Aura',
  } satisfies ScryfallCard;
  assert.equal(new Set(inferCardRoles(aura)).has('protection'), true);
});

test('legacy protection searches expand to black-style death protection at the shared Scryfall boundary', () => {
  const legacy = 'f:commander id<=b (o:"hexproof" OR o:"indestructible" OR o:"protection from" OR o:"phase out")';
  const normalized = normalizeScryfallSearchQueryV15(legacy);
  assert.ok(normalized.includes(PROTECTION_SEARCH_CLAUSE_V15));
  assert.match(normalized, /when this creature dies/i);
  assert.match(normalized, /dies this turn/i);
  assert.match(normalized, /regenerate target/i);
});
