import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { deriveCommanderStrategyContextFromCommandersV15 } from './commander-strategy-affinity-v15.js';
import { contextualCutPressureV15 } from './upgrade.js';

function card(name: string, typeLine: string, oracleText: string, cmc = 2, manaCost = '{2}'): ScryfallCard {
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

test('secondary off-plan roles receive cut pressure when they do not support the commander', () => {
  const commander = card(
    'Unnamed Spell Captain',
    'Legendary Creature — Wizard',
    'Whenever you cast a noncreature spell with mana value 3 or greater, each opponent loses 2 life and you gain 2 life. At the beginning of your end step, if a player lost 4 or more life this turn, draw a card.',
    4,
    '{1}{W}{U}{B}',
  );
  const context = deriveCommanderStrategyContextFromCommandersV15([commander]);
  const offPlanSecondaryRole = card(
    'Incidental Haste Charm',
    'Enchantment',
    'Creatures you control have haste.',
    2,
    '{1}{R}',
  );

  const pressure = contextualCutPressureV15(offPlanSecondaryRole, context);
  assert.ok(pressure.cutPressure > 0);
  assert.ok(pressure.reasons.some((reason) => /secondary detected roles/i.test(reason)));
});

test('core interaction remains protected from the secondary-role cut signal', () => {
  const commander = card(
    'Unnamed Spell Captain',
    'Legendary Creature — Wizard',
    'Whenever you cast a noncreature spell with mana value 3 or greater, each opponent loses 2 life and you gain 2 life. At the beginning of your end step, if a player lost 4 or more life this turn, draw a card.',
    4,
    '{1}{W}{U}{B}',
  );
  const context = deriveCommanderStrategyContextFromCommandersV15([commander]);
  const counterspell = card('Useful Counter', 'Instant', 'Counter target spell.', 2, '{U}{U}');

  const pressure = contextualCutPressureV15(counterspell, context);
  assert.ok(pressure.cutPressure <= 0);
  assert.equal(pressure.reasons.some((reason) => /secondary detected roles/i.test(reason)), false);
});
