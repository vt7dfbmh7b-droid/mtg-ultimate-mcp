import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { comboAccessQualityV15 } from '../src/services/combo-access-quality-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { expandResolvedDeckSlotsV15 } from '../src/services/deck-slots-v15.js';
import { auditFullDeckV15 } from '../src/services/full-deck-audit-v15.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const COMBO_NAMES = ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista', 'The Earth Crystal'] as const;
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const ACCEPTED_SWAPS = [
  ['Archmage Emeritus', 'The Earth Crystal'],
  ['Conformer Shuriken', 'Incubation Druid'],
  ['Retrieve the Esper', 'Everflowing Chalice'],
  ['Garnet, Princess of Alexandria', 'Arcane Signet'],
  ["Sazh's Chocobo", 'Endurance'],
  ['From Father to Son', 'Commune with Beavers'],
  ['Mangara, the Diplomat', 'Summon: Fenrir'],
] as const;
const PROTECTED_NAMES = [
  'Counterspell', "An Offer You Can't Refuse", 'Force of Negation', 'Silence', "Nature's Claim",
  "Conqueror's Flail", 'Ranger-Captain of Eos', 'Cyclonic Rift', 'Swords to Plowshares',
  'Path to Exile', 'Heroic Intervention', 'Arcane Signet', 'Everflowing Chalice', 'Incubation Druid',
  'Endurance', 'Kinnan, Bonder Prodigy', 'Birds of Paradise', 'Sol Ring', 'Walking Ballista',
  'Gatta and Luzzu', 'Hardened Scales', 'The Earth Crystal', 'Commune with Beavers', 'Summon: Fenrir',
] as const;
const EXPECTED_REVIEW = new Set([
  'path of ancestry',
  'starting town',
  'balamb garden, seed academy // balamb garden, airborne',
]);
const SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111, 20261207, 20270113];
const SCENARIOS: Array<{ pressure: PodPressureV06; turns: number }> = [
  { pressure: 'upgraded', turns: 5 },
  { pressure: 'upgraded', turns: 7 },
  { pressure: 'optimized', turns: 5 },
  { pressure: 'optimized', turns: 7 },
  { pressure: 'cedh', turns: 5 },
  { pressure: 'cedh', turns: 7 },
  { pressure: 'cedh', turns: 9 },
];

