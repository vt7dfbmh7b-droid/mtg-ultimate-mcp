import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CommanderBuildEvaluationV15,
  VerifiedWinningComboDetailV15,
} from './services/commander-build-evaluation-v15.js';
import type { TopDeckLearningFetchResultV15 } from './services/topdeck-learning-live-v15.js';
import type { TopDeckTutorPrevalenceAuditV15 } from './services/topdeck-tutor-prevalence-v15.js';
import type { TutorValueForMoneyAuditV15 } from './services/tutor-value-for-money-v15.js';
import { runTutorValueForMoneyToolV15 } from './server-v15-tutor-value.js';

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

function evaluation(routes: VerifiedWinningComboDetailV15[], options: { hardGatesPassed?: boolean; comboStatus?: 'available' | 'unavailable' | 'unknown' } = {}): CommanderBuildEvaluationV15 {
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

function valueAudit(tutorName = 'Tutor X'): TutorValueForMoneyAuditV15 {
  return {
    comboId: 'route-a',
    status: 'exact-marginal-value',
    baselineAccess: {} as TutorValueForMoneyAuditV15['baselineAccess'],
    candidates: [{ tutorName } as TutorValueForMoneyAuditV15['candidates'][number]],
    qualifyingTutorCount: 1,
    evaluatedTutorCount: 1,
    maxTutorCandidates: 24,
    comparisonMethod: 'same-deck-one-slot-neutral-replacement-v15',
    priceMethod: 'exact-resolved-printing-v15',
    dominanceMethod: 'pareto-price-and-selected-checkpoint-marginal-access-v15',
    guidance: 'test',
  };
}

test('does not guess which verified route to value when multiple full-table routes exist', async () => {
  let auditCalls = 0;
  const result = await runTutorValueForMoneyToolV15(
    { decklist: 'test', includeTopDeckEvidence: false, topDeckLastDays: 30, topDeckParticipantMin: 16 },
    {
      evaluateBuild: async () => evaluation([route('route-a'), route('route-b')]),
      auditValue: () => {
        auditCalls += 1;
        return valueAudit();
      },
    },
  );

  assert.equal(result.status, 'route-selection-required');
  assert.equal(auditCalls, 0);
  assert.equal((result.verifiedRoutes as unknown[]).length, 2);
});

test('provider unavailability stays distinct from absence of a winning route', async () => {
  const result = await runTutorValueForMoneyToolV15(
    { decklist: 'test', comboId: 'route-a', includeTopDeckEvidence: false, topDeckLastDays: 30, topDeckParticipantMin: 16 },
    { evaluateBuild: async () => evaluation([], { comboStatus: 'unavailable' }) },
  );

  assert.equal(result.status, 'combo-source-unavailable');
  assert.deepEqual(result.sourceFailure, { message: 'provider down' });
});

test('requested combo id must already be a verified full-table route', async () => {
  let auditCalls = 0;
  const result = await runTutorValueForMoneyToolV15(
    { decklist: 'test', comboId: 'not-real', includeTopDeckEvidence: false, topDeckLastDays: 30, topDeckParticipantMin: 16 },
    {
      evaluateBuild: async () => evaluation([route('route-a')]),
      auditValue: () => {
        auditCalls += 1;
        return valueAudit();
      },
    },
  );

  assert.equal(result.status, 'verified-route-not-found');
  assert.equal(auditCalls, 0);
});

test('TopDeck failure is reported separately and does not erase a successful exact tutor-value audit', async () => {
  const result = await runTutorValueForMoneyToolV15(
    { decklist: 'test', comboId: 'route-a', includeTopDeckEvidence: true, topDeckLastDays: 30, topDeckParticipantMin: 16 },
    {
      evaluateBuild: async () => evaluation([route('route-a')]),
      auditValue: () => valueAudit('Tutor X'),
      fetchTopDeck: async () => { throw new Error('TopDeck rate limited'); },
    },
  );

  assert.equal(result.status, 'verified-route-tutor-value-audited');
  assert.equal(result.topDeckEvidence, null);
  assert.deepEqual(result.sourceErrors, { topDeck: 'TopDeck rate limited' });
  assert.equal((result.tutorValue as TutorValueForMoneyAuditV15).candidates[0]?.tutorName, 'Tutor X');
});

test('optional TopDeck evidence receives only the evaluated tutor names and exact commander context', async () => {
  let requestedTutorNames: readonly string[] = [];
  let requestedCommanderNames: readonly string[] = [];
  const fetched = {
    source: 'topdeck-v2',
    fetchedAt: '2026-08-20T00:00:00.000Z',
    query: { lastDays: 30, participantMin: 16 },
    tournamentsReturned: 1,
    candidates: [],
    rejected: [],
    attribution: 'Data provided by TopDeck.gg',
  } as unknown as TopDeckLearningFetchResultV15;
  const prevalence = {
    sourceId: 'topdeck',
    sourceSemantics: 'advisory-tournament-prevalence-only',
  } as unknown as TopDeckTutorPrevalenceAuditV15;

  const result = await runTutorValueForMoneyToolV15(
    { decklist: 'test', comboId: 'route-a', includeTopDeckEvidence: true, topDeckLastDays: 30, topDeckParticipantMin: 16 },
    {
      evaluateBuild: async () => evaluation([route('route-a')]),
      auditValue: () => valueAudit('Tutor X'),
      fetchTopDeck: async () => fetched,
      auditTopDeck: (input) => {
        requestedTutorNames = input.tutorNames;
        requestedCommanderNames = input.commanderNames ?? [];
        return prevalence;
      },
    },
  );

  assert.equal(result.status, 'verified-route-tutor-value-audited');
  assert.deepEqual(requestedTutorNames, ['Tutor X']);
  assert.deepEqual(requestedCommanderNames, ['Commander']);
  assert.equal((result.topDeckEvidence as Record<string, unknown>).usableCandidates, 0);
});
