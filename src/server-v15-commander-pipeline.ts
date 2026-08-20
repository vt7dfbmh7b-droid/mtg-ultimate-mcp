import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { registerTutorReplacementToolV15 } from './server-v15-tutor-replacements.js';
import { registerTutorValueForMoneyToolV15 } from './server-v15-tutor-value.js';
import {
  buildCommanderThroughPipelineV15,
  type CommanderBuildPipelineOptionsV15,
} from './services/commander-build-pipeline-v15.js';
import {
  getCardsByIdentifiers,
  type CardIdentifierInput,
} from './services/scryfall.js';
import type { ScryfallCard } from './types/scryfall.js';

const commanderRefSchema = z.object({
  name: z.string().min(1).max(256),
  set: z.string().min(2).max(12).optional(),
  collectorNumber: z.string().min(1).max(32).optional(),
});

const archetypeSchema = z.enum([
  'combat-tokens',
  'equipment-voltron',
  'counters',
  'graveyard-reanimator',
  'aristocrats',
  'spells-control',
  'value-engine',
  'big-mana',
]);

export const universalCommanderPipelineInputSchemaV15 = z.object({
  commanders: z.array(commanderRefSchema).min(1).max(2),
  targetBracket: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  archetype: archetypeSchema.optional(),
  printingFamily: z.string().min(1).max(128).optional(),
  allowedSets: z.array(z.string().min(2).max(12)).max(50).optional(),
  includePromos: z.boolean().optional(),
  includeSpecialReleases: z.boolean().optional(),
  maxUsdPerCard: z.number().positive().max(1_000_000).optional(),
  candidateMaxUsdPerCard: z.number().positive().max(1_000_000).optional(),
  themeQuery: z.string().min(1).max(500).optional(),
  excludedCards: z.array(z.string().min(1).max(256)).max(100).optional(),
  mustInclude: z.array(z.string().min(1).max(256)).max(100).optional(),
  landCount: z.number().int().min(0).max(99).optional(),
  maxNonbasicLands: z.number().int().min(0).max(99).optional(),
  winPackageMode: z.enum(['auto', 'prefer', 'require', 'forbid']).optional(),
  maxWinPackageCards: z.number().int().min(1).max(10).optional(),
  cedhIntent: z.boolean().optional(),
  competitiveMetagameEvidence: z.boolean().optional(),
  optimizedPlanEvidence: z.boolean().optional(),
  exhibitionIntent: z.boolean().optional(),
});

type UniversalCommanderPipelineInputV15 = z.infer<typeof universalCommanderPipelineInputSchemaV15>;
type CommanderRefV15 = UniversalCommanderPipelineInputV15['commanders'][number];

