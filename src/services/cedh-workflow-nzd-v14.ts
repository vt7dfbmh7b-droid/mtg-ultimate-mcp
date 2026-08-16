import { completeBestCedhComboV14, type CedhComboCompletionOptionsV14 } from './cedh-combo-completion-v14.js';
import {
  getUsdNzdRateV13,
  nzdToUsdV13,
  withNzdPricingV13,
} from './currency-v13.js';
import {
  assessCedhReadinessV14,
  buildCommanderForCedhV14,
  refineCommanderForCedhV14,
  type BuildCedhOptionsV14,
  type CedhWorkflowOptionsV14,
} from './cedh-workflow-v14.js';

export interface CedhNzdBudgetOptionsV14 {
  maxNzdPerCard?: number;
}

function usdCap(maxNzdPerCard: number | undefined, rate: number): number | undefined {
  return maxNzdPerCard === undefined ? undefined : nzdToUsdV13(maxNzdPerCard, rate);
}

export async function completeBestCedhComboNzdV14(
  decklist: string,
  options: CedhComboCompletionOptionsV14 & CedhNzdBudgetOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const rate = await getUsdNzdRateV13();
  const maxUsdPerCard = usdCap(options.maxNzdPerCard, rate.rate);
  const result = await completeBestCedhComboV14(decklist, {
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(maxUsdPerCard !== undefined ? { maxUsdPerCard } : {}),
    ...(options.protectedCards ? { protectedCards: options.protectedCards } : {}),
    ...(options.maxMissingCards !== undefined ? { maxMissingCards: options.maxMissingCards } : {}),
    ...(options.maxCandidatesToVerify !== undefined ? { maxCandidatesToVerify: options.maxCandidatesToVerify } : {}),
  });
  return withNzdPricingV13(result, rate, {
    maxNzdPerCard: options.maxNzdPerCard ?? null,
  });
}

export async function refineCommanderForCedhNzdV14(
  decklist: string,
  options: CedhWorkflowOptionsV14 & CedhNzdBudgetOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const rate = await getUsdNzdRateV13();
  const maxUsdPerCard = usdCap(options.maxNzdPerCard, rate.rate);
  const result = await refineCommanderForCedhV14(decklist, {
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(maxUsdPerCard !== undefined ? { maxUsdPerCard } : {}),
    ...(options.protectedCards ? { protectedCards: options.protectedCards } : {}),
    ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
    ...(options.maxMissingCards !== undefined ? { maxMissingCards: options.maxMissingCards } : {}),
    ...(options.maxCandidatesToVerify !== undefined ? { maxCandidatesToVerify: options.maxCandidatesToVerify } : {}),
    ...(options.maxEfficiencySwaps !== undefined ? { maxEfficiencySwaps: options.maxEfficiencySwaps } : {}),
    ...(options.maxManaBaseSwaps !== undefined ? { maxManaBaseSwaps: options.maxManaBaseSwaps } : {}),
    ...(options.requireVerifiedCombo !== undefined ? { requireVerifiedCombo: options.requireVerifiedCombo } : {}),
  });
  return withNzdPricingV13(result, rate, {
    maxNzdPerCard: options.maxNzdPerCard ?? null,
  });
}

export async function buildCommanderForCedhNzdV14(
  commanderNames: string[],
  options: BuildCedhOptionsV14 & CedhNzdBudgetOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const rate = await getUsdNzdRateV13();
  const maxUsdPerCard = usdCap(options.maxNzdPerCard, rate.rate);
  const result = await buildCommanderForCedhV14(commanderNames, {
    ...(options.themeQuery ? { themeQuery: options.themeQuery } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(maxUsdPerCard !== undefined ? { maxUsdPerCard } : {}),
    ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
    ...(options.mustInclude ? { mustInclude: options.mustInclude } : {}),
    ...(options.landCount !== undefined ? { landCount: options.landCount } : {}),
    ...(options.maxNonbasicLands !== undefined ? { maxNonbasicLands: options.maxNonbasicLands } : {}),
    ...(options.protectedCards ? { protectedCards: options.protectedCards } : {}),
    ...(options.maxMissingCards !== undefined ? { maxMissingCards: options.maxMissingCards } : {}),
    ...(options.maxCandidatesToVerify !== undefined ? { maxCandidatesToVerify: options.maxCandidatesToVerify } : {}),
    ...(options.maxEfficiencySwaps !== undefined ? { maxEfficiencySwaps: options.maxEfficiencySwaps } : {}),
    ...(options.maxManaBaseSwaps !== undefined ? { maxManaBaseSwaps: options.maxManaBaseSwaps } : {}),
    ...(options.requireVerifiedCombo !== undefined ? { requireVerifiedCombo: options.requireVerifiedCombo } : {}),
  });
  return withNzdPricingV13(result, rate, {
    maxNzdPerCard: options.maxNzdPerCard ?? null,
  });
}

export async function assessCedhReadinessNzdV14(
  decklist: string,
  options: CedhWorkflowOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const rate = await getUsdNzdRateV13();
  const result = await assessCedhReadinessV14(decklist, options);
  return withNzdPricingV13(result, rate);
}
