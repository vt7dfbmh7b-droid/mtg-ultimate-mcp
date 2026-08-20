import type { ScryfallCard } from '../types/scryfall.js';
import { evaluateCommanderBuildV15 } from './commander-build-evaluation-v15.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildSimulationBackedUpgradePlanV07, type UpgradePlanOptionsV07 } from './deck-builder-v07.js';
import { parseDecklist, type ParsedDeck } from './deck.js';
import {
  estimateUpgradeSpendV11,
  refinementImprovementScoreV11,
  type RefinementDetailLevelV11,
} from './optimizer-v11.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from './scryfall.js';

export interface IterativeRefinementOptionsV12 extends UpgradePlanOptionsV07 {
  maxTotalUsd?: number;
  maxRounds?: number;
  swapsPerRound?: number;
  minimumImprovementScore?: number;
  preserveAcceptedAdds?: boolean;
  candidatePackagesPerRound?: number;
  detailLevel?: RefinementDetailLevelV11;
}

export interface WinRouteProtectionV15 {
  status: 'protected' | 'no-verified-route' | 'verification-unavailable';
  protectedComboIds: string[];
  protectedCardNames: string[];
  source: 'existing-v15-final-win-route-audit';
}

interface CandidateEvaluationV12 {
  candidate: number;
  eligible: boolean;
  reason: string;
  attemptedSwaps: number;
  actualSwaps: number;
  estimatedSpendUsd: number;
  unknownPriceCount: number;
  improvementScore: number;
  significantRegression: boolean;
  plan: Record<string, unknown> | null;
  nextDecklist: string | null;
  resolved: Awaited<ReturnType<typeof resolveDeck>> | null;
}

