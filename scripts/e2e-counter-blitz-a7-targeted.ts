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
const CHALLENGERS = [
  'Yuna, Grand Summoner',
  'Rikku, Resourceful Guardian',
  'Resourceful Defense',
  'Professor Hojo',
  'Shelinda, Yevon Acolyte',
  'Together Forever',
  'Forgotten Ancient',
  'Path of Discovery',
  'Summon: Fenrir',
  "O'aka, Traveling Merchant",
];
const CUTS = [
  'Campsite Cuisine',
  'Fathom Mage',
  'Generous Patron',
  'Chasm Skulker',
  'Bred for the Hunt',
  'Retrieve the Esper',
  'Mask of Memory',
  'Tome of Legends',
  'Mangara, the Diplomat',
  'Champions from Beyond',
  'Key to the City',
  'Tireless Tracker',
  'Sazh\'s Chocobo',
  'Garnet, Princess of Alexandria',
];

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
function swap(parsed: ParsedDeck, out: string, incoming: ScryfallCard): string {
  let hit = false;
  const main = parsed.main.map((e) => {
    if (!hit && e.quantity === 1 && norm(e.name) === norm(out)) { hit = true; return `1 ${incoming.name} (${incoming.set.toUpperCase()}) ${incoming.collector_number}`; }
    return line(e);
  });
  assert.ok(hit, `missing cut ${out}`);
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}
function replace(cards: ScryfallCard[], out: string, incoming: ScryfallCard): ScryfallCard[] {
  const next = [...cards];
  const i = next.findIndex((c) => norm(c.name) === norm(out));
  assert.ok(i >= 0, `missing resolved cut ${out}`);
  next.splice(i, 1, incoming);
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
    functionalKeepRate: num(opening.functionalKeepRate),
    commanderUptimePercent: num(commander.battlefieldUptimePercent),
    protectionWinRate: num(interaction.protectionWinRateWhenChallenged),
    averageSpellsCast: num(flow.averageSpellsCast),
    averageCardsDrawn: num(flow.averageCardsDrawnByEffects),
    tutorHitRate: num(tutors.hitRateByTurn7 ?? tutors.hitRate ?? 0),
    bestComboReadyTurn7: ready.length ? Math.max(...ready) : 0,
    bestComboSeenTurn7: seen.length ? Math.max(...seen) : 0,
  };
}
function delta(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(a).map((k) => [k, Number((num(b[k]) - num(a[k])).toFixed(3))]));
}
function score(beforeM: ReturnType<typeof buildDeckMetrics>, afterM: ReturnType<typeof buildDeckMetrics>, d: Record<string, number>): number {
  let s = num(d.functionalKeepRate) * .45 + num(d.commanderUptimePercent) * .18 + num(d.protectionWinRate) * .2 + num(d.averageSpellsCast) * 4.2 + num(d.averageCardsDrawn) * 2.1 + num(d.tutorHitRate) * .15 + num(d.bestComboReadyTurn7) * .6 + num(d.bestComboSeenTurn7) * .35;
  s += (afterM.cheapInteractionCount - beforeM.cheapInteractionCount) * .6 + (afterM.tutorCount - beforeM.tutorCount) * .9 + (afterM.protectionCount - beforeM.protectionCount) * .5 + (afterM.fastManaCount - beforeM.fastManaCount) * .75 + (beforeM.averageNonlandManaValue - afterM.averageNonlandManaValue) * .8;
  return Number(s.toFixed(3));
}
function regression(d: Record<string, number>): boolean {
  return num(d.functionalKeepRate) <= -4 || num(d.commanderUptimePercent) <= -6 || num(d.averageSpellsCast) <= -.35 || num(d.bestComboReadyTurn7) <= -4 || num(d.protectionWinRate) <= -10;
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A7 TARGETED SEARCH');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source));
  assert.equal(a2.notFound.length, 0);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined);
  const byName = new Map(pool.map((c) => [norm(c.name), c] as const));

  const druid = byName.get(norm('Incubation Druid'));
  assert.ok(druid, 'Incubation Druid must be in eligible FF pool');
  const a5Deck = swap(a2.parsed, 'Conformer Shuriken', druid);
  const baseline = await resolveDeck(a5Deck);
  assert.equal(baseline.notFound.length, 0);
  assert.equal(validateCommanderDeck(baseline.parsed, baseline.cards).isLegal, true);
  assert.equal(baseline.cards.every((c) => printingMatchesPolicyV08(c, policy)), true);
  assert.equal(floor(buildDeckMetrics(baseline.parsed, baseline.cards), colors.length).length, 0);

  const incoming = CHALLENGERS.map((name) => byName.get(norm(name))).filter((c): c is ScryfallCard => Boolean(c) && !baseline.cards.some((x) => norm(x.name) === norm(c.name)));
  const cuts = CUTS.map((name) => baseline.cards.find((c) => norm(c.name) === norm(name))).filter((c): c is ScryfallCard => Boolean(c));
  console.log(`baseline=A5 Conformer Shuriken -> Incubation Druid; challengers=${incoming.length}; cuts=${cuts.length}`);
  console.log(`challengers: ${incoming.map((c) => c.name).join(', ')}`);
  console.log(`cuts: ${cuts.map((c) => c.name).join(', ')}`);

  const beforeM = buildDeckMetrics(baseline.parsed, baseline.cards);
  const beforePrimary = signals(simulate(baseline.parsed, baseline.cards, SEEDS[0]!, 250));
  const first: Array<Record<string, unknown>> = [];
  for (const add of incoming) for (const cut of cuts) {
    if (COMBO_CARDS.has(norm(cut.name))) continue;
    const decklist = swap(baseline.parsed, cut.name, add);
    const parsed = parseDecklist(decklist);
    const cards = replace(baseline.cards, cut.name, add);
    if (!validateCommanderDeck(parsed, cards).isLegal || parsed.totalCards !== 100) continue;
    if (!cards.every((c) => printingMatchesPolicyV08(c, policy))) continue;
    const retention = auditUpgradeDeckStrategyRetentionV15(baseline.parsed, baseline.cards, parsed, cards);
    if (!retention.preserved) continue;
    const afterM = buildDeckMetrics(parsed, cards);
    if (floor(afterM, colors.length).length > 0) continue;
    const d = delta(beforePrimary, signals(simulate(parsed, cards, SEEDS[0]!, 250)));
    if (regression(d)) continue;
    first.push({ out: cut.name, in: add.name, set: add.set.toUpperCase(), collectorNumber: add.collector_number, score: score(beforeM, afterM, d), delta: d, decklist, metricDelta: {
      averageNonlandManaValue: Number((afterM.averageNonlandManaValue - beforeM.averageNonlandManaValue).toFixed(3)),
      earlyPlayCount: afterM.earlyPlayCount - beforeM.earlyPlayCount,
      cheapInteractionCount: afterM.cheapInteractionCount - beforeM.cheapInteractionCount,
      protectionCount: afterM.protectionCount - beforeM.protectionCount,
      tutorCount: afterM.tutorCount - beforeM.tutorCount,
    }, outgoingRoles: [...roles(cut)].sort(), incomingRoles: [...roles(add)].sort() });
  }
  first.sort((a, b) => num(b.score) - num(a.score));
  const finalists = first.slice(0, 10);
  console.log(`first-pass survivors=${first.length}; finalists=${finalists.map((x) => `${String(x.out)} -> ${String(x.in)} (${String(x.score)})`).join(' | ')}`);

  const beforeBySeed = new Map<number, Record<string, number>>();
  for (const seed of SEEDS) beforeBySeed.set(seed, signals(simulate(baseline.parsed, baseline.cards, seed, 1500)));
  const validated: Array<Record<string, unknown>> = [];
  for (const f of finalists) {
    const resolved = await resolveDeck(String(f.decklist));
    const afterM = buildDeckMetrics(resolved.parsed, resolved.cards);
    const runs: Array<Record<string, unknown>> = [];
    for (const seed of SEEDS) {
      const d = delta(beforeBySeed.get(seed)!, signals(simulate(resolved.parsed, resolved.cards, seed, 1500)));
      runs.push({ seed, delta: d, score: score(beforeM, afterM, d), regression: regression(d) });
    }
    const scores = runs.map((r) => num(r.score));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const positive = scores.filter((v) => v > 0).length;
    const robust = runs.every((r) => r.regression !== true) && positive === 5 && mean > .35 && min > 0;
    validated.push({ ...f, mean: Number(mean.toFixed(3)), min: Number(min.toFixed(3)), positiveSeeds: positive, robust, runs });
    console.log(`${String(f.out)} -> ${String(f.in)} mean=${mean.toFixed(3)} min=${min.toFixed(3)} positive=${positive}/5 robust=${robust}`);
  }
  validated.sort((a, b) => num(b.mean) - num(a.mean));
  const champion = validated.find((x) => x.robust === true) ?? null;
  const finalDeck = champion ? String(champion.decklist) : a5Deck;
  const finalResolved = await resolveDeck(finalDeck);
  const names = new Set([...finalResolved.parsed.commanders, ...finalResolved.parsed.main].map((e) => norm(e.name)));
  assert.equal(finalResolved.parsed.totalCards, 100);
  assert.equal(validateCommanderDeck(finalResolved.parsed, finalResolved.cards).isLegal, true);
  assert.equal(finalResolved.cards.every((c) => printingMatchesPolicyV08(c, policy)), true);
  assert.equal([...COMBO_CARDS].every((name) => names.has(name)), true);
  assert.equal(floor(buildDeckMetrics(finalResolved.parsed, finalResolved.cards), colors.length).length, 0);

  const result = {
    schema: 'counter-blitz-a7-targeted-v1',
    baselineSwap: 'Conformer Shuriken -> Incubation Druid',
    challengerNames: incoming.map((c) => c.name),
    cutNames: cuts.map((c) => c.name),
    firstPassTop: first.slice(0, 30).map(({ decklist: _d, ...rest }) => rest),
    validation: validated.map(({ decklist: _d, ...rest }) => rest),
    champion: champion ? { out: champion.out, in: champion.in, set: champion.set, collectorNumber: champion.collectorNumber, mean: champion.mean, min: champion.min, positiveSeeds: champion.positiveSeeds } : null,
    finalDecklist: finalDeck,
    note: 'Exploratory only. No stable/current promotion and no PR #29 merge.',
  };
  await writeFile('counter-blitz-a7-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile('counter-blitz-a7-deck.txt', `${finalDeck.trim()}\n`, 'utf8');
  console.log(`A7 CONCLUSION: ${champion ? `${String(champion.out)} -> ${String(champion.in)}` : 'no second targeted swap cleared the strict five-seed rule'}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('counter-blitz-a7-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
