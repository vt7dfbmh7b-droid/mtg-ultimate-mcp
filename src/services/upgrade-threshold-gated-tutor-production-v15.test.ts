import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';
import { effectiveCardRolesV15, tutorRoleTruthV15 } from './card-role-truth-v15.js';

function card(name: string, oracle: string, cmc: number, type = 'Artifact', extra: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name,
    oracle_id: name,
    name,
    lang: 'en',
    set: 'tst',
    set_name: 'Threshold Tutor Test',
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

const commander = card(
  'Anonymous Clue Analyst',
  'Whenever you draw your second card each turn, put a +1/+1 counter on this creature.',
  3,
  'Legendary Creature — Detective',
  { color_identity: ['U'], power: '2', toughness: '3' },
);
const land = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });
const filler = Array.from({ length: 59 }, (_, i) => card(`Anonymous Surplus Body ${i}`, '', 4, 'Creature — Detective', { power: '3', toughness: '3' }));
const support = [
  ...Array.from({ length: 10 }, (_, i) => card(`Anonymous Mana Support ${i}`, '{T}: Add {U}.', 2, 'Artifact', { produced_mana: ['U'] })),
  ...Array.from({ length: 10 }, (_, i) => card(`Anonymous Draw Support ${i}`, 'Draw two cards.', 2, 'Sorcery')),
  ...Array.from({ length: 10 }, (_, i) => card(`Anonymous Answer ${i}`, 'Counter target spell.', 2, 'Instant')),
  ...Array.from({ length: 4 }, (_, i) => card(`Anonymous Shield ${i}`, 'Permanents you control gain hexproof until end of turn.', 2, 'Instant')),
  ...Array.from({ length: 2 }, (_, i) => card(`Anonymous Reset ${i}`, 'Destroy all creatures.', 4, 'Sorcery')),
];

const thresholdTutor = card(
  'Anonymous Quest Archive',
  'At the beginning of each end step, if you drew two or more cards this turn, you may put a quest counter on this enchantment.\nAs long as this enchantment has six or more quest counters on it, if you would draw a card, you may instead search your library for a card, put that card into your hand, then shuffle.',
  3,
  'Enchantment',
);
const directTutor = card(
  'Anonymous Immediate Search',
  'Search your library for a card, put that card into your hand, then shuffle.',
  2,
  'Sorcery',
);

const baseline = [commander, land, ...support, ...filler.slice(0, 24)];
const parsed = parseDecklist([
  '// COMMANDER',
  `1 ${commander.name}`,
  '// MAIN',
  '39 Island',
  ...support.map(c => `1 ${c.name}`),
  ...filler.slice(0, 24).map(c => `1 ${c.name}`),
].join('\n'));
const all = [...baseline, thresholdTutor, directTutor];

async function planWith(allowed: ScryfallCard[]) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    let data: ScryfallCard[];
    if (url.pathname.endsWith('/cards/collection')) {
      const identifiers = JSON.parse(String(init?.body)).identifiers as Array<{ name?: string; set?: string; collector_number?: string }>;
      data = identifiers.flatMap(id => all.filter(c => id.name ? c.name === id.name : c.set === id.set && c.collector_number === id.collector_number));
    } else if (url.pathname.endsWith('/cards/search')) {
      const query = url.searchParams.get('q') ?? '';
      const name = /^!\"([^\"]+)\"$/.exec(query)?.[1];
      data = name ? all.filter(c => c.name === name) : [thresholdTutor, directTutor];
    } else {
      throw new Error(`Unexpected provider request: ${url.pathname}`);
    }
    return Response.json({ object: 'list', data, has_more: false, not_found: [] });
  };
  try {
    return await buildSimulationBackedUpgradePlanV07(parsed, baseline, ['U'], {
      targetBracket: 3,
      maxSwaps: 1,
      maxUsdPerCard: 5,
      simulationIterations: 100,
      excludedCards: [thresholdTutor, directTutor].filter(c => !allowed.includes(c)).map(c => c.name),
    });
  } finally {
    globalThis.fetch = original;
  }
}

test('threshold-gated library search is conditional rather than reliable structural tutor access', () => {
  const truth = tutorRoleTruthV15(thresholdTutor);
  assert.equal(truth.setupGated, true);
  assert.ok(effectiveCardRolesV15(thresholdTutor).includes('conditional tutor'));
  assert.ok(!effectiveCardRolesV15(thresholdTutor).includes('tutor'));
});

test('public production planner does not spend a tutor slot on search locked behind accumulated threshold counters', async () => {
  const plan = await planWith([thresholdTutor]);
  assert.deepEqual(plan.swaps, []);
});

test('public production planner still accepts immediate broad tutor access under the same deck state', async () => {
  const plan = await planWith([thresholdTutor, directTutor]);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0]?.in, directTutor.name);
});
