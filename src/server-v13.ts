import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { createMtgServerV12 } from './server-v12.js';
import { getUsdNzdRateV13, nzCurrencyPolicyV13 } from './services/currency-v13.js';
import { priceCardNzdV13 } from './services/pricing-v13.js';
import {
  buildAndRefineCommanderDeckNzdV13,
  refineCommanderDeckNzdV13,
  refinePreconNzdV13,
} from './services/refinement-workflows-v13.js';

const jsonResult = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const errorResult = (error: unknown) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }],
  isError: true,
});

const detailLevel = z.enum(['simple', 'standard', 'detailed']).optional().default('simple');
const refinementComponentMatcher = z.object({
  requiredRoles: z.array(z.string().min(1).max(100)).max(20).optional(),
  anyRoles: z.array(z.string().min(1).max(100)).max(20).optional(),
  requireNonland: z.boolean().optional(),
  requireNoncreature: z.boolean().optional(),
  minManaValue: z.number().min(0).max(30).optional(),
  maxManaValue: z.number().min(0).max(30).optional(),
  countXAsAtLeastManaValue: z.number().min(0).max(30).optional(),
});
const refinementComponent = z.object({
  id: z.string().min(1).max(120),
  minimumCount: z.number().int().min(0).max(100),
  matcher: refinementComponentMatcher,
  zone: z.enum(['main', 'all']).optional(),
});
const packageAcceptanceContract = z.object({
  strategyFuel: z.array(refinementComponent).max(20).optional(),
  structuralFloors: z.array(refinementComponent).max(20).optional(),
});
const printingFields = {
  printingFamily: z.string().min(1).max(120).optional(),
  allowedSets: z.array(z.string().min(2).max(12)).max(50).optional().default([]),
  includePromos: z.boolean().optional().default(true),
  includeSpecialReleases: z.boolean().optional().default(true),
};
const refinementFields = {
  targetBracket: z.number().int().min(1).max(5).optional(),
  maxNzdPerCard: z.number().positive().max(200_000).optional(),
  maxTotalNzd: z.number().positive().max(2_000_000).optional(),
  maxSwaps: z.number().int().min(1).max(30).optional(),
  maxRounds: z.number().int().min(1).max(5).optional(),
  swapsPerRound: z.number().int().min(1).max(8).optional(),
  candidatePackagesPerRound: z.number().int().min(1).max(6).optional().default(3),
  minimumImprovementScore: z.number().min(-10).max(100).optional(),
  themeQuery: z.string().min(1).max(500).optional(),
  excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
  protectedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
  simulationIterations: z.number().int().min(100).max(5_000).optional(),
  simulationTurns: z.number().int().min(3).max(12).optional(),
  seed: z.number().int().min(1).max(2_147_483_647).optional(),
  detailLevel,
  packageAcceptanceContract: packageAcceptanceContract.optional(),
  ...printingFields,
};

const preconProfile = z.enum(['light', 'balanced', 'strong', 'optimized', 'custom']).optional().default('balanced');
type PreconProfileV13 = 'light' | 'balanced' | 'strong' | 'optimized' | 'custom';

function profileDefaultsNzd(profile: PreconProfileV13): Record<string, number> {
  if (profile === 'light') return { targetBracket: 2, maxNzdPerCard: 10, maxSwaps: 5, maxRounds: 2, swapsPerRound: 3, candidatePackagesPerRound: 2 };
  if (profile === 'balanced') return { targetBracket: 3, maxNzdPerCard: 20, maxSwaps: 10, maxRounds: 3, swapsPerRound: 4, candidatePackagesPerRound: 3 };
  if (profile === 'strong') return { targetBracket: 4, maxNzdPerCard: 35, maxSwaps: 15, maxRounds: 4, swapsPerRound: 4, candidatePackagesPerRound: 4 };
  if (profile === 'optimized') return { targetBracket: 4, maxSwaps: 20, maxRounds: 5, swapsPerRound: 5, candidatePackagesPerRound: 5 };
  return {};
}

function numberOr(input: number | undefined, fallback: unknown, defaultValue: number): number {
  return input ?? (typeof fallback === 'number' ? fallback : defaultValue);
}

