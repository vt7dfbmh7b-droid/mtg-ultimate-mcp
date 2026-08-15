import * as z from 'zod/v4';
import { createMtgServerV05 } from './server-v05.js';
import { validateCommanderDeck } from './services/commander-rules.js';
import { parseDecklist } from './services/deck.js';
import { getCardsByIdentifiers } from './services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from './services/simulation-v06.js';

const jsonResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const errorResult = (error: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: error instanceof Error ? `${error.name}: ${error.message}` : `Unexpected error: ${String(error)}`,
    },
  ],
  isError: true,
});

async function resolveDeck(decklist: string, commanderNames: string[]) {
  const parsed = parseDecklist(decklist, commanderNames);
  const identifiers = [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
  const resolved = await getCardsByIdentifiers(identifiers);
  return { parsed, ...resolved };
}

function simpleSimulationView(result: Record<string, unknown>): Record<string, unknown> {
  const advanced = result.advanced as Record<string, unknown> | undefined;
  const commander = advanced?.commanderPressure as Record<string, unknown> | undefined;
  const resources = advanced?.resources as Record<string, unknown> | undefined;
  const interaction = advanced?.interactionPressure as Record<string, unknown> | undefined;
  const casting = advanced?.advancedCasting as Record<string, unknown> | undefined;
  return {
    model: result.model,
    summary: result.summary,
    keyNumbers: {
      commanderBattlefieldUptimePercent: commander?.battlefieldUptimePercent ?? null,
      averageTreasuresCreated: resources?.averageTreasuresCreated ?? null,
      averageTreasuresSpent: resources?.averageTreasuresSpent ?? null,
      protectionWinRateWhenChallenged: interaction?.protectionWinRateWhenChallenged ?? null,
      averageAdvancedCasts: casting?.averageAdvancedCasts ?? null,
    },
    responseGuidance:
      'Explain the result in plain language first. Focus on what helped, what slowed the deck down, and the biggest practical change. Only quote extra percentages when they help the decision.',
  };
}

export function createMtgServerV06() {
  const server = createMtgServerV05();

  server.registerTool(
    'simulate_advanced_gameplay_v06',
    {
      title: 'Run V0.6 rules-aware Commander gameplay simulation',
      description:
        'Run the V0.6 hybrid simulator. It keeps V0.4 land/fetch/tutor consistency analysis and adds turn-by-turn Treasure creation/spending, convoke, improvise, delve, artifact-affinity, Phyrexian mana, supported named alternative costs, commander uptime/removal, key-spell pressure, and protection responses. Hard Commander legality is checked first.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
        iterations: z.number().int().min(100).max(50_000).optional().default(2_500),
        advancedIterations: z.number().int().min(100).max(10_000).optional(),
        turns: z.number().int().min(1).max(15).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
        pressure: z.enum(['goldfish', 'casual', 'upgraded', 'optimized', 'cedh']).optional().default('upgraded'),
        comboPieces: z.array(z.array(z.string().min(1).max(256)).min(2).max(6)).max(8).optional().default([]),
        detail: z.enum(['simple', 'standard', 'detailed']).optional().default('simple'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames, iterations, advancedIterations, turns, seed, pressure, comboPieces, detail }) => {
      try {
        const { parsed, cards, notFound } = await resolveDeck(decklist, commanderNames);
        const commanderRules = validateCommanderDeck(parsed, cards);
        if (notFound.length > 0 || commanderRules.status === 'incomplete') {
          return jsonResult({
            error: 'Resolve the entire deck before advanced simulation.',
            unresolvedCards: notFound,
            commanderRules,
          });
        }
        if (!commanderRules.isLegal) {
          return jsonResult({
            error: 'This deck fails Commander construction rules. Fix legality before interpreting simulation results.',
            commanderRules,
          });
        }
        const options = {
          iterations,
          ...(advancedIterations !== undefined ? { advancedIterations } : {}),
          turns,
          seed,
          pressure: pressure as PodPressureV06,
          comboPieces,
        };
        const result = simulateDeckGameplayV06(parsed, cards, options);
        if (detail === 'simple') return jsonResult({ commanderRules, ...simpleSimulationView(result) });
        if (detail === 'standard') {
          const advanced = result.advanced as Record<string, unknown>;
          return jsonResult({
            commanderRules,
            model: result.model,
            summary: result.summary,
            baseline: result.baseline,
            advanced: {
              resources: advanced.resources,
              advancedCasting: advanced.advancedCasting,
              commanderPressure: advanced.commanderPressure,
              interactionPressure: advanced.interactionPressure,
              combos: advanced.combos,
            },
          });
        }
        return jsonResult({ commanderRules, ...result });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
