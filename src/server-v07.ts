import * as z from 'zod/v4';
import { createMtgServerV06 } from './server-v06.js';
import { calibratePressureFromTournamentAnalysisV07 } from './services/calibration-v07.js';
import { evaluateCombatBoardV07 } from './services/combat-v07.js';
import { evaluateComboZoneReadinessV07, type GameZoneV07 } from './services/combo-zones-v07.js';
import { validateCommanderDeck } from './services/commander-rules.js';
import { buildCommanderDeckDraftV07, buildSimulationBackedUpgradePlanV07 } from './services/deck-builder-v07.js';
import { parseDecklist } from './services/deck.js';
import {
  rankInteractionTargetsV07,
  resolveMultiplayerStackV07,
  type StackActionV07,
  type WardPaymentStateV07,
} from './services/interaction-v07.js';
import { analyzeArchidektReferences, analyzeTopDeckTournamentReferences } from './services/references.js';
import { getCardsByIdentifiers, lookupCard, type CardIdentifierInput } from './services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from './services/simulation-v06.js';
import { estimateCommanderBracket } from './services/spellbook.js';
import type { ScryfallCard } from './types/scryfall.js';

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

const cardRefSchema = z.object({
  name: z.string().min(1).max(256),
  set: z.string().min(2).max(12).optional(),
  collectorNumber: z.string().min(1).max(32).optional(),
});

type CardRefV07 = {
  name: string;
  set?: string | undefined;
  collectorNumber?: string | undefined;
};

async function resolveCardRef(ref: CardRefV07): Promise<ScryfallCard> {
  if (ref.set && ref.collectorNumber) {
    const result = await getCardsByIdentifiers([{ name: ref.name, set: ref.set, collectorNumber: ref.collectorNumber }]);
    const exact = result.cards[0];
    if (!exact) throw new Error(`Could not resolve ${ref.name} (${ref.set}) ${ref.collectorNumber}.`);
    return exact;
  }
  return lookupCard(ref.name, false, ref.set);
}

