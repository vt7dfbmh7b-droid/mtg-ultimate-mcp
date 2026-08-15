import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildCardIntelligenceV05, formatCardIntelligenceV05 } from './card-intelligence-v05.js';

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
  assert.ok(report.rulesAttention.some((note) => /Indestructible stops destroy effects/i.test(note)));
});

test('simple card intelligence is compact by default', () => {
  const candidate = card(
    'Useful Card',
    'Instant',
    ['U'],
    'Counter target spell. Draw two cards. Create a Treasure token.',
    '{1}{U}',
  );
  const report = buildCardIntelligenceV05(candidate);
  const simple = formatCardIntelligenceV05(report) as {
    detail: string;
    mainJobs: string[];
    bestUse: string[];
    importantRules: string[];
    responseGuidance: string;
    casting?: unknown;
  };
  assert.equal(simple.detail, 'simple');
  assert.ok(simple.mainJobs.length <= 3);
  assert.ok(simple.bestUse.length <= 2);
  assert.ok(simple.importantRules.length <= 1);
  assert.equal(simple.casting, undefined);
  assert.match(simple.responseGuidance, /plain language/i);
});

test('detailed card intelligence preserves the full report', () => {
  const candidate = card('Detailed Card', 'Creature — Wizard', ['U'], 'Draw two cards.', '{2}{U}');
  const report = buildCardIntelligenceV05(candidate);
  const detailed = formatCardIntelligenceV05(report, 'detailed') as typeof report & { detail: string };
  assert.equal(detailed.detail, 'detailed');
  assert.ok(Array.isArray(detailed.strategicRoles));
  assert.ok(detailed.casting);
});
