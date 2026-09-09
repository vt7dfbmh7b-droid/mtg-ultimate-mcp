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
    set_name: 'Reanimation Payload Production Test',
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
  'Anonymous Graveyard Commander',
  'Whenever you surveil, put a +1/+1 counter on this creature.\nAt the beginning of your end step, return target creature card with lesser power from your graveyard to the battlefield.',
  4,
  'Legendary Creature — Horror',
  { color_identity: ['U', 'B'], power: '4', toughness: '4' },
);
const island = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });
const payload = card(
  'Anonymous Reanimation Payload',
  'When this creature enters, each opponent sacrifices two creatures and loses 3 life.',
  7,
  'Creature — Horror',
  { power: '6', toughness: '6' },
);
const filler = Array.from({ length: 59 }, (_, i) => card(
  `Anonymous Replaceable Body ${i}`,
  '',
  4,
  'Creature — Horror',
  { power: '3', toughness: '3' },
));
const answer = card('Anonymous Efficient Answer', 'Counter target spell.', 2, 'Instant');
const sameMechanismPayload = card(
  'Anonymous Better Payload',
  'When this creature enters, each opponent sacrifices three creatures and you draw a card.',
  6,
  'Creature — Horror',
  { power: '6', toughness: '6' },
);
const baseline = [commander, island, payload, ...filler];
const parsed = parseDecklist([
  '// COMMANDER',
  `1 ${commander.name}`,
  '// MAIN',
  '39 Island',
  `1 ${payload.name}`,
  ...filler.map((entry) => `1 ${entry.name}`),
].join('\n'));
const all = [...baseline, answer, sameMechanismPayload];

async function planWith(candidates: ScryfallCard[]) {
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
      data = exactName ? all.filter((entry) => entry.name === exactName) : candidates;
    } else {
      throw new Error(`Unexpected provider request: ${url.pathname}`);
    }
    return Response.json({ object: 'list', data, has_more: false, not_found: [] });
  };

  try {
    return await buildSimulationBackedUpgradePlanV07(parsed, baseline, ['U', 'B'], {
      targetBracket: 3,
      maxSwaps: 1,
      maxUsdPerCard: 5,
      simulationIterations: 100,
      themeQuery: '(o:"graveyard" OR o:"surveil" OR o:"return target creature card")',
      themeMinimumMainMatches: 0,
      excludedCards: [answer, sameMechanismPayload].filter((entry) => !candidates.includes(entry)).map((entry) => entry.name),
    });
  } finally {
    globalThis.fetch = original;
  }
}

test('public planner preserves a high-impact reanimation payload while safer filler exists', async () => {
  const plan = await planWith([answer]);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1, 'a real interaction deficit should still permit one useful upgrade');
  assert.equal(swaps[0]?.in, answer.name);
  assert.notEqual(
    swaps[0]?.out,
    payload.name,
    'a reanimator should not discard a high-impact creature payload merely because its own Oracle text lacks graveyard wording',
  );
  assert.equal((plan.upgradedCommanderRules as { isLegal: boolean }).isLegal, true);
});

test('public planner may replace a reanimation payload with a stronger payload rather than freezing the slot', async () => {
  const plan = await planWith([sameMechanismPayload]);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1, 'same-mechanism improvement should remain available');
  assert.equal(swaps[0]?.in, sameMechanismPayload.name);
  assert.equal(
    swaps[0]?.out,
    payload.name,
    'payload preservation must be advisory and permit a credible stronger payload replacement',
  );
});
