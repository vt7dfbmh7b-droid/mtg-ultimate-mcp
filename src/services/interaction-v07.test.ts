import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { assessWardV07, parseWardRequirementsV07, rankInteractionTargetsV07, resolveMultiplayerStackV07 } from './interaction-v07.js';

let collector = 1;
function card(name: string, typeLine: string, oracleText: string, manaCost = '{2}', cmc = 2, rolesText = ''): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    mana_cost: manaCost,
    cmc,
    type_line: typeLine,
    oracle_text: [oracleText, rolesText].filter(Boolean).join('\n'),
    color_identity: [],
    keywords: oracleText.includes('Ward') ? ['Ward'] : [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('parses and pays supported Ward mana and life costs', () => {
  const manaWard = card('Ward Two', 'Creature — Wizard', 'Ward {2}');
  const lifeWard = card('Ward Life', 'Creature — Horror', 'Ward—Pay 3 life.');
  assert.equal(parseWardRequirementsV07(manaWard)[0]?.genericMana, 2);
  assert.equal(assessWardV07(manaWard, { genericMana: 2 }).payable, true);
  assert.equal(assessWardV07(manaWard, { genericMana: 1 }).payable, false);
  assert.equal(parseWardRequirementsV07(lifeWard)[0]?.life, 3);
  assert.equal(assessWardV07(lifeWard, { life: 40 }).payable, true);
});

test('target ranking favors combo engines but accounts for unpaid Ward', () => {
  const removal = card('Removal', 'Instant', 'Exile target creature.');
  const combo = card('Combo Engine', 'Creature — Wizard', 'Whenever you cast a spell, draw a card.', '{3}{U}', 4);
  const warded = card('Warded Engine', 'Creature — Wizard', 'Ward {4}\nWhenever you cast a spell, draw a card.', '{3}{U}', 4);
  const ranked = rankInteractionTargetsV07(removal, [
    { card: combo, knownComboPiece: true },
    { card: warded, knownComboPiece: true },
  ], { genericMana: 1 });
  assert.equal(ranked[0]?.name, 'Combo Engine');
  assert.equal(ranked[1]?.ward.payable, false);
});

test('multiplayer counter wars resolve in LIFO order', () => {
  const threat = card('Big Spell', 'Sorcery', 'Draw three cards.', '{4}{U}', 5);
  const counterOne = card('Counter One', 'Instant', 'Counter target spell.', '{U}{U}', 2);
  const counterTwo = card('Counter Two', 'Instant', 'Counter target spell.', '{1}{U}', 2);
  const result = resolveMultiplayerStackV07([
    { player: 'A', card: threat, role: 'primary' },
    { player: 'B', card: counterOne, role: 'answer' },
    { player: 'A', card: counterTwo, role: 'protection' },
  ]);
  assert.equal(result.primarySpellResolves, true);
  assert.equal(result.actions[1]?.status, 'countered');
});
