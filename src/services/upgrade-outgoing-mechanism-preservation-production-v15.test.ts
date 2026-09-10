import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';

function card(
  name: string,
  oracle: string,
  cmc: number,
  type = 'Creature — Test',
  extra: Partial<ScryfallCard> = {},
): ScryfallCard {
  return {
    id: name,
    oracle_id: name,
    name,
    lang: 'en',
    set: 'tst',
    set_name: 'Outgoing Mechanism Preservation Production Test',
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
  'Anonymous Graveyard Commander',
  'Whenever you surveil, put a +1/+1 counter on this creature. At the beginning of your end step, return target creature card with lesser power from your graveyard to the battlefield.',
  4,
  'Legendary Creature — Horror',
  { color_identity: ['U', 'B'], power: '4', toughness: '4' },
);

const island = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });

const simpleCoreReanimation = card(
  'Anonymous Simple Reanimation Aura',
  'Enchant creature card in a graveyard. When this Aura enters the battlefield, return enchanted creature card to the battlefield under your control.',
  2,
  'Enchantment — Aura',
);

const oracleShapedCoreReanimation = card(
  'Anonymous Oracle-Shaped Reanimation Aura',
  'Enchant creature card in a graveyard\nWhen this Aura enters the battlefield, if it is on the battlefield, it loses "enchant creature card in a graveyard" and gains "enchant creature put onto the battlefield with this Aura." Return enchanted creature card to the battlefield under your control and attach this Aura to it. When this Aura leaves the battlefield, that creature\'s controller sacrifices it.\nEnchanted creature gets -1/-0.',
  2,
  'Enchantment — Aura',
);

const genericProtection = card(
  'Anonymous Generic Protection Aura',
  'Enchant permanent. Enchanted permanent has hexproof. When enchanted permanent leaves the battlefield, draw two cards.',
  3,
  'Enchantment — Aura',
);

function fillerCards(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => card(
    `${prefix} ${i}`,
    i === 0 ? 'When this creature enters the battlefield, draw a card.' : '',
    i === 0 ? 3 : 4,
    'Creature — Horror',
    { power: '3', toughness: '3' },
  ));
}

type CoreShape = 'none' | 'simple' | 'oracle-shaped';

async function planFor(coreShape: CoreShape, themeQuery = '(o:"graveyard" OR o:"surveil" OR o:"return target creature card")') {
  const core = coreShape === 'simple'
    ? simpleCoreReanimation
    : coreShape === 'oracle-shaped'
      ? oracleShapedCoreReanimation
      : null;
  const fillers = fillerCards(
    core ? `Anonymous ${coreShape} Reanimation Filler` : 'Anonymous Control Filler',
    core ? 59 : 60,
  );
  const mainCards = core ? [core, ...fillers] : fillers;
  const baseline = [commander, island, ...mainCards];
  const all = [...baseline, genericProtection];
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
        const normalized = query.toLowerCase();
        const graveyardTheme = normalized.includes('graveyard')
          || normalized.includes('surveil')
          || normalized.includes('return target creature card');
        if (graveyardTheme && core) {
          data = [core];
        } else {
          data = [genericProtection];
        }
      }
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
      themeQuery,
      themeMinimumMainMatches: 0,
    });
  } finally {
    globalThis.fetch = original;
  }
}

function swapDebug(swaps: Array<{ in: string; out: string }>): string {
  return `serialized swaps: ${JSON.stringify(swaps)}`;
}

async function assertCorePreserved(
  coreShape: Exclude<CoreShape, 'none'>,
  coreName: string,
  themeQuery?: string,
) {
  const plan = await planFor(coreShape, themeQuery);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  const debug = swapDebug(swaps);

  assert.equal(swaps.length, 1, `the structural protection deficit should still produce one upgrade; ${debug}`);
  assert.equal(swaps[0]?.in, genericProtection.name, `generic protection should remain a valid incoming structural upgrade; ${debug}`);
  assert.notEqual(
    swaps[0]?.out,
    coreName,
    `the public planner must not sacrifice the direct reanimation engine while a low-mechanism filler cut is available; ${debug}`,
  );
  assert.match(swaps[0]?.out ?? '', /Reanimation Filler /, `the safer low-mechanism filler should be cut instead; ${debug}`);
}

function serializedCutRoleEvidence(plan: Record<string, unknown>, cardName: string): { offeredAsCut: boolean; roles: string[] } {
  const analysis = plan.sourceUpgradeAnalysis as Record<string, unknown> | undefined;
  const cuts = Array.isArray(analysis?.candidateCuts) ? analysis.candidateCuts as Array<Record<string, unknown>> : [];
  const match = cuts.find((cut) => {
    const summary = cut.card as Record<string, unknown> | undefined;
    return summary?.name === cardName;
  });
  const summary = match?.card as Record<string, unknown> | undefined;
  const roles = Array.isArray(summary?.roles) ? summary.roles.filter((role): role is string => typeof role === 'string') : [];
  return { offeredAsCut: Boolean(match), roles };
}

test('public planner preserves a simple core commander reanimation mechanism when generic protection has a safer filler cut', async () => {
  await assertCorePreserved('simple', simpleCoreReanimation.name);
});

test('public planner preserves an Oracle-shaped core commander reanimation Aura when generic protection has a safer filler cut', async () => {
  await assertCorePreserved('oracle-shaped', oracleShapedCoreReanimation.name);
});

test('public planner preserves an Oracle-shaped reanimation Aura under the real compound graveyard-and-card-draw request shape', async () => {
  await assertCorePreserved('oracle-shaped', oracleShapedCoreReanimation.name, 'graveyard and card draw');
});

test('public planner either protects reanimation Auras from the cut pool or serializes them as graveyard recursion', async () => {
  const simplePlan = await planFor('simple');
  const oraclePlan = await planFor('oracle-shaped', 'graveyard and card draw');
  const simpleEvidence = serializedCutRoleEvidence(simplePlan, simpleCoreReanimation.name);
  const oracleEvidence = serializedCutRoleEvidence(oraclePlan, oracleShapedCoreReanimation.name);

  assert.ok(
    !simpleEvidence.offeredAsCut || simpleEvidence.roles.includes('graveyard recursion'),
    `simple graveyard-enchant reanimation Aura was offered as an untyped cut: ${JSON.stringify(simpleEvidence)}`,
  );
  assert.ok(
    !oracleEvidence.offeredAsCut || oracleEvidence.roles.includes('graveyard recursion'),
    `Oracle-shaped graveyard-enchant reanimation Aura was offered as an untyped cut: ${JSON.stringify(oracleEvidence)}`,
  );
});

test('public planner still selects generic protection when the outgoing pool contains only low-mechanism filler', async () => {
  const plan = await planFor('none');
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  const debug = swapDebug(swaps);

  assert.equal(swaps.length, 1, `the expendable-control deck should still accept one structural protection upgrade; ${debug}`);
  assert.equal(swaps[0]?.in, genericProtection.name, `mechanism preservation must not globally suppress generic protection; ${debug}`);
  assert.match(swaps[0]?.out ?? '', /^Anonymous Control Filler /, `a genuinely expendable filler remains a legal cut; ${debug}`);
});
