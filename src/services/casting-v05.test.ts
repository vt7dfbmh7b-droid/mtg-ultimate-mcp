import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { analyzeCastingProfileV05, parseTreasureProfile } from './casting-v05.js';

let collector = 1;
function card(name: string, manaCost: string, oracleText: string, keywords: string[] = [], cmc = 4): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    mana_cost: manaCost,
    cmc,
    type_line: 'Sorcery',
    oracle_text: oracleText,
    color_identity: [],
    keywords,
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('detects convoke, improvise, delve, affinity and Phyrexian mana', () => {
  const convoke = analyzeCastingProfileV05(card('Convoke Spell', '{5}{W}', 'Convoke', ['Convoke'], 6));
  const improvise = analyzeCastingProfileV05(card('Improvise Spell', '{3}{U}{U}', 'Improvise', ['Improvise'], 5));
  const delve = analyzeCastingProfileV05(card('Delve Spell', '{7}{B}', 'Delve', ['Delve'], 8));
  const affinity = analyzeCastingProfileV05(card('Affinity Spell', '{6}', 'Affinity for artifacts', ['Affinity'], 6));
  const phyrexian = analyzeCastingProfileV05(card('Phyrexian Spell', '{2}{U/P}{U/P}', '', [], 4));

  assert.ok(convoke.paymentMechanics.includes('convoke'));
  assert.ok(improvise.paymentMechanics.includes('improvise'));
  assert.ok(delve.paymentMechanics.includes('delve'));
  assert.deepEqual(affinity.affinityFor, ['artifacts']);
  assert.deepEqual(phyrexian.phyrexianSymbols, ['{U/P}']);
  assert.equal(phyrexian.phyrexianLifeAlternativeCount, 1);
});

test('detects named and pitch-style alternative costs', () => {
  const evoke = analyzeCastingProfileV05(card('Evoke Creature', '{4}{B}', 'Evoke—{1}{B}', ['Evoke'], 5));
  const pitch = analyzeCastingProfileV05(card(
    'Pitch Spell',
    '{3}{U}{U}',
    'If it is not your turn, you may exile a blue card from your hand rather than pay this spell’s mana cost.',
    [],
    5,
  ));

  assert.equal(evoke.alternativeCosts[0]?.kind, 'evoke');
  assert.equal(evoke.alternativeCosts[0]?.manaCost, '{1}{B}');
  assert.equal(evoke.alternativeCosts[0]?.commanderTaxStillApplies, true);
  assert.equal(pitch.alternativeCosts[0]?.kind, 'alternate-cost');
  assert.equal(pitch.alternativeCosts[0]?.additionalResource, 'Exile requirement');
});

test('detects immediate and recurring Treasure creation', () => {
  const immediate = parseTreasureProfile(card('Treasure Burst', '{2}{R}', 'Create two Treasure tokens.', [], 3));
  const recurring = parseTreasureProfile(card(
    'Treasure Engine',
    '{2}{R}',
    'Whenever one or more creatures you control deal combat damage to a player, create a Treasure token.',
    [],
    3,
  ));

  assert.equal(immediate.immediateTreasure, 2);
  assert.equal(immediate.recurring, false);
  assert.equal(recurring.recurringTreasurePerTrigger, 1);
  assert.equal(recurring.recurring, true);
});

test('detects free-cast text separately from alternative costs', () => {
  const profile = analyzeCastingProfileV05(card(
    'Free Cast Engine',
    '{5}{R}',
    'You may cast that spell without paying its mana cost.',
    [],
    6,
  ));
  assert.ok(profile.paymentMechanics.includes('without-paying-mana-cost'));
  assert.equal(profile.freeCastText.length, 1);
});
