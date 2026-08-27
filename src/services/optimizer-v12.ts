import type { ScryfallCard } from '../types/scryfall.js';
import { derivePostBuildEvidenceV15 } from './commander-build-evaluation-v15.js';
import { auditUpgradeDeckStrategyRetentionV15 } from './commander-strategy-affinity-v15.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildSimulationBackedUpgradePlanV07, type UpgradePlanOptionsV07 } from './deck-builder-v07.js';
import { parseDecklist, resolveEntryCard, type ParsedDeck } from './deck.js';
import { auditFinalWinRoutesV15 } from './final-win-route-audit-v15.js';
import {
  auditNeutralThemeV15,
  resolveNeutralThemeIntentV15,
  type NeutralThemeAuditV15,
  type NeutralThemeIntentV15,
} from './neutral-theme-v15.js';
import {
  estimateUpgradeSpendV11,
  refinementImprovementScoreV11,
  type RefinementImprovementScoreV11,
  type RefinementDetailLevelV11,
} from './optimizer-v11.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from './printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from './scryfall.js';
import { findDeckCombosEvidence } from './spellbook.js';

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
  zeroTargetProgressWhileFailedGatesRemain: boolean;
  targetGate: RefinementImprovementScoreV11['targetGate'];
  themeAudit: NeutralThemeAuditV15 | null;
  plan: Record<string, unknown> | null;
  nextDecklist: string | null;
  resolved: Awaited<ReturnType<typeof resolveDeck>> | null;
}

export interface RefinementCandidateAttemptV15 {
  attemptSize: number;
  candidatePackagesGenerated: number;
  candidatePackagesEligible: number;
  winningCandidate: number | null;
  reasonCounts: Record<string, number>;
  candidateComparisons: Array<Record<string, unknown>>;
}

export interface RefinementCandidateAttemptInputV15 {
  attemptSize: number;
  winningCandidate: number | null;
  candidates: ReadonlyArray<{
    candidate: number;
    eligible: boolean;
    reason: string;
    comparison: Record<string, unknown>;
  }>;
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
  themeAuditBefore: NeutralThemeAuditV15 | null;
  stopReason?: string;
  swaps: Array<Record<string, unknown>>;
  candidateComparisons: Array<Record<string, unknown>>;
  candidateAttempts: RefinementCandidateAttemptV15[];
}

interface RefinementThemeContextV15 {
  intent: NeutralThemeIntentV15 | null;
  effectiveOptions: IterativeRefinementOptionsV12;
  initialAudit: NeutralThemeAuditV15 | null;
}

type RefinementThemePreparationV15 =
  | { ok: true; context: RefinementThemeContextV15 }
  | { ok: false; result: Record<string, unknown> };

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

export function refinementSwapEvidenceV15(swap: Record<string, unknown>): Record<string, unknown> {
  const printing = asRecord(swap.recommendedPrinting);
  const structuralPairing = asRecord(swap.structuralPairing);
  const strategyPreservation = asRecord(structuralPairing.strategyPreservation);
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
    structuralPairing: Object.keys(structuralPairing).length > 0 ? {
      addressedRole: structuralPairing.addressedRole ?? null,
      remainingStructuralDeficitAfterSwap: structuralPairing.remainingStructuralDeficitAfterSwap ?? null,
      authoritativeTargetGate: structuralPairing.authoritativeTargetGate ?? null,
      nonlandManaValueReduction: structuralPairing.nonlandManaValueReduction ?? null,
      persistentColoredManaSourcesAfterSwap: structuralPairing.persistentColoredManaSourcesAfterSwap ?? null,
      persistentColoredManaSourceFloor: structuralPairing.persistentColoredManaSourceFloor ?? null,
      strategyPreservation: Object.keys(strategyPreservation).length > 0 ? strategyPreservation : null,
    } : null,
  };
}

