import assert from 'node:assert/strict';
import test from 'node:test';
import { derivePostBuildEvidenceV15, type PostBuildEvidenceInputV15 } from './commander-build-evaluation-v15.js';

function baseEvidenceInput(): Omit<PostBuildEvidenceInputV15, 'combos'> {
  return {
    commanderLegal: true,
    exactCardCount: true,
    fullyResolved: true,
    printingPolicyCompliant: true,
    averageNonlandManaValue: 2.5,
    earlyPlayCount: 36,
    fastManaCount: 4,
    freeInteractionCount: 2,
    cheapInteractionCount: 9,
    tutorCount: 5,
    gameChangerNames: ['B', 'A', 'A'],
    spellbookBracket: { sourceStatus: 'available', bracketTag: 'R', strategicallyRelevantCombos: [{}, {}] },
    efficientWinPlanSupported: true,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  };
}

test('post-build evidence counts only strict game-ending combos as Ruthless winning combos', () => {
  const evidence = derivePostBuildEvidenceV15({
    ...baseEvidenceInput(),
    combos: {
      sourceStatus: 'available',
      verificationComplete: true,
      counts: { included: 4 },
      included: [
        { id: 'life', bracketTag: 'R', results: ['Infinite life'] },
        { id: 'mana', bracketTag: 'R', results: ['Infinite mana'] },
        { id: 'combat', bracketTag: 'R', results: ['Infinite combat phases'] },
        { id: 'win', bracketTag: 'R', results: ['Win the game'] },
      ],
    },
  });
  assert.equal(evidence.completeComboCount, 4);
  assert.equal(evidence.verifiedWinningCombos, 1);
  assert.deepEqual(evidence.verifiedWinningComboIds, ['win']);
  assert.equal(evidence.ruthlessWinningCombos, 1);
  assert.equal(evidence.strategicallyRelevantCombos, 2);
  assert.equal(evidence.spellbookBracketSourceStatus, 'available');
  assert.equal(evidence.spellbookBracketSourceFailure, null);
  assert.equal(evidence.spellbookComboSourceStatus, 'available');
  assert.equal(evidence.spellbookComboSourceFailure, null);
  assert.equal(evidence.comboVerificationComplete, true);
  assert.deepEqual(evidence.gameChangerNames, ['A', 'B']);
  assert.equal(evidence.signals.gameChangerCount, 2);
});

test('post-build evidence accepts a resource loop only when the same result includes lethal closure', () => {
  const evidence = derivePostBuildEvidenceV15({
    ...baseEvidenceInput(),
    combos: {
      sourceStatus: 'available',
      verificationComplete: true,
      counts: { included: 2 },
      included: [
        { id: 'mana-only', bracketTag: 'R', results: ['Infinite mana'] },
        { id: 'mana-damage', bracketTag: 'R', results: ['Infinite mana', 'Infinite damage'] },
      ],
    },
  });
  assert.equal(evidence.verifiedWinningCombos, 1);
  assert.deepEqual(evidence.verifiedWinningComboIds, ['mana-damage']);
  assert.equal(evidence.ruthlessWinningCombos, 1);
});

test('duplicate provider rows do not inflate verified or Ruthless winning-combo counts', () => {
  const evidence = derivePostBuildEvidenceV15({
    ...baseEvidenceInput(),
    combos: {
      sourceStatus: 'available',
      verificationComplete: true,
      counts: { included: 2 },
      included: [
        { id: 'same-win', bracketTag: 'R', results: ['Win the game'] },
        { id: 'same-win', bracketTag: 'R', results: ['Win the game'] },
      ],
    },
  });
  assert.equal(evidence.completeComboCount, 2);
  assert.equal(evidence.verifiedWinningCombos, 1);
  assert.deepEqual(evidence.verifiedWinningComboIds, ['same-win']);
  assert.equal(evidence.ruthlessWinningCombos, 1);
});

test('post-build evidence carries unavailable source provenance without manufacturing positive combo signals', () => {
  const evidence = derivePostBuildEvidenceV15({
    commanderLegal: false,
    exactCardCount: false,
    fullyResolved: false,
    printingPolicyCompliant: false,
    averageNonlandManaValue: 0,
    earlyPlayCount: 0,
    fastManaCount: 0,
    freeInteractionCount: 0,
    cheapInteractionCount: 0,
    tutorCount: 0,
    gameChangerNames: [],
    spellbookBracket: {
      sourceStatus: 'unavailable',
      sourceFailure: { kind: 'request-failed', attempts: 2 },
      bracketTag: null,
      strategicallyRelevantCombos: [],
    },
    combos: {
      sourceStatus: 'unavailable',
      verificationComplete: false,
      sourceFailure: { kind: 'request-failed', attempts: 2 },
      counts: { included: 0 },
      included: [],
    },
    efficientWinPlanSupported: false,
  });
  assert.equal(evidence.signals.commanderLegal, false);
  assert.equal(evidence.signals.exactCardCount, false);
  assert.equal(evidence.signals.fullyResolved, false);
  assert.equal(evidence.signals.printingPolicyCompliant, false);
  assert.equal(evidence.verifiedWinningCombos, 0);
  assert.deepEqual(evidence.verifiedWinningComboIds, []);
  assert.equal(evidence.spellbookBracketSourceStatus, 'unavailable');
  assert.deepEqual(evidence.spellbookBracketSourceFailure, { kind: 'request-failed', attempts: 2 });
  assert.equal(evidence.spellbookComboSourceStatus, 'unavailable');
  assert.deepEqual(evidence.spellbookComboSourceFailure, { kind: 'request-failed', attempts: 2 });
  assert.equal(evidence.comboVerificationComplete, false);
  assert.equal(evidence.spellbookTag, null);
  assert.equal(evidence.strategicallyRelevantCombos, 0);
});
