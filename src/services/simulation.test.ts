import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildDeckMetrics, parseDecklist } from './deck.js';
import { simulateDeckConsistency } from './simulation.js';

function card(
  name: string,
  cmc: number,
  typeLine: string,
  oracleText = '',
  manaCost = '',
): ScryfallCard {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    lang: 'en',
    mana_cost: manaCost,
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'common',
    prices: { usd: '1.00' },
    scryfall_uri: `https://scryfall.com/card/tst/1/${name.toLowerCase().replace(/\s+/g, '-')}`,
  };
}

const cards = [
  card('Test Commander', 4, 'Legendary Creature — Human', 'Whenever you attack, draw a card.', '{2}{W}{U}'),
  card('Plains', 0, 'Basic Land — Plains', '{T}: Add {W}.'),
  card('Island', 0, 'Basic Land — Island', '{T}: Add {U}.'),
  card('Sol Ring', 1, 'Artifact', '{T}: Add {C}{C}.', '{1}'),
  card('Cheap Draw', 1, 'Instant', 'Draw a card.', '{U}'),
  card('Cheap Counter', 2, 'Instant', 'Counter target spell.', '{U}{U}'),
  card('Filler', 3, 'Creature — Bear', '', '{2}{G}'),
];

const parsed = parseDecklist(`
// COMMANDER
1 Test Commander
// MAIN
18 Plains
18 Island
8 Sol Ring
8 Cheap Draw
8 Cheap Counter
39 Filler
`);

test('buildDeckMetrics exposes curve, colored pips, and strategic density', () => {
  const metrics = buildDeckMetrics(parsed, cards);
  assert.equal(metrics.landCount, 36);
  assert.equal(metrics.fastManaCount, 8);
  assert.equal(metrics.drawCount >= 8, true);
  assert.equal(metrics.interactionCount >= 8, true);
  assert.equal(metrics.manaCurve['1'], 16);
  assert.equal(metrics.coloredPips.U > 0, true);
});

test('simulateDeckConsistency is deterministic for a fixed seed', () => {
  const first = simulateDeckConsistency(parsed, cards, {
    iterations: 250,
    turns: 5,
    seed: 42,
    maxMulligans: 2,
    comboPieces: [['Cheap Draw', 'Cheap Counter']],
  });
  const second = simulateDeckConsistency(parsed, cards, {
    iterations: 250,
    turns: 5,
    seed: 42,
    maxMulligans: 2,
    comboPieces: [['Cheap Draw', 'Cheap Counter']],
  });
  assert.deepEqual(first, second);
  const openingHands = first.openingHands as Record<string, number>;
  assert.equal(openingHands.functionalKeepRate > 0, true);
});
