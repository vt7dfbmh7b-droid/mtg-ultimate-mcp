import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const A21_PATH = 'test-results/exploratory/counter-blitz-a21-final-deck.txt';
const LEGACY_COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
] as const;

const COMPONENTS = {
  W: {
    label: 'White Mage',
    cut: '1 Sram, Senior Edificer (FCA) 3',
    add: '1 The Destined White Mage (FIC) 444',
  },
  T: {
    label: 'Tromell',
    cut: '1 Puresteel Paladin (FIC) 250',
    add: "1 Tromell, Seymour's Butler (FIC) 162",
  },
  R: {
    label: 'Rikku',
    cut: '1 Key to the City (FIC) 348',
    add: '1 Rikku, Resourceful Guardian (FIC) 145',
  },
} as const;

type ComponentKey = keyof typeof COMPONENTS;
const VARIANTS: Array<{ id: string; components: ComponentKey[] }> = [
  { id: 'W', components: ['W'] },
  { id: 'T', components: ['T'] },
  { id: 'R', components: ['R'] },
  { id: 'WT', components: ['W', 'T'] },
  { id: 'WR', components: ['W', 'R'] },
  { id: 'TR', components: ['T', 'R'] },
  { id: 'WTR', components: ['W', 'T', 'R'] },
];

