import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { compareDeckPerformanceProfiles } from './services/comparison.js';
import { analyzeResolvedDeck, buildDeckPricing, parseDecklist, resolveEntryCard } from './services/deck.js';
import { analyzeArchidektReferences, analyzeTopDeckTournamentReferences } from './services/references.js';
import {
  getCardPrintings,
  getCardsByIdentifiers,
  lookupCard,
  lookupPrinting,
  searchCards,
  summarizeCard,
} from './services/scryfall.js';
import { simulateDeckConsistency } from './services/simulation.js';
import { estimateCommanderBracket, findDeckCombos } from './services/spellbook.js';
import { suggestDeckUpgrades } from './services/upgrade.js';
import type { ScryfallCard } from './types/scryfall.js';

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
  const identifiers = [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
  const resolved = await getCardsByIdentifiers(identifiers);
  return { parsed, ...resolved };
}

function commanderIdentity(parsed: ReturnType<typeof parseDecklist>, cards: ScryfallCard[]): string[] {
  const commanders = parsed.commanders
    .map((entry) => resolveEntryCard(entry, cards))
    .filter((card): card is ScryfallCard => Boolean(card));
  const source = commanders.length > 0 ? commanders : cards;
  return [...new Set(source.flatMap((card) => card.color_identity))].sort();
}

function numericPrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function priceForFinish(card: ScryfallCard, finish: 'nonfoil' | 'foil' | 'etched' | 'any'): number | null {
  const prices = card.prices ?? {};
  if (finish === 'nonfoil') return numericPrice(prices.usd);
  if (finish === 'foil') return numericPrice(prices.usd_foil);
  if (finish === 'etched') return numericPrice(prices.usd_etched);
  const values = [prices.usd, prices.usd_foil, prices.usd_etched]
    .map(numericPrice)
    .filter((value): value is number => value !== null);
  return values.length > 0 ? Math.min(...values) : null;
}

