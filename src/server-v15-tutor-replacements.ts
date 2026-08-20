import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  evaluateCommanderBuildV15,
  type CommanderBuildEvaluationV15,
  type VerifiedWinningComboDetailV15,
} from './services/commander-build-evaluation-v15.js';
import {
  auditTopDeckTutorPrevalenceV15,
  type TopDeckTutorPrevalenceAuditV15,
} from './services/topdeck-tutor-prevalence-v15.js';
import {
  fetchTopDeckLearningCandidatesV15,
  type TopDeckLearningFetchResultV15,
} from './services/topdeck-learning-live-v15.js';
import {
  auditTutorReplacementsV15,
  type TutorReplacementIntelligenceV15,
} from './services/tutor-replacement-intelligence-v15.js';

export const tutorReplacementInputSchemaV15 = z.object({
  decklist: z.string().min(1).max(100_000),
  comboId: z.string().min(1).max(300).optional(),
  sourceTutorName: z.string().min(1).max(300).optional(),
  printingFamily: z.string().min(1).max(128).optional(),
  allowedSets: z.array(z.string().min(2).max(12)).max(50).optional(),
  includePromos: z.boolean().optional(),
  includeSpecialReleases: z.boolean().optional(),
  maxUsdPerCard: z.number().positive().max(1_000_000).optional(),
  candidateMaxUsdPerCard: z.number().positive().max(1_000_000).optional(),
  excludedCards: z.array(z.string().min(1).max(256)).max(100).optional(),
  maxAccessLossPercentagePoints: z.number().min(0).max(100).optional(),
  includeTopDeckEvidence: z.boolean().optional().default(false),
  topDeckLastDays: z.number().int().min(1).max(365).optional().default(30),
  topDeckParticipantMin: z.number().int().min(1).max(5_000).optional().default(16),
});

type TutorReplacementInputV15 = z.infer<typeof tutorReplacementInputSchemaV15>;

export interface TutorReplacementToolDependenciesV15 {
  evaluateBuild?: typeof evaluateCommanderBuildV15;
  auditReplacements?: typeof auditTutorReplacementsV15;
  fetchTopDeck?: typeof fetchTopDeckLearningCandidatesV15;
  auditTopDeck?: typeof auditTopDeckTutorPrevalenceV15;
}

function routeSummary(detail: VerifiedWinningComboDetailV15): Record<string, unknown> {
  return {
    comboId: detail.comboId,
    bracketTag: detail.bracketTag,
    comboCardNames: detail.comboCardNames,
    commandIndependentSeedNames: detail.seedNames,
    requirementNames: detail.requirementNames,
    dependencyCompleteness: detail.dependencyCompleteness,
    closureKind: detail.closureKind,
    closureTiming: detail.closureTiming,
    closureScope: detail.closureScope,
  };
}

function invalidEvaluationSummary(evaluation: CommanderBuildEvaluationV15): Record<string, unknown> {
  return {
    hardGatesPassed: evaluation.hardGatesPassed,
    exactCardCount: evaluation.parsed.totalCards === 100,
    commanderLegal: evaluation.commanderRules.isLegal,
    unresolvedCards: evaluation.unresolvedCards,
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    perCardBudgetStatus: evaluation.perCardBudgetAudit.status,
  };
}

function exactRouteInput(detail: VerifiedWinningComboDetailV15) {
  return {
    comboId: detail.comboId,
    comboCardNames: detail.comboCardNames,
    seedNames: detail.seedNames,
    dependencyCompleteness: detail.dependencyCompleteness,
  } as const;
}

function replacementTutorNames(audit: TutorReplacementIntelligenceV15): string[] {
  return [...new Set(audit.sources.flatMap((source) => [
    source.sourceTutorName,
    ...source.replacements.map((replacement) => replacement.replacementTutorName),
  ]))].sort((left, right) => left.localeCompare(right));
}

function sameTutorCheaperPrintingAlternatives(audit: TutorReplacementIntelligenceV15): Array<Record<string, unknown>> {
  return audit.sources.flatMap((source) => source.replacements
    .filter((replacement) =>
      replacement.sourceTutorName.trim().toLocaleLowerCase() === replacement.replacementTutorName.trim().toLocaleLowerCase()
      && replacement.priceSavingsUsd !== null
      && replacement.priceSavingsUsd > 0)
    .map((replacement) => ({
      tutorName: replacement.sourceTutorName,
      replacementPrinting: replacement.replacementPrice.printing,
      finish: replacement.replacementPrice.finish,
      priceUsd: replacement.replacementPrice.priceUsd,
      savingsUsd: replacement.priceSavingsUsd,
      note: 'This is a cheaper physical printing/finish of the same Oracle tutor, not a different tutor-card substitution.',
    })));
}

