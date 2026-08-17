import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { createMtgServerV14 } from './server-v14.js';
import {
  assessBracketCeilingV15,
  type BracketAssessmentSignalsV15,
  type CommanderBracketV15,
} from './services/bracket-ceiling-v15.js';
import {
  buildDeepResearchPlanV15,
  evaluateDeepLearningReadinessV15,
  scoreCandidateWithLearningV15,
  synthesizeDeepResearchV15,
  trainAdaptiveRankerV15,
  type LearningExampleV15,
  type LearningFeatureV15,
  type ResearchObservationV15,
} from './services/research-learning-v15.js';
import {
  buildResearchLinksV09,
  fetchEdhTop16CommanderEntriesV09,
  type EvidenceFocusV09,
} from './services/evidence-sources-v09.js';
import { analyzeTopDeckTournamentReferences } from './services/references.js';
import { sourceHealthDiagnosticsV12 } from './services/source-health-v12.js';
import { getCardsByNames } from './services/scryfall.js';
import { findDeckCombos } from './services/spellbook.js';

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

const learningFeatureSchema = z.object({
  simulationImprovement: z.number().min(-1).max(1).optional(),
  tournamentSupport: z.number().min(-1).max(1).optional(),
  crossClassResearch: z.number().min(-1).max(1).optional(),
  comboVerification: z.number().min(-1).max(1).optional(),
  manaEfficiency: z.number().min(-1).max(1).optional(),
  interactionEfficiency: z.number().min(-1).max(1).optional(),
  priceEfficiency: z.number().min(-1).max(1).optional(),
  communitySupport: z.number().min(-1).max(1).optional(),
});

const bracketSignalSchema = z.object({
  commanderLegal: z.boolean(),
  exactCardCount: z.boolean(),
  fullyResolved: z.boolean(),
  printingPolicyCompliant: z.boolean(),
  spellbookTag: z.string().max(10).nullable().optional(),
  verifiedWinningCombos: z.number().int().min(0).max(10_000).optional(),
  ruthlessWinningCombos: z.number().int().min(0).max(10_000).optional(),
  strategicallyRelevantCombos: z.number().int().min(0).max(10_000).optional(),
  averageNonlandManaValue: z.number().min(0).max(30).nullable().optional(),
  earlyPlayCount: z.number().int().min(0).max(100).optional(),
  fastManaCount: z.number().int().min(0).max(100).optional(),
  freeInteractionCount: z.number().int().min(0).max(100).optional(),
  cheapInteractionCount: z.number().int().min(0).max(100).optional(),
  tutorCount: z.number().int().min(0).max(100).optional(),
  gameChangerCount: z.number().int().min(0).max(100).optional(),
  optimizedPlanEvidence: z.boolean().optional(),
  cedhIntent: z.boolean().optional(),
  competitiveMetagameEvidence: z.boolean().optional(),
  exhibitionIntent: z.boolean().optional(),
});

function compactLearningFeatures(input: z.infer<typeof learningFeatureSchema>): Partial<Record<LearningFeatureV15, number>> {
  const output: Partial<Record<LearningFeatureV15, number>> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number' && Number.isFinite(value)) output[key as LearningFeatureV15] = value;
  }
  return output;
}

function compactBracketSignals(input: z.infer<typeof bracketSignalSchema>): BracketAssessmentSignalsV15 {
  return {
    commanderLegal: input.commanderLegal,
    exactCardCount: input.exactCardCount,
    fullyResolved: input.fullyResolved,
    printingPolicyCompliant: input.printingPolicyCompliant,
    ...(input.spellbookTag !== undefined ? { spellbookTag: input.spellbookTag } : {}),
    ...(input.verifiedWinningCombos !== undefined ? { verifiedWinningCombos: input.verifiedWinningCombos } : {}),
    ...(input.ruthlessWinningCombos !== undefined ? { ruthlessWinningCombos: input.ruthlessWinningCombos } : {}),
    ...(input.strategicallyRelevantCombos !== undefined ? { strategicallyRelevantCombos: input.strategicallyRelevantCombos } : {}),
    ...(input.averageNonlandManaValue !== undefined ? { averageNonlandManaValue: input.averageNonlandManaValue } : {}),
    ...(input.earlyPlayCount !== undefined ? { earlyPlayCount: input.earlyPlayCount } : {}),
    ...(input.fastManaCount !== undefined ? { fastManaCount: input.fastManaCount } : {}),
    ...(input.freeInteractionCount !== undefined ? { freeInteractionCount: input.freeInteractionCount } : {}),
    ...(input.cheapInteractionCount !== undefined ? { cheapInteractionCount: input.cheapInteractionCount } : {}),
    ...(input.tutorCount !== undefined ? { tutorCount: input.tutorCount } : {}),
    ...(input.gameChangerCount !== undefined ? { gameChangerCount: input.gameChangerCount } : {}),
    ...(input.optimizedPlanEvidence !== undefined ? { optimizedPlanEvidence: input.optimizedPlanEvidence } : {}),
    ...(input.cedhIntent !== undefined ? { cedhIntent: input.cedhIntent } : {}),
    ...(input.competitiveMetagameEvidence !== undefined ? { competitiveMetagameEvidence: input.competitiveMetagameEvidence } : {}),
    ...(input.exhibitionIntent !== undefined ? { exhibitionIntent: input.exhibitionIntent } : {}),
  };
}