export function registerMtgToolsV13(server: McpServer): McpServer {
  server.registerTool(
    'pricing_policy_v13',
    {
      title: 'Show NZD-first MTG pricing policy',
      description: 'Show the current USD→NZD reference rate and the pricing rules used by MTG Ultimate. NZD is the primary display/budget currency; direct New Zealand prices take priority over converted international references when available.',
      inputSchema: z.object({ forceRefresh: z.boolean().optional().default(false) }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ forceRefresh }) => {
      try {
        const rate = await getUsdNzdRateV13(forceRefresh);
        return jsonResult(nzCurrencyPolicyV13(rate));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'price_card_nzd_v13',
    {
      title: 'Price an MTG printing in NZD',
      description: 'Return NZ$ prices first for a card or exact set/collector printing. Converted Scryfall USD prices are clearly marked as references; a directly checked New Zealand listing should take priority.',
      inputSchema: z.object({
        cardName: z.string().min(1).max(256).optional(),
        set: z.string().min(2).max(12).optional(),
        collectorNumber: z.string().min(1).max(32).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await priceCardNzdV13(input));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'refine_commander_deck_v13',
    {
      title: 'Refine a Commander deck with NZD budgets',
      description: 'Iteratively refine a legal Commander deck using NZD as the primary budget/display currency. USD is only retained as a source reference for markets such as Scryfall.',
      inputSchema: z.object({ decklist: z.string().min(1).max(100_000), ...refinementFields }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await refineCommanderDeckNzdV13(input.decklist, {
          ...(input.targetBracket !== undefined ? { targetBracket: input.targetBracket } : {}),
          ...(input.maxNzdPerCard !== undefined ? { maxNzdPerCard: input.maxNzdPerCard } : {}),
          ...(input.maxTotalNzd !== undefined ? { maxTotalNzd: input.maxTotalNzd } : {}),
          ...(input.maxSwaps !== undefined ? { maxSwaps: input.maxSwaps } : {}),
          ...(input.maxRounds !== undefined ? { maxRounds: input.maxRounds } : {}),
          ...(input.swapsPerRound !== undefined ? { swapsPerRound: input.swapsPerRound } : {}),
          candidatePackagesPerRound: input.candidatePackagesPerRound,
          ...(input.minimumImprovementScore !== undefined ? { minimumImprovementScore: input.minimumImprovementScore } : {}),
          ...(input.themeQuery ? { themeQuery: input.themeQuery } : {}),
           ...(input.packageAcceptanceContract ? { packageAcceptanceContract: input.packageAcceptanceContract } : {}),
          excludedCards: input.excludedCards,
          protectedCards: input.protectedCards,
          ...(input.simulationIterations !== undefined ? { simulationIterations: input.simulationIterations } : {}),
          ...(input.simulationTurns !== undefined ? { simulationTurns: input.simulationTurns } : {}),
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
          detailLevel: input.detailLevel,
          ...(input.printingFamily ? { printingFamily: input.printingFamily } : {}),
          allowedSets: input.allowedSets,
          includePromos: input.includePromos,
          includeSpecialReleases: input.includeSpecialReleases,
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'refine_precon_v13',
    {
      title: 'Upgrade any Commander precon with NZD pricing',
      description: 'Start from the exact stock precon and refine it using NZ$ budgets and NZD-first output. Strong defaults use NZ$35 per card unless the user supplies a different NZD cap.',
      inputSchema: z.object({ reference: z.string().min(1).max(500), profile: preconProfile, ...refinementFields }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        const defaults = profileDefaultsNzd(input.profile);
        return jsonResult(await refinePreconNzdV13({
          reference: input.reference,
          targetBracket: numberOr(input.targetBracket, defaults.targetBracket, 3),
          ...(input.maxNzdPerCard !== undefined
            ? { maxNzdPerCard: input.maxNzdPerCard }
            : typeof defaults.maxNzdPerCard === 'number' ? { maxNzdPerCard: defaults.maxNzdPerCard } : {}),
          ...(input.maxTotalNzd !== undefined ? { maxTotalNzd: input.maxTotalNzd } : {}),
          maxSwaps: numberOr(input.maxSwaps, defaults.maxSwaps, 12),
          maxRounds: numberOr(input.maxRounds, defaults.maxRounds, 3),
          swapsPerRound: numberOr(input.swapsPerRound, defaults.swapsPerRound, 4),
          candidatePackagesPerRound: numberOr(input.candidatePackagesPerRound, defaults.candidatePackagesPerRound, 3),
          ...(input.minimumImprovementScore !== undefined ? { minimumImprovementScore: input.minimumImprovementScore } : {}),
          ...(input.themeQuery ? { themeQuery: input.themeQuery } : {}),
           ...(input.packageAcceptanceContract ? { packageAcceptanceContract: input.packageAcceptanceContract } : {}),
          excludedCards: input.excludedCards,
          protectedCards: input.protectedCards,
          ...(input.simulationIterations !== undefined ? { simulationIterations: input.simulationIterations } : {}),
          ...(input.simulationTurns !== undefined ? { simulationTurns: input.simulationTurns } : {}),
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
          detailLevel: input.detailLevel,
          ...(input.printingFamily ? { printingFamily: input.printingFamily } : {}),
          allowedSets: input.allowedSets,
          includePromos: input.includePromos,
          includeSpecialReleases: input.includeSpecialReleases,
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'build_and_refine_commander_deck_v13',
    {
      title: 'Build and refine a Commander deck with NZD pricing',
      description: 'Build a legal Commander deck from scratch and refine it while using NZD for per-card and post-draft upgrade budgets. Exact printing restrictions remain active.',
      inputSchema: z.object({
        commanderNames: z.array(z.string().min(1).max(256)).min(1).max(2),
        targetBracket: z.number().int().min(1).max(5).optional().default(4),
        themeQuery: z.string().min(1).max(500).optional(),
        maxNzdPerCard: z.number().positive().max(200_000).optional(),
        maxPostDraftUpgradeNzd: z.number().positive().max(2_000_000).optional(),
        excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        mustInclude: z.array(z.string().min(1).max(256)).max(100).optional().default([]),
        landCount: z.number().int().min(26).max(44).optional(),
        maxNonbasicLands: z.number().int().min(0).max(44).optional(),
        maxRefinementRounds: z.number().int().min(1).max(5).optional().default(3),
        maxRefinementSwaps: z.number().int().min(1).max(30).optional().default(12),
        swapsPerRound: z.number().int().min(1).max(8).optional().default(4),
        candidatePackagesPerRound: z.number().int().min(1).max(6).optional().default(3),
        minimumImprovementScore: z.number().min(-10).max(100).optional().default(0.1),
        simulationIterations: z.number().int().min(100).max(5_000).optional().default(750),
        simulationTurns: z.number().int().min(3).max(12).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
        detailLevel,
        packageAcceptanceContract: packageAcceptanceContract.optional(),
        ...printingFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await buildAndRefineCommanderDeckNzdV13(input.commanderNames, {
          targetBracket: input.targetBracket,
          ...(input.themeQuery ? { themeQuery: input.themeQuery } : {}),
           ...(input.packageAcceptanceContract ? { packageAcceptanceContract: input.packageAcceptanceContract } : {}),
          ...(input.maxNzdPerCard !== undefined ? { maxNzdPerCard: input.maxNzdPerCard } : {}),
          ...(input.maxPostDraftUpgradeNzd !== undefined ? { maxPostDraftUpgradeNzd: input.maxPostDraftUpgradeNzd } : {}),
          excludedCards: input.excludedCards,
          mustInclude: input.mustInclude,
          ...(input.landCount !== undefined ? { landCount: input.landCount } : {}),
          ...(input.maxNonbasicLands !== undefined ? { maxNonbasicLands: input.maxNonbasicLands } : {}),
          maxRefinementRounds: input.maxRefinementRounds,
          maxRefinementSwaps: input.maxRefinementSwaps,
          swapsPerRound: input.swapsPerRound,
          candidatePackagesPerRound: input.candidatePackagesPerRound,
          minimumImprovementScore: input.minimumImprovementScore,
          simulationIterations: input.simulationIterations,
          simulationTurns: input.simulationTurns,
          seed: input.seed,
          detailLevel: input.detailLevel,
          ...(input.printingFamily ? { printingFamily: input.printingFamily } : {}),
          allowedSets: input.allowedSets,
          includePromos: input.includePromos,
          includeSpecialReleases: input.includeSpecialReleases,
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

export function createMtgServerV13(): McpServer {
  return registerMtgToolsV13(createMtgServerV12());
}
