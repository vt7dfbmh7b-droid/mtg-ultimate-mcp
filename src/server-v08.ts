import * as z from 'zod/v4';
import { createMtgServerV07 } from './server-v07.js';
import { validateCommanderDeck } from './services/commander-rules.js';
import { buildCommanderDeckDraftV07, buildSimulationBackedUpgradePlanV07 } from './services/deck-builder-v07.js';
import { normalizeDeckToPrintingPolicyV08, auditResolvedDeckPrintingPolicyV08 } from './services/deck-printing-policy-v08.js';
import { parseDecklist } from './services/deck.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
} from './services/printing-policy-v08.js';
import {
  getCardPrintings,
  getCardsByIdentifiers,
  lookupCard,
  lookupPrinting,
  summarizeCard,
  type CardIdentifierInput,
} from './services/scryfall.js';
import type { ScryfallCard } from './types/scryfall.js';

const jsonResult = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const errorResult = (error: unknown) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }],
  isError: true,
});

const cardRefSchema = z.object({
  name: z.string().min(1).max(256),
  set: z.string().min(2).max(12).optional(),
  collectorNumber: z.string().min(1).max(32).optional(),
});

const printingPolicySchema = {
  printingFamily: z.string().min(1).max(120).optional(),
  allowedSets: z.array(z.string().min(2).max(12)).max(50).optional().default([]),
  includePromos: z.boolean().optional().default(true),
  includeSpecialReleases: z.boolean().optional().default(true),
};

function refInput(ref: { name: string; set?: string | undefined; collectorNumber?: string | undefined }): CardIdentifierInput {
  return {
    name: ref.name,
    ...(ref.set ? { set: ref.set } : {}),
    ...(ref.collectorNumber ? { collectorNumber: ref.collectorNumber } : {}),
  };
}

async function resolveCardRef(ref: { name: string; set?: string | undefined; collectorNumber?: string | undefined }): Promise<ScryfallCard> {
  if (ref.set && ref.collectorNumber) return lookupPrinting(ref.set, ref.collectorNumber);
  return lookupCard(ref.name, false, ref.set);
}

