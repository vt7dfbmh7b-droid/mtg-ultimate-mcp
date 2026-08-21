import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildSimulationBackedUpgradePlanV07, type UpgradePlanOptionsV07 } from './deck-builder-v07.js';
import { parseDecklist, type ParsedDeck } from './deck.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from './scryfall.js';
import { assessPlanTargetGateImprovementV15 } from './target-gate-improvement-v15.js';

export type RefinementDetailLevelV11 = 'simple' | 'standard' | 'detailed';

export interface IterativeRefinementOptionsV11 extends UpgradePlanOptionsV07 {
  maxTotalUsd?: number;
  maxRounds?: number;
  swapsPerRound?: number;
  minimumImprovementScore?: number;
  preserveAcceptedAdds?: boolean;
  detailLevel?: RefinementDetailLevelV11;
}

interface RoundSummaryV11 {
  round: number;
  accepted: boolean;
  attemptedSwaps: number;
  acceptedSwaps: number;
  estimatedSpendUsd: number;
  unknownPriceCount: number;
  improvementScore: number;
  stopReason?: string;
  swaps: Array<Record<string, unknown>>;
  simulationDelta: Record<string, unknown> | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function namesFromSwaps(swaps: Array<Record<string, unknown>>, key: 'in' | 'out'): string[] {
  return swaps
    .map((swap) => swap[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

export function estimateUpgradeSpendV11(plan: Record<string, unknown>): {
  estimatedSpendUsd: number;
  unknownPriceCount: number;
} {
  const swaps = Array.isArray(plan.swaps) ? plan.swaps.map(asRecord) : [];
  let total = 0;
  let unknown = 0;
  for (const swap of swaps) {
    const printing = asRecord(swap.recommendedPrinting);
    const price = numeric(printing.priceUsd);
    if (price === null) unknown += 1;
    else total += price;
  }
  return {
    estimatedSpendUsd: Number(total.toFixed(2)),
    unknownPriceCount: unknown,
  };
}

function metricDelta(plan: Record<string, unknown>, key: string): number {
  const before = asRecord(plan.beforeMetrics);
  const after = asRecord(plan.afterMetrics);
  const left = numeric(before[key]);
  const right = numeric(after[key]);
  return left === null || right === null ? 0 : right - left;
}

export function refinementImprovementScoreV11(plan: Record<string, unknown>): {
  score: number;
  significantRegression: boolean;
  components: Record<string, number>;
} {
  const simulation = asRecord(plan.simulation);
  const delta = asRecord(simulation.delta);
  const components: Record<string, number> = {};

  const add = (key: string, weight: number): void => {
    const value = numeric(delta[key]);
    if (value === null) return;
    const weighted = value * weight * (value < 0 ? 1.25 : 1);
    components[key] = Number(weighted.toFixed(3));
  };

  add('functionalKeepRate', 1.0);
  add('commanderUptimePercent', 0.75);
  add('protectionWinRate', 0.45);
  add('averageSpellsCast', 6.0);

  // Structural deltas remain deliberately small. The authoritative target-gate component below
  // decides whether a change actually repairs/advances a failed requested construction gate.
  components.interactionStructure = Number((metricDelta(plan, 'interactionCount') * 0.05).toFixed(3));
  components.protectionStructure = Number((metricDelta(plan, 'protectionCount') * 0.05).toFixed(3));
  components.drawStructure = Number((metricDelta(plan, 'drawCount') * 0.03).toFixed(3));
  components.rampStructure = Number((metricDelta(plan, 'rampCount') * 0.03).toFixed(3));
  components.tutorStructure = Number((metricDelta(plan, 'tutorCount') * 0.03).toFixed(3));
  components.earlyPlayStructure = Number((metricDelta(plan, 'earlyPlayCount') * 0.02).toFixed(3));

  const beforeMv = numeric(asRecord(plan.beforeMetrics).averageNonlandManaValue);
  const afterMv = numeric(asRecord(plan.afterMetrics).averageNonlandManaValue);
  if (beforeMv !== null && afterMv !== null) {
    components.manaValueEfficiency = Number(((beforeMv - afterMv) * 0.2).toFixed(3));
  }

  const pressure = asRecord(plan.v15TargetPressure);
  const rawStatus = pressure.winRouteVerificationStatus;
  const beforeWinRouteStatus = rawStatus === 'protected' || rawStatus === 'no-verified-route' || rawStatus === 'verification-unavailable'
    ? rawStatus
    : 'verification-unavailable';
  const pressureTarget = asRecord(pressure.targetPressure);
  const targetBracket = numeric(pressureTarget.targetBracket) ?? 4;
  const targetGate = assessPlanTargetGateImprovementV15({
    targetBracket,
    plan,
    beforeWinRouteStatus,
  });
  components.targetGatePriority = targetGate.score;

  const score = Object.values(components).reduce((sum, value) => sum + value, 0);
  const keepDelta = numeric(delta.functionalKeepRate) ?? 0;
  const commanderDelta = numeric(delta.commanderUptimePercent) ?? 0;
  const spellsDelta = numeric(delta.averageSpellsCast) ?? 0;
  const significantRegression = keepDelta <= -4
    || commanderDelta <= -6
    || spellsDelta <= -0.35
    || targetGate.regressedGates.length > 0;

  return {
    score: Number(score.toFixed(3)),
    significantRegression,
    components,
  };
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
  const commanderNames = new Set(parsed.commanders.map((entry) => entry.name.toLocaleLowerCase()));
  return [...new Set(
    cards
      .filter((card) => commanderNames.has(card.name.toLocaleLowerCase()))
      .flatMap((card) => card.color_identity),
  )].sort();
}

function compactRound(round: RoundSummaryV11): Record<string, unknown> {
  return {
    round: round.round,
    accepted: round.accepted,
    acceptedSwaps: round.acceptedSwaps,
    estimatedSpendUsd: round.estimatedSpendUsd,
    improvementScore: round.improvementScore,
    ...(round.stopReason ? { stopReason: round.stopReason } : {}),
  };
}

function simpleSwap(swap: Record<string, unknown>): Record<string, unknown> {
  const printing = asRecord(swap.recommendedPrinting);
  return {
    out: swap.out ?? null,
    in: swap.in ?? null,
    why: swap.why ?? null,
    recommendedPrinting: Object.keys(printing).length > 0 ? {
      set: printing.set ?? null,
      collectorNumber: printing.collectorNumber ?? null,
      finish: printing.finish ?? null,
      priceUsd: printing.priceUsd ?? null,
    } : null,
  };
}

export async function refineCommanderDeckIterativelyV11(
  decklist: string,
  options: IterativeRefinementOptionsV11 = {},
): Promise<Record<string, unknown>> {
  const maxRounds = Math.max(1, Math.min(5, Math.trunc(options.maxRounds ?? 3)));
  const maxTotalSwaps = Math.max(1, Math.min(30, Math.trunc(options.maxSwaps ?? 12)));
  const swapsPerRound = Math.max(1, Math.min(8, Math.trunc(options.swapsPerRound ?? 4)));
  const minScore = Number.isFinite(options.minimumImprovementScore)
    ? Math.max(-10, Math.min(100, options.minimumImprovementScore ?? 0.1))
    : 0.1;
  const maxTotalUsd = options.maxTotalUsd !== undefined
    ? Math.max(0.01, Math.min(1_000_000, options.maxTotalUsd))
    : undefined;
  const preserveAcceptedAdds = options.preserveAcceptedAdds ?? true;
  const detailLevel = options.detailLevel ?? 'simple';

  const initial = await resolveDeck(decklist);
  if (initial.notFound.length > 0) {
    return {
      status: 'incomplete',
      reason: 'The starting deck has unresolved cards, so iterative refinement was not attempted.',
      unresolvedCards: initial.notFound,
    };
  }
  const initialRules = validateCommanderDeck(initial.parsed, initial.cards);
  if (!initialRules.isLegal) {
    return {
      status: 'illegal-starting-deck',
      reason: 'The starting deck must pass Commander legality before optimization.',
      commanderRules: initialRules,
    };
  }

  let currentDecklist = decklist;
  let currentParsed = initial.parsed;
  let currentCards = initial.cards;
  const identity = commanderIdentity(currentParsed, currentCards);
  const protectedNames = new Set((options.protectedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const excludedNames = new Set((options.excludedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const acceptedSwaps: Array<Record<string, unknown>> = [];
  const rounds: RoundSummaryV11[] = [];
  let totalSpend = 0;
  let stopReason = 'maximum-rounds-reached';

  for (let round = 1; round <= maxRounds; round += 1) {
    const swapsRemaining = maxTotalSwaps - acceptedSwaps.length;
    if (swapsRemaining <= 0) {
      stopReason = 'maximum-swaps-reached';
      break;
    }

    let attemptSize = Math.min(swapsPerRound, swapsRemaining);
    let acceptedPlan: Record<string, unknown> | null = null;
    let acceptedScore = 0;
    let acceptedSpend = { estimatedSpendUsd: 0, unknownPriceCount: 0 };
    let lastReason = 'no-acceptable-package';

    while (attemptSize >= 1) {
      const plan = await buildSimulationBackedUpgradePlanV07(
        currentParsed,
        currentCards,
        identity,
        {
          ...options,
          maxSwaps: attemptSize,
          protectedCards: [...protectedNames],
          excludedCards: [...excludedNames],
          seed: (options.seed ?? 20_260_816) + round - 1,
        },
      );
      const planSwaps = Array.isArray(plan.swaps) ? plan.swaps.map(asRecord) : [];
      if (planSwaps.length === 0) {
        lastReason = 'no-supported-swaps-found';
        attemptSize -= 1;
        continue;
      }

      const spend = estimateUpgradeSpendV11(plan);
      const score = refinementImprovementScoreV11(plan);
      if (maxTotalUsd !== undefined && spend.unknownPriceCount > 0) {
        lastReason = 'budget-cannot-be-verified-because-a-selected-printing-has-no-price';
        attemptSize -= 1;
        continue;
      }
      if (maxTotalUsd !== undefined && totalSpend + spend.estimatedSpendUsd > maxTotalUsd + 0.0001) {
        lastReason = 'package-exceeds-total-budget';
        attemptSize -= 1;
        continue;
      }
      if (score.significantRegression) {
        lastReason = 'package-causes-a-significant-simulated-or-target-gate-regression';
        attemptSize -= 1;
        continue;
      }
      if (score.score < minScore) {
        lastReason = 'improvement-below-threshold';
        attemptSize -= 1;
        continue;
      }

      const nextDecklist = typeof plan.upgradedDecklist === 'string' ? plan.upgradedDecklist : '';
      if (!nextDecklist) {
        lastReason = 'candidate-plan-did-not-return-a-complete-decklist';
        attemptSize -= 1;
        continue;
      }
      const resolved = await resolveDeck(nextDecklist);
      const rules = validateCommanderDeck(resolved.parsed, resolved.cards);
      if (resolved.notFound.length > 0 || !rules.isLegal) {
        lastReason = 'candidate-plan-failed-post-build-resolution-or-legality';
        attemptSize -= 1;
        continue;
      }

      acceptedPlan = plan;
      acceptedScore = score.score;
      acceptedSpend = spend;
      currentDecklist = nextDecklist;
      currentParsed = resolved.parsed;
      currentCards = resolved.cards;
      break;
    }

    if (!acceptedPlan) {
      rounds.push({
        round,
        accepted: false,
        attemptedSwaps: Math.min(swapsPerRound, swapsRemaining),
        acceptedSwaps: 0,
        estimatedSpendUsd: 0,
        unknownPriceCount: 0,
        improvementScore: 0,
        stopReason: lastReason,
        swaps: [],
        simulationDelta: null,
      });
      stopReason = lastReason;
      break;
    }

    const roundSwaps = Array.isArray(acceptedPlan.swaps) ? acceptedPlan.swaps.map(asRecord) : [];
    acceptedSwaps.push(...roundSwaps);
    totalSpend = Number((totalSpend + acceptedSpend.estimatedSpendUsd).toFixed(2));
    for (const name of namesFromSwaps(roundSwaps, 'out')) excludedNames.add(name.toLocaleLowerCase());
    if (preserveAcceptedAdds) {
      for (const name of namesFromSwaps(roundSwaps, 'in')) protectedNames.add(name.toLocaleLowerCase());
    }

    const simulation = asRecord(acceptedPlan.simulation);
    rounds.push({
      round,
      accepted: true,
      attemptedSwaps: Math.min(swapsPerRound, swapsRemaining),
      acceptedSwaps: roundSwaps.length,
      estimatedSpendUsd: acceptedSpend.estimatedSpendUsd,
      unknownPriceCount: acceptedSpend.unknownPriceCount,
      improvementScore: acceptedScore,
      swaps: roundSwaps,
      simulationDelta: Object.keys(asRecord(simulation.delta)).length > 0 ? asRecord(simulation.delta) : null,
    });
  }

  const finalRules = validateCommanderDeck(currentParsed, currentCards);
  const simple = {
    status: acceptedSwaps.length > 0 ? 'refined' : 'no-supported-improvement',
    stopReason,
    roundsAccepted: rounds.filter((round) => round.accepted).length,
    totalSwaps: acceptedSwaps.length,
    estimatedUpgradeSpendUsd: totalSpend,
    maxTotalUsd: maxTotalUsd ?? null,
    swaps: acceptedSwaps.map(simpleSwap),
    finalDecklist: currentDecklist,
    finalCommanderRules: finalRules,
    explanation: acceptedSwaps.length > 0
      ? 'The engine accepted only upgrade packages that stayed legal, respected the active printing/price constraints, fit the total budget when supplied, and cleared the target-gate-aware before/after improvement threshold.'
      : 'No package cleared all legality, budget, target-gate and improvement checks, so the starting list was kept instead of forcing weaker swaps.',
  };

  if (detailLevel === 'simple') return simple;
  const standard = {
    ...simple,
    rounds: rounds.map(compactRound),
    constraints: {
      targetBracket: options.targetBracket ?? 4,
      maxUsdPerCard: options.maxUsdPerCard ?? null,
      maxTotalUsd: maxTotalUsd ?? null,
      maxTotalSwaps,
      swapsPerRound,
      maxRounds,
      minimumImprovementScore: minScore,
      printingFamily: options.printingFamily ?? null,
      allowedSets: options.allowedSets ?? [],
      protectedCards: options.protectedCards ?? [],
      excludedCards: options.excludedCards ?? [],
    },
  };
  if (detailLevel === 'standard') return standard;
  return {
    ...standard,
    detailedRounds: rounds,
    scoringGuidance: 'The refinement score combines authoritative requested target-gate movement with same-seed simulation deltas and smaller structural-role adjustments. It is a within-deck comparison heuristic, not a universal Commander power score or measured win rate.',
  };
}