function evaluationOptions(input: TutorReplacementInputV15) {
  return {
    maxComboResults: 100,
    ...(input.printingFamily !== undefined ? { printingFamily: input.printingFamily } : {}),
    ...(input.allowedSets !== undefined ? { allowedSets: input.allowedSets } : {}),
    ...(input.includePromos !== undefined ? { includePromos: input.includePromos } : {}),
    ...(input.includeSpecialReleases !== undefined ? { includeSpecialReleases: input.includeSpecialReleases } : {}),
    ...(input.maxUsdPerCard !== undefined ? { maxUsdPerCard: input.maxUsdPerCard } : {}),
  };
}

async function optionalTopDeckEvidence(input: {
  enabled: boolean;
  lastDays: number;
  participantMin: number;
  replacementAudit: TutorReplacementIntelligenceV15;
  evaluation: CommanderBuildEvaluationV15;
  fetchTopDeck: typeof fetchTopDeckLearningCandidatesV15;
  auditTopDeck: typeof auditTopDeckTutorPrevalenceV15;
}): Promise<{ evidence: Record<string, unknown> | null; sourceError: string | null }> {
  const tutorNames = replacementTutorNames(input.replacementAudit);
  if (!input.enabled || tutorNames.length === 0) return { evidence: null, sourceError: null };
  try {
    const fetched: TopDeckLearningFetchResultV15 = await input.fetchTopDeck({
      lastDays: input.lastDays,
      participantMin: input.participantMin,
    });
    const prevalence: TopDeckTutorPrevalenceAuditV15 = input.auditTopDeck({
      tutorNames,
      candidates: fetched.candidates,
      commanderNames: input.evaluation.parsed.commanders.map((entry) => entry.name),
    });
    return {
      evidence: {
        source: fetched.source,
        attribution: fetched.attribution,
        fetchedAt: fetched.fetchedAt,
        query: fetched.query,
        tournamentsReturned: fetched.tournamentsReturned,
        usableCandidates: fetched.candidates.length,
        rejectedCandidates: fetched.rejected.length,
        prevalence,
      },
      sourceError: null,
    };
  } catch (error) {
    return { evidence: null, sourceError: error instanceof Error ? error.message : String(error) };
  }
}

