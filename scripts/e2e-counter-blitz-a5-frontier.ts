import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import {
  auditUpgradeDeckStrategyRetentionV15,
  cardCommanderStrategyAffinityV15,
  deriveUpgradeStrategyContextV15,
} from '../src/services/commander-strategy-affinity-v15.js';
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

const BRANCH = 'test/counter-blitz-a5-semantic-frontier-20260829';
const COMBO_CARDS = new Set(['gatta and luzzu', 'hardened scales', 'walking ballista', 'the earth crystal']);
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const PRIMARY_SEED = 20260829;
const VALIDATION_SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];
const CRITICAL_EXACT_ROLES = ['combo protection', 'mana multiplier', 'free interaction', 'free-cast engine'] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function n(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function normalize(value: string): string { return value.trim().toLocaleLowerCase(); }

function extractA2Deck(markdown: string): string {
  const match = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(match?.[1], 'could not extract Version A decklist');
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
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  return { parsed, cards: resolved.cards, notFound: resolved.notFound };
}

function commanderIdentity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
  const names = new Set(parsed.commanders.map((entry) => normalize(entry.name)));
  return [...new Set(cards.filter((card) => names.has(normalize(card.name))).flatMap((card) => card.color_identity))].sort();
}

function line(entry: DeckEntry): string {
  const printing = entry.set && entry.collectorNumber ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber}` : '';
  const finish = entry.finish === 'foil' ? ' *F*' : entry.finish === 'etched' ? ' *E*' : entry.finish === 'nonfoil' ? ' *N*' : '';
  return `${entry.quantity} ${entry.name}${printing}${finish}`;
}

function renderSwap(parsed: ParsedDeck, outName: string, incoming: ScryfallCard): string {
  let replaced = false;
  const main = parsed.main.map((entry) => {
    if (!replaced && entry.quantity === 1 && normalize(entry.name) === normalize(outName)) {
      replaced = true;
      return `1 ${incoming.name} (${incoming.set.toUpperCase()}) ${incoming.collector_number}`;
    }
    return line(entry);
  });
  assert.equal(replaced, true, `cut ${outName} must exist`);
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}

function replaceResolvedCard(cards: ScryfallCard[], outName: string, incoming: ScryfallCard): ScryfallCard[] {
  const next = [...cards];
  const index = next.findIndex((card) => normalize(card.name) === normalize(outName));
  assert.ok(index >= 0, `resolved cut ${outName} must exist`);
  next.splice(index, 1, incoming);
  return next;
}

function roles(card: ScryfallCard): Set<string> { return new Set(inferCardRoles(card)); }

function criticalRoleGuard(outgoing: ScryfallCard, incoming: ScryfallCard): { passed: boolean; reasons: string[] } {
  const outRoles = roles(outgoing);
  const inRoles = roles(incoming);
  const reasons: string[] = [];
  for (const role of CRITICAL_EXACT_ROLES) {
    if (outRoles.has(role) && !inRoles.has(role)) reasons.push(`incoming-does-not-replace-${role.replaceAll(' ', '-')}`);
  }
  if (outRoles.has('early acceleration') && !(inRoles.has('early acceleration') || inRoles.has('fast mana'))) {
    reasons.push('incoming-does-not-replace-one-mana-acceleration');
  }
  // Free interaction is already an exact critical role. Preserve premium protection bodies/equipment
  // through the ordinary protection metric/simulation rather than making every protective card immutable.
  return { passed: reasons.length === 0, reasons };
}

function constructionFloor(metrics: ReturnType<typeof buildDeckMetrics>, commanderColors: number): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  if (metrics.averageNonlandManaValue > BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15) failures.push('average-nonland-mv');
  if (metrics.earlyPlayCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays) failures.push('early-plays');
  if (metrics.cheapInteractionCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction) failures.push('cheap-interaction');
  if (metrics.fastManaCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana) failures.push('fast-mana');
  if (Number(metrics.roleCounts['free interaction'] ?? 0) < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction) failures.push('free-interaction');
  if (metrics.tutorCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.tutors) failures.push('tutors');
  if (metrics.persistentColoredManaSourceCount < minimumPersistentColoredManaSourcesV15(commanderColors)) failures.push('persistent-colored-mana');
  return { passed: failures.length === 0, failures };
}

function quality(card: ScryfallCard, strategyContext: ReturnType<typeof deriveUpgradeStrategyContextV15>): number {
  const r = roles(card);
  const affinity = cardCommanderStrategyAffinityV15(card, strategyContext).score;
  let score = affinity * 4 - card.cmc * 1.7;
  if (r.has('combo protection')) score += 30;
  if (r.has('free interaction')) score += 28;
  if (r.has('mana multiplier')) score += 24;
  if (r.has('early acceleration')) score += 22;
  else if (r.has('fast mana')) score += 18;
  if (r.has('tutor')) score += 18;
  if (r.has('countermagic')) score += card.cmc <= 2 ? 14 : 8;
  if (r.has('spot interaction')) score += card.cmc <= 2 ? 13 : 7;
  if (r.has('protection') || r.has('board protection')) score += card.cmc <= 2 ? 12 : 8;
  if (r.has('free-cast engine')) score += 14;
  if (r.has('combat value engine')) score += 10;
  if (r.has('repeatable draw')) score += 9;
  if (r.has('card draw') || r.has('card selection')) score += 5;
  if (r.has('+1/+1 counters')) score += 8;
  if (r.has('mana acceleration') || r.has('mana dork') || r.has('cost reduction')) score += 7;
  if (card.game_changer === true) score += 10;
  return Number(score.toFixed(3));
}

function simulate(parsed: ParsedDeck, cards: ScryfallCard[], seed: number, iterations: number): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, {
    iterations,
    advancedIterations: iterations,
    turns: 7,
    seed,
    pressure: 'cedh',
    comboPieces: COMBOS,
  });
}

function simulationSignals(result: Record<string, unknown>): Record<string, number> {
  const baseline = record(result.baseline);
  const opening = record(baseline.openingHands);
  const tutors = record(baseline.tutors);
  const advanced = record(result.advanced);
  const commander = record(advanced.commanderPressure);
  const interaction = record(advanced.interactionPressure);
  const flow = record(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(record) : [];
  const ready = combos.map((combo) => n(record(combo.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  const seen = combos.map((combo) => n(record(combo.allNamedPiecesSeenByTurn).turn7));
  return {
    functionalKeepRate: n(opening.functionalKeepRate),
    commanderUptimePercent: n(commander.battlefieldUptimePercent),
    protectionWinRate: n(interaction.protectionWinRateWhenChallenged),
    averageSpellsCast: n(flow.averageSpellsCast),
    averageCardsDrawn: n(flow.averageCardsDrawnByEffects),
    tutorHitRate: n(tutors.hitRateByTurn7 ?? tutors.hitRate ?? 0),
    bestComboReadyTurn7: ready.length ? Math.max(...ready) : 0,
    bestComboSeenTurn7: seen.length ? Math.max(...seen) : 0,
  };
}

function delta(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(before).map((key) => [key, Number(((after[key] ?? 0) - (before[key] ?? 0)).toFixed(3))]));
}

function frontierScore(beforeMetrics: ReturnType<typeof buildDeckMetrics>, afterMetrics: ReturnType<typeof buildDeckMetrics>, d: Record<string, number>): number {
  let score = 0;
  score += n(d.functionalKeepRate) * 0.45;
  score += n(d.commanderUptimePercent) * 0.18;
  score += n(d.protectionWinRate) * 0.2;
  score += n(d.averageSpellsCast) * 4.2;
  score += n(d.averageCardsDrawn) * 2.1;
  score += n(d.tutorHitRate) * 0.15;
  score += n(d.bestComboReadyTurn7) * 0.6;
  score += n(d.bestComboSeenTurn7) * 0.35;
  score += (afterMetrics.cheapInteractionCount - beforeMetrics.cheapInteractionCount) * 0.6;
  score += (afterMetrics.tutorCount - beforeMetrics.tutorCount) * 0.9;
  score += (afterMetrics.protectionCount - beforeMetrics.protectionCount) * 0.5;
  score += (afterMetrics.fastManaCount - beforeMetrics.fastManaCount) * 0.75;
  score += (Number(afterMetrics.roleCounts['combo protection'] ?? 0) - Number(beforeMetrics.roleCounts['combo protection'] ?? 0)) * 0.9;
  score += (Number(afterMetrics.roleCounts['mana multiplier'] ?? 0) - Number(beforeMetrics.roleCounts['mana multiplier'] ?? 0)) * 0.8;
  score += (beforeMetrics.averageNonlandManaValue - afterMetrics.averageNonlandManaValue) * 0.8;
  return Number(score.toFixed(3));
}

function regression(d: Record<string, number>): boolean {
  return n(d.functionalKeepRate) <= -4
    || n(d.commanderUptimePercent) <= -6
    || n(d.averageSpellsCast) <= -0.35
    || n(d.bestComboReadyTurn7) <= -4
    || n(d.protectionWinRate) <= -10;
}

async function hardValidate(decklist: string, policy: Awaited<ReturnType<typeof resolvePrintingPolicyV08>>) {
  const resolved = await resolveDeck(decklist);
  const rules = validateCommanderDeck(resolved.parsed, resolved.cards);
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy)).map((card) => card.name);
  const names = new Set([...resolved.parsed.commanders, ...resolved.parsed.main].map((entry) => normalize(entry.name)));
  const missingCombos = [...COMBO_CARDS].filter((name) => !names.has(name));
  const metrics = buildDeckMetrics(resolved.parsed, resolved.cards);
  const colors = commanderIdentity(resolved.parsed, resolved.cards).length;
  const floor = constructionFloor(metrics, colors);
  return {
    cardCount: resolved.parsed.totalCards,
    unresolved: resolved.notFound,
    commanderLegal: rules.isLegal,
    offPolicy,
    missingCombos,
    constructionFloor: floor,
    passed: resolved.parsed.totalCards === 100 && resolved.notFound.length === 0 && rules.isLegal && offPolicy.length === 0 && missingCombos.length === 0 && floor.passed,
  };
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A5 SEMANTIC FRONTIER');
  console.log('A4 false-green repair: preserve strategic functions the current simulator does not model faithfully.');

  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2Deck = extractA2Deck(source);
  const baseline = await resolveDeck(a2Deck);
  assert.equal(baseline.notFound.length, 0);
  assert.equal(validateCommanderDeck(baseline.parsed, baseline.cards).isLegal, true);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  assert.equal(baseline.cards.every((card) => printingMatchesPolicyV08(card, policy)), true);

  const identity = commanderIdentity(baseline.parsed, baseline.cards);
  const strategyContext = deriveUpgradeStrategyContextV15(baseline.parsed, baseline.cards);
  const pool = await discoverEligiblePoolV15(identity, policy, undefined);
  const currentNames = new Set([...baseline.parsed.commanders, ...baseline.parsed.main].map((entry) => normalize(entry.name)));

  const candidatePool = pool
    .filter((card) => !card.type_line.toLocaleLowerCase().includes('land'))
    .filter((card) => !currentNames.has(normalize(card.name)))
    .filter((card) => card.cmc <= 4 || roles(card).has('free interaction'))
    .map((card) => ({ card, quality: quality(card, strategyContext) }))
    .sort((a, b) => b.quality - a.quality || a.card.cmc - b.card.cmc || a.card.name.localeCompare(b.card.name))
    .slice(0, 35);

  const currentNonlands = baseline.parsed.main
    .map((entry) => ({ entry, card: baseline.cards.find((card) => normalize(card.name) === normalize(entry.name)) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card) && !item.card.type_line.toLocaleLowerCase().includes('land'))
    .filter((item) => !COMBO_CARDS.has(normalize(item.entry.name)))
    .map((item) => ({ ...item, quality: quality(item.card, strategyContext) }))
    .sort((a, b) => a.quality - b.quality || b.card.cmc - a.card.cmc || a.card.name.localeCompare(b.card.name))
    .slice(0, 55);

  const beforeMetrics = buildDeckMetrics(baseline.parsed, baseline.cards);
  const baselineFloor = constructionFloor(beforeMetrics, identity.length);
  assert.equal(baselineFloor.passed, true, `A2 must start above all B5 construction floors: ${baselineFloor.failures.join(', ')}`);
  const beforeSignals = simulationSignals(simulate(baseline.parsed, baseline.cards, PRIMARY_SEED, 200));

  console.log(`FF pool=${pool.length}; candidates=${candidatePool.length}; cuts challenged=${currentNonlands.length}.`);
  console.log(`Critical baseline roles: combo-protection=${String(beforeMetrics.roleCounts['combo protection'] ?? 0)}, mana-multiplier=${String(beforeMetrics.roleCounts['mana multiplier'] ?? 0)}, free-interaction=${String(beforeMetrics.roleCounts['free interaction'] ?? 0)}, free-cast-engine=${String(beforeMetrics.roleCounts['free-cast engine'] ?? 0)}.`);

  const guardRejects = new Map<string, number>();
  const firstPass: Array<Record<string, unknown>> = [];
  for (const candidate of candidatePool) {
    for (const cut of currentNonlands) {
      const guard = criticalRoleGuard(cut.card, candidate.card);
      if (!guard.passed) {
        for (const reason of guard.reasons) guardRejects.set(reason, (guardRejects.get(reason) ?? 0) + 1);
        continue;
      }
      const decklist = renderSwap(baseline.parsed, cut.entry.name, candidate.card);
      const parsed = parseDecklist(decklist);
      const cards = replaceResolvedCard(baseline.cards, cut.entry.name, candidate.card);
      const rules = validateCommanderDeck(parsed, cards);
      if (!rules.isLegal || parsed.totalCards !== 100 || !cards.every((card) => printingMatchesPolicyV08(card, policy))) continue;
      const retention = auditUpgradeDeckStrategyRetentionV15(baseline.parsed, baseline.cards, parsed, cards);
      if (!retention.preserved) continue;
      const afterMetrics = buildDeckMetrics(parsed, cards);
      const floor = constructionFloor(afterMetrics, identity.length);
      if (!floor.passed) continue;
      const afterSignals = simulationSignals(simulate(parsed, cards, PRIMARY_SEED, 200));
      const d = delta(beforeSignals, afterSignals);
      if (regression(d)) continue;
      firstPass.push({
        out: cut.entry.name,
        in: candidate.card.name,
        incomingPrinting: { set: candidate.card.set.toUpperCase(), collectorNumber: candidate.card.collector_number },
        outgoingRoles: [...roles(cut.card)].sort(),
        incomingRoles: [...roles(candidate.card)].sort(),
        outgoingQuality: cut.quality,
        incomingQuality: candidate.quality,
        score: frontierScore(beforeMetrics, afterMetrics, d),
        delta: d,
        metricDelta: {
          averageNonlandManaValue: Number((afterMetrics.averageNonlandManaValue - beforeMetrics.averageNonlandManaValue).toFixed(3)),
          earlyPlayCount: afterMetrics.earlyPlayCount - beforeMetrics.earlyPlayCount,
          cheapInteractionCount: afterMetrics.cheapInteractionCount - beforeMetrics.cheapInteractionCount,
          fastManaCount: afterMetrics.fastManaCount - beforeMetrics.fastManaCount,
          freeInteractionCount: Number(afterMetrics.roleCounts['free interaction'] ?? 0) - Number(beforeMetrics.roleCounts['free interaction'] ?? 0),
          tutorCount: afterMetrics.tutorCount - beforeMetrics.tutorCount,
          protectionCount: afterMetrics.protectionCount - beforeMetrics.protectionCount,
        },
        decklist,
      });
    }
  }
  firstPass.sort((a, b) => n(b.score) - n(a.score));
  const finalists = firstPass.slice(0, 18);
  console.log(`Guard rejects: ${JSON.stringify(Object.fromEntries([...guardRejects.entries()].sort()), null, 2)}`);
  console.log(`First-pass survivors=${firstPass.length}. Top: ${finalists.map((item) => `${String(item.out)} -> ${String(item.in)} (${String(item.score)})`).join(' | ')}`);

  const baselineBySeed = new Map<number, Record<string, number>>();
  for (const seed of VALIDATION_SEEDS) baselineBySeed.set(seed, simulationSignals(simulate(baseline.parsed, baseline.cards, seed, 1500)));
  const validation: Array<Record<string, unknown>> = [];
  for (const finalist of finalists) {
    const decklist = String(finalist.decklist);
    const resolved = await resolveDeck(decklist);
    const afterMetrics = buildDeckMetrics(resolved.parsed, resolved.cards);
    const runs: Array<Record<string, unknown>> = [];
    for (const seed of VALIDATION_SEEDS) {
      const before = baselineBySeed.get(seed)!;
      const after = simulationSignals(simulate(resolved.parsed, resolved.cards, seed, 1500));
      const d = delta(before, after);
      runs.push({ seed, delta: d, score: frontierScore(beforeMetrics, afterMetrics, d), significantRegression: regression(d) });
    }
    const scores = runs.map((run) => n(run.score));
    const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const min = Math.min(...scores);
    const positiveSeeds = scores.filter((value) => value > 0).length;
    const robust = runs.every((run) => run.significantRegression !== true) && positiveSeeds >= 4 && mean > 0.25 && min > -0.15;
    validation.push({
      out: finalist.out,
      in: finalist.in,
      incomingPrinting: finalist.incomingPrinting,
      outgoingRoles: finalist.outgoingRoles,
      incomingRoles: finalist.incomingRoles,
      firstPassScore: finalist.score,
      meanScore: Number(mean.toFixed(3)),
      minScore: Number(min.toFixed(3)),
      positiveSeeds,
      robust,
      runs,
      metricDelta: finalist.metricDelta,
      decklist,
    });
    console.log(`${String(finalist.out)} -> ${String(finalist.in)} mean=${mean.toFixed(3)} min=${min.toFixed(3)} positive=${positiveSeeds}/5 robust=${robust}`);
  }

  validation.sort((a, b) => n(b.meanScore) - n(a.meanScore));
  const robustCandidates = validation.filter((item) => item.robust === true);
  const champion = robustCandidates[0] ?? null;
  const finalDecklist = champion ? String(champion.decklist) : a2Deck;
  const hardValidation = await hardValidate(finalDecklist, policy);
  assert.equal(hardValidation.passed, true, 'A5 selected deck must preserve hard truth, both combo packages, and B5 construction floors');

  const result = {
    schema: 'counter-blitz-a5-semantic-frontier-v1',
    branch: BRANCH,
    semanticSourceHead: 'de5806c60149897a8fcc796fd22cfd78d6e92c60',
    objective: 'Search beyond A2 construction thresholds without allowing the simulator to trade away strategic functions it does not faithfully model.',
    baseline: { metrics: beforeMetrics, signals: beforeSignals, hardValidation: await hardValidate(a2Deck, policy) },
    search: {
      eligiblePoolSize: pool.length,
      candidateCount: candidatePool.length,
      challengedCuts: currentNonlands.length,
      guardRejects: Object.fromEntries([...guardRejects.entries()].sort()),
      firstPassSurvivors: firstPass.length,
      firstPassIterations: 200,
      validationIterationsPerSeed: 1500,
      validationSeeds: VALIDATION_SEEDS,
      candidateRanking: candidatePool.map((item) => ({ name: item.card.name, quality: item.quality, set: item.card.set.toUpperCase(), collectorNumber: item.card.collector_number, roles: [...roles(item.card)].sort() })),
    },
    firstPassTop: firstPass.slice(0, 50).map(({ decklist: _decklist, ...rest }) => rest),
    validation: validation.map(({ decklist: _decklist, ...rest }) => rest),
    robustCandidateCount: robustCandidates.length,
    champion: champion ? { ...champion, hardValidation } : null,
    finalDecklist,
    conclusion: champion
      ? `A5 found a semantically guarded robust candidate: ${String(champion.out)} -> ${String(champion.in)}. Manual strategic audit is still required before acceptance.`
      : 'A5 found no semantically guarded one-for-one FF-only swap robust enough to displace A2.',
    caveat: 'The current simulation is still simplified and does not directly model all mana-multiplier or proactive spell-lock sequencing. Those functions are therefore fail-closed by semantic guards instead of being trusted to scalar simulation.',
    note: 'Exploratory branch only. No stable/current promotion and no PR #29 merge.',
  };
  await writeFile('counter-blitz-a5-frontier-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile('counter-blitz-a5-frontier-deck.txt', `${finalDecklist.trim()}\n`, 'utf8');
  console.log(`A5 CONCLUSION: ${result.conclusion}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('counter-blitz-a5-frontier-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
