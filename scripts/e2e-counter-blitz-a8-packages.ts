import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { auditUpgradeDeckStrategyRetentionV15 } from '../src/services/commander-strategy-affinity-v15.js';
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
const SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];
const CRITICAL_ROLES = ['combo protection', 'mana multiplier', 'free interaction', 'free-cast engine', 'early acceleration'] as const;
const PACKAGES = [
  ['Yuna, Grand Summoner', 'Rikku, Resourceful Guardian'],
  ['Yuna, Grand Summoner', 'Resourceful Defense'],
  ['Rikku, Resourceful Guardian', 'Resourceful Defense'],
  ['Yuna, Grand Summoner', 'Shelinda, Yevon Acolyte'],
  ['Rikku, Resourceful Guardian', 'Shelinda, Yevon Acolyte'],
  ['Yuna, Grand Summoner', "O'aka, Traveling Merchant"],
  ['Rikku, Resourceful Guardian', "O'aka, Traveling Merchant"],
  ['Yuna, Grand Summoner', 'Professor Hojo'],
  ['Rikku, Resourceful Guardian', 'Professor Hojo'],
  ['Resourceful Defense', 'Professor Hojo'],
] as const;
const SOFT_CUTS = [
  'Campsite Cuisine',
  'Champions from Beyond',
  'Key to the City',
  'Garnet, Princess of Alexandria',
  'Mask of Memory',
  'Mangara, the Diplomat',
  'Generous Patron',
  'Chasm Skulker',
  'Retrieve the Esper',
  'Tome of Legends',
  'Sazh\'s Chocobo',
  'Bred for the Hunt',
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
function renderSingle(parsed: ParsedDeck, out: string, incoming: ScryfallCard): string {
  let hit = false;
  const main = parsed.main.map((e) => {
    if (!hit && e.quantity === 1 && norm(e.name) === norm(out)) { hit = true; return `1 ${incoming.name} (${incoming.set.toUpperCase()}) ${incoming.collector_number}`; }
    return line(e);
  });
  assert.ok(hit, `missing cut ${out}`);
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}
function renderPair(parsed: ParsedDeck, cuts: readonly string[], adds: readonly ScryfallCard[]): string {
  const cutSet = new Set(cuts.map(norm));
  const kept = parsed.main.filter((e) => !(e.quantity === 1 && cutSet.has(norm(e.name)))).map(line);
  assert.equal(parsed.main.length - kept.length, 2, `pair cuts must each exist once: ${cuts.join(' + ')}`);
  kept.push(...adds.map((c) => `1 ${c.name} (${c.set.toUpperCase()}) ${c.collector_number}`));
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...kept].join('\n');
}
function replaceCards(cards: ScryfallCard[], cuts: readonly string[], adds: readonly ScryfallCard[]): ScryfallCard[] {
  const next = [...cards];
  for (const cut of cuts) {
    const i = next.findIndex((c) => norm(c.name) === norm(cut));
    assert.ok(i >= 0, `missing resolved cut ${cut}`);
    next.splice(i, 1);
  }
  next.push(...adds);
  return next;
}
function identity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
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
function criticalRolesPreserved(before: readonly ScryfallCard[], after: readonly ScryfallCard[]): { passed: boolean; deltas: Record<string, number> } {
  const a = roleCounts(before), b = roleCounts(after);
  const deltas = Object.fromEntries(CRITICAL_ROLES.map((r) => [r, (b[r] ?? 0) - (a[r] ?? 0)]));
  return { passed: Object.values(deltas).every((v) => v >= 0), deltas };
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
function score(beforeM: ReturnType<typeof buildDeckMetrics>, afterM: ReturnType<typeof buildDeckMetrics>, d: Record<string, number>): number {
  let s = num(d.functionalKeepRate) * .45 + num(d.commanderUptimePercent) * .18 + num(d.protectionWinRate) * .2 + num(d.averageSpellsCast) * 4.2 + num(d.averageCardsDrawn) * 2.1 + num(d.tutorHitRate) * .15 + num(d.bestComboReadyTurn7) * .6 + num(d.bestComboSeenTurn7) * .35;
  s += (afterM.cheapInteractionCount - beforeM.cheapInteractionCount) * .6 + (afterM.tutorCount - beforeM.tutorCount) * .9 + (afterM.protectionCount - beforeM.protectionCount) * .5 + (afterM.fastManaCount - beforeM.fastManaCount) * .75 + (beforeM.averageNonlandManaValue - afterM.averageNonlandManaValue) * .8;
  return Number(s.toFixed(3));
}
function regression(d: Record<string, number>): boolean { return num(d.functionalKeepRate) <= -4 || num(d.commanderUptimePercent) <= -6 || num(d.averageSpellsCast) <= -.35 || num(d.bestComboReadyTurn7) <= -4 || num(d.protectionWinRate) <= -10; }

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A8 TARGETED TWO-CARD PACKAGES');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source));
  assert.equal(a2.notFound.length, 0);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined);
  const byName = new Map(pool.map((c) => [norm(c.name), c] as const));
  const druid = byName.get(norm('Incubation Druid'));
  assert.ok(druid, 'Incubation Druid must be eligible');
  const a5 = await resolveDeck(renderSingle(a2.parsed, 'Conformer Shuriken', druid));
  assert.equal(a5.notFound.length, 0);
  assert.equal(validateCommanderDeck(a5.parsed, a5.cards).isLegal, true);
  assert.equal(a5.cards.every((c) => printingMatchesPolicyV08(c, policy)), true);

  const packageCards = PACKAGES.map(([a, b]) => {
    const ca = byName.get(norm(a)), cb = byName.get(norm(b));
    assert.ok(ca && cb, `package cards must resolve inside FF policy: ${a} + ${b}`);
    return { names: [a, b] as const, cards: [ca, cb] as const };
  });
  const cutCards = SOFT_CUTS.map((name) => a5.cards.find((c) => norm(c.name) === norm(name))).filter((c): c is ScryfallCard => Boolean(c));
  const cutPairs: Array<readonly [ScryfallCard, ScryfallCard]> = [];
  for (let i = 0; i < cutCards.length; i++) for (let j = i + 1; j < cutCards.length; j++) cutPairs.push([cutCards[i]!, cutCards[j]!] as const);

  const beforeM = buildDeckMetrics(a5.parsed, a5.cards);
  assert.equal(floor(beforeM, colors.length).length, 0);
  console.log(`baseline=A5; packages=${packageCards.length}; soft cuts=${cutCards.length}; cutPairs=${cutPairs.length}`);

  const baselinePrimary = signals(simulate(a5.parsed, a5.cards, SEEDS[0]!, 250));
  const first: Array<Record<string, unknown>> = [];
  for (const pkg of packageCards) for (const pair of cutPairs) {
    const cuts = pair.map((c) => c.name);
    if (cuts.some((name) => COMBO_CARDS.has(norm(name)))) continue;
    const decklist = renderPair(a5.parsed, cuts, pkg.cards);
    const parsed = parseDecklist(decklist);
    const cards = replaceCards(a5.cards, cuts, pkg.cards);
    if (parsed.totalCards !== 100 || !validateCommanderDeck(parsed, cards).isLegal || !cards.every((c) => printingMatchesPolicyV08(c, policy))) continue;
    const critical = criticalRolesPreserved(a5.cards, cards);
    if (!critical.passed) continue;
    const retention = auditUpgradeDeckStrategyRetentionV15(a5.parsed, a5.cards, parsed, cards);
    if (!retention.preserved) continue;
    const afterM = buildDeckMetrics(parsed, cards);
    if (floor(afterM, colors.length).length > 0) continue;
    const d = delta(baselinePrimary, signals(simulate(parsed, cards, SEEDS[0]!, 250)));
    if (regression(d)) continue;
    first.push({ package: pkg.names, cuts, score: score(beforeM, afterM, d), delta: d, criticalRoleDeltas: critical.deltas, metricDelta: {
      averageNonlandManaValue: Number((afterM.averageNonlandManaValue - beforeM.averageNonlandManaValue).toFixed(3)),
      earlyPlayCount: afterM.earlyPlayCount - beforeM.earlyPlayCount,
      cheapInteractionCount: afterM.cheapInteractionCount - beforeM.cheapInteractionCount,
      protectionCount: afterM.protectionCount - beforeM.protectionCount,
      tutorCount: afterM.tutorCount - beforeM.tutorCount,
    }, decklist });
  }
  first.sort((a, b) => num(b.score) - num(a.score));
  const finalists = first.slice(0, 12);
  console.log(`first-pass survivors=${first.length}`);
  console.log(`top packages: ${finalists.map((x) => `${(x.package as string[]).join(' + ')} / OUT ${(x.cuts as string[]).join(' + ')} (${String(x.score)})`).join(' | ')}`);

  const baselineBySeed = new Map<number, Record<string, number>>();
  for (const seed of SEEDS) baselineBySeed.set(seed, signals(simulate(a5.parsed, a5.cards, seed, 1500)));
  const validated: Array<Record<string, unknown>> = [];
  for (const finalist of finalists) {
    const resolved = await resolveDeck(String(finalist.decklist));
    const afterM = buildDeckMetrics(resolved.parsed, resolved.cards);
    const runs: Array<Record<string, unknown>> = [];
    for (const seed of SEEDS) {
      const d = delta(baselineBySeed.get(seed)!, signals(simulate(resolved.parsed, resolved.cards, seed, 1500)));
      runs.push({ seed, delta: d, score: score(beforeM, afterM, d), regression: regression(d) });
    }
    const scores = runs.map((r) => num(r.score));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const positive = scores.filter((v) => v > 0).length;
    const robust = runs.every((r) => r.regression !== true) && positive >= 4 && mean > .35 && min > -.15;
    validated.push({ ...finalist, mean: Number(mean.toFixed(3)), min: Number(min.toFixed(3)), positiveSeeds: positive, robust, runs });
    console.log(`${(finalist.package as string[]).join(' + ')} / OUT ${(finalist.cuts as string[]).join(' + ')} mean=${mean.toFixed(3)} min=${min.toFixed(3)} positive=${positive}/5 robust=${robust}`);
  }
  validated.sort((a, b) => num(b.mean) - num(a.mean));
  const robust = validated.filter((x) => x.robust === true);
  const champion = robust[0] ?? null;
  const finalDeck = champion ? String(champion.decklist) : renderSingle(a2.parsed, 'Conformer Shuriken', druid);
  const finalResolved = await resolveDeck(finalDeck);
  const names = new Set([...finalResolved.parsed.commanders, ...finalResolved.parsed.main].map((e) => norm(e.name)));
  assert.equal(finalResolved.parsed.totalCards, 100);
  assert.equal(validateCommanderDeck(finalResolved.parsed, finalResolved.cards).isLegal, true);
  assert.equal(finalResolved.cards.every((c) => printingMatchesPolicyV08(c, policy)), true);
  assert.equal([...COMBO_CARDS].every((name) => names.has(name)), true);
  assert.equal(floor(buildDeckMetrics(finalResolved.parsed, finalResolved.cards), colors.length).length, 0);

  const result = {
    schema: 'counter-blitz-a8-targeted-packages-v1',
    baseline: 'A5: Conformer Shuriken -> Incubation Druid',
    packages: PACKAGES,
    softCuts: SOFT_CUTS,
    firstPassTop: first.slice(0, 40).map(({ decklist: _d, ...rest }) => rest),
    validation: validated.map(({ decklist: _d, ...rest }) => rest),
    robustCandidateCount: robust.length,
    champion: champion ? { package: champion.package, cuts: champion.cuts, mean: champion.mean, min: champion.min, positiveSeeds: champion.positiveSeeds, criticalRoleDeltas: champion.criticalRoleDeltas, metricDelta: champion.metricDelta } : null,
    finalDecklist: finalDeck,
    caveat: 'Rikku-style counter-to-evasion and some counter redistribution sequencing are still under-modeled by V0.6 simulation; manual Oracle-text audit remains mandatory.',
    note: 'Exploratory only. No stable/current promotion and no PR #29 merge.',
  };
  await writeFile('counter-blitz-a8-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile('counter-blitz-a8-deck.txt', `${finalDeck.trim()}\n`, 'utf8');
  console.log(`A8 CONCLUSION: ${champion ? `${(champion.package as string[]).join(' + ')} / OUT ${(champion.cuts as string[]).join(' + ')}` : 'no targeted two-card package beat A5 robustly'}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('counter-blitz-a8-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
