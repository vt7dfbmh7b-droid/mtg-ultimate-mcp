import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { auditUpgradeDeckStrategyRetentionV15 } from './commander-strategy-affinity-v15.js';

function card(name: string, oracleText: string, cmc = 2): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${name}-oracle`,
    lang: 'en',
    name,
    set: 'tst',
    set_name: 'Multiplayer Strategy Test',
    collector_number: String(cmc + 1),
    released_at: '2026-01-01',
    type_line: 'Creature — Test Advisor',
    oracle_text: oracleText,
    mana_cost: cmc === 1 ? '{B}' : `{${Math.max(1, cmc - 1)}}{B}`,
    cmc,
    colors: ['B'],
    color_identity: ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'uncommon',
    prices: { usd: '1.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: `https://scryfall.com/search?q=${encodeURIComponent(name)}`,
  } as ScryfallCard;
}

// This synthetic commander deliberately anchors aristocrats at exactly the shared substantive
// threshold through a death trigger alone. That makes the test isolate the table-wide pressure
// premium instead of also measuring unrelated differences in raw archetype strength.
const commander = {
  ...card(
    'Unnamed Death-Trigger Commander',
    'Whenever another creature you control dies, scry 1.',
    3,
  ),
  type_line: 'Legendary Creature — Test Advisor',
} as ScryfallCard;

const tablewidePayoff = card(
  'Unnamed Tablewide Death Payoff',
  'Whenever another creature dies, each opponent loses 1 life.',
  4,
);

const singleTargetPayoff = card(
  'Unnamed Single-Target Death Payoff',
  'Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life.',
  2,
);

const replacementTablewidePayoff = card(
  'Unnamed Efficient Tablewide Death Payoff',
  'Whenever this creature or another creature you control dies, each opponent loses 1 life and you gain 1 life.',
  2,
);

const swamp = {
  ...card('Swamp', '', 0),
  type_line: 'Basic Land — Swamp',
  mana_cost: '',
  colors: [],
} as ScryfallCard;

function deck(payoffName: string): ReturnType<typeof parseDecklist> {
  return parseDecklist([
    '// COMMANDER',
    `1 ${commander.name}`,
    '',
    '// MAIN',
    `1 ${payoffName}`,
    '98 Swamp',
  ].join('\n'));
}

test('whole-deck strategy retention distinguishes tablewide repeatable drain from single-target drain', () => {
  const audit = auditUpgradeDeckStrategyRetentionV15(
    deck(tablewidePayoff.name),
    [commander, tablewidePayoff, swamp],
    deck(singleTargetPayoff.name),
    [commander, singleTargetPayoff, swamp],
  );

  assert.equal(audit.evidenceComplete, true);
  assert.equal(audit.preserved, false);
  assert.equal(audit.status, 'strategy-density-loss');
  const aristocrats = audit.strategies.find((strategy) => strategy.archetype === 'aristocrats');
  assert.ok(aristocrats);
  assert.equal(aristocrats.supportDelta, 0, 'the cards still support the same broad archetype');
  assert.equal(aristocrats.affinityDelta, -2, 'losing tablewide multiplayer pressure must reduce strategy quality');
});

test('whole-deck strategy retention permits a cheaper replacement that preserves tablewide drain scope', () => {
  const audit = auditUpgradeDeckStrategyRetentionV15(
    deck(tablewidePayoff.name),
    [commander, tablewidePayoff, swamp],
    deck(replacementTablewidePayoff.name),
    [commander, replacementTablewidePayoff, swamp],
  );

  assert.equal(audit.evidenceComplete, true);
  assert.equal(audit.preserved, true);
  assert.equal(audit.status, 'preserved');
  const aristocrats = audit.strategies.find((strategy) => strategy.archetype === 'aristocrats');
  assert.ok(aristocrats);
  assert.equal(aristocrats.supportDelta, 0);
  assert.equal(aristocrats.affinityDelta, 0);
});
