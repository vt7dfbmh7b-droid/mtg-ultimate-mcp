import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { analyzeResolvedDeck, parseDecklist } from './services/deck.js';
import { analyzeArchidektReferences, analyzeTopDeckTournamentReferences } from './services/references.js';
import {
  getCardsByNames,
  lookupCard,
  searchCards,
  summarizeCard,
} from './services/scryfall.js';
import { simulateDeckConsistency } from './services/simulation.js';
import {
  estimateCommanderBracket,
  findDeckCombos,
} from './services/spellbook.js';
import { suggestDeckUpgrades } from './services/upgrade.js';

const jsonResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const errorResult = (error: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : `Unexpected error: ${String(error)}`,
    },
  ],
  isError: true,
});

async function resolveDeck(decklist: string, commanderNames: string[]) {
  const parsed = parseDecklist(decklist, commanderNames);
  const names = [...parsed.commanders, ...parsed.main].map((entry) => entry.name);
  const resolved = await getCardsByNames(names);
  return { parsed, ...resolved };
}

function commanderIdentity(
  parsed: ReturnType<typeof parseDecklist>,
  cards: Awaited<ReturnType<typeof getCardsByNames>>['cards'],
): string[] {
  const commanderNames = new Set(parsed.commanders.map((entry) => entry.name.toLocaleLowerCase()));
  const commanders = cards.filter((card) => commanderNames.has(card.name.toLocaleLowerCase()));
  const source = commanders.length > 0 ? commanders : cards;
  return [...new Set(source.flatMap((card) => card.color_identity))].sort();
}

