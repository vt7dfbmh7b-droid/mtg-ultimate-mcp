import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';

function card(name: string, oracle: string, cmc: number, type = 'Creature — Test', extra: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name,
    oracle_id: name,
    name,
    lang: 'en',
    set: 'tst',
    set_name: 'Theme Component Priority Production Test',
    collector_number: name.replace(/\W/g, ''),
    released_at: '2026-01-01',
    type_line: type,
    oracle_text: oracle,
    mana_cost: cmc === 0 ? '{0}' : `{${cmc}}`,
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
  'Whenever you put a counter on a permanent you control, draw a card.',
  3,
  'Legendary Creature — Human',
  { color_identity: ['U'], power: '2', toughness: '3' },
);
const island = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });
const existingCounterspell = card('Anonymous Existing Counterspell', 'Counter target spell.', 2, 'Instant');
const filler = Array.from({ length: 59 }, (_, index) => card(`Anonymous Expendable Body ${index}`, '', 4));
const incomingCounterspell = card('Anonymous Incoming Counterspell', 'Counter target spell.', 2, 'Instant');
const genericEarlyCard = card('Anonymous Generic Early Card', 'A vanilla one-drop.', 1);
const allCards = [commander, island, existingCounterspell, ...filler, incomingCounterspell, genericEarlyCard];

test('the public planner gives an under-target requested mechanism the first bounded selection opportunity', async () => {
  const parsed = parseDecklist([
    '// COMMANDER',
    `1 ${commander.name}`,
    '// MAIN',
    '39 Island',
    `1 ${existingCounterspell.name}`,
    ...filler.map((entry) => `1 ${entry.name}`),
  ].join('\n'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/cards/collection')) {
      const identifiers = JSON.parse(String(init?.body)).identifiers as Array<{ name?: string; set?: string; collector_number?: string }>;
      const data = identifiers.flatMap((identifier) => allCards.filter((entry) => (
        identifier.name
          ? entry.name === identifier.name
          : entry.set === identifier.set && entry.collector_number === identifier.collector_number
      )));
      return Response.json({ object: 'list', data, has_more: false, not_found: [] });
    }
    if (url.pathname.endsWith('/cards/search')) {
      const query = url.searchParams.get('q') ?? '';
      const exactName = /^!"([^"]+)"$/.exec(query)?.[1];
      if (exactName) {
        return Response.json({ object: 'list', data: allCards.filter((entry) => entry.name === exactName), has_more: false, not_found: [] });
      }
      const data = query.includes('o:"counter target" o:"spell"')
        ? [incomingCounterspell]
        : [genericEarlyCard];
      return Response.json({ object: 'list', data, has_more: false, not_found: [] });
    }
    throw new Error(`Unexpected provider request: ${url.pathname}`);
  };

  try {
    const plan = await buildSimulationBackedUpgradePlanV07(parsed, [commander, island, existingCounterspell, ...filler], ['U'], {
      targetBracket: 5,
      maxSwaps: 1,
      maxUsdPerCard: 5,
      simulationIterations: 100,
      themeComponents: [{
        id: 'countermagic',
        queryClause: '(o:"counter target" o:"spell")',
        currentMainMatches: 1,
        requiredMainMatches: 8,
      }],
    });
    const swaps = plan.swaps as Array<{ in: string; out: string }>;
    assert.equal(swaps.length, 1, `the focused component should permit one safe swap: ${JSON.stringify(swaps)}`);
    assert.equal(swaps[0]?.in, incomingCounterspell.name);
    assert.notEqual(swaps[0]?.out, existingCounterspell.name);
    const order = plan.candidateSelectionOrder as Array<{ role: string }>;
    assert.equal(order[0]?.role, 'theme-component');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
