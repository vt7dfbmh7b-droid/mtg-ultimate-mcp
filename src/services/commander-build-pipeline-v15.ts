import type { ScryfallCard } from '../types/scryfall.js';
import { evaluateCommanderBuildV15 } from './commander-build-evaluation-v15.js';
import { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';
import { discoverGeneralWinPackagesV15, type GeneralWinPackageCandidateV15 } from './general-win-package-v15.js';
import { inferNeutralStrategyV15, type NeutralArchetypeV15 } from './neutral-commander-selection-v15.js';
import { buildNeutralCommanderDeckV15 } from './neutral-deck-builder-v15.js';
import type { PrintingPolicyInputV08 } from './printing-policy-v08.js';

export type WinPackageModeV15 = 'auto' | 'prefer' | 'require' | 'forbid';
export type CommanderBuildLaneV15 = 'neutral-themed' | 'targeted-v07';

export interface CommanderBuildPipelineOptionsV15 extends PrintingPolicyInputV08 {
  targetBracket?: number;
  archetype?: NeutralArchetypeV15;
  winPackageMode?: WinPackageModeV15;
  maxWinPackageCards?: number;
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
  unsupportedConstraints: string[];
}

function normalizeNames(values: string[]): string[] {
  return [...new Map(values.map((value) => [value.trim().toLocaleLowerCase(), value.trim()])).values()].filter(Boolean);
}

function boundedTarget(value: number | undefined): number | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value)) throw new Error('targetBracket must be finite when supplied.');
  return Math.max(1, Math.min(5, Math.trunc(value)));
}

export function planCommanderBuildPipelineV15(
  commanders: readonly ScryfallCard[],
  options: CommanderBuildPipelineOptionsV15 = {},
): CommanderBuildPipelinePlanV15 {
  if (commanders.length < 1 || commanders.length > 2) throw new Error('Universal Commander build planning requires one or two resolved commanders.');
  const target = boundedTarget(options.targetBracket);
  const mode = options.winPackageMode ?? 'auto';
  const discoverWinPackages = mode !== 'forbid';
  const seedWinPackage = mode === 'require'
    || mode === 'prefer'
    || (mode === 'auto' && target !== null && target >= 4);

  if (target !== null) {
    return {
      lane: 'targeted-v07',
      requestedTargetBracket: target,
      archetype: null,
      discoverWinPackages,
      seedWinPackage,
      unsupportedConstraints: [],
    };
  }

  const unsupportedConstraints: string[] = [];
  if (!options.printingFamily && (options.allowedSets ?? []).length === 0) {
    unsupportedConstraints.push('unbounded neutral card pool');
  }
  if (options.maxUsdPerCard !== undefined || options.candidateMaxUsdPerCard !== undefined) {
    unsupportedConstraints.push('neutral per-card budget enforcement');
  }
  if (options.themeQuery?.trim()) unsupportedConstraints.push('neutral free-form theme query');
  const archetype = options.archetype ?? inferNeutralStrategyV15(commanders)[0]!.archetype;
  return {
    lane: 'neutral-themed',
    requestedTargetBracket: null,
    archetype,
    discoverWinPackages,
    seedWinPackage,
    unsupportedConstraints,
  };
}

function constraintDescriptions(options: CommanderBuildPipelineOptionsV15): string[] {
  const constraints: string[] = [];
  if (options.printingFamily) constraints.push(`${options.printingFamily} physical printings only.`);
  if ((options.allowedSets ?? []).length > 0) constraints.push(`Allowed physical sets: ${(options.allowedSets ?? []).join(', ')}.`);
  if (options.maxUsdPerCard !== undefined) constraints.push(`Maximum USD reference price per card: ${options.maxUsdPerCard}.`);
  if ((options.excludedCards ?? []).length > 0) constraints.push(`Excluded cards: ${(options.excludedCards ?? []).join(', ')}.`);
  if ((options.mustInclude ?? []).length > 0) constraints.push(`Must-include cards: ${(options.mustInclude ?? []).join(', ')}.`);
  return constraints;
}

