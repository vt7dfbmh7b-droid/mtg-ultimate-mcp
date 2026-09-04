import type { ScryfallCard } from '../types/scryfall.js';
import { compareRequestedBracketV15 } from './bracket-target-comparison-v15.js';
import { evaluateCommanderBuildV15 } from './commander-build-evaluation-v15.js';
import { selectTargetAwareWinPackageV15 } from './commander-target-pressure-v15.js';
import { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';
import { resolveEntryCard } from './deck.js';
import { discoverGeneralWinPackagesV15, type GeneralWinPackageCandidateV15 } from './general-win-package-v15.js';
import { inferNeutralStrategyV15, type NeutralArchetypeV15 } from './neutral-commander-selection-v15.js';
import { buildNeutralCommanderDeckV15 } from './neutral-deck-builder-v15.js';
import { buildNeutralThemedCommanderDeckV15 } from './neutral-themed-deck-builder-v15.js';
import {
  auditNeutralThemeV15,
  resolveNeutralThemeIntentV15,
  type NeutralThemeIntentV15,
} from './neutral-theme-v15.js';
import { resolvePrintingPolicyV08, type PrintingPolicyInputV08 } from './printing-policy-v08.js';

export type WinPackageModeV15 = 'auto' | 'prefer' | 'require' | 'forbid';
export type CommanderBuildLaneV15 = 'neutral-themed' | 'targeted-v07';

export interface CommanderBuildPipelineOptionsV15 extends PrintingPolicyInputV08 {
  targetBracket?: number;
  archetype?: NeutralArchetypeV15;
  winPackageMode?: WinPackageModeV15;
  maxWinPackageCards?: number;
  /** Minimum number of verified routes with pairwise-disjoint library seed cards to preserve. */
  minimumDistinctLibraryRoutes?: number;
  maxUsdPerCard?: number;
  candidateMaxUsdPerCard?: number;
  themeQuery?: string;
  excludedCards?: string[];
  mustInclude?: string[];
  landCount?: number;
  maxNonbasicLands?: number;
  cedhIntent?: boolean;
  competitiveMetagameEvidence?: boolean;
  optimizedPlanEvidence?: boolean;
  exhibitionIntent?: boolean;
}

export interface CommanderBuildPipelinePlanV15 {
  lane: CommanderBuildLaneV15;
  requestedTargetBracket: number | null;
  archetype: NeutralArchetypeV15 | null;
  discoverWinPackages: boolean;
  seedWinPackage: boolean;
  minimumDistinctLibraryRoutes: number;
  unsupportedConstraints: string[];
}

interface NeutralThemePipelineContextV15 {
  effectiveOptions: CommanderBuildPipelineOptionsV15;
  themeIntent: NeutralThemeIntentV15 | null;
  effectivePrintingFamily: string | null;
  failure: Record<string, unknown> | null;
}

function normalizeNames(values: string[]): string[] {
  return [...new Map(values.map((value) => [value.trim().toLocaleLowerCase(), value.trim()])).values()].filter(Boolean);
}

function boundedTarget(value: number | undefined): number | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value)) throw new Error('targetBracket must be finite when supplied.');
  return Math.max(1, Math.min(5, Math.trunc(value)));
}

function boundedMinimumDistinctLibraryRoutes(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > 6) {
    throw new Error('minimumDistinctLibraryRoutes must be an integer from 1 through 6 when supplied.');
  }
  return value;
}

