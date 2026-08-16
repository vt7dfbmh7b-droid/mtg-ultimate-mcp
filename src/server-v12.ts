import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { createMtgServerV11 } from './server-v11.js';
import { deduplicateTournamentEvidenceV12 } from './services/evidence-dedup-v12.js';
import { fetchEdhTop16CommanderEntriesV09 } from './services/evidence-sources-v09.js';
import { refineCommanderDeckIterativelyV12 } from './services/optimizer-v12.js';
import { analyzeTopDeckTournamentReferences } from './services/references.js';
import { buildAndRefineCommanderDeckV12, refinePreconIterativelyV12 } from './services/refinement-workflows-v12.js';
import { sourceHealthDiagnosticsV12 } from './services/source-health-v12.js';

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
  candidatePackagesPerRound: z.number().int().min(1).max(6).optional().default(3),
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
  candidatePackagesPerRound?: number;
}

function profileDefaults(profile: PreconProfile): ProfileDefaults {
  if (profile === 'light') return { targetBracket: 2, maxUsdPerCard: 5, maxSwaps: 5, maxRounds: 2, swapsPerRound: 3, candidatePackagesPerRound: 2 };
  if (profile === 'balanced') return { targetBracket: 3, maxUsdPerCard: 10, maxSwaps: 10, maxRounds: 3, swapsPerRound: 4, candidatePackagesPerRound: 3 };
  if (profile === 'strong') return { targetBracket: 4, maxUsdPerCard: 20, maxSwaps: 15, maxRounds: 4, swapsPerRound: 4, candidatePackagesPerRound: 4 };
  if (profile === 'optimized') return { targetBracket: 4, maxSwaps: 20, maxRounds: 5, swapsPerRound: 5, candidatePackagesPerRound: 5 };
  return {};
}

