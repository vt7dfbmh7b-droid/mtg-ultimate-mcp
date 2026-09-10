import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';

function card(
  name: string,
  oracle: string,
  cmc: number,
  type = 'Artifact',
  extra: Partial<ScryfallCard> = {},
): ScryfallCard {
  return {
    id: name,
    oracle_id: name,
    name,
    lang: 'en',
    set: 'tst',
    set_name: 'Artifact Package Connectivity Production Test',
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

const artifactDrawEngine = card(
  'Anonymous Artifact Draw Engine',
  'Flying\nAs long as you control four or more artifacts, this creature has hexproof.\nTap two untapped artifacts you control: Draw a card.',
  6,
  'Artifact Creature — Dragon',
  { power: '5', toughness: '6' },
);

const artifactWipe = card(
  'Anonymous Artifact-Synergy Wipe',
  'Improvise\nDestroy all nonartifact creatures.',
  7,
  'Sorcery',
);

const genericArtifactProtection = card(
  'Anonymous Generic Artifact Protection',
  'Artifacts you control have hexproof. At the beginning of your upkeep, if you control the artifact with the highest mana value or tied for the highest mana value, draw a card.',
  4,
  'Legendary Creature — Artificer',
  { power: '1', toughness: '4' },
);

const genericEquipmentValue = card(
  'Anonymous Generic Equipment Value',
  'Equipped creature gets +2/+2 and has protection from red and from blue. Whenever equipped creature deals combat damage to a player, this Equipment deals 2 damage to any target and you draw a card. Equip {2}.',
  3,
  'Artifact — Equipment',
);

const expendableFiller = card(
  'Anonymous Expendable Filler',
  'When this creature enters, you gain 2 life.',
  4,
  'Creature — Beast',
  { power: '3', toughness: '3' },
);

function clueSupportCards(count: number) {
  return Array.from({ length: count }, (_, i) => card(
    `Anonymous Clue Support ${i}`,
    i % 2 === 0
      ? 'When this creature enters, investigate.'
      : 'Whenever you sacrifice an artifact, draw a card. This ability triggers only once each turn.',
    3,
    i % 2 === 0 ? 'Creature — Detective' : 'Artifact Creature — Construct',
    { power: '2', toughness: '2' },
  ));
}

type Scenario = 'draw-engine' | 'artifact-wipe' | 'expendable-control';

async function planFor(scenario: Scenario) {
  const core = scenario === 'draw-engine'
    ? artifactDrawEngine
    : scenario === 'artifact-wipe'
      ? artifactWipe
      : null;
  const incoming = scenario === 'artifact-wipe' ? genericEquipmentValue : genericArtifactProtection;
  const support = clueSupportCards(core ? 58 : 59);
  const mainCards = core
    ? [core, expendableFiller, ...support]
    : [expendableFiller, ...support];
  const baseline = [commander, island, ...mainCards];
  const all = [...baseline, genericArtifactProtection, genericEquipmentValue];
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
      const identifiers = JSON.parse(String(init?.body)).identifiers as Array<{
        name?: string;
        set?: string;
        collector_number?: string;
      }>;
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
        data = [incoming];
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

function swapsOf(plan: Awaited<ReturnType<typeof planFor>>) {
  return plan.swaps as Array<{ in: string; out: string }>;
}

test('public planner preserves a repeatable artifact-draw engine when generic protection has an expendable filler cut', async () => {
  const swaps = swapsOf(await planFor('draw-engine'));
  const debug = `serialized swaps: ${JSON.stringify(swaps)}`;
  assert.equal(swaps.length, 1, `the protection deficit should still permit one upgrade; ${debug}`);
  assert.equal(swaps[0]?.in, genericArtifactProtection.name, `generic artifact protection remains a valid incoming upgrade; ${debug}`);
  assert.notEqual(swaps[0]?.out, artifactDrawEngine.name, `dense artifact context must preserve the repeatable artifact-draw engine; ${debug}`);
  assert.equal(swaps[0]?.out, expendableFiller.name, `the disconnected filler should be preferred as the cut; ${debug}`);
});

test('public planner preserves an artifact-synergy board wipe while selecting a valid generic artifact upgrade over expendable filler', async () => {
  const swaps = swapsOf(await planFor('artifact-wipe'));
  const debug = `serialized swaps: ${JSON.stringify(swaps)}`;
  assert.equal(swaps.length, 1, `the structural search should still permit one upgrade; ${debug}`);
  assert.ok(
    [genericEquipmentValue.name, genericArtifactProtection.name].includes(swaps[0]?.in ?? ''),
    `a valid generic artifact upgrade should remain selectable without dictating an irrelevant tie-break; ${debug}`,
  );
  assert.notEqual(swaps[0]?.out, artifactWipe.name, `dense artifact context must not sacrifice the artifact-synergy board wipe for generic value; ${debug}`);
  assert.equal(swaps[0]?.out, expendableFiller.name, `the disconnected filler should be preferred as the cut; ${debug}`);
});

test('package-connectivity preservation does not suppress a generic structural upgrade when only expendable filler is at stake', async () => {
  const swaps = swapsOf(await planFor('expendable-control'));
  const debug = `serialized swaps: ${JSON.stringify(swaps)}`;
  assert.equal(swaps.length, 1, `the expendable control should still accept one upgrade; ${debug}`);
  assert.equal(swaps[0]?.in, genericArtifactProtection.name, `generic artifact protection should remain selectable in the positive control; ${debug}`);
  assert.equal(swaps[0]?.out, expendableFiller.name, `the genuinely disconnected filler remains the correct cut; ${debug}`);
});
