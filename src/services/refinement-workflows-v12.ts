import { buildCommanderThroughPipelineV15 } from './commander-build-pipeline-v15.js';
import type { DeckBuildOptionsV07 } from './deck-builder-v07.js';
import {
  refineCommanderDeckIterativelyV12,
  type IterativeRefinementOptionsV12,
} from './optimizer-v12.js';
import type { RefinementDetailLevelV11 } from './optimizer-v11.js';
import { fetchPreconDeckV10, summarizePreconEntryV10 } from './precons-v10.js';
import { getCardsByNames } from './scryfall.js';

export interface RefinePreconOptionsV12 extends Omit<IterativeRefinementOptionsV12, 'detailLevel'> {
  reference: string;
  detailLevel?: RefinementDetailLevelV11;
}

export interface BuildAndRefineOptionsV12 extends DeckBuildOptionsV07 {
  maxRefinementRounds?: number;
  maxRefinementSwaps?: number;
  swapsPerRound?: number;
  candidatePackagesPerRound?: number;
  minimumImprovementScore?: number;
  maxPostDraftUpgradeUsd?: number;
  simulationIterations?: number;
  simulationTurns?: number;
  seed?: number;
  detailLevel?: RefinementDetailLevelV11;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function refinePreconIterativelyV12(options: RefinePreconOptionsV12): Promise<Record<string, unknown>> {
  const fetched = await fetchPreconDeckV10(options.reference);
  const result = await refineCommanderDeckIterativelyV12(fetched.decklist, {
    ...options,
    detailLevel: options.detailLevel ?? 'simple',
  });
  return {
    precon: summarizePreconEntryV10(fetched.entry),
    stockCommanders: (fetched.deck.commander ?? []).map((card) => card.name),
    refinement: result,
    sourceBaseline: 'MTGJSON exact stock deck',
    guidance: 'The stock precon remains the untouched baseline. Each round can compare several competing packages; only the strongest package that clears legality, printing, budget, theme, win-route preservation, and improvement checks becomes the next baseline.',
  };
}

export async function buildAndRefineCommanderDeckV12(
  commanderNames: string[],
  options: BuildAndRefineOptionsV12 = {},
): Promise<Record<string, unknown>> {
  const requested = commanderNames.map((name) => name.trim()).filter(Boolean);
  if (requested.length < 1 || requested.length > 2) throw new Error('Provide one or two Commander names.');

  const resolved = await getCardsByNames(requested);
  if (resolved.notFound.length > 0 || resolved.cards.length !== requested.length) {
    return {
      status: 'commander-resolution-failed',
      requestedCommanders: requested,
      unresolvedCommanders: resolved.notFound,
    };
  }

  // This inherited V0.12 entry point now delegates its first draft to the existing V0.15 universal
  // pipeline. That keeps the public workflow while ensuring raw theme text, physical printings,
  // compact win packages, exact card count, legality and requested-vs-achieved bracket truth are
  // handled by the same modern Build boundary before refinement begins.
  const initialBuild = await buildCommanderThroughPipelineV15(resolved.cards, {
    targetBracket: options.targetBracket ?? 4,
    winPackageMode: 'auto',
    ...(options.themeQuery ? { themeQuery: options.themeQuery } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    ...(options.candidateMaxUsdPerCard !== undefined ? { candidateMaxUsdPerCard: options.candidateMaxUsdPerCard } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
    ...(options.mustInclude ? { mustInclude: options.mustInclude } : {}),
    ...(options.landCount !== undefined ? { landCount: options.landCount } : {}),
    ...(options.maxNonbasicLands !== undefined ? { maxNonbasicLands: options.maxNonbasicLands } : {}),
  });
  const draft = asRecord(initialBuild.built);
  const draftDecklist = typeof draft.decklist === 'string' ? draft.decklist : '';
  if (initialBuild.status !== 'complete-evaluated-build' || !draftDecklist) {
    return {
      status: 'incomplete-first-draft',
      requestedCommanders: requested,
      initialBuild,
      guidance: 'The V0.15 first-draft pipeline could not satisfy every hard truth/theme/printing/card-count gate, so refinement did not bypass those constraints.',
    };
  }

  const protectedCards = [...new Set(options.mustInclude ?? [])];
  const refinement = await refineCommanderDeckIterativelyV12(draftDecklist, {
    ...(options.targetBracket !== undefined ? { targetBracket: options.targetBracket } : { targetBracket: 4 }),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    ...(options.maxPostDraftUpgradeUsd !== undefined ? { maxTotalUsd: options.maxPostDraftUpgradeUsd } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.themeQuery ? { themeQuery: options.themeQuery } : {}),
    excludedCards: options.excludedCards ?? [],
    protectedCards,
    ...(options.packageAcceptanceContract !== undefined
      ? { packageAcceptanceContract: options.packageAcceptanceContract }
      : {}),
    maxSwaps: options.maxRefinementSwaps ?? 12,
    maxRounds: options.maxRefinementRounds ?? 3,
    swapsPerRound: options.swapsPerRound ?? 4,
    candidatePackagesPerRound: options.candidatePackagesPerRound ?? 3,
    minimumImprovementScore: options.minimumImprovementScore ?? 0.1,
    simulationIterations: options.simulationIterations ?? 750,
    simulationTurns: options.simulationTurns ?? 7,
    seed: options.seed ?? 20_260_816,
    detailLevel: options.detailLevel ?? 'simple',
  });

  const evaluation = asRecord(initialBuild.evaluation);
  const commanderRules = asRecord(evaluation.commanderRules);
  return {
    status: 'built-and-refined',
    requestedCommanders: requested,
    initialDraft: options.detailLevel === 'detailed' ? initialBuild : {
      status: initialBuild.status,
      constructionLane: asRecord(initialBuild.plan).lane ?? null,
      targetBracket: initialBuild.requestedTargetBracket ?? options.targetBracket ?? 4,
      achievedBracket: initialBuild.achievedBracket ?? null,
      achievedBand: initialBuild.achievedBand ?? null,
      cardCount: draft.cardCount ?? null,
      selectedPrintingEstimatedUsd: draft.selectedPrintingEstimatedUsd ?? null,
      commanderRules,
      themeConstraintSatisfied: initialBuild.themeConstraintSatisfied ?? null,
      seededPackageVerifiedInFinalDeck: initialBuild.seededPackageVerifiedInFinalDeck ?? null,
    },
    refinement,
    budgetMeaning: {
      maxUsdPerCard: options.maxUsdPerCard ?? null,
      maxPostDraftUpgradeUsd: options.maxPostDraftUpgradeUsd ?? null,
      explanation: 'maxUsdPerCard applies to each candidate physical printing. maxPostDraftUpgradeUsd caps the accepted refinement swaps after the V0.15-verified first draft; it is not presented as a full-deck purchase budget.',
    },
    guidance: 'The first draft now passes through the V0.15 universal Build truth/theme boundary. Use the refined list when the competing-package optimizer accepts improvements; if no package clears legality, theme, route-preservation, printing, budget and improvement checks, keep the verified first draft instead of forcing changes.',
  };
}
