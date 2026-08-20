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
  auditTutorValueForMoneyV15,
  type TutorValueForMoneyAuditV15,
} from './services/tutor-value-for-money-v15.js';

export const tutorValueForMoneyInputSchemaV15 = z.object({
  decklist: z.string().min(1).max(100_000),
  comboId: z.string().min(1).max(300).optional(),
  includeTopDeckEvidence: z.boolean().optional().default(false),
  topDeckLastDays: z.number().int().min(1).max(365).optional().default(30),
  topDeckParticipantMin: z.number().int().min(1).max(5_000).optional().default(16),
});

type TutorValueForMoneyInputV15 = z.infer<typeof tutorValueForMoneyInputSchemaV15>;

export interface TutorValueForMoneyToolDependenciesV15 {
  evaluateBuild?: typeof evaluateCommanderBuildV15;
  auditValue?: typeof auditTutorValueForMoneyV15;
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

async function optionalTopDeckEvidence(input: {
  enabled: boolean;
  lastDays: number;
  participantMin: number;
  tutorValue: TutorValueForMoneyAuditV15;
  evaluation: CommanderBuildEvaluationV15;
  fetchTopDeck: typeof fetchTopDeckLearningCandidatesV15;
  auditTopDeck: typeof auditTopDeckTutorPrevalenceV15;
}): Promise<{
  evidence: Record<string, unknown> | null;
  sourceError: string | null;
}> {
  if (!input.enabled || input.tutorValue.candidates.length === 0) return { evidence: null, sourceError: null };
  try {
    const fetched: TopDeckLearningFetchResultV15 = await input.fetchTopDeck({
      lastDays: input.lastDays,
      participantMin: input.participantMin,
    });
    const prevalence: TopDeckTutorPrevalenceAuditV15 = input.auditTopDeck({
      tutorNames: input.tutorValue.candidates.map((candidate) => candidate.tutorName),
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
    return {
      evidence: null,
      sourceError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runTutorValueForMoneyToolV15(
  input: TutorValueForMoneyInputV15,
  dependencies: TutorValueForMoneyToolDependenciesV15 = {},
): Promise<Record<string, unknown>> {
  const evaluateBuild = dependencies.evaluateBuild ?? evaluateCommanderBuildV15;
  const auditValue = dependencies.auditValue ?? auditTutorValueForMoneyV15;
  const fetchTopDeck = dependencies.fetchTopDeck ?? fetchTopDeckLearningCandidatesV15;
  const auditTopDeck = dependencies.auditTopDeck ?? auditTopDeckTutorPrevalenceV15;

  const evaluation = await evaluateBuild(input.decklist, { maxComboResults: 100 });
  if (!evaluation.hardGatesPassed) {
    return {
      status: 'invalid-finished-deck',
      evaluation: invalidEvaluationSummary(evaluation),
      guidance: 'Tutor value is not evaluated until exact 100-card construction, Commander legality, card resolution and printing gates pass.',
    };
  }
  if (evaluation.postBuildEvidence.spellbookComboSourceStatus === 'unavailable') {
    return {
      status: 'combo-source-unavailable',
      sourceFailure: evaluation.postBuildEvidence.spellbookComboSourceFailure,
      guidance: 'Commander Spellbook unavailability is not evidence that the deck has no winning route. No tutor-value route was fabricated.',
    };
  }

  const routes = evaluation.postBuildEvidence.verifiedWinningComboDetails;
  if (routes.length === 0) {
    return {
      status: 'no-verified-full-table-route',
      comboVerificationComplete: evaluation.postBuildEvidence.comboVerificationComplete,
      guidance: 'No verified full-table winning route is available from the post-build truth layer, so tutor value is not presented as win-route value.',
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
        : 'Multiple verified full-table winning routes are present. Select a comboId so exact tutor value is measured against the intended route rather than guessed.',
    };
  }

  const tutorValue = auditValue({
    route: exactRouteInput(selected),
    parsed: evaluation.parsed,
    resolvedCards: evaluation.resolvedCards,
  });
  const topDeck = await optionalTopDeckEvidence({
    enabled: input.includeTopDeckEvidence,
    lastDays: input.topDeckLastDays,
    participantMin: input.topDeckParticipantMin,
    tutorValue,
    evaluation,
    fetchTopDeck,
    auditTopDeck,
  });

  return {
    status: 'verified-route-tutor-value-audited',
    route: routeSummary(selected),
    tutorValue,
    topDeckEvidenceRequested: input.includeTopDeckEvidence,
    topDeckEvidence: topDeck.evidence,
    sourceErrors: topDeck.sourceError ? { topDeck: topDeck.sourceError } : {},
    guidance: [
      'Exact marginal access and exact resolved-printing price are the hard quantitative layer for this comparison.',
      'TopDeck prevalence, when requested and available, is advisory observational evidence only and cannot override legality, combo closure or exact access maths.',
      'A cheaper Pareto-dominating tutor is not automatically a cut recommendation: mana cost, timing, card utility outside this route, interaction and non-card prerequisites remain separate considerations.',
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

export function registerTutorValueForMoneyToolV15(
  server: McpServer,
  dependencies: TutorValueForMoneyToolDependenciesV15 = {},
): McpServer {
  server.registerTool(
    'audit_verified_route_tutor_value_v15',
    {
      title: 'Audit exact tutor value for a verified Commander win route',
      description: 'Verify the finished Commander deck and full-table winning route first, then compare each qualifying tutor by exact one-slot marginal route access and exact resolved-printing price. Optional TopDeck evidence reports tournament prevalence separately and never overrides hard MTG truth.',
      inputSchema: tutorValueForMoneyInputSchemaV15,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await runTutorValueForMoneyToolV15(input, dependencies));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
  return server;
}
