import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';

function card(name: string, oracle: string, cmc: number, type = 'Creature — Horror', extra: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name,
    oracle_id: name,
    name,
    lang: 'en',
    set: 'tst',
    set_name: 'Candidate Strategy Alignment Production Test',
    collector_number: name.replace(/\W/g, ''),
    released_at: '2026-01-01',
    type_line: type,
    oracle_text: oracle,
    mana_cost: `{${cmc}}`,
    cmc,
    colors: [],
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'rare',
    prices: { usd: '1.00' },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: 'https://scryfall.com',
    ...extra,
  } as ScryfallCard;
}

const reanimationCommander = card(
  'Anonymous Reanimation Commander',
  'Whenever you surveil, put a +1/+1 counter on this creature.\nAt the beginning of your end step, return target creature card with lesser power from your graveyard to the battlefield.',
  4,
  'Legendary Creature — Horror',
  { color_identity: ['U', 'B'], power: '4', toughness: '4' },
);

const equipmentCommander = card(
  'Anonymous Equipment Commander',
  'Equipment spells you cast cost {1} less to cast. Equip abilities you activate cost {1} less to activate. Whenever an equipped creature you control deals combat damage to a player, draw a card.',
  4,
  'Legendary Creature — Warrior',
  { color_identity: ['W'], power: '4', toughness: '4' },
);

const island = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });
const plains = card('Plains', '({T}: Add {W}.)', 0, 'Basic Land — Plains', { produced_mana: ['W'] });

const graveyardSetup = card(
  'Anonymous Graveyard Setup',
  'When this creature enters, search your library for a creature card, put that card into your graveyard, then shuffle.',
  5,
  'Creature — Horror',
  { power: '3', toughness: '3' },
);

const genericEquipmentValue = card(
  'Anonymous Combat Value Equipment',
  'Equipped creature gets +2/+2. Whenever equipped creature deals combat damage to a player, draw a card. Equip {2}.',
  3,
  'Artifact — Equipment',
);

function filler(prefix: string, type: string) {
  return Array.from({ length: 59 }, (_, i) => card(
    `${prefix} ${i}`,
    '',
    4,
    type,
    { power: '3', toughness: '3' },
  ));
}

async function planFor(
  commander: ScryfallCard,
  land: ScryfallCard,
  colors: string[],
  bodies: ScryfallCard[],
  themeQuery: string,
) {
  const baseline = [commander, land, ...bodies];
  const all = [...baseline, graveyardSetup, genericEquipmentValue];
  const parsed = parseDecklist([
    '// COMMANDER',
    `1 ${commander.name}`,
    '// MAIN',
    `39 ${land.name}`,
    ...bodies.map((entry) => `1 ${entry.name}`),
  ].join('\n'));

  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    let data: ScryfallCard[];
    if (url.pathname.endsWith('/cards/collection')) {
      const identifiers = JSON.parse(String(init?.body)).identifiers as Array<{ name?: string; set?: string; collector_number?: string }>;
      data = identifiers.flatMap((identifier) => all.filter((entry) => (
        identifier.name
          ? entry.name === identifier.name
          : entry.set === identifier.set && entry.collector_number === identifier.collector_number
      )));
    } else if (url.pathname.endsWith('/cards/search')) {
      const query = url.searchParams.get('q') ?? '';
      const exactName = /^!\"([^\"]+)\"$/.exec(query)?.[1];
      if (exactName) {
        data = all.filter((entry) => entry.name === exactName);
      } else {
        const normalizedQuery = query.toLowerCase();
        const requestsGraveyardTheme = normalizedQuery.includes('graveyard')
          || normalizedQuery.includes('surveil')
          || normalizedQuery.includes('return target creature card');
        const requestsEquipmentTheme = normalizedQuery.includes('t:equipment')
          || normalizedQuery.includes('equipped creature')
          || normalizedQuery.includes('equip abilities');

        if (requestsGraveyardTheme && !requestsEquipmentTheme) {
          data = [graveyardSetup];
        } else if (requestsEquipmentTheme && !requestsGraveyardTheme) {
          data = [genericEquipmentValue];
        } else {
          // Generic role/popularity searches intentionally expose both candidates so
          // the production planner still has to resolve the cross-role competition.
          data = [graveyardSetup, genericEquipmentValue];
        }
      }
    } else {
      throw new Error(`Unexpected provider request: ${url.pathname}`);
    }
    return Response.json({ object: 'list', data, has_more: false, not_found: [] });
  };

  try {
    return await buildSimulationBackedUpgradePlanV07(parsed, baseline, colors, {
      targetBracket: 3,
      maxSwaps: 1,
      maxUsdPerCard: 5,
      simulationIterations: 100,
      themeQuery,
      themeMinimumMainMatches: 0,
    });
  } finally {
    globalThis.fetch = original;
  }
}

test('public planner prefers direct graveyard setup over setup-dependent generic Equipment value for a reanimation commander', async () => {
  const bodies = filler('Anonymous Reanimation Filler', 'Creature — Horror');
  const plan = await planFor(
    reanimationCommander,
    island,
    ['U', 'B'],
    bodies,
    '(o:"graveyard" OR o:"surveil" OR o:"return target creature card")',
  );
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1, 'the isolated candidate comparison should yield one upgrade');
  assert.equal(
    swaps[0]?.in,
    graveyardSetup.name,
    'a reanimation commander should prefer direct graveyard setup over unrelated combat-damage Equipment value',
  );
});

test('public planner still prefers Equipment value when the commander explicitly rewards Equipment and equipped combat damage', async () => {
  const bodies = filler('Anonymous Equipment Filler', 'Creature — Warrior');
  const plan = await planFor(
    equipmentCommander,
    plains,
    ['W'],
    bodies,
    '(t:equipment OR o:"equipped creature" OR o:"equip abilities")',
  );
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1, 'the Equipment-aligned control should yield one upgrade');
  assert.equal(
    swaps[0]?.in,
    genericEquipmentValue.name,
    'Equipment must remain favored when its setup requirements are themselves commander-supported',
  );
});
