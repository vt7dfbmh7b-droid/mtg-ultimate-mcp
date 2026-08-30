import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { comboAccessQualityV15 } from '../src/services/combo-access-quality-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';
import {
  BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15,
  BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15,
  minimumPersistentColoredManaSourcesV15,
} from '../src/services/upgrade.js';

const A21_PATH = 'test-results/exploratory/counter-blitz-a21-final-deck.txt';
const A22_PATH = 'test-results/exploratory/counter-blitz-a22-synergy-repair-deck.txt';

const SWAPS = [
  ['Sram, Senior Edificer', 'The Destined White Mage'],
  ['Puresteel Paladin', "Tromell, Seymour's Butler"],
  ['Key to the City', 'Rikku, Resourceful Guardian'],
] as const;

const LEGACY_COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
] as const;

const A22_COMBOS = [
  ['The Destined White Mage', 'Walking Ballista'],
  ...LEGACY_COMBOS,
] as const;

const A22_COMBO_PIECES = [
  'The Destined White Mage',
  'Walking Ballista',
  'Gatta and Luzzu',
  'Hardened Scales',
  'The Earth Crystal',
] as const;

const SEEDS = [20260830, 20260905, 20260919, 20261011, 20261107, 20261213, 20270123];
const SCENARIOS: Array<{ pressure: PodPressureV06; turns: number }> = [
  { pressure: 'upgraded', turns: 5 },
  { pressure: 'upgraded', turns: 7 },
  { pressure: 'optimized', turns: 5 },
  { pressure: 'optimized', turns: 7 },
  { pressure: 'cedh', turns: 5 },
  { pressure: 'cedh', turns: 7 },
  { pressure: 'cedh', turns: 9 },
];