function compactThemeAudit(audit: NeutralThemeAuditV15 | null): Record<string, unknown> | null {
  if (!audit) return null;
  return {
    status: audit.status,
    satisfied: audit.satisfied,
    canonicalLabel: audit.canonicalLabel,
    matchedMainCards: audit.matchedMainCards,
    requiredMainMatches: audit.requiredMainMatches,
    mainCoverage: audit.mainCoverage,
  };
}

function compactStrategyPreservationV15(plan: Record<string, unknown> | null): Record<string, unknown> | null {
  const audit = asRecord(plan?.strategyPreservation);
  if (Object.keys(audit).length === 0) return null;
  return {
    status: audit.status ?? null,
    evidenceComplete: audit.evidenceComplete === true,
    meaningfulLosses: Array.isArray(audit.meaningfulLosses) ? audit.meaningfulLosses : [],
    strategyDeltas: Array.isArray(audit.strategyDeltas) ? audit.strategyDeltas : [],
    swapImpacts: Array.isArray(audit.swapImpacts) ? audit.swapImpacts : [],
    acceptanceRule: audit.acceptanceRule ?? null,
  };
}

export function candidateStrategyPreservationGateV15(
  plan: Record<string, unknown> | null,
): { eligible: boolean; reason: string; audit: Record<string, unknown> | null } {
  const audit = compactStrategyPreservationV15(plan);
  if (!audit || audit.evidenceComplete !== true) {
    return {
      eligible: false,
      reason: 'strategy-preservation-evidence-missing',
      audit,
    };
  }
  const meaningfulLosses = Array.isArray(audit.meaningfulLosses) ? audit.meaningfulLosses : [];
  const swapImpacts = Array.isArray(audit.swapImpacts) ? audit.swapImpacts.map(asRecord) : [];
  const perSwapMeaningfulLoss = swapImpacts.some((impact) => (
    impact.meaningfulStrategyLoss === true || impact.verdict === 'meaningful-strategy-loss'
  ));
  if (audit.status === 'meaningful-strategy-loss' || meaningfulLosses.length > 0 || perSwapMeaningfulLoss) {
    return {
      eligible: false,
      reason: 'package-causes-a-meaningful-commander-strategy-loss',
      audit,
    };
  }
  return {
    eligible: true,
    reason: 'commander-strategy-preserved',
    audit,
  };
}

export function candidatePlanProvenanceV15(plan: Record<string, unknown> | null): Record<string, unknown> {
  const pressure = asRecord(plan?.v15TargetPressure);
  const source = asRecord(plan?.sourceUpgradeAnalysis);
  const attempted = pressure.winPackageDiscoveryAttempted === true;
  const sourceStatus = typeof pressure.winPackageSourceStatus === 'string'
    ? pressure.winPackageSourceStatus
    : 'not-reported';
  const selectedComboId = typeof pressure.selectedComboId === 'string' ? pressure.selectedComboId : null;
  const atomicInjected = pressure.atomicWinPackageInjected === true;
  const normalizedStatus = sourceStatus.toLocaleLowerCase();
  const winPackageOutcome = !attempted
    ? 'not-attempted'
    : atomicInjected
      ? 'verified-package-injected'
      : selectedComboId
        ? 'verified-package-selected-not-injected'
        : normalizedStatus === 'no-verified-win-package'
          ? 'completed-no-verified-package'
          : normalizedStatus.includes('unavailable') || normalizedStatus.includes('incomplete')
            ? 'verification-unavailable'
            : normalizedStatus === 'verified-win-packages-found'
              ? 'selection-failed-after-discovery'
              : 'no-package-selected';
  const candidateGroups = Array.isArray(source.candidateAddsByDeficit)
    ? source.candidateAddsByDeficit.map(asRecord).map((group) => ({
        role: group.role ?? null,
        prioritySource: group.prioritySource ?? null,
        targetGate: group.targetGate ?? null,
        current: group.current ?? null,
        target: group.target ?? null,
        deficit: group.deficit ?? null,
        candidateDiscoveryMode: group.candidateDiscoveryMode ?? null,
        candidateCount: Array.isArray(group.candidates) ? group.candidates.length : 0,
      }))
    : [];
  return {
    targetBracket: asRecord(pressure.targetPressure).targetBracket ?? null,
    winRouteVerificationStatus: pressure.winRouteVerificationStatus ?? null,
    winPackageDiscoveryAttempted: attempted,
    winPackageSourceStatus: sourceStatus,
    winPackageOutcome,
    selectedComboId,
    selectedBracketTag: pressure.selectedBracketTag ?? null,
    missingSeedNames: Array.isArray(pressure.missingSeedNames) ? pressure.missingSeedNames : [],
    atomicWinPackageInjected: atomicInjected,
    winPackageReason: pressure.reason ?? null,
    candidateDiscovery: source.candidateDiscovery ?? null,
    authoritativeTargetGatePriorities: Array.isArray(source.authoritativeTargetGatePriorities)
      ? source.authoritativeTargetGatePriorities
      : [],
    structuralDeficits: Array.isArray(source.structuralDeficits) ? source.structuralDeficits : [],
    candidateGroups,
  };
}