export function registerMtgToolsV12(server: McpServer): McpServer {
  server.registerTool(
    'refine_commander_deck_v12',
    {
      title: 'Compare competing packages and refine a Commander deck',
      description: 'Iteratively refine a legal Commander deck, generating several materially different upgrade packages per round and selecting the strongest same-seed candidate that passes legality, printing, budget and regression checks.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        ...refinementFields,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await refineCommanderDeckIterativelyV12(input.decklist, {
          ...(input.targetBracket !== undefined ? { targetBracket: input.targetBracket } : {}),
          ...(input.maxUsdPerCard !== undefined ? { maxUsdPerCard: input.maxUsdPerCard } : {}),
          ...(input.maxTotalUsd !== undefined ? { maxTotalUsd: input.maxTotalUsd } : {}),
          ...(input.maxSwaps !== undefined ? { maxSwaps: input.maxSwaps } : {}),
          ...(input.maxRounds !== undefined ? { maxRounds: input.maxRounds } : {}),
          ...(input.swapsPerRound !== undefined ? { swapsPerRound: input.swapsPerRound } : {}),
          candidatePackagesPerRound: input.candidatePackagesPerRound,
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
    'refine_precon_v12',
    {
      title: 'Refine any Commander precon with competing upgrade packages',
      description: 'Start from the exact stock MTGJSON precon, compare multiple candidate upgrade packages each round, and keep only the strongest supported legal package while respecting budget, bracket, theme and printing-family restrictions.',
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
        return jsonResult(await refinePreconIterativelyV12({
          reference: input.reference,
          ...(input.targetBracket !== undefined
            ? { targetBracket: input.targetBracket }
            : defaults.targetBracket !== undefined ? { targetBracket: defaults.targetBracket } : {}),
          ...(input.maxUsdPerCard !== undefined
            ? { maxUsdPerCard: input.maxUsdPerCard }
            : defaults.maxUsdPerCard !== undefined ? { maxUsdPerCard: defaults.maxUsdPerCard } : {}),
          ...(input.maxTotalUsd !== undefined ? { maxTotalUsd: input.maxTotalUsd } : {}),
          maxSwaps: input.maxSwaps ?? defaults.maxSwaps ?? 12,
          maxRounds: input.maxRounds ?? defaults.maxRounds ?? 3,
          swapsPerRound: input.swapsPerRound ?? defaults.swapsPerRound ?? 4,
          candidatePackagesPerRound: input.candidatePackagesPerRound ?? defaults.candidatePackagesPerRound ?? 3,
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
    'build_and_refine_commander_deck_v12',
    {
      title: 'Build and competitively refine a Commander deck from scratch',
      description: 'Build a legal first draft, then compare several alternative upgrade packages each round until the deck stops improving under the requested bracket, theme, budget and exact physical-printing restrictions.',
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
        candidatePackagesPerRound: z.number().int().min(1).max(6).optional().default(3),
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
        return jsonResult(await buildAndRefineCommanderDeckV12(input.commanderNames, {
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

  server.registerTool(
    'source_health_v12',
    {
      title: 'Check MTG Ultimate data-source health',
      description: 'Probe the structured data sources MTG Ultimate depends on, show latency/configuration/degraded state, and identify reference-only sources that should not be mistaken for hard API dependencies.',
      inputSchema: z.object({
        includeReferenceSources: z.boolean().optional().default(true),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ includeReferenceSources }) => {
      try {
        return jsonResult(await sourceHealthDiagnosticsV12({ includeReferenceSources }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'cross_reference_tournament_evidence_v12',
    {
      title: 'Cross-reference Commander tournament evidence without double-counting',
      description: 'Use TopDeck.gg as structured tournament evidence when configured, pair it with EDHTop16 as an attributed public competitive reference, and conservatively deduplicate any structured records that are actually available. Reference-only sources are not counted as extra tournament rows.',
      inputSchema: z.object({
        commanderNames: z.array(z.string().min(1).max(256)).min(1).max(2),
        lastDays: z.number().int().min(1).max(365).optional().default(90),
        participantMin: z.number().int().min(4).max(500).optional().default(32),
        sampleLimit: z.number().int().min(4).max(40).optional().default(16),
        minGames: z.number().int().min(1).max(20).optional().default(3),
        includeTopDeck: z.boolean().optional().default(true),
        includeEdhTop16: z.boolean().optional().default(true),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ commanderNames, lastDays, participantMin, sampleLimit, minGames, includeTopDeck, includeEdhTop16 }) => {
      try {
        let topDeck: Record<string, unknown> | null = null;
        const sourceErrors: Record<string, string> = {};

        if (includeTopDeck) {
          try {
            topDeck = await analyzeTopDeckTournamentReferences({
              lastDays,
              participantMin,
              ...(commanderNames.length === 1 && commanderNames[0] ? { commanderName: commanderNames[0] } : {}),
              sampleLimit,
              minGames,
            });
          } catch (error) {
            sourceErrors.topDeck = error instanceof Error ? error.message : String(error);
          }
        }

        const edhTop16 = includeEdhTop16
          ? await fetchEdhTop16CommanderEntriesV09({
              commanders: commanderNames,
              lastDays,
              minTournamentSize: participantMin,
              maxStanding: 64,
              limit: Math.min(100, sampleLimit * 3),
            })
          : null;

        const deduplicated = deduplicateTournamentEvidenceV12(topDeck ?? {}, edhTop16 ?? {});
        return jsonResult({
          commanderNames,
          filters: { lastDays, participantMin, sampleLimit, minGames },
          sourceErrors,
          deduplicated,
          sourceEvidence: { topDeck, edhTop16 },
          guidance: 'Use the deduplicated effective sample only for structured tournament rows. EDHTop16 currently contributes attributed public-reference context and must not be counted as additional structured appearances unless a current stable structured endpoint is verified later.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

export function createMtgServerV12(): McpServer {
  return registerMtgToolsV12(createMtgServerV11());
}
