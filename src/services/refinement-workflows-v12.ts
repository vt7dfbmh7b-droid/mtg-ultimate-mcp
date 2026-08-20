import { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';
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
    guidance: 'The stock precon remains the untouched baseline. Each round can compare several competing packages; only the strongest package that clears legality, printing, budget, and improvement checks becomes the next baseline.',
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

  const draft = await buildCommanderDeckDraftV07(resolved.cards, options);
  if (draft.status !== 'complete-draft' || typeof draft.decklist !== 'string') {
    return {
      status: 'incomplete-first-draft',
      requestedCommanders: requested,
      draft,
      guidance: 'The first draft could not satisfy all legality/printing/card-count constraints, so refinement did not bypass those constraints.',
    };
  }

  const protectedCards = [...new Set(options.mustInclude ?? [])];
  const refinement = await refineCommanderDeckIterativelyV12(draft.decklist, {
    ...(options.targetBracket !== undefined ? { targetBracket: options.targetBracket } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    ...(options.maxPostDraftUpgradeUsd !== undefined ? { maxTotalUsd: options.maxPostDraftUpgradeUsd } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.themeQuery ? { themeQuery: options.themeQuery } : {}),
    excludedCards: options.excludedCards ?? [],
    protectedCards,
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

  return {
    status: 'built-and-refined',
    requestedCommanders: requested,
    initialDraft: options.detailLevel === 'detailed' ? draft : {
      status: draft.status,
      targetBracket: draft.targetBracket,
      cardCount: draft.cardCount,
      selectedPrintingEstimatedUsd: draft.selectedPrintingEstimatedUsd,
      commanderRules: draft.commanderRules,
      printingPolicy: draft.printingPolicy,
    },
    refinement,
    budgetMeaning: {
      maxUsdPerCard: options.maxUsdPerCard ?? null,
      maxPostDraftUpgradeUsd: options.maxPostDraftUpgradeUsd ?? null,
      explanation: 'maxUsdPerCard applies to each candidate physical printing. maxPostDraftUpgradeUsd caps the accepted refinement swaps after the initial draft; it is not presented as a full-deck purchase budget.',
    },
    guidance: 'Use the refined list when the competing-package optimizer accepted improvements. If no package clears the checks, keep the legal first draft instead of forcing changes.',
  };
}
