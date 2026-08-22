import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  auditUpgradeStrategyPreservationV15,
  pairUpgradeSwapsByStructureV15,
} from './deck-builder-v07.js';
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
  assert.ok(unrelatedPressure.cutPressure - onPlanPressure.cutPressure >= onPlanPressure.strategyProtectionApplied);
  assert.ok(onPlanPressure.cutPressure > 0);
});

test('weak incidental commander archetypes do not protect surplus utility over a substantive plan', () => {
  const commander = card(
    'Five-Color Battle Captain',
    'Legendary Creature — Human Warrior',
    'Whenever a creature you control attacks, untap all attacking creatures. They gain haste until end of turn.',
  );
  const context = deriveCommanderStrategyContextFromCommandersV15([commander]);
  const weakBigMana = {
    ...card('Surplus Mana Rock', 'Artifact', '{T}: Add one mana of any color.'),
    cmc: 2,
  } as ScryfallCard;
  const substantiveCombat = {
    ...card('Haste Equipment', 'Artifact — Equipment', 'Equipped creature has haste. Equip {1}.'),
    cmc: 2,
  } as ScryfallCard;

  const rockPressure = contextualCutPressureV15(weakBigMana, context);
  const equipmentPressure = contextualCutPressureV15(substantiveCombat, context);

  assert.equal(context.strategies.find((strategy) => strategy.archetype === 'big-mana')?.score, 4);
  assert.ok((context.strategies.find((strategy) => strategy.archetype === 'combat-tokens')?.score ?? 0) >= 6);
  assert.equal(rockPressure.strategyProtectionApplied, 0);
  assert.equal(equipmentPressure.strategyProtectionApplied, 2);
  assert.ok(rockPressure.cutPressure > equipmentPressure.cutPressure);
});

