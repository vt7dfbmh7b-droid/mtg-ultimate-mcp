import * as z from 'zod/v4';
import { createMtgServerV10 } from './server-v10.js';
import { refineCommanderDeckIterativelyV11 } from './services/optimizer-v11.js';
import { buildAndRefineCommanderDeckV11, refinePreconIterativelyV11 } from './services/refinement-workflows-v11.js';

const jsonResult = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const errorResult = (error: unknown) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }],
  isError: true,
});

const detailLevel = z.enum(['simple', 'standard', 'detailed']).optional().default('simple');
const printingFields = {
  printingFamily: z.string().min(1).max(120).optional(),
  allowedSets: z.array(z.string().min(2).max(12)).max(50).optional().default([]),
  includePromos: z.boolean().optional().default(true),
  includeSpecialReleases: z.boolean().optional().default(true),
};
const refinementFields = {
  targetBracket: z.number().int().min(1).max(5).optional(),
  maxUsdPerCard: z.number().positive().max(100_000).optional(),
  maxTotalUsd: z.number().positive().max(1_000_000).optional(),
  maxSwaps: z.number().int().min(1).max(30).optional(),
  maxRounds: z.number().int().min(1).max(5).optional(),
  swapsPerRound: z.number().int().min(1).max(8).optional(),
  minimumImprovementScore: z.number().min(-10).max(100).optional(),
  themeQuery: z.string().min(1).max(500).optional(),
  excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
  protectedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
  simulationIterations: z.number().int().min(100).max(5_000).optional(),
  simulationTurns: z.number().int().min(3).max(12).optional(),
  seed: z.number().int().min(1).max(2_147_483_647).optional(),
  detailLevel,
  ...printingFields,
};

const preconProfile = z.enum(['light', 'balanced', 'strong', 'optimized', 'custom']).optional().default('balanced');
type PreconProfile = 'light' | 'balanced' | 'strong' | 'optimized' | 'custom';
interface ProfileDefaults {
  targetBracket?: number;
  maxUsdPerCard?: number;
  maxSwaps?: number;
  maxRounds?: number;
  swapsPerRound?: number;
}

function profileDefaults(profile: PreconProfile): ProfileDefaults {
  if (profile === 'light') return { targetBracket: 2, maxUsdPerCard: 5, maxSwaps: 5, maxRounds: 2, swapsPerRound: 3 };
  if (profile === 'balanced') return { targetBracket: 3, maxUsdPerCard: 10, maxSwaps: 10, maxRounds: 3, swapsPerRound: 4 };
  if (profile === 'strong') return { targetBracket: 4, maxUsdPerCard: 20, maxSwaps: 15, maxRounds: 4, swapsPerRound: 4 };
  if (profile === 'optimized') return { targetBracket: 4, maxSwaps: 20, maxRounds: 5, swapsPerRound: 5 };
  return {};
}