interface RoundSummaryV12 {
  round: number;
  accepted: boolean;
  attemptedSwaps: number;
  acceptedSwaps: number;
  candidatePackagesGenerated: number;
  candidatePackagesEligible: number;
  winningCandidate: number | null;
  estimatedSpendUsd: number;
  improvementScore: number;
  winRouteProtection: WinRouteProtectionV15;
  stopReason?: string;
  swaps: Array<Record<string, unknown>>;
  candidateComparisons: Array<Record<string, unknown>>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function namesFromSwaps(swaps: Array<Record<string, unknown>>, key: 'in' | 'out'): string[] {
  return swaps
    .map((swap) => swap[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
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

function candidateSummary(candidate: CandidateEvaluationV12): Record<string, unknown> {
  return {
    candidate: candidate.candidate,
    eligible: candidate.eligible,
    reason: candidate.reason,
    attemptedSwaps: candidate.attemptedSwaps,
    actualSwaps: candidate.actualSwaps,
    estimatedSpendUsd: candidate.estimatedSpendUsd,
    unknownPriceCount: candidate.unknownPriceCount,
    improvementScore: candidate.improvementScore,
    significantRegression: candidate.significantRegression,
    swaps: candidate.plan && Array.isArray(candidate.plan.swaps)
      ? candidate.plan.swaps.map(asRecord).map(simpleSwap)
      : [],
  };
}

function chooseWinner(candidates: CandidateEvaluationV12[]): CandidateEvaluationV12 | null {
  return candidates
    .filter((candidate) => candidate.eligible && candidate.plan && candidate.nextDecklist && candidate.resolved)
    .sort((a, b) =>
      b.improvementScore - a.improvementScore
      || a.estimatedSpendUsd - b.estimatedSpendUsd
      || b.actualSwaps - a.actualSwaps
      || a.candidate - b.candidate,
    )[0] ?? null;
}

function diversifyNextPackage(blocked: Set<string>, plan: Record<string, unknown>): void {
  const swaps = Array.isArray(plan.swaps) ? plan.swaps.map(asRecord) : [];
  const incoming = namesFromSwaps(swaps, 'in');
  if (incoming.length === 0) return;
  // Block roughly half of the prior package's additions so the next package must explore a materially different path.
  const count = Math.max(1, Math.ceil(incoming.length / 2));
  for (const name of incoming.slice(0, count)) blocked.add(name.toLocaleLowerCase());
}

function uniqueNames(values: readonly string[]): string[] {
  return [...new Map(values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => [value.toLocaleLowerCase(), value] as const)).values()]
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Convert the existing V0.15 final-route portfolio into cut protection for the existing V0.12
 * optimizer. We protect the portfolio primary + backup rather than every incidental verified combo;
 * a single verified route is protected when the portfolio cannot name a route because dependencies
 * are partially unresolved. Verification unavailable never becomes a false "no routes" claim.
 */
export function deriveWinRouteProtectionV15(input: {
  comboVerificationComplete: boolean;
  primaryComboId: string | null;
  backupComboId: string | null;
  verifiedWinningComboDetails: ReadonlyArray<{
    comboId: string;
    comboCardNames: readonly string[];
  }>;
}): WinRouteProtectionV15 {
  if (!input.comboVerificationComplete) {
    return {
      status: 'verification-unavailable',
      protectedComboIds: [],
      protectedCardNames: [],
      source: 'existing-v15-final-win-route-audit',
    };
  }

  const byId = new Map(input.verifiedWinningComboDetails.map((detail) => [detail.comboId, detail] as const));
  const selectedIds = uniqueNames([
    ...(input.primaryComboId ? [input.primaryComboId] : []),
    ...(input.backupComboId ? [input.backupComboId] : []),
  ]).filter((id) => byId.has(id));
  if (selectedIds.length === 0 && input.verifiedWinningComboDetails.length === 1) {
    selectedIds.push(input.verifiedWinningComboDetails[0]!.comboId);
  }
  if (selectedIds.length === 0) {
    return {
      status: 'no-verified-route',
      protectedComboIds: [],
      protectedCardNames: [],
      source: 'existing-v15-final-win-route-audit',
    };
  }

  const protectedCardNames = uniqueNames(selectedIds.flatMap((id) => byId.get(id)?.comboCardNames ?? []));
  return {
    status: protectedCardNames.length > 0 ? 'protected' : 'no-verified-route',
    protectedComboIds: selectedIds,
    protectedCardNames,
    source: 'existing-v15-final-win-route-audit',
  };
}

async function currentWinRouteProtectionV15(decklist: string): Promise<WinRouteProtectionV15> {
  try {
    const evaluation = await evaluateCommanderBuildV15(decklist);
    return deriveWinRouteProtectionV15({
      comboVerificationComplete: evaluation.finalWinRouteAudit.comboVerificationComplete,
      primaryComboId: evaluation.finalWinRouteAudit.portfolio.primaryComboId,
      backupComboId: evaluation.finalWinRouteAudit.portfolio.backupComboId,
      verifiedWinningComboDetails: evaluation.postBuildEvidence.verifiedWinningComboDetails,
    });
  } catch {
    return {
      status: 'verification-unavailable',
      protectedComboIds: [],
      protectedCardNames: [],
      source: 'existing-v15-final-win-route-audit',
    };
  }
}

async function evaluateCandidate(
  candidateNumber: number,
  currentParsed: ParsedDeck,
  currentCards: ScryfallCard[],
  identity: string[],
  options: IterativeRefinementOptionsV12,
  attemptSize: number,
  totalSpend: number,
  maxTotalUsd: number | undefined,
  protectedNames: Set<string>,
  excludedNames: Set<string>,
  diversityBlocked: Set<string>,
  round: number,
): Promise<CandidateEvaluationV12> {
  const plan = await buildSimulationBackedUpgradePlanV07(
    currentParsed,
    currentCards,
    identity,
    {
      ...options,
      maxSwaps: attemptSize,
      protectedCards: [...protectedNames],
      excludedCards: [...new Set([...excludedNames, ...diversityBlocked])],
      // All candidates in a round use the same seed so their simulation outputs are directly comparable.
      seed: (options.seed ?? 20_260_816) + round - 1,
    },
  );
  const planSwaps = Array.isArray(plan.swaps) ? plan.swaps.map(asRecord) : [];
  const spend = estimateUpgradeSpendV11(plan);
  const score = refinementImprovementScoreV11(plan);

  const base: Omit<CandidateEvaluationV12, 'eligible' | 'reason' | 'nextDecklist' | 'resolved'> = {
    candidate: candidateNumber,
    attemptedSwaps: attemptSize,
    actualSwaps: planSwaps.length,
    estimatedSpendUsd: spend.estimatedSpendUsd,
    unknownPriceCount: spend.unknownPriceCount,
    improvementScore: score.score,
    significantRegression: score.significantRegression,
    plan,
  };

  if (planSwaps.length === 0) return { ...base, eligible: false, reason: 'no-supported-swaps-found', nextDecklist: null, resolved: null };
  if (maxTotalUsd !== undefined && spend.unknownPriceCount > 0) {
    return { ...base, eligible: false, reason: 'budget-cannot-be-verified-because-a-selected-printing-has-no-price', nextDecklist: null, resolved: null };
  }
  if (maxTotalUsd !== undefined && totalSpend + spend.estimatedSpendUsd > maxTotalUsd + 0.0001) {
    return { ...base, eligible: false, reason: 'package-exceeds-total-budget', nextDecklist: null, resolved: null };
  }
  if (score.significantRegression) {
    return { ...base, eligible: false, reason: 'package-causes-a-significant-simulated-regression', nextDecklist: null, resolved: null };
  }
  const minScore = Number.isFinite(options.minimumImprovementScore)
    ? Math.max(-10, Math.min(100, options.minimumImprovementScore ?? 0.1))
    : 0.1;
  if (score.score < minScore) {
    return { ...base, eligible: false, reason: 'improvement-below-threshold', nextDecklist: null, resolved: null };
  }

  const nextDecklist = typeof plan.upgradedDecklist === 'string' ? plan.upgradedDecklist : '';
  if (!nextDecklist) return { ...base, eligible: false, reason: 'candidate-plan-did-not-return-a-complete-decklist', nextDecklist: null, resolved: null };
  const resolved = await resolveDeck(nextDecklist);
  const rules = validateCommanderDeck(resolved.parsed, resolved.cards);
  if (resolved.notFound.length > 0 || !rules.isLegal) {
    return { ...base, eligible: false, reason: 'candidate-plan-failed-post-build-resolution-or-legality', nextDecklist, resolved };
  }
  return { ...base, eligible: true, reason: 'eligible', nextDecklist, resolved };
}

export async function refineCommanderDeckIterativelyV12(
  decklist: string,
  options: IterativeRefinementOptionsV12 = {},
): Promise<Record<string, unknown>> {
  const maxRounds = Math.max(1, Math.min(5, Math.trunc(options.maxRounds ?? 3)));
  const maxTotalSwaps = Math.max(1, Math.min(30, Math.trunc(options.maxSwaps ?? 12)));
  const swapsPerRound = Math.max(1, Math.min(8, Math.trunc(options.swapsPerRound ?? 4)));
  const candidatePackagesPerRound = Math.max(1, Math.min(6, Math.trunc(options.candidatePackagesPerRound ?? 3)));
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
  const rounds: RoundSummaryV12[] = [];
  let totalSpend = 0;
  let stopReason = 'maximum-rounds-reached';

  for (let round = 1; round <= maxRounds; round += 1) {
    const swapsRemaining = maxTotalSwaps - acceptedSwaps.length;
    if (swapsRemaining <= 0) {
      stopReason = 'maximum-swaps-reached';
      break;
    }

    const winRouteProtection = await currentWinRouteProtectionV15(currentDecklist);
    const roundProtectedNames = new Set([
      ...protectedNames,
      ...winRouteProtection.protectedCardNames.map((name) => name.toLocaleLowerCase()),
    ]);
    let attemptSize = Math.min(swapsPerRound, swapsRemaining);
    let winner: CandidateEvaluationV12 | null = null;
    let evaluatedAtWinningSize: CandidateEvaluationV12[] = [];
    let lastReason = 'no-acceptable-package';

    while (attemptSize >= 1 && !winner) {
      const diversityBlocked = new Set<string>();
      const candidates: CandidateEvaluationV12[] = [];
      for (let candidate = 1; candidate <= candidatePackagesPerRound; candidate += 1) {
        const evaluated = await evaluateCandidate(
          candidate,
          currentParsed,
          currentCards,
          identity,
          { ...options, minimumImprovementScore: minScore },
          attemptSize,
          totalSpend,
          maxTotalUsd,
          roundProtectedNames,
          excludedNames,
          diversityBlocked,
          round,
        );
        candidates.push(evaluated);
        if (evaluated.plan) diversifyNextPackage(diversityBlocked, evaluated.plan);
      }
      winner = chooseWinner(candidates);
      evaluatedAtWinningSize = candidates;
      if (!winner) {
        const reasons = candidates.map((candidate) => candidate.reason);
        lastReason = reasons.includes('improvement-below-threshold')
          ? 'all-competing-packages-below-improvement-threshold'
          : reasons.includes('package-exceeds-total-budget')
            ? 'all-competing-packages-failed-budget-or-quality-checks'
            : reasons[0] ?? 'no-acceptable-package';
        attemptSize -= 1;
      }
    }

    if (!winner || !winner.plan || !winner.resolved || !winner.nextDecklist) {
      rounds.push({
        round,
        accepted: false,
        attemptedSwaps: Math.min(swapsPerRound, swapsRemaining),
        acceptedSwaps: 0,
        candidatePackagesGenerated: evaluatedAtWinningSize.length,
        candidatePackagesEligible: evaluatedAtWinningSize.filter((candidate) => candidate.eligible).length,
        winningCandidate: null,
        estimatedSpendUsd: 0,
        improvementScore: 0,
        winRouteProtection,
        stopReason: lastReason,
        swaps: [],
        candidateComparisons: evaluatedAtWinningSize.map(candidateSummary),
      });
      stopReason = lastReason;
      break;
    }

    const roundSwaps = Array.isArray(winner.plan.swaps) ? winner.plan.swaps.map(asRecord) : [];
    acceptedSwaps.push(...roundSwaps);
    totalSpend = Number((totalSpend + winner.estimatedSpendUsd).toFixed(2));
    currentDecklist = winner.nextDecklist;
    currentParsed = winner.resolved.parsed;
    currentCards = winner.resolved.cards;
    for (const name of namesFromSwaps(roundSwaps, 'out')) excludedNames.add(name.toLocaleLowerCase());
    if (preserveAcceptedAdds) {
      for (const name of namesFromSwaps(roundSwaps, 'in')) protectedNames.add(name.toLocaleLowerCase());
    }

    rounds.push({
      round,
      accepted: true,
      attemptedSwaps: winner.attemptedSwaps,
      acceptedSwaps: roundSwaps.length,
      candidatePackagesGenerated: evaluatedAtWinningSize.length,
      candidatePackagesEligible: evaluatedAtWinningSize.filter((candidate) => candidate.eligible).length,
      winningCandidate: winner.candidate,
      estimatedSpendUsd: winner.estimatedSpendUsd,
      improvementScore: winner.improvementScore,
      winRouteProtection,
      swaps: roundSwaps,
      candidateComparisons: evaluatedAtWinningSize.map(candidateSummary),
    });
  }

  const finalRules = validateCommanderDeck(currentParsed, currentCards);
  const protectedRouteNames = uniqueNames(rounds.flatMap((round) => round.winRouteProtection.protectedCardNames));
  const simple = {
    status: acceptedSwaps.length > 0 ? 'refined' : 'no-supported-improvement',
    stopReason,
    roundsAccepted: rounds.filter((round) => round.accepted).length,
    totalSwaps: acceptedSwaps.length,
    candidatePackagesPerRound,
    estimatedUpgradeSpendUsd: totalSpend,
    maxTotalUsd: maxTotalUsd ?? null,
    swaps: acceptedSwaps.map(simpleSwap),
    finalDecklist: currentDecklist,
    finalCommanderRules: finalRules,
    winRouteProtection: {
      evaluatedEachRound: true,
      source: 'existing-v15-final-win-route-audit',
      protectedCardNamesObservedAcrossRounds: protectedRouteNames,
      verificationUnavailableRounds: rounds.filter((round) => round.winRouteProtection.status === 'verification-unavailable').map((round) => round.round),
    },
    explanation: acceptedSwaps.length > 0
      ? `Each round compared up to ${candidatePackagesPerRound} materially different upgrade packages using the same simulation seed, protected the existing V0.15 verified primary/backup win-route pieces when verification was available, then accepted the strongest package that stayed legal and passed printing, budget, regression, and minimum-improvement checks.`
      : `The engine compared up to ${candidatePackagesPerRound} competing packages per round while protecting existing V0.15 verified primary/backup win-route pieces when verification was available, but none cleared every legality, budget, printing and improvement check, so it kept the starting list.`,
  };

  if (detailLevel === 'simple') return simple;
  const standard = {
    ...simple,
    rounds: rounds.map((round) => ({
      round: round.round,
      accepted: round.accepted,
      acceptedSwaps: round.acceptedSwaps,
      candidatePackagesGenerated: round.candidatePackagesGenerated,
      candidatePackagesEligible: round.candidatePackagesEligible,
      winningCandidate: round.winningCandidate,
      estimatedSpendUsd: round.estimatedSpendUsd,
      improvementScore: round.improvementScore,
      winRouteProtection: round.winRouteProtection,
      ...(round.stopReason ? { stopReason: round.stopReason } : {}),
    })),
    constraints: {
      targetBracket: options.targetBracket ?? 4,
      maxUsdPerCard: options.maxUsdPerCard ?? null,
      maxTotalUsd: maxTotalUsd ?? null,
      maxTotalSwaps,
      swapsPerRound,
      maxRounds,
      candidatePackagesPerRound,
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
    scoringGuidance: 'Competing packages are compared with the same per-round seed. The improvement score is still a within-deck heuristic, not a universal power score or measured multiplayer win rate.',
    diversityGuidance: 'Later candidates temporarily exclude part of earlier candidates’ incoming package so the optimizer explores alternatives rather than resimulating the same swap set repeatedly.',
    winRouteGuidance: 'Route protection is derived from the existing V0.15 final full-table win-route portfolio. Verification unavailable is surfaced explicitly and never treated as evidence that the deck has no route.',
  };
}
