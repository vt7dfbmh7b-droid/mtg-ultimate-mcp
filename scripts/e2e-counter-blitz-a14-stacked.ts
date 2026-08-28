import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const COMBO_CARDS = new Set(['gatta and luzzu', 'hardened scales', 'walking ballista', 'the earth crystal']);
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const CRITICAL_ROLES = ['combo protection', 'mana multiplier', 'free interaction', 'free-cast engine', 'early acceleration'] as const;
const SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];
const SCENARIOS = [
  { label: 'Garnet -> Arcane Signet', cuts: ['Garnet, Princess of Alexandria'], adds: ['Arcane Signet'] },
  { label: 'Garnet -> Talisman', cuts: ['Garnet, Princess of Alexandria'], adds: ['Talisman of Progress'] },
  { label: "Sazh -> Endurance", cuts: ["Sazh's Chocobo"], adds: ['Endurance'] },
  { label: 'Tome -> Endurance', cuts: ['Tome of Legends'], adds: ['Endurance'] },
  { label: 'Garnet -> Shelinda', cuts: ['Garnet, Princess of Alexandria'], adds: ['Shelinda, Yevon Acolyte'] },
  { label: 'Garnet -> Rikku', cuts: ['Garnet, Princess of Alexandria'], adds: ['Rikku, Resourceful Guardian'] },
  { label: 'Fathom -> Arcane Signet', cuts: ['Fathom Mage'], adds: ['Arcane Signet'] },
  { label: 'Bred -> Arcane Signet', cuts: ['Bred for the Hunt'], adds: ['Arcane Signet'] },
  { label: 'Fathom -> Talisman', cuts: ['Fathom Mage'], adds: ['Talisman of Progress'] },
  { label: 'Bred -> Talisman', cuts: ['Bred for the Hunt'], adds: ['Talisman of Progress'] },
  { label: 'Garnet + Sazh -> Arcane + Endurance', cuts: ['Garnet, Princess of Alexandria', "Sazh's Chocobo"], adds: ['Arcane Signet', 'Endurance'] },
  { label: 'Garnet + Tome -> Arcane + Endurance', cuts: ['Garnet, Princess of Alexandria', 'Tome of Legends'], adds: ['Arcane Signet', 'Endurance'] },
  { label: 'Garnet + Bred -> Arcane + Talisman', cuts: ['Garnet, Princess of Alexandria', 'Bred for the Hunt'], adds: ['Arcane Signet', 'Talisman of Progress'] },
  { label: 'Fathom + Bred -> Arcane + Talisman', cuts: ['Fathom Mage', 'Bred for the Hunt'], adds: ['Arcane Signet', 'Talisman of Progress'] },
  { label: 'Garnet + Sazh -> Arcane + Shelinda', cuts: ['Garnet, Princess of Alexandria', "Sazh's Chocobo"], adds: ['Arcane Signet', 'Shelinda, Yevon Acolyte'] },
  { label: 'Garnet + Sazh -> Arcane + Rikku', cuts: ['Garnet, Princess of Alexandria', "Sazh's Chocobo"], adds: ['Arcane Signet', 'Rikku, Resourceful Guardian'] },
] as const;

