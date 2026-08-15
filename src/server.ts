import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { analyzeResolvedDeck, parseDecklist } from './services/deck.js';
import {
  getCardsByNames,
  lookupCard,
  searchCards,
  summarizeCard,
} from './services/scryfall.js';
import {
  estimateCommanderBracket,
  findDeckCombos,
} from './services/spellbook.js';

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

export function createMtgServer(): McpServer {
  const server = new McpServer({
    name: 'mtg-ultimate-mcp',
    title: 'MTG Ultimate',
    version: '0.1.0',
    description:
      'Magic: The Gathering card knowledge, Commander deck analysis, combo discovery, and bracket estimation backed by live MTG data sources.',
  });

  server.registerTool(
    'card_lookup',
    {
      title: 'Look up an MTG card',
      description:
        'Look up a Magic card by name using Scryfall. Returns Oracle text, color identity, Commander legality, prices, printing data, keywords, and heuristic strategic roles. Prefer this over recalling card text from memory.',
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
        'Resolve two Magic cards from live card data and return them side by side. Use the returned Oracle text, mana value, roles, legality, and prices to explain which card better fits a deck or game plan.',
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
        'Parse a decklist and analyze deck size, card types, mana value, color identity, Commander legality, singleton violations, and strategic role counts. Set commanderNames when the list does not contain a Commander section.',
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

  return server;
}
