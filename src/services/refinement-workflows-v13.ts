import { getUsdNzdRateV13, nzdToUsdV13, withNzdPricingV13 } from './currency-v13.js';
import { refineCommanderDeckIterativelyV12, type IterativeRefinementOptionsV12 } from './optimizer-v12.js';
import {
  buildAndRefineCommanderDeckV12,
  refinePreconIterativelyV12,
  type BuildAndRefineOptionsV12,
  type RefinePreconOptionsV12,
} from './refinement-workflows-v12.js';

export interface NzdRefinementOptionsV13 extends Omit<IterativeRefinementOptionsV12, 'maxUsdPerCard' | 'maxTotalUsd'> {
  maxNzdPerCard?: number;
  maxTotalNzd?: number;
}

export interface NzdPreconRefinementOptionsV13 extends Omit<RefinePreconOptionsV12, 'maxUsdPerCard' | 'maxTotalUsd'> {
  maxNzdPerCard?: number;
  maxTotalNzd?: number;
}

export interface NzdBuildAndRefineOptionsV13 extends Omit<BuildAndRefineOptionsV12, 'maxUsdPerCard' | 'maxPostDraftUpgradeUsd'> {
  maxNzdPerCard?: number;
  maxPostDraftUpgradeNzd?: number;
}

function requestedBudget(maxNzdPerCard?: number, maxTotalNzd?: number): Record<string, unknown> {
  return {
    primaryCurrency: 'NZD',
    maxNzdPerCard: maxNzdPerCard ?? null,
    maxTotalNzd: maxTotalNzd ?? null,
  };
}

export async function refineCommanderDeckNzdV13(
  decklist: string,
  options: NzdRefinementOptionsV13 = {},
): Promise<Record<string, unknown>> {
  const rate = await getUsdNzdRateV13();
  const { maxNzdPerCard, maxTotalNzd, ...rest } = options;
  const result = await refineCommanderDeckIterativelyV12(decklist, {
    ...rest,
    ...(maxNzdPerCard !== undefined ? { maxUsdPerCard: nzdToUsdV13(maxNzdPerCard, rate.rate) } : {}),
    ...(maxTotalNzd !== undefined ? { maxTotalUsd: nzdToUsdV13(maxTotalNzd, rate.rate) } : {}),
  });
  return withNzdPricingV13(result, rate, requestedBudget(maxNzdPerCard, maxTotalNzd));
}

export async function refinePreconNzdV13(
  options: NzdPreconRefinementOptionsV13,
): Promise<Record<string, unknown>> {
  const rate = await getUsdNzdRateV13();
  const { maxNzdPerCard, maxTotalNzd, ...rest } = options;
  const result = await refinePreconIterativelyV12({
    ...rest,
    ...(maxNzdPerCard !== undefined ? { maxUsdPerCard: nzdToUsdV13(maxNzdPerCard, rate.rate) } : {}),
    ...(maxTotalNzd !== undefined ? { maxTotalUsd: nzdToUsdV13(maxTotalNzd, rate.rate) } : {}),
  });
  return withNzdPricingV13(result, rate, requestedBudget(maxNzdPerCard, maxTotalNzd));
}

export async function buildAndRefineCommanderDeckNzdV13(
  commanderNames: string[],
  options: NzdBuildAndRefineOptionsV13 = {},
): Promise<Record<string, unknown>> {
  const rate = await getUsdNzdRateV13();
  const { maxNzdPerCard, maxPostDraftUpgradeNzd, ...rest } = options;
  const result = await buildAndRefineCommanderDeckV12(commanderNames, {
    ...rest,
    ...(maxNzdPerCard !== undefined ? { maxUsdPerCard: nzdToUsdV13(maxNzdPerCard, rate.rate) } : {}),
    ...(maxPostDraftUpgradeNzd !== undefined
      ? { maxPostDraftUpgradeUsd: nzdToUsdV13(maxPostDraftUpgradeNzd, rate.rate) }
      : {}),
  });
  return withNzdPricingV13(result, rate, {
    primaryCurrency: 'NZD',
    maxNzdPerCard: maxNzdPerCard ?? null,
    maxPostDraftUpgradeNzd: maxPostDraftUpgradeNzd ?? null,
  });
}
