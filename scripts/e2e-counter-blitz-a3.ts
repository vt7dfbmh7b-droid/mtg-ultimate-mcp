import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildSimulationBackedUpgradePlanV07 } from '../src/services/deck-builder-v07.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { refinementImprovementScoreV11 } from '../src/services/optimizer-v11.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';

const BRANCH = 'test/counter-blitz-a3-optimization-20260829';
const PROTECTED = ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista', 'The Earth Crystal'];
const BASE_EXCLUDED = ['World Map', 'Magitek Infantry'];
const PRIMARY_SEED = 20260829;
const VALIDATION_SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function extractA2Deck(markdown: string): string {
  const match = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(match?.[1], 'could not extract Version A baseline decklist from prior exploratory report');
  const a = match[1].trim();
  assert.ok(a.includes('1 Archmage Emeritus (FIC) 261'), 'Version A source must still contain Archmage Emeritus');
  assert.ok(!a.includes('1 The Earth Crystal (FIN) 184'), 'Version A source must not already contain The Earth Crystal');
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

function swaps(plan: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(plan.swaps) ? plan.swaps.map(record) : [];
}

function swapSignature(plan: Record<string, unknown>): string {
  return swaps(plan).map((swap) => `${String(swap.out)}->${String(swap.in)}`).join('|');
}

function incoming(plan: Record<string, unknown>): string[] {
  return swaps(plan).map((swap) => swap.in).filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function strategySafe(plan: Record<string, unknown>): boolean {
  const strategy = record(plan.strategyPreservation);
  const status = typeof strategy.status === 'string' ? strategy.status : '';
  const losses = Array.isArray(strategy.meaningfulLosses) ? strategy.meaningfulLosses : [];
  return status !== 'meaningful-strategy-loss' && losses.length === 0;
}

function concisePlan(plan: Record<string, unknown>): Record<string, unknown> {
  const score = refinementImprovementScoreV11(plan);
  const simulation = record(plan.simulation);
  return {
    status: plan.status ?? null,
    swaps: swaps(plan),
    signature: swapSignature(plan),
    score,
    strategyPreservation: plan.strategyPreservation ?? null,
    beforeMetrics: plan.beforeMetrics ?? null,
    afterMetrics: plan.afterMetrics ?? null,
    simulation: {
      seed: simulation.seed ?? null,
      delta: simulation.delta ?? null,
    },
  };
}

async function buildCandidate(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  identity: string[],
  excludedCards: string[],
  seed: number,
  iterations: number,
): Promise<Record<string, unknown>> {
  return buildSimulationBackedUpgradePlanV07(parsed, cards, identity, {
    targetBracket: 5,
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    excludedCards,
    protectedCards: PROTECTED,
    winRouteVerificationStatus: 'protected',
    maxSwaps: 5,
    simulationIterations: iterations,
    simulationTurns: 7,
    seed,
  });
}

async function hardValidate(decklist: string): Promise<Record<string, unknown>> {
  const resolved = await resolveDeck(decklist);
  const rules = validateCommanderDeck(resolved.parsed, resolved.cards);
  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy)).map((card) => card.name);
  const names = new Set([...resolved.parsed.commanders, ...resolved.parsed.main].map((entry) => entry.name.toLocaleLowerCase()));
  const protectedMissing = PROTECTED.filter((name) => !names.has(name.toLocaleLowerCase()));
  return {
    cardCount: resolved.parsed.totalCards,
    unresolved: resolved.notFound,
    commanderLegal: rules.isLegal,
    offPolicy,
    protectedMissing,
    passed: resolved.parsed.totalCards === 100
      && resolved.notFound.length === 0
      && rules.isLegal
      && offPolicy.length === 0
      && protectedMissing.length === 0,
  };
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A3 OPTIMIZATION GAUNTLET');
  console.log('Goal: challenge A2 with diversified FF-only packages and require multi-seed simulation stability.');

  const report = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2Deck = extractA2Deck(report);
  const baseline = await resolveDeck(a2Deck);
  assert.equal(baseline.notFound.length, 0, 'A2 baseline must fully resolve');
  assert.equal(baseline.parsed.totalCards, 100, 'A2 baseline must contain exactly 100 cards');
  assert.equal(validateCommanderDeck(baseline.parsed, baseline.cards).isLegal, true, 'A2 baseline must be Commander legal');
  const identity = commanderIdentity(baseline.parsed, baseline.cards);

  const variants: Array<Record<string, unknown>> = [];
  const blocked = new Set<string>();
  for (let index = 0; index < 6; index += 1) {
    const excludedCards = [...BASE_EXCLUDED, ...blocked];
    console.log(`A3 candidate ${index + 1}/6 with ${blocked.size} diversified exclusions...`);
    const plan = await buildCandidate(baseline.parsed, baseline.cards, identity, excludedCards, PRIMARY_SEED, 1000);
    const summary = concisePlan(plan);
    const score = refinementImprovementScoreV11(plan);
    const candidate = {
      index: index + 1,
      excludedCards,
      eligibleAtPrimarySeed: plan.status === 'simulated-candidate-plan'
        && swaps(plan).length > 0
        && strategySafe(plan)
        && !score.significantRegression
        && score.score > 0,
      ...summary,
      upgradedDecklist: typeof plan.upgradedDecklist === 'string' ? plan.upgradedDecklist : null,
    };
    variants.push(candidate);
    console.log(JSON.stringify(candidate, null, 2));

    const adds = incoming(plan);
    if (adds.length === 0) break;
    const diversifyCount = Math.max(1, Math.ceil(adds.length / 2));
    for (const name of adds.slice(0, diversifyCount)) blocked.add(name);
  }

  const primaryEligible = variants
    .filter((candidate) => candidate.eligibleAtPrimarySeed === true && typeof candidate.upgradedDecklist === 'string')
    .sort((left, right) => {
      const leftScore = Number(record(left.score).score ?? 0);
      const rightScore = Number(record(right.score).score ?? 0);
      return rightScore - leftScore;
    })
    .slice(0, 3);

  const validation: Array<Record<string, unknown>> = [];
  for (const candidate of primaryEligible) {
    const excludedCards = Array.isArray(candidate.excludedCards) ? candidate.excludedCards.map(String) : [...BASE_EXCLUDED];
    const expectedSignature = String(candidate.signature ?? '');
    const seedRuns: Array<Record<string, unknown>> = [];
    console.log(`\nValidating candidate ${String(candidate.index)} across ${VALIDATION_SEEDS.length} seeds: ${expectedSignature}`);
    for (const seed of VALIDATION_SEEDS) {
      const plan = await buildCandidate(baseline.parsed, baseline.cards, identity, excludedCards, seed, 1500);
      const score = refinementImprovementScoreV11(plan);
      const signature = swapSignature(plan);
      seedRuns.push({
        seed,
        signature,
        samePackage: signature === expectedSignature,
        score,
        simulationDelta: record(plan.simulation).delta ?? null,
        strategySafe: strategySafe(plan),
      });
      console.log(`seed ${seed}: score=${score.score} regression=${score.significantRegression} package=${signature}`);
    }
    const scores = seedRuns.map((run) => Number(record(run.score).score ?? 0));
    const meanScore = scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length);
    const minScore = Math.min(...scores);
    const positiveSeeds = scores.filter((score) => score > 0).length;
    const robust = seedRuns.every((run) => run.samePackage === true
      && run.strategySafe === true
      && record(run.score).significantRegression !== true)
      && positiveSeeds >= 4
      && meanScore > 0.1
      && minScore > -0.15;
    validation.push({
      candidateIndex: candidate.index,
      signature: expectedSignature,
      robust,
      meanScore: Number(meanScore.toFixed(3)),
      minScore: Number(minScore.toFixed(3)),
      positiveSeeds,
      seedRuns,
      upgradedDecklist: candidate.upgradedDecklist,
      primaryScore: candidate.score,
    });
  }

  validation.sort((left, right) => Number(right.meanScore ?? -999) - Number(left.meanScore ?? -999));
  const champion = validation.find((candidate) => candidate.robust === true) ?? null;
  const championDeck = champion && typeof champion.upgradedDecklist === 'string' ? champion.upgradedDecklist : a2Deck;
  const hardValidation = await hardValidate(championDeck);
  assert.equal(hardValidation.passed, true, 'A3 selected deck must preserve hard Commander/printing/combo-piece truth');

  const result = {
    schema: 'counter-blitz-a3-optimization-gauntlet-v1',
    branch: BRANCH,
    sourceA2Head: 'f4db6182751e6a70283a8db3aec305d5c5088312',
    objective: 'Find a multi-seed, strategy-safe, FF-printing-only improvement over A2 without relying on Commander Spellbook availability during candidate simulation.',
    baseline: {
      hardValidation: await hardValidate(a2Deck),
      protectedWinCards: PROTECTED,
      decklist: a2Deck,
    },
    variants,
    validation,
    champion: champion ? {
      ...champion,
      hardValidation,
    } : null,
    finalDecklist: championDeck,
    conclusion: champion
      ? 'A3 found at least one multi-seed simulation-stable, strategy-safe candidate package worth manual strategic audit.'
      : 'A3 did not find a candidate package strong enough to displace A2 under the stated robustness rules.',
    note: 'Exploratory branch evidence only. No stable/current promotion and no PR #29 merge is implied.',
  };

  await writeFile('counter-blitz-a3-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile('counter-blitz-a3-deck.txt', `${championDeck.trim()}\n`, 'utf8');
  console.log(`\nA3 CONCLUSION: ${result.conclusion}`);
  if (champion) console.log(`A3 CHAMPION: ${String(champion.signature)} mean=${String(champion.meanScore)} min=${String(champion.minScore)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('counter-blitz-a3-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
