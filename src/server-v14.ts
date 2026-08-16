import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { createMtgServerV13 } from './server-v13.js';
import {
  assessCedhReadinessNzdV14,
  buildCommanderForCedhNzdV14,
  completeBestCedhComboNzdV14,
  refineCommanderForCedhNzdV14,
} from './services/cedh-workflow-nzd-v14.js';

const jsonResult = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const errorResult = (error: unknown) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }],
  isError: true,
});

const printingFields = {
  printingFamily: z.string().min(1).max(120).optional(),
  allowedSets: z.array(z.string().min(2).max(12)).max(50).optional().default([]),
  includePromos: z.boolean().optional().default(true),
  includeSpecialReleases: z.boolean().optional().default(true),
};

const cedhCommonFields = {
  maxNzdPerCard: z.number().positive().max(200_000).optional(),
  protectedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
  excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
  maxMissingCards: z.number().int().min(1).max(3).optional().default(2),
  maxCandidatesToVerify: z.number().int().min(1).max(12).optional().default(8),
  maxEfficiencySwaps: z.number().int().min(0).max(5).optional().default(3),
  maxManaBaseSwaps: z.number().int().min(0).max(8).optional().default(5),
  requireVerifiedCombo: z.boolean().optional().default(true),
  ...printingFields,
};

export function registerMtgToolsV14(server: McpServer): McpServer {
  server.registerTool(
    'assess_cedh_readiness_v14',
    {
      title: 'Assess Commander cEDH construction readiness',
      description: 'Hard-check a Commander deck, its exact printing policy, completed/Ruthless combo evidence, curve, early-game density, fast mana and interaction. Reports construction readiness without pretending a static list alone proves official Bracket 5 intent.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        ...printingFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await assessCedhReadinessNzdV14(input.decklist, {
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
    'complete_cedh_combo_v14',
    {
      title: 'Complete the best legal Commander combo package',
      description: 'Find Commander Spellbook near-combos already mostly present in a deck and only accept a package when the missing cards have legal policy-compliant physical printings and Spellbook confirms the rebuilt deck gained a complete combo. NZD is the primary budget/display currency.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        maxNzdPerCard: z.number().positive().max(200_000).optional(),
        protectedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        maxMissingCards: z.number().int().min(1).max(3).optional().default(2),
        maxCandidatesToVerify: z.number().int().min(1).max(12).optional().default(8),
        ...printingFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await completeBestCedhComboNzdV14(input.decklist, {
          ...(input.maxNzdPerCard !== undefined ? { maxNzdPerCard: input.maxNzdPerCard } : {}),
          protectedCards: input.protectedCards,
          maxMissingCards: input.maxMissingCards,
          maxCandidatesToVerify: input.maxCandidatesToVerify,
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
    'refine_cedh_commander_deck_v14',
    {
      title: 'Refine a Commander deck toward cEDH',
      description: 'Use the dedicated cEDH workflow: verify a real win package, protect it, make only strict high-value spell upgrades, optimize the mana base land-for-land, and independently reassess. Exact printing restrictions and NZD per-card budgets stay active throughout.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        ...cedhCommonFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await refineCommanderForCedhNzdV14(input.decklist, {
          ...(input.maxNzdPerCard !== undefined ? { maxNzdPerCard: input.maxNzdPerCard } : {}),
          protectedCards: input.protectedCards,
          excludedCards: input.excludedCards,
          maxMissingCards: input.maxMissingCards,
          maxCandidatesToVerify: input.maxCandidatesToVerify,
          maxEfficiencySwaps: input.maxEfficiencySwaps,
          maxManaBaseSwaps: input.maxManaBaseSwaps,
          requireVerifiedCombo: input.requireVerifiedCombo,
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
    'build_cedh_commander_deck_v14',
    {
      title: 'Build a Commander deck toward cEDH',
      description: 'Build a legal Commander deck from scratch under exact physical-printing restrictions, then run the dedicated cEDH package workflow. A successful result means strong competitive-construction signals, not an automatic certification of official Bracket 5 intent.',
      inputSchema: z.object({
        commanderNames: z.array(z.string().min(1).max(256)).min(1).max(2),
        themeQuery: z.string().min(1).max(500).optional(),
        maxNzdPerCard: z.number().positive().max(200_000).optional(),
        excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        mustInclude: z.array(z.string().min(1).max(256)).max(100).optional().default([]),
        protectedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        landCount: z.number().int().min(26).max(40).optional(),
        maxNonbasicLands: z.number().int().min(0).max(40).optional(),
        maxMissingCards: z.number().int().min(1).max(3).optional().default(2),
        maxCandidatesToVerify: z.number().int().min(1).max(12).optional().default(8),
        maxEfficiencySwaps: z.number().int().min(0).max(5).optional().default(3),
        maxManaBaseSwaps: z.number().int().min(0).max(8).optional().default(5),
        requireVerifiedCombo: z.boolean().optional().default(true),
        ...printingFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await buildCommanderForCedhNzdV14(input.commanderNames, {
          ...(input.themeQuery ? { themeQuery: input.themeQuery } : {}),
          ...(input.maxNzdPerCard !== undefined ? { maxNzdPerCard: input.maxNzdPerCard } : {}),
          excludedCards: input.excludedCards,
          mustInclude: input.mustInclude,
          protectedCards: input.protectedCards,
          ...(input.landCount !== undefined ? { landCount: input.landCount } : {}),
          ...(input.maxNonbasicLands !== undefined ? { maxNonbasicLands: input.maxNonbasicLands } : {}),
          maxMissingCards: input.maxMissingCards,
          maxCandidatesToVerify: input.maxCandidatesToVerify,
          maxEfficiencySwaps: input.maxEfficiencySwaps,
          maxManaBaseSwaps: input.maxManaBaseSwaps,
          requireVerifiedCombo: input.requireVerifiedCombo,
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

export function createMtgServerV14(): McpServer {
  return registerMtgToolsV14(createMtgServerV13());
}