const SCENARIOS: Array<{ pressure: PodPressureV06; turns: number; seed: number }> = [
  { pressure: 'upgraded', turns: 5, seed: 20260830 },
  { pressure: 'upgraded', turns: 7, seed: 20260905 },
  { pressure: 'optimized', turns: 5, seed: 20260919 },
  { pressure: 'optimized', turns: 7, seed: 20261011 },
  { pressure: 'cedh', turns: 5, seed: 20261107 },
  { pressure: 'cedh', turns: 7, seed: 20261213 },
  { pressure: 'cedh', turns: 9, seed: 20270123 },
];

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function num(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function avg(values: readonly number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

async function resolveDeck(decklist: string) {
  const parsed = parseDecklist(decklist);
  const result = await getCardsByIdentifiers(identifiers(parsed));
  return { parsed, cards: result.cards, notFound: result.notFound };
}

function renderVariant(base: string, components: readonly ComponentKey[]): string {
  let text = base;
  for (const key of components) {
    const component = COMPONENTS[key];
    assert.ok(text.includes(component.cut), `missing cut line for ${component.label}`);
    text = text.replace(component.cut, component.add);
  }
  return text;
}

interface Signal {
  keep: number;
  uptime: number;
  protection: number;
  spells: number;
  draws: number;
  route1: number;
  route2: number;
}

function signal(result: Record<string, unknown>, turns: number): Signal {
  const baseline = rec(result.baseline);
  const opening = rec(baseline.openingHands);
  const advanced = rec(result.advanced);
  const commander = rec(advanced.commanderPressure);
  const interaction = rec(advanced.interactionPressure);
  const flow = rec(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const key = `turn${turns}`;
  const ready = combos.map((combo) => num(rec(combo.allNamedPiecesInHandOrBattlefieldByTurn)[key]));
  return {
    keep: num(opening.functionalKeepRate),
    uptime: num(commander.battlefieldUptimePercent),
    protection: num(interaction.protectionWinRateWhenChallenged),
    spells: num(flow.averageSpellsCast),
    draws: num(flow.averageCardsDrawnByEffects),
    route1: ready[0] ?? 0,
    route2: ready[1] ?? 0,
  };
}

function difference(before: Signal, after: Signal): Signal {
  return {
    keep: after.keep - before.keep,
    uptime: after.uptime - before.uptime,
    protection: after.protection - before.protection,
    spells: after.spells - before.spells,
    draws: after.draws - before.draws,
    route1: after.route1 - before.route1,
    route2: after.route2 - before.route2,
  };
}

function mean(rows: readonly Signal[]): Signal {
  return {
    keep: avg(rows.map((row) => row.keep)),
    uptime: avg(rows.map((row) => row.uptime)),
    protection: avg(rows.map((row) => row.protection)),
    spells: avg(rows.map((row) => row.spells)),
    draws: avg(rows.map((row) => row.draws)),
    route1: avg(rows.map((row) => row.route1)),
    route2: avg(rows.map((row) => row.route2)),
  };
}

function severe(change: Signal): string[] {
  const failures: string[] = [];
  if (change.keep < -2.5) failures.push('keep');
  if (change.uptime < -4) failures.push('commander-uptime');
  if (change.protection < -8) failures.push('protection');
  if (change.spells < -0.25) failures.push('spells');
  if (change.draws < -0.45) failures.push('draws');
  if (change.route1 < -3.5) failures.push('legacy-route-1');
  if (change.route2 < -3.5) failures.push('legacy-route-2');
  return failures;
}

function runSimulation(parsed: ParsedDeck, cards: any[], scenario: { pressure: PodPressureV06; turns: number; seed: number }): Signal {
  const result = simulateDeckGameplayV06(parsed, cards, {
    iterations: 1200,
    advancedIterations: 1200,
    turns: scenario.turns,
    seed: scenario.seed,
    pressure: scenario.pressure,
    comboPieces: LEGACY_COMBOS,
  }) as unknown as Record<string, unknown>;
  return signal(result, scenario.turns);
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A22 COMPONENT ISOLATION');
  const baseText = await readFile(A21_PATH, 'utf8');
  const base = await resolveDeck(baseText);
  assert.equal(base.notFound.length, 0, 'A21 unresolved cards');
  assert.equal(base.parsed.totalCards, 100, 'A21 not exact 100');

  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const baselineSignals = SCENARIOS.map((scenario) => runSimulation(base.parsed, base.cards, scenario));
  const baseMetrics = buildDeckMetrics(base.parsed, base.cards);
  const results: Array<Record<string, unknown>> = [];

  for (const variant of VARIANTS) {
    const state = await resolveDeck(renderVariant(baseText, variant.components));
    const legal = validateCommanderDeck(state.parsed, state.cards);
    const hardFailures: string[] = [];
    if (state.notFound.length) hardFailures.push(`unresolved: ${state.notFound.join(', ')}`);
    if (state.parsed.totalCards !== 100) hardFailures.push(`card-count-${state.parsed.totalCards}`);
    if (!legal.isLegal) hardFailures.push('commander-illegal');
    if (!state.cards.every((card) => printingMatchesPolicyV08(card, policy))) hardFailures.push('ff-printing-policy');

    const scenarioDeltas = SCENARIOS.map((scenario, index) => {
      const after = runSimulation(state.parsed, state.cards, scenario);
      return difference(baselineSignals[index], after);
    });
    const meanDelta = mean(scenarioDeltas);
    const simulationFailures = severe(meanDelta);
    const metrics = buildDeckMetrics(state.parsed, state.cards);

    results.push({
      id: variant.id,
      components: variant.components.map((key) => COMPONENTS[key].label),
      hardFailures,
      simulationFailures,
      status: hardFailures.length ? 'HARD-FAIL' : simulationFailures.length ? 'REVIEW' : 'PASS',
      metrics: {
        averageNonlandManaValue: metrics.averageNonlandManaValue,
        earlyPlayCount: metrics.earlyPlayCount,
        rampCount: metrics.rampCount,
        cheapInteractionCount: metrics.cheapInteractionCount,
        persistentColoredManaSourceCount: metrics.persistentColoredManaSourceCount,
      },
      meanDelta,
      scenarioDeltas,
    });
  }

  const output = {
    baseline: {
      averageNonlandManaValue: baseMetrics.averageNonlandManaValue,
      earlyPlayCount: baseMetrics.earlyPlayCount,
      rampCount: baseMetrics.rampCount,
      cheapInteractionCount: baseMetrics.cheapInteractionCount,
      persistentColoredManaSourceCount: baseMetrics.persistentColoredManaSourceCount,
    },
    thresholds: { spells: -0.25, draws: -0.45, keep: -2.5, uptime: -4, protection: -8 },
    results,
    interpretation: 'This isolates generic simulation cost only. It does not score Tromell/Rikku/White Mage text synergy completely.',
  };
  await writeFile('counter-blitz-a22-component-isolation.json', JSON.stringify(output, null, 2));

  const lines = [
    '# Counter Blitz A22 — Component Isolation',
    '',
    'A21 baseline compared with each proposed synergy component alone and in combinations.',
    '',
    '| Variant | Components | Status | MV | Early plays | Δ spells | Δ draws | Δ uptime | Δ protection |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ...results.map((result) => {
      const r = result as any;
      return `| ${r.id} | ${r.components.join(' + ')} | ${r.status} | ${Number(r.metrics.averageNonlandManaValue).toFixed(3)} | ${r.metrics.earlyPlayCount} | ${Number(r.meanDelta.spells).toFixed(3)} | ${Number(r.meanDelta.draws).toFixed(3)} | ${Number(r.meanDelta.uptime).toFixed(3)} | ${Number(r.meanDelta.protection).toFixed(3)} |`;
    }),
    '',
    'Simulation is a regression guard only; direct counter/combat synergy still requires manual judgment.',
    '',
  ];
  await writeFile('counter-blitz-a22-component-isolation.md', lines.join('\n'));
  console.log(lines.join('\n'));
}

await main();
