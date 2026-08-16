import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { evaluateCombatBoardV07 } from './combat-v07.js';

let collector = 1;
function card(name: string, typeLine: string, oracleText = '', power?: string, toughness?: string): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    cmc: 2,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    ...(power !== undefined ? { power } : {}),
    ...(toughness !== undefined ? { toughness } : {}),
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('applies counters, equipment, auras, and tribal lords', () => {
  const vampire = card('Vampire', 'Creature — Vampire', '', '2', '2');
  const lord = card('Vampire Lord', 'Creature — Vampire', 'Other Vampire creatures you control get +1/+1.', '2', '2');
  const sword = card('Sword', 'Artifact — Equipment', 'Equipped creature gets +2/+0 and has flying.');
  const aura = card('Blessing', 'Enchantment — Aura', 'Enchanted creature gets +1/+2.');
  const result = evaluateCombatBoardV07([
    { card: vampire, plusOneCounters: 1, attachedCards: [sword, aura], isCommander: true },
    { card: lord },
  ]);
  const target = result.creatures.find((creature) => creature.name === 'Vampire');
  assert.equal(target?.effectivePower, 7);
  assert.equal(target?.effectiveToughness, 6);
  assert.equal(target?.keywords.includes('flying'), true);
  const lordResult = result.creatures.find((creature) => creature.name === 'Vampire Lord');
  assert.equal(lordResult?.effectivePower, 2);
});

test('keeps variable printed stats unresolved instead of inventing a number', () => {
  const variable = card('Variable', 'Creature — Avatar', '', '*', '*');
  const result = evaluateCombatBoardV07([{ card: variable, plusOneCounters: 3 }]);
  assert.equal(result.creatures[0]?.effectivePower, null);
  assert.equal(result.totalEffectivePower, null);
});
