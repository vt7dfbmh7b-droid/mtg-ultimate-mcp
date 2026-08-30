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
const A22B_PATH = 'test-results/exploratory/counter-blitz-a22b-synergy-repair-deck.txt';
const SWAPS = [
  ['Sram, Senior Edificer', 'The Destined White Mage'],
  ['Puresteel Paladin', "Tromell, Seymour's Butler"],
  ['Lunatic Pandora', 'Rikku, Resourceful Guardian'],
] as const;
const LEGACY_COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
] as const;
const A22B_COMBOS = [
  ['The Destined White Mage', 'Walking Ballista'],
  ...LEGACY_COMBOS,
] as const;
const COMBO_PIECES = ['The Destined White Mage', 'Walking Ballista', 'Gatta and Luzzu', 'Hardened Scales', 'The Earth Crystal'] as const;
const SCENARIOS: Array<{ pressure: PodPressureV06; turns: number; seed: number }> = [
  { pressure: 'upgraded', turns: 5, seed: 20260830 },
  { pressure: 'upgraded', turns: 7, seed: 20260905 },
  { pressure: 'optimized', turns: 5, seed: 20260919 },
  { pressure: 'optimized', turns: 7, seed: 20261011 },
  { pressure: 'cedh', turns: 5, seed: 20261107 },
  { pressure: 'cedh', turns: 7, seed: 20261213 },
  { pressure: 'cedh', turns: 9, seed: 20270123 },
];

