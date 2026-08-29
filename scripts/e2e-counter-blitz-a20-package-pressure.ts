import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { auditCardPurposeV15 } from '../src/services/card-purpose-v15.js';
import { comboAccessQualityV15, preservesComboAccessQualityV15 } from '../src/services/combo-access-quality-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { expandResolvedDeckSlotsV15 } from '../src/services/deck-slots-v15.js';
import { auditFullDeckV15 } from '../src/services/full-deck-audit-v15.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const COMBO_NAMES = ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista', 'The Earth Crystal'] as const;
const COMBO_SET = new Set(COMBO_NAMES.map((name) => name.toLocaleLowerCase()));
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const PROTECTED_NAMES = [
  'Counterspell', "An Offer You Can't Refuse", 'Force of Negation', 'Silence', "Nature's Claim",
  "Conqueror's Flail", 'Ranger-Captain of Eos', 'Cyclonic Rift', 'Swords to Plowshares', 'Path to Exile',
  'Heroic Intervention', 'Arcane Signet', 'Everflowing Chalice', 'Incubation Druid', 'Endurance',
  'Kinnan, Bonder Prodigy', 'Birds of Paradise', 'Sol Ring', 'Commune with Beavers', 'Summon: Fenrir',
  'Walking Ballista', 'Gatta and Luzzu', 'Hardened Scales', 'The Earth Crystal',
] as const;
const CRITICAL_ROLES = ['combo protection', 'mana multiplier', 'free interaction', 'free-cast engine', 'early acceleration'] as const;
const SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];
const STATUS_WEIGHT = { challenge: 0, review: 1, supported: 2, locked: 99 } as const;

