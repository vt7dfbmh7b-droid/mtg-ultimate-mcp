import assert from 'node:assert/strict';
import test from 'node:test';
import { assessBracketCeilingV15 } from './bracket-ceiling-v15.js';

const hardPass = {
  commanderLegal: true,
  exactCardCount: true,
  fullyResolved: true,
  printingPolicyCompliant: true,
} as const;

const cedhConstruction = {
  ...hardPass,
  spellbookTag: 'R',
  verifiedWinningCombos: 2,
  ruthlessWinningCombos: 1,
  strategicallyRelevantCombos: 1,
  averageNonlandManaValue: 2.1,
  earlyPlayCount: 44,
  fastManaCount: 7,
  freeInteractionCount: 4,
  cheapInteractionCount: 13,
  tutorCount: 8,
  gameChangerCount: 5,
  optimizedPlanEvidence: true,
} as const;

test('requested Bracket 5 does not inflate a merely upgraded deck', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'P',
    verifiedWinningCombos: 0,
    averageNonlandManaValue: 3.4,
    earlyPlayCount: 20,
    fastManaCount: 1,
    freeInteractionCount: 0,
    cheapInteractionCount: 5,
    tutorCount: 1,
  }, ['FINAL FANTASY physical printings only']);

  assert.equal(result.assessedBracket, 3);
  assert.equal(result.targetGap, 2);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
  assert.ok(result.ceilingReasons.some((reason) => reason.includes('Constraint ceiling')));
});

test('strong static cEDH construction stays high Bracket 4 without intent and metagame evidence', () => {
  const result = assessBracketCeilingV15(5, cedhConstruction);
  assert.equal(result.bracket5ConstructionCandidate, true);
  assert.equal(result.assessedBracket, 4);
  assert.equal(result.assessedBand, 'high-bracket-4-cedh-construction-candidate');
  assert.ok(result.ceilingReasons.some((reason) => reason.includes('intent')));
  assert.ok(result.ceilingReasons.some((reason) => reason.includes('metagame')));
});

test('Bracket 5 requires construction, explicit cEDH intent and competitive metagame evidence together', () => {
  const result = assessBracketCeilingV15(5, {
    ...cedhConstruction,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  });
  assert.equal(result.assessedBracket, 5);
  assert.equal(result.bracket5CertifiedByThisAssessment, true);
  assert.equal(result.confidence, 'high');
  assert.equal(result.ceilingReasons.length, 0);
});

test('assessment is independent of a lower requested target', () => {
  const result = assessBracketCeilingV15(2, {
    ...cedhConstruction,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
  });
  assert.equal(result.assessedBracket, 4);
  assert.equal(result.targetGap, -2);
});

test('hard legality or printing failures make bracket assessment unassessable', () => {
  const result = assessBracketCeilingV15(4, {
    ...hardPass,
    commanderLegal: false,
    printingPolicyCompliant: false,
  });
  assert.equal(result.assessedBracket, null);
  assert.equal(result.hardGatesPassed, false);
  assert.equal(result.assessedBand, 'unassessable');
  assert.ok(result.ceilingReasons.length >= 2);
});

test('a pile of Game Changers without efficient structure or a coherent plan does not become optimized', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: null,
    verifiedWinningCombos: 0,
    averageNonlandManaValue: 4.1,
    earlyPlayCount: 11,
    fastManaCount: 0,
    freeInteractionCount: 0,
    cheapInteractionCount: 2,
    tutorCount: 0,
    gameChangerCount: 12,
    optimizedPlanEvidence: false,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  });
  assert.equal(result.assessedBracket, 3);
  assert.equal(result.bracket5ConstructionCandidate, false);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
});

test('one deterministic combo inside a slow weak shell cannot carry the whole deck to Bracket 4 or 5', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'R',
    verifiedWinningCombos: 1,
    ruthlessWinningCombos: 1,
    strategicallyRelevantCombos: 1,
    averageNonlandManaValue: 4.4,
    earlyPlayCount: 10,
    fastManaCount: 0,
    freeInteractionCount: 0,
    cheapInteractionCount: 2,
    tutorCount: 0,
    gameChangerCount: 0,
    optimizedPlanEvidence: false,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  });
  assert.equal(result.assessedBracket, 3);
  assert.equal(result.bracket5ConstructionCandidate, false);
});

