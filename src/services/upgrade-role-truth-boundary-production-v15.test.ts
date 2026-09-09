import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';
import { effectiveCardRolesV15 } from './card-role-truth-v15.js';
import { summarizeCard } from './scryfall.js';

function card(name: string, oracle: string, cmc: number, type = 'Artifact', extra: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name,
    oracle_id: name,
    name,
    lang: 'en',
    set: 'tst',
    set_name: 'Role Truth Boundary Test',
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
  'Anonymous Patient Researcher',
  'Whenever you cast your second spell each turn, draw a card.',
  3,
  'Legendary Creature — Wizard',
  { color_identity: ['U'], power: '2', toughness: '4' },
);
const island = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });
const multiplierEngine = card(
  'Anonymous Replication Engine',
  'If you would create one or more tokens under your control, create twice as many tokens instead.',
  9,
  'Enchantment',
);
const filler = Array.from({ length: 23 }, (_, i) => card(`Anonymous Replaceable Body ${i}`, '', 3, 'Creature — Wizard', { power: '2', toughness: '2' }));
const support = [
  ...Array.from({ length: 10 }, (_, i) => card(`Anonymous Mana Rock ${i}`, '{T}: Add {U}.', 2, 'Artifact', { produced_mana: ['U'] })),
  ...Array.from({ length: 10 }, (_, i) => card(`Anonymous Card Flow ${i}`, 'Draw two cards.', 2, 'Sorcery')),
  ...Array.from({ length: 10 }, (_, i) => card(`Anonymous Counterspell ${i}`, 'Counter target spell.', 2, 'Instant')),
  ...Array.from({ length: 4 }, (_, i) => card(`Anonymous Protection ${i}`, 'Permanents you control gain hexproof until end of turn.', 2, 'Instant')),
  ...Array.from({ length: 2 }, (_, i) => card(`Anonymous Board Reset ${i}`, 'Destroy all creatures.', 4, 'Sorcery')),
];
const genericTutor = card(
  'Anonymous Generic Search',
  'Search your library for a card, put it into your hand, then shuffle.',
  1,
  'Sorcery',
);
const mechanismTutor = card(
  'Anonymous Replicating Search',
  'When this enchantment enters, search your library for a card, put it into your hand, then shuffle.\nIf you would create one or more tokens under your control, create twice as many tokens instead.',
  2,
  'Enchantment',
);
const baseline = [commander, island, multiplierEngine, ...support, ...filler];
const parsed = parseDecklist([
  '// COMMANDER',
  `1 ${commander.name}`,
  '// MAIN',
  '39 Island',
  `1 ${multiplierEngine.name}`,
  ...support.map((entry) => `1 ${entry.name}`),
  ...filler.map((entry) => `1 ${entry.name}`),
].join('\n'));
const all = [...baseline, genericTutor, mechanismTutor];

async function planWith(candidate: ScryfallCard) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    let data: ScryfallCard[];
    if (url.pathname.endsWith('/cards/collection')) {
      const identifiers = JSON.parse(String(init?.body)).identifiers as Array<{ name?: string; set?: string; collector_number?: string }>;
      data = identifiers.flatMap((identifier) => all.filter((entry) => identifier.name
        ? entry.name === identifier.name
        : entry.set === identifier.set && entry.collector_number === identifier.collector_number));
    } else if (url.pathname.endsWith('/cards/search')) {
      const query = url.searchParams.get('q') ?? '';
      const exactName = /^!"([^"]+)"$/.exec(query)?.[1];
      data = exactName ? all.filter((entry) => entry.name === exactName) : [candidate];
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
      excludedCards: [genericTutor, mechanismTutor].filter((entry) => entry.name !== candidate.name).map((entry) => entry.name),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('serialized card summaries carry the same authoritative operational engine roles used by structural accounting', () => {
  assert.ok(effectiveCardRolesV15(multiplierEngine).includes('token multiplier'));
  assert.ok(
    summarizeCard(multiplierEngine).roles.includes('token multiplier'),
    'replacement preservation must not receive a weaker role set than target accounting',
  );
});

test('public planner keeps an effective-only operational engine when a safer filler cut exists', async () => {
  const plan = await planWith(genericTutor);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1, 'the tutor deficit still permits a useful swap');
  assert.equal(swaps[0]?.in, genericTutor.name);
  assert.notEqual(swaps[0]?.out, multiplierEngine.name, 'a generic structural gain must not consume an uncompensated operational engine when filler is available');
  assert.ok(filler.some((entry) => entry.name === swaps[0]?.out), 'the safer filler cut should remain available');
});

test('public planner may replace the operational engine when the incoming card preserves the same mechanism', async () => {
  const plan = await planWith(mechanismTutor);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0]?.in, mechanismTutor.name);
  assert.equal(swaps[0]?.out, multiplierEngine.name, 'same-mechanism compensation should not become a blanket no-cut rule');
});
