import assert from 'node:assert/strict';
import test from 'node:test';
import { assessActualBracketV15 } from './actual-bracket-assessment-v15.js';
import { compareRequestedBracketV15 } from './bracket-target-comparison-v15.js';
import type { BracketAssessmentSignalsV15 } from './bracket-ceiling-v15.js';

function baseSignals(overrides: Partial<BracketAssessmentSignalsV15> = {}): BracketAssessmentSignalsV15 {
  return {
    commanderLegal: true,
    exactCardCount: true,
    fullyResolved: true,
    printingPolicyCompliant: true,
    spellbookTag: null,
    verifiedWinningCombos: 0,
    ruthlessWinningCombos: 0,
    strategicallyRelevantCombos: 0,
    averageNonlandManaValue: 4,
    earlyPlayCount: 12,
    fastManaCount: 0,
    freeInteractionCount: 0,
    cheapInteractionCount: 2,
    tutorCount: 0,
    gameChangerCount: 0,
    efficientWinConditionEvidence: false,
    optimizedPlanEvidence: false,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
    exhibitionIntent: false,
    ...overrides,
  };
}

test('requested Bracket 3 uses upgraded-deck criteria rather than leaking Bracket-5 diagnostics', () => {
  const signals = baseSignals();
  const actual = assessActualBracketV15(signals);
  assert.equal(actual.assessedBracket, 2);
  const comparison = compareRequestedBracketV15(3, actual, signals);
  assert.equal(comparison.status, 'under-target');
  assert.deepEqual(comparison.relevantChecks.map((item) => item.key), ['b3-upgraded-signal']);
  assert.equal(comparison.relevantChecks.some((item) => /cEDH|metagame/i.test(item.detail)), false);
});

test('requested Bracket 4 reports optimized structure and win-plan blockers, not cEDH evidence gates', () => {
  const signals = baseSignals({
    spellbookTag: 'P',
    earlyPlayCount: 20,
    cheapInteractionCount: 5,
    tutorCount: 1,
  });
  const actual = assessActualBracketV15(signals);
  assert.equal(actual.assessedBracket, 3);
  const comparison = compareRequestedBracketV15(4, actual, signals);
  assert.equal(comparison.status, 'under-target');
  assert.ok(comparison.knownBlockers.some((item) => item.key === 'b4-optimized-pathway'));
  assert.ok(comparison.relevantChecks.some((item) => item.key === 'b4-win-evidence'));
  assert.equal(comparison.relevantChecks.some((item) => /competitive-metagame|cedh-intent/.test(item.key)), false);
});

test('Bracket 5 source outages become unverified evidence rather than false combo-absence claims', () => {
  const signals = baseSignals({
    averageNonlandManaValue: 2.4,
    earlyPlayCount: 40,
    fastManaCount: 4,
    freeInteractionCount: 2,
    cheapInteractionCount: 10,
    tutorCount: 6,
    efficientWinConditionEvidence: true,
    optimizedPlanEvidence: true,
    cedhIntent: true,
    competitiveMetagameEvidence: false,
  });
  const actual = assessActualBracketV15(signals);
  assert.equal(actual.assessedBracket, 4);
  const comparison = compareRequestedBracketV15(5, actual, signals, {
    spellbookBracketSourceStatus: 'unavailable',
    spellbookComboSourceStatus: 'unavailable',
    comboVerificationComplete: false,
  });
  assert.equal(comparison.status, 'under-target');
  assert.equal(comparison.evidenceCompleteness, 'partial');
  const comboCheck = comparison.relevantChecks.find((item) => item.key === 'verified-winning-combo');
  assert.equal(comboCheck?.state, 'unverified');
  assert.match(comboCheck?.detail ?? '', /not proof the deck lacks/i);
  assert.ok(comparison.unverifiedChecks.some((item) => item.key === 'b5-combo-source-health'));
  assert.ok(comparison.knownBlockers.some((item) => item.key === 'competitive-metagame-evidence'));
});

test('meeting the requested Bracket 4 produces reached status with no upgrade prescription', () => {
  const signals = baseSignals({
    averageNonlandManaValue: 2.8,
    earlyPlayCount: 30,
    fastManaCount: 2,
    cheapInteractionCount: 7,
    tutorCount: 3,
    efficientWinConditionEvidence: true,
  });
  const actual = assessActualBracketV15(signals);
  assert.equal(actual.assessedBracket, 4);
  const comparison = compareRequestedBracketV15(4, actual, signals);
  assert.equal(comparison.status, 'reached');
  assert.equal(comparison.targetGap, 0);
  assert.deepEqual(comparison.whatWouldReachTarget, []);
});

test('hard truth failure makes target comparison unassessable', () => {
  const signals = baseSignals({ commanderLegal: false });
  const actual = assessActualBracketV15(signals);
  const comparison = compareRequestedBracketV15(5, actual, signals);
  assert.equal(comparison.status, 'unassessable');
  assert.equal(comparison.achievedBracket, null);
  assert.equal(comparison.targetGap, null);
});