export function createMtgServer(): McpServer {
  const server = new McpServer({
    name: 'mtg-ultimate-mcp',
    title: 'MTG Ultimate',
    version: '0.2.0',
    description:
      'Magic: The Gathering card knowledge, Commander deck analysis, combo discovery, simulations, community/tournament references, upgrade recommendations, and bracket estimation backed by live MTG data sources.',
  });

  server.registerTool(
    'card_lookup',
    {
      title: 'Look up an MTG card',
      description:
        'Look up a Magic card by name using Scryfall. Returns Oracle text, color identity, Commander legality, prices, printing data, keywords, EDHREC rank when available, and heuristic strategic roles. Prefer this over recalling card text from memory.',
      inputSchema: z.object({
        name: z.string().min(1).max(256).describe('Card name. Fuzzy matching is used by default.'),
        exact: z.boolean().optional().default(false),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ name, exact }) => {
      try {
        return jsonResult(summarizeCard(await lookupCard(name, exact)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'card_search',
    {
      title: 'Search MTG cards',
      description:
        'Search Scryfall using Scryfall search syntax. Use for finding legal cards by color identity, text, type, mana value, set, theme, or other constraints. Results include Oracle text and strategic role tags.',
      inputSchema: z.object({
        query: z.string().min(1).max(1_000).describe('A Scryfall search query.'),
        limit: z.number().int().min(1).max(50).optional().default(10),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      try {
        const cards = await searchCards(query, limit);
        return jsonResult({ query, count: cards.length, cards: cards.map(summarizeCard) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'compare_cards',
    {
      title: 'Compare MTG cards',
      description:
        'Resolve two Magic cards from live card data and return them side by side. Use the returned Oracle text, mana value, roles, legality, community rank, and prices to explain which card better fits a deck or game plan.',
      inputSchema: z.object({
        first: z.string().min(1).max(256),
        second: z.string().min(1).max(256),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ first, second }) => {
      try {
        const [firstCard, secondCard] = await Promise.all([lookupCard(first), lookupCard(second)]);
        return jsonResult({ first: summarizeCard(firstCard), second: summarizeCard(secondCard) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'analyze_deck',
    {
      title: 'Analyze a Commander deck',
      description:
        'Parse a decklist and deeply analyze deck size, card types, curve, colored mana pips, early-play density, ramp, draw, tutors, interaction, protection, recursion, color identity, Commander legality, singleton violations, and structural warning signals.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(12).optional().default([]),
        resolveCards: z.boolean().optional().default(true),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames, resolveCards }) => {
      try {
        const parsed = parseDecklist(decklist, commanderNames);
        if (!resolveCards) return jsonResult({ parsed });
        const names = [...parsed.commanders, ...parsed.main].map((entry) => entry.name);
        const { cards, notFound } = await getCardsByNames(names);
        return jsonResult(analyzeResolvedDeck(parsed, cards, notFound));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'simulate_deck_consistency',
    {
      title: 'Monte Carlo simulate a Commander deck',
      description:
        'Run thousands of deterministic Monte Carlo goldfish simulations to estimate opening-hand quality, mulligans, land development, mana by turn, commander castability, early interaction/draw availability, mana-screw/flood proxies, and natural/tutor-proxy combo assembly. This is a consistency model, not a full MTG rules engine.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(12).optional().default([]),
        iterations: z.number().int().min(100).max(50_000).optional().default(5_000),
        turns: z.number().int().min(1).max(15).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(1_337),
        maxMulligans: z.number().int().min(0).max(4).optional().default(2),
        comboPieces: z.array(z.array(z.string().min(1).max(256)).min(2).max(6)).max(8).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames, iterations, turns, seed, maxMulligans, comboPieces }) => {
      try {
        const { parsed, cards, notFound } = await resolveDeck(decklist, commanderNames);
        if (notFound.length > 0) {
          return jsonResult({
            error: 'Resolve all or nearly all cards before simulation.',
            unresolvedCards: notFound,
            resolvedCards: cards.length,
          });
        }
        return jsonResult(
          simulateDeckConsistency(parsed, cards, {
            iterations,
            turns,
            seed,
            maxMulligans,
            comboPieces,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'find_deck_combos',
    {
      title: 'Find combos in a Commander deck',
      description:
        'Send a Commander decklist to Commander Spellbook and return known combos already in the deck plus combos the deck is close to completing. Include a Commander section or commander tags when possible.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        maxResultsPerCategory: z.number().int().min(1).max(100).optional().default(20),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, maxResultsPerCategory }) => {
      try {
        return jsonResult(await findDeckCombos(decklist, maxResultsPerCategory));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'estimate_commander_bracket',
    {
      title: 'Estimate Commander bracket',
      description:
        'Use Commander Spellbook’s current bracket estimator to classify a deck and surface bracket-relevant cards and combos, including banned cards, Game Changers, mass land denial, extra turns, and strategically relevant combos.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        unknownCommanders: z.boolean().optional().default(false),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, unknownCommanders }) => {
      try {
        return jsonResult(await estimateCommanderBracket(decklist, unknownCommanders));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'analyze_archidekt_references',
    {
      title: 'Analyze public Archidekt reference decks',
      description:
        'Load up to ten public Archidekt deck IDs/URLs, credit the original creators, compare their structural metrics and common card choices, and optionally show which common reference cards are missing from a target deck. Use as community evidence, not as proof of match performance.',
      inputSchema: z.object({
        references: z.array(z.union([z.string().min(1).max(1_000), z.number().int().positive()])).min(1).max(10),
        targetDecklist: z.string().min(1).max(100_000).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ references, targetDecklist }) => {
      try {
        return jsonResult(await analyzeArchidektReferences(references, targetDecklist));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'analyze_tournament_results',
    {
      title: 'Analyze real EDH tournament deck outcomes',
      description:
        'Use TopDeck.gg EDH tournament results and submitted decklists to compare higher- and lower-performing sampled lists. Returns observed wins/draws/losses plus structural associations such as curve, fast mana, interaction, tutors, draw, protection, and early-action density. Requires TOPDECK_API_KEY and treats associations as correlation, not causation.',
      inputSchema: z.object({
        lastDays: z.number().int().min(1).max(365).optional().default(90),
        participantMin: z.number().int().min(4).max(500).optional().default(16),
        commanderName: z.string().min(1).max(256).optional(),
        sampleLimit: z.number().int().min(4).max(40).optional().default(16),
        minGames: z.number().int().min(1).max(20).optional().default(3),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ lastDays, participantMin, commanderName, sampleLimit, minGames }) => {
      try {
        return jsonResult(
          await analyzeTopDeckTournamentReferences({
            lastDays,
            participantMin,
            ...(commanderName ? { commanderName } : {}),
            sampleLimit,
            minGames,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'suggest_upgrades',
    {
      title: 'Suggest Commander upgrades and cuts',
      description:
        'Analyze structural deficits and search current Scryfall data for legal candidate upgrades under optional per-card USD, set, theme-query, and exclusion constraints. Returns candidate adds grouped by role deficit and cautious cut candidates. Role-count targets are heuristics, not official bracket rules.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(12).optional().default([]),
        targetBracket: z.number().int().min(1).max(5).optional().default(4),
        maxUsdPerCard: z.number().positive().max(10_000).optional(),
        allowedSets: z.array(z.string().min(2).max(12)).max(20).optional().default([]),
        themeQuery: z.string().min(1).max(500).optional(),
        excludedCards: z.array(z.string().min(1).max(256)).max(200).optional().default([]),
        maxCandidatesPerRole: z.number().int().min(1).max(10).optional().default(5),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames, targetBracket, maxUsdPerCard, allowedSets, themeQuery, excludedCards, maxCandidatesPerRole }) => {
      try {
        const { parsed, cards } = await resolveDeck(decklist, commanderNames);
        const identity = commanderIdentity(parsed, cards);
        return jsonResult(
          await suggestDeckUpgrades(parsed, cards, identity, {
            targetBracket,
            ...(maxUsdPerCard !== undefined ? { maxUsdPerCard } : {}),
            allowedSets,
            ...(themeQuery ? { themeQuery } : {}),
            excludedCards,
            maxCandidatesPerRole,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
