import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { scoreCedhLandV14 } from './cedh-manabase-v14.js';

function land(
  name: string,
  oracleText: string,
  producedMana: string[],
  colorIdentity: string[] = [],
  edhrecRank?: number,
): ScryfallCard {
  return {
    id: name,
    name,
    lang: 'en',
    cmc: 0,
    type_line: 'Land',
    oracle_text: oracleText,
    color_identity: colorIdentity,
    produced_mana: producedMana,
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: name,
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
    ...(edhrecRank !== undefined ? { edhrec_rank: edhrecRank } : {}),
  };
}

const cityOfBrass = land(
  'City of Brass',
  '{T}: Add one mana of any color.\nWhenever City of Brass becomes tapped, it deals 1 damage to you.',
  ['W', 'U', 'B', 'R', 'G'],
  [],
  20,
);

const commandTower = land(
  'Command Tower',
  "{T}: Add one mana of any color in your commander's color identity.",
  ['W', 'U', 'B', 'R', 'G'],
  [],
  1,
);

const secludedCourtyard = land(
  'Secluded Courtyard',
  'As Secluded Courtyard enters, choose a creature type.\n{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast a creature spell of the chosen type or activate an ability of a creature or creature card of the chosen type.',
  ['W', 'U', 'B', 'R', 'G', 'C'],
  [],
  500,
);

const takenuma = land(
  'Takenuma, Abandoned Mire',
  '{T}: Add {B}.\nChannel — {3}{B}, Discard Takenuma, Abandoned Mire: Mill three cards, then return a creature or planeswalker card from your graveyard to your hand.',
  ['B'],
  ['B'],
  200,
);

const swampLike = land(
  'Untapped Black Land',
  '{T}: Add {B}.',
  ['B'],
  ['B'],
  500,
);

const ancientTombLike = land(
  'Two Mana Utility Land',
  '{T}: Add {C}{C}. Two Mana Utility Land deals 2 damage to you.',
  ['C'],
  [],
  100,
);

test('mono-color scoring does not award redundant any-color fixing above real utility', () => {
  const identity = ['B'];
  const city = scoreCedhLandV14(cityOfBrass, identity);
  const tower = scoreCedhLandV14(commandTower, identity);
  const utility = scoreCedhLandV14(takenuma, identity);

  assert.ok(utility.score > city.score + 18, 'real mono-black utility should materially outrank life-taxed any-color fixing');
  assert.ok(utility.score > tower.score, 'real utility should outrank redundant commander-identity fixing in mono-black');
  assert.ok(city.reasons.some((reason) => /no extra fixing value/i.test(reason)));
  assert.ok(city.reasons.some((reason) => /unnecessary life\/damage tax/i.test(reason)));
});

test('spending-restricted tribal fixing is penalized when a mono-color deck does not need the fixing', () => {
  const restricted = scoreCedhLandV14(secludedCourtyard, ['B']);
  const reliable = scoreCedhLandV14(swampLike, ['B']);

  assert.ok(reliable.score > restricted.score);
  assert.ok(restricted.reasons.some((reason) => /conditional or spending-restricted/i.test(reason)));
});

test('multicolor decks still receive meaningful value from any-color fixing', () => {
  const mono = scoreCedhLandV14(cityOfBrass, ['B']);
  const fiveColor = scoreCedhLandV14(cityOfBrass, ['W', 'U', 'B', 'R', 'G']);

  assert.ok(fiveColor.score > mono.score + 100, 'five-color fixing must remain strongly rewarded');
  assert.ok(fiveColor.reasons.includes('identity-scaled any-color fixing'));
});

test('generic two-mana land acceleration remains visible to the ranking model', () => {
  const accelerated = scoreCedhLandV14(ancientTombLike, ['B']);
  const ordinary = scoreCedhLandV14(swampLike, ['B']);

  assert.ok(accelerated.reasons.includes('two-mana land acceleration'));
  assert.ok(accelerated.score > 20, 'colorless acceleration should not disappear merely because it lacks colored coverage');
  assert.ok(ordinary.score > 0);
});