test('competitive intent and metagame evidence cannot rescue a list that fails the construction gate', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'R',
    verifiedWinningCombos: 2,
    ruthlessWinningCombos: 1,
    averageNonlandManaValue: 2.9,
    earlyPlayCount: 30,
    fastManaCount: 2,
    freeInteractionCount: 0,
    cheapInteractionCount: 7,
    tutorCount: 3,
    optimizedPlanEvidence: true,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  });
  assert.equal(result.assessedBracket, 4);
  assert.equal(result.bracket5ConstructionCandidate, false);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
});

test('theme and budget constraints are reported as ceiling causes rather than silently weakening the standard', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'P',
    verifiedWinningCombos: 0,
    averageNonlandManaValue: 3.2,
    earlyPlayCount: 23,
    fastManaCount: 1,
    freeInteractionCount: 0,
    cheapInteractionCount: 5,
    tutorCount: 1,
  }, ['FINAL FANTASY physical printings only', 'NZ$20 maximum per card']);
  assert.equal(result.assessedBracket, 3);
  assert.ok(result.ceilingReasons.some((reason) => reason.includes('FINAL FANTASY')));
  assert.ok(result.ceilingReasons.some((reason) => reason.includes('NZ$20')));
});

test('Bracket 5 construction misses are reported gate by gate with observed and required values', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'P',
    verifiedWinningCombos: 0,
    ruthlessWinningCombos: 0,
    strategicallyRelevantCombos: 0,
    averageNonlandManaValue: 3.25,
    earlyPlayCount: 24,
    fastManaCount: 1,
    freeInteractionCount: 0,
    cheapInteractionCount: 5,
    tutorCount: 2,
    optimizedPlanEvidence: true,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  }, ['FINAL FANTASY physical printings only']);

  assert.equal(result.bracket5ConstructionCandidate, false);
  const byKey = new Map(result.bracket5ThresholdChecks.map((check) => [check.key, check]));
  assert.equal(byKey.get('average-nonland-mv')?.passed, false);
  assert.equal(byKey.get('average-nonland-mv')?.observed, 3.25);
  assert.equal(byKey.get('fast-mana')?.observed, 1);
  assert.equal(byKey.get('fast-mana')?.required, 'at least 3');
  assert.equal(byKey.get('free-interaction')?.observed, 0);
  assert.equal(byKey.get('verified-winning-combo')?.passed, false);
  assert.ok(result.ceilingReasons.some((reason) => reason.includes('Fast mana') && reason.includes('1') && reason.includes('3')));
  assert.ok(result.ceilingReasons.some((reason) => reason.includes('Average nonland mana value')));
});

test('a whole-deck budget gets detailed observed pressure points without a false causal claim', () => {
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'P',
    verifiedWinningCombos: 1,
    ruthlessWinningCombos: 0,
    strategicallyRelevantCombos: 0,
    averageNonlandManaValue: 2.95,
    earlyPlayCount: 29,
    fastManaCount: 1,
    freeInteractionCount: 0,
    cheapInteractionCount: 6,
    tutorCount: 2,
    optimizedPlanEvidence: true,
    cedhIntent: true,
    competitiveMetagameEvidence: false,
  }, ['US$100 maximum total deck budget']);

  assert.equal(result.assessedBracket, 4);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
  assert.equal(result.constraintAnalysis.length, 1);
  const budget = result.constraintAnalysis[0];
  assert.equal(budget?.kind, 'budget');
  assert.equal(budget?.causality, 'observed-under-constraint-not-proven-causal');
  assert.ok(budget?.pressurePoints.includes('speed/curve'));
  assert.ok(budget?.pressurePoints.includes('fast-mana density'));
  assert.ok(budget?.pressurePoints.includes('free/cheap interaction'));
  assert.ok(budget?.pressurePoints.includes('tutor consistency'));
  assert.ok(budget?.summary.includes('US$100'));
  assert.ok(budget?.summary.includes('does not prove'));
});