test('upgrade pairing preserves the structural role an incoming card is repairing when a safer cut exists', () => {
  const additions = [{
    role: 'ramp' as const,
    candidate: {
      card: {
        name: 'New Ramp',
        roles: ['mana acceleration'],
        manaValue: 2,
        typeLine: 'Artifact',
      },
    },
  }];
  const cuts: Array<Record<string, unknown>> = [
    {
      card: {
        name: 'Old Ramp',
        roles: ['mana acceleration'],
        manaValue: 3,
        typeLine: 'Artifact',
      },
      heuristicCutPressure: 10,
    },
    {
      card: {
        name: 'Off-plan Four Drop',
        roles: [],
        manaValue: 4,
        typeLine: 'Creature — Human',
      },
      heuristicCutPressure: 8,
    },
  ];
  const pairings = pairUpgradeSwapsByStructureV15(
    additions,
    cuts,
    {
      rampCount: 7,
      drawCount: 8,
      interactionCount: 8,
      protectionCount: 3,
      tutorCount: 1,
      earlyPlayCount: 10,
    },
    {
      ramp: 8,
      draw: 8,
      interaction: 8,
      protection: 3,
      tutors: 1,
      earlyPlays: 10,
    },
  );

  assert.equal(pairings.length, 1);
  assert.equal((pairings[0]?.cut.card as Record<string, unknown> | undefined)?.name, 'Off-plan Four Drop');
  assert.equal(pairings[0]?.structuralDeficitAfterSwap, 0);
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

test('Food and repeatable life-gain text form a substantive commander identity without card-name shortcuts', () => {
  const lifeGainCommander = card(
    'Unnamed Ring Bearer',
    'Legendary Creature — Halfling Scout',
    'Partner with Unnamed Provisioner\nWhenever Unnamed Ring Bearer attacks, if you gained 3 or more life this turn, draw a card.',
  );
  const foodCommander = card(
    'Unnamed Provisioner',
    'Legendary Creature — Halfling Peasant',
    'Partner with Unnamed Ring Bearer\nAt the beginning of combat on your turn, create a Food token. Activated abilities of Foods you control cost {1} less to activate.',
  );
  const context = deriveCommanderStrategyContextFromCommandersV15([lifeGainCommander, foodCommander]);
  const foodLifeGain = context.strategies.find((strategy) => strategy.archetype === 'food-lifegain');

  assert.ok(foodLifeGain);
  assert.ok(foodLifeGain.score >= 6);
  assert.equal(context.strategies[0]?.archetype, 'food-lifegain');
});

test('Food/lifegain payoffs receive cut protection and uncompensated removal fails strategy preservation', () => {
  const lifeGainCommander = card(
    'Unnamed Ring Bearer',
    'Legendary Creature — Halfling Scout',
    'Partner with Unnamed Provisioner\nWhenever Unnamed Ring Bearer attacks, if you gained 3 or more life this turn, draw a card.',
  );
  const foodCommander = card(
    'Unnamed Provisioner',
    'Legendary Creature — Halfling Peasant',
    'Partner with Unnamed Ring Bearer\nAt the beginning of combat on your turn, create a Food token. Activated abilities of Foods you control cost {1} less to activate.',
  );
  const context = deriveCommanderStrategyContextFromCommandersV15([lifeGainCommander, foodCommander]);
  const payoff = card(
    'Life Conversion Engine',
    'Enchantment',
    'Whenever you gain life, target opponent loses that much life.',
  );
  const repeatableEnabler = card(
    'Life Trigger Engine',
    'Creature — Elf Shaman',
    'Whenever another creature enters, you gain 1 life.',
  );
  const unrelated = card(
    'Generic Removal Spell',
    'Instant',
    'Exile target creature.',
  );

  const payoffAffinity = cardCommanderStrategyAffinityV15(payoff, context);
  const enablerAffinity = cardCommanderStrategyAffinityV15(repeatableEnabler, context);
  const unrelatedAffinity = cardCommanderStrategyAffinityV15(unrelated, context);
  const payoffPressure = contextualCutPressureV15(payoff, context);

  assert.ok(payoffAffinity.matches.some((match) => match.archetype === 'food-lifegain' && match.overlapScore >= 6));
  assert.ok(enablerAffinity.matches.some((match) => match.archetype === 'food-lifegain' && match.overlapScore >= 6));
  assert.equal(unrelatedAffinity.matches.some((match) => match.archetype === 'food-lifegain'), false);
  assert.equal(payoffPressure.strategyProtectionApplied, 4);

  const audit = auditUpgradeStrategyPreservationV15([{
    cut: {
      card: { name: payoff.name, roles: [], manaValue: payoff.cmc, typeLine: payoff.type_line },
      strategyAffinity: {
        score: payoffAffinity.score,
        protectionApplied: payoffPressure.strategyProtectionApplied,
        matchedStrategies: payoffAffinity.matches.map((match) => match.archetype),
        matches: payoffAffinity.matches,
      },
    },
    add: {
      card: { name: unrelated.name, roles: ['spot interaction'], manaValue: unrelated.cmc, typeLine: unrelated.type_line },
      strategyAffinity: {
        score: unrelatedAffinity.score,
        protectionApplied: 0,
        matchedStrategies: unrelatedAffinity.matches.map((match) => match.archetype),
        matches: unrelatedAffinity.matches,
      },
    },
  }]);

  assert.equal(audit.status, 'meaningful-strategy-loss');
  assert.deepEqual(audit.meaningfulLosses.map((loss) => loss.strategy), ['food-lifegain']);
});

test('artifact graveyard engines receive cut protection while graveyard hate cannot replace them', () => {
  const commander = card(
    'Unnamed Self-Mill Recycler',
    'Legendary Artifact Creature — Test Construct',
    'Whenever this creature attacks, mill three cards. You may put an artifact creature card from among the cards milled this way into your hand.',
  );
  const context = deriveCommanderStrategyContextFromCommandersV15([commander]);
  const engine = card(
    'Unnamed Static Graveyard Engine',
    'Artifact Creature — Test Construct',
    'As long as this creature is on the battlefield, it has all activated abilities of all artifact cards in your graveyard.',
  );
  const hate = card(
    'Unnamed Graveyard Lantern',
    'Artifact',
    "When this artifact enters, exile a card from a graveyard. {T}, Sacrifice this artifact: Exile each opponent's graveyard. Draw a card.",
  );

  assert.equal(context.strategies[0]?.archetype, 'graveyard-reanimator');
  assert.ok(context.strategies.some((strategy) => strategy.archetype === 'artifact-engine' && strategy.score >= 6));
  const engineAffinity = cardCommanderStrategyAffinityV15(engine, context);
  const hateAffinity = cardCommanderStrategyAffinityV15(hate, context);
  const enginePressure = contextualCutPressureV15(engine, context);
  assert.ok(engineAffinity.matches.some((match) => match.archetype === 'graveyard-reanimator' && match.overlapScore >= 6));
  assert.ok(engineAffinity.matches.some((match) => match.archetype === 'artifact-engine' && match.overlapScore >= 6));
  assert.equal(hateAffinity.matches.some((match) => match.archetype === 'graveyard-reanimator'), false);
  assert.ok((hateAffinity.matches.find((match) => match.archetype === 'artifact-engine')?.overlapScore ?? 0) < 6);
  assert.equal(enginePressure.strategyProtectionApplied, 4);

  const audit = auditUpgradeStrategyPreservationV15([{
    cut: {
      card: { name: engine.name, roles: [], manaValue: engine.cmc, typeLine: engine.type_line },
      strategyAffinity: {
        score: engineAffinity.score,
        protectionApplied: enginePressure.strategyProtectionApplied,
        matchedStrategies: engineAffinity.matches.map((match) => match.archetype),
        matches: engineAffinity.matches,
      },
    },
    add: {
      card: { name: hate.name, roles: ['graveyard hate'], manaValue: hate.cmc, typeLine: hate.type_line },
      strategyAffinity: {
        score: hateAffinity.score,
        protectionApplied: 0,
        matchedStrategies: hateAffinity.matches.map((match) => match.archetype),
        matches: hateAffinity.matches,
      },
    },
  }]);

  assert.equal(audit.status, 'meaningful-strategy-loss');
  assert.deepEqual(audit.meaningfulLosses.map((loss) => loss.strategy), ['artifact-engine', 'graveyard-reanimator']);
});

test('token multipliers and team-wide payoffs cannot be traded for generic role gains', () => {
  const commander = card(
    'Unnamed Token Commander',
    'Legendary Creature — Test Druid',
    'At the beginning of your end step, create a token that is a copy of target token you control.',
  );
  const context = deriveCommanderStrategyContextFromCommandersV15([commander]);
  const engines = [
    card(
      'Unnamed Token Multiplier',
      'Creature — Test Warrior',
      'If one or more tokens would be created under your control, those tokens plus that many 1/1 green creature tokens are created instead.',
    ),
    card(
      'Unnamed Team Anthem',
      'Enchantment',
      'Creatures you control get +5/+5 as long as this permanent has seven or more quest counters on it.',
    ),
    card(
      'Unnamed Typal Anthem',
      'Creature — Test Noble',
      'Other Squirrels you control get +1/+1.',
    ),
  ];
  const genericProtection = card(
    'Unnamed Generic Protection',
    'Instant',
    'Target creature you control gains hexproof and indestructible until end of turn.',
  );
  const addAffinity = cardCommanderStrategyAffinityV15(genericProtection, context);
  const pairings = engines.map((engine) => {
    const cutAffinity = cardCommanderStrategyAffinityV15(engine, context);
    const cutPressure = contextualCutPressureV15(engine, context);
    assert.ok(cutAffinity.matches.some((match) => match.archetype === 'combat-tokens' && match.overlapScore >= 6));
    assert.equal(cutPressure.strategyProtectionApplied, 4);
    return {
      cut: {
        card: { name: engine.name, roles: [], manaValue: engine.cmc, typeLine: engine.type_line },
        strategyAffinity: {
          score: cutAffinity.score,
          protectionApplied: cutPressure.strategyProtectionApplied,
          matchedStrategies: cutAffinity.matches.map((match) => match.archetype),
          matches: cutAffinity.matches,
        },
      },
      add: {
        card: { name: genericProtection.name, roles: ['protection'], manaValue: genericProtection.cmc, typeLine: genericProtection.type_line },
        strategyAffinity: {
          score: addAffinity.score,
          protectionApplied: 0,
          matchedStrategies: addAffinity.matches.map((match) => match.archetype),
          matches: addAffinity.matches,
        },
      },
    };
  });

  const audit = auditUpgradeStrategyPreservationV15(pairings);
  assert.equal(audit.status, 'meaningful-strategy-loss');
  assert.deepEqual(audit.meaningfulLosses.map((loss) => loss.strategy), ['combat-tokens']);
});