function norm(value: string): string { return value.trim().toLocaleLowerCase(); }
function rec(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function num(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function avg(values: readonly number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

function extractA2(markdown: string): string {
  const match = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(match?.[1], 'could not extract A2 deck');
  return match[1].trim();
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

function line(entry: DeckEntry): string {
  const printing = entry.set && entry.collectorNumber ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber}` : '';
  return `${entry.quantity} ${entry.name}${printing}`;
}

function renderChange(parsed: ParsedDeck, cut: string, add: ScryfallCard): string {
  const main = parsed.main.filter((entry) => !(entry.quantity === 1 && norm(entry.name) === norm(cut))).map(line);
  assert.equal(parsed.main.length - main.length, 1, `missing cut ${cut}`);
  main.push(`1 ${add.name} (${add.set.toUpperCase()}) ${add.collector_number}`);
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}

function commanderNames(parsed: ParsedDeck): Set<string> { return new Set(parsed.commanders.map((entry) => norm(entry.name))); }
function commanderCard(parsed: ParsedDeck, cards: readonly ScryfallCard[]): ScryfallCard {
  const names = commanderNames(parsed);
  const found = cards.find((card) => names.has(norm(card.name)));
  assert.ok(found, 'commander not resolved');
  return found;
}
function identity(parsed: ParsedDeck, cards: readonly ScryfallCard[]): string[] {
  const names = commanderNames(parsed);
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

interface Signal {
  keep: number;
  uptime: number;
  protection: number;
  spells: number;
  draws: number;
  comboReady1: number;
  comboReady2: number;
  comboSeen1: number;
  comboSeen2: number;
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
    comboReady1: ready[0] ?? 0,
    comboReady2: ready[1] ?? 0,
    comboSeen1: seen[0] ?? 0,
    comboSeen2: seen[1] ?? 0,
  };
}

function delta(before: Signal, after: Signal): Signal {
  return Object.fromEntries(Object.keys(before).map((key) => [key, Number((after[key as keyof Signal] - before[key as keyof Signal]).toFixed(3))])) as unknown as Signal;
}

function composite(change: Signal): number {
  const minReady = Math.min(change.comboReady1, change.comboReady2);
  const maxReady = Math.max(change.comboReady1, change.comboReady2);
  const minSeen = Math.min(change.comboSeen1, change.comboSeen2);
  return Number((
    change.keep * 0.45
    + change.uptime * 0.18
    + change.protection * 0.22
    + change.spells * 4.5
    + change.draws * 2
    + minReady * 0.7
    + maxReady * 0.35
    + minSeen * 0.2
  ).toFixed(3));
}

function severeMeanRegression(change: Signal): string[] {
  const failures: string[] = [];
  if (change.keep < -2.5) failures.push('functional-keep');
  if (change.uptime < -4) failures.push('commander-uptime');
  if (change.protection < -8) failures.push('protection');
  if (change.spells < -0.25) failures.push('spells-cast');
  if (change.comboReady1 < -3.5) failures.push('combo-route-1-ready');
  if (change.comboReady2 < -3.5) failures.push('combo-route-2-ready');
  return failures;
}

function simulate(parsed: ParsedDeck, cards: ScryfallCard[], scenario: { pressure: PodPressureV06; turns: number }, seed: number): Signal {
  const result = simulateDeckGameplayV06(parsed, cards, {
    iterations: 1400,
    advancedIterations: 1400,
    turns: scenario.turns,
    seed,
    pressure: scenario.pressure,
    comboPieces: COMBOS,
  });
  return signals(result, scenario.turns);
}

async function buildStates() {
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source));
  assert.equal(a2.notFound.length, 0);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined);
  const byName = new Map(pool.map((card) => [norm(card.name), card] as const));
  const need = (name: string): ScryfallCard => { const found = byName.get(norm(name)); assert.ok(found, `missing FF card ${name}`); return found; };

  const a3 = await resolveDeck(renderChange(a2.parsed, 'Archmage Emeritus', need('The Earth Crystal')));
  const a5 = await resolveDeck(renderChange(a3.parsed, 'Conformer Shuriken', need('Incubation Druid')));
  const a12 = await resolveDeck(renderChange(a5.parsed, 'Retrieve the Esper', need('Everflowing Chalice')));
  const a13a = await resolveDeck(renderChange(a12.parsed, 'Garnet, Princess of Alexandria', need('Arcane Signet')));
  const a14 = await resolveDeck(renderChange(a13a.parsed, "Sazh's Chocobo", need('Endurance')));
  const a16 = await resolveDeck(renderChange(a14.parsed, 'From Father to Son', need('Commune with Beavers')));
  const a17 = await resolveDeck(renderChange(a16.parsed, 'Mangara, the Diplomat', need('Summon: Fenrir')));
  return { policy, colors, a14, a16, a17 };
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A21 FINALIZATION GATE');
  const { policy, colors, a14, a16, a17 } = await buildStates();
  const failures: string[] = [];

  for (const [label, state] of [['A14', a14], ['A16', a16], ['A17', a17]] as const) {
    if (state.notFound.length > 0) failures.push(`${label}: unresolved cards`);
    if (state.parsed.totalCards !== 100) failures.push(`${label}: not exact 100`);
    const legal = validateCommanderDeck(state.parsed, state.cards);
    if (!legal.isLegal) failures.push(`${label}: Commander legality failure`);
    if (!state.cards.every((card) => printingMatchesPolicyV08(card, policy))) failures.push(`${label}: FF printing policy failure`);
  }

  const commander = commanderCard(a17.parsed, a17.cards);
  const expanded = expandResolvedDeckSlotsV15(a17.parsed, a17.cards);
  if (expanded.unresolved.length > 0) failures.push('A17: unresolved physical slots');
  if (expanded.main.length !== 99) failures.push(`A17: physical main count ${expanded.main.length}`);
  const comboPieces = COMBO_NAMES.map((name) => a17.cards.find((card) => norm(card.name) === norm(name))).filter((card): card is ScryfallCard => Boolean(card));
  if (comboPieces.length !== 4) failures.push('A17: missing supplied combo pieces');

  const audit = auditFullDeckV15(expanded.main, { commander, comboPieces, protectedCardNames: PROTECTED_NAMES });
  if (audit.counts.challenge !== 0) failures.push(`A17: ${audit.counts.challenge} challenge slots remain`);
  const unexpectedReview = audit.reviewSlots.filter((name) => !EXPECTED_REVIEW.has(norm(name)));
  if (unexpectedReview.length > 0) failures.push(`A17: unexpected review slots: ${unexpectedReview.join(', ')}`);
  if (audit.reviewSlots.length > 3) failures.push(`A17: review-slot count rose to ${audit.reviewSlots.length}`);

  const access = comboAccessQualityV15(a17.cards, comboPieces);
  if (access.deterministicPieceLinks < 1) failures.push('A17: lost deterministic combo-piece access');
  if (access.boundedPieceLinks < 3) failures.push('A17: lost bounded combo-piece access');
  if (access.accessiblePieces.length < 3) failures.push('A17: fewer than three combo pieces are directly accessible');
  if (access.weightedScore < 7.9) failures.push(`A17: combo-access score regressed to ${access.weightedScore}`);

  const metrics14 = buildDeckMetrics(a14.parsed, a14.cards);
  const metrics16 = buildDeckMetrics(a16.parsed, a16.cards);
  const metrics17 = buildDeckMetrics(a17.parsed, a17.cards);
  const structuralFailures = structuralFloor(metrics17, colors.length);
  failures.push(...structuralFailures.map((failure) => `A17 structural floor: ${failure}`));
  if (metrics17.averageNonlandManaValue > metrics14.averageNonlandManaValue + 1e-9) failures.push('A17: curve worse than A14');
  if (metrics17.rampCount < metrics14.rampCount) failures.push('A17: ramp count worse than A14');
  if (metrics17.cheapInteractionCount < metrics14.cheapInteractionCount) failures.push('A17: cheap interaction worse than A14');

  const stress: Array<Record<string, unknown>> = [];
  const allVs14: number[] = [];
  const allVs16: number[] = [];
  let positiveScenarioVs14 = 0;
  let positiveScenarioVs16 = 0;

  for (const scenario of SCENARIOS) {
    const perSeed = SEEDS.map((seed) => {
      const s14 = simulate(a14.parsed, a14.cards, scenario, seed);
      const s16 = simulate(a16.parsed, a16.cards, scenario, seed);
      const s17 = simulate(a17.parsed, a17.cards, scenario, seed);
      const d14 = delta(s14, s17);
      const d16 = delta(s16, s17);
      return { seed, a14: s14, a16: s16, a17: s17, vsA14: d14, vsA16: d16, scoreVsA14: composite(d14), scoreVsA16: composite(d16) };
    });

    const meanDelta = (key: 'vsA14' | 'vsA16'): Signal => {
      const rows = perSeed.map((row) => row[key]);
      const keys = Object.keys(rows[0] ?? {}) as Array<keyof Signal>;
      return Object.fromEntries(keys.map((metric) => [metric, Number(avg(rows.map((row) => row[metric])).toFixed(3))])) as unknown as Signal;
    };
    const meanVs14 = meanDelta('vsA14');
    const meanVs16 = meanDelta('vsA16');
    const scoreVs14 = Number(avg(perSeed.map((row) => row.scoreVsA14)).toFixed(3));
    const scoreVs16 = Number(avg(perSeed.map((row) => row.scoreVsA16)).toFixed(3));
    allVs14.push(...perSeed.map((row) => row.scoreVsA14));
    allVs16.push(...perSeed.map((row) => row.scoreVsA16));
    if (scoreVs14 > 0) positiveScenarioVs14 += 1;
    if (scoreVs16 > 0) positiveScenarioVs16 += 1;
    for (const regression of severeMeanRegression(meanVs14)) failures.push(`${scenario.pressure}/T${scenario.turns} severe regression vs A14: ${regression}`);
    for (const regression of severeMeanRegression(meanVs16)) failures.push(`${scenario.pressure}/T${scenario.turns} severe regression vs A16: ${regression}`);
    stress.push({ ...scenario, scoreVsA14, scoreVsA16, meanVsA14, meanVsA16, perSeed });
  }

  const aggregateVs14 = Number(avg(allVs14).toFixed(3));
  const aggregateVs16 = Number(avg(allVs16).toFixed(3));
  if (aggregateVs14 <= 0) failures.push(`A17 aggregate stress score vs A14 is ${aggregateVs14}`);
  if (aggregateVs16 < -0.1) failures.push(`A17 aggregate stress score vs A16 is ${aggregateVs16}`);
  if (positiveScenarioVs14 < 4) failures.push(`A17 positive scenarios vs A14 only ${positiveScenarioVs14}/${SCENARIOS.length}`);
  if (positiveScenarioVs16 < 3) failures.push(`A17 positive scenarios vs A16 only ${positiveScenarioVs16}/${SCENARIOS.length}`);

  const finalDeck = ['// COMMANDER', ...a17.parsed.commanders.map(line), '', '// MAIN', ...a17.parsed.main.map(line)].join('\n');
  await writeFile('counter-blitz-a21-final-deck.txt', `${finalDeck}\n`, 'utf8');
  await writeFile('counter-blitz-a21-full-99-audit.json', `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

  const result = {
    schema: 'counter-blitz-a21-finalization-v1',
    status: failures.length === 0 ? 'finished-exploratory-benchmark' : 'finalization-blocked',
    acceptedSwaps: ACCEPTED_SWAPS.map(([cut, add]) => `${cut} -> ${add}`),
    hardTruth: {
      exact100: a17.parsed.totalCards === 100,
      physical99: expanded.main.length === 99,
      commanderLegal: validateCommanderDeck(a17.parsed, a17.cards).isLegal,
      ffPrintingPolicy: a17.cards.every((card) => printingMatchesPolicyV08(card, policy)),
      unresolved: expanded.unresolved.length,
    },
    audit: { counts: audit.counts, reviewCards: audit.reviewSlots, challengeCards: audit.challengeSlots },
    comboAccess: access,
    metrics: {
      A14: { averageNonlandManaValue: metrics14.averageNonlandManaValue, ramp: metrics14.rampCount, cheapInteraction: metrics14.cheapInteractionCount, freeInteraction: Number(metrics14.roleCounts['free interaction'] ?? 0), persistentColoredManaSources: metrics14.persistentColoredManaSourceCount },
      A16: { averageNonlandManaValue: metrics16.averageNonlandManaValue, ramp: metrics16.rampCount, cheapInteraction: metrics16.cheapInteractionCount, freeInteraction: Number(metrics16.roleCounts['free interaction'] ?? 0), persistentColoredManaSources: metrics16.persistentColoredManaSourceCount },
      A17: { averageNonlandManaValue: metrics17.averageNonlandManaValue, ramp: metrics17.rampCount, cheapInteraction: metrics17.cheapInteractionCount, freeInteraction: Number(metrics17.roleCounts['free interaction'] ?? 0), persistentColoredManaSources: metrics17.persistentColoredManaSourceCount },
    },
    saturation: {
      landPressureA18: 'no accepted land swap',
      singleSlotA19: '968 structural candidates / 24 simulated finalists / no accepted swap',
      twoCardA20: '49,140 structural candidates / 30 simulated finalists / no accepted package',
    },
    stressSummary: { aggregateVsA14, aggregateVsA16, positiveScenarioVsA14, positiveScenarioVs16, scenarios: SCENARIOS.length, seeds: SEEDS.length },
    stress,
    failures,
    note: 'Finished means this exact FF-only Tidus deck cleared the bounded finalization benchmark. It is still exploratory INTEL-02 evidence and does not promote stable/current or merge PR #29.',
  };

  await writeFile('counter-blitz-a21-finalization.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const markdown = [
    '# Counter Blitz A21 Finalization Gate',
    '',
    `Status: **${result.status}**`,
    '',
    `Hard truth: exact 100=${result.hardTruth.exact100}; physical 99=${result.hardTruth.physical99}; Commander legal=${result.hardTruth.commanderLegal}; FF printing policy=${result.hardTruth.ffPrintingPolicy}.`,
    '',
    `99 audit: locked ${audit.counts.locked}, supported ${audit.counts.supported}, review ${audit.counts.review}, challenge ${audit.counts.challenge}.`,
    '',
    `Combo access score: ${access.weightedScore}; deterministic links ${access.deterministicPieceLinks}; bounded links ${access.boundedPieceLinks}; accessible pieces ${access.accessiblePieces.join(', ')}.`,
    '',
    `Stress aggregate vs A14: ${aggregateVs14}; vs A16: ${aggregateVs16}. Positive scenarios: ${positiveScenarioVs14}/${SCENARIOS.length} vs A14 and ${positiveScenarioVs16}/${SCENARIOS.length} vs A16.`,
    '',
    'Saturation controls: A18 no land swap; A19 no single-card swap after 968 structural candidates; A20 no two-card package after 49,140 structural candidates.',
    '',
    failures.length ? `Failures: ${failures.join('; ')}` : 'No finalization failures.',
    '',
    'This is exploratory benchmark completion only. Stable V0.13/current and PR #29 are untouched.',
  ].join('\n');
  await writeFile('counter-blitz-a21-finalization.md', `${markdown}\n`, 'utf8');

  console.log(JSON.stringify({ status: result.status, aggregateVsA14, aggregateVs16, failures }, null, 2));
  assert.equal(failures.length, 0, `A21 finalization blocked: ${failures.join('; ')}`);
}

main().catch(async (error) => {
  const diagnostic = { schema: 'counter-blitz-a21-finalization-diagnostic-v1', error: error instanceof Error ? error.stack ?? error.message : String(error) };
  await writeFile('counter-blitz-a21-diagnostic.json', `${JSON.stringify(diagnostic, null, 2)}\n`, 'utf8').catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
});