export function createMtgServer(): McpServer {
  const server = new McpServer({
    name: 'mtg-ultimate-mcp',
    title: 'MTG Ultimate',
    version: '0.3.0',
    description:
      'Magic: The Gathering card and printing knowledge, Commander deck analysis, pricing, combo discovery, colored-mana simulations, deck comparisons, community/tournament references, upgrade recommendations, and bracket estimation backed by live MTG data sources.',
  });

  server.registerTool(
    'card_lookup',
    {
      title: 'Look up an MTG card',
      description:
        'Look up a Magic card by name using Scryfall. Optionally constrain to a set code. Returns Oracle identity plus the resolved physical printing, price fields, legality, and strategic roles.',
      inputSchema: z.object({
        name: z.string().min(1).max(256),
        exact: z.boolean().optional().default(false),
        set: z.string().min(2).max(12).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ name, exact, set }) => {
      try {
        return jsonResult(summarizeCard(await lookupCard(name, exact, set)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'printing_lookup',
    {
      title: 'Look up an exact MTG printing',
      description:
        'Resolve a physical Magic printing by expansion/set code and collector number. Use this when edition-specific pricing matters.',
      inputSchema: z.object({
        set: z.string().min(2).max(12).describe('Set/expansion code, such as CMM, LTC, FIN, or SLD.'),
        collectorNumber: z.string().min(1).max(32),
        language: z.string().min(2).max(8).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ set, collectorNumber, language }) => {
      try {
        return jsonResult(summarizeCard(await lookupPrinting(set, collectorNumber, language)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'card_printings',
    {
      title: 'List all printings and prices for an MTG card',
      description:
        'List physical/digital printings of the same Oracle card with set code, set name, collector number, release date, finish availability, and printing-specific price fields. Useful when releases have different prices.',
      inputSchema: z.object({
        name: z.string().min(1).max(256),
        limit: z.number().int().min(1).max(250).optional().default(100),
        includeDigital: z.boolean().optional().default(false),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ name, limit, includeDigital }) => {
      try {
        const printings = (await getCardPrintings(name, limit)).filter((card) => includeDigital || !card.digital);
        return jsonResult({
          name,
          count: printings.length,
          printings: printings.map(summarizeCard),
          note: 'Each row is a distinct Scryfall printing; price fields belong to that printing, not to the Oracle card globally.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'compare_printing_prices',
    {
      title: 'Compare prices across MTG printings',
      description:
        'Find and sort printings of one card by current Scryfall USD reference price for nonfoil, foil, etched, or the cheapest available finish. Keeps set codes and collector numbers attached to every price.',
      inputSchema: z.object({
        name: z.string().min(1).max(256),
        finish: z.enum(['nonfoil', 'foil', 'etched', 'any']).optional().default('nonfoil'),
        includeDigital: z.boolean().optional().default(false),
        limit: z.number().int().min(1).max(250).optional().default(100),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ name, finish, includeDigital, limit }) => {
      try {
        const printings = (await getCardPrintings(name, 250))
          .filter((card) => includeDigital || !card.digital)
          .map((card) => ({ card, price: priceForFinish(card, finish) }))
          .filter((row): row is { card: ScryfallCard; price: number } => row.price !== null)
          .sort((a, b) => a.price - b.price)
          .slice(0, limit);
        return jsonResult({
          name,
          finish,
          count: printings.length,
          currency: 'USD',
          printings: printings.map(({ card, price }) => ({
            price,
            ...summarizeCard(card),
          })),
          caveat: 'These are live reference fields from Scryfall and are not NZ-local retail quotes.',
        });
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
        'Search Scryfall using Scryfall search syntax. Use for legal cards by color identity, Oracle text, type, mana value, set, theme, or other constraints.',
      inputSchema: z.object({
        query: z.string().min(1).max(1_000),
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
        'Resolve two Magic cards side by side for Oracle text, mana, strategic roles, legality, community rank, and resolved-printing prices.',
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
      title: 'Analyze and value a Commander deck',
      description:
        'Parse a Commander decklist and analyze structure, legality, curve, colored pips, roles, exact physical printing identity, and printing-specific Scryfall value. Lines such as `1 Sol Ring (CMM) 396` resolve that exact edition.',
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
        const { cards, notFound } = await resolveDeck(decklist, commanderNames);
        return jsonResult(analyzeResolvedDeck(parsed, cards, notFound));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'price_deck_printings',
    {
      title: 'Price exact MTG deck printings',
      description:
        'Resolve set codes and collector numbers from a pasted decklist and calculate a printing-aware USD reference value. Flags cards where the physical printing was not specified.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(12).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames }) => {
      try {
        const { parsed, cards, notFound } = await resolveDeck(decklist, commanderNames);
        return jsonResult({ unresolvedCards: notFound, pricing: buildDeckPricing(parsed, cards) });
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
        'Run deterministic V0.3 Commander consistency simulations with colored mana requirements, tapped-land tempo, MDFC land choices, differentiated ramp sequencing, commander tax scenarios, mulligans, early interaction/draw, and combo assembly proxies.',
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
          return jsonResult({ error: 'Resolve all or nearly all cards before simulation.', unresolvedCards: notFound, resolvedCards: cards.length });
        }
        return jsonResult(simulateDeckConsistency(parsed, cards, { iterations, turns, seed, maxMulligans, comboPieces }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'compare_deck_performance_profiles',
    {
      title: 'Compare why two Commander decks perform differently',
      description:
        'Run identical structural and same-seed simulation analysis on two lists and surface candidate explanations for consistency/performance differences without claiming causation.',
      inputSchema: z.object({
        firstDecklist: z.string().min(1).max(100_000),
        firstLabel: z.string().min(1).max(100).optional().default('First deck'),
        firstCommanderNames: z.array(z.string().min(1).max(256)).max(12).optional().default([]),
        secondDecklist: z.string().min(1).max(100_000),
        secondLabel: z.string().min(1).max(100).optional().default('Second deck'),
        secondCommanderNames: z.array(z.string().min(1).max(256)).max(12).optional().default([]),
        iterations: z.number().int().min(250).max(50_000).optional().default(5_000),
        turns: z.number().int().min(3).max(12).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(2_026),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ firstDecklist, firstLabel, firstCommanderNames, secondDecklist, secondLabel, secondCommanderNames, iterations, turns, seed }) => {
      try {
        const [first, second] = await Promise.all([
          resolveDeck(firstDecklist, firstCommanderNames),
          resolveDeck(secondDecklist, secondCommanderNames),
        ]);
        if (first.notFound.length > 0 || second.notFound.length > 0) {
          return jsonResult({
            error: 'Both decks should resolve fully before performance-profile comparison.',
            firstUnresolvedCards: first.notFound,
            secondUnresolvedCards: second.notFound,
          });
        }
        return jsonResult(
          compareDeckPerformanceProfiles(
            { label: firstLabel, parsed: first.parsed, cards: first.cards },
            { label: secondLabel, parsed: second.parsed, cards: second.cards },
            { iterations, turns, seed },
          ),
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
        'Use Commander Spellbook to find combos already present plus near-combos the list is close to completing.',
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
        'Use Commander Spellbook current bracket evidence to surface classification, Game Changers, banned cards, MLD/extra-turn flags, and relevant combos.',
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
        'Load public Archidekt references, preserve creator/source attribution, compare structural metrics and common cards, and optionally compare them with a target deck.',
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
        'Use TopDeck.gg EDH results and submitted decklists to compare observed higher- and lower-performing structures. Requires TOPDECK_API_KEY and treats differences as associations rather than causal proof.',
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
        'Detect structural deficits and search current Scryfall data for legal candidate upgrades under optional price, set, theme, and exclusion constraints.',
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