export interface UniversalCommanderPipelineToolDependenciesV15 {
  resolveCards?: typeof getCardsByIdentifiers;
  buildPipeline?: typeof buildCommanderThroughPipelineV15;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizedCardNames(card: ScryfallCard): Set<string> {
  const names = new Set<string>();
  const add = (value: string | undefined): void => {
    if (!value?.trim()) return;
    names.add(normalizeName(value));
    const front = value.split('//')[0]?.trim();
    if (front) names.add(normalizeName(front));
  };
  add(card.name);
  add(card.printed_name);
  add(card.flavor_name);
  for (const face of card.card_faces ?? []) add(face.name);
  return names;
}

function matchesCommanderRef(card: ScryfallCard, ref: CommanderRefV15): boolean {
  if (ref.set && card.set.toLocaleLowerCase() !== ref.set.trim().toLocaleLowerCase()) return false;
  if (ref.collectorNumber && card.collector_number.toLocaleLowerCase() !== ref.collectorNumber.trim().toLocaleLowerCase()) return false;
  return normalizedCardNames(card).has(normalizeName(ref.name));
}

function commanderRefKey(ref: CommanderRefV15): string {
  return [
    normalizeName(ref.name),
    ref.set?.trim().toLocaleLowerCase() ?? '',
    ref.collectorNumber?.trim().toLocaleLowerCase() ?? '',
  ].join('|');
}

function commanderRefLabel(ref: CommanderRefV15): string {
  if (ref.set && ref.collectorNumber) return `${ref.name} (${ref.set.toUpperCase()}) ${ref.collectorNumber}`;
  if (ref.set) return `${ref.name} (${ref.set.toUpperCase()})`;
  return ref.name;
}

function commanderIdentifiers(refs: CommanderRefV15[]): CardIdentifierInput[] {
  return refs.map((ref) => ({
    name: ref.name,
    ...(ref.set ? { set: ref.set } : {}),
    ...(ref.collectorNumber ? { collectorNumber: ref.collectorNumber } : {}),
  }));
}

function compactPipelineOptions(input: UniversalCommanderPipelineInputV15): CommanderBuildPipelineOptionsV15 {
  return {
    ...(input.targetBracket !== undefined ? { targetBracket: input.targetBracket } : {}),
    ...(input.archetype !== undefined ? { archetype: input.archetype } : {}),
    ...(input.printingFamily !== undefined ? { printingFamily: input.printingFamily } : {}),
    ...(input.allowedSets !== undefined ? { allowedSets: input.allowedSets } : {}),
    ...(input.includePromos !== undefined ? { includePromos: input.includePromos } : {}),
    ...(input.includeSpecialReleases !== undefined ? { includeSpecialReleases: input.includeSpecialReleases } : {}),
    ...(input.maxUsdPerCard !== undefined ? { maxUsdPerCard: input.maxUsdPerCard } : {}),
    ...(input.candidateMaxUsdPerCard !== undefined ? { candidateMaxUsdPerCard: input.candidateMaxUsdPerCard } : {}),
    ...(input.themeQuery !== undefined ? { themeQuery: input.themeQuery } : {}),
    ...(input.excludedCards !== undefined ? { excludedCards: input.excludedCards } : {}),
    ...(input.mustInclude !== undefined ? { mustInclude: input.mustInclude } : {}),
    ...(input.landCount !== undefined ? { landCount: input.landCount } : {}),
    ...(input.maxNonbasicLands !== undefined ? { maxNonbasicLands: input.maxNonbasicLands } : {}),
    ...(input.winPackageMode !== undefined ? { winPackageMode: input.winPackageMode } : {}),
    ...(input.maxWinPackageCards !== undefined ? { maxWinPackageCards: input.maxWinPackageCards } : {}),
    ...(input.cedhIntent !== undefined ? { cedhIntent: input.cedhIntent } : {}),
    ...(input.competitiveMetagameEvidence !== undefined ? { competitiveMetagameEvidence: input.competitiveMetagameEvidence } : {}),
    ...(input.optimizedPlanEvidence !== undefined ? { optimizedPlanEvidence: input.optimizedPlanEvidence } : {}),
    ...(input.exhibitionIntent !== undefined ? { exhibitionIntent: input.exhibitionIntent } : {}),
  };
}

function resolvedCommanderSummary(card: ScryfallCard): Record<string, unknown> {
  return {
    id: card.id,
    name: card.name,
    oracleId: card.oracle_id ?? null,
    commanderLegality: card.legalities.commander ?? 'unknown',
    colorIdentity: card.color_identity,
    set: card.set.toUpperCase(),
    collectorNumber: card.collector_number,
    finishes: card.finishes ?? [card.foil ? 'foil' : '', card.nonfoil ? 'nonfoil' : ''].filter(Boolean),
  };
}

export async function runUniversalCommanderPipelineToolV15(
  input: UniversalCommanderPipelineInputV15,
  dependencies: UniversalCommanderPipelineToolDependenciesV15 = {},
): Promise<Record<string, unknown>> {
  const resolveCards = dependencies.resolveCards ?? getCardsByIdentifiers;
  const buildPipeline = dependencies.buildPipeline ?? buildCommanderThroughPipelineV15;
  const duplicateInputs = input.commanders
    .filter((ref, index, refs) => refs.findIndex((candidate) => commanderRefKey(candidate) === commanderRefKey(ref)) !== index)
    .map(commanderRefLabel);
  if (duplicateInputs.length > 0) {
    return {
      status: 'duplicate-commander-input',
      constructionIntent: 'universal-pipeline-v15',
      requestedCommanders: input.commanders,
      guidance: `Commander inputs must identify one or two distinct cards. Duplicate input: ${duplicateInputs.join(', ')}.`,
    };
  }

  const resolution = await resolveCards(commanderIdentifiers(input.commanders));
  const resolvedInInputOrder: ScryfallCard[] = [];
  const unresolved: string[] = [];
  for (const ref of input.commanders) {
    const match = resolution.cards.find((card) => matchesCommanderRef(card, ref));
    if (!match) unresolved.push(commanderRefLabel(ref));
    else resolvedInInputOrder.push(match);
  }

  if (resolution.notFound.length > 0 || unresolved.length > 0 || resolvedInInputOrder.length !== input.commanders.length) {
    return {
      status: 'commander-resolution-failed',
      constructionIntent: 'universal-pipeline-v15',
      requestedCommanders: input.commanders,
      unresolvedCommanders: [...new Set([...unresolved, ...resolution.notFound])],
      resolvedCommanders: resolvedInInputOrder.map(resolvedCommanderSummary),
      guidance: 'The universal pipeline requires one or two exactly resolved commander inputs. No deck construction was attempted.',
    };
  }

  const result = await buildPipeline(resolvedInInputOrder, compactPipelineOptions(input));
  return {
    ...result,
    mcpBoundary: {
      tool: 'build_commander_through_pipeline_v15',
      experimental: true,
      requestedCommanderCount: input.commanders.length,
      resolvedCommanderCount: resolvedInInputOrder.length,
      exactCommanderResolutionPassed: true,
    },
    resolvedCommanders: resolvedInInputOrder.map(resolvedCommanderSummary),
  };
}

const jsonResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const errorResult = (error: unknown) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }],
  isError: true,
});

export function registerUniversalCommanderPipelineToolV15(
  server: McpServer,
  dependencies: UniversalCommanderPipelineToolDependenciesV15 = {},
): McpServer {
  server.registerTool(
    'build_commander_through_pipeline_v15',
    {
      title: 'Build and independently evaluate a Commander deck through the experimental universal V0.15 pipeline',
      description: 'Resolve one or two commander cards, preserve explicit printing/theme/budget/package constraints, run the existing universal Commander pipeline, and return its exact decklist plus hard-gate, theme, budget, provenance, win-package, source-health, achieved-bracket and requested-vs-achieved evidence without forcing the requested power target.',
      inputSchema: universalCommanderPipelineInputSchemaV15,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await runUniversalCommanderPipelineToolV15(input, dependencies));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
  registerTutorValueForMoneyToolV15(server);
  registerTutorReplacementToolV15(server);
  return server;
}