function norm(value: string): string { return value.trim().toLocaleLowerCase(); }
function rec(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function num(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function avg(values: readonly number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}
async function resolveDeck(text: string) {
  const parsed = parseDecklist(text);
  const result = await getCardsByIdentifiers(identifiers(parsed));
  return { parsed, cards: result.cards, notFound: result.notFound };
}
function identity(parsed: ParsedDeck, cards: readonly ScryfallCard[]): string[] {
  const names = new Set(parsed.commanders.map((entry) => norm(entry.name)));
  return [...new Set(cards.filter((card) => names.has(norm(card.name))).flatMap((card) => card.color_identity))].sort();
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

interface Signal { keep: number; uptime: number; protection: number; spells: number; draws: number; route1: number; route2: number; }
function signal(result: Record<string, unknown>, turns: number): Signal {
  const baseline = rec(result.baseline);
  const advanced = rec(result.advanced);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const key = `turn${turns}`;
  const ready = combos.map((combo) => num(rec(combo.allNamedPiecesInHandOrBattlefieldByTurn)[key]));
  return {
    keep: num(rec(baseline.openingHands).functionalKeepRate),
    uptime: num(rec(advanced.commanderPressure).battlefieldUptimePercent),
    protection: num(rec(advanced.interactionPressure).protectionWinRateWhenChallenged),
    spells: num(rec(advanced.cardFlow).averageSpellsCast),
    draws: num(rec(advanced.cardFlow).averageCardsDrawnByEffects),
    route1: ready[0] ?? 0,
    route2: ready[1] ?? 0,
  };
}
function diff(before: Signal, after: Signal): Signal {
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
    keep: avg(rows.map((r) => r.keep)), uptime: avg(rows.map((r) => r.uptime)), protection: avg(rows.map((r) => r.protection)),
    spells: avg(rows.map((r) => r.spells)), draws: avg(rows.map((r) => r.draws)), route1: avg(rows.map((r) => r.route1)), route2: avg(rows.map((r) => r.route2)),
  };
}
function simulate(parsed: ParsedDeck, cards: ScryfallCard[], scenario: { pressure: PodPressureV06; turns: number; seed: number }, combos: readonly (readonly string[])[]): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, {
    iterations: 1400,
    advancedIterations: 1400,
    turns: scenario.turns,
    seed: scenario.seed,
    pressure: scenario.pressure,
    comboPieces: combos,
  }) as unknown as Record<string, unknown>;
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A22B SYNERGY-REPAIR GATE');
  const [a21Text, a22bText] = await Promise.all([readFile(A21_PATH, 'utf8'), readFile(A22B_PATH, 'utf8')]);
  const [a21, a22b] = await Promise.all([resolveDeck(a21Text), resolveDeck(a22bText)]);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const failures: string[] = [];
  for (const [label, state] of [['A21', a21], ['A22b', a22b]] as const) {
    if (state.notFound.length) failures.push(`${label}: unresolved cards`);
    if (state.parsed.totalCards !== 100) failures.push(`${label}: not exact 100`);
    if (!validateCommanderDeck(state.parsed, state.cards).isLegal) failures.push(`${label}: Commander illegal`);
    if (!state.cards.every((card) => printingMatchesPolicyV08(card, policy))) failures.push(`${label}: FF printing policy failure`);
  }

  const beforeNames = new Set(a21.parsed.main.map((entry) => norm(entry.name)));
  const afterNames = new Set(a22b.parsed.main.map((entry) => norm(entry.name)));
  for (const [cut, add] of SWAPS) {
    if (!beforeNames.has(norm(cut)) || afterNames.has(norm(cut))) failures.push(`swap cut mismatch: ${cut}`);
    if (beforeNames.has(norm(add)) || !afterNames.has(norm(add))) failures.push(`swap add mismatch: ${add}`);
  }

  const m21 = buildDeckMetrics(a21.parsed, a21.cards);
  const m22 = buildDeckMetrics(a22b.parsed, a22b.cards);
  failures.push(...structuralFloor(m22, identity(a22b.parsed, a22b.cards).length).map((f) => `structural: ${f}`));
  if (m22.rampCount < m21.rampCount) failures.push('ramp regression');
  if (m22.cheapInteractionCount < m21.cheapInteractionCount) failures.push('cheap interaction regression');
  if (m22.persistentColoredManaSourceCount < m21.persistentColoredManaSourceCount) failures.push('colored mana regression');

  const comboCards = COMBO_PIECES.map((name) => a22b.cards.find((card) => norm(card.name) === norm(name))).filter((card): card is ScryfallCard => Boolean(card));
  assert.equal(comboCards.length, COMBO_PIECES.length, 'missing combo piece');
  const comboAccess = comboAccessQualityV15(a22b.cards, comboCards);

  const deltas: Signal[] = [];
  const scenarios: Array<Record<string, unknown>> = [];
  const whiteMageRoute: Array<Record<string, unknown>> = [];
  for (const scenario of SCENARIOS) {
    const before = signal(simulate(a21.parsed, a21.cards, scenario, LEGACY_COMBOS), scenario.turns);
    const after = signal(simulate(a22b.parsed, a22b.cards, scenario, LEGACY_COMBOS), scenario.turns);
    const change = diff(before, after);
    deltas.push(change);
    scenarios.push({ ...scenario, before, after, delta: change });

    const allResult = simulate(a22b.parsed, a22b.cards, scenario, A22B_COMBOS);
    const allAdvanced = rec(allResult.advanced);
    const allCombos = Array.isArray(allAdvanced.combos) ? allAdvanced.combos.map(rec) : [];
    const white = allCombos[0] ?? {};
    const key = `turn${scenario.turns}`;
    whiteMageRoute.push({ ...scenario, ready: num(rec(white.allNamedPiecesInHandOrBattlefieldByTurn)[key]), seen: num(rec(white.allNamedPiecesSeenByTurn)[key]) });
  }
  const meanDelta = mean(deltas);
  if (meanDelta.keep < -2.5) failures.push('simulation: keep');
  if (meanDelta.uptime < -4) failures.push('simulation: commander uptime');
  if (meanDelta.protection < -8) failures.push('simulation: protection');
  if (meanDelta.spells < -0.25) failures.push('simulation: spells');
  if (meanDelta.draws < -0.45) failures.push('simulation: draws');
  if (meanDelta.route1 < -3.5 || meanDelta.route2 < -3.5) failures.push('simulation: legacy combo access');

  const report = {
    status: failures.length ? 'REVIEW' : 'PASS',
    swaps: SWAPS.map(([cut, add]) => ({ cut, add })),
    failures,
    metrics: {
      a21: { averageNonlandManaValue: m21.averageNonlandManaValue, earlyPlayCount: m21.earlyPlayCount, rampCount: m21.rampCount, cheapInteractionCount: m21.cheapInteractionCount, persistentColoredManaSourceCount: m21.persistentColoredManaSourceCount },
      a22b: { averageNonlandManaValue: m22.averageNonlandManaValue, earlyPlayCount: m22.earlyPlayCount, rampCount: m22.rampCount, cheapInteractionCount: m22.cheapInteractionCount, persistentColoredManaSourceCount: m22.persistentColoredManaSourceCount },
    },
    comboAccess,
    meanDelta,
    scenarios,
    whiteMageRoute,
    boundary: 'Simulation is a regression guard. Manual synergy audit remains authoritative for unmodeled Tidus/counter interactions.',
  };
  await writeFile('counter-blitz-a22b-synergy-repair.json', JSON.stringify(report, null, 2));
  const md = [
    '# Counter Blitz A22b — Synergy Repair', '',
    ...SWAPS.map(([cut, add]) => `- ${cut} -> ${add}`), '',
    `- Result: **${report.status}**`,
    `- Failures: ${failures.length ? failures.join('; ') : 'none'}`,
    `- Average nonland MV: ${m21.averageNonlandManaValue.toFixed(3)} -> ${m22.averageNonlandManaValue.toFixed(3)}`,
    `- Early plays: ${m21.earlyPlayCount} -> ${m22.earlyPlayCount}`,
    `- Ramp: ${m21.rampCount} -> ${m22.rampCount}`,
    `- Cheap interaction: ${m21.cheapInteractionCount} -> ${m22.cheapInteractionCount}`,
    `- Persistent colored mana: ${m21.persistentColoredManaSourceCount} -> ${m22.persistentColoredManaSourceCount}`,
    `- Combo access score: ${comboAccess.weightedScore}`,
    `- Mean Δ spells: ${meanDelta.spells.toFixed(3)}`,
    `- Mean Δ draws: ${meanDelta.draws.toFixed(3)}`,
    `- Mean Δ commander uptime: ${meanDelta.uptime.toFixed(3)}`,
    `- Mean Δ protection: ${meanDelta.protection.toFixed(3)}`,
    '', 'Simulation is a regression guard; direct counter/combat synergy remains a manual judgment.', '',
  ].join('\n');
  await writeFile('counter-blitz-a22b-synergy-repair.md', md);
  console.log(md);
  if (failures.length) process.exitCode = 1;
}

await main();
