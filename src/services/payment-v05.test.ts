import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { evaluateCastabilityV05 } from './payment-v05.js';

let collector = 1;
function card(name: string, manaCost: string, oracleText = '', keywords: string[] = [], cmc = 3): ScryfallCard {
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

test('commander tax remains on a free-cast line', () => {
  const spell = card('Free Commander', '{3}{U}', 'You may cast this spell without paying its mana cost.', [], 4);
  const result = evaluateCastabilityV05(spell, {
    isCommander: true,
    commanderTax: 4,
    mana: { C: 4 },
    alternativeResourceReady: true,
  });
  const free = result.lines.find((line) => line.mode === 'without-paying-mana-cost');
  assert.equal(free?.commanderTaxApplied, 4);
  assert.equal(free?.castable, true);
});

test('convoke can pay colored mana using creature colors and generic with other creatures', () => {
  const spell = card('Convoke Spell', '{3}{W}', 'Convoke', ['Convoke'], 4);
  const result = evaluateCastabilityV05(spell, {
    untappedCreatures: [{ colors: ['W'] }, { colors: ['G'] }, { colors: ['G'] }, { colors: ['G'] }],
  });
  assert.equal(result.lines[0]?.castable, true);
  assert.equal(result.lines[0]?.used.convokeCreatures, 4);
});

test('improvise pays generic but not colored requirements', () => {
  const spell = card('Improvise Spell', '{3}{U}', 'Improvise', ['Improvise'], 4);
  const enough = evaluateCastabilityV05(spell, { mana: { U: 1 }, untappedArtifacts: 3 });
  const noBlue = evaluateCastabilityV05(spell, { untappedArtifacts: 4 });
  assert.equal(enough.lines[0]?.castable, true);
  assert.equal(noBlue.lines[0]?.castable, false);
});

test('delve pays generic from graveyard cards', () => {
  const spell = card('Delve Spell', '{5}{B}', 'Delve', ['Delve'], 6);
  const result = evaluateCastabilityV05(spell, { mana: { B: 1 }, graveyardCards: 5 });
  assert.equal(result.lines[0]?.castable, true);
  assert.equal(result.lines[0]?.used.delvedCards, 5);
});

test('Treasures can cover missing colors', () => {
  const spell = card('Gold Spell', '{W}{U}{B}', '', [], 3);
  const result = evaluateCastabilityV05(spell, { mana: { W: 1 }, treasures: 2 });
  assert.equal(result.lines[0]?.castable, true);
  assert.equal(result.lines[0]?.used.treasures, 2);
});

test('Phyrexian mana can use life when colored mana is missing', () => {
  const spell = card('Phyrexian Spell', '{1}{U/P}{U/P}', '', [], 3);
  const result = evaluateCastabilityV05(spell, { mana: { C: 1 }, life: 40 });
  assert.equal(result.lines[0]?.castable, true);
  assert.equal(result.lines[0]?.used.phyrexianLife, 4);
});

test('affinity reduces generic cost using supplied affinity count', () => {
  const spell = card('Affinity Spell', '{6}', 'Affinity for artifacts', ['Affinity'], 6);
  const result = evaluateCastabilityV05(spell, { affinityCount: 4, mana: { C: 2 } });
  assert.equal(result.lines[0]?.castable, true);
  assert.equal(result.lines[0]?.genericAfterAffinity, 2);
});
