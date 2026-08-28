import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import {
  cardCommanderStrategyAffinityV15,
  deriveUpgradeStrategyContextV15,
  measureUpgradeDeckStrategySupportV15,
  substantiveCommanderStrategyAffinityScoreV15,
} from '../src/services/commander-strategy-affinity-v15.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, getCardOracleText, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06 } from '../src/services/simulation-v06.js';
import {
  BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15,
  BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15,
  minimumPersistentColoredManaSourcesV15,
} from '../src/services/upgrade.js';

const COMBO_CARDS = new Set(['gatta and luzzu', 'hardened scales', 'walking ballista', 'the earth crystal']);
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const CRITICAL_ROLES = ['combo protection', 'mana multiplier', 'free interaction', 'free-cast engine', 'early acceleration'] as const;
const SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];
const SCENARIOS = [
  { label: 'Key -> Rikku', cuts: ['Key to the City'], adds: ['Rikku, Resourceful Guardian'] },
  { label: 'Garnet -> Rikku', cuts: ['Garnet, Princess of Alexandria'], adds: ['Rikku, Resourceful Guardian'] },
  { label: "Sazh's Chocobo -> Rikku", cuts: ["Sazh's Chocobo"], adds: ['Rikku, Resourceful Guardian'] },
  { label: 'Campsite Cuisine -> Rikku', cuts: ['Campsite Cuisine'], adds: ['Rikku, Resourceful Guardian'] },
  { label: 'Garnet -> Shelinda', cuts: ['Garnet, Princess of Alexandria'], adds: ['Shelinda, Yevon Acolyte'] },
  { label: "Sazh's Chocobo -> Shelinda", cuts: ["Sazh's Chocobo"], adds: ['Shelinda, Yevon Acolyte'] },
  { label: 'Key -> Professor Hojo', cuts: ['Key to the City'], adds: ['Professor Hojo'] },
  { label: 'Campsite Cuisine -> Professor Hojo', cuts: ['Campsite Cuisine'], adds: ['Professor Hojo'] },
  { label: 'Garnet + Sazh -> Rikku + Shelinda', cuts: ['Garnet, Princess of Alexandria', "Sazh's Chocobo"], adds: ['Rikku, Resourceful Guardian', 'Shelinda, Yevon Acolyte'] },
  { label: 'Garnet + Sazh -> Rikku + Yuna', cuts: ['Garnet, Princess of Alexandria', "Sazh's Chocobo"], adds: ['Rikku, Resourceful Guardian', 'Yuna, Grand Summoner'] },
  { label: 'Campsite + Garnet -> Rikku + Hojo', cuts: ['Campsite Cuisine', 'Garnet, Princess of Alexandria'], adds: ['Rikku, Resourceful Guardian', 'Professor Hojo'] },
  { label: 'Key + Garnet -> Rikku + Shelinda', cuts: ['Key to the City', 'Garnet, Princess of Alexandria'], adds: ['Rikku, Resourceful Guardian', 'Shelinda, Yevon Acolyte'] },
] as const;

