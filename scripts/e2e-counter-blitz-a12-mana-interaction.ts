import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
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
const CRITICAL_ROLES = ['combo protection', 'mana multiplier', 'free-cast engine', 'early acceleration'] as const;
const SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];
const ADDS = [
  'Arcane Signet',
  'Talisman of Progress',
  'Everflowing Chalice',
  'Thought Vessel',
  'Solitude',
  'Endurance',
  'The Destined Thief',
  'Search for Dagger',
] as const;
const CUTS = [
  'Campsite Cuisine',
  'Garnet, Princess of Alexandria',
  "Sazh's Chocobo",
  'Key to the City',
  'Champions from Beyond',
  'Mask of Memory',
  'Tome of Legends',
  'Generous Patron',
  'Mangara, the Diplomat',
  'Retrieve the Esper',
  'Bred for the Hunt',
  'Fathom Mage',
  'Chasm Skulker',
] as const;

function norm(v: string): string { return v.trim().toLocaleLowerCase(); }
function rec(v: unknown): Record<string, unknown> { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
function num(v: unknown): number { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }
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
function swap(parsed: ParsedDeck, out: string, incoming: ScryfallCard): string {
  let hit = false;
  const main = parsed.main.map((e) => {
    if (!hit && e.quantity === 1 && norm(e.name) === norm(out)) { hit = true; return `1 ${incoming.name} (${incoming.set.toUpperCase()}) ${incoming.collector_number}`; }
    return line(e);
  });
  assert.ok(hit, `missing cut ${out}`);
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}
function replaceCard(cards: readonly ScryfallCard[], out: string, incoming: ScryfallCard): ScryfallCard[] {
  const next = [...cards];
  const i = next.findIndex((c) => norm(c.name) === norm(out));
  assert.ok(i >= 0);
  next.splice(i, 1, incoming);
  return next;
}
function roleCounts(cards: readonly ScryfallCard[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of cards) for (const role of inferCardRoles(c)) counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}
function criticalPreserved(before: readonly ScryfallCard[], after: readonly ScryfallCard[]): boolean {
  const a = roleCounts(before), b = roleCounts(after);
  return CRITICAL_ROLES.every((role) => (b[role] ?? 0) >= (a[role] ?? 0));
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
function simulate(parsed: ParsedDeck, cards: ScryfallCard[], seed: number, iterations: number): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, { iterations, advancedIterations: iterations, turns: 7, seed, pressure: 'cedh', comboPieces: COMBOS });
}
function signals(result: Record<string, unknown>): Record<string, number> {
  const base = rec(result.baseline), opening = rec(base.openingHands), tutors = rec(base.tutors);
  const advanced = rec(result.advanced), commander = rec(advanced.commanderPressure), interaction = rec(advanced.interactionPressure), flow = rec(advanced.cardFlow), resources = rec(advanced.resources);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const ready = combos.map((c) => num(rec(c.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  return {
    keep: num(opening.functionalKeepRate), uptime: num(commander.battlefieldUptimePercent), protection: num(interaction.protectionWinRateWhenChallenged), spells: num(flow.averageSpellsCast), draws: num(flow.averageCardsDrawnByEffects), tutorHit: num(tutors.hitRateByTurn7 ?? tutors.hitRate ?? 0), comboReady: ready.length ? Math.max(...ready) : 0, treasures: num(resources.averageTreasuresSpent),
  };
}
function delta(a: Record<string, number>, b: Record<string, number>): Record<string, number> { return Object.fromEntries(Object.keys(a).map((k) => [k, Number((num(b[k]) - num(a[k])).toFixed(3))])); }
function score(before: ReturnType<typeof buildDeckMetrics>, after: ReturnType<typeof buildDeckMetrics>, d: Record<string, number>): number {
  let s = num(d.keep) * .45 + num(d.uptime) * .18 + num(d.protection) * .22 + num(d.spells) * 4.5 + num(d.draws) * 2.0 + num(d.tutorHit) * .2 + num(d.comboReady) * .7;
  s += (after.cheapInteractionCount - before.cheapInteractionCount) * .65 + (after.protectionCount - before.protectionCount) * .55 + (Number(after.roleCounts['free interaction'] ?? 0) - Number(before.roleCounts['free interaction'] ?? 0)) * 1.4 + (after.rampCount - before.rampCount) * .35 + (after.persistentColoredManaSourceCount - before.persistentColoredManaSourceCount) * .4 + (before.averageNonlandManaValue - after.averageNonlandManaValue) * .9;
  return Number(s.toFixed(3));
}
function regression(d: Record<string, number>): boolean { return num(d.keep) <= -4 || num(d.uptime) <= -6 || num(d.spells) <= -.35 || num(d.comboReady) <= -4 || num(d.protection) <= -10; }

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A12 MANA / FREE-INTERACTION SEARCH');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source));
  assert.equal(a2.notFound.length, 0);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined);
  const byName = new Map(pool.map((c) => [norm(c.name), c] as const));
  const druid = byName.get(norm('Incubation Druid'));
  assert.ok(druid);
  const a5 = await resolveDeck(swap(a2.parsed, 'Conformer Shuriken', druid));
  assert.equal(a5.notFound.length, 0);
  const current = new Set(a5.cards.map((c) => norm(c.name)));
  const adds = ADDS.map((name) => byName.get(norm(name))).filter((c): c is ScryfallCard => Boolean(c) && !current.has(norm(c.name)));
  const cuts = CUTS.filter((name) => current.has(norm(name)));
  console.log(`adds=${adds.map((c) => c.name).join(', ')}`);
  console.log(`cuts=${cuts.join(', ')}`);
  const beforeM = buildDeckMetrics(a5.parsed, a5.cards);
  const beforePrimary = signals(simulate(a5.parsed, a5.cards, SEEDS[0]!, 300));
  const first: Array<Record<string, unknown>> = [];
  for (const add of adds) for (const cut of cuts) {
    if (COMBO_CARDS.has(norm(cut))) continue;
    const decklist = swap(a5.parsed, cut, add);
    const parsed = parseDecklist(decklist);
    const cards = replaceCard(a5.cards, cut, add);
    const names = new Set([...parsed.commanders, ...parsed.main].map((e) => norm(e.name)));
    if (parsed.totalCards !== 100 || !validateCommanderDeck(parsed, cards).isLegal || !cards.every((c) => printingMatchesPolicyV08(c, policy)) || ![...COMBO_CARDS].every((n) => names.has(n)) || !criticalPreserved(a5.cards, cards)) continue;
    const afterM = buildDeckMetrics(parsed, cards);
    if (floor(afterM, colors.length).length > 0) continue;
    const d = delta(beforePrimary, signals(simulate(parsed, cards, SEEDS[0]!, 300)));
    if (regression(d)) continue;
    first.push({ out: cut, in: add.name, set: add.set.toUpperCase(), collectorNumber: add.collector_number, incomingRoles: inferCardRoles(add).sort(), score: score(beforeM, afterM, d), primaryDelta: d, decklist });
  }
  first.sort((a, b) => num(b.score) - num(a.score));
  const finalists = first.slice(0, 14);
  console.log(`first-pass survivors=${first.length}; top=${finalists.map((x) => `${x.out} -> ${x.in} (${x.score})`).join(' | ')}`);
  const beforeBySeed = new Map<number, Record<string, number>>();
  for (const seed of SEEDS) beforeBySeed.set(seed, signals(simulate(a5.parsed, a5.cards, seed, 1500)));
  const validation: Array<Record<string, unknown>> = [];
  for (const f of finalists) {
    const r = await resolveDeck(String(f.decklist));
    const afterM = buildDeckMetrics(r.parsed, r.cards);
    const runs = SEEDS.map((seed) => {
      const d = delta(beforeBySeed.get(seed)!, signals(simulate(r.parsed, r.cards, seed, 1500)));
      return { seed, delta: d, score: score(beforeM, afterM, d), regression: regression(d) };
    });
    const scores = runs.map((x) => num(x.score));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const positive = scores.filter((x) => x > 0).length;
    const robust = runs.every((x) => !x.regression) && positive === 5 && mean > .35 && min > 0;
    validation.push({ ...f, mean: Number(mean.toFixed(3)), min: Number(min.toFixed(3)), positiveSeeds: positive, robust, runs });
    console.log(`${f.out} -> ${f.in}: mean=${mean.toFixed(3)} min=${min.toFixed(3)} positive=${positive}/5 robust=${robust}`);
  }
  validation.sort((a, b) => num(b.mean) - num(a.mean));
  const champion = validation.find((x) => x.robust === true) ?? null;
  const result = {
    schema: 'counter-blitz-a12-mana-interaction-v1',
    baseline: 'A5: Conformer Shuriken -> Incubation Druid',
    champion: champion ? { out: champion.out, in: champion.in, set: champion.set, collectorNumber: champion.collectorNumber, mean: champion.mean, min: champion.min, positiveSeeds: champion.positiveSeeds, roles: champion.incomingRoles } : null,
    validation: validation.map(({ decklist: _d, ...x }) => x),
    note: 'Exploratory only. No stable/current promotion and no PR #29 merge.',
  };
  await writeFile('counter-blitz-a12-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  if (champion) await writeFile('counter-blitz-a12-deck.txt', `${String(champion.decklist).trim()}\n`, 'utf8');
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('counter-blitz-a12-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
