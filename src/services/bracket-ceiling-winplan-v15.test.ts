import assert from 'node:assert/strict';
import test from 'node:test';
import { assessBracketCeilingV15 } from './bracket-ceiling-v15.js';

const hardPass = {
  commanderLegal: true,
  exactCardCount: true,
  fullyResolved: true,
  printingPolicyCompliant: true,
} as const;

test('an optimized efficient non-combo win plan can support Bracket 4 without pretending it is cEDH', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'P',
    verifiedWinningCombos: 0,
    ruthlessWinningCombos: 0,
    strategicallyRelevantCombos: 0,
    averageNonlandManaValue: 2.45,
    earlyPlayCount: 42,
    fastManaCount: 4,
    freeInteractionCount: 2,
    cheapInteractionCount: 10,
    tutorCount: 6,
    gameChangerCount: 3,
    efficientWinConditionEvidence: true,
    optimizedPlanEvidence: true,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
  });

  assert.equal(result.assessedBracket, 4);
  assert.equal(result.assessedBand, 'bracket-4-optimized-range');
  assert.equal(result.bracket5ConstructionCandidate, false);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
  assert.ok(result.supportingSignals.some((signal) => signal.includes('efficient non-combo win condition')));
});

test('raw speed and interaction alone do not invent a Bracket 4 win plan when win-condition evidence is absent', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'P',
    verifiedWinningCombos: 0,
    averageNonlandManaValue: 2.45,
    earlyPlayCount: 42,
    fastManaCount: 4,
    freeInteractionCount: 2,
    cheapInteractionCount: 10,
    tutorCount: 6,
    gameChangerCount: 3,
    optimizedPlanEvidence: true,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
  });

  assert.equal(result.assessedBracket, 3);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
});

test('efficient non-combo win evidence never satisfies the stricter Bracket 5 win-package gate by itself', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'P',
    verifiedWinningCombos: 0,
    ruthlessWinningCombos: 0,
    strategicallyRelevantCombos: 0,
    averageNonlandManaValue: 2.2,
    earlyPlayCount: 48,
    fastManaCount: 7,
    freeInteractionCount: 4,
    cheapInteractionCount: 14,
    tutorCount: 9,
    gameChangerCount: 8,
    efficientWinConditionEvidence: true,
    optimizedPlanEvidence: true,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  });

  assert.equal(result.assessedBracket, 4);
  assert.equal(result.bracket5ConstructionCandidate, false);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
  assert.ok(result.ceilingReasons.some((reason) => reason.includes('Verified win-oriented combos')));
});
