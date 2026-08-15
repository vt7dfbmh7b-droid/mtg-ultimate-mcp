import * as z from 'zod/v4';
import { createMtgServerV04 } from './server-v04.js';
import { analyzeCastingProfileV05 } from './services/casting-v05.js';
import { buildCardIntelligenceV05 } from './services/card-intelligence-v05.js';
import { analyzeCommanderDependencyV05, simulateCombatSnapshotV05 } from './services/combat-v05.js';
import { parseDecklist, resolveEntryCard } from './services/deck.js';
import { evaluateInteractionExchangeV05 } from './services/interaction-v05.js';
import { getCardsByIdentifiers, lookupCard } from './services/scryfall.js';
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

function expandNamedCards(cardsByName: Map<string, ScryfallCard>, entries: Array<{ name: string; quantity: number }>): ScryfallCard[] {
  const output: ScryfallCard[] = [];
  for (const entry of entries) {
    const card = cardsByName.get(entry.name.toLocaleLowerCase());
    if (!card) continue;
    for (let copy = 0; copy < entry.quantity; copy += 1) output.push(card);
  }
  return output;
}

export function createMtgServerV05() {
  const server = createMtgServerV04();

  server.registerTool(
    'card_intelligence_v05',
    {
      title: 'Explain a card, its best uses, rules hooks, and Commander fit',
      description:
        'Build a single V0.5 card-intelligence report from live Oracle data: strategic roles, practical best-use guidance, synergy hooks, advanced casting/payment mechanics, interaction/protection profile, combat characteristics, commander-dependency signals, rules attention points, and optional Commander color-identity/legality fit.',
      inputSchema: z.object({
        cardName: z.string().min(1).max(256),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ cardName, commanderNames }) => {
      try {
        const [card, ...commanders] = await Promise.all([
          lookupCard(cardName, true),
          ...commanderNames.map((name) => lookupCard(name, true)),
        ]);
        return jsonResult(buildCardIntelligenceV05(card, commanders));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'analyze_card_casting_v05',
    {
      title: 'Analyze advanced MTG casting/payment mechanics',
      description:
        'Analyze one card for V0.5 casting/payment behavior including convoke, improvise, delve, affinity, Phyrexian mana, named/pitch-style alternative costs, free-cast text, and Treasure generation. Commander tax is explicitly preserved as an additional cost when alternative/free casting applies.',
      inputSchema: z.object({
        cardName: z.string().min(1).max(256),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ cardName }) => {
      try {
        const card = await lookupCard(cardName, true);
        return jsonResult(analyzeCastingProfileV05(card));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'analyze_deck_casting_v05',
    {
      title: 'Analyze advanced casting and resource mechanics across a deck',
      description:
        'Resolve a deck and inventory V0.5 payment/resource mechanics across its exact cards: alternative/free costs, convoke, improvise, delve, affinity, Phyrexian mana, and Treasure generation. Returns card-level evidence instead of a single opaque score.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames }) => {
      try {
        const { parsed, cards, notFound } = await resolveDeck(decklist, commanderNames);
        const rows = [...parsed.commanders, ...parsed.main]
          .map((entry) => {
            const card = resolveEntryCard(entry, cards);
            return card ? { quantity: entry.quantity, card, profile: analyzeCastingProfileV05(card) } : null;
          })
          .filter((row): row is { quantity: number; card: ScryfallCard; profile: ReturnType<typeof analyzeCastingProfileV05> } => Boolean(row));

        const mechanics = new Map<string, number>();
        let immediateTreasureFloor = 0;
        let recurringTreasureCards = 0;
        for (const row of rows) {
          for (const mechanic of row.profile.paymentMechanics) {
            mechanics.set(mechanic, (mechanics.get(mechanic) ?? 0) + row.quantity);
          }
          immediateTreasureFloor += row.profile.treasure.immediateTreasure * row.quantity;
          if (row.profile.treasure.recurring) recurringTreasureCards += row.quantity;
        }

        return jsonResult({
          model: 'MTG Ultimate V0.5 casting/resource inventory',
          unresolvedCards: notFound,
          totals: {
            cardsRepresented: rows.reduce((sum, row) => sum + row.quantity, 0),
            paymentMechanics: Object.fromEntries([...mechanics.entries()].sort()),
            immediateTreasureTextFloorAcrossDeck: immediateTreasureFloor,
            recurringTreasureGeneratorCards: recurringTreasureCards,
          },
          cards: rows
            .filter((row) => row.profile.paymentMechanics.length > 0 || row.profile.treasure.createsTreasure)
            .map((row) => ({ quantity: row.quantity, ...row.profile })),
          caveat: 'Treasure counts are text-derived card/resource evidence, not a claim that every generator will trigger in every game.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'evaluate_interaction_exchange_v05',
    {
      title: 'Evaluate a counter/removal/protection exchange',
      description:
        'Evaluate a specific threat, answer, and optional protection response using common V0.5 counterspell/removal/protection patterns. Distinguishes definite, conditional, and unlikely lines instead of claiming to solve arbitrary Oracle text.',
      inputSchema: z.object({
        threatName: z.string().min(1).max(256),
        answerName: z.string().min(1).max(256),
        threatZone: z.enum(['stack', 'battlefield']).default('battlefield'),
        protectorName: z.string().min(1).max(256).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ threatName, answerName, threatZone, protectorName }) => {
      try {
        const resolved = await Promise.all([
          lookupCard(threatName, true),
          lookupCard(answerName, true),
          ...(protectorName ? [lookupCard(protectorName, true)] : []),
        ]);
        const threat = resolved[0] as ScryfallCard;
        const answer = resolved[1] as ScryfallCard;
        const protector = protectorName ? resolved[2] as ScryfallCard : undefined;
        return jsonResult(evaluateInteractionExchangeV05(threat, answer, threatZone, protector));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'simulate_combat_snapshot_v05',
    {
      title: 'Simulate a Commander combat snapshot',
      description:
        'Estimate one combat snapshot from named attackers and blockers using printed power/toughness plus common flying/reach/menace/trample/double-strike/deathtouch rules. Variable stats and unsupported continuous effects are surfaced as unresolved rather than treated as zero.',
      inputSchema: z.object({
        attackers: z.array(z.object({ name: z.string().min(1).max(256), quantity: z.number().int().min(1).max(100).optional().default(1) })).min(1).max(100),
        blockers: z.array(z.object({ name: z.string().min(1).max(256), quantity: z.number().int().min(1).max(100).optional().default(1) })).max(100).optional().default([]),
        commanderAttackers: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ attackers, blockers, commanderAttackers }) => {
      try {
        const names = [...new Set([...attackers, ...blockers].map((entry) => entry.name.toLocaleLowerCase()))];
        const resolved = await Promise.all(names.map((name) => lookupCard(name, true)));
        const cardsByName = new Map(resolved.map((card) => [card.name.toLocaleLowerCase(), card]));
        const attackerCards = expandNamedCards(cardsByName, attackers);
        const blockerCards = expandNamedCards(cardsByName, blockers);
        return jsonResult(simulateCombatSnapshotV05(attackerCards, blockerCards, commanderAttackers));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'analyze_commander_dependencies_v05',
    {
      title: 'Find commander-dependent cards in a deck',
      description:
        'Find resolved cards whose Oracle text depends on, references, or modifies your commander. Useful when testing how much a deck slows down after commander removal or repeated commander tax.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames }) => {
      try {
        const { parsed, cards, notFound } = await resolveDeck(decklist, commanderNames);
        const dependencies = [...parsed.commanders, ...parsed.main]
          .map((entry) => {
            const card = resolveEntryCard(entry, cards);
            if (!card) return null;
            const dependency = analyzeCommanderDependencyV05(card);
            return dependency.dependsOnCommander ? { quantity: entry.quantity, ...dependency } : null;
          })
          .filter((value): value is { quantity: number } & ReturnType<typeof analyzeCommanderDependencyV05> => Boolean(value));
        return jsonResult({
          unresolvedCards: notFound,
          commanderDependentCardCount: dependencies.reduce((sum, row) => sum + row.quantity, 0),
          dependencies,
          interpretation: 'A high count can indicate that commander removal/tax affects more than merely access to the commander itself.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
