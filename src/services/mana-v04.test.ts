import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { analyzeManaBaseV04, classifyLandEntry } from './mana-v04.js';

let collector = 1;
function card(
  name: string,
  typeLine: string,
  colorIdentity: string[],
  oracleText = '',
  producedMana: string[] = [],
): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    cmc: 0,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: colorIdentity,
    keywords: [],
    legalities: { commander: 'legal' },
    produced_mana: producedMana,
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('classifies common land entry conditions', () => {
  const shock = card('Shock', 'Land — Swamp Mountain', ['B', 'R'], "As Shock enters, you may pay 2 life. If you don't, it enters tapped.", ['B', 'R']);
  const fast = card('Fast', 'Land', ['B', 'R'], 'Fast enters tapped unless you control two or fewer other lands.', ['B', 'R']);
  const slow = card('Slow', 'Land', ['B', 'R'], 'Slow enters tapped unless you control two or more other lands.', ['B', 'R']);
  assert.equal(classifyLandEntry(shock).mode, 'shock-choice');
  assert.equal(classifyLandEntry(fast).mode, 'fast-land');
  assert.equal(classifyLandEntry(slow).mode, 'slow-land');
});

test('fetch analysis counts only legal targets present in the resolved deck', () => {
  const commander = card('Rakdos Boss', 'Legendary Creature — Vampire', ['B', 'R']);
  const fetch = card('Blood Fetch', 'Land', [], '{T}, Pay 1 life, Sacrifice Blood Fetch: Search your library for a Swamp or Mountain card, put it onto the battlefield, then shuffle.');
  const swamp = card('Swamp', 'Basic Land — Swamp', ['B'], '{T}: Add {B}.', ['B']);
  const mountain = card('Mountain', 'Basic Land — Mountain', ['R'], '{T}: Add {R}.', ['R']);
  const island = card('Island', 'Basic Land — Island', ['U'], '{T}: Add {U}.', ['U']);
  const deck = parseDecklist(`
// COMMANDER
1 Rakdos Boss
// MAIN
1 Blood Fetch
20 Swamp
20 Mountain
20 Island
38 Blood Fetch
`);
  const result = analyzeManaBaseV04(deck, [commander, fetch, swamp, mountain, island]);
  const lands = result.lands as Array<Record<string, any>>;
  const fetchRow = lands.find((row) => row.name === 'Blood Fetch');
  const targetNames = new Set((fetchRow?.fetch?.targets ?? []).map((target: any) => target.name));
  assert.equal(targetNames.has('Swamp'), true);
  assert.equal(targetNames.has('Mountain'), true);
  assert.equal(targetNames.has('Island'), false);
});

test('commander identity mana source is restricted to combined commander identity', () => {
  const commander = card('Rakdos Boss', 'Legendary Creature — Vampire', ['B', 'R']);
  const tower = card('Command Tower', 'Land', [], "{T}: Add one mana of any color in your commander's color identity.", ['W', 'U', 'B', 'R', 'G']);
  const deck = parseDecklist(`
// COMMANDER
1 Rakdos Boss
// MAIN
99 Command Tower
`);
  const result = analyzeManaBaseV04(deck, [commander, tower]);
  const lands = result.lands as Array<Record<string, any>>;
  assert.deepEqual(lands[0]?.producedMana.sort(), ['B', 'R']);
});