export function registerMtgToolsV15(server: McpServer): McpServer {
  server.registerTool(
    'assess_bracket_ceiling_v15',
    {
      title: 'Conservatively assess the bracket a finished Commander deck actually supports',
      description: 'Compare a requested bracket with independently measured construction and competitive signals. The requested target never raises the assessment. Bracket 5 requires strong cEDH construction plus explicit competitive intent and independent metagame evidence; restrictions are reported as ceiling reasons rather than hidden or treated as failure.',
      inputSchema: z.object({
        targetBracket: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
        signals: bracketSignalSchema,
        constraints: z.array(z.string().min(1).max(500)).max(50).optional().default([]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ targetBracket, signals, constraints }) => {
      try {
        return jsonResult(assessBracketCeilingV15(
          targetBracket as CommanderBracketV15,
          compactBracketSignals(signals),
          constraints,
        ));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'deep_research_plan_v15',
    {
      title: 'Plan deep MTG research across independent evidence classes',
      description: 'Build an evidence-aware research plan that separates official rules/card identity, curated combo data, observed tournament/game results, community adoption, deck-analysis tools and market evidence. It explicitly warns against double-counting dependent sources.',
      inputSchema: z.object({
        focuses: z.array(focusSchema).min(1).max(10),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ focuses }) => {
      try {
        return jsonResult(buildDeepResearchPlanV15(focuses as EvidenceFocusV09[]));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'deep_research_commander_v15',
    {
      title: 'Deep-research a Commander across live and reference sources',
      description: 'Create a research packet for one or two commanders: exact Scryfall identity/legalities, source health, TopDeck tournament analysis when configured, EDHTop16 attributed reference context, Commander Spellbook deck-combo evidence when a list is supplied, and wider independent research links. Missing sources reduce confidence instead of being fabricated.',
      inputSchema: z.object({
        commanders: z.array(z.string().min(1).max(256)).min(1).max(2),
        decklist: z.string().min(1).max(100_000).optional(),
        cards: z.array(z.string().min(1).max(256)).max(30).optional().default([]),
        focuses: z.array(focusSchema).min(1).max(10).optional().default(['competitive', 'decklists', 'combos', 'community']),
        lastDays: z.number().int().min(1).max(365).optional().default(90),
        participantMin: z.number().int().min(4).max(500).optional().default(32),
        sampleLimit: z.number().int().min(4).max(40).optional().default(16),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ commanders, decklist, cards, focuses, lastDays, participantMin, sampleLimit }) => {
      try {
        const sourceErrors: Record<string, string> = {};
        const commanderLookup = await getCardsByNames(commanders);
        const exactCommanders = commanderLookup.cards.map((card) => ({
          name: card.name,
          oracleId: card.oracle_id,
          colorIdentity: card.color_identity,
          commanderLegality: card.legalities.commander,
          set: card.set.toUpperCase(),
          collectorNumber: card.collector_number,
        }));

        const sourceHealth = await sourceHealthDiagnosticsV12({ includeReferenceSources: true });
        let topDeck: Record<string, unknown> | null = null;
        try {
          topDeck = await analyzeTopDeckTournamentReferences({
            lastDays,
            participantMin,
            ...(commanders.length === 1 && commanders[0] ? { commanderName: commanders[0] } : {}),
            sampleLimit,
            minGames: 3,
          });
        } catch (error) {
          sourceErrors.topDeck = error instanceof Error ? error.message : String(error);
        }

        let combos: Record<string, unknown> | null = null;
        if (decklist) {
          try {
            combos = await findDeckCombos(decklist, 100);
          } catch (error) {
            sourceErrors.commanderSpellbook = error instanceof Error ? error.message : String(error);
          }
        }

        const edhTop16 = await fetchEdhTop16CommanderEntriesV09({
          commanders,
          lastDays,
          minTournamentSize: participantMin,
          maxStanding: 16,
          limit: Math.min(40, sampleLimit * 2),
        });

        return jsonResult({
          status: commanderLookup.notFound.length === 0 ? 'research-packet-built' : 'research-packet-incomplete',
          commanders: exactCommanders,
          unresolvedCommanders: commanderLookup.notFound,
          researchPlan: buildDeepResearchPlanV15(focuses as EvidenceFocusV09[]),
          sourceHealth,
          evidence: {
            scryfall: { resolvedCommanders: exactCommanders },
            commanderSpellbook: combos,
            topDeck,
            edhTop16,
          },
          researchLinks: buildResearchLinksV09(commanders, cards),
          sourceErrors,
          guidance: [
            'Do not collapse all sources into one popularity score. Rules, printings, combos, tournament outcomes, community usage and prices answer different questions.',
            'When two sites mirror the same event/decklist dataset, treat them as one independent evidence group.',
            'Keep contradictory results visible and lower confidence until another independent evidence class resolves the disagreement.',
            'For a concrete deck recommendation, exact Commander legality, exact 100-card construction and exact physical-printing policy remain hard gates.',
          ],
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'synthesize_deep_research_v15',
    {
      title: 'Synthesize MTG research without double counting evidence',
      description: 'Score and synthesize normalized research observations with source quality, freshness, sample-size, independence and evidence-class diversity. Contradictions remain visible and can produce a disputed verdict instead of false certainty; contradictory mirrors inside the same underlying evidence group share one capped evidence budget.',
      inputSchema: z.object({
        observations: z.array(z.object({
          sourceId: z.string().min(1).max(80),
          focus: focusSchema,
          subject: z.string().min(1).max(500),
          claim: z.string().min(1).max(1000),
          polarity: z.enum(['support', 'oppose']).optional().default('support'),
          ageDays: z.number().min(0).max(20_000).optional().default(0),
          independentGroup: z.string().min(1).max(300).optional(),
          sampleSize: z.number().int().min(1).max(10_000_000).optional(),
          outcomeStrength: z.number().min(0.2).max(1).optional().default(1),
          structured: z.boolean().optional().default(false),
        })).min(1).max(500),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ observations }) => {
      try {
        const normalized: ResearchObservationV15[] = observations.map((observation) => ({
          sourceId: observation.sourceId,
          focus: observation.focus,
          subject: observation.subject,
          claim: observation.claim,
          polarity: observation.polarity,
          ageDays: observation.ageDays,
          outcomeStrength: observation.outcomeStrength,
          structured: observation.structured,
          ...(observation.independentGroup !== undefined ? { independentGroup: observation.independentGroup } : {}),
          ...(observation.sampleSize !== undefined ? { sampleSize: observation.sampleSize } : {}),
        }));
        return jsonResult({
          synthesis: synthesizeDeepResearchV15(normalized),
          guidance: 'High confidence requires independent corroboration. A second website that republishes the same event or decklist is not a second independent result.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'train_adaptive_ranker_v15',
    {
      title: 'Train an experimental evidence-aware candidate ranker',
      description: 'Train a deterministic transparent logistic ranker from labelled deck-building outcomes. This is deliberately not presented as a neural deep-learning model: learned weights are only promotable after holdout testing, and they can never override Commander legality, exact card count, card resolution or printing restrictions.',
      inputSchema: z.object({
        examples: z.array(z.object({
          features: learningFeatureSchema,
          label: z.union([z.literal(0), z.literal(1)]),
          importance: z.number().min(0.1).max(5).optional().default(1),
        })).min(1).max(20_000),
        epochs: z.number().int().min(1).max(500).optional().default(120),
        learningRate: z.number().min(0.001).max(0.5).optional().default(0.08),
        l2: z.number().min(0).max(0.2).optional().default(0.01),
        minimumExamples: z.number().int().min(10).max(10_000).optional().default(30),
        minimumHoldoutAccuracy: z.number().min(0.5).max(1).optional().default(0.72),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ examples, epochs, learningRate, l2, minimumExamples, minimumHoldoutAccuracy }) => {
      try {
        const normalized: LearningExampleV15[] = examples.map((example) => ({
          features: compactLearningFeatures(example.features),
          label: example.label,
          importance: example.importance,
        }));
        return jsonResult(trainAdaptiveRankerV15(normalized, {
          epochs,
          learningRate,
          l2,
          minimumExamples,
          minimumHoldoutAccuracy,
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'evaluate_deep_learning_readiness_v15',
    {
      title: 'Evaluate whether MTG data is ready for neural deep learning',
      description: 'Refuse premature deep-learning claims. Checks labelled sample size, class balance, temporal coverage, evidence independence/diversity, duplicate/conflict/malformed rates, leakage, temporal holdout class balance, accuracy improvement, and temporal log-loss calibration against the transparent baseline.',
      inputSchema: z.object({
        labelledExamples: z.number().int().min(0).max(100_000_000),
        positiveExamples: z.number().int().min(0).max(100_000_000),
        negativeExamples: z.number().int().min(0).max(100_000_000),
        temporalCoverageDays: z.number().min(0).max(20_000),
        independentEvidenceGroups: z.number().int().min(0).max(1_000_000),
        evidenceClassCount: z.number().int().min(0).max(20),
        duplicateRate: z.number().min(0).max(1),
        conflictRate: z.number().min(0).max(1).optional().default(0),
        malformedRate: z.number().min(0).max(1).optional().default(0),
        leakageChecksPassed: z.boolean(),
        transparentBaselineAccuracy: z.number().min(0).max(1).nullable(),
        candidateModelAccuracy: z.number().min(0).max(1).nullable(),
        transparentBaselineLogLoss: z.number().min(0).nullable().optional(),
        candidateModelLogLoss: z.number().min(0).nullable().optional(),
        temporalHoldoutExamples: z.number().int().min(0).max(100_000_000),
        temporalHoldoutPositiveExamples: z.number().int().min(0).max(100_000_000).optional(),
        temporalHoldoutNegativeExamples: z.number().int().min(0).max(100_000_000).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      try {
        return jsonResult(evaluateDeepLearningReadinessV15({
          labelledExamples: input.labelledExamples,
          positiveExamples: input.positiveExamples,
          negativeExamples: input.negativeExamples,
          temporalCoverageDays: input.temporalCoverageDays,
          independentEvidenceGroups: input.independentEvidenceGroups,
          evidenceClassCount: input.evidenceClassCount,
          duplicateRate: input.duplicateRate,
          conflictRate: input.conflictRate,
          malformedRate: input.malformedRate,
          leakageChecksPassed: input.leakageChecksPassed,
          transparentBaselineAccuracy: input.transparentBaselineAccuracy,
          candidateModelAccuracy: input.candidateModelAccuracy,
          temporalHoldoutExamples: input.temporalHoldoutExamples,
          ...(input.transparentBaselineLogLoss !== undefined ? { transparentBaselineLogLoss: input.transparentBaselineLogLoss } : {}),
          ...(input.candidateModelLogLoss !== undefined ? { candidateModelLogLoss: input.candidateModelLogLoss } : {}),
          ...(input.temporalHoldoutPositiveExamples !== undefined ? { temporalHoldoutPositiveExamples: input.temporalHoldoutPositiveExamples } : {}),
          ...(input.temporalHoldoutNegativeExamples !== undefined ? { temporalHoldoutNegativeExamples: input.temporalHoldoutNegativeExamples } : {}),
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'score_candidate_with_learning_v15',
    {
      title: 'Score a deck candidate with learned evidence while preserving hard gates',
      description: 'Apply a previously trained V0.15 transparent ranker to a candidate. Any failed legality, resolution, 100-card or physical-printing check blocks the candidate before the learned score is considered.',
      inputSchema: z.object({
        features: learningFeatureSchema,
        model: z.object({
          modelType: z.literal('transparent-logistic-ranker'),
          version: z.literal(1),
          weights: z.object({
            simulationImprovement: z.number(),
            tournamentSupport: z.number(),
            crossClassResearch: z.number(),
            comboVerification: z.number(),
            manaEfficiency: z.number(),
            interactionEfficiency: z.number(),
            priceEfficiency: z.number(),
            communitySupport: z.number(),
          }),
          bias: z.number(),
          trainedExamples: z.number().int().min(0),
          holdoutExamples: z.number().int().min(0),
          holdoutAccuracy: z.number().min(0).max(1).nullable(),
          promotable: z.boolean(),
          promotionReasons: z.array(z.string()),
          guardrails: z.array(z.string()),
        }),
        hardChecks: z.object({
          commanderLegal: z.boolean(),
          fullyResolved: z.boolean(),
          exactCardCount: z.boolean(),
          printingPolicyCompliant: z.boolean(),
        }),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ features, model, hardChecks }) => {
      try {
        return jsonResult(scoreCandidateWithLearningV15(compactLearningFeatures(features), model, hardChecks));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

export function createMtgServerV15(): McpServer {
  return registerMtgToolsV15(createMtgServerV14());
}
