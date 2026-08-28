import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { boundedComboSelectionAccessV15 } from './combo-selection-v15.js';

function card(name: string, typeLine: string, oracleText: string, cmc = 2): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    lang: 'en',
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: 'https://scryfall.com/',
  };
}

const ballista = card('Walking Ballista', 'Artifact Creature — Construct', '', 0);
const scales = card('Hardened Scales', 'Enchantment', '', 1);
const gatta = card('Gatta and Luzzu', 'Legendary Creature — Human Rebel', '', 2);
const earth = card('The Earth Crystal', 'Legendary Artifact', '', 2);

test('Dig Through Time bounded selection can reach every supplied combo card type', () => {
  const dig = card('Dig Through Time', 'Instant', 'Delve. Look at the top seven cards of your library. Put two of them into your hand and the rest on the bottom of your library in any order.', 8);
  for (const piece of [ballista, scales, gatta, earth]) {
    const access = boundedComboSelectionAccessV15(dig, piece);
    assert.equal(access.matched, true, piece.name);
    assert.equal(access.depth, 7);
    assert.equal(access.restriction, 'unrestricted');
  }
});

test('Commune-style artifact creature land selection reaches Ballista but not Hardened Scales', () => {
  const commune = card('Commune with Beavers', 'Sorcery', 'Look at the top three cards of your library. You may reveal an artifact, creature, or land card from among them and put it into your hand. Put the rest into your graveyard.', 1);
  assert.equal(boundedComboSelectionAccessV15(commune, ballista).matched, true);
  assert.equal(boundedComboSelectionAccessV15(commune, gatta).matched, true);
  assert.equal(boundedComboSelectionAccessV15(commune, earth).matched, true);
  assert.equal(boundedComboSelectionAccessV15(commune, scales).matched, false);
});

test('legendary-creature top-N selection does not masquerade as universal combo access', () => {
  const dagger = card('Search for Dagger', 'Enchantment', 'Whenever your commander enters or attacks, look at the top six cards of your library. You may reveal a legendary creature card from among them and put it into your hand. Put the rest on the bottom in a random order.', 2);
  assert.equal(boundedComboSelectionAccessV15(dagger, gatta).matched, true);
  assert.equal(boundedComboSelectionAccessV15(dagger, ballista).matched, false);
  assert.equal(boundedComboSelectionAccessV15(dagger, scales).matched, false);
  assert.equal(boundedComboSelectionAccessV15(dagger, earth).matched, false);
});
