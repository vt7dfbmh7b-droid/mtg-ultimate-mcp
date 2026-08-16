import * as z from 'zod/v4';
import { createMtgServerV08 } from './server-v08.js';
import {
  buildResearchLinksV09,
  evidenceSourcesForV09,
  evidenceWeightingGuideV09,
  fetchEdhTop16CommanderEntriesV09,
  type EvidenceFocusV09,
} from './services/evidence-sources-v09.js';
import { analyzeArchidektReferences, analyzeTopDeckTournamentReferences } from './services/references.js';

const jsonResult = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const errorResult = (error: unknown) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }],
  isError: true,
});

const focusSchema = z.enum([
  'rules',
  'cards',
  'combos',
  'community',
  'competitive',
  'recorded-games',
  'decklists',
  'deck-analysis',
  'pricing',
  'nz-availability',
]);

export function createMtgServerV09() {
  const server = createMtgServerV08();

  server.registerTool(
    'list_reference_sources_v09',
    {
      title: 'List MTG cross-reference sources',
      description: 'Show the evidence sources MTG Ultimate can use or reference, what each source is good for, how strongly it should be weighted, and important cautions against misusing popularity or one-site scores.',
      inputSchema: z.object({
        focuses: z.array(focusSchema).max(10).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ focuses }) => {
      try {
        return jsonResult({
          sources: evidenceSourcesForV09(focuses as EvidenceFocusV09[]),
          weightingGuide: evidenceWeightingGuideV09(),
          responseGuidance: 'Keep this simple. Explain which 3–5 sources matter most for the user’s current question rather than listing everything unless asked.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'research_commander_across_sources_v09',
    {
      title: 'Cross-reference a Commander across MTG sources',
      description: 'Build a multi-source research packet for one or two commanders using live EDHTop16 tournament evidence plus research links and source weighting for EDHREC, cEDH DDB, Moxfield, MTGGoldfish, AetherHub, Playgroup.gg, DeckCheck, TCGfind NZ and the existing MTG Ultimate sources.',
      inputSchema: z.object({
        commanders: z.array(z.string().min(1).max(256)).min(1).max(2),
        cards: z.array(z.string().min(1).max(256)).max(20).optional().default([]),
        focuses: z.array(focusSchema).max(10).optional().default(['community', 'competitive', 'decklists']),
        includeEdhTop16: z.boolean().optional().default(true),
        lastDays: z.number().int().min(1).max(730).optional().default(180),
        minTournamentSize: z.number().int().min(4).max(1000).optional().default(32),
        maxStanding: z.number().int().min(1).max(500).optional().default(16),
        resultLimit: z.number().int().min(1).max(100).optional().default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ commanders, cards, focuses, includeEdhTop16, lastDays, minTournamentSize, maxStanding, resultLimit }) => {
      try {
        let edhTop16: Record<string, unknown> | null = null;
        let edhTop16Error: string | null = null;
        if (includeEdhTop16) {
          try {
            edhTop16 = await fetchEdhTop16CommanderEntriesV09({
              commanders,
              lastDays,
              minTournamentSize,
              maxStanding,
              limit: resultLimit,
            });
          } catch (error) {
            edhTop16Error = error instanceof Error ? error.message : String(error);
          }
        }

        return jsonResult({
          commanders,
          cards,
          sourceCatalog: evidenceSourcesForV09(focuses as EvidenceFocusV09[]),
          researchLinks: buildResearchLinksV09(commanders, cards),
          liveEvidence: { edhTop16, edhTop16Error },
          weightingGuide: evidenceWeightingGuideV09(),
          responseGuidance: 'Summarize agreement/disagreement across evidence classes in plain English. Competitive tournament evidence, recorded casual games, broad community adoption, deck primers, independent deck-analysis scores, and prices answer different questions and must not be collapsed into one fake certainty score.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'cross_reference_deck_evidence_v09',
    {
      title: 'Cross-reference a deck with community and tournament evidence',
      description: 'Combine existing Archidekt and TopDeck integrations with EDHTop16 and the wider source registry. Use it when building or upgrading a deck to see whether proposed choices agree with tournament, community, primer, recorded-game, analysis-tool, and price evidence.',
      inputSchema: z.object({
        decklist: z.string().min(1).max(100_000).optional(),
        commanders: z.array(z.string().min(1).max(256)).min(1).max(2),
        cardsToPriceCheck: z.array(z.string().min(1).max(256)).max(20).optional().default([]),
        archidektReferences: z.array(z.union([z.string().min(1).max(1000), z.number().int().positive()])).max(10).optional().default([]),
        includeTopDeck: z.boolean().optional().default(true),
        includeEdhTop16: z.boolean().optional().default(true),
        lastDays: z.number().int().min(1).max(365).optional().default(90),
        participantMin: z.number().int().min(4).max(500).optional().default(32),
        sampleLimit: z.number().int().min(4).max(40).optional().default(16),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ decklist, commanders, cardsToPriceCheck, archidektReferences, includeTopDeck, includeEdhTop16, lastDays, participantMin, sampleLimit }) => {
      try {
        let archidekt: Record<string, unknown> | null = null;
        let topDeck: Record<string, unknown> | null = null;
        let edhTop16: Record<string, unknown> | null = null;
        const errors: Record<string, string> = {};

        if (archidektReferences.length > 0) {
          try {
            archidekt = await analyzeArchidektReferences(archidektReferences, decklist);
          } catch (error) {
            errors.archidekt = error instanceof Error ? error.message : String(error);
          }
        }

        if (includeTopDeck) {
          try {
            topDeck = await analyzeTopDeckTournamentReferences({
              lastDays,
              participantMin,
              commanderName: commanders.length === 1 ? commanders[0] : undefined,
              sampleLimit,
              minGames: 3,
            });
          } catch (error) {
            errors.topDeck = error instanceof Error ? error.message : String(error);
          }
        }

        if (includeEdhTop16) {
          try {
            edhTop16 = await fetchEdhTop16CommanderEntriesV09({
              commanders,
              lastDays,
              minTournamentSize: participantMin,
              maxStanding: 16,
              limit: Math.min(40, sampleLimit * 2),
            });
          } catch (error) {
            errors.edhTop16 = error instanceof Error ? error.message : String(error);
          }
        }

        return jsonResult({
          commanders,
          evidence: { archidekt, topDeck, edhTop16 },
          researchLinks: buildResearchLinksV09(commanders, cardsToPriceCheck),
          recommendedSources: evidenceSourcesForV09([
            'competitive',
            'recorded-games',
            'community',
            'decklists',
            'deck-analysis',
            ...(cardsToPriceCheck.length > 0 ? ['pricing' as const, 'nz-availability' as const] : []),
          ]),
          weightingGuide: evidenceWeightingGuideV09(),
          sourceErrors: errors,
          responseGuidance: 'For upgrades, lead with the practical card choices and why. Then give short evidence such as “seen across community lists”, “supported by tournament lists”, “recorded-game signal is weak/strong”, or “NZ price needs checking”. Do not dump raw source data unless asked.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
