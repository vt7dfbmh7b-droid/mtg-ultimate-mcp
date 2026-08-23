import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { auditUpgradeStrategyPreservationV15 } from './deck-builder-v07.js';
import {
  cardCommanderStrategyAffinityV15,
  deriveCommanderStrategyContextFromCommandersV15,
} from './commander-strategy-affinity-v15.js';
import { contextualCutPressureV15 } from './upgrade.js';

function card(
  name: string,
  typeLine: string,
  oracleText: string,
  cmc = 2,
  manaCost = '{2}',
): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    lang: 'en',
    oracle_id: `${name}-oracle`,
    name,
    set: 'tst',
    set_name: 'Test Set',
    collector_number: String(Math.max(1, name.length)),
    released_at: '2026-01-01',
    type_line: typeLine,
    oracle_text: oracleText,
    mana_cost: manaCost,
    cmc,
    colors: [],
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'rare',
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

function spellTriggerCommander(): ScryfallCard {
  return card(
    'Unnamed Spell Drain Commander',
    'Legendary Creature — Wizard',
    'Whenever you cast a noncreature spell with mana value 3 or greater, this creature deals 2 damage to each opponent and you gain 2 life. At the beginning of your end step, if a player lost 4 or more life this turn, draw a card.',
    4,
    '{1}{W}{U}{B}',
  );
}

function swapAudit(
  cut: ScryfallCard,
  add: ScryfallCard,
  context: ReturnType<typeof deriveCommanderStrategyContextFromCommandersV15>,
) {
  const cutAffinity = cardCommanderStrategyAffinityV15(cut, context);
  const addAffinity = cardCommanderStrategyAffinityV15(add, context);
  const cutPressure = contextualCutPressureV15(cut, context);
  return auditUpgradeStrategyPreservationV15([{
    cut: {
      card: { name: cut.name, roles: [], manaValue: cut.cmc, typeLine: cut.type_line },
      strategyAffinity: {
        score: cutAffinity.score,
        protectionApplied: cutPressure.strategyProtectionApplied,
        matchedStrategies: cutAffinity.matches.map((match) => match.archetype),
        matches: cutAffinity.matches,
      },
    },
    add: {
      card: { name: add.name, roles: [], manaValue: add.cmc, typeLine: add.type_line },
      strategyAffinity: {
        score: addAffinity.score,
        protectionApplied: 0,
        matchedStrategies: addAffinity.matches.map((match) => match.archetype),
        matches: addAffinity.matches,
      },
    },
  }]);
}

test('explicit command-zone mana-value cast triggers give otherwise generic qualifying spells strategy affinity', () => {
  const context = deriveCommanderStrategyContextFromCommandersV15([spellTriggerCommander()]);
  const highManaSpell = card(
    'Five-Mana Story Spell',
    'Sorcery',
    'Create two 1/1 colorless creature tokens.',
    5,
    '{4}{W}',
  );
  const cheapSpell = card(
    'One-Mana Trick',
    'Instant',
    'Target creature gets -1/-1 until end of turn.',
    1,
    '{B}',
  );

  const spellsControl = context.strategies.find((strategy) => strategy.archetype === 'spells-control');
  const highAffinity = cardCommanderStrategyAffinityV15(highManaSpell, context);
  const cheapAffinity = cardCommanderStrategyAffinityV15(cheapSpell, context);

  assert.ok(spellsControl && spellsControl.score >= 6);
  assert.deepEqual(context.directSupportRules?.map((rule) => ({ kind: rule.kind, minManaValue: rule.minManaValue })), [
    { kind: 'cast-noncreature-min-mv', minManaValue: 3 },
  ]);
  assert.ok(highAffinity.matches.some((match) => match.archetype === 'spells-control' && match.overlapScore >= 8));
  assert.equal(cheapAffinity.matches.some((match) => match.archetype === 'spells-control'), false);
});

test('noncreature X spells count as direct support because X contributes to mana value on the stack', () => {
  const context = deriveCommanderStrategyContextFromCommandersV15([spellTriggerCommander()]);
  const xSpell = card(
    'Variable Drain',
    'Sorcery',
    'Each opponent loses X life. You gain life equal to the life lost this way.',
    2,
    '{X}{B}{B}',
  );

  const affinity = cardCommanderStrategyAffinityV15(xSpell, context);
  const pressure = contextualCutPressureV15(xSpell, context);

  assert.ok(affinity.matches.some((match) => match.archetype === 'spells-control' && match.overlapScore >= 8));
  assert.equal(pressure.strategyProtectionApplied, 4);
});

test('upgrade strategy audit rejects replacing direct commander-trigger fuel with unrelated efficiency', () => {
  const context = deriveCommanderStrategyContextFromCommandersV15([spellTriggerCommander()]);
  const directFuel = card(
    'Five-Mana Story Spell',
    'Sorcery',
    'Create two 1/1 colorless creature tokens.',
    5,
    '{4}{W}',
  );
  const unrelated = card(
    'Cheap Mana Pebble',
    'Artifact',
    '{T}: Add {C}.',
    1,
    '{1}',
  );

  const audit = swapAudit(directFuel, unrelated, context);
  assert.equal(audit.status, 'meaningful-strategy-loss');
  assert.ok(audit.meaningfulLosses.some((loss) => loss.strategy === 'spells-control'));
});

test('upgrade strategy audit rejects cheap generic control as a replacement for explicit commander-trigger fuel', () => {
  const context = deriveCommanderStrategyContextFromCommandersV15([spellTriggerCommander()]);
  const directFuel = card(
    'Five-Mana Story Spell',
    'Instant',
    'Draw two cards.',
    5,
    '{4}{U}',
  );
  const cheapGenericControl = card(
    'Cheap Generic Counter',
    'Instant',
    'Counter target spell.',
    1,
    '{U}',
  );

  const directAffinity = cardCommanderStrategyAffinityV15(directFuel, context);
  const cheapAffinity = cardCommanderStrategyAffinityV15(cheapGenericControl, context);
  assert.ok(directAffinity.score > cheapAffinity.score);
  assert.ok(cheapAffinity.matches.some((match) => match.archetype === 'spells-control'));

  const audit = swapAudit(directFuel, cheapGenericControl, context);
  assert.equal(audit.status, 'meaningful-strategy-loss');
  assert.ok(audit.meaningfulLosses.some((loss) => loss.strategy === 'spells-control'));
});

// Intentional no-op marker: rerun the isolated Scions stress workflow after direct-fuel weighting changed.
