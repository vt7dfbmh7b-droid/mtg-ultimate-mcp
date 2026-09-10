import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';

function card(name: string, oracle: string, cmc: number, type = 'Artifact', extra: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name,
    oracle_id: name,
    name,
    lang: 'en',
    set: 'tst',
    set_name: 'Artifact Incoming Connectivity Production Test',
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
  'Anonymous Investigating Commander',
  'At the beginning of your upkeep, investigate. Whenever you draw your second card each turn, put a +1/+1 counter on this creature.',
  3,
  'Legendary Creature — Vedalken Detective',
  { color_identity: ['G', 'W', 'U'], power: '2', toughness: '3' },
);

const island = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });
const filler = card('Anonymous Expendable Filler', 'When this creature enters, you gain 2 life.', 4, 'Creature — Beast', { power: '3', toughness: '3' });

const connectedEngine = card(
  'Anonymous Connected Clue Engine',
  'Artifacts you control have hexproof. Whenever one or more artifact tokens enter the battlefield under your control, investigate. This ability triggers only once each turn. Whenever you sacrifice a Clue, draw a card.',
  3,
  'Creature — Human Detective',
  { power: '2', toughness: '3' },
);

const genericProtection = card(
  'Anonymous Generic Artifact Protection',
  'Artifacts you control have hexproof. At the beginning of your upkeep, if you control the artifact with the highest mana value or tied for the highest mana value, draw a card.',
  4,
  'Legendary Creature — Artificer',
  { power: '1', toughness: '4' },
);

function clueSupportCards(count: number) {
  return Array.from({ length: count }, (_, i) => card(
    `Anonymous Clue Support ${i}`,
    i % 3 === 0
      ? 'When this creature enters, investigate.'
      : i % 3 === 1
        ? 'Whenever you sacrifice an artifact, draw a card. This ability triggers only once each turn.'
        : 'Artifact tokens you control have ward {1}.',
    3,
    i % 3 === 2 ? 'Artifact Creature — Construct' : 'Creature — Detective',
    { power: '2', toughness: '2' },
  ));
}

async function plan() {
  const support = clueSupportCards(59);
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
      } else if (query.includes('investigate') || query.includes('clue')) {
        data = [connectedEngine];
      } else if (query.includes('hexproof') || query.includes('protection')) {
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
      themeQuery: 'artifacts and card draw',
      themeMinimumMainMatches: 0,
    });
  } finally {
    globalThis.fetch = original;
  }
}

test('public planner prefers a connected Clue engine over generic artifact protection in a dense investigate shell', async () => {
  const result = await plan();
  const swaps = result.swaps as Array<{ in: string; out: string }>;
  const debug = `serialized swaps: ${JSON.stringify(swaps)}`;
  assert.equal(swaps.length, 1, `the shell should permit one structural upgrade; ${debug}`);
  assert.equal(swaps[0]?.out, filler.name, `the disconnected filler should be the cut; ${debug}`);
  assert.equal(swaps[0]?.in, connectedEngine.name, `with identical artifact-protection text, the package-connected investigate/draw engine should outrank generic protection; ${debug}`);
});
