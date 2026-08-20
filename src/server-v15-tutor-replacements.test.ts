import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CommanderBuildEvaluationV15,
  VerifiedWinningComboDetailV15,
} from './services/commander-build-evaluation-v15.js';
import type { TutorReplacementIntelligenceV15 } from './services/tutor-replacement-intelligence-v15.js';
import type { TutorReplacementPortfolioAuditV15 } from './services/tutor-replacement-portfolio-v15.js';
import {
  runTutorReplacementToolV15,
  type TutorReplacementToolDependenciesV15,
} from './server-v15-tutor-replacements.js';

function route(comboId: string): VerifiedWinningComboDetailV15 {
  return {
    comboId,
    bracketTag: 'R',
    comboCardNames: ['Commander', 'Piece B'],
    seedNames: ['Piece B'],
    results: ['Each opponent loses the game'],
    requirementNames: [],
    description: null,
    manaNeeded: null,
    otherPrerequisites: null,
    dependencyCompleteness: 'explicit-cards-only',
    closureKind: 'all-opponents-lose',
    closureTiming: 'immediate',
    closureScope: 'all-opponents',
  };
}

function evaluation(routes: VerifiedWinningComboDetailV15[], options: {
  hardGatesPassed?: boolean;
  comboStatus?: 'available' | 'unavailable' | 'unknown';
} = {}): CommanderBuildEvaluationV15 {
  return {
    hardGatesPassed: options.hardGatesPassed ?? true,
    parsed: {
      main: [],
      commanders: [{ name: 'Commander', quantity: 1 }],
      totalMain: 99,
      totalCommanders: 1,
      totalCards: 100,
    },
    commanderRules: { isLegal: true },
    unresolvedCards: [],
    printingPolicySatisfied: true,
    perCardBudgetAudit: { status: 'not-requested' },
    resolvedCards: [],
    postBuildEvidence: {
      spellbookComboSourceStatus: options.comboStatus ?? 'available',
      spellbookComboSourceFailure: options.comboStatus === 'unavailable' ? { message: 'provider down' } : null,
      comboVerificationComplete: options.comboStatus !== 'unavailable',
      verifiedWinningComboDetails: routes,
    },
  } as unknown as CommanderBuildEvaluationV15;
}

function replacementAudit(): TutorReplacementIntelligenceV15 {
  return {
    comboId: 'route-a',
    status: 'replacement-options-evaluated',
    baselineValue: {} as TutorReplacementIntelligenceV15['baselineValue'],
    sourceTutorChoices: ['Premium Tutor'],
    sources: [{
      sourceTutorName: 'Premium Tutor',
      sourcePrice: {} as TutorReplacementIntelligenceV15['sources'][number]['sourcePrice'],
      sourceCoversPieces: ['Piece B'],
      replacements: [{
        sourceTutorName: 'Premium Tutor',
        replacementTutorName: 'Budget Tutor',
      } as TutorReplacementIntelligenceV15['sources'][number]['replacements'][number]],
      rejected: [],
    }],
    candidatePool: {
      query: 'test',
      ordering: 'scryfall-edhrec',
      maximumSearchResults: 50,
      returnedSearchResults: 1,
      eligibleExactPrintings: 1,
      completeness: 'bounded-top-results-not-exhaustive',
    },
    threshold: {
      maxAccessLossPercentagePoints: null,
      semantics: 'applies-independently-to-opening-turn3-turn5',
    },
    guidance: 'test',
  };
}

function portfolioAudit(routeIds: string[] = ['route-a']): TutorReplacementPortfolioAuditV15 {
  return {
    status: 'portfolio-evaluated',
    routeCount: routeIds.length,
    maximumRoutes: 8,
    routeIds,
    thresholdPercentagePoints: null,
    candidates: [],
    unresolvedReplacementPrintings: [],
    guidance: 'test',
  };
}

test('does not guess between multiple verified full-table win routes', async () => {
  let auditCalls = 0;
  const result = await runTutorReplacementToolV15({
    decklist: 'test',
    includeTopDeckEvidence: false,
    topDeckLastDays: 30,
    topDeckParticipantMin: 16,
  }, {
    evaluateBuild: async () => evaluation([route('route-a'), route('route-b')]),
    auditReplacements: async () => {
      auditCalls += 1;
      return replacementAudit();
    },
  });

  assert.equal(result.status, 'route-selection-required');
  assert.equal(auditCalls, 0);
  assert.equal((result.verifiedRoutes as unknown[]).length, 2);
});

test('Commander Spellbook unavailability remains unknown rather than no replacement', async () => {
  const result = await runTutorReplacementToolV15({
    decklist: 'test', comboId: 'route-a', includeTopDeckEvidence: false, topDeckLastDays: 30, topDeckParticipantMin: 16,
  }, {
    evaluateBuild: async () => evaluation([], { comboStatus: 'unavailable' }),
  });
  assert.equal(result.status, 'combo-source-unavailable');
  assert.deepEqual(result.sourceFailure, { message: 'provider down' });
});