function norm(v: string): string { return v.trim().toLocaleLowerCase(); }
function rec(v: unknown): Record<string, unknown> { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
function num(v: unknown): number { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }
function extractA2(markdown: string): string {
  const m = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(m?.[1], 'could not extract A2 deck');
  return m[1].trim().replace('1 Archmage Emeritus (FIC) 261', '1 The Earth Crystal (FIN) 184');
}
function ids(parsed: ParsedDeck): CardIdentifierInput[] { return [...parsed.commanders, ...parsed.main].map((e) => ({ name: e.name, ...(e.set ? { set: e.set } : {}), ...(e.collectorNumber ? { collectorNumber: e.collectorNumber } : {}) })); }
async function resolveDeck(decklist: string) { const parsed = parseDecklist(decklist); const r = await getCardsByIdentifiers(ids(parsed)); return { parsed, cards: r.cards, notFound: r.notFound }; }
function line(e: DeckEntry): string { const p = e.set && e.collectorNumber ? ` (${e.set.toUpperCase()}) ${e.collectorNumber}` : ''; return `${e.quantity} ${e.name}${p}`; }
function renderChanges(parsed: ParsedDeck, cuts: readonly string[], adds: readonly ScryfallCard[]): string {
  const cutSet = new Set(cuts.map(norm));
  const main = parsed.main.filter((e) => !(e.quantity === 1 && cutSet.has(norm(e.name)))).map(line);
  assert.equal(parsed.main.length - main.length, cuts.length, `missing cut(s): ${cuts.join(' + ')}`);
  main.push(...adds.map((c) => `1 ${c.name} (${c.set.toUpperCase()}) ${c.collector_number}`));
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}
function replaceCards(cards: readonly ScryfallCard[], cuts: readonly string[], adds: readonly ScryfallCard[]): ScryfallCard[] {
  const next = [...cards];
  for (const cut of cuts) { const i = next.findIndex((c) => norm(c.name) === norm(cut)); assert.ok(i >= 0, `missing resolved cut ${cut}`); next.splice(i, 1); }
  next.push(...adds); return next;
}
function identity(parsed: ParsedDeck, cards: readonly ScryfallCard[]): string[] { const names = new Set(parsed.commanders.map((e) => norm(e.name))); return [...new Set(cards.filter((c) => names.has(norm(c.name))).flatMap((c) => c.color_identity))].sort(); }
function roleCounts(cards: readonly ScryfallCard[]): Record<string, number> { const out: Record<string, number> = {}; for (const c of cards) for (const r of inferCardRoles(c)) out[r] = (out[r] ?? 0) + 1; return out; }
function criticalPreserved(before: readonly ScryfallCard[], after: readonly ScryfallCard[]): boolean { const a = roleCounts(before), b = roleCounts(after); return CRITICAL_ROLES.every((r) => (b[r] ?? 0) >= (a[r] ?? 0)); }
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
function simulate(parsed: ParsedDeck, cards: ScryfallCard[], seed: number, iterations = 1800): Record<string, unknown> { return simulateDeckGameplayV06(parsed, cards, { iterations, advancedIterations: iterations, turns: 7, seed, pressure: 'cedh', comboPieces: COMBOS }); }
function signals(result: Record<string, unknown>): Record<string, number> {
  const base = rec(result.baseline), opening = rec(base.openingHands), tutors = rec(base.tutors);
  const advanced = rec(result.advanced), commander = rec(advanced.commanderPressure), interaction = rec(advanced.interactionPressure), flow = rec(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const ready = combos.map((c) => num(rec(c.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  const seen = combos.map((c) => num(rec(c.allNamedPiecesSeenByTurn).turn7));
  return { keep: num(opening.functionalKeepRate), uptime: num(commander.battlefieldUptimePercent), protection: num(interaction.protectionWinRateWhenChallenged), spells: num(flow.averageSpellsCast), draws: num(flow.averageCardsDrawnByEffects), tutorHit: num(tutors.hitRateByTurn7 ?? tutors.hitRate ?? 0), comboReady: ready.length ? Math.max(...ready) : 0, comboSeen: seen.length ? Math.max(...seen) : 0 };
}
function delta(a: Record<string, number>, b: Record<string, number>): Record<string, number> { return Object.fromEntries(Object.keys(a).map((k) => [k, Number((num(b[k]) - num(a[k])).toFixed(3))])); }
function regression(d: Record<string, number>): boolean { return num(d.keep) <= -4 || num(d.uptime) <= -6 || num(d.spells) <= -.35 || num(d.comboReady) <= -4 || num(d.protection) <= -10; }
function score(before: ReturnType<typeof buildDeckMetrics>, after: ReturnType<typeof buildDeckMetrics>, d: Record<string, number>): number {
  let s = num(d.keep) * .45 + num(d.uptime) * .18 + num(d.protection) * .22 + num(d.spells) * 4.5 + num(d.draws) * 2 + num(d.tutorHit) * .2 + num(d.comboReady) * .7 + num(d.comboSeen) * .35;
  s += (after.cheapInteractionCount - before.cheapInteractionCount) * .65 + (Number(after.roleCounts['free interaction'] ?? 0) - Number(before.roleCounts['free interaction'] ?? 0)) * 1.4 + (after.rampCount - before.rampCount) * .35 + (after.persistentColoredManaSourceCount - before.persistentColoredManaSourceCount) * .4 + (before.averageNonlandManaValue - after.averageNonlandManaValue) * .9;
  return Number(s.toFixed(3));
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A14 STACKED REFINEMENT');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source)); assert.equal(a2.notFound.length, 0);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined); const byName = new Map(pool.map((c) => [norm(c.name), c] as const));
  const druid = byName.get(norm('Incubation Druid')); const chalice = byName.get(norm('Everflowing Chalice')); assert.ok(druid && chalice);
  const base1 = await resolveDeck(renderChanges(a2.parsed, ['Conformer Shuriken'], [druid]));
  const baseline = await resolveDeck(renderChanges(base1.parsed, ['Retrieve the Esper'], [chalice])); assert.equal(baseline.notFound.length, 0);
  const beforeM = buildDeckMetrics(baseline.parsed, baseline.cards);
  assert.equal(floor(beforeM, colors.length).length, 0);
  const baselineBySeed = new Map<number, Record<string, number>>(); for (const seed of SEEDS) baselineBySeed.set(seed, signals(simulate(baseline.parsed, baseline.cards, seed)));
  const results: Array<Record<string, unknown>> = [];
  for (const scenario of SCENARIOS) {
    const adds = scenario.adds.map((name) => byName.get(norm(name))).filter((c): c is ScryfallCard => Boolean(c)); assert.equal(adds.length, scenario.adds.length, `missing add in ${scenario.label}`);
    const decklist = renderChanges(baseline.parsed, scenario.cuts, adds); const parsed = parseDecklist(decklist); const cards = replaceCards(baseline.cards, scenario.cuts, adds);
    const names = new Set([...parsed.commanders, ...parsed.main].map((e) => norm(e.name))); const metrics = buildDeckMetrics(parsed, cards);
    const hard = parsed.totalCards === 100 && validateCommanderDeck(parsed, cards).isLegal && cards.every((c) => printingMatchesPolicyV08(c, policy)) && [...COMBO_CARDS].every((n) => names.has(n)) && criticalPreserved(baseline.cards, cards) && floor(metrics, colors.length).length === 0;
    if (!hard) { results.push({ label: scenario.label, hard: false }); continue; }
    const runs = SEEDS.map((seed) => { const d = delta(baselineBySeed.get(seed)!, signals(simulate(parsed, cards, seed))); return { seed, delta: d, score: score(beforeM, metrics, d), regression: regression(d) }; });
    const scores = runs.map((x) => num(x.score)); const mean = scores.reduce((a, b) => a + b, 0) / scores.length; const min = Math.min(...scores); const positive = scores.filter((x) => x > 0).length;
    const robust = runs.every((x) => !x.regression) && positive === 5 && mean > .35 && min > 0;
    results.push({ label: scenario.label, cuts: scenario.cuts, adds: scenario.adds, hard: true, mean: Number(mean.toFixed(3)), min: Number(min.toFixed(3)), positiveSeeds: positive, robust, metrics: { averageNonlandManaValue: metrics.averageNonlandManaValue, ramp: metrics.rampCount, cheapInteraction: metrics.cheapInteractionCount, freeInteraction: Number(metrics.roleCounts['free interaction'] ?? 0), persistentColoredManaSources: metrics.persistentColoredManaSourceCount }, runs, decklist });
    console.log(`${scenario.label}: mean=${mean.toFixed(3)} min=${min.toFixed(3)} positive=${positive}/5 robust=${robust}`);
  }
  results.sort((a, b) => Number(b.robust) - Number(a.robust) || num(b.mean) - num(a.mean));
  const champion = results.find((x) => x.robust === true) ?? null;
  const output = { schema: 'counter-blitz-a14-stacked-v1', baselineChanges: ['Conformer Shuriken -> Incubation Druid', 'Retrieve the Esper -> Everflowing Chalice'], champion: champion ? { label: champion.label, cuts: champion.cuts, adds: champion.adds, mean: champion.mean, min: champion.min, positiveSeeds: champion.positiveSeeds, metrics: champion.metrics } : null, validation: results.map(({ decklist: _d, ...x }) => x), note: 'Exploratory only. Manual Oracle-text audit required before accepting the stacked champion. No stable/current promotion and no PR #29 merge.' };
  await writeFile('counter-blitz-a14-result.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  if (champion) await writeFile('counter-blitz-a14-deck.txt', `${String(champion.decklist).trim()}\n`, 'utf8');
}
main().catch(async (error) => { const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error); console.error(message); await writeFile('counter-blitz-a14-failure.txt', `${message}\n`, 'utf8').catch(() => undefined); process.exitCode = 1; });