async function resolveDeck(decklist: string, commanderNames: string[]) {
  const parsed = parseDecklist(decklist, commanderNames);
  const identifiers: CardIdentifierInput[] = [...parsed.commanders, ...parsed.main].map((entry) => refInput({
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

async function policyFromInput(input: {
  printingFamily?: string | undefined;
  allowedSets: string[];
  includePromos: boolean;
  includeSpecialReleases: boolean;
}) {
  return resolvePrintingPolicyV08({
    allowedSets: input.allowedSets,
    ...(input.printingFamily ? { printingFamily: input.printingFamily } : {}),
    includePromos: input.includePromos,
    includeSpecialReleases: input.includeSpecialReleases,
  });
}

export function createMtgServerV08() {
  const server = createMtgServerV07();

  server.registerTool(
    'find_printings_in_family_v08',
    {
      title: 'Find themed physical printings of a card',
      description: 'List the exact physical printings of an Oracle card that satisfy a printing-family policy such as Final Fantasy, including qualifying promos and curated special releases while excluding unrelated editions.',
      inputSchema: z.object({
        card: z.string().min(1).max(256),
        ...printingPolicySchema,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ card, printingFamily, allowedSets, includePromos, includeSpecialReleases }) => {
      try {
        const policy = await policyFromInput({ printingFamily, allowedSets, includePromos, includeSpecialReleases });
        const printings = await getCardPrintings(card, 250);
        const eligible = printings.filter((printing) => printingMatchesPolicyV08(printing, policy));
        return jsonResult({
          card,
          printingPolicy: describePrintingPolicyV08(policy),
          eligiblePrintings: eligible.map(summarizeCard),
          count: eligible.length,
          responseGuidance: 'Keep the answer simple: name the qualifying set/collector versions and mention promo or special-release status only when useful.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'normalize_deck_printings_v08',
    {
      title: 'Convert a deck to one themed printing family',
      description: 'Rewrite every card in a deck to an eligible physical printing from the requested family/set policy. If an Oracle card has no qualifying printing, report it instead of silently using an unrelated edition.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
        maxUsdPerCard: z.number().positive().max(100_000).optional(),
        ...printingPolicySchema,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames, maxUsdPerCard, printingFamily, allowedSets, includePromos, includeSpecialReleases }) => {
      try {
        const deck = await resolveDeck(decklist, commanderNames);
        if (deck.notFound.length > 0) return jsonResult({ error: 'Resolve the deck first.', unresolvedCards: deck.notFound });
        const policy = await policyFromInput({ printingFamily, allowedSets, includePromos, includeSpecialReleases });
        const normalized = await normalizeDeckToPrintingPolicyV08(deck.parsed, deck.cards, policy, maxUsdPerCard);
        return jsonResult(normalized);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'build_commander_deck_v08',
    {
      title: 'Build a Commander deck with themed printing restrictions',
      description: 'Build a complete Commander draft while enforcing Commander legality plus physical printing-family restrictions. Final Fantasy mode includes matching family sets, qualifying promos, and curated Final Fantasy special/Secret Lair printings by default.',
      inputSchema: z.object({
        commanders: z.array(cardRefSchema).min(1).max(2),
        targetBracket: z.number().int().min(1).max(5).optional().default(4),
        themeQuery: z.string().min(1).max(500).optional(),
        maxUsdPerCard: z.number().positive().max(100_000).optional(),
        excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        mustInclude: z.array(z.string().min(1).max(256)).max(50).optional().default([]),
        landCount: z.number().int().min(26).max(44).optional(),
        maxNonbasicLands: z.number().int().min(0).max(44).optional(),
        ...printingPolicySchema,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ commanders, targetBracket, themeQuery, maxUsdPerCard, excludedCards, mustInclude, landCount, maxNonbasicLands, printingFamily, allowedSets, includePromos, includeSpecialReleases }) => {
      try {
        const commanderCards: ScryfallCard[] = [];
        for (const commander of commanders) commanderCards.push(await resolveCardRef(commander));
        const draft = await buildCommanderDeckDraftV07(commanderCards, {
          targetBracket,
          ...(themeQuery ? { themeQuery } : {}),
          ...(maxUsdPerCard !== undefined ? { maxUsdPerCard } : {}),
          allowedSets,
          ...(printingFamily ? { printingFamily } : {}),
          includePromos,
          includeSpecialReleases,
          excludedCards,
          mustInclude,
          ...(landCount !== undefined ? { landCount } : {}),
          ...(maxNonbasicLands !== undefined ? { maxNonbasicLands } : {}),
        });
        return jsonResult({
          draft,
          responseGuidance: 'Present the clean decklist first. If a family restriction prevented a complete 100-card list, say which role or card availability caused the gap rather than filling it with off-theme editions.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'plan_commander_upgrade_v08',
    {
      title: 'Upgrade a Commander deck with themed printing restrictions',
      description: 'Generate exact IN/OUT swaps while requiring all suggested additions to have a qualifying themed physical printing, with promo/special-release support and edition-specific pricing.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
        targetBracket: z.number().int().min(1).max(5).optional().default(4),
        maxUsdPerCard: z.number().positive().max(100_000).optional(),
        themeQuery: z.string().min(1).max(500).optional(),
        excludedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        protectedCards: z.array(z.string().min(1).max(256)).max(300).optional().default([]),
        maxSwaps: z.number().int().min(1).max(15).optional().default(8),
        simulationIterations: z.number().int().min(100).max(5_000).optional().default(750),
        simulationTurns: z.number().int().min(3).max(12).optional().default(7),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
        ...printingPolicySchema,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames, targetBracket, maxUsdPerCard, themeQuery, excludedCards, protectedCards, maxSwaps, simulationIterations, simulationTurns, seed, printingFamily, allowedSets, includePromos, includeSpecialReleases }) => {
      try {
        const current = await resolveDeck(decklist, commanderNames);
        const commanderRules = validateCommanderDeck(current.parsed, current.cards);
        if (current.notFound.length > 0 || !commanderRules.isLegal) {
          return jsonResult({ error: 'A fully resolved Commander-legal deck is required.', unresolvedCards: current.notFound, commanderRules });
        }
        const policy = await policyFromInput({ printingFamily, allowedSets, includePromos, includeSpecialReleases });
        const beforePrintingAudit = auditResolvedDeckPrintingPolicyV08(current.parsed, current.cards, policy);
        const plan = await buildSimulationBackedUpgradePlanV07(
          current.parsed,
          current.cards,
          commanderIdentity(current.parsed, current.cards),
          {
            targetBracket,
            ...(maxUsdPerCard !== undefined ? { maxUsdPerCard } : {}),
            allowedSets,
            ...(printingFamily ? { printingFamily } : {}),
            includePromos,
            includeSpecialReleases,
            ...(themeQuery ? { themeQuery } : {}),
            excludedCards,
            protectedCards,
            maxSwaps,
            simulationIterations,
            simulationTurns,
            seed,
          },
        );
        return jsonResult({
          commanderRules,
          beforePrintingAudit,
          plan,
          printingPolicy: describePrintingPolicyV08(policy),
          responseGuidance: 'Lead with exact OUT → IN swaps and the qualifying set/collector printing. If the existing deck itself contains off-family printings, call that out separately from card-choice upgrades.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
