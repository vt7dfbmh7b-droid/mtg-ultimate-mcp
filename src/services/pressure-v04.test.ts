import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { simulatePodPressureV04 } from './pressure-v04.js';

let collector = 1;
function card(name: string, cmc: number, typeLine: string, oracleText = '', manaCost = '', colorIdentity: string[] = []): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    mana_cost: manaCost,
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: colorIdentity,
    keywords: [],
    legalities: { commander: 'legal' },
    produced_mana: /Plains/.test(typeLine) ? ['W'] : /Island/.test(typeLine) ? ['U'] : undefined,
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'common',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

const cards = [
  card('Test Commander', 3, 'Legendary Creature — Human', 'Whenever you attack, draw a card.', '{1}{W}{U}', ['W', 'U']),
  card('Plains', 0, 'Basic Land — Plains', '{T}: Add {W}.', '', ['W']),
  card('Island', 0, 'Basic Land — Island', '{T}: Add {U}.', '', ['U']),
  card('Signet', 2, 'Artifact', '{T}: Add {W}{U}.', '{2}', []),
  card('Protection', 1, 'Instant', 'Target creature gains hexproof until end of turn.', '{W}', ['W']),
  card('Combo A', 1, 'Artifact', '', '{1}', []),
  card('Combo B', 2, 'Artifact', '', '{2}', []),
  card('Filler', 2, 'Creature — Human', '', '{1}{U}', ['U']),
];

const parsed = parseDecklist(`
// COMMANDER
1 Test Commander
// MAIN
20 Plains
20 Island
8 Signet
8 Protection
1 Combo A
1 Combo B
40 Filler
`);

test('pod pressure simulation is deterministic for a fixed seed', () => {
  const options = { iterations: 300, turns: 7, seed: 777, podProfile: 'upgraded' as const, comboPieces: [['Combo A', 'Combo B']] };
  const first = simulatePodPressureV04(parsed, cards, options);
  const second = simulatePodPressureV04(parsed, cards, options);
  assert.deepEqual(first, second);
});

test('goldfish profile does not remove commanders', () => {
  const result = simulatePodPressureV04(parsed, cards, { iterations: 300, turns: 7, seed: 99, podProfile: 'goldfish' });
  const commanders = result.commanders as Array<Record<string, number>>;
  assert.equal(commanders[0]?.removedAtLeastOnceProxy, 0);
  assert.equal(commanders[0]?.averageRemovalEvents, 0);
});