async function resolveDeck(decklist: string, commanderNames: string[]) {
  const parsed = parseDecklist(decklist, commanderNames);
  const identifiers: CardIdentifierInput[] = [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
  const resolved = await getCardsByIdentifiers(identifiers);
  return { parsed, ...resolved };
}

function commanderIdentity(parsed: ReturnType<typeof parseDecklist>, cards: ScryfallCard[]): string[] {
  const names = new Set(parsed.commanders.map((entry) => entry.name.toLocaleLowerCase()));
  return [...new Set(cards.filter((card) => names.has(card.name.toLocaleLowerCase())).flatMap((card) => card.color_identity))].sort();
}

function compactSimulation(result: Record<string, unknown>): Record<string, unknown> {
  const baseline = result.baseline as Record<string, unknown> | undefined;
  const advanced = result.advanced as Record<string, unknown> | undefined;
  return {
    summary: result.summary,
    openingHands: baseline?.openingHands ?? null,
    commanders: baseline?.commanders ?? null,
    resources: advanced?.resources ?? null,
    commanderPressure: advanced?.commanderPressure ?? null,
    interactionPressure: advanced?.interactionPressure ?? null,
    combos: advanced?.combos ?? null,
  };
}

export function createMtgServerV07() {
  const server = createMtgServerV06();

  server.registerTool(
    'rank_interaction_targets_v07',
    {
      title: 'Rank important removal targets with Ward awareness',
      description:
        'Rank supplied battlefield targets for a specific interaction spell. V0.7 considers legal target type, commander/combo/engine signals, developed permanents, and whether the supplied resources can pay supported Ward costs.',
      inputSchema: z.object({
        answer: cardRefSchema,
        targets: z.array(cardRefSchema.extend({
          isCommander: z.boolean().optional().default(false),
          knownComboPiece: z.boolean().optional().default(false),
          counters: z.number().int().min(0).max(1_000).optional().default(0),
        })).min(1).max(20),
        wardResources: z.object({
          genericMana: z.number().int().min(0).max(100).optional(),
          coloredMana: z.object({
            W: z.number().int().min(0).max(100).optional(),
            U: z.number().int().min(0).max(100).optional(),
            B: z.number().int().min(0).max(100).optional(),
            R: z.number().int().min(0).max(100).optional(),
            G: z.number().int().min(0).max(100).optional(),
            C: z.number().int().min(0).max(100).optional(),
          }).optional(),
          flexibleMana: z.number().int().min(0).max(100).optional(),
          life: z.number().int().min(0).max(1_000).optional(),
          cardsInHand: z.number().int().min(0).max(100).optional(),
          sacrificePermanents: z.number().int().min(0).max(100).optional(),
        }).optional().default({}),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ answer, targets, wardResources }) => {
      try {
        const answerCard = await resolveCardRef(answer);
        const candidates = [] as Array<{ card: ScryfallCard; isCommander: boolean; knownComboPiece: boolean; counters: number }>;
        for (const target of targets) {
          candidates.push({
            card: await resolveCardRef(target),
            isCommander: target.isCommander,
            knownComboPiece: target.knownComboPiece,
            counters: target.counters,
          });
        }
        return jsonResult({
          answer: answerCard.name,
          rankedTargets: rankInteractionTargetsV07(answerCard, candidates, wardResources as WardPaymentStateV07),
          responseGuidance: 'Explain the top target in plain language first, then mention Ward/resource tradeoffs only if they change the decision.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'evaluate_multiplayer_stack_v07',
    {
      title: 'Evaluate a multiplayer counter/protection chain',
      description:
        'Resolve a supplied cast-order stack chain using common counterspell and uncounterable logic. Later actions resolve first; unresolved tax/permission decisions stay conditional instead of being guessed.',
      inputSchema: z.object({
        actions: z.array(z.object({
          player: z.string().min(1).max(100),
          card: cardRefSchema,
          role: z.enum(['primary', 'answer', 'protection']),
        })).min(1).max(12),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ actions }) => {
      try {
        const resolved: StackActionV07[] = [];
        for (const action of actions) {
          resolved.push({ player: action.player, card: await resolveCardRef(action.card), role: action.role });
        }
        return jsonResult(resolveMultiplayerStackV07(resolved));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'analyze_combat_board_v07',
    {
      title: 'Analyze Commander combat with counters, Equipment, Auras, and lords',
      description:
        'Calculate supplied creatures’ effective power/toughness using numeric printed stats, +1/+1 and -1/-1 counters, common static Equipment/Aura bonuses, and common lord effects. Variable stats remain unresolved rather than invented.',
      inputSchema: z.object({
        creatures: z.array(z.object({
          card: cardRefSchema,
          plusOneCounters: z.number().int().min(0).max(1_000).optional().default(0),
          minusOneCounters: z.number().int().min(0).max(1_000).optional().default(0),
          attachedCards: z.array(cardRefSchema).max(20).optional().default([]),
          isCommander: z.boolean().optional().default(false),
        })).min(1).max(50),
        globalPermanents: z.array(cardRefSchema).max(30).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ creatures, globalPermanents }) => {
      try {
        const states = [] as Array<{
          card: ScryfallCard;
          plusOneCounters: number;
          minusOneCounters: number;
          attachedCards: ScryfallCard[];
          isCommander: boolean;
        }>;
        for (const creature of creatures) {
          const attachedCards: ScryfallCard[] = [];
          for (const attached of creature.attachedCards) attachedCards.push(await resolveCardRef(attached));
          states.push({
            card: await resolveCardRef(creature.card),
            plusOneCounters: creature.plusOneCounters,
            minusOneCounters: creature.minusOneCounters,
            attachedCards,
            isCommander: creature.isCommander,
          });
        }
        const globals: ScryfallCard[] = [];
        for (const permanent of globalPermanents) globals.push(await resolveCardRef(permanent));
        return jsonResult(evaluateCombatBoardV07(states, globals));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'evaluate_combo_zones_v07',
    {
      title: 'Check whether combo pieces are actually ready in their zones',
      description:
        'Check named combo pieces against hand/battlefield/graveyard/exile/command/library/stack state. V0.7 recognizes common graveyard/exile permissions and does not count cards stranded in unusable zones as assembled.',
      inputSchema: z.object({
        pieces: z.array(z.object({
          card: cardRefSchema,
          currentZone: z.enum(['hand', 'battlefield', 'graveyard', 'exile', 'command', 'library', 'stack']),
          requiredZone: z.enum(['hand', 'battlefield', 'graveyard', 'exile', 'command', 'library', 'stack']).optional(),
          isCommander: z.boolean().optional().default(false),
        })).min(2).max(8),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ pieces }) => {
      try {
        const states = [] as Array<{ card: ScryfallCard; currentZone: GameZoneV07; requiredZone?: GameZoneV07; isCommander: boolean }>;
        for (const piece of pieces) {
          states.push({
            card: await resolveCardRef(piece.card),
            currentZone: piece.currentZone as GameZoneV07,
            ...(piece.requiredZone ? { requiredZone: piece.requiredZone as GameZoneV07 } : {}),
            isCommander: piece.isCommander,
          });
        }
        return jsonResult(evaluateComboZoneReadinessV07(states));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'plan_commander_upgrade_v07',
    {
      title: 'Create a simulation-backed Commander upgrade plan',
      description:
        'Generate exact candidate IN/OUT swaps for a legal Commander deck, respect protected cards and budget/set/theme constraints, preserve printing identity, rebuild the full deck, then compare the old and candidate list with the same simulation seed.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
        targetBracket: z.number().int().min(1).max(5).optional().default(4),
        maxUsdPerCard: z.number().positive().max(10_000).optional(),
        allowedSets: z.array(z.string().min(2).max(12)).max(30).optional().default([]),
        themeQuery: z.string().min(1).max(500).optional(),
        excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        protectedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        maxSwaps: z.number().int().min(1).max(15).optional().default(8),
        simulationIterations: z.number().int().min(100).max(5_000).optional().default(750),
        simulationTurns: z.number().int().min(3).max(12).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
        referenceArchidekt: z.array(z.union([z.string().min(1).max(1_000), z.number().int().positive()])).max(10).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames, targetBracket, maxUsdPerCard, allowedSets, themeQuery, excludedCards, protectedCards, maxSwaps, simulationIterations, simulationTurns, seed, referenceArchidekt }) => {
      try {
        const current = await resolveDeck(decklist, commanderNames);
        const commanderRules = validateCommanderDeck(current.parsed, current.cards);
        if (current.notFound.length > 0 || commanderRules.status === 'incomplete') {
          return jsonResult({ error: 'Resolve the full deck before planning upgrades.', unresolvedCards: current.notFound, commanderRules });
        }
        if (!commanderRules.isLegal) {
          return jsonResult({ error: 'Fix Commander construction-rule violations before optimizing the list.', commanderRules });
        }
        const plan = await buildSimulationBackedUpgradePlanV07(current.parsed, current.cards, commanderIdentity(current.parsed, current.cards), {
          targetBracket,
          ...(maxUsdPerCard !== undefined ? { maxUsdPerCard } : {}),
          allowedSets,
          ...(themeQuery ? { themeQuery } : {}),
          excludedCards,
          protectedCards,
          maxSwaps,
          simulationIterations,
          simulationTurns,
          seed,
        });
        const upgradedDecklist = typeof plan.upgradedDecklist === 'string' ? plan.upgradedDecklist : null;
        let bracket: Record<string, unknown> | null = null;
        if (upgradedDecklist) {
          try { bracket = await estimateCommanderBracket(upgradedDecklist); } catch { bracket = null; }
        }
        let references: Record<string, unknown> | null = null;
        if (referenceArchidekt.length > 0 && upgradedDecklist) {
          try { references = await analyzeArchidektReferences(referenceArchidekt, upgradedDecklist); } catch { references = null; }
        }
        return jsonResult({
          commanderRules,
          plan,
          bracketEvidence: bracket,
          referenceEvidence: references,
          responseGuidance: 'Lead with the exact swaps and the practical reason for them. Use simulation/reference numbers as support, not as a wall of statistics.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'build_commander_deck_v07',
    {
      title: 'Build a complete Commander deck from scratch',
      description:
        'Build a 100-card Commander draft from one or two commander printings. Enforce color identity and Commander legality, target useful role density, support theme/set/price/must-include/exclusion constraints, emit set+collector numbers, and optionally compare the completed draft with community references and simulation.',
      inputSchema: z.object({
        commanders: z.array(cardRefSchema).min(1).max(2),
        targetBracket: z.number().int().min(1).max(5).optional().default(4),
        themeQuery: z.string().min(1).max(500).optional(),
        maxUsdPerCard: z.number().positive().max(10_000).optional(),
        allowedSets: z.array(z.string().min(2).max(12)).max(30).optional().default([]),
        excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        mustInclude: z.array(z.string().min(1).max(256)).max(30).optional().default([]),
        landCount: z.number().int().min(26).max(44).optional(),
        maxNonbasicLands: z.number().int().min(0).max(44).optional(),
        referenceArchidekt: z.array(z.union([z.string().min(1).max(1_000), z.number().int().positive()])).max(10).optional().default([]),
        simulate: z.boolean().optional().default(true),
        simulationIterations: z.number().int().min(100).max(2_500).optional().default(500),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ commanders, targetBracket, themeQuery, maxUsdPerCard, allowedSets, excludedCards, mustInclude, landCount, maxNonbasicLands, referenceArchidekt, simulate, simulationIterations, seed }) => {
      try {
        const commanderCards: ScryfallCard[] = [];
        for (const commander of commanders) commanderCards.push(await resolveCardRef(commander));
        const draft = await buildCommanderDeckDraftV07(commanderCards, {
          targetBracket,
          ...(themeQuery ? { themeQuery } : {}),
          ...(maxUsdPerCard !== undefined ? { maxUsdPerCard } : {}),
          allowedSets,
          excludedCards,
          mustInclude,
          ...(landCount !== undefined ? { landCount } : {}),
          ...(maxNonbasicLands !== undefined ? { maxNonbasicLands } : {}),
        });
        const decklist = typeof draft.decklist === 'string' ? draft.decklist : null;
        let bracket: Record<string, unknown> | null = null;
        let simulation: Record<string, unknown> | null = null;
        let references: Record<string, unknown> | null = null;
        if (decklist && draft.status === 'complete-draft') {
          try { bracket = await estimateCommanderBracket(decklist); } catch { bracket = null; }
          const resolvedDraft = await resolveDeck(decklist, []);
          const rules = validateCommanderDeck(resolvedDraft.parsed, resolvedDraft.cards);
          if (simulate && resolvedDraft.notFound.length === 0 && rules.isLegal) {
            simulation = compactSimulation(simulateDeckGameplayV06(resolvedDraft.parsed, resolvedDraft.cards, {
              iterations: simulationIterations,
              advancedIterations: Math.min(simulationIterations, 1_000),
              turns: 7,
              seed,
              pressure: targetBracket >= 5 ? 'cedh' : targetBracket >= 4 ? 'optimized' : targetBracket >= 3 ? 'upgraded' : 'casual',
            }));
          }
          if (referenceArchidekt.length > 0) {
            try { references = await analyzeArchidektReferences(referenceArchidekt, decklist); } catch { references = null; }
          }
        }
        return jsonResult({
          draft,
          bracketEvidence: bracket,
          simulation,
          referenceEvidence: references,
          responseGuidance: 'Present the decklist cleanly, then summarize its game plan, main win routes, and only the most important construction caveats.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'simulate_calibrated_gameplay_v07',
    {
      title: 'Simulate a deck with tournament-informed pressure calibration',
      description:
        'Optionally inspect recent TopDeck.gg EDH deck structures, convert the higher-performing cohort into a transparent structural pressure proxy, then run the existing V0.6 hybrid simulation using the closest pressure preset. Falls back to the requested preset when tournament data/API access is unavailable.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
        fallbackPressure: z.enum(['goldfish', 'casual', 'upgraded', 'optimized', 'cedh']).optional().default('upgraded'),
        useTournamentCalibration: z.boolean().optional().default(true),
        lastDays: z.number().int().min(1).max(365).optional().default(90),
        participantMin: z.number().int().min(4).max(500).optional().default(16),
        sampleLimit: z.number().int().min(4).max(40).optional().default(16),
        minGames: z.number().int().min(1).max(20).optional().default(3),
        iterations: z.number().int().min(100).max(10_000).optional().default(1_500),
        turns: z.number().int().min(3).max(12).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames, fallbackPressure, useTournamentCalibration, lastDays, participantMin, sampleLimit, minGames, iterations, turns, seed }) => {
      try {
        const deck = await resolveDeck(decklist, commanderNames);
        const commanderRules = validateCommanderDeck(deck.parsed, deck.cards);
        if (deck.notFound.length > 0 || !commanderRules.isLegal) {
          return jsonResult({ error: 'A fully resolved Commander-legal deck is required.', unresolvedCards: deck.notFound, commanderRules });
        }

        let tournamentAnalysis: Record<string, unknown> | null = null;
        let calibration: ReturnType<typeof calibratePressureFromTournamentAnalysisV07> = null;
        if (useTournamentCalibration) {
          try {
            const commanderName = deck.parsed.commanders.length === 1 ? deck.parsed.commanders[0]?.name : undefined;
            tournamentAnalysis = await analyzeTopDeckTournamentReferences({
              lastDays,
              participantMin,
              sampleLimit,
              minGames,
              ...(commanderName ? { commanderName } : {}),
            });
            calibration = calibratePressureFromTournamentAnalysisV07(tournamentAnalysis);
          } catch {
            tournamentAnalysis = null;
            calibration = null;
          }
        }
        const pressure = (calibration?.selectedPressure ?? fallbackPressure) as PodPressureV06;
        const simulation = simulateDeckGameplayV06(deck.parsed, deck.cards, {
          iterations,
          advancedIterations: Math.min(iterations, 2_500),
          turns,
          seed,
          pressure,
        });
        return jsonResult({
          commanderRules,
          requestedFallbackPressure: fallbackPressure,
          pressureUsed: pressure,
          calibration,
          tournamentDataAvailable: tournamentAnalysis !== null,
          tournamentSummary: tournamentAnalysis
            ? {
                sampledDecks: tournamentAnalysis.sampledDecks ?? null,
                highPerformingCohort: tournamentAnalysis.highPerformingCohort ?? null,
                observedAssociations: tournamentAnalysis.observedAssociations ?? null,
              }
            : null,
          simulation: compactSimulation(simulation),
          responseGuidance: 'Treat calibration as evidence-informed context, not a measured win rate. Explain the practical result first.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
