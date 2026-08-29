import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { comboAccessQualityV15, preservesComboAccessQualityV15 } from '../src/services/combo-access-quality-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { expandResolvedDeckSlotsV15 } from '../src/services/deck-slots-v15.js';
import { auditFullDeckV15 } from '../src/services/full-deck-audit-v15.js';
import { libraryTypeHasV15 } from '../src/services/library-characteristics-v15.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardOracleText, getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const COMBO_NAMES = ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista', 'The Earth Crystal'] as const;
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];
const PROTECTED_LANDS = new Set(['command tower', 'exotic orchard']);

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
function isBasic(card: ScryfallCard): boolean { return card.type_line.toLocaleLowerCase().includes('basic land'); }
function entersTapped(card: ScryfallCard): boolean { return /\benters tapped\b/i.test(getCardOracleText(card).replace(/\s+/g, ' ')); }
function producedCommanderColors(card: ScryfallCard, colors: readonly string[]): string[] {
  const allowed = new Set(colors.map((color) => color.toUpperCase()));
  return [...new Set((card.produced_mana ?? []).map((color) => color.toUpperCase()).filter((color) => allowed.has(color)))];
}
function utilityRoles(card: ScryfallCard): string[] {
  const ignored = new Set(['mana acceleration', 'land ramp', 'persistent colored mana source']);
  return inferCardRoles(card).filter((role) => !ignored.has(role));
}
function landQuality(card: ScryfallCard, colors: readonly string[]): number {
  const coverage = producedCommanderColors(card, colors).length;
  const utility = utilityRoles(card).length;
  let score = coverage * 3 + utility * 0.75;
  if (!entersTapped(card)) score += 1.5;
  if (isBasic(card)) score += 0.5;
  return Number(score.toFixed(3));
}
function simulate(parsed: ParsedDeck, cards: ScryfallCard[], seed: number): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, { iterations: 1400, advancedIterations: 1400, turns: 7, seed, pressure: 'cedh', comboPieces: COMBOS });
}
function signals(result: Record<string, unknown>): Record<string, number> {
  const baseline = rec(result.baseline);
  const opening = rec(baseline.openingHands);
  const advanced = rec(result.advanced);
  const commander = rec(advanced.commanderPressure);
  const interaction = rec(advanced.interactionPressure);
  const flow = rec(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const ready = combos.map((combo) => num(rec(combo.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  return {
    keep: num(opening.functionalKeepRate),
    uptime: num(commander.battlefieldUptimePercent),
    protection: num(interaction.protectionWinRateWhenChallenged),
    spells: num(flow.averageSpellsCast),
    draws: num(flow.averageCardsDrawnByEffects),
    comboReady: ready.length ? Math.max(...ready) : 0,
  };
}
function delta(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(before).map((key) => [key, Number((num(after[key]) - num(before[key])).toFixed(3))]));
}
function regression(change: Record<string, number>): boolean {
  return num(change.keep) <= -4 || num(change.uptime) <= -6 || num(change.spells) <= -0.35 || num(change.comboReady) <= -4 || num(change.protection) <= -10;
}
function simScore(change: Record<string, number>): number {
  return Number((num(change.keep) * 0.45 + num(change.uptime) * 0.18 + num(change.protection) * 0.22 + num(change.spells) * 4.5 + num(change.draws) * 2 + num(change.comboReady) * 0.7).toFixed(3));
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A18 LAND-SLOT PRESSURE FROM A17 CHAMPION');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source));
  assert.equal(a2.notFound.length, 0);

  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined);
  const byName = new Map(pool.map((card) => [norm(card.name), card] as const));
  const need = (name: string): ScryfallCard => { const found = byName.get(norm(name)); assert.ok(found, `missing FF card ${name}`); return found; };

  const a5 = await resolveDeck(renderChange(a2.parsed, 'Conformer Shuriken', need('Incubation Druid')));
  const a12 = await resolveDeck(renderChange(a5.parsed, 'Retrieve the Esper', need('Everflowing Chalice')));
  const a13a = await resolveDeck(renderChange(a12.parsed, 'Garnet, Princess of Alexandria', need('Arcane Signet')));
  const a14 = await resolveDeck(renderChange(a13a.parsed, "Sazh's Chocobo", need('Endurance')));
  const a16 = await resolveDeck(renderChange(a14.parsed, 'From Father to Son', need('Commune with Beavers')));
  const baseline = await resolveDeck(renderChange(a16.parsed, 'Mangara, the Diplomat', need('Summon: Fenrir')));
  assert.equal(baseline.notFound.length, 0);
  assert.equal(baseline.parsed.totalCards, 100);

  const commander = commanderCard(baseline.parsed, baseline.cards);
  const expanded = expandResolvedDeckSlotsV15(baseline.parsed, baseline.cards);
  assert.equal(expanded.unresolved.length, 0);
  assert.equal(expanded.main.length, 99);
  const comboPieces = COMBO_NAMES.map((name) => baseline.cards.find((card) => norm(card.name) === norm(name))).filter((card): card is ScryfallCard => Boolean(card));
  assert.equal(comboPieces.length, 4);
  const fullAudit = auditFullDeckV15(expanded.main, { commander, comboPieces });
  const baselineMetrics = buildDeckMetrics(baseline.parsed, baseline.cards);
  const landCount = expanded.main.filter((slot) => libraryTypeHasV15(slot.card, 'land')).length;
  assert.equal(landCount, 31);
  assert.equal(structuralFloor(baselineMetrics, colors.length).length, 0);
  const baselineAccess = comboAccessQualityV15(baseline.cards, comboPieces);
  const baselineSignals = new Map(SEEDS.map((seed) => [seed, signals(simulate(baseline.parsed, baseline.cards, seed))] as const));

  const existing = new Set([...baseline.parsed.commanders, ...baseline.parsed.main].map((entry) => norm(entry.name)));
  const candidates = pool.filter((card) => libraryTypeHasV15(card, 'land') && !existing.has(norm(card.name)));
  const pressure = fullAudit.slots
    .filter((slot) => slot.land && !slot.land.basic && !PROTECTED_LANDS.has(norm(slot.cardName)))
    .sort((a, b) => Number(b.status === 'review') - Number(a.status === 'review') || a.score - b.score || Number(b.land?.entersTapped) - Number(a.land?.entersTapped))
    .slice(0, 8);

  const structural: Array<Record<string, unknown>> = [];
  for (const cutFinding of pressure) {
    const cutCard = baseline.cards.find((card) => norm(card.name) === norm(cutFinding.cardName));
    assert.ok(cutCard);
    const cutQuality = landQuality(cutCard, colors);
    for (const add of candidates) {
      const decklist = renderChange(baseline.parsed, cutCard.name, add);
      const parsed = parseDecklist(decklist);
      const cards = replaceCard(baseline.cards, cutCard.name, add);
      const expandedCandidate = expandResolvedDeckSlotsV15(parsed, cards);
      if (expandedCandidate.unresolved.length > 0 || expandedCandidate.main.length !== 99) continue;
      const nextLandCount = expandedCandidate.main.filter((slot) => libraryTypeHasV15(slot.card, 'land')).length;
      if (nextLandCount !== landCount) continue;
      const metrics = buildDeckMetrics(parsed, cards);
      const access = preservesComboAccessQualityV15(baseline.cards, cards, comboPieces);
      if (!validateCommanderDeck(parsed, cards).isLegal) continue;
      if (!cards.every((card) => printingMatchesPolicyV08(card, policy))) continue;
      if (structuralFloor(metrics, colors.length).length > 0) continue;
      if (!access.preserved) continue;
      if (metrics.persistentColoredManaSourceCount < baselineMetrics.persistentColoredManaSourceCount) continue;

      const addQuality = landQuality(add, colors);
      const qualityDelta = Number((addQuality - cutQuality).toFixed(3));
      const coverageDelta = producedCommanderColors(add, colors).length - producedCommanderColors(cutCard, colors).length;
      const tappedDelta = Number(entersTapped(cutCard)) - Number(entersTapped(add));
      const utilityDelta = utilityRoles(add).length - utilityRoles(cutCard).length;
      const preScore = Number((qualityDelta + coverageDelta * 1.5 + tappedDelta * 1.25 + utilityDelta * 0.5).toFixed(3));
      if (preScore <= 0) continue;
      structural.push({ cut: cutCard.name, add: add.name, cutQuality, addQuality, qualityDelta, coverageDelta, tappedDelta, utilityDelta, preScore, decklist, parsed, cards, metrics });
    }
  }

  structural.sort((a, b) => num(b.preScore) - num(a.preScore));
  const finalists = structural.slice(0, 18);
  const evaluated: Array<Record<string, unknown>> = [];
  for (const candidate of finalists) {
    const parsed = candidate.parsed as ParsedDeck;
    const cards = candidate.cards as ScryfallCard[];
    const runs = SEEDS.map((seed) => {
      const change = delta(baselineSignals.get(seed)!, signals(simulate(parsed, cards, seed)));
      return { seed, delta: change, score: simScore(change), regression: regression(change) };
    });
    const scores = runs.map((run) => run.score);
    const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const minimum = Math.min(...scores);
    const positiveSeeds = scores.filter((value) => value > 0).length;
    const safe = runs.every((run) => !run.regression);
    const reviewEligible = safe && positiveSeeds >= 4 && mean > 0 && num(candidate.preScore) > 0;
    const finalScore = Number((num(candidate.preScore) * 0.55 + mean).toFixed(3));
    evaluated.push({
      cut: candidate.cut,
      add: candidate.add,
      cutQuality: candidate.cutQuality,
      addQuality: candidate.addQuality,
      qualityDelta: candidate.qualityDelta,
      coverageDelta: candidate.coverageDelta,
      tappedDelta: candidate.tappedDelta,
      utilityDelta: candidate.utilityDelta,
      preScore: candidate.preScore,
      simulationMean: Number(mean.toFixed(3)),
      simulationMin: Number(minimum.toFixed(3)),
      positiveSeeds,
      safe,
      reviewEligible,
      finalScore,
      metrics: {
        lands: landCount,
        persistentColoredManaSources: (candidate.metrics as ReturnType<typeof buildDeckMetrics>).persistentColoredManaSourceCount,
        averageNonlandManaValue: (candidate.metrics as ReturnType<typeof buildDeckMetrics>).averageNonlandManaValue,
      },
      runs,
      decklist: candidate.decklist,
    });
  }

  evaluated.sort((a, b) => Number(b.reviewEligible) - Number(a.reviewEligible) || num(b.finalScore) - num(a.finalScore));
  const leader = evaluated.find((candidate) => candidate.reviewEligible === true) ?? null;
  if (leader) await writeFile('counter-blitz-a18-leader.txt', `${String(leader.decklist)}\n`, 'utf8');
  const output = {
    schema: 'counter-blitz-a18-land-slot-pressure-v1',
    baseline: 'A17 exploratory champion',
    baselineSwaps: ['From Father to Son -> Commune with Beavers', 'Mangara, the Diplomat -> Summon: Fenrir'],
    baselineAudit: { counts: fullAudit.counts, reviewCards: fullAudit.reviewSlots, challengeCards: fullAudit.challengeSlots },
    baselineAccess,
    landCount,
    pressureLands: pressure.map((slot) => ({ card: slot.cardName, status: slot.status, score: slot.score, land: slot.land, warnings: slot.warnings })),
    eligibleLandCandidates: candidates.length,
    structuralCandidates: structural.length,
    simulatedFinalists: evaluated.length,
    reviewLeader: leader ? { cut: leader.cut, add: leader.add, finalScore: leader.finalScore, simulationMean: leader.simulationMean, simulationMin: leader.simulationMin, positiveSeeds: leader.positiveSeeds } : null,
    evaluated: evaluated.map(({ decklist: _decklist, ...candidate }) => candidate),
    note: 'Exploratory only. A18 starts from the accepted A17 Tidus champion and pressure-tests nonbasic land slots against the complete FF-legal Bant land pool. It preserves exact 100, 31 physical lands, Commander legality, FF printing policy, construction floors, persistent colored-mana count, and real combo access. Manual strategic review remains required.',
  };
  await writeFile('counter-blitz-a18-result.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

await main();
