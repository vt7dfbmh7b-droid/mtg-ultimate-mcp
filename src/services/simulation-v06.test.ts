import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { simulateAdvancedGameplayV06 } from './simulation-v06.js';

let collector = 1;
function card(
  name: string,
  cmc: number,
  typeLine: string,
  oracleText = '',
  manaCost = '',
  colorIdentity: string[] = [],
  producedMana: string[] = [],
  keywords: string[] = [],
): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    mana_cost: manaCost,
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: colorIdentity,
    keywords,
    legalities: { commander: 'legal' },
    ...(producedMana.length > 0 ? { produced_mana: producedMana } : {}),
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'common',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

const cards = [
  card('Test Commander', 4, 'Legendary Creature — Warrior', '', '{3}{R}', ['R']),
  card('Mountain', 0, 'Basic Land — Mountain', '{T}: Add {R}.', '', ['R'], ['R']),
  card('Treasure Ritual', 2, 'Sorcery', 'Create two Treasure tokens.', '{1}{R}', ['R']),
  card('Evoke Thing', 7, 'Creature — Elemental', 'Evoke—{1}{R}', '{6}{R}', ['R'], [], ['Evoke']),
  card('Filler', 2, 'Creature — Warrior', '', '{1}{R}', ['R']),
];

const parsed = parseDecklist(`
// COMMANDER
1 Test Commander
// MAIN
40 Mountain
20 Treasure Ritual
20 Evoke Thing
19 Filler
`);

test('V0.6 advanced simulation is deterministic', () => {
  const options = { advancedIterations: 300, turns: 6, seed: 6060, pressure: 'goldfish' as const };
  const first = simulateAdvancedGameplayV06(parsed, cards, options);
  const second = simulateAdvancedGameplayV06(parsed, cards, options);
  assert.deepEqual(first, second);
});

test('V0.6 creates and spends Treasure inside simulated turns', () => {
  const result = simulateAdvancedGameplayV06(parsed, cards, {
    advancedIterations: 500,
    turns: 6,
    seed: 6061,
    pressure: 'goldfish',
  });
  const resources = result.resources as Record<string, unknown>;
  assert.equal(Number(resources.averageTreasuresCreated ?? 0) > 0, true);
  assert.equal(Number(resources.averageTreasuresSpent ?? 0) > 0, true);
});

test('V0.6 uses supported named alternative costs during turn sequencing', () => {
  const result = simulateAdvancedGameplayV06(parsed, cards, {
    advancedIterations: 500,
    turns: 6,
    seed: 6062,
    pressure: 'goldfish',
  });
  const advanced = result.advancedCasting as Record<string, unknown>;
  assert.equal(Number(advanced.averageAlternativeCostCasts ?? 0) > 0, true);
  const mechanics = advanced.averageMechanicUses as Record<string, number>;
  assert.equal(Number(mechanics['alternative:evoke'] ?? 0) > 0, true);
});
