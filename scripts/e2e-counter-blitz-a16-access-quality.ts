import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { auditCardPurposeV15 } from '../src/services/card-purpose-v15.js';
import { comboAccessQualityV15, preservesComboAccessQualityV15 } from '../src/services/combo-access-quality-v15.js';
import { boundedComboSelectionAccessV15 } from '../src/services/combo-selection-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const COMBO_NAMES = ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista', 'The Earth Crystal'] as const;
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const TARGET_CUTS = ['From Father to Son', 'Cloud, Midgar Mercenary', 'Sidequest: Raise a Chocobo // Black Chocobo'] as const;
const SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];
const CRITICAL_ROLES = ['combo protection', 'mana multiplier', 'free interaction', 'free-cast engine', 'early acceleration'] as const;

function norm(value: string): string { return value.trim().toLocaleLowerCase(); }
function rec(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function num(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function extractA2(markdown: string): string {
  const match = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(match?.[1], 'could not extract A2 deck');
  return match[1].trim().replace('1 Archmage Emeritus (FIC) 261', '1 The Earth Crystal (FIN) 184');
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
function replaceCard(cards: readonly ScryfallCard[], cut: string, add: ScryfallCard): ScryfallCard[] {
  const next = [...cards];
  const index = next.findIndex((card) => norm(card.name) === norm(cut));
  assert.ok(index >= 0, `missing resolved cut ${cut}`);
  next.splice(index, 1, add);
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
  const a = roleCounts(before);
  const b = roleCounts(after);
  return CRITICAL_ROLES.every((role) => (b[role] ?? 0) >= (a[role] ?? 0));
}
function structuralFloorWithoutGenericTutorCount(metrics: ReturnType<typeof buildDeckMetrics>, colors: number): string[] {
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
  const baseline = rec(result.baseline);
  const opening = rec(baseline.openingHands);
  const tutors = rec(baseline.tutors);
  const advanced = rec(result.advanced);
  const commander = rec(advanced.commanderPressure);
  const interaction = rec(advanced.interactionPressure);
  const flow = rec(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const ready = combos.map((combo) => num(rec(combo.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  const seen = combos.map((combo) => num(rec(combo.allNamedPiecesSeenByTurn).turn7));
  return {
    keep: num(opening.functionalKeepRate),
    uptime: num(commander.battlefieldUptimePercent),
    protection: num(interaction.protectionWinRateWhenChallenged),
    spells: num(flow.averageSpellsCast),
    draws: num(flow.averageCardsDrawnByEffects),
    tutorHit: num(tutors.hitRateByTurn7 ?? tutors.hitRate ?? 0),
    comboReady: ready.length ? Math.max(...ready) : 0,
    comboSeen: seen.length ? Math.max(...seen) : 0,
  };
}
function delta(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(before).map((key) => [key, Number((num(after[key]) - num(before[key])).toFixed(3))]));
}
function regression(change: Record<string, number>): boolean {
  return num(change.keep) <= -4 || num(change.uptime) <= -6 || num(change.spells) <= -0.35 || num(change.comboReady) <= -4 || num(change.protection) <= -10;
}
function score(change: Record<string, number>): number {
  return Number((num(change.keep) * 0.45 + num(change.uptime) * 0.18 + num(change.protection) * 0.22 + num(change.spells) * 4.5 + num(change.draws) * 2 + num(change.tutorHit) * 0.2 + num(change.comboReady) * 0.7 + num(change.comboSeen) * 0.35).toFixed(3));
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A16 EFFECTIVE COMBO ACCESS CHALLENGE');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source));
  assert.equal(a2.notFound.length, 0);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined);
  const byName = new Map(pool.map((card) => [norm(card.name), card] as const));
  const need = (name: string): ScryfallCard => { const found = byName.get(norm(name)); assert.ok(found, `missing FF candidate ${name}`); return found; };

  const a5 = await resolveDeck(renderChange(a2.parsed, 'Conformer Shuriken', need('Incubation Druid')));
  const a12 = await resolveDeck(renderChange(a5.parsed, 'Retrieve the Esper', need('Everflowing Chalice')));
  const a13a = await resolveDeck(renderChange(a12.parsed, 'Garnet, Princess of Alexandria', need('Arcane Signet')));
  const baseline = await resolveDeck(renderChange(a13a.parsed, "Sazh's Chocobo", need('Endurance')));
  assert.equal(baseline.notFound.length, 0);
  assert.equal(baseline.parsed.totalCards, 100);

  const commander = commanderCard(baseline.parsed, baseline.cards);
  const comboPieces = COMBO_NAMES.map((name) => baseline.cards.find((card) => norm(card.name) === norm(name))).filter((card): card is ScryfallCard => Boolean(card));
  assert.equal(comboPieces.length, 4);
  const baselineAccess = comboAccessQualityV15(baseline.cards, comboPieces);
  const baselineSignals = new Map(SEEDS.map((seed) => [seed, signals(simulate(baseline.parsed, baseline.cards, seed))] as const));
  const existing = new Set([...baseline.parsed.commanders, ...baseline.parsed.main].map((entry) => norm(entry.name)));
  const selectors = pool.map((selector) => {
    const access = comboPieces.map((piece) => boundedComboSelectionAccessV15(selector, piece));
    const hits = access.filter((entry) => entry.matched);
    return { selector, hits: hits.map((entry) => entry.pieceName), depth: Math.max(0, ...hits.map((entry) => entry.depth ?? 0)) };
  }).filter((entry) => entry.hits.length > 0 && !existing.has(norm(entry.selector.name)))
    .sort((a, b) => b.hits.length - a.hits.length || b.depth - a.depth || a.selector.cmc - b.selector.cmc);

  const evaluated: Array<Record<string, unknown>> = [];
  for (const cut of TARGET_CUTS) {
    const cutCard = baseline.cards.find((card) => norm(card.name) === norm(cut));
    if (!cutCard) continue;
    const cutPurpose = auditCardPurposeV15(cutCard, { deck: baseline.cards, commander, comboPieces });
    for (const entry of selectors) {
      const decklist = renderChange(baseline.parsed, cut, entry.selector);
      const parsed = parseDecklist(decklist);
      const cards = replaceCard(baseline.cards, cut, entry.selector);
      const metrics = buildDeckMetrics(parsed, cards);
      const access = preservesComboAccessQualityV15(baseline.cards, cards, comboPieces);
      const names = new Set([...parsed.commanders, ...parsed.main].map((item) => norm(item.name)));
      const hard = parsed.totalCards === 100
        && validateCommanderDeck(parsed, cards).isLegal
        && cards.every((card) => printingMatchesPolicyV08(card, policy))
        && COMBO_NAMES.every((name) => names.has(norm(name)))
        && criticalPreserved(baseline.cards, cards)
        && structuralFloorWithoutGenericTutorCount(metrics, colors.length).length === 0
        && access.preserved;
      if (!hard) continue;

      const addPurpose = auditCardPurposeV15(entry.selector, { deck: cards, commander, comboPieces });
      const runs = SEEDS.map((seed) => {
        const change = delta(baselineSignals.get(seed)!, signals(simulate(parsed, cards, seed)));
        return { seed, delta: change, score: score(change), regression: regression(change) };
      });
      const scores = runs.map((run) => run.score);
      const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      evaluated.push({
        cut,
        add: entry.selector.name,
        comboHits: entry.hits,
        depth: entry.depth,
        cutStatus: cutPurpose.status,
        cutPurposeScore: cutPurpose.score,
        addPurposeScore: addPurpose.score,
        purposeDelta: addPurpose.score - cutPurpose.score,
        accessBefore: baselineAccess,
        accessAfter: access.after,
        accessScoreDelta: Number((access.after.weightedScore - baselineAccess.weightedScore).toFixed(3)),
        simulationMean: Number(mean.toFixed(3)),
        simulationMin: Number(Math.min(...scores).toFixed(3)),
        positiveSeeds: scores.filter((value) => value > 0).length,
        safe: runs.every((run) => !run.regression),
        genericTutorCountAfter: metrics.tutorCount,
        runs,
      });
    }
  }

  evaluated.sort((a, b) => num(b.accessScoreDelta) - num(a.accessScoreDelta) || num(b.purposeDelta) - num(a.purposeDelta) || num(b.simulationMean) - num(a.simulationMean));
  const output = {
    schema: 'counter-blitz-a16-effective-combo-access-v1',
    baselineAccess,
    candidates: evaluated,
    note: 'Exploratory access-quality challenge. Generic tutor count is reported but not used as a hard gate; real deterministic access must be preserved and unique/weighted win-piece access may not regress. Manual strategic review is still required.',
  };
  await writeFile('counter-blitz-a16-access-quality.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log('Access-quality candidates:', evaluated.map((candidate) => `${candidate.cut}->${candidate.add} access=${candidate.accessScoreDelta} sim=${candidate.simulationMean} positive=${candidate.positiveSeeds}/5`).join(' | '));
}

await main();