export function planCommanderBuildPipelineV15(
  commanders: readonly ScryfallCard[],
  options: CommanderBuildPipelineOptionsV15 = {},
): CommanderBuildPipelinePlanV15 {
  if (commanders.length < 1 || commanders.length > 2) throw new Error('Universal Commander build planning requires one or two resolved commanders.');
  const target = boundedTarget(options.targetBracket);
  const mode = options.winPackageMode ?? 'auto';
  const minimumDistinctLibraryRoutes = boundedMinimumDistinctLibraryRoutes(options.minimumDistinctLibraryRoutes);
  const discoverWinPackages = mode !== 'forbid';
  const seedWinPackage = mode === 'require'
    || mode === 'prefer'
    || (mode === 'auto' && target !== null && target >= 4)
    || (mode !== 'forbid' && minimumDistinctLibraryRoutes > 1);
  const unsupportedConstraints = mode === 'forbid' && minimumDistinctLibraryRoutes > 1
    ? ['minimumDistinctLibraryRoutes requires win-package discovery and seeding, but winPackageMode=forbid disables both.']
    : [];

  if (target !== null) {
    return {
      lane: 'targeted-v07',
      requestedTargetBracket: target,
      archetype: null,
      discoverWinPackages,
      seedWinPackage,
      minimumDistinctLibraryRoutes,
      unsupportedConstraints,
    };
  }

  const archetype = options.archetype ?? inferNeutralStrategyV15(commanders)[0]!.archetype;
  return {
    lane: 'neutral-themed',
    requestedTargetBracket: null,
    archetype,
    discoverWinPackages,
    seedWinPackage,
    minimumDistinctLibraryRoutes,
    unsupportedConstraints,
  };
}

function constraintDescriptions(options: CommanderBuildPipelineOptionsV15): string[] {
  const constraints: string[] = [];
  if (options.printingFamily) constraints.push(`${options.printingFamily} physical printings only.`);
  if ((options.allowedSets ?? []).length > 0) constraints.push(`Allowed physical sets: ${(options.allowedSets ?? []).join(', ')}.`);
  if (options.maxUsdPerCard !== undefined) constraints.push(`Maximum USD reference price per card: ${options.maxUsdPerCard}.`);
  if (options.candidateMaxUsdPerCard !== undefined) constraints.push(`Optional candidate search cap in USD: ${options.candidateMaxUsdPerCard}.`);
  if (options.themeQuery?.trim()) constraints.push(`Theme constraint: ${options.themeQuery.trim()}.`);
  if ((options.excludedCards ?? []).length > 0) constraints.push(`Excluded cards: ${(options.excludedCards ?? []).join(', ')}.`);
  if ((options.mustInclude ?? []).length > 0) constraints.push(`Must-include cards: ${(options.mustInclude ?? []).join(', ')}.`);
  if ((options.minimumDistinctLibraryRoutes ?? 1) > 1) {
    constraints.push(`Minimum distinct library win routes: ${options.minimumDistinctLibraryRoutes}.`);
  }
  return constraints;
}

function disjointLibrarySeedsV15(
  left: GeneralWinPackageCandidateV15,
  right: GeneralWinPackageCandidateV15,
): boolean {
  const rightSeeds = new Set(right.seedNames.map((name) => name.trim().toLocaleLowerCase()));
  return left.seedNames.every((name) => !rightSeeds.has(name.trim().toLocaleLowerCase()));
}

/**
 * Selects a primary package followed by verified packages whose library seed cards are
 * pairwise disjoint. The provider portfolio's preferred backup is tried first, then the
 * deterministic discovery/ranking order. Commander overlap is allowed: the requirement
 * is specifically distinct library routes, not independent commanders.
 */
export function selectWinPackagePortfolioV15(
  candidates: readonly GeneralWinPackageCandidateV15[],
  primary: GeneralWinPackageCandidateV15 | null,
  minimumDistinctLibraryRoutes: number,
  preferredBackupComboId?: string | null,
): GeneralWinPackageCandidateV15[] {
  const minimum = boundedMinimumDistinctLibraryRoutes(minimumDistinctLibraryRoutes);
  if (!primary) return [];

  const byComboId = new Map(candidates.map((candidate) => [candidate.comboId, candidate]));
  const ordered: GeneralWinPackageCandidateV15[] = [primary];
  const preferred = preferredBackupComboId
    ? byComboId.get(preferredBackupComboId)
    : undefined;
  if (preferred && preferred.comboId !== primary.comboId) ordered.push(preferred);
  for (const candidate of candidates) {
    if (candidate.comboId === primary.comboId || candidate.comboId === preferred?.comboId) continue;
    ordered.push(candidate);
  }

  const selected: GeneralWinPackageCandidateV15[] = [primary];
  const selectedIds = new Set([primary.comboId]);
  for (const candidate of ordered.slice(1)) {
    if (selected.length >= minimum) break;
    if (selectedIds.has(candidate.comboId)) continue;
    if (!selected.every((existing) => disjointLibrarySeedsV15(existing, candidate))) continue;
    selected.push(candidate);
    selectedIds.add(candidate.comboId);
  }
  return selected;
}

