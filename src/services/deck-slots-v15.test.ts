import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { expandResolvedDeckSlotsV15 } from './deck-slots-v15.js';

function card(name: string, set: string, collectorNumber: string, typeLine: string): ScryfallCard {
  return {
    id: `${set}-${collectorNumber}`,
    name,
    lang: 'en',
    cmc: typeLine.includes('Land') ? 0 : 2,
    type_line: typeLine,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: set.toLowerCase(),
    set_name: set,
    collector_number: collectorNumber,
    rarity: 'common',
    scryfall_uri: `https://scryfall.com/card/${set.toLowerCase()}/${collectorNumber}`,
  };
}

test('physical slot expansion restores repeated basics after deduplicated resolution', () => {
  const parsed = parseDecklist(`
// COMMANDER
1 Test Commander (TST) 1
// MAIN
7 Forest (TST) 2
6 Island (TST) 3
1 Utility Spell (TST) 4
`);
  const resolved = [
    card('Test Commander', 'TST', '1', 'Legendary Creature'),
    card('Forest', 'TST', '2', 'Basic Land — Forest'),
    card('Island', 'TST', '3', 'Basic Land — Island'),
    card('Utility Spell', 'TST', '4', 'Instant'),
  ];

  const expanded = expandResolvedDeckSlotsV15(parsed, resolved);
  assert.equal(expanded.unresolved.length, 0);
  assert.equal(expanded.commanders.length, 1);
  assert.equal(expanded.main.length, 14);
  assert.equal(expanded.all.length, 15);
  assert.equal(expanded.main.filter((slot) => slot.card.name === 'Forest').length, 7);
  assert.equal(expanded.main.filter((slot) => slot.card.name === 'Island').length, 6);
  assert.deepEqual(expanded.main.filter((slot) => slot.card.name === 'Forest').map((slot) => slot.copy), [1, 2, 3, 4, 5, 6, 7]);
});

test('physical slot expansion exposes unresolved entries instead of silently shrinking the deck', () => {
  const parsed = parseDecklist('2 Forest (TST) 2\n1 Missing Card (TST) 9');
  const expanded = expandResolvedDeckSlotsV15(parsed, [card('Forest', 'TST', '2', 'Basic Land — Forest')]);

  assert.equal(expanded.main.length, 2);
  assert.equal(expanded.unresolved.length, 1);
  assert.equal(expanded.unresolved[0]?.entry.name, 'Missing Card');
});
