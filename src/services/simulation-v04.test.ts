import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { parseDrawProfile, parseManaRestriction, parseTutorSpec, simulateDeckConsistencyV04 } from './simulation-v04.js';

let collector = 1;
function card(
  name: string,
  cmc: number,
  typeLine: string,
  oracleText = '',
  manaCost = '',
  colorIdentity: string[] = [],
  producedMana: string[] = [],
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
    keywords: [],
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

test('parses common restricted mana rules', () => {
  const commanderOnly = card('Commander Mana', 2, 'Artifact', '{T}: Add {R}. Spend this mana only to cast your commander.', '{2}', [], ['R']);
  const creatureOnly = card('Creature Mana', 1, 'Creature — Elf', '{T}: Add {G}. Spend this mana only to cast a creature spell.', '{G}', ['G'], ['G']);
  assert.equal(parseManaRestriction(commanderOnly).kind, 'commander');
  assert.equal(parseManaRestriction(creatureOnly).kind, 'creature');
});

test('parses tutor restrictions and destination', () => {
  const tutor = card('Creature Tutor', 2, 'Sorcery', 'Search your library for a creature card with mana value 3 or less, put that card into your hand, then shuffle.', '{1}{G}', ['G']);
  const spec = parseTutorSpec(tutor);
  assert.equal(spec.isTutor, true);
  assert.equal(spec.destination, 'hand');
  assert.deepEqual(spec.types, ['creature']);
  assert.equal(spec.maxManaValue, 3);
});

test('separates immediate draw from recurring draw engine text', () => {
  const cantrip = card('Cantrip', 1, 'Sorcery', 'Draw a card.', '{U}', ['U']);
  const arena = card('Arena', 3, 'Enchantment', 'At the beginning of your upkeep, draw a card and you lose 1 life.', '{1}{B}{B}', ['B']);
  assert.equal(parseDrawProfile(cantrip).immediate, 1);
  assert.equal(parseDrawProfile(cantrip).recurringPerTurn, 0);
  assert.equal(parseDrawProfile(arena).recurringPerTurn, 1);
});

const cards = [
  card('Test Commander', 3, 'Legendary Creature — Wizard', '', '{1}{U}{B}', ['U', 'B']),
  card('Island', 0, 'Basic Land — Island', '{T}: Add {U}.', '', ['U'], ['U']),
  card('Swamp', 0, 'Basic Land — Swamp', '{T}: Add {B}.', '', ['B'], ['B']),
  card('Watery Check', 0, 'Land', 'Watery Check enters tapped unless you control an Island or a Swamp.\n{T}: Add {U} or {B}.', '', ['U', 'B'], ['U', 'B']),
  card('Dimir Fetch', 0, 'Land', '{T}, Sacrifice Dimir Fetch: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.', '', [], []),
  card('Demonic Test', 2, 'Sorcery', 'Search your library for a card, put that card into your hand, then shuffle.', '{1}{B}', ['B']),
  card('Combo A', 1, 'Artifact', '', '{1}', []),
  card('Combo B', 2, 'Creature — Wizard', '', '{1}{U}', ['U']),
  card('Cantrip', 1, 'Sorcery', 'Draw a card.', '{U}', ['U']),
  card('Arena', 3, 'Enchantment', 'At the beginning of your upkeep, draw a card and you lose 1 life.', '{1}{B}{B}', ['B']),
  card('Commander Mana', 2, 'Artifact', '{T}: Add {U}. Spend this mana only to cast your commander.', '{2}', [], ['U']),
  card('Filler', 2, 'Creature — Wizard', '', '{1}{U}', ['U']),
];

const parsed = parseDecklist(`
// COMMANDER
1 Test Commander
// MAIN
18 Island
18 Swamp
4 Watery Check
4 Dimir Fetch
4 Demonic Test
1 Combo A
1 Combo B
8 Cantrip
6 Arena
6 Commander Mana
29 Filler
`);

test('V0.4 simulation is deterministic and tutors mutate the library for requested combos', () => {
  const options = { iterations: 400, turns: 7, seed: 4242, comboPieces: [['Combo A', 'Combo B']] };
  const first = simulateDeckConsistencyV04(parsed, cards, options);
  const second = simulateDeckConsistencyV04(parsed, cards, options);
  assert.deepEqual(first, second);
  const tutors = first.tutors as Record<string, number | string>;
  assert.equal(Number(tutors.averageTutorsCast) > 0, true);
  assert.equal(Number(tutors.averageTutorsThatFoundRequestedComboPiece) > 0, true);
  const combos = first.combos as Array<Record<string, any>>;
  const natural = Number(combos[0]?.naturalAssemblyByTurn?.turn7 ?? 0);
  const assisted = Number(combos[0]?.tutorAssistedProxyByTurn?.turn7 ?? 0);
  assert.equal(assisted >= natural, true);
});

test('V0.4 simulation produces real extra card flow and fetch decisions', () => {
  const result = simulateDeckConsistencyV04(parsed, cards, { iterations: 400, turns: 7, seed: 99 });
  const cardAdvantage = result.cardAdvantage as Record<string, unknown>;
  const development = result.development as Record<string, unknown>;
  assert.equal(Number(cardAdvantage.averageImmediateCardsDrawnByEffects ?? 0) > 0, true);
  assert.equal(Number(cardAdvantage.averageRecurringCardsDrawnByEngines ?? 0) > 0, true);
  assert.equal(Number(development.averageFetchesActivated ?? 0) > 0, true);
  assert.equal(Number(development.averageRestrictedManaSourcesDeployed ?? 0) > 0, true);
});