export function appendRefinementCandidateAttemptV15(
  existing: readonly RefinementCandidateAttemptV15[],
  input: RefinementCandidateAttemptInputV15,
): RefinementCandidateAttemptV15[] {
  const counts = new Map<string, number>();
  for (const candidate of input.candidates) counts.set(candidate.reason, (counts.get(candidate.reason) ?? 0) + 1);
  const reasonCounts = Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
  return [...existing, {
    attemptSize: Math.max(1, Math.trunc(input.attemptSize)),
    candidatePackagesGenerated: input.candidates.length,
    candidatePackagesEligible: input.candidates.filter((candidate) => candidate.eligible).length,
    winningCandidate: input.winningCandidate,
    reasonCounts,
    candidateComparisons: input.candidates.map((candidate) => candidate.comparison),
  }];
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
    zeroTargetProgressWhileFailedGatesRemain: candidate.zeroTargetProgressWhileFailedGatesRemain,
    targetGate: {
      applicable: candidate.targetGate.applicable,
      score: candidate.targetGate.score,
      failedBefore: candidate.targetGate.failedBefore,
      failedAfter: candidate.targetGate.failedAfter,
      repairedGates: candidate.targetGate.repairedGates,
      advancedFailedGates: candidate.targetGate.advancedFailedGates,
      regressedGates: candidate.targetGate.regressedGates,
      ignoredUnverifiedGates: candidate.targetGate.ignoredUnverifiedGates,
    },
    themeAudit: compactThemeAudit(candidate.themeAudit),
    strategyPreservation: compactStrategyPreservationV15(candidate.plan),
    deckStrategyRetention: asRecord(candidate.plan?.deckStrategyRetention),
    planProvenance: candidatePlanProvenanceV15(candidate.plan),
    swaps: candidate.plan && Array.isArray(candidate.plan.swaps)
      ? candidate.plan.swaps.map(asRecord).map(refinementSwapEvidenceV15)
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

function auditResolvedThemeV15(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  intent: NeutralThemeIntentV15,
  options: { printingPolicySatisfied?: boolean; activePrintingFamily?: string | null } = {},
): NeutralThemeAuditV15 | null {
  const entries: Array<{ card: ScryfallCard; quantity: number; zone: 'commander' | 'main' }> = [];
  for (const entry of parsed.commanders) {
    const card = resolveEntryCard(entry, cards);
    if (!card) return null;
    entries.push({ card, quantity: entry.quantity, zone: 'commander' });
  }
  for (const entry of parsed.main) {
    const card = resolveEntryCard(entry, cards);
    if (!card) return null;
    entries.push({ card, quantity: entry.quantity, zone: 'main' });
  }
  return auditNeutralThemeV15(entries, intent, options);
}

async function prepareRefinementThemeV15(
  initial: Awaited<ReturnType<typeof resolveDeck>>,
  options: IterativeRefinementOptionsV12,
): Promise<RefinementThemePreparationV15> {
  const effectiveOptions: IterativeRefinementOptionsV12 = { ...options };
  delete effectiveOptions.themeQuery;
  delete effectiveOptions.themeMinimumMainMatches;
  delete effectiveOptions.themeCurrentMainMatches;
  const requestedTheme = options.themeQuery?.trim();
  if (!requestedTheme) {
    return { ok: true, context: { intent: null, effectiveOptions, initialAudit: null } };
  }

  const intent = await resolveNeutralThemeIntentV15(requestedTheme);
  if (intent.enforceability === 'verification-unavailable') {
    return {
      ok: false,
      result: {
        status: 'theme-verification-unavailable',
        reason: intent.explanation,
        themeIntent: intent,
      },
    };
  }
  if (intent.enforceability === 'unsupported') {
    return {
      ok: false,
      result: {
        status: 'unsupported-theme',
        reason: intent.explanation,
        themeIntent: intent,
      },
    };
  }

  if (intent.kind === 'printing-family' && intent.printingFamily) {
    const themePolicy = await resolvePrintingPolicyV08({
      printingFamily: intent.printingFamily,
      ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
      ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    });
    if (options.printingFamily) {
      const suppliedPolicy = await resolvePrintingPolicyV08({
        printingFamily: options.printingFamily,
        ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
        ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
      });
      if (themePolicy.familyPreset !== suppliedPolicy.familyPreset) {
        return {
          ok: false,
          result: {
            status: 'theme-constraint-conflict',
            reason: `Theme ${intent.canonicalLabel ?? intent.original} conflicts with printingFamily=${options.printingFamily}.`,
            themeIntent: intent,
          },
        };
      }
    }
    const familySets = new Set(themePolicy.familyMatchedSetCodes.map((set) => set.toLocaleLowerCase()));
    const conflictingSets = (options.allowedSets ?? [])
      .map((set) => set.trim())
      .filter(Boolean)
      .filter((set) => !familySets.has(set.toLocaleLowerCase()));
    if (conflictingSets.length > 0) {
      return {
        ok: false,
        result: {
          status: 'theme-constraint-conflict',
          reason: `Theme ${intent.canonicalLabel ?? intent.original} conflicts with allowed set codes outside that printing family: ${conflictingSets.join(', ')}.`,
          themeIntent: intent,
        },
      };
    }

    effectiveOptions.printingFamily = intent.printingFamily;
    const effectiveThemePolicy = await resolvePrintingPolicyV08({
      printingFamily: intent.printingFamily,
      ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
      ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
      ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    });
    const printingPolicySatisfied = initial.notFound.length === 0
      && initial.cards.every((card) => printingMatchesPolicyV08(card, effectiveThemePolicy));
    const initialAudit = auditResolvedThemeV15(initial.parsed, initial.cards, intent, {
      printingPolicySatisfied,
      activePrintingFamily: intent.printingFamily,
    });
    if (!initialAudit || !initialAudit.satisfied) {
      return {
        ok: false,
        result: {
          status: 'starting-deck-theme-gate-failed',
          reason: 'The starting deck does not independently prove the requested physical-printing-family theme, so refinement will not pretend later swaps make the whole deck compliant.',
          themeIntent: intent,
          themeAudit: initialAudit,
          printingPolicySatisfied,
        },
      };
    }
    return { ok: true, context: { intent, effectiveOptions, initialAudit } };
  }

  if (intent.enforceability !== 'full' || !intent.queryClause) {
    return {
      ok: false,
      result: {
        status: 'unsupported-theme',
        reason: intent.explanation,
        themeIntent: intent,
      },
    };
  }

  effectiveOptions.themeQuery = intent.queryClause;
  effectiveOptions.themeMinimumMainMatches = intent.minimumMainMatches;
  const initialAudit = auditResolvedThemeV15(initial.parsed, initial.cards, intent);
  if (!initialAudit) {
    return {
      ok: false,
      result: {
        status: 'theme-verification-unavailable',
        reason: 'The resolved starting deck could not be bound back to every exact deck entry for the V0.15 theme audit.',
        themeIntent: intent,
      },
    };
  }
  return { ok: true, context: { intent, effectiveOptions, initialAudit } };
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

async function currentWinRouteProtectionV15(
  decklist: string,
  parsed: ParsedDeck,
): Promise<WinRouteProtectionV15> {
  try {
    const combos = await findDeckCombosEvidence(decklist, 100);
    // The current round's deck has already passed resolution and Commander legality. We reuse the
    // existing V0.15 Spellbook-to-full-table-win derivation here only for verified combo details;
    // the unrelated bracket/curve signal fields below are deliberately inert and are not surfaced
    // as an analysis or bracket result by refinement.
    const evidence = derivePostBuildEvidenceV15({
      commanderLegal: true,
      exactCardCount: parsed.totalCards === 100,
      fullyResolved: true,
      printingPolicyCompliant: true,
      averageNonlandManaValue: 0,
      earlyPlayCount: 0,
      fastManaCount: 0,
      freeInteractionCount: 0,
      cheapInteractionCount: 0,
      tutorCount: 0,
      gameChangerNames: [],
      commanderNames: parsed.commanders.map((entry) => entry.name),
      spellbookBracket: {},
      combos,
      efficientWinPlanSupported: false,
    });
    const finalAudit = auditFinalWinRoutesV15({
      comboVerificationComplete: evidence.comboVerificationComplete,
      verifiedWinningComboDetails: evidence.verifiedWinningComboDetails,
    });
    return deriveWinRouteProtectionV15({
      comboVerificationComplete: finalAudit.comboVerificationComplete,
      primaryComboId: finalAudit.portfolio.primaryComboId,
      backupComboId: finalAudit.portfolio.backupComboId,
      verifiedWinningComboDetails: evidence.verifiedWinningComboDetails,
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

export function candidateThemeGateV15(
  before: NeutralThemeAuditV15,
  after: NeutralThemeAuditV15,
): { eligible: boolean; reason: string } {
  if (before.satisfied) {
    return after.satisfied
      ? { eligible: true, reason: 'theme-preserved' }
      : { eligible: false, reason: 'package-would-break-required-theme-density' };
  }
  if (after.matchedMainCards > before.matchedMainCards) {
    return { eligible: true, reason: after.satisfied ? 'theme-target-reached' : 'theme-density-advanced' };
  }
  return { eligible: false, reason: 'package-does-not-advance-required-theme-density' };
}

export function candidateTargetGateProgressGateV15(
  score: Pick<RefinementImprovementScoreV11, 'zeroTargetProgressWhileFailedGatesRemain' | 'targetGate'>,
): { eligible: boolean; reason: string } {
  if (score.zeroTargetProgressWhileFailedGatesRemain) {
    return {
      eligible: false,
      reason: 'package-does-not-repair-or-advance-failed-bracket-5-target-gate',
    };
  }
  return {
    eligible: true,
    reason: score.targetGate.applicable
      ? 'package-repairs-or-advances-a-failed-bracket-5-target-gate-or-none-remain'
      : 'bracket-5-target-progress-gate-not-applicable',
  };
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
  themeIntent: NeutralThemeIntentV15 | null,
  currentThemeAudit: NeutralThemeAuditV15 | null,
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
    zeroTargetProgressWhileFailedGatesRemain: score.zeroTargetProgressWhileFailedGatesRemain,
    targetGate: score.targetGate,
    themeAudit: null,
    plan,
  };

  if (planSwaps.length === 0) return { ...base, eligible: false, reason: 'no-supported-swaps-found', nextDecklist: null, resolved: null };
  if (maxTotalUsd !== undefined && spend.unknownPriceCount > 0) {
    return { ...base, eligible: false, reason: 'budget-cannot-be-verified-because-a-selected-printing-has-no-price', nextDecklist: null, resolved: null };
  }
  if (maxTotalUsd !== undefined && totalSpend + spend.estimatedSpendUsd > maxTotalUsd + 0.0001) {
    return { ...base, eligible: false, reason: 'package-exceeds-total-budget', nextDecklist: null, resolved: null };
  }
  const strategyPreservationGate = candidateStrategyPreservationGateV15(plan);
  if (!strategyPreservationGate.eligible) {
    return { ...base, eligible: false, reason: strategyPreservationGate.reason, nextDecklist: null, resolved: null };
  }
  if (score.significantRegression) {
    return { ...base, eligible: false, reason: 'package-causes-a-significant-simulated-regression', nextDecklist: null, resolved: null };
  }
  const targetProgressGate = candidateTargetGateProgressGateV15(score);
  if (!targetProgressGate.eligible) {
    return { ...base, eligible: false, reason: targetProgressGate.reason, nextDecklist: null, resolved: null };
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

  const deckStrategyRetention = auditUpgradeDeckStrategyRetentionV15(
    currentParsed,
    currentCards,
    resolved.parsed,
    resolved.cards,
  );
  plan.deckStrategyRetention = deckStrategyRetention;
  if (!deckStrategyRetention.evidenceComplete) {
    return {
      ...base,
      eligible: false,
      reason: 'candidate-deck-strategy-retention-evidence-incomplete',
      nextDecklist,
      resolved,
    };
  }
  if (!deckStrategyRetention.preserved) {
    return {
      ...base,
      eligible: false,
      reason: 'package-reduces-substantive-deck-strategy-density',
      nextDecklist,
      resolved,
    };
  }

  if (themeIntent?.enforceability === 'full' && currentThemeAudit) {
    const themeAudit = auditResolvedThemeV15(resolved.parsed, resolved.cards, themeIntent);
    if (!themeAudit) {
      return {
        ...base,
        themeAudit: null,
        eligible: false,
        reason: 'candidate-theme-verification-unavailable',
        nextDecklist,
        resolved,
      };
    }
    const gate = candidateThemeGateV15(currentThemeAudit, themeAudit);
    if (!gate.eligible) {
      return {
        ...base,
        themeAudit,
        eligible: false,
        reason: gate.reason,
        nextDecklist,
        resolved,
      };
    }
    return { ...base, themeAudit, eligible: true, reason: gate.reason, nextDecklist, resolved };
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

  const themePreparation = await prepareRefinementThemeV15(initial, options);
  if (!themePreparation.ok) return themePreparation.result;
  const themeContext = themePreparation.context;
  const effectiveOptions = themeContext.effectiveOptions;

  let currentDecklist = decklist;
  let currentParsed = initial.parsed;
  let currentCards = initial.cards;
  const identity = commanderIdentity(currentParsed, currentCards);
  const protectedNames = new Set((effectiveOptions.protectedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const excludedNames = new Set((effectiveOptions.excludedCards ?? []).map((name) => name.toLocaleLowerCase()));
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

    const currentThemeAudit = themeContext.intent?.enforceability === 'full'
      ? auditResolvedThemeV15(currentParsed, currentCards, themeContext.intent)
      : themeContext.initialAudit;
    if (themeContext.intent?.enforceability === 'full' && !currentThemeAudit) {
      stopReason = 'theme-verification-unavailable-after-accepted-swap';
      break;
    }
    const roundOptions: IterativeRefinementOptionsV12 = { ...effectiveOptions };
    if (themeContext.intent?.enforceability === 'full' && currentThemeAudit && themeContext.intent.queryClause) {
      roundOptions.themeQuery = themeContext.intent.queryClause;
      roundOptions.themeMinimumMainMatches = themeContext.intent.minimumMainMatches;
      roundOptions.themeCurrentMainMatches = currentThemeAudit.matchedMainCards;
    }

    const winRouteProtection = await currentWinRouteProtectionV15(currentDecklist, currentParsed);
    const roundProtectedNames = new Set([
      ...protectedNames,
      ...winRouteProtection.protectedCardNames.map((name) => name.toLocaleLowerCase()),
    ]);
    let attemptSize = Math.min(swapsPerRound, swapsRemaining);
    let winner: CandidateEvaluationV12 | null = null;
    let evaluatedAtWinningSize: CandidateEvaluationV12[] = [];
    let candidateAttempts: RefinementCandidateAttemptV15[] = [];
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
          { ...roundOptions, minimumImprovementScore: minScore, winRouteVerificationStatus: winRouteProtection.status },
          attemptSize,
          totalSpend,
          maxTotalUsd,
          roundProtectedNames,
          excludedNames,
          diversityBlocked,
          round,
          themeContext.intent,
          currentThemeAudit,
        );
        candidates.push(evaluated);
        if (evaluated.plan) diversifyNextPackage(diversityBlocked, evaluated.plan);
      }
      winner = chooseWinner(candidates);
      evaluatedAtWinningSize = candidates;
      candidateAttempts = appendRefinementCandidateAttemptV15(candidateAttempts, {
        attemptSize,
        winningCandidate: winner?.candidate ?? null,
        candidates: candidates.map((candidate) => ({
          candidate: candidate.candidate,
          eligible: candidate.eligible,
          reason: candidate.reason,
          comparison: candidateSummary(candidate),
        })),
      });
      if (!winner) {
        const reasons = candidates.map((candidate) => candidate.reason);
        lastReason = reasons.includes('improvement-below-threshold')
          ? 'all-competing-packages-below-improvement-threshold'
          : reasons.includes('package-exceeds-total-budget')
            ? 'all-competing-packages-failed-budget-or-quality-checks'
            : reasons.includes('package-would-break-required-theme-density')
              ? 'all-competing-packages-would-break-theme-density'
              : reasons.includes('package-does-not-advance-required-theme-density')
                ? 'all-competing-packages-failed-to-advance-theme-density'
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
        themeAuditBefore: currentThemeAudit,
        stopReason: lastReason,
        swaps: [],
        candidateComparisons: evaluatedAtWinningSize.map(candidateSummary),
        candidateAttempts,
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
      themeAuditBefore: currentThemeAudit,
      swaps: roundSwaps,
      candidateComparisons: evaluatedAtWinningSize.map(candidateSummary),
      candidateAttempts,
    });
  }

  const finalRules = validateCommanderDeck(currentParsed, currentCards);
  const finalThemeAudit = themeContext.intent?.enforceability === 'full'
    ? auditResolvedThemeV15(currentParsed, currentCards, themeContext.intent)
    : themeContext.initialAudit;
  const themeConstraintSatisfied = themeContext.intent === null || finalThemeAudit?.satisfied === true;
  const protectedRouteNames = uniqueNames(rounds.flatMap((round) => round.winRouteProtection.protectedCardNames));
  const simple = {
    status: !themeConstraintSatisfied
      ? 'theme-target-not-satisfied'
      : acceptedSwaps.length > 0 ? 'refined' : 'no-supported-improvement',
    stopReason,
    roundsAccepted: rounds.filter((round) => round.accepted).length,
    totalSwaps: acceptedSwaps.length,
    candidatePackagesPerRound,
    estimatedUpgradeSpendUsd: totalSpend,
    maxTotalUsd: maxTotalUsd ?? null,
    swaps: acceptedSwaps.map(refinementSwapEvidenceV15),
    finalDecklist: currentDecklist,
    finalCommanderRules: finalRules,
    themeConstraint: {
      requested: options.themeQuery ?? null,
      intent: themeContext.intent,
      audit: finalThemeAudit,
      satisfied: themeConstraintSatisfied,
      explanation: themeContext.intent === null
        ? 'No explicit theme constraint was requested.'
        : themeConstraintSatisfied
          ? 'The final deck independently satisfies the resolved V0.15 theme constraint. Generic utility cards remain allowed; only the required deck-level density or exact printing-family truth is hard-gated.'
          : 'The optimizer may have improved other supported signals, but the final deck has not yet reached the requested V0.15 theme minimum and is not presented as theme-compliant.',
    },
    winRouteProtection: {
      evaluatedEachRound: true,
      source: 'existing-v15-final-win-route-audit',
      protectedCardNamesObservedAcrossRounds: protectedRouteNames,
      verificationUnavailableRounds: rounds.filter((round) => round.winRouteProtection.status === 'verification-unavailable').map((round) => round.round),
    },
    explanation: acceptedSwaps.length > 0
      ? `Each round compared up to ${candidatePackagesPerRound} materially different upgrade packages using the same simulation seed, protected the existing V0.15 verified primary/backup win-route pieces when verification was available, independently enforced the resolved V0.15 theme at deck level when requested, then accepted the strongest package that stayed legal and passed printing, budget, regression, and minimum-improvement checks.`
      : `The engine compared up to ${candidatePackagesPerRound} competing packages per round while protecting existing V0.15 verified primary/backup win-route pieces and independently enforcing the resolved V0.15 theme when requested, but none cleared every legality, theme, budget, printing and improvement check, so it kept the starting list.`,
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
      candidateAttemptSizes: round.candidateAttempts.map((attempt) => attempt.attemptSize),
      candidatePackagesGeneratedAcrossAttempts: round.candidateAttempts
        .reduce((sum, attempt) => sum + attempt.candidatePackagesGenerated, 0),
      winningCandidate: round.winningCandidate,
      estimatedSpendUsd: round.estimatedSpendUsd,
      improvementScore: round.improvementScore,
      winRouteProtection: round.winRouteProtection,
      themeAuditBefore: compactThemeAudit(round.themeAuditBefore),
      ...(round.stopReason ? { stopReason: round.stopReason } : {}),
    })),
    constraints: {
      targetBracket: effectiveOptions.targetBracket ?? 4,
      maxUsdPerCard: effectiveOptions.maxUsdPerCard ?? null,
      maxTotalUsd: maxTotalUsd ?? null,
      maxTotalSwaps,
      swapsPerRound,
      maxRounds,
      candidatePackagesPerRound,
      minimumImprovementScore: minScore,
      printingFamily: effectiveOptions.printingFamily ?? null,
      allowedSets: effectiveOptions.allowedSets ?? [],
      requestedTheme: options.themeQuery ?? null,
      resolvedTheme: themeContext.intent?.canonicalLabel ?? null,
      protectedCards: effectiveOptions.protectedCards ?? [],
      excludedCards: effectiveOptions.excludedCards ?? [],
    },
  };
  if (detailLevel === 'standard') return standard;
  return {
    ...standard,
    detailedRounds: rounds,
    scoringGuidance: 'Competing packages are compared with the same per-round seed. The improvement score is still a within-deck heuristic, not a universal power score or measured multiplayer win rate.',
    diversityGuidance: 'Later candidates temporarily exclude part of earlier candidates’ incoming package so the optimizer explores alternatives rather than resimulating the same swap set repeatedly.',
    winRouteGuidance: 'Route protection is derived from the existing V0.15 final full-table win-route portfolio. Verification unavailable is surfaced explicitly and never treated as evidence that the deck has no route.',
    themeGuidance: 'User theme text is resolved once through the existing V0.15 controlled theme adapter. Mechanical/typal/card-type themes are audited on every candidate deck, while physical printing-family themes are delegated to the exact printing policy. Raw user theme text is never appended to candidate Scryfall role searches.',
  };
}