function seededMustIncludes(
  options: CommanderBuildPipelineOptionsV15,
  selected: GeneralWinPackageCandidateV15 | null,
  seedPackage: boolean,
): string[] {
  const original = options.mustInclude ?? [];
  return normalizeNames([...original, ...(seedPackage && selected ? selected.seedNames : [])]);
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

  const winPackageMode = options.winPackageMode ?? 'auto';
  const packageDiscovery = plan.discoverWinPackages
    ? await discoverGeneralWinPackagesV15(commanders, {
        ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
        ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
        ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
        ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
        ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
        ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
        maxPackageCards: options.maxWinPackageCards ?? 3,
      })
    : null;
  const selectedPackage = packageDiscovery?.selected ?? null;
  if (winPackageMode === 'require' && !selectedPackage) {
    return {
      status: 'required-win-package-unavailable',
      constructionIntent: 'universal-pipeline-v15',
      plan,
      packageDiscovery,
      guidance: 'A verified winning package was required, but no package survived Commander legality, exclusions, and exact physical-printing checks.',
    };
  }

  const mustInclude = seededMustIncludes(options, selectedPackage, plan.seedWinPackage);
  let built: Record<string, unknown>;
  if (plan.lane === 'neutral-themed') {
    built = await buildNeutralCommanderDeckV15(commanders.map((card) => card.name), {
      archetype: plan.archetype!,
      ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
      ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
      ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
      ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
      ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
      ...(mustInclude.length > 0 ? { mustInclude } : {}),
      ...(options.landCount !== undefined ? { landCount: options.landCount } : {}),
      ...(options.maxNonbasicLands !== undefined ? { maxNonbasicLands: options.maxNonbasicLands } : {}),
    });
  } else {
    const targetedOptions: DeckBuildOptionsV07 = {
      targetBracket: plan.requestedTargetBracket!,
      ...(options.themeQuery ? { themeQuery: options.themeQuery } : {}),
      ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
      ...(options.candidateMaxUsdPerCard !== undefined ? { candidateMaxUsdPerCard: options.candidateMaxUsdPerCard } : {}),
      ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
      ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
      ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
      ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
      ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
      ...(mustInclude.length > 0 ? { mustInclude } : {}),
      ...(options.landCount !== undefined ? { landCount: options.landCount } : {}),
      ...(options.maxNonbasicLands !== undefined ? { maxNonbasicLands: options.maxNonbasicLands } : {}),
    };
    built = await buildCommanderDeckDraftV07(commanders, targetedOptions);
  }

  const decklist = typeof built.decklist === 'string' ? built.decklist : '';
  if (!decklist.trim()) {
    return {
      status: 'construction-failed-before-evaluation',
      constructionIntent: 'universal-pipeline-v15',
      plan,
      packageDiscovery,
      selectedPackage,
      built,
    };
  }

  const evaluation = await evaluateCommanderBuildV15(decklist, {
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    constraintDescriptions: constraintDescriptions(options),
    cedhIntent: options.cedhIntent ?? plan.requestedTargetBracket === 5,
    competitiveMetagameEvidence: options.competitiveMetagameEvidence === true,
    optimizedPlanEvidence: options.optimizedPlanEvidence === true,
    exhibitionIntent: options.exhibitionIntent === true,
  });
  const achieved = evaluation.actualBracket.assessedBracket;
  const targetGap = plan.requestedTargetBracket === null || achieved === null
    ? null
    : plan.requestedTargetBracket - achieved;
  const seededPackageVerifiedInFinalDeck = selectedPackage !== null
    && plan.seedWinPackage
    && evaluation.postBuildEvidence.verifiedWinningCombos > 0;

  return {
    status: evaluation.actualBracket.hardGatesPassed ? 'complete-evaluated-build' : 'built-but-hard-gates-failed',
    constructionIntent: 'universal-pipeline-v15',
    plan,
    stages: {
      constraintsNormalized: true,
      commanderStrategyInferred: plan.archetype !== null,
      winPackagesDiscovered: plan.discoverWinPackages,
      winPackageSeeded: selectedPackage !== null && plan.seedWinPackage,
      deckConstructed: true,
      hardTruthEvaluationCompleted: true,
      actualBracketAssessedAfterConstruction: true,
    },
    packageDiscovery,
    selectedPackage,
    seededPackageVerifiedInFinalDeck,
    built,
    evaluation,
    requestedTargetBracket: plan.requestedTargetBracket,
    achievedBracket: achieved,
    achievedBand: evaluation.actualBracket.assessedBand,
    bracketConfidence: evaluation.actualBracket.confidence,
    targetGap,
    ceilingExplanation: plan.requestedTargetBracket !== null && achieved !== null && achieved < plan.requestedTargetBracket
      ? evaluation.actualBracket.bracket5ThresholdChecks.filter((check) => !check.passed).map((check) => check.pressurePoint)
      : [],
  };
}
