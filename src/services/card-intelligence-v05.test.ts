import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildCardIntelligenceV05 } from './card-intelligence-v05.js';

let collector = 1;
function card(
  name: string,
  typeLine: string,
  colorIdentity: string[],
  oracleText: string,
  manaCost = '{1}{B}',
): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    mana_cost: manaCost,
    cmc: 2,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: colorIdentity,
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('card intelligence combines role, casting, and commander fit', () => {
  const commander = card('Rakdos Commander', 'Legendary Creature — Vampire', ['B', 'R'], '', '{B}{R}');
  const candidate = card('Treasure Draw', 'Sorcery', ['B'], 'Create a Treasure token. Draw two cards.', '{1}{B}');
  const report = buildCardIntelligenceV05(candidate, [commander]);
  assert.ok(report.strategicRoles.includes('card draw'));
  assert.equal(report.casting.treasure.createsTreasure, true);
  assert.equal(report.commanderFit?.legalForCommanders, true);
});

test('card intelligence rejects off-color Commander fit', () => {
  const commander = card('Rakdos Commander', 'Legendary Creature — Vampire', ['B', 'R'], '', '{B}{R}');
  const blueCard = card('Blue Card', 'Instant', ['U'], 'Counter target spell.', '{U}');
  const report = buildCardIntelligenceV05(blueCard, [commander]);
  assert.equal(report.commanderFit?.colorIdentityLegal, false);
  assert.equal(report.commanderFit?.legalForCommanders, false);
});

test('rules attention distinguishes indestructible from broader protection', () => {
  const protect = card('Protect', 'Instant', ['W'], 'Target creature gains indestructible until end of turn.', '{W}');
  const report = buildCardIntelligenceV05(protect);
  assert.ok(report.rulesAttention.some((note) => /Indestructible prevents destruction/i.test(note)));
});
