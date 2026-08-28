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

const BRANCH = 'test/counter-blitz-a4-frontier-20260829';
const PROTECTED = new Set(['gatta and luzzu', 'hardened scales', 'walking ballista', 'the earth crystal']);
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const FIRST_PASS_SEED = 20260829;
const VALIDATION_SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function extractA2Deck(markdown: string): string {
  const match = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(match?.[1], 'could not extract Version A decklist from prior exploratory report');
  const a = match[1].trim();
  return a.replace('1 Archmage Emeritus (FIC) 261', '1 The Earth Crystal (FIN) 184');
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

async function resolveDeck(decklist: string): Promise<{ parsed: ParsedDeck; cards: ScryfallCard[]; notFound: string[] }> {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  return { parsed, cards: resolved.cards, notFound: resolved.notFound };
}

function commanderIdentity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
  const names = new Set(parsed.commanders.map((entry) => entry.name.toLocaleLowerCase()));
  return [...new Set(cards.filter((card) => names.has(card.name.toLocaleLowerCase())).flatMap((card) => card.color_identity))].sort();
}

function line(entry: DeckEntry): string {
  const printing = entry.set && entry.collectorNumber ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber}` : '';
  const finish = entry.finish === 'foil' ? ' *F*' : entry.finish === 'etched' ? ' *E*' : entry.finish === 'nonfoil' ? ' *N*' : '';
  return `${entry.quantity} ${entry.name}${printing}${finish}`;
}

function renderSwap(parsed: ParsedDeck, outName: string, incoming: ScryfallCard): string {
  let replaced = false;
  const main = parsed.main.map((entry) => {
    if (!replaced && entry.quantity === 1 && entry.name.toLocaleLowerCase() === outName.toLocaleLowerCase()) {
      replaced = true;
      return `1 ${incoming.name} (${incoming.set.toUpperCase()}) ${incoming.collector_number}`;
    }
    return line(entry);
  });
  assert.equal(replaced, true, `cut ${outName} must exist exactly once in the main deck`);
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}

function replaceResolvedCard(cards: ScryfallCard[], outName: string, incoming: ScryfallCard): ScryfallCard[] {
  const next = [...cards];
  const index = next.findIndex((card) => card.name.toLocaleLowerCase() === outName.toLocaleLowerCase());
  assert.ok(index >= 0, `resolved cut ${outName} must exist`);
  next.splice(index, 1, incoming);
  return next;
}

function roleQuality(card: ScryfallCard, strategyContext: ReturnType<typeof deriveUpgradeStrategyContextV15>): number {
  const roles = new Set(inferCardRoles(card));
  const affinity = cardCommanderStrategyAffinityV15(card, strategyContext).score;
  let score = affinity * 4 - card.cmc * 2;
  if (roles.has('free interaction')) score += 22;
  if (roles.has('tutor')) score += 18;
  if (roles.has('fast mana')) score += 16;
  if (roles.has('countermagic')) score += card.cmc <= 2 ? 12 : 7;
  if (roles.has('spot interaction')) score += card.cmc <= 2 ? 11 : 6;
  if (roles.has('protection') || roles.has('board protection')) score += card.cmc <= 2 ? 10 : 6;
  if (roles.has('repeatable draw')) score += 8;
  if (roles.has('card draw') || roles.has('card selection')) score += 5;
  if (roles.has('mana acceleration') || roles.has('mana dork') || roles.has('cost reduction')) score += 7;
  if (roles.has('+1/+1 counters')) score += 8;
  if (roles.has('equipment')) score += 2;
  if (card.game_changer === true) score += 10;
  return Number(score.toFixed(3));
}

function simulationSignals(result: Record<string, unknown>): Record<string, number> {
  const baseline = record(result.baseline);
  const opening = record(baseline.openingHands);
  const advanced = record(result.advanced);
  const commander = record(advanced.commanderPressure);
  const interaction = record(advanced.interactionPressure);
  const flow = record(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(record) : [];
  const comboReady = combos.map((combo) => number(record(combo.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  const comboSeen = combos.map((combo) => number(record(combo.allNamedPiecesSeenByTurn).turn7));
  return {
    functionalKeepRate: number(opening.functionalKeepRate),
    commanderUptimePercent: number(commander.battlefieldUptimePercent),
    protectionWinRate: number(interaction.protectionWinRateWhenChallenged),
    averageSpellsCast: number(flow.averageSpellsCast),
    averageCardsDrawn: number(flow.averageCardsDrawnByEffects),
    bestComboReadyTurn7: comboReady.length > 0 ? Math.max(...comboReady) : 0,
    bestComboSeenTurn7: comboSeen.length > 0 ? Math.max(...comboSeen) : 0,
  };
}

function signalDelta(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(before).map((key) => [key, Number(((after[key] ?? 0) - (before[key] ?? 0)).toFixed(3))]));
}

function frontierScore(
  beforeMetrics: ReturnType<typeof buildDeckMetrics>,
  afterMetrics: ReturnType<typeof buildDeckMetrics>,
  delta: Record<string, number>,
): number {
  let score = 0;
  score += (delta.functionalKeepRate ?? 0) * 0.45;
  score += (delta.commanderUptimePercent ?? 0) * 0.2;
  score += (delta.protectionWinRate ?? 0) * 0.2;
  score += (delta.averageSpellsCast ?? 0) * 4.5;
  score += (delta.averageCardsDrawn ?? 0) * 2.0;
  score += (delta.bestComboReadyTurn7 ?? 0) * 0.55;
  score += (delta.bestComboSeenTurn7 ?? 0) * 0.3;
  score += (afterMetrics.cheapInteractionCount - beforeMetrics.cheapInteractionCount) * 0.6;
  score += (afterMetrics.tutorCount - beforeMetrics.tutorCount) * 0.8;
  score += (afterMetrics.protectionCount - beforeMetrics.protectionCount) * 0.45;
  score += (afterMetrics.fastManaCount - beforeMetrics.fastManaCount) * 0.6;
  score += (beforeMetrics.averageNonlandManaValue - afterMetrics.averageNonlandManaValue) * 0.8;
  return Number(score.toFixed(3));
}

function significantRegression(delta: Record<string, number>): boolean {
  return (delta.functionalKeepRate ?? 0) <= -4
    || (delta.commanderUptimePercent ?? 0) <= -6
    || (delta.averageSpellsCast ?? 0) <= -0.35
    || (delta.bestComboReadyTurn7 ?? 0) <= -4;
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

async function hardValidate(decklist: string): Promise<Record<string, unknown>> {
  const resolved = await resolveDeck(decklist);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const rules = validateCommanderDeck(resolved.parsed, resolved.cards);
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy)).map((card) => card.name);
  const names = new Set([...resolved.parsed.commanders, ...resolved.parsed.main].map((entry) => entry.name.toLocaleLowerCase()));
  const missingProtected = [...PROTECTED].filter((name) => !names.has(name));
  return {
    cardCount: resolved.parsed.totalCards,
    unresolved: resolved.notFound,
    commanderLegal: rules.isLegal,
    offPolicy,
    missingProtected,
    passed: resolved.parsed.totalCards === 100 && resolved.notFound.length === 0 && rules.isLegal && offPolicy.length === 0 && missingProtected.length === 0,
  };
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A4 FRONTIER OPTIMIZER');
  console.log('Purpose: optimize beyond already-passing construction thresholds via legal one-for-one counterfactual testing.');

  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2Deck = extractA2Deck(source);
  const baseline = await resolveDeck(a2Deck);
  assert.equal(baseline.notFound.length, 0);
  assert.equal(baseline.parsed.totalCards, 100);
  assert.equal(validateCommanderDeck(baseline.parsed, baseline.cards).isLegal, true);

  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  assert.equal(baseline.cards.every((card) => printingMatchesPolicyV08(card, policy)), true);
  const identity = commanderIdentity(baseline.parsed, baseline.cards);
  const pool = await discoverEligiblePoolV15(identity, policy, undefined);
  const strategyContext = deriveUpgradeStrategyContextV15(baseline.parsed, baseline.cards);
  const currentNames = new Set([...baseline.parsed.commanders, ...baseline.parsed.main].map((entry) => entry.name.toLocaleLowerCase()));

  const candidatePool = pool
    .filter((card) => !card.type_line.toLocaleLowerCase().includes('land'))
    .filter((card) => !currentNames.has(card.name.toLocaleLowerCase()))
    .filter((card) => card.cmc <= 4 || new Set(inferCardRoles(card)).has('free interaction'))
    .map((card) => ({ card, quality: roleQuality(card, strategyContext) }))
    .sort((a, b) => b.quality - a.quality || a.card.cmc - b.card.cmc || a.card.name.localeCompare(b.card.name))
    .slice(0, 25);

  const currentNonlands = baseline.parsed.main
    .map((entry) => ({ entry, card: baseline.cards.find((card) => card.name.toLocaleLowerCase() === entry.name.toLocaleLowerCase()) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card) && !item.card.type_line.toLocaleLowerCase().includes('land'))
    .filter((item) => !PROTECTED.has(item.entry.name.toLocaleLowerCase()))
    .map((item) => ({ ...item, quality: roleQuality(item.card, strategyContext) }))
    .sort((a, b) => a.quality - b.quality || b.card.cmc - a.card.cmc || a.card.name.localeCompare(b.card.name))
    .slice(0, 50);

  console.log(`Eligible FF pool: ${pool.length}; frontier candidates: ${candidatePool.length}; challenged cuts: ${currentNonlands.length}.`);
  console.log(`Top candidates: ${candidatePool.map((item) => `${item.card.name}[${item.quality}]`).join(', ')}`);
  console.log(`Lowest current challenge slots: ${currentNonlands.slice(0, 20).map((item) => `${item.card.name}[${item.quality}]`).join(', ')}`);

  const beforeMetrics = buildDeckMetrics(baseline.parsed, baseline.cards);
  const beforeSimulation = simulate(baseline.parsed, baseline.cards, FIRST_PASS_SEED, 250);
  const beforeSignals = simulationSignals(beforeSimulation);
  const firstPass: Array<Record<string, unknown>> = [];

  for (const candidate of candidatePool) {
    for (const cut of currentNonlands) {
      const decklist = renderSwap(baseline.parsed, cut.entry.name, candidate.card);
      const parsed = parseDecklist(decklist);
      const cards = replaceResolvedCard(baseline.cards, cut.entry.name, candidate.card);
      const rules = validateCommanderDeck(parsed, cards);
      if (!rules.isLegal || parsed.totalCards !== 100 || !cards.every((card) => printingMatchesPolicyV08(card, policy))) continue;
      const retention = auditUpgradeDeckStrategyRetentionV15(baseline.parsed, baseline.cards, parsed, cards);
      if (!retention.preserved) continue;
      const afterMetrics = buildDeckMetrics(parsed, cards);
      const afterSignals = simulationSignals(simulate(parsed, cards, FIRST_PASS_SEED, 250));
      const delta = signalDelta(beforeSignals, afterSignals);
      const score = frontierScore(beforeMetrics, afterMetrics, delta);
      if (significantRegression(delta)) continue;
      firstPass.push({
        out: cut.entry.name,
        in: candidate.card.name,
        incomingPrinting: { set: candidate.card.set.toUpperCase(), collectorNumber: candidate.card.collector_number },
        incomingQuality: candidate.quality,
        outgoingQuality: cut.quality,
        score,
        delta,
        metricDelta: {
          averageNonlandManaValue: Number((afterMetrics.averageNonlandManaValue - beforeMetrics.averageNonlandManaValue).toFixed(3)),
          cheapInteractionCount: afterMetrics.cheapInteractionCount - beforeMetrics.cheapInteractionCount,
          protectionCount: afterMetrics.protectionCount - beforeMetrics.protectionCount,
          tutorCount: afterMetrics.tutorCount - beforeMetrics.tutorCount,
          fastManaCount: afterMetrics.fastManaCount - beforeMetrics.fastManaCount,
          earlyPlayCount: afterMetrics.earlyPlayCount - beforeMetrics.earlyPlayCount,
        },
        retention,
        decklist,
      });
    }
  }

  firstPass.sort((a, b) => number(b.score) - number(a.score));
  const finalists = firstPass.slice(0, 15);
  console.log(`First-pass legal strategy-preserving counterfactuals: ${firstPass.length}.`);
  console.log(`Top 15: ${finalists.map((item) => `${String(item.out)} -> ${String(item.in)} score=${String(item.score)}`).join(' | ')}`);

  const baselineBySeed = new Map<number, Record<string, number>>();
  for (const seed of VALIDATION_SEEDS) baselineBySeed.set(seed, simulationSignals(simulate(baseline.parsed, baseline.cards, seed, 1500)));

  const validation: Array<Record<string, unknown>> = [];
  for (const finalist of finalists) {
    const decklist = String(finalist.decklist);
    const resolved = await resolveDeck(decklist);
    assert.equal(resolved.notFound.length, 0);
    const afterMetrics = buildDeckMetrics(resolved.parsed, resolved.cards);
    const runs: Array<Record<string, unknown>> = [];
    for (const seed of VALIDATION_SEEDS) {
      const before = baselineBySeed.get(seed)!;
      const after = simulationSignals(simulate(resolved.parsed, resolved.cards, seed, 1500));
      const delta = signalDelta(before, after);
      runs.push({ seed, delta, score: frontierScore(beforeMetrics, afterMetrics, delta), significantRegression: significantRegression(delta) });
    }
    const scores = runs.map((run) => number(run.score));
    const mean = scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length);
    const min = Math.min(...scores);
    const positiveSeeds = scores.filter((value) => value > 0).length;
    const robust = runs.every((run) => run.significantRegression !== true) && positiveSeeds >= 4 && mean > 0.2 && min > -0.2;
    validation.push({
      out: finalist.out,
      in: finalist.in,
      incomingPrinting: finalist.incomingPrinting,
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

  validation.sort((a, b) => number(b.meanScore) - number(a.meanScore));
  const champion = validation.find((item) => item.robust === true) ?? null;
  const finalDecklist = champion ? String(champion.decklist) : a2Deck;
  const hardValidation = await hardValidate(finalDecklist);
  assert.equal(hardValidation.passed, true, 'A4 champion must preserve exact hard truth and both win packages');

  const result = {
    schema: 'counter-blitz-a4-frontier-v1',
    branch: BRANCH,
    sourceA2Head: 'f4db6182751e6a70283a8db3aec305d5c5088312',
    frontierMethod: {
      eligiblePoolSize: pool.length,
      candidateCount: candidatePool.length,
      challengedCutCount: currentNonlands.length,
      firstPassIterationsPerDeck: 250,
      finalistValidationIterationsPerSeed: 1500,
      validationSeeds: VALIDATION_SEEDS,
      pressure: 'cedh',
      protectedWinPackages: COMBOS,
      candidateRanking: candidatePool.map((item) => ({ name: item.card.name, quality: item.quality, set: item.card.set.toUpperCase(), collectorNumber: item.card.collector_number })),
      challengedCuts: currentNonlands.map((item) => ({ name: item.card.name, quality: item.quality })),
    },
    baseline: { metrics: beforeMetrics, signals: beforeSignals, hardValidation: await hardValidate(a2Deck) },
    firstPassTop: firstPass.slice(0, 40).map(({ decklist: _decklist, retention: _retention, ...rest }) => rest),
    validation: validation.map(({ decklist: _decklist, ...rest }) => rest),
    champion: champion ? { ...champion, hardValidation } : null,
    finalDecklist,
    conclusion: champion
      ? `A4 found a robust frontier improvement: ${String(champion.out)} -> ${String(champion.in)}.`
      : 'A4 found no one-for-one FF-only frontier swap robust enough to displace A2 under the current cEDH-pressure rules.',
    caveat: 'This is an experimental counterfactual frontier score, not a production truth metric. A champion still requires manual strategic audit before being treated as the new best deck.',
    note: 'Isolated exploratory branch only. No stable/current promotion and no PR #29 merge.',
  };

  await writeFile('counter-blitz-a4-frontier-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile('counter-blitz-a4-frontier-deck.txt', `${finalDecklist.trim()}\n`, 'utf8');
  console.log(`A4 CONCLUSION: ${result.conclusion}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('counter-blitz-a4-frontier-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