export async function runTutorReplacementToolV15(
  input: TutorReplacementInputV15,
  dependencies: TutorReplacementToolDependenciesV15 = {},
): Promise<Record<string, unknown>> {
  const evaluateBuild = dependencies.evaluateBuild ?? evaluateCommanderBuildV15;
  const auditReplacements = dependencies.auditReplacements ?? auditTutorReplacementsV15;
  const fetchTopDeck = dependencies.fetchTopDeck ?? fetchTopDeckLearningCandidatesV15;
  const auditTopDeck = dependencies.auditTopDeck ?? auditTopDeckTutorPrevalenceV15;

  const evaluation = await evaluateBuild(input.decklist, evaluationOptions(input));
  if (!evaluation.hardGatesPassed) {
    return {
      status: 'invalid-finished-deck',
      evaluation: invalidEvaluationSummary(evaluation),
      guidance: 'Tutor replacement is not evaluated until exact 100-card construction, Commander legality, card resolution, the supplied physical-printing policy and any supplied hard per-card budget all pass.',
    };
  }
  if (evaluation.postBuildEvidence.spellbookComboSourceStatus === 'unavailable') {
    return {
      status: 'combo-source-unavailable',
      sourceFailure: evaluation.postBuildEvidence.spellbookComboSourceFailure,
      guidance: 'Commander Spellbook unavailability is not evidence that the deck has no winning route. No replacement route was fabricated.',
    };
  }

  const routes = evaluation.postBuildEvidence.verifiedWinningComboDetails;
  if (routes.length === 0) {
    return {
      status: 'no-verified-full-table-route',
      comboVerificationComplete: evaluation.postBuildEvidence.comboVerificationComplete,
      guidance: 'No verified full-table winning route is available from the post-build truth layer, so tutor replacement is not presented as win-route optimization.',
    };
  }

  let selected: VerifiedWinningComboDetailV15 | undefined;
  if (input.comboId) selected = routes.find((route) => route.comboId === input.comboId);
  else if (routes.length === 1) selected = routes[0];
  if (!selected) {
    return {
      status: input.comboId ? 'verified-route-not-found' : 'route-selection-required',
      requestedComboId: input.comboId ?? null,
      verifiedRoutes: routes.map(routeSummary),
      guidance: input.comboId
        ? 'The requested comboId is not one of the deck’s verified full-table winning routes. No arbitrary route was substituted.'
        : 'Multiple verified full-table winning routes are present. Select a comboId so replacement access is measured against the intended route rather than guessed.',
    };
  }

  const replacementAudit = await auditReplacements({
    route: exactRouteInput(selected),
    parsed: evaluation.parsed,
    resolvedCards: evaluation.resolvedCards,
    ...(input.sourceTutorName ? { sourceTutorName: input.sourceTutorName } : {}),
    constraints: {
      ...(input.printingFamily ? { printingFamily: input.printingFamily } : {}),
      ...(input.allowedSets ? { allowedSets: input.allowedSets } : {}),
      ...(input.includePromos !== undefined ? { includePromos: input.includePromos } : {}),
      ...(input.includeSpecialReleases !== undefined ? { includeSpecialReleases: input.includeSpecialReleases } : {}),
      ...(input.maxUsdPerCard !== undefined ? { maxUsdPerCard: input.maxUsdPerCard } : {}),
      ...(input.candidateMaxUsdPerCard !== undefined ? { candidateMaxUsdPerCard: input.candidateMaxUsdPerCard } : {}),
      ...(input.excludedCards ? { excludedCards: input.excludedCards } : {}),
      ...(input.maxAccessLossPercentagePoints !== undefined ? { maxAccessLossPercentagePoints: input.maxAccessLossPercentagePoints } : {}),
    },
  });

  const topDeck = await optionalTopDeckEvidence({
    enabled: input.includeTopDeckEvidence,
    lastDays: input.topDeckLastDays,
    participantMin: input.topDeckParticipantMin,
    replacementAudit,
    evaluation,
    fetchTopDeck,
    auditTopDeck,
  });

  return {
    status: 'verified-route-tutor-replacements-audited',
    route: routeSummary(selected),
    replacementAudit,
    sameTutorCheaperPrintingAlternatives: sameTutorCheaperPrintingAlternatives(replacementAudit),
    topDeckEvidenceRequested: input.includeTopDeckEvidence,
    topDeckEvidence: topDeck.evidence,
    sourceErrors: topDeck.sourceError ? { topDeck: topDeck.sourceError } : {},
    guidance: [
      'Commander legality, route verification, exact card access and exact eligible-printing price are the hard layers for a replacement comparison.',
      'Rows where sourceTutorName and replacementTutorName are the same Oracle card are surfaced separately as cheaper-printing alternatives; they are not different tutor-card substitutions.',
      'The Scryfall candidate pool is bounded and EDHREC-ordered, so an empty result is not proof that the current tutor is globally optimal.',
      'Near-equivalent is only emitted when maxAccessLossPercentagePoints is explicitly supplied; otherwise every exact access loss remains visible without a hidden tolerance.',
      'TopDeck prevalence, when requested and available, is advisory observational evidence only and cannot override legality, route truth, exact access or printing/budget constraints.',
    ],
  };
}

const jsonResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});
const errorResult = (error: unknown) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }],
  isError: true,
});

export function registerTutorReplacementToolV15(
  server: McpServer,
  dependencies: TutorReplacementToolDependenciesV15 = {},
): McpServer {
  server.registerTool(
    'audit_verified_route_tutor_replacements_v15',
    {
      title: 'Find cheaper legal tutor replacements for a verified Commander win route',
      description: 'Verify a finished Commander deck and full-table winning route, then search a bounded Commander-legal Scryfall candidate pool for one-for-one tutor replacements that satisfy explicit printing/theme/budget constraints. Every proposed swap is revalidated for Commander legality and exact route access. Optional TopDeck prevalence remains advisory.',
      inputSchema: tutorReplacementInputSchemaV15,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await runTutorReplacementToolV15(input, dependencies));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
  return server;
}