function seededMustIncludes(
  options: CommanderBuildPipelineOptionsV15,
  selectedPackages: readonly GeneralWinPackageCandidateV15[],
  seedPackage: boolean,
): string[] {
  const original = options.mustInclude ?? [];
  const packageSeeds = seedPackage ? selectedPackages.flatMap((selected) => selected.seedNames) : [];
  return normalizeNames([...original, ...packageSeeds]);
}

async function resolveThemePipelineContextV15(
  options: CommanderBuildPipelineOptionsV15,
): Promise<NeutralThemePipelineContextV15> {
  if (!options.themeQuery?.trim()) {
    return {
      effectiveOptions: options,
      themeIntent: null,
      effectivePrintingFamily: options.printingFamily ?? null,
      failure: null,
    };
  }

  const themeIntent = await resolveNeutralThemeIntentV15(options.themeQuery);
  if (themeIntent.enforceability === 'verification-unavailable') {
    return {
      effectiveOptions: options,
      themeIntent,
      effectivePrintingFamily: options.printingFamily ?? null,
      failure: {
        status: 'neutral-theme-verification-unavailable',
        guidance: themeIntent.explanation,
      },
    };
  }
  if (themeIntent.enforceability === 'unsupported') {
    return {
      effectiveOptions: options,
      themeIntent,
      effectivePrintingFamily: options.printingFamily ?? null,
      failure: {
        status: 'unsupported-neutral-theme',
        guidance: themeIntent.explanation,
      },
    };
  }
  if (themeIntent.kind !== 'printing-family' || !themeIntent.printingFamily) {
    return {
      effectiveOptions: options,
      themeIntent,
      effectivePrintingFamily: options.printingFamily ?? null,
      failure: null,
    };
  }

  const themePolicy = await resolvePrintingPolicyV08({
    printingFamily: themeIntent.printingFamily,
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
        effectiveOptions: options,
        themeIntent,
        effectivePrintingFamily: options.printingFamily,
        failure: {
          status: 'neutral-theme-constraint-conflict',
          guidance: `Theme ${themeIntent.canonicalLabel ?? themeIntent.original} conflicts with printingFamily=${options.printingFamily}.`,
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
      effectiveOptions: options,
      themeIntent,
      effectivePrintingFamily: themeIntent.printingFamily,
      failure: {
        status: 'neutral-theme-constraint-conflict',
        guidance: `Theme ${themeIntent.canonicalLabel ?? themeIntent.original} conflicts with allowed set codes outside that printing family: ${conflictingSets.join(', ')}.`,
      },
    };
  }

  const effectiveOptions: CommanderBuildPipelineOptionsV15 = {
    ...options,
    printingFamily: themeIntent.printingFamily,
  };
  return {
    effectiveOptions,
    themeIntent,
    effectivePrintingFamily: themeIntent.printingFamily,
    failure: null,
  };
}

function auditThemeFromEvaluationV15(
  evaluation: Awaited<ReturnType<typeof evaluateCommanderBuildV15>>,
  intent: NeutralThemeIntentV15,
  effectivePrintingFamily: string | null,
): ReturnType<typeof auditNeutralThemeV15> | null {
  const entries: Array<{ card: ScryfallCard; quantity: number; zone: 'commander' | 'main' }> = [];
  for (const entry of evaluation.parsed.commanders) {
    const card = resolveEntryCard(entry, evaluation.resolvedCards);
    if (!card) return null;
    entries.push({ card, quantity: entry.quantity, zone: 'commander' });
  }
  for (const entry of evaluation.parsed.main) {
    const card = resolveEntryCard(entry, evaluation.resolvedCards);
    if (!card) return null;
    entries.push({ card, quantity: entry.quantity, zone: 'main' });
  }
  return auditNeutralThemeV15(entries, intent, {
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    activePrintingFamily: effectivePrintingFamily,
  });
}

export async function buildCommanderThroughPipelineV15(
  commanders: ScryfallCard[],
  options: CommanderBuildPipelineOptionsV15 = {},
): Promise<Record<string, unknown>> {
  const plan = planCommanderBuildPipelineV15(commanders, options);
  if (plan.unsupportedConstraints.length > 0) {
    return {
      status: 'unsupported-constraint-combination',
      constructionIntent: 'universal-pipeline-v15',
      plan,
      guidance: `The pipeline fails closed instead of silently dropping constraints: ${plan.unsupportedConstraints.join('; ')}.`,
    };
  }

  const themeContext = await resolveThemePipelineContextV15(options);
  if (themeContext.failure) {
    return {
      ...themeContext.failure,
      constructionIntent: 'universal-pipeline-v15',
      plan,
      themeIntent: themeContext.themeIntent,
      effectivePrintingFamily: themeContext.effectivePrintingFamily,
    };
  }
  const effectiveOptions = themeContext.effectiveOptions;
  const winPackageMode = effectiveOptions.winPackageMode ?? 'auto';
  const packageDiscovery = plan.discoverWinPackages
    ? await discoverGeneralWinPackagesV15(commanders, {
        ...(effectiveOptions.printingFamily ? { printingFamily: effectiveOptions.printingFamily } : {}),
        ...(effectiveOptions.allowedSets ? { allowedSets: effectiveOptions.allowedSets } : {}),
        ...(effectiveOptions.includePromos !== undefined ? { includePromos: effectiveOptions.includePromos } : {}),
        ...(effectiveOptions.includeSpecialReleases !== undefined ? { includeSpecialReleases: effectiveOptions.includeSpecialReleases } : {}),
        ...(effectiveOptions.maxUsdPerCard !== undefined ? { maxUsdPerCard: effectiveOptions.maxUsdPerCard } : {}),
        ...(effectiveOptions.excludedCards ? { excludedCards: effectiveOptions.excludedCards } : {}),
        maxPackageCards: effectiveOptions.maxWinPackageCards ?? 3,
      })
    : null;
  const selectedPackage = packageDiscovery
    ? selectTargetAwareWinPackageV15(plan.requestedTargetBracket, packageDiscovery.candidates, packageDiscovery.selected)
    : null;
  const selectedPackages = packageDiscovery
    ? selectWinPackagePortfolioV15(
        packageDiscovery.candidates,
        selectedPackage,
        plan.minimumDistinctLibraryRoutes,
        packageDiscovery.portfolio.backupComboId,
      )
    : [];
  const primaryPackageUnavailable = winPackageMode === 'require' && !selectedPackage;
  const routePortfolioUnavailable = plan.minimumDistinctLibraryRoutes > 1
    && selectedPackages.length < plan.minimumDistinctLibraryRoutes;
  if (primaryPackageUnavailable || routePortfolioUnavailable) {
    const verificationUnavailable = packageDiscovery?.status === 'verification-unavailable'
      || (routePortfolioUnavailable && packageDiscovery?.sourceCompleteness !== 'complete');
    const portfolioFailure = routePortfolioUnavailable;
    return {
      status: verificationUnavailable
        ? portfolioFailure
          ? 'required-win-package-portfolio-verification-unavailable'
          : 'required-win-package-verification-unavailable'
        : portfolioFailure
          ? 'required-win-package-portfolio-unavailable'
          : 'required-win-package-unavailable',
      constructionIntent: 'universal-pipeline-v15',
      plan,
      themeIntent: themeContext.themeIntent,
      effectivePrintingFamily: themeContext.effectivePrintingFamily,
      packageDiscovery,
      selectedPackage,
      selectedPackages,
      guidance: portfolioFailure
        ? `At least ${plan.minimumDistinctLibraryRoutes} verified win packages with pairwise-disjoint library seed cards were required, but the completed candidate set supplied only ${selectedPackages.length}. The pipeline fails closed instead of seeding a weaker single-route result.`
        : verificationUnavailable
          ? 'A verified winning package was required, but the package-discovery source was unavailable/incomplete. The pipeline fails closed instead of claiming no package exists.'
          : 'A verified winning package was required, and a completed search found no package surviving Commander legality, exclusions, exact physical-printing checks, and the user hard per-card cap when supplied.',
    };
  }

  const mustInclude = seededMustIncludes(effectiveOptions, selectedPackages, plan.seedWinPackage);
  let built: Record<string, unknown>;
  if (plan.lane === 'neutral-themed') {
    const neutralOptions = {
      archetype: plan.archetype!,
      ...(effectiveOptions.printingFamily ? { printingFamily: effectiveOptions.printingFamily } : {}),
      ...(effectiveOptions.allowedSets ? { allowedSets: effectiveOptions.allowedSets } : {}),
      ...(effectiveOptions.includePromos !== undefined ? { includePromos: effectiveOptions.includePromos } : {}),
      ...(effectiveOptions.includeSpecialReleases !== undefined ? { includeSpecialReleases: effectiveOptions.includeSpecialReleases } : {}),
      ...(effectiveOptions.maxUsdPerCard !== undefined ? { maxUsdPerCard: effectiveOptions.maxUsdPerCard } : {}),
      ...(effectiveOptions.candidateMaxUsdPerCard !== undefined ? { candidateMaxUsdPerCard: effectiveOptions.candidateMaxUsdPerCard } : {}),
      ...(effectiveOptions.excludedCards ? { excludedCards: effectiveOptions.excludedCards } : {}),
      ...(mustInclude.length > 0 ? { mustInclude } : {}),
      ...(effectiveOptions.landCount !== undefined ? { landCount: effectiveOptions.landCount } : {}),
      ...(effectiveOptions.maxNonbasicLands !== undefined ? { maxNonbasicLands: effectiveOptions.maxNonbasicLands } : {}),
    };
    built = effectiveOptions.themeQuery?.trim()
      ? await buildNeutralThemedCommanderDeckV15(commanders.map((card) => card.name), {
          ...neutralOptions,
          themeQuery: effectiveOptions.themeQuery,
        })
      : await buildNeutralCommanderDeckV15(commanders.map((card) => card.name), neutralOptions);
  } else {
    const controlledTheme = themeContext.themeIntent?.enforceability === 'full'
      ? themeContext.themeIntent
      : null;
    const targetedOptions: DeckBuildOptionsV07 = {
      targetBracket: plan.requestedTargetBracket!,
      ...(controlledTheme?.queryClause ? {
        themeQuery: controlledTheme.queryClause,
        themeMinimumMainMatches: controlledTheme.minimumMainMatches,
      } : {}),
      ...(effectiveOptions.maxUsdPerCard !== undefined ? { maxUsdPerCard: effectiveOptions.maxUsdPerCard } : {}),
      ...(effectiveOptions.candidateMaxUsdPerCard !== undefined ? { candidateMaxUsdPerCard: effectiveOptions.candidateMaxUsdPerCard } : {}),
      ...(effectiveOptions.allowedSets ? { allowedSets: effectiveOptions.allowedSets } : {}),
      ...(effectiveOptions.printingFamily ? { printingFamily: effectiveOptions.printingFamily } : {}),
      ...(effectiveOptions.includePromos !== undefined ? { includePromos: effectiveOptions.includePromos } : {}),
      ...(effectiveOptions.includeSpecialReleases !== undefined ? { includeSpecialReleases: effectiveOptions.includeSpecialReleases } : {}),
      ...(effectiveOptions.excludedCards ? { excludedCards: effectiveOptions.excludedCards } : {}),
      ...(mustInclude.length > 0 ? { mustInclude } : {}),
      ...(effectiveOptions.landCount !== undefined ? { landCount: effectiveOptions.landCount } : {}),
      ...(effectiveOptions.maxNonbasicLands !== undefined ? { maxNonbasicLands: effectiveOptions.maxNonbasicLands } : {}),
    };
    built = await buildCommanderDeckDraftV07(commanders, targetedOptions);
  }

  const decklist = typeof built.decklist === 'string' ? built.decklist : '';
  if (!decklist.trim()) {
    const themedNeutralFailure = plan.lane === 'neutral-themed'
      && Boolean(effectiveOptions.themeQuery?.trim())
      && typeof built.status === 'string';
    return {
      status: themedNeutralFailure ? built.status : 'construction-failed-before-evaluation',
      constructionIntent: 'universal-pipeline-v15',
      plan,
      themeIntent: themeContext.themeIntent ?? built.themeIntent ?? null,
      effectivePrintingFamily: themeContext.effectivePrintingFamily,
      packageDiscovery,
      selectedPackage,
      selectedPackages,
      built,
    };
  }

  const evaluation = await evaluateCommanderBuildV15(decklist, {
    ...(effectiveOptions.printingFamily ? { printingFamily: effectiveOptions.printingFamily } : {}),
    ...(effectiveOptions.allowedSets ? { allowedSets: effectiveOptions.allowedSets } : {}),
    ...(effectiveOptions.includePromos !== undefined ? { includePromos: effectiveOptions.includePromos } : {}),
    ...(effectiveOptions.includeSpecialReleases !== undefined ? { includeSpecialReleases: effectiveOptions.includeSpecialReleases } : {}),
    ...(effectiveOptions.maxUsdPerCard !== undefined ? { maxUsdPerCard: effectiveOptions.maxUsdPerCard } : {}),
    constraintDescriptions: constraintDescriptions(effectiveOptions),
    cedhIntent: effectiveOptions.cedhIntent ?? plan.requestedTargetBracket === 5,
    competitiveMetagameEvidence: effectiveOptions.competitiveMetagameEvidence === true,
    optimizedPlanEvidence: effectiveOptions.optimizedPlanEvidence === true,
    exhibitionIntent: effectiveOptions.exhibitionIntent === true,
  });
  const achieved = evaluation.actualBracket.assessedBracket;
  const targetComparison = plan.requestedTargetBracket !== null
    ? compareRequestedBracketV15(
        plan.requestedTargetBracket,
        evaluation.actualBracket,
        evaluation.postBuildEvidence.signals,
        {
          spellbookBracketSourceStatus: evaluation.postBuildEvidence.spellbookBracketSourceStatus,
          spellbookComboSourceStatus: evaluation.postBuildEvidence.spellbookComboSourceStatus,
          comboVerificationComplete: evaluation.postBuildEvidence.comboVerificationComplete,
        },
      )
    : null;
  const seededPackageVerifiedInFinalDeck = selectedPackage !== null
    && plan.seedWinPackage
    && evaluation.postBuildEvidence.verifiedWinningComboIds.includes(selectedPackage.comboId);
  const seededPackagesVerifiedInFinalDeck = selectedPackages.length > 0
    && plan.seedWinPackage
    && selectedPackages.every((selected) => evaluation.postBuildEvidence.verifiedWinningComboIds.includes(selected.comboId));
  const finalWinRoutePortfolio = evaluation.finalWinRouteAudit.portfolio;
  const winPackagePortfolioSatisfied = plan.minimumDistinctLibraryRoutes <= 1
    ? !plan.seedWinPackage || (
        selectedPackages.length >= 1
        && seededPackagesVerifiedInFinalDeck
        && finalWinRoutePortfolio.distinctLibraryRouteCount >= 1
      )
    : (
        selectedPackages.length >= plan.minimumDistinctLibraryRoutes
        && seededPackagesVerifiedInFinalDeck
        && finalWinRoutePortfolio.distinctLibraryRouteCount >= plan.minimumDistinctLibraryRoutes
      );
  const requiredPackageVerificationFailed = winPackageMode === 'require'
    && (!selectedPackage || !seededPackageVerifiedInFinalDeck);
  const requiredWinPackagePortfolioFailed = plan.minimumDistinctLibraryRoutes > 1
    && !winPackagePortfolioSatisfied;
  const themeRequested = themeContext.themeIntent !== null;
  const builtThemeAudit = built.themeAudit && typeof built.themeAudit === 'object'
    ? built.themeAudit as { satisfied?: boolean; status?: string }
    : null;
  const evaluatedThemeAudit = !builtThemeAudit && themeContext.themeIntent
    ? auditThemeFromEvaluationV15(evaluation, themeContext.themeIntent, themeContext.effectivePrintingFamily)
    : null;
  const themeAudit = builtThemeAudit ?? evaluatedThemeAudit;
  const themeConstraintSatisfied = !themeRequested || themeAudit?.satisfied === true;
  const status = !evaluation.hardGatesPassed
    ? 'built-but-hard-gates-failed'
    : !themeConstraintSatisfied
      ? 'built-but-theme-gate-failed'
      : requiredPackageVerificationFailed
        ? 'required-win-package-not-verified-in-final-deck'
        : requiredWinPackagePortfolioFailed
          ? 'required-win-package-portfolio-not-verified-in-final-deck'
          : 'complete-evaluated-build';

  return {
    status,
    constructionIntent: 'universal-pipeline-v15',
    plan,
    themeIntent: themeContext.themeIntent ?? built.themeIntent ?? null,
    effectivePrintingFamily: themeContext.effectivePrintingFamily,
    stages: {
      constraintsNormalized: true,
      commanderStrategyInferred: true,
      winPackageDiscoveryAttempted: plan.discoverWinPackages,
      winPackageDiscoveryComplete: packageDiscovery?.sourceCompleteness === 'complete',
      winPackagesDiscovered: plan.discoverWinPackages,
      winPackageSeeded: selectedPackage !== null && plan.seedWinPackage,
      winPackagePortfolioSeeded: selectedPackages.length >= plan.minimumDistinctLibraryRoutes && plan.seedWinPackage,
      deckConstructed: true,
      hardTruthEvaluationCompleted: true,
      exactPerCardBudgetVerified: evaluation.perCardBudgetAudit.satisfied,
      themeConstraintEvaluated: themeRequested ? themeAudit !== null : true,
      themeConstraintSatisfied,
      actualBracketAssessedAfterConstruction: true,
      targetComparedAfterAssessment: targetComparison !== null,
    },
    packageDiscovery,
    selectedPackage,
    selectedPackages,
    minimumDistinctLibraryRoutes: plan.minimumDistinctLibraryRoutes,
    seededPackageIds: plan.seedWinPackage ? selectedPackages.map((selected) => selected.comboId) : [],
    seededPackageCount: plan.seedWinPackage ? selectedPackages.length : 0,
    seededPackageVerifiedInFinalDeck,
    seededPackagesVerifiedInFinalDeck,
    winPackagePortfolioSatisfied,
    finalWinRoutePortfolio,
    built,
    evaluation,
    perCardBudgetAudit: evaluation.perCardBudgetAudit,
    themeAudit,
    themeConstraintSatisfied,
    requestedTargetBracket: plan.requestedTargetBracket,
    achievedBracket: achieved,
    achievedBand: evaluation.actualBracket.assessedBand,
    bracketConfidence: evaluation.actualBracket.confidence,
    targetGap: targetComparison?.targetGap ?? null,
    targetComparison,
    ceilingExplanation: targetComparison?.whatWouldReachTarget ?? [],
    ...(requiredPackageVerificationFailed ? {
      guidance: evaluation.postBuildEvidence.comboVerificationComplete
        ? 'A winning package was required and seeded, but the exact selected Spellbook combo ID was not verified in the final 100-card deck.'
        : 'A winning package was required and seeded, but final combo verification was unavailable. The pipeline fails closed rather than claiming the required package survived.',
    } : {}),
    ...(requiredWinPackagePortfolioFailed ? {
      guidance: evaluation.finalWinRouteAudit.comboVerificationComplete
        ? `The caller required at least ${plan.minimumDistinctLibraryRoutes} distinct library win routes, but the finished deck verified only ${finalWinRoutePortfolio.distinctLibraryRouteCount}. The pipeline fails closed rather than claiming route redundancy from unverified or overlapping packages.`
        : 'The caller required multiple distinct library win routes, but final combo verification was unavailable. The pipeline fails closed rather than claiming route redundancy.',
    } : {}),
    ...(!themeConstraintSatisfied ? {
      guidance: `The finished deck did not satisfy the independently audited theme constraint${themeAudit?.status ? ` (${themeAudit.status})` : ''}. The pipeline fails closed rather than silently ignoring the requested theme.`,
    } : {}),
  };
}
