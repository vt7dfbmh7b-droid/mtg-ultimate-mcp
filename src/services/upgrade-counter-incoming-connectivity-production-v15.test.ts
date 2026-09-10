import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';

function card(name: string, oracle: string, cmc: number, type = 'Creature — Human', extra: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name,
    oracle_id: name,
    name,
    lang: 'en',
    set: 'tst',
    set_name: 'Counter Incoming Connectivity Production Test',
    collector_number: name.replace(/\W/g, ''),
    released_at: '2026-01-01',
    type_line: type,
    oracle_text: oracle,
    mana_cost: cmc > 0 ? `{${cmc}}` : '',
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

const commander = card(
  'Anonymous Counter Commander',
  'Whenever one or more +1/+1 counters are put on another creature you control, draw a card. This ability triggers only once each turn.',
  3,
  'Legendary Creature — Human Advisor',
  { color_identity: ['G', 'W', 'U'], power: '2', toughness: '4' },
);

const island = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });
const filler = card('Anonymous Counter-Shell Filler', 'When this creature enters, you gain 2 life.', 4, 'Creature — Beast', { power: '3', toughness: '3' });

const connectedEngine = card(
  'Anonymous Connected Counter Engine',
  'Other creatures you control have ward {1}. Whenever one or more +1/+1 counters are put on a creature you control, proliferate. This ability triggers only once each turn. Whenever you proliferate, draw a card.',
  3,
  'Creature — Human Wizard',
  { power: '2', toughness: '3' },
);

const genericProtection = card(
  'Anonymous Generic Creature Protection',
  'Other creatures you control have ward {1}. At the beginning of your upkeep, draw a card.',
  4,
  'Creature — Human Cleric',
  { power: '2', toughness: '4' },
);

function counterSupportCards(count: number) {
  return Array.from({ length: count }, (_, i) => card(
    `Anonymous Counter Support ${i}`,
    i % 3 === 0
      ? 'When this creature enters, put a +1/+1 counter on target creature you control.'
      : i % 3 === 1
        ? 'Whenever one or more +1/+1 counters are put on this creature, draw a card. This ability triggers only once each turn.'
        : 'At the beginning of combat on your turn, put a +1/+1 counter on another target creature you control.',
    3,
    'Creature — Human Soldier',
    { power: '2', toughness: '2' },
  ));
}

async function plan() {
  const support = counterSupportCards(59);
  const mainCards = [filler, ...support];
  const baseline = [commander, island, ...mainCards];
  const all = [...baseline, connectedEngine, genericProtection];
  const parsed = parseDecklist([
    '// COMMANDER',
    `1 ${commander.name}`,
    '// MAIN',
    `39 ${island.name}`,
    ...mainCards.map((entry) => `1 ${entry.name}`),
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
      const query = (url.searchParams.get('q') ?? '').toLowerCase();
      const exactName = /^!\"([^\"]+)\"$/.exec(url.searchParams.get('q') ?? '')?.[1];
      if (exactName) {
        data = all.filter((entry) => entry.name === exactName);
      } else if (query.includes('+1/+1') || query.includes('counter') || query.includes('proliferate')) {
        data = [connectedEngine];
      } else if (query.includes('ward') || query.includes('protection')) {
        data = [genericProtection];
      } else {
        data = [connectedEngine, genericProtection];
      }
    } else {
      throw new Error(`Unexpected provider request: ${url.pathname}`);
    }
    return Response.json({ object: 'list', data, has_more: false, not_found: [] });
  };

  try {
    return await buildSimulationBackedUpgradePlanV07(parsed, baseline, ['G', 'W', 'U'], {
      targetBracket: 3,
      maxSwaps: 1,
      maxUsdPerCard: 5,
      simulationIterations: 100,
      themeQuery: '+1/+1 counters and card draw',
      themeMinimumMainMatches: 0,
    });
  } finally {
    globalThis.fetch = original;
  }
}

test('public planner prefers a connected counter engine over generic creature protection when both address the same protection deficit', async () => {
  const result = await plan();
  const swaps = result.swaps as Array<{ in: string; out: string }>;
  const debug = `serialized swaps: ${JSON.stringify(swaps)}`;
  assert.equal(swaps.length, 1, `the shell should permit one structurally equivalent protection upgrade; ${debug}`);
  assert.equal(swaps[0]?.out, filler.name, `the disconnected filler should be the cut; ${debug}`);
  assert.equal(swaps[0]?.in, connectedEngine.name, `with structural protection value equalized, the package-connected counter/draw engine should outrank generic protection; ${debug}`);
});
