import * as z from 'zod/v4';
import { createMtgServer } from './server.js';
import { validateCommanderDeck } from './services/commander-rules.js';
import { parseDecklist } from './services/deck.js';
import { analyzeManaBaseV04 } from './services/mana-v04.js';
import { simulatePodPressureV04 } from './services/pressure-v04.js';
import { getCardsByIdentifiers, lookupCard } from './services/scryfall.js';

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

export function createMtgServerV04() {
  const server = createMtgServer();

  server.registerTool(
    'check_commander_rules',
    {
      title: 'Check Commander deck construction rules',
      description:
        'Hard-validate a Commander deck against core construction rules: exactly 100 cards, commander eligibility, one/two commander pairing rules, combined color identity, Commander format legality/bans, basic-land-type color restrictions, singleton/copy-count exceptions, and unresolved cards. A red-black commander therefore permits only black, red, black-red, and colorless card identities. Hybrid cards count as all colors in their identity under the current rule.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames }) => {
      try {
        const { parsed, cards, notFound } = await resolveDeck(decklist, commanderNames);
        const result = validateCommanderDeck(parsed, cards);
        return jsonResult({
          ...result,
          upstreamUnresolved: notFound,
          authoritativeReferences: [
            'https://magic.wizards.com/en/rules',
            'https://magic.wizards.com/en/formats/commander',
          ],
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'check_card_for_commander',
    {
      title: 'Check whether a card can go in a Commander deck',
      description:
        'Check a candidate card against one or two commanders using current Commander color-identity and format-legality rules. This is useful for questions such as whether a blue card, hybrid card, or land is legal in a red-black commander deck.',
      inputSchema: z.object({
        commanderNames: z.array(z.string().min(1).max(256)).min(1).max(2),
        cardName: z.string().min(1).max(256),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ commanderNames, cardName }) => {
      try {
        const [candidate, ...commanders] = await Promise.all([
          lookupCard(cardName, true),
          ...commanderNames.map((name) => lookupCard(name, true)),
        ]);
        const commanderIdentity = [...new Set(commanders.flatMap((card) => card.color_identity))].sort();
        const outsideColors = candidate.color_identity.filter((color) => !commanderIdentity.includes(color));
        const commanderDeck = parseDecklist(
          `// COMMANDER\n${commanders.map((card) => `1 ${card.name}`).join('\n')}\n// MAIN\n1 ${candidate.name}`,
        );
        const pairingCheck = validateCommanderDeck(commanderDeck, [candidate, ...commanders]);
        const commanderPairingLegal = commanderNames.length === 1 || pairingCheck.pairing.legal === true;
        const formatLegal = candidate.legalities.commander === 'legal';
        const colorIdentityLegal = outsideColors.length === 0;
        return jsonResult({
          candidate: {
            name: candidate.name,
            colorIdentity: candidate.color_identity,
            commanderLegality: candidate.legalities.commander ?? 'unknown',
            set: candidate.set.toUpperCase(),
            collectorNumber: candidate.collector_number,
          },
          commanders: commanders.map((card) => ({ name: card.name, colorIdentity: card.color_identity })),
          combinedCommanderColorIdentity: commanderIdentity,
          outsideColors,
          commanderPairing: pairingCheck.pairing,
          legalForTheseCommanders: commanderPairingLegal && formatLegal && colorIdentityLegal,
          explanation: !commanderPairingLegal
            ? 'The designated two-commanders configuration is not a legal pairing.'
            : !formatLegal
              ? 'The candidate is not legal in the Commander format.'
              : !colorIdentityLegal
                ? `The candidate contains color identity outside the commanders’ combined identity: ${outsideColors.join(', ')}.`
                : 'The candidate’s color identity is a subset of the commanders’ combined color identity and it is Commander-legal.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'analyze_mana_base_v04',
    {
      title: 'Analyze Commander mana base with exact land rules',
      description:
        'Analyze a resolved Commander mana base using actual card text/land types. Distinguishes shock/check/fast/slow/reveal/multiplayer/tapped lands, commander-identity mana, restricted mana, cost reducers, and fetch lands with the legal targets that actually exist in this deck.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames }) => {
      try {
        const { parsed, cards, notFound } = await resolveDeck(decklist, commanderNames);
        return jsonResult({
          ...analyzeManaBaseV04(parsed, cards),
          unresolvedCards: notFound,
          commanderRules: validateCommanderDeck(parsed, cards),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'simulate_pod_pressure_v04',
    {
      title: 'Simulate Commander consistency under pod pressure',
      description:
        'Layer explicit opponent-pressure assumptions over the colored-mana consistency model. Simulates commander removal/recast pressure, +2/+4 commander tax affordability, key-spell interaction windows, and a protection-density proxy. Pressure rates are visible/configurable assumptions, not claimed real-world win rates.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000),
        commanderNames: z.array(z.string().min(1).max(256)).max(2).optional().default([]),
        iterations: z.number().int().min(250).max(50_000).optional().default(5_000),
        turns: z.number().int().min(3).max(15).optional().default(8),
        seed: z.number().int().min(1).max(2_147_483_647).optional().default(20_260_816),
        maxMulligans: z.number().int().min(0).max(4).optional().default(2),
        comboPieces: z.array(z.array(z.string().min(1).max(256)).min(2).max(6)).max(8).optional().default([]),
        podProfile: z.enum(['goldfish', 'casual', 'core', 'upgraded', 'optimized', 'cedh']).optional().default('upgraded'),
        customPressure: z.object({
          commanderRemovalPerTurn: z.number().min(0).max(1).optional(),
          keySpellInteractionChance: z.number().min(0).max(1).optional(),
          boardResetPerTurn: z.number().min(0).max(1).optional(),
        }).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanderNames, iterations, turns, seed, maxMulligans, comboPieces, podProfile, customPressure }) => {
      try {
        const { parsed, cards, notFound } = await resolveDeck(decklist, commanderNames);
        const rules = validateCommanderDeck(parsed, cards);
        if (notFound.length > 0 || rules.status === 'incomplete') {
          return jsonResult({
            error: 'Resolve the deck fully before pressure simulation.',
            unresolvedCards: notFound,
            commanderRules: rules,
          });
        }
        if (!rules.isLegal) {
          return jsonResult({
            error: 'This deck fails Commander construction rules. Fix legality before interpreting simulation results.',
            commanderRules: rules,
          });
        }
        return jsonResult({
          commanderRules: rules,
          manaBase: analyzeManaBaseV04(parsed, cards),
          simulation: simulatePodPressureV04(parsed, cards, {
            iterations,
            turns,
            seed,
            maxMulligans,
            comboPieces,
            podProfile,
            ...(customPressure ? { customPressure } : {}),
          }),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