function norm(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function avg(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

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

function commanderCard(parsed: ParsedDeck, cards: readonly ScryfallCard[]): ScryfallCard {
  const commanderNames = new Set(parsed.commanders.map((entry) => norm(entry.name)));
  const commander = cards.find((card) => commanderNames.has(norm(card.name)));
  assert.ok(commander, 'commander not resolved');
  return commander;
}

function colorIdentity(parsed: ParsedDeck, cards: readonly ScryfallCard[]): string[] {
  const commanderNames = new Set(parsed.commanders.map((entry) => norm(entry.name)));
  return [...new Set(cards.filter((card) => commanderNames.has(norm(card.name))).flatMap((card) => card.color_identity))].sort();
}

function structuralFloor(metrics: ReturnType<typeof buildDeckMetrics>, colors: number): string[] {
  const failures: string[] = [];
  if (metrics.averageNonlandManaValue > BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15) failures.push('average-nonland-mv');
  if (metrics.earlyPlayCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays) failures.push('early-plays');
  if (metrics.cheapInteractionCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction) failures.push('cheap-interaction');
  if (metrics.fastManaCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana) failures.push('fast-mana');
  if (Number(metrics.roleCounts['free interaction'] ?? 0) < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction) failures.push('free-interaction');
  if (metrics.persistentColoredManaSourceCount < minimumPersistentColoredManaSourcesV15(colors)) failures.push('persistent-colored-mana');
  return failures;
}

interface Signal {
  keep: number;
  uptime: number;
  protection: number;
  spells: number;
  draws: number;
  legacyReady1: number;
  legacyReady2: number;
  legacySeen1: number;
  legacySeen2: number;
}

function signals(result: Record<string, unknown>, turns: number): Signal {
  const baseline = rec(result.baseline);
  const opening = rec(baseline.openingHands);
  const advanced = rec(result.advanced);
  const commander = rec(advanced.commanderPressure);
  const interaction = rec(advanced.interactionPressure);
  const flow = rec(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const key = `turn${turns}`;
  const ready = combos.map((combo) => num(rec(combo.allNamedPiecesInHandOrBattlefieldByTurn)[key]));
  const seen = combos.map((combo) => num(rec(combo.allNamedPiecesSeenByTurn)[key]));
  return {
    keep: num(opening.functionalKeepRate),
    uptime: num(commander.battlefieldUptimePercent),
    protection: num(interaction.protectionWinRateWhenChallenged),
    spells: num(flow.averageSpellsCast),
    draws: num(flow.averageCardsDrawnByEffects),
    legacyReady1: ready[0] ?? 0,
    legacyReady2: ready[1] ?? 0,
    legacySeen1: seen[0] ?? 0,
    legacySeen2: seen[1] ?? 0,
  };
}

function delta(before: Signal, after: Signal): Signal {
  return Object.fromEntries(
    Object.keys(before).map((key) => [key, Number((after[key as keyof Signal] - before[key as keyof Signal]).toFixed(3))]),
  ) as unknown as Signal;
}

function severeMeanRegression(change: Signal): string[] {
  const failures: string[] = [];
  if (change.keep < -2.5) failures.push('functional-keep');
  if (change.uptime < -4) failures.push('commander-uptime');
  if (change.protection < -8) failures.push('protection');
  if (change.spells < -0.25) failures.push('spells-cast');
  if (change.draws < -0.45) failures.push('effect-draws');
  if (change.legacyReady1 < -3.5) failures.push('legacy-combo-route-1-ready');
  if (change.legacyReady2 < -3.5) failures.push('legacy-combo-route-2-ready');
  return failures;
}

function simulate(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  scenario: { pressure: PodPressureV06; turns: number },
  seed: number,
  comboPieces: readonly (readonly string[])[],
): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, {
    iterations: 1400,
    advancedIterations: 1400,
    turns: scenario.turns,
    seed,
    pressure: scenario.pressure,
    comboPieces,
  }) as unknown as Record<string, unknown>;
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A22 SYNERGY-REPAIR GATE');

  const [a21Text, a22Text] = await Promise.all([
    readFile(A21_PATH, 'utf8'),
    readFile(A22_PATH, 'utf8'),
  ]);
  const [a21, a22] = await Promise.all([resolveDeck(a21Text), resolveDeck(a22Text)]);
  const failures: string[] = [];

  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const colors = colorIdentity(a22.parsed, a22.cards);

  for (const [label, state] of [['A21', a21], ['A22', a22]] as const) {
    if (state.notFound.length > 0) failures.push(`${label}: unresolved cards: ${state.notFound.join(', ')}`);
    if (state.parsed.totalCards !== 100) failures.push(`${label}: deck has ${state.parsed.totalCards} cards, expected 100`);
    const legal = validateCommanderDeck(state.parsed, state.cards);
    if (!legal.isLegal) failures.push(`${label}: Commander legality failure: ${legal.errors.join('; ')}`);
    if (!state.cards.every((card) => printingMatchesPolicyV08(card, policy))) failures.push(`${label}: FF printing policy failure`);
  }

  const a21Names = new Set(a21.parsed.main.map((entry) => norm(entry.name)));
  const a22Names = new Set(a22.parsed.main.map((entry) => norm(entry.name)));
  for (const [cut, add] of SWAPS) {
    if (!a21Names.has(norm(cut))) failures.push(`A21 missing expected cut card ${cut}`);
    if (a21Names.has(norm(add))) failures.push(`A21 unexpectedly already contains ${add}`);
    if (a22Names.has(norm(cut))) failures.push(`A22 still contains cut card ${cut}`);
    if (!a22Names.has(norm(add))) failures.push(`A22 missing synergy add ${add}`);
  }

  const metrics21 = buildDeckMetrics(a21.parsed, a21.cards);
  const metrics22 = buildDeckMetrics(a22.parsed, a22.cards);
  failures.push(...structuralFloor(metrics22, colors.length).map((failure) => `A22 structural floor: ${failure}`));

  if (metrics22.rampCount < metrics21.rampCount) failures.push(`A22 ramp regressed ${metrics21.rampCount} -> ${metrics22.rampCount}`);
  if (metrics22.cheapInteractionCount < metrics21.cheapInteractionCount) failures.push(`A22 cheap interaction regressed ${metrics21.cheapInteractionCount} -> ${metrics22.cheapInteractionCount}`);
  if (metrics22.persistentColoredManaSourceCount < metrics21.persistentColoredManaSourceCount) {
    failures.push(`A22 persistent colored mana regressed ${metrics21.persistentColoredManaSourceCount} -> ${metrics22.persistentColoredManaSourceCount}`);
  }

  const a22ComboPieces = A22_COMBO_PIECES
    .map((name) => a22.cards.find((card) => norm(card.name) === norm(name)))
    .filter((card): card is ScryfallCard => Boolean(card));
  if (a22ComboPieces.length !== A22_COMBO_PIECES.length) failures.push('A22 missing one or more supplied combo pieces');
  const comboAccess = comboAccessQualityV15(a22.cards, a22ComboPieces);

  const scenarioRows: Array<Record<string, unknown>> = [];
  const meanChanges: Signal[] = [];
  const whiteMageRows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < SCENARIOS.length; i += 1) {
    const scenario = SCENARIOS[i];
    const seed = SEEDS[i];
    const a21Result = simulate(a21.parsed, a21.cards, scenario, seed, LEGACY_COMBOS);
    const a22LegacyResult = simulate(a22.parsed, a22.cards, scenario, seed, LEGACY_COMBOS);
    const a22AllResult = simulate(a22.parsed, a22.cards, scenario, seed, A22_COMBOS);
    const before = signals(a21Result, scenario.turns);
    const after = signals(a22LegacyResult, scenario.turns);
    const change = delta(before, after);
    meanChanges.push(change);

    const allAdvanced = rec(a22AllResult.advanced);
    const allCombos = Array.isArray(allAdvanced.combos) ? allAdvanced.combos.map(rec) : [];
    const whiteMageCombo = allCombos[0] ?? {};
    const key = `turn${scenario.turns}`;
    const whiteMageReady = num(rec(whiteMageCombo.allNamedPiecesInHandOrBattlefieldByTurn)[key]);
    const whiteMageSeen = num(rec(whiteMageCombo.allNamedPiecesSeenByTurn)[key]);

    scenarioRows.push({ pressure: scenario.pressure, turns: scenario.turns, seed, a21: before, a22: after, delta: change });
    whiteMageRows.push({ pressure: scenario.pressure, turns: scenario.turns, seed, ready: whiteMageReady, seen: whiteMageSeen });
  }

  const meanDelta: Signal = {
    keep: avg(meanChanges.map((row) => row.keep)),
    uptime: avg(meanChanges.map((row) => row.uptime)),
    protection: avg(meanChanges.map((row) => row.protection)),
    spells: avg(meanChanges.map((row) => row.spells)),
    draws: avg(meanChanges.map((row) => row.draws)),
    legacyReady1: avg(meanChanges.map((row) => row.legacyReady1)),
    legacyReady2: avg(meanChanges.map((row) => row.legacyReady2)),
    legacySeen1: avg(meanChanges.map((row) => row.legacySeen1)),
    legacySeen2: avg(meanChanges.map((row) => row.legacySeen2)),
  };

  const severe = severeMeanRegression(meanDelta);
  failures.push(...severe.map((failure) => `A22 simulation severe regression: ${failure}`));

  const report = {
    label: 'A22 synergy-repair candidate',
    basis: 'A21 finished exploratory benchmark',
    swaps: SWAPS.map(([cut, add]) => ({ cut, add })),
    hardValidation: {
      exact100: a22.parsed.totalCards === 100,
      unresolved: a22.notFound,
      commanderLegal: validateCommanderDeck(a22.parsed, a22.cards).isLegal,
      finalFantasyPrintingOnly: a22.cards.every((card) => printingMatchesPolicyV08(card, policy)),
      failures,
    },
    metrics: {
      a21: {
        averageNonlandManaValue: metrics21.averageNonlandManaValue,
        rampCount: metrics21.rampCount,
        cheapInteractionCount: metrics21.cheapInteractionCount,
        fastManaCount: metrics21.fastManaCount,
        persistentColoredManaSourceCount: metrics21.persistentColoredManaSourceCount,
        earlyPlayCount: metrics21.earlyPlayCount,
        cardAdvantageCount: metrics21.cardAdvantageCount,
      },
      a22: {
        averageNonlandManaValue: metrics22.averageNonlandManaValue,
        rampCount: metrics22.rampCount,
        cheapInteractionCount: metrics22.cheapInteractionCount,
        fastManaCount: metrics22.fastManaCount,
        persistentColoredManaSourceCount: metrics22.persistentColoredManaSourceCount,
        earlyPlayCount: metrics22.earlyPlayCount,
        cardAdvantageCount: metrics22.cardAdvantageCount,
      },
    },
    comboAccess,
    legacyRouteRegression: {
      meanDelta,
      scenarios: scenarioRows,
    },
    addedWhiteMageRoute: whiteMageRows,
    interpretationBoundary: [
      'Simulation is a regression guard, not the final synergy verdict.',
      'Current simulation does not fully value Tromell multi-proliferation, Rikku counter-to-unblockable bridging, or White Mage life-gain counter conversion.',
      'A22 should be manually audited for Counter Blitz identity before any further swaps are accepted.',
    ],
  };

  await writeFile('counter-blitz-a22-synergy-repair.json', JSON.stringify(report, null, 2));

  const markdown = [
    '# Counter Blitz A22 — Synergy Repair',
    '',
    '## Controlled swaps',
    ...SWAPS.map(([cut, add]) => `- ${cut} -> ${add}`),
    '',
    '## Hard validation',
    `- Exact 100: ${report.hardValidation.exact100}`,
    `- Commander legal: ${report.hardValidation.commanderLegal}`,
    `- Final Fantasy printing only: ${report.hardValidation.finalFantasyPrintingOnly}`,
    `- Unresolved cards: ${report.hardValidation.unresolved.length}`,
    `- Failures: ${failures.length ? failures.join('; ') : 'none'}`,
    '',
    '## Structural metrics',
    `- Average nonland MV: ${metrics21.averageNonlandManaValue.toFixed(3)} -> ${metrics22.averageNonlandManaValue.toFixed(3)}`,
    `- Ramp: ${metrics21.rampCount} -> ${metrics22.rampCount}`,
    `- Cheap interaction: ${metrics21.cheapInteractionCount} -> ${metrics22.cheapInteractionCount}`,
    `- Fast mana: ${metrics21.fastManaCount} -> ${metrics22.fastManaCount}`,
    `- Persistent colored mana: ${metrics21.persistentColoredManaSourceCount} -> ${metrics22.persistentColoredManaSourceCount}`,
    `- Early plays: ${metrics21.earlyPlayCount} -> ${metrics22.earlyPlayCount}`,
    `- Card advantage role count: ${metrics21.cardAdvantageCount} -> ${metrics22.cardAdvantageCount}`,
    '',
    '## Mean A22 - A21 simulation deltas (legacy routes)',
    `- Functional keep: ${meanDelta.keep.toFixed(3)}`,
    `- Commander uptime: ${meanDelta.uptime.toFixed(3)}`,
    `- Protection when challenged: ${meanDelta.protection.toFixed(3)}`,
    `- Average spells cast: ${meanDelta.spells.toFixed(3)}`,
    `- Average cards drawn by effects: ${meanDelta.draws.toFixed(3)}`,
    `- Gatta + Scales + Ballista ready: ${meanDelta.legacyReady1.toFixed(3)}`,
    `- Gatta + Earth Crystal + Ballista ready: ${meanDelta.legacyReady2.toFixed(3)}`,
    '',
    '## Interpretation boundary',
    '- Simulation is used as a regression guard, not as the final synergy verdict.',
    '- The current model does not fully value Tromell multi-proliferation, Rikku counter-to-unblockable bridging, or White Mage life-gain counter conversion.',
    '- Manual Counter Blitz identity audit remains required before further swaps.',
    '',
    `## Result: ${failures.length ? 'FAIL / REVIEW' : 'PASS REGRESSION GATE'}`,
    '',
  ].join('\n');

  await writeFile('counter-blitz-a22-synergy-repair.md', markdown);

  if (failures.length) {
    console.error(markdown);
    process.exitCode = 1;
    return;
  }
  console.log(markdown);
}

await main();
