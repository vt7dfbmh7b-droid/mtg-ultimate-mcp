import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';
import { effectiveCardRolesV15 } from './card-role-truth-v15.js';

function card(name: string, oracle: string, cmc: number, type = 'Artifact', extra: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name, oracle_id: name, name, lang: 'en', set: 'tst', set_name: 'Operational Effectiveness Test',
    collector_number: name.replace(/\W/g, ''), released_at: '2026-01-01', type_line: type,
    oracle_text: oracle, mana_cost: `{${cmc}}`, cmc, colors: [], color_identity: [], keywords: [],
    legalities: { commander: 'legal' }, rarity: 'rare', prices: { usd: '1.00' }, finishes: ['nonfoil'],
    foil: false, nonfoil: true, promo: false, digital: false, full_art: false,
    scryfall_uri: 'https://scryfall.com', ...extra,
  } as ScryfallCard;
}

const commander = card(
  'Anonymous Archive Keeper',
  'Whenever you draw your second card each turn, put a +1/+1 counter on this creature.',
  3,
  'Legendary Creature — Wizard',
  { color_identity: ['U'], power: '2', toughness: '3' },
);
const island = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });
const engine = card('Anonymous Persistent Study', 'At the beginning of your upkeep, draw two cards.', 7, 'Enchantment');
const filler = Array.from({ length: 59 }, (_, i) => card(`Anonymous Surplus Body ${i}`, '', 4, 'Creature — Wizard', { power: '3', toughness: '3' }));
const baseline = [commander, island, engine, ...filler];
const parsed = parseDecklist(['// COMMANDER', `1 ${commander.name}`, '// MAIN', '39 Island', `1 ${engine.name}`, ...filler.map(c => `1 ${c.name}`)].join('\n'));

const setupHeavyDraw = card(
  'Anonymous Combat Study',
  'Whenever equipped creature deals combat damage to a player, draw a card.',
  1,
  'Artifact — Equipment',
);
const directRecurringDraw = card(
  'Anonymous Efficient Study',
  'At the beginning of your upkeep, draw two cards.',
  2,
  'Enchantment',
);
const all = [...baseline, setupHeavyDraw, directRecurringDraw];

async function planWith(candidate: ScryfallCard) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    let data: ScryfallCard[];
    if (url.pathname.endsWith('/cards/collection')) {
      const identifiers = JSON.parse(String(init?.body)).identifiers as Array<{ name?: string; set?: string; collector_number?: string }>;
      data = identifiers.flatMap(id => all.filter(c => id.name ? c.name === id.name : c.set === id.set && c.collector_number === id.collector_number));
    } else if (url.pathname.endsWith('/cards/search')) {
      const query = url.searchParams.get('q') ?? '';
      const name = /^!"([^"]+)"$/.exec(query)?.[1];
      data = name ? all.filter(c => c.name === name) : [candidate];
    } else throw new Error(`Unexpected provider request: ${url.pathname}`);
    return Response.json({ object: 'list', data, has_more: false, not_found: [] });
  };
  try {
    return await buildSimulationBackedUpgradePlanV07(parsed, baseline, ['U'], {
      targetBracket: 3,
      maxSwaps: 1,
      maxUsdPerCard: 5,
      simulationIterations: 100,
      excludedCards: [setupHeavyDraw, directRecurringDraw].filter(c => c.name !== candidate.name).map(c => c.name),
    });
  } finally {
    globalThis.fetch = original;
  }
}

test('witness cards share the broad repeatable-draw label despite materially different setup', () => {
  assert.ok(effectiveCardRolesV15(engine).includes('repeatable draw'));
  assert.ok(effectiveCardRolesV15(setupHeavyDraw).includes('repeatable draw'));
  assert.ok(effectiveCardRolesV15(directRecurringDraw).includes('repeatable draw'));
});

test('public planner must not treat setup-heavy repeatable draw as full compensation for a direct recurring engine when filler exists', async () => {
  const plan = await planWith(setupHeavyDraw);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1, 'ordinary surplus still permits a useful draw upgrade');
  assert.equal(swaps[0]?.in, setupHeavyDraw.name);
  assert.notEqual(swaps[0]?.out, engine.name, 'broad repeatable-draw membership alone must not prove equivalent operational effectiveness');
  assert.ok(filler.some(c => c.name === swaps[0]?.out), 'a safer filler cut should remain available');
});

test('public planner may replace the expensive recurring engine with a cheaper direct same-mechanism engine', async () => {
  const plan = await planWith(directRecurringDraw);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0]?.in, directRecurringDraw.name);
  assert.equal(swaps[0]?.out, engine.name, 'a direct same-mechanism improvement should remain eligible');
});