export function createMtgServerV11() {
  const server = createMtgServerV10();

  server.registerTool(
    'refine_commander_deck_v11',
    {
      title: 'Iteratively refine a Commander deck',
      description: 'Run multiple legal, printing-aware, same-seed upgrade passes on an existing Commander deck. Accepted packages are rebuilt and re-analysed before the next pass; the process stops when improvements flatten out or constraints are reached.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        ...refinementFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await refineCommanderDeckIterativelyV11(input.decklist, {
          ...(input.targetBracket !== undefined ? { targetBracket: input.targetBracket } : {}),
          ...(input.maxUsdPerCard !== undefined ? { maxUsdPerCard: input.maxUsdPerCard } : {}),
          ...(input.maxTotalUsd !== undefined ? { maxTotalUsd: input.maxTotalUsd } : {}),
          ...(input.maxSwaps !== undefined ? { maxSwaps: input.maxSwaps } : {}),
          ...(input.maxRounds !== undefined ? { maxRounds: input.maxRounds } : {}),
          ...(input.swapsPerRound !== undefined ? { swapsPerRound: input.swapsPerRound } : {}),
          ...(input.minimumImprovementScore !== undefined ? { minimumImprovementScore: input.minimumImprovementScore } : {}),
          ...(input.themeQuery ? { themeQuery: input.themeQuery } : {}),
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
    'refine_precon_v11',
    {
      title: 'Iteratively refine any Commander precon',
      description: 'Start from the exact MTGJSON stock precon and iteratively accept only supported legal upgrade packages. Supports simple upgrade profiles, total/per-card budgets, protected cards, themes and physical printing-family restrictions.',
      inputSchema: z.object({
        reference: z.string().min(1).max(500),
        profile: preconProfile,
        ...refinementFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        const defaults = profileDefaults(input.profile);
        return jsonResult(await refinePreconIterativelyV11({
          reference: input.reference,
          ...(input.targetBracket !== undefined
            ? { targetBracket: input.targetBracket }
            : defaults.targetBracket !== undefined
              ? { targetBracket: defaults.targetBracket }
              : {}),
          ...(input.maxUsdPerCard !== undefined
            ? { maxUsdPerCard: input.maxUsdPerCard }
            : defaults.maxUsdPerCard !== undefined
              ? { maxUsdPerCard: defaults.maxUsdPerCard }
              : {}),
          ...(input.maxTotalUsd !== undefined ? { maxTotalUsd: input.maxTotalUsd } : {}),
          maxSwaps: input.maxSwaps ?? defaults.maxSwaps ?? 12,
          maxRounds: input.maxRounds ?? defaults.maxRounds ?? 3,
          swapsPerRound: input.swapsPerRound ?? defaults.swapsPerRound ?? 4,
          ...(input.minimumImprovementScore !== undefined ? { minimumImprovementScore: input.minimumImprovementScore } : {}),
          ...(input.themeQuery ? { themeQuery: input.themeQuery } : {}),
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
    'build_and_refine_commander_deck_v11',
    {
      title: 'Build and refine a Commander deck from scratch',
      description: 'Create a legal first 100-card Commander draft under the requested theme, bracket, price and physical-printing restrictions, then iteratively refine that draft until further supported improvements flatten out.',
      inputSchema: z.object({
        commanderNames: z.array(z.string().min(1).max(256)).min(1).max(2),
        targetBracket: z.number().int().min(1).max(5).optional().default(4),
        themeQuery: z.string().min(1).max(500).optional(),
        maxUsdPerCard: z.number().positive().max(100_000).optional(),
        maxPostDraftUpgradeUsd: z.number().positive().max(1_000_000).optional(),
        excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        mustInclude: z.array(z.string().min(1).max(256)).max(100).optional().default([]),
        landCount: z.number().int().min(26).max(44).optional(),
        maxNonbasicLands: z.number().int().min(0).max(44).optional(),
        maxRefinementRounds: z.number().int().min(1).max(5).optional().default(3),
        maxRefinementSwaps: z.number().int().min(1).max(30).optional().default(12),
        swapsPerRound: z.number().int().min(1).max(8).optional().default(4),
        minimumImprovementScore: z.number().min(-10).max(100).optional().default(0.1),
        simulationIterations: z.number().int().min(100).max(5_000).optional().default(750),
        simulationTurns: z.number().int().min(3).max(12).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
        detailLevel,
        ...printingFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await buildAndRefineCommanderDeckV11(input.commanderNames, {
          targetBracket: input.targetBracket,
          ...(input.themeQuery ? { themeQuery: input.themeQuery } : {}),
          ...(input.maxUsdPerCard !== undefined ? { maxUsdPerCard: input.maxUsdPerCard } : {}),
          ...(input.maxPostDraftUpgradeUsd !== undefined ? { maxPostDraftUpgradeUsd: input.maxPostDraftUpgradeUsd } : {}),
          excludedCards: input.excludedCards,
          mustInclude: input.mustInclude,
          ...(input.landCount !== undefined ? { landCount: input.landCount } : {}),
          ...(input.maxNonbasicLands !== undefined ? { maxNonbasicLands: input.maxNonbasicLands } : {}),
          maxRefinementRounds: input.maxRefinementRounds,
          maxRefinementSwaps: input.maxRefinementSwaps,
          swapsPerRound: input.swapsPerRound,
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