function norm(value: string): string { return value.trim().toLocaleLowerCase(); }
function rec(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function num(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function unique(values: readonly string[]): string[] { return [...new Set(values)]; }
function pairs<T>(items: readonly T[]): Array<[T, T]> {
  const out: Array<[T, T]> = [];
  for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) out.push([items[i]!, items[j]!]);
  return out;
}
function extractA2(markdown: string): string {
  const match = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(match?.[1], 'could not extract A2 deck');
  return match[1].trim().replace('1 Archmage Emeritus (FIC) 261', '1 The Earth Crystal (FIN) 184');
}
function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({ name: entry.name, ...(entry.set ? { set: entry.set } : {}), ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}) }));
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
function renderPackage(parsed: ParsedDeck, cuts: readonly string[], adds: readonly ScryfallCard[]): string {
  const cutSet = new Set(cuts.map(norm));
  const main = parsed.main.filter((entry) => !(entry.quantity === 1 && cutSet.has(norm(entry.name)))).map(line);
  assert.equal(parsed.main.length - main.length, cuts.length, `missing cuts: ${cuts.join(' + ')}`);
  main.push(...adds.map((card) => `1 ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`));
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}
function replacePackage(cards: readonly ScryfallCard[], cuts: readonly string[], adds: readonly ScryfallCard[]): ScryfallCard[] {
  const next = [...cards];
  for (const cut of cuts) {
    const index = next.findIndex((card) => norm(card.name) === norm(cut));
    assert.ok(index >= 0, `missing resolved cut ${cut}`);
    next.splice(index, 1);
  }
  next.push(...adds);
  return next;
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
function roleCounts(cards: readonly ScryfallCard[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const card of cards) for (const role of inferCardRoles(card)) out[role] = (out[role] ?? 0) + 1;
  return out;
}
function criticalPreserved(before: readonly ScryfallCard[], after: readonly ScryfallCard[]): boolean {
  const a = roleCounts(before); const b = roleCounts(after);
  return CRITICAL_ROLES.every((role) => (b[role] ?? 0) >= (a[role] ?? 0));
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
function simulate(parsed: ParsedDeck, cards: ScryfallCard[], seed: number): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, { iterations: 1400, advancedIterations: 1400, turns: 7, seed, pressure: 'cedh', comboPieces: COMBOS });
}
function signals(result: Record<string, unknown>): Record<string, number> {
  const baseline = rec(result.baseline); const opening = rec(baseline.openingHands);
  const advanced = rec(result.advanced); const commander = rec(advanced.commanderPressure); const interaction = rec(advanced.interactionPressure); const flow = rec(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const ready = combos.map((combo) => num(rec(combo.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  const seen = combos.map((combo) => num(rec(combo.allNamedPiecesSeenByTurn).turn7));
  return { keep: num(opening.functionalKeepRate), uptime: num(commander.battlefieldUptimePercent), protection: num(interaction.protectionWinRateWhenChallenged), spells: num(flow.averageSpellsCast), draws: num(flow.averageCardsDrawnByEffects), comboReady: ready.length ? Math.max(...ready) : 0, comboSeen: seen.length ? Math.max(...seen) : 0 };
}
function delta(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(before).map((key) => [key, Number((num(after[key]) - num(before[key])).toFixed(3))]));
}
function regression(change: Record<string, number>): boolean {
  return num(change.keep) <= -4 || num(change.uptime) <= -6 || num(change.spells) <= -0.35 || num(change.comboReady) <= -4 || num(change.protection) <= -10;
}
function simulationScore(before: ReturnType<typeof buildDeckMetrics>, after: ReturnType<typeof buildDeckMetrics>, change: Record<string, number>): number {
  let score = num(change.keep) * 0.45 + num(change.uptime) * 0.18 + num(change.protection) * 0.22 + num(change.spells) * 4.5 + num(change.draws) * 2 + num(change.comboReady) * 0.7 + num(change.comboSeen) * 0.35;
  score += (after.cheapInteractionCount - before.cheapInteractionCount) * 0.65
    + (Number(after.roleCounts['free interaction'] ?? 0) - Number(before.roleCounts['free interaction'] ?? 0)) * 1.4
    + (after.rampCount - before.rampCount) * 0.35
    + (after.persistentColoredManaSourceCount - before.persistentColoredManaSourceCount) * 0.4
    + (before.averageNonlandManaValue - after.averageNonlandManaValue) * 0.9;
  return Number(score.toFixed(3));
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A20 TWO-CARD PACKAGE PRESSURE FROM A17 CHAMPION');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source)); assert.equal(a2.notFound.length, 0);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined);
  const byName = new Map(pool.map((card) => [norm(card.name), card] as const));
  const need = (name: string): ScryfallCard => { const found = byName.get(norm(name)); assert.ok(found, `missing FF card ${name}`); return found; };

  const a5 = await resolveDeck(renderPackage(a2.parsed, ['Conformer Shuriken'], [need('Incubation Druid')]));
  const a12 = await resolveDeck(renderPackage(a5.parsed, ['Retrieve the Esper'], [need('Everflowing Chalice')]));
  const a13a = await resolveDeck(renderPackage(a12.parsed, ['Garnet, Princess of Alexandria'], [need('Arcane Signet')]));
  const a14 = await resolveDeck(renderPackage(a13a.parsed, ["Sazh's Chocobo"], [need('Endurance')]));
  const a16 = await resolveDeck(renderPackage(a14.parsed, ['From Father to Son'], [need('Commune with Beavers')]));
  const baseline = await resolveDeck(renderPackage(a16.parsed, ['Mangara, the Diplomat'], [need('Summon: Fenrir')]));
  assert.equal(baseline.notFound.length, 0); assert.equal(baseline.parsed.totalCards, 100);

  const commander = commanderCard(baseline.parsed, baseline.cards);
  const expanded = expandResolvedDeckSlotsV15(baseline.parsed, baseline.cards); assert.equal(expanded.unresolved.length, 0); assert.equal(expanded.main.length, 99);
  const physicalMain = expanded.main.map((slot) => slot.card);
  const comboPieces = COMBO_NAMES.map((name) => baseline.cards.find((card) => norm(card.name) === norm(name))).filter((card): card is ScryfallCard => Boolean(card)); assert.equal(comboPieces.length, 4);
  const audit = auditFullDeckV15(expanded.main, { commander, comboPieces, protectedCardNames: PROTECTED_NAMES });
  const protectedSet = new Set(PROTECTED_NAMES.map(norm));

  const pressureByName = new Map<string, (typeof audit.slots)[number]>();
  for (const finding of audit.slots) {
    if (finding.land || finding.status === 'locked' || protectedSet.has(norm(finding.cardName)) || COMBO_SET.has(norm(finding.cardName))) continue;
    const current = pressureByName.get(norm(finding.cardName));
    if (!current || STATUS_WEIGHT[finding.status] < STATUS_WEIGHT[current.status] || finding.score < current.score) pressureByName.set(norm(finding.cardName), finding);
  }
  const pressureCuts = [...pressureByName.values()].sort((a, b) => STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status] || a.score - b.score || a.cardName.localeCompare(b.cardName)).slice(0, 14);
  const cutPairs = pairs(pressureCuts);

  const existing = new Set([...baseline.parsed.commanders, ...baseline.parsed.main].map((entry) => norm(entry.name)));
  const openNonlands = pool.filter((card) => !existing.has(norm(card.name)) && !card.type_line.toLocaleLowerCase().includes('land'));
  const baselineAccess = comboAccessQualityV15(baseline.cards, comboPieces);
  const scoredAdds = openNonlands.map((card) => {
    const purpose = auditCardPurposeV15(card, { deck: [...physicalMain, card], commander, comboPieces, protectedCardNames: PROTECTED_NAMES });
    const accessAfter = comboAccessQualityV15([...baseline.cards, card], comboPieces);
    const accessGain = Math.max(0, accessAfter.weightedScore - baselineAccess.weightedScore);
    const roles = inferCardRoles(card);
    const roleBreadth = unique(roles).length;
    const score = purpose.score * 2 + accessGain * 0.65 + Math.min(5, roleBreadth) * 0.15 + Math.max(0, 4 - card.cmc) * 0.1;
    return { card, purpose, accessGain, score: Number(score.toFixed(3)) };
  }).filter((entry) => entry.purpose.status !== 'challenge').sort((a, b) => b.score - a.score || a.card.cmc - b.card.cmc).slice(0, 36);
  const addPairs = pairs(scoredAdds);

  const baselineMetrics = buildDeckMetrics(baseline.parsed, baseline.cards); assert.equal(structuralFloor(baselineMetrics, colors.length).length, 0);
  const baselineSignals = new Map(SEEDS.map((seed) => [seed, signals(simulate(baseline.parsed, baseline.cards, seed))] as const));
  const structural: Array<Record<string, unknown>> = [];

  for (const [cutA, cutB] of cutPairs) {
    const cuts = [cutA.cardName, cutB.cardName];
    const cutPurposeScore = cutA.score + cutB.score;
    const cutPurposeSet = new Set([...cutA.purposes, ...cutB.purposes]);
    const cutCards = cuts.map((name) => physicalMain.find((card) => norm(card.name) === norm(name))).filter((card): card is ScryfallCard => Boolean(card));
    if (cutCards.length !== 2) continue;

    for (const [entryA, entryB] of addPairs) {
      const adds = [entryA.card, entryB.card];
      if (norm(adds[0].name) === norm(adds[1].name)) continue;
      const decklist = renderPackage(baseline.parsed, cuts, adds);
      const parsed = parseDecklist(decklist);
      const cards = replacePackage(baseline.cards, cuts, adds);
      const metrics = buildDeckMetrics(parsed, cards);
      const access = preservesComboAccessQualityV15(baseline.cards, cards, comboPieces);
      const names = new Set([...parsed.commanders, ...parsed.main].map((entry) => norm(entry.name)));
      const hard = parsed.totalCards === 100
        && validateCommanderDeck(parsed, cards).isLegal
        && cards.every((card) => printingMatchesPolicyV08(card, policy))
        && COMBO_NAMES.every((name) => names.has(norm(name)))
        && criticalPreserved(baseline.cards, cards)
        && structuralFloor(metrics, colors.length).length === 0
        && access.preserved;
      if (!hard) continue;

      const addPurposes = adds.map((add) => auditCardPurposeV15(add, { deck: cards, commander, comboPieces, protectedCardNames: PROTECTED_NAMES }));
      if (addPurposes.some((purpose) => purpose.status === 'challenge')) continue;
      const addPurposeScore = addPurposes.reduce((sum, purpose) => sum + purpose.score, 0);
      const purposeDelta = addPurposeScore - cutPurposeScore;
      const addPurposeSet = new Set(addPurposes.flatMap((purpose) => purpose.purposes));
      const continuity = [...cutPurposeSet].filter((purpose) => addPurposeSet.has(purpose)).length;
      const accessDelta = Number((access.after.weightedScore - baselineAccess.weightedScore).toFixed(3));
      const mvDelta = Number((cutCards.reduce((s, c) => s + c.cmc, 0) - adds.reduce((s, c) => s + c.cmc, 0)).toFixed(2));
      const roleDiversity = unique(adds.flatMap((card) => inferCardRoles(card))).length;
      const preScore = Number((purposeDelta * 1.35 + continuity * 0.7 + accessDelta * 0.6 + mvDelta * 0.15 + Math.min(6, roleDiversity) * 0.08).toFixed(3));
      if (purposeDelta < 0 && accessDelta <= 0) continue;
      if (continuity === 0 && purposeDelta < 2 && accessDelta <= 0) continue;
      structural.push({ cuts, adds: adds.map((card) => card.name), cutPurposeScore, addPurposeScore, purposeDelta, continuity, accessDelta, mvDelta, roleDiversity, preScore, metrics, parsed, cards, decklist });
    }
  }

  structural.sort((a, b) => num(b.preScore) - num(a.preScore));
  const finalists = structural.slice(0, 30);
  const evaluated: Array<Record<string, unknown>> = [];
  for (const candidate of finalists) {
    const parsed = candidate.parsed as ParsedDeck; const cards = candidate.cards as ScryfallCard[]; const metrics = candidate.metrics as ReturnType<typeof buildDeckMetrics>;
    const runs = SEEDS.map((seed) => { const change = delta(baselineSignals.get(seed)!, signals(simulate(parsed, cards, seed))); return { seed, delta: change, score: simulationScore(baselineMetrics, metrics, change), regression: regression(change) }; });
    const scores = runs.map((run) => run.score); const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length; const minimum = Math.min(...scores); const positiveSeeds = scores.filter((value) => value > 0).length; const safe = runs.every((run) => !run.regression);
    const reviewEligible = safe && positiveSeeds >= 4 && mean > 0 && num(candidate.preScore) > 0;
    const finalScore = Number((mean + num(candidate.purposeDelta) * 0.25 + num(candidate.continuity) * 0.12 + num(candidate.accessDelta) * 0.2).toFixed(3));
    evaluated.push({ cuts: candidate.cuts, adds: candidate.adds, purposeDelta: candidate.purposeDelta, continuity: candidate.continuity, accessDelta: candidate.accessDelta, mvDelta: candidate.mvDelta, roleDiversity: candidate.roleDiversity, preScore: candidate.preScore, simulationMean: Number(mean.toFixed(3)), simulationMin: Number(minimum.toFixed(3)), positiveSeeds, safe, reviewEligible, finalScore, metrics: { averageNonlandManaValue: metrics.averageNonlandManaValue, ramp: metrics.rampCount, cheapInteraction: metrics.cheapInteractionCount, freeInteraction: Number(metrics.roleCounts['free interaction'] ?? 0), persistentColoredManaSources: metrics.persistentColoredManaSourceCount }, runs, decklist: candidate.decklist });
  }
  evaluated.sort((a, b) => Number(b.reviewEligible) - Number(a.reviewEligible) || num(b.finalScore) - num(a.finalScore));
  const leader = evaluated.find((candidate) => candidate.reviewEligible === true) ?? null;
  if (leader) await writeFile('counter-blitz-a20-leader.txt', `${String(leader.decklist)}\n`, 'utf8');
  const output = { schema: 'counter-blitz-a20-two-card-package-pressure-v1', baseline: 'A17 exploratory champion after A18/A19 no-change controls', baselineSwaps: ['From Father to Son -> Commune with Beavers', 'Mangara, the Diplomat -> Summon: Fenrir'], audit: { counts: audit.counts, reviewCards: audit.reviewSlots, challengeCards: audit.challengeSlots }, baselineAccess, pressureCuts: pressureCuts.map((finding) => ({ card: finding.cardName, status: finding.status, score: finding.score, purposes: finding.purposes, warnings: finding.warnings })), candidateShortlist: scoredAdds.map((entry) => ({ card: entry.card.name, score: entry.score, purposeStatus: entry.purpose.status, purposeScore: entry.purpose.score, purposes: entry.purpose.purposes, accessGain: Number(entry.accessGain.toFixed(3)) })), cutPairs: cutPairs.length, addPairs: addPairs.length, structuralCandidates: structural.length, simulatedFinalists: evaluated.length, reviewLeader: leader ? { cuts: leader.cuts, adds: leader.adds, finalScore: leader.finalScore, simulationMean: leader.simulationMean, simulationMin: leader.simulationMin, positiveSeeds: leader.positiveSeeds, purposeDelta: leader.purposeDelta, continuity: leader.continuity, accessDelta: leader.accessDelta } : null, evaluated: evaluated.map(({ decklist: _decklist, ...candidate }) => candidate), note: 'Exploratory only. A20 tests coherent 2-for-2 packages after A18/A19 found no acceptable isolated land or nonland swap. Hard truth, real combo access, critical roles, construction floors, and five-seed regression gates remain mandatory. Manual Oracle/package review is required before acceptance.' };
  await writeFile('counter-blitz-a20-result.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

await main();
