import { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';
import { fetchPreconDeckV10, summarizePreconEntryV10 } from './precons-v10.js';
import { getCardsByNames } from './scryfall.js';
import {
  refineCommanderDeckIterativelyV11,
  type IterativeRefinementOptionsV11,
  type RefinementDetailLevelV11,
} from './optimizer-v11.js';

export interface RefinePreconOptionsV11 extends Omit<IterativeRefinementOptionsV11, 'detailLevel'> {
  reference: string;
  detailLevel?: RefinementDetailLevelV11;
}

export interface BuildAndRefineOptionsV11 extends DeckBuildOptionsV07 {
  maxRefinementRounds?: number;
  maxRefinementSwaps?: number;
  swapsPerRound?: number;
  minimumImprovementScore?: number;
  maxPostDraftUpgradeUsd?: number;
  simulationIterations?: number;
  simulationTurns?: number;
  seed?: number;
  detailLevel?: RefinementDetailLevelV11;
}

export async function refinePreconIterativelyV11(options: RefinePreconOptionsV11): Promise<Record<string, unknown>> {
  const fetched = await fetchPreconDeckV10(options.reference);
  const result = await refineCommanderDeckIterativelyV11(fetched.decklist, {
    ...options,
    detailLevel: options.detailLevel ?? 'simple',
  });
  return {
    precon: summarizePreconEntryV10(fetched.entry),
    stockCommanders: (fetched.deck.commander ?? []).map((card) => card.name),
    refinement: result,
    sourceBaseline: 'MTGJSON exact stock deck',
    guidance: 'The stock precon is never silently rewritten before comparison. Each accepted round starts from the previous accepted full deck and must remain Commander-legal.',
  };
}

export async function buildAndRefineCommanderDeckV11(
  commanderNames: string[],
  options: BuildAndRefineOptionsV11 = {},
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
      guidance: 'The first draft could not satisfy all legality/printing/card-count constraints, so iterative refinement did not try to bypass those constraints.',
    };
  }

  const protectedCards = [...new Set([
    ...(options.mustInclude ?? []),
  ])];
  const refinement = await refineCommanderDeckIterativelyV11(draft.decklist, {
    targetBracket: options.targetBracket,
    maxUsdPerCard: options.maxUsdPerCard,
    maxTotalUsd: options.maxPostDraftUpgradeUsd,
    allowedSets: options.allowedSets,
    printingFamily: options.printingFamily,
    includePromos: options.includePromos,
    includeSpecialReleases: options.includeSpecialReleases,
    themeQuery: options.themeQuery,
    excludedCards: options.excludedCards,
    protectedCards,
    maxSwaps: options.maxRefinementSwaps ?? 12,
    maxRounds: options.maxRefinementRounds ?? 3,
    swapsPerRound: options.swapsPerRound ?? 4,
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
      explanation: 'maxUsdPerCard applies to candidate physical printings. maxPostDraftUpgradeUsd caps only the extra refinement swaps after the first draft; it is not presented as a full-deck purchase budget.',
    },
    guidance: 'Use the final refined decklist when refinement accepted improvements; if it found no supported improvement, keep the legal first draft instead of forcing changes.',
  };
}