function rec(v: unknown): Record<string, unknown> { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
function num(v: unknown): number { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }
function norm(v: string): string { return v.trim().toLocaleLowerCase(); }
function roles(card: ScryfallCard): Set<string> { return new Set(inferCardRoles(card)); }

function extractA2(markdown: string): string {
  const m = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(m?.[1], 'could not extract A2 deck');
  return m[1].trim().replace('1 Archmage Emeritus (FIC) 261', '1 The Earth Crystal (FIN) 184');
}
function ids(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((e) => ({ name: e.name, ...(e.set ? { set: e.set } : {}), ...(e.collectorNumber ? { collectorNumber: e.collectorNumber } : {}) }));
}
async function resolveDeck(decklist: string) {
  const parsed = parseDecklist(decklist);
  const r = await getCardsByIdentifiers(ids(parsed));
  return { parsed, cards: r.cards, notFound: r.notFound };
}
function line(e: DeckEntry): string {
  const p = e.set && e.collectorNumber ? ` (${e.set.toUpperCase()}) ${e.collectorNumber}` : '';
  return `${e.quantity} ${e.name}${p}`;
}
function renderChanges(parsed: ParsedDeck, cuts: readonly string[], adds: readonly ScryfallCard[]): string {
  const cutSet = new Set(cuts.map(norm));
  const main = parsed.main.filter((e) => !(e.quantity === 1 && cutSet.has(norm(e.name)))).map(line);
  assert.equal(parsed.main.length - main.length, cuts.length, `all cuts must exist once: ${cuts.join(' + ')}`);
  main.push(...adds.map((c) => `1 ${c.name} (${c.set.toUpperCase()}) ${c.collector_number}`));
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}
function replaceCards(cards: readonly ScryfallCard[], cuts: readonly string[], adds: readonly ScryfallCard[]): ScryfallCard[] {
  const next = [...cards];
  for (const cut of cuts) {
    const i = next.findIndex((c) => norm(c.name) === norm(cut));
    assert.ok(i >= 0, `resolved cut missing: ${cut}`);
    next.splice(i, 1);
  }
  next.push(...adds);
  return next;
}
function identity(parsed: ParsedDeck, cards: readonly ScryfallCard[]): string[] {
  const names = new Set(parsed.commanders.map((e) => norm(e.name)));
  return [...new Set(cards.filter((c) => names.has(norm(c.name))).flatMap((c) => c.color_identity))].sort();
}
function floor(metrics: ReturnType<typeof buildDeckMetrics>, colors: number): string[] {
  const f: string[] = [];
  if (metrics.averageNonlandManaValue > BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15) f.push('average-nonland-mv');
  if (metrics.earlyPlayCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays) f.push('early-plays');
  if (metrics.cheapInteractionCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction) f.push('cheap-interaction');
  if (metrics.fastManaCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana) f.push('fast-mana');
  if (Number(metrics.roleCounts['free interaction'] ?? 0) < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction) f.push('free-interaction');
  if (metrics.tutorCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.tutors) f.push('tutors');
  if (metrics.persistentColoredManaSourceCount < minimumPersistentColoredManaSourcesV15(colors)) f.push('persistent-colored-mana');
  return f;
}
function roleCounts(cards: readonly ScryfallCard[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of cards) for (const role of inferCardRoles(c)) counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}
function criticalRoleDeltas(before: readonly ScryfallCard[], after: readonly ScryfallCard[]): Record<string, number> {
  const a = roleCounts(before), b = roleCounts(after);
  return Object.fromEntries(CRITICAL_ROLES.map((r) => [r, (b[r] ?? 0) - (a[r] ?? 0)]));
}
function simulate(parsed: ParsedDeck, cards: ScryfallCard[], seed: number, iterations: number): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, { iterations, advancedIterations: iterations, turns: 7, seed, pressure: 'cedh', comboPieces: COMBOS });
}
function signals(result: Record<string, unknown>): Record<string, number> {
  const baseline = rec(result.baseline), opening = rec(baseline.openingHands), tutors = rec(baseline.tutors);
  const advanced = rec(result.advanced), commander = rec(advanced.commanderPressure), interaction = rec(advanced.interactionPressure), flow = rec(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const ready = combos.map((c) => num(rec(c.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  const seen = combos.map((c) => num(rec(c.allNamedPiecesSeenByTurn).turn7));
  return {
    functionalKeepRate: num(opening.functionalKeepRate), commanderUptimePercent: num(commander.battlefieldUptimePercent), protectionWinRate: num(interaction.protectionWinRateWhenChallenged),
    averageSpellsCast: num(flow.averageSpellsCast), averageCardsDrawn: num(flow.averageCardsDrawnByEffects), tutorHitRate: num(tutors.hitRateByTurn7 ?? tutors.hitRate ?? 0),
    bestComboReadyTurn7: ready.length ? Math.max(...ready) : 0, bestComboSeenTurn7: seen.length ? Math.max(...seen) : 0,
  };
}
function delta(a: Record<string, number>, b: Record<string, number>): Record<string, number> { return Object.fromEntries(Object.keys(a).map((k) => [k, Number((num(b[k]) - num(a[k])).toFixed(3))])); }
function regression(d: Record<string, number>): boolean { return num(d.functionalKeepRate) <= -4 || num(d.commanderUptimePercent) <= -6 || num(d.averageSpellsCast) <= -.35 || num(d.bestComboReadyTurn7) <= -4 || num(d.protectionWinRate) <= -10; }
function simScore(beforeM: ReturnType<typeof buildDeckMetrics>, afterM: ReturnType<typeof buildDeckMetrics>, d: Record<string, number>): number {
  let s = num(d.functionalKeepRate) * .45 + num(d.commanderUptimePercent) * .18 + num(d.protectionWinRate) * .2 + num(d.averageSpellsCast) * 4.2 + num(d.averageCardsDrawn) * 2.1 + num(d.tutorHitRate) * .15 + num(d.bestComboReadyTurn7) * .6 + num(d.bestComboSeenTurn7) * .35;
  s += (afterM.cheapInteractionCount - beforeM.cheapInteractionCount) * .6 + (afterM.tutorCount - beforeM.tutorCount) * .9 + (afterM.protectionCount - beforeM.protectionCount) * .5 + (afterM.fastManaCount - beforeM.fastManaCount) * .75 + (beforeM.averageNonlandManaValue - afterM.averageNonlandManaValue) * .8;
  return Number(s.toFixed(3));
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A10 UNRESTRICTED REBUILD TRADEOFF AUDIT');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source));
  assert.equal(a2.notFound.length, 0);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined);
  const byName = new Map(pool.map((c) => [norm(c.name), c] as const));
  const druid = byName.get(norm('Incubation Druid'));
  assert.ok(druid, 'Incubation Druid must resolve');
  const a5 = await resolveDeck(renderChanges(a2.parsed, ['Conformer Shuriken'], [druid]));
  assert.equal(a5.notFound.length, 0);
  const context = deriveUpgradeStrategyContextV15(a5.parsed, a5.cards);
  const beforeSupport = measureUpgradeDeckStrategySupportV15(a5.parsed, a5.cards, context);
  const beforeM = buildDeckMetrics(a5.parsed, a5.cards);
  assert.equal(floor(beforeM, colors.length).length, 0);
  const commander = a5.cards.find((c) => norm(c.name) === norm("Tidus, Yuna's Guardian"));
  assert.ok(commander);
  const commanderText = getCardOracleText(commander).toLocaleLowerCase();
  const commanderHasCounterCombatBridge = /move .*counter/.test(commanderText) && /combat damage/.test(commanderText);
  assert.equal(commanderHasCounterCombatBridge, true, 'Tidus must expose counter movement plus combat-damage payoff');

  const baselineBySeed = new Map<number, Record<string, number>>();
  for (const seed of SEEDS) baselineBySeed.set(seed, signals(simulate(a5.parsed, a5.cards, seed, 1200)));

  const results: Array<Record<string, unknown>> = [];
  for (const scenario of SCENARIOS) {
    const adds = scenario.adds.map((name) => byName.get(norm(name))).filter((c): c is ScryfallCard => Boolean(c));
    assert.equal(adds.length, scenario.adds.length, `all additions must resolve: ${scenario.label}`);
    const cuts = scenario.cuts.map((name) => a5.cards.find((c) => norm(c.name) === norm(name))).filter((c): c is ScryfallCard => Boolean(c));
    assert.equal(cuts.length, scenario.cuts.length, `all cuts must resolve: ${scenario.label}`);
    const decklist = renderChanges(a5.parsed, scenario.cuts, adds);
    const parsed = parseDecklist(decklist);
    const cards = replaceCards(a5.cards, scenario.cuts, adds);
    const metrics = buildDeckMetrics(parsed, cards);
    const critical = criticalRoleDeltas(a5.cards, cards);
    const hard = {
      exact100: parsed.totalCards === 100,
      commanderLegal: validateCommanderDeck(parsed, cards).isLegal,
      printingPolicy: cards.every((c) => printingMatchesPolicyV08(c, policy)),
      combosPreserved: [...COMBO_CARDS].every((name) => new Set([...parsed.commanders, ...parsed.main].map((e) => norm(e.name))).has(name)),
      constructionFloorFailures: floor(metrics, colors.length),
      criticalRolesPreserved: Object.values(critical).every((v) => v >= 0),
    };
    const afterSupport = measureUpgradeDeckStrategySupportV15(parsed, cards, context);
    const supportDeltas = beforeSupport.strategies.map((prior) => {
      const next = afterSupport.strategies.find((x) => x.archetype === prior.archetype);
      return { archetype: prior.archetype, commanderScore: prior.commanderScore, supportDelta: (next?.supportCount ?? 0) - prior.supportCount, affinityDelta: (next?.affinityTotal ?? 0) - prior.affinityTotal };
    });
    const totalAffinityDelta = supportDeltas.reduce((sum, x) => sum + x.affinityDelta, 0);
    const cutAffinity = cuts.reduce((sum, c) => sum + substantiveCommanderStrategyAffinityScoreV15(cardCommanderStrategyAffinityV15(c, context)), 0);
    const addAffinity = adds.reduce((sum, c) => sum + substantiveCommanderStrategyAffinityScoreV15(cardCommanderStrategyAffinityV15(c, context)), 0);
    const bridgeDelta = adds.filter((c) => roles(c).has('counter payoff') && roles(c).has('combat access')).length - cuts.filter((c) => roles(c).has('counter payoff') && roles(c).has('combat access')).length;
    const combatAccessDelta = adds.filter((c) => roles(c).has('combat access')).length - cuts.filter((c) => roles(c).has('combat access')).length;
    const runs: Array<Record<string, unknown>> = [];
    for (const seed of SEEDS) {
      const d = delta(baselineBySeed.get(seed)!, signals(simulate(parsed, cards, seed, 1200)));
      runs.push({ seed, delta: d, score: simScore(beforeM, metrics, d), regression: regression(d) });
    }
    const scores = runs.map((r) => num(r.score));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const positive = scores.filter((v) => v > 0).length;
    const noSignificantRegression = runs.every((r) => r.regression !== true);
    const hardPassed = hard.exact100 && hard.commanderLegal && hard.printingPolicy && hard.combosPreserved && hard.constructionFloorFailures.length === 0 && hard.criticalRolesPreserved;
    const reviewEligible = hardPassed && noSignificantRegression && (bridgeDelta > 0 || totalAffinityDelta >= 0 || addAffinity > cutAffinity);
    results.push({
      label: scenario.label,
      cuts: scenario.cuts,
      adds: scenario.adds,
      hard,
      criticalRoleDeltas: critical,
      strategyTradeoffs: supportDeltas,
      totalAffinityDelta,
      directCommanderAffinityDelta: addAffinity - cutAffinity,
      counterCombatBridgeDelta: bridgeDelta,
      combatAccessDelta,
      commanderCounterCombatBridgePresent: commanderHasCounterCombatBridge,
      v06: { meanScore: Number(mean.toFixed(3)), minScore: Number(min.toFixed(3)), positiveSeeds: positive, noSignificantRegression, runs, limitation: 'V0.6 does not resolve blockers or combat access; negative/neutral scores cannot measure the Rikku counter-to-unblockable payoff.' },
      metrics: {
        averageNonlandManaValue: metrics.averageNonlandManaValue,
        earlyPlayCount: metrics.earlyPlayCount,
        cheapInteractionCount: metrics.cheapInteractionCount,
        protectionCount: metrics.protectionCount,
        tutorCount: metrics.tutorCount,
      },
      reviewEligible,
      decklist,
    });
    console.log(`${scenario.label}: hard=${hardPassed} review=${reviewEligible} bridge=${bridgeDelta} directAffinity=${addAffinity - cutAffinity} totalAffinity=${totalAffinityDelta} v06mean=${mean.toFixed(3)} min=${min.toFixed(3)} positive=${positive}/5`);
  }

  results.sort((a, b) => Number(b.reviewEligible) - Number(a.reviewEligible) || num(b.counterCombatBridgeDelta) - num(a.counterCombatBridgeDelta) || num(b.directCommanderAffinityDelta) - num(a.directCommanderAffinityDelta) || num(b.totalAffinityDelta) - num(a.totalAffinityDelta) || num(rec(b.v06).meanScore) - num(rec(a.v06).meanScore));
  const review = results.filter((x) => x.reviewEligible === true);
  const output = {
    schema: 'counter-blitz-a10-unrestricted-tradeoffs-v1',
    baseline: 'A5: Conformer Shuriken -> Incubation Druid',
    commanderStrategies: context.strategies,
    strictRetentionNote: 'A strongest-build refinement is allowed to expose tradeoffs among substantive commander strategies instead of requiring every support count and affinity total to be nondecreasing as precon-preservation mode does.',
    v06Limitation: 'V0.6 has no blocker/evasion/combat-connection resolution. Counter-driven combat access is reported separately and must not be vetoed solely by V0.6.',
    reviewEligibleCount: review.length,
    reviewEligible: review.map(({ decklist: _d, ...x }) => x),
    allScenarios: results.map(({ decklist: _d, ...x }) => x),
    candidateDecklists: Object.fromEntries(review.map((x) => [String(x.label), String(x.decklist)])),
    note: 'Exploratory only. No stable/current promotion and no PR #29 merge.',
  };
  await writeFile('counter-blitz-a10-result.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('counter-blitz-a10-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
