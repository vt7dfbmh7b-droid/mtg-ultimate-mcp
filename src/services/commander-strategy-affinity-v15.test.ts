import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import {
  cardCommanderStrategyAffinityV15,
  deriveCommanderStrategyContextFromCommandersV15,
  deriveCommanderStrategyContextV15,
} from './commander-strategy-affinity-v15.js';
import { contextualCutPressureV15 } from './upgrade.js';

function card(name: string, typeLine: string, oracleText: string): ScryfallCard {
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
    mana_cost: '{2}',
    cmc: 2,
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

test('builder-side commander context reuses the same V0.15 strategy inference', () => {
  const commander = card(
    'Warrior Captain',
    'Legendary Creature — Human Warrior',
    'Whenever a Warrior attacks, create a 1/1 white Warrior creature token that is tapped and attacking.',
  );
  const parsed = parseDecklist('// COMMANDER\n1 Warrior Captain\n\n// MAIN\n99 Plains');

  const parsedContext = deriveCommanderStrategyContextV15(parsed, [commander]);
  const builderContext = deriveCommanderStrategyContextFromCommandersV15([commander]);

  assert.deepEqual(builderContext, parsedContext);
  assert.equal(builderContext.strategies[0]?.archetype, 'combat-tokens');
});

test('existing V0.15 strategy inference gives on-plan cards more affinity than unrelated utility', () => {
  const commander = card(
    'Warrior Captain',
    'Legendary Creature — Human Warrior',
    'Whenever a Warrior attacks, create a 1/1 white Warrior creature token that is tapped and attacking.',
  );
  const parsed = parseDecklist('// COMMANDER\n1 Warrior Captain\n\n// MAIN\n99 Plains');
  const context = deriveCommanderStrategyContextV15(parsed, [commander]);

  assert.equal(context.strategies[0]?.archetype, 'combat-tokens');

  const onPlan = card(
    'Battlefield Muster',
    'Creature — Human Warrior',
    'Whenever Battlefield Muster attacks, create a 1/1 white Warrior creature token that is tapped and attacking.',
  );
  const unrelated = card(
    'Quiet Scholar',
    'Creature — Human Wizard',
    'When Quiet Scholar enters, draw a card.',
  );

  const onPlanAffinity = cardCommanderStrategyAffinityV15(onPlan, context);
  const unrelatedAffinity = cardCommanderStrategyAffinityV15(unrelated, context);
  assert.ok(onPlanAffinity.score > unrelatedAffinity.score);
  assert.ok(onPlanAffinity.matches.some((match) => match.archetype === 'combat-tokens'));
});

test('strategy-aware cut pressure protects on-plan cards without making them uncuttable', () => {
  const commander = card(
    'Warrior Captain',
    'Legendary Creature — Human Warrior',
    'Whenever a Warrior attacks, create a 1/1 white Warrior creature token that is tapped and attacking.',
  );
  const context = deriveCommanderStrategyContextFromCommandersV15([commander]);
  const onPlan = {
    ...card(
      'Expensive Warband',
      'Creature — Human Warrior',
      'Whenever Expensive Warband attacks, create a 1/1 white Warrior creature token that is tapped and attacking.',
    ),
    cmc: 6,
  } as ScryfallCard;
  const unrelated = {
    ...card(
      'Expensive Observer',
      'Creature — Human Advisor',
      'When Expensive Observer enters, you gain 1 life.',
    ),
    cmc: 6,
  } as ScryfallCard;

  const onPlanPressure = contextualCutPressureV15(onPlan, context);
  const unrelatedPressure = contextualCutPressureV15(unrelated, context);

  assert.equal(onPlanPressure.strategyProtectionApplied, 4);
  assert.equal(unrelatedPressure.strategyProtectionApplied, 0);
  assert.equal(unrelatedPressure.cutPressure - onPlanPressure.cutPressure, 4);
  assert.ok(onPlanPressure.cutPressure > 0);
});

test('top-three commander context preserves multiple already-detected deck identities', () => {
  const combatCommander = card(
    'Warrior Captain',
    'Legendary Creature — Human Warrior',
    'Whenever a Warrior attacks, create a 1/1 white Warrior creature token that is tapped and attacking.',
  );
  const equipmentCommander = card(
    'Armory Captain',
    'Legendary Creature — Human Warrior',
    'Whenever Armory Captain attacks, attach target Equipment you control to it. Equipped creatures you control have double strike.',
  );
  const parsed = parseDecklist('// COMMANDER\n1 Warrior Captain\n1 Armory Captain\n\n// MAIN\n98 Plains');
  const context = deriveCommanderStrategyContextV15(parsed, [combatCommander, equipmentCommander]);
  const archetypes = new Set(context.strategies.map((strategy) => strategy.archetype));

  assert.ok(archetypes.has('combat-tokens'));
  assert.ok(archetypes.has('equipment-voltron'));

  const combatCard = card(
    'Warrior Reinforcements',
    'Creature — Human Warrior',
    'Whenever Warrior Reinforcements attacks, create a 1/1 white Warrior creature token that is tapped and attacking.',
  );
  const equipmentCard = card(
    'Heavy Blade',
    'Artifact — Equipment',
    'Equipped creature gets +3/+3. Equip {2}.',
  );

  assert.ok(cardCommanderStrategyAffinityV15(combatCard, context).score > 0);
  assert.ok(cardCommanderStrategyAffinityV15(equipmentCard, context).score > 0);
});
