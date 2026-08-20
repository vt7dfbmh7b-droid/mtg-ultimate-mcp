import assert from 'node:assert/strict';
import test from 'node:test';
import { assessActualBracketV15 } from './actual-bracket-assessment-v15.js';
import {
  assessBracketCeilingV15,
  type BracketAssessmentSignalsV15,
} from './bracket-ceiling-v15.js';

const legalBase: BracketAssessmentSignalsV15 = {
  commanderLegal: true,
  exactCardCount: true,
  fullyResolved: true,
  printingPolicyCompliant: true,
  spellbookTag: null,
  verifiedWinningCombos: 0,
  ruthlessWinningCombos: 0,
  strategicallyRelevantCombos: 0,
  averageNonlandManaValue: 3.4,
  earlyPlayCount: 15,
  fastManaCount: 0,
  freeInteractionCount: 0,
  cheapInteractionCount: 3,
  tutorCount: 0,
  gameChangerCount: 0,
  efficientWinConditionEvidence: false,
  cedhIntent: false,
  competitiveMetagameEvidence: false,
};

function parity(signals: BracketAssessmentSignalsV15): void {
  const actual = assessActualBracketV15(signals, ['Final Fantasy physical printings only.']);
  const lowTarget = assessBracketCeilingV15(1, signals, ['Final Fantasy physical printings only.']);
  const highTarget = assessBracketCeilingV15(5, signals, ['Final Fantasy physical printings only.']);
  assert.equal(actual.assessedBracket, lowTarget.assessedBracket);
  assert.equal(actual.assessedBracket, highTarget.assessedBracket);
  assert.equal(actual.assessedBand, lowTarget.assessedBand);
  assert.equal(actual.assessedBand, highTarget.assessedBand);
  assert.equal(actual.bracket5ConstructionCandidate, lowTarget.bracket5ConstructionCandidate);
  assert.equal(actual.bracket5CertifiedByThisAssessment, lowTarget.bracket5CertifiedByThisAssessment);
  assert.deepEqual(
    actual.bracket5ThresholdChecks.map((check) => [check.key, check.passed]),
    lowTarget.bracket5ThresholdChecks.map((check) => [check.key, check.passed]),
  );
}

test('target-free assessor refuses to assign power before hard truth gates pass', () => {
  const result = assessActualBracketV15({ ...legalBase, exactCardCount: false });
  assert.equal(result.assessedBracket, null);
  assert.equal(result.assessedBand, 'unassessable');
  assert.equal(result.hardGatesPassed, false);
});

test('target-free assessor matches the established actual result across core, upgraded, and optimized fixtures', () => {
  parity(legalBase);
  parity({
    ...legalBase,
    spellbookTag: 'P',
    earlyPlayCount: 22,
    cheapInteractionCount: 5,
    tutorCount: 1,
  });
  parity({
    ...legalBase,
    averageNonlandManaValue: 2.7,
    earlyPlayCount: 32,
    fastManaCount: 3,
    freeInteractionCount: 1,
    cheapInteractionCount: 9,
    tutorCount: 5,
    efficientWinConditionEvidence: true,
  });
});

test('target-free assessor does not certify Bracket 5 from construction alone', () => {
  const constructionOnly: BracketAssessmentSignalsV15 = {
    ...legalBase,
    spellbookTag: 'R',
    verifiedWinningCombos: 1,
    ruthlessWinningCombos: 1,
    strategicallyRelevantCombos: 1,
    averageNonlandManaValue: 2.2,
    earlyPlayCount: 45,
    fastManaCount: 5,
    freeInteractionCount: 2,
    cheapInteractionCount: 12,
    tutorCount: 8,
    gameChangerCount: 2,
    efficientWinConditionEvidence: true,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
  };
  const result = assessActualBracketV15(constructionOnly);
  assert.equal(result.bracket5ConstructionCandidate, true);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
  assert.equal(result.assessedBracket, 4);
});

test('Bracket 5 remains possible only when construction, explicit intent, and independent evidence are all present', () => {
  const result = assessActualBracketV15({
    ...legalBase,
    spellbookTag: 'R',
    verifiedWinningCombos: 1,
    ruthlessWinningCombos: 1,
    strategicallyRelevantCombos: 1,
    averageNonlandManaValue: 2.2,
    earlyPlayCount: 45,
    fastManaCount: 5,
    freeInteractionCount: 2,
    cheapInteractionCount: 12,
    tutorCount: 8,
    efficientWinConditionEvidence: true,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  });
  assert.equal(result.assessedBracket, 5);
  assert.equal(result.bracket5CertifiedByThisAssessment, true);
});
