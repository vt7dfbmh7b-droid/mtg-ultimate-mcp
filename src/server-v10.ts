import * as z from 'zod/v4';
import { createMtgServerV09 } from './server-v09.js';
import {
  analyzePreconV10,
  getPreconStockV10,
  preconUpgradeProfilesV10,
  searchCommanderPreconsV10,
  upgradePreconV10,
} from './services/precons-v10.js';

const jsonResult = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const errorResult = (error: unknown) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }],
  isError: true,
});

const printingPolicyFields = {
  printingFamily: z.string().min(1).max(120).optional(),
  allowedSets: z.array(z.string().min(2).max(12)).max(50).optional().default([]),
  includePromos: z.boolean().optional().default(true),
  includeSpecialReleases: z.boolean().optional().default(true),
};

export function createMtgServerV10() {
  const server = createMtgServerV09();

  server.registerTool(
    'list_commander_precons_v10',
    {
      title: 'Browse the self-updating Commander precon catalog',
      description: 'Search Commander preconstructed decks from the current MTGJSON DeckList feed by name, year, or set/deck code. Regular, Collector and foil product variants remain separate when the source lists them separately.',
      inputSchema: z.object({
        query: z.string().max(300).optional(),
        year: z.number().int().min(2011).max(2100).optional(),
        setCode: z.string().min(1).max(12).optional(),
        limit: z.number().int().min(1).max(500).optional().default(100),
        forceRefresh: z.boolean().optional().default(false),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, year, setCode, limit, forceRefresh }) => {
      try {
        return jsonResult(await searchCommanderPreconsV10({
          ...(query ? { query } : {}),
          ...(year !== undefined ? { year } : {}),
          ...(setCode ? { setCode } : {}),
          limit,
          forceRefresh,
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'get_precon_stock_deck_v10',
    {
      title: 'Get an exact stock Commander precon',
      description: 'Fetch the untouched stock deck for any Commander precon in the live catalog, preserving exact set code, collector number, quantity and foil/nonfoil status from the physical deck record.',
      inputSchema: z.object({
        reference: z.string().min(1).max(500),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ reference }) => {
      try {
        return jsonResult(await getPreconStockV10(reference));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'analyze_precon_v10',
    {
      title: 'Analyse a stock Commander precon',
      description: 'Analyse an untouched precon with Commander legality, deck metrics, known combos/bracket evidence, theme hints and the existing gameplay simulation before any upgrades are made.',
      inputSchema: z.object({
        reference: z.string().min(1).max(500),
        simulationIterations: z.number().int().min(100).max(5_000).optional().default(500),
        simulationTurns: z.number().int().min(3).max(12).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ reference, simulationIterations, simulationTurns, seed }) => {
      try {
        return jsonResult(await analyzePreconV10({ reference, simulationIterations, simulationTurns, seed }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'precon_upgrade_profiles_v10',
    {
      title: 'Show Commander precon upgrade levels',
      description: 'Show the default light, balanced, strong and optimized upgrade profiles. These are starting profiles and can always be overridden with custom bracket, swap-count and price restrictions.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => jsonResult({
      profiles: preconUpgradeProfilesV10(),
      responseGuidance: 'Explain these as rough upgrade intensities, not rigid power ratings.',
    }),
  );

  server.registerTool(
    'upgrade_precon_v10',
    {
      title: 'Generate the best supported upgrades for a Commander precon',
      description: 'Start from the exact untouched stock deck and produce evidence/simulation-backed OUT -> IN upgrades while preserving Commander legality, exact physical printing rules, budget constraints and the precon identity unless the user asks for a larger rebuild.',
      inputSchema: z.object({
        reference: z.string().min(1).max(500),
        profile: z.enum(['light', 'balanced', 'strong', 'optimized', 'custom']).optional().default('balanced'),
        targetBracket: z.number().int().min(1).max(5).optional(),
        maxUsdPerCard: z.number().positive().max(100_000).optional(),
        maxSwaps: z.number().int().min(1).max(15).optional(),
        themeQuery: z.string().min(1).max(500).optional(),
        excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        protectedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        simulationIterations: z.number().int().min(100).max(5_000).optional().default(750),
        simulationTurns: z.number().int().min(3).max(12).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
        ...printingPolicyFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({
      reference,
      profile,
      targetBracket,
      maxUsdPerCard,
      maxSwaps,
      themeQuery,
      excludedCards,
      protectedCards,
      simulationIterations,
      simulationTurns,
      seed,
      printingFamily,
      allowedSets,
      includePromos,
      includeSpecialReleases,
    }) => {
      try {
        return jsonResult(await upgradePreconV10({
          reference,
          profile,
          ...(targetBracket !== undefined ? { targetBracket } : {}),
          ...(maxUsdPerCard !== undefined ? { maxUsdPerCard } : {}),
          ...(maxSwaps !== undefined ? { maxSwaps } : {}),
          ...(themeQuery ? { themeQuery } : {}),
          excludedCards,
          protectedCards,
          simulationIterations,
          simulationTurns,
          seed,
          ...(printingFamily ? { printingFamily } : {}),
          allowedSets,
          includePromos,
          includeSpecialReleases,
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