test('forwards explicit constraints and sends every verified route to the portfolio safety audit', async () => {
  type ReplacementInput = Parameters<NonNullable<TutorReplacementToolDependenciesV15['auditReplacements']>>[0];
  type PortfolioInput = Parameters<NonNullable<TutorReplacementToolDependenciesV15['auditPortfolio']>>[0];
  const captured: {
    replacementInput?: ReplacementInput;
    portfolioInput?: PortfolioInput;
    evaluationOptions?: Record<string, unknown>;
  } = {};
  const result = await runTutorReplacementToolV15({
    decklist: 'test',
    comboId: 'route-a',
    sourceTutorName: 'Premium Tutor',
    printingFamily: 'final-fantasy',
    allowedSets: ['FIN'],
    includePromos: false,
    includeSpecialReleases: true,
    maxUsdPerCard: 20,
    candidateMaxUsdPerCard: 8,
    excludedCards: ['Excluded Tutor'],
    maxAccessLossPercentagePoints: 0.5,
    includeTopDeckEvidence: false,
    topDeckLastDays: 30,
    topDeckParticipantMin: 16,
  }, {
    evaluateBuild: async (_decklist, options) => {
      captured.evaluationOptions = options as unknown as Record<string, unknown>;
      return evaluation([route('route-a'), route('route-b')]);
    },
    auditReplacements: async (input) => {
      captured.replacementInput = input;
      return replacementAudit();
    },
    auditPortfolio: async (input) => {
      captured.portfolioInput = input;
      return portfolioAudit(input.routes.map((item) => item.comboId));
    },
  });

  assert.equal(result.status, 'verified-route-tutor-replacements-audited');
  assert.equal(captured.evaluationOptions?.printingFamily, 'final-fantasy');
  assert.deepEqual(captured.evaluationOptions?.allowedSets, ['FIN']);
  assert.equal(captured.evaluationOptions?.includePromos, false);
  assert.equal(captured.evaluationOptions?.includeSpecialReleases, true);
  assert.equal(captured.evaluationOptions?.maxUsdPerCard, 20);
  assert.equal(captured.evaluationOptions?.maxComboResults, 100);
  assert.equal(Object.hasOwn(captured.evaluationOptions ?? {}, 'candidateMaxUsdPerCard'), false, 'candidate-only cap must not become a baseline hard-deck gate');
  assert.equal(captured.replacementInput?.sourceTutorName, 'Premium Tutor');
  assert.equal(captured.replacementInput?.constraints?.printingFamily, 'final-fantasy');
  assert.deepEqual(captured.replacementInput?.constraints?.allowedSets, ['FIN']);
  assert.equal(captured.replacementInput?.constraints?.includePromos, false);
  assert.equal(captured.replacementInput?.constraints?.includeSpecialReleases, true);
  assert.equal(captured.replacementInput?.constraints?.maxUsdPerCard, 20);
  assert.equal(captured.replacementInput?.constraints?.candidateMaxUsdPerCard, 8);
  assert.deepEqual(captured.replacementInput?.constraints?.excludedCards, ['Excluded Tutor']);
  assert.equal(captured.replacementInput?.constraints?.maxAccessLossPercentagePoints, 0.5);
  assert.deepEqual(captured.portfolioInput?.routes.map((item) => item.comboId), ['route-a', 'route-b']);
  assert.equal(captured.portfolioInput?.replacementAudit.status, 'replacement-options-evaluated');
  assert.deepEqual((result.portfolioSafety as TutorReplacementPortfolioAuditV15).routeIds, ['route-a', 'route-b']);
});

test('TopDeck failure is separate and cannot erase exact replacement or portfolio audits', async () => {
  const result = await runTutorReplacementToolV15({
    decklist: 'test', comboId: 'route-a', includeTopDeckEvidence: true, topDeckLastDays: 30, topDeckParticipantMin: 16,
  }, {
    evaluateBuild: async () => evaluation([route('route-a')]),
    auditReplacements: async () => replacementAudit(),
    auditPortfolio: async () => portfolioAudit(),
    fetchTopDeck: async () => { throw new Error('TopDeck rate limited'); },
  });

  assert.equal(result.status, 'verified-route-tutor-replacements-audited');
  assert.equal(result.topDeckEvidence, null);
  assert.deepEqual(result.sourceErrors, { topDeck: 'TopDeck rate limited' });
  assert.equal((result.replacementAudit as TutorReplacementIntelligenceV15).status, 'replacement-options-evaluated');
  assert.equal((result.portfolioSafety as TutorReplacementPortfolioAuditV15).status, 'portfolio-evaluated');
});