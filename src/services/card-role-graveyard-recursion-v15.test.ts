import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { effectiveCardRolesV15 } from './card-role-truth-v15.js';

function card(name: string, oracleText: string): ScryfallCard {
  return {
    id: name,
    name,
    lang: 'en',
    cmc: 1,
    type_line: 'Artifact',
    oracle_text: oracleText,
    color_identity: [],
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

test('moving an exiled card back into a graveyard is graveyard utility, not recursion', () => {
  const converterLike = card(
    'Converter-like Artifact',
    'Whenever you discard a card, you may exile that card from your graveyard. {2}, {T}: Draw a card, then discard a card. {T}: Put a card exiled with Converter-like Artifact into your graveyard. If it is a land card, create a Treasure token. Otherwise, create a 2/2 black Rogue creature token.',
  );
  const roles = new Set(effectiveCardRolesV15(converterLike));
  assert.equal(roles.has('graveyard recursion'), false);
  assert.equal(roles.has('graveyard utility'), true);
});

test('returning a card from the graveyard to hand remains recursion', () => {
  const reclamationLike = card(
    'Reclamation-like Enchantment',
    '{1}{B}, Pay 2 life: Return target creature card from your graveyard to your hand.',
  );
  assert.equal(new Set(effectiveCardRolesV15(reclamationLike)).has('graveyard recursion'), true);
});

test('returning a recursive creature from the graveyard to the battlefield remains recursion', () => {
  const skeletonLike = card(
    'Skeleton-like Creature',
    '{1}{B}: Return Skeleton-like Creature from your graveyard to the battlefield tapped.',
  );
  assert.equal(new Set(effectiveCardRolesV15(skeletonLike)).has('graveyard recursion'), true);
});
