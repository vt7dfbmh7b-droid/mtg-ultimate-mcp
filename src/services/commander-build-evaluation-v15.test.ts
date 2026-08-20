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
    commanderNames: ['Commander'],
    spellbookBracket: { sourceStatus: 'available', bracketTag: 'R', strategicallyRelevantCombos: [{}, {}] },
    efficientWinPlanSupported: true,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  };
}

test('post-build evidence counts only full-table game-ending combos as Ruthless winning combos', () => {
  const evidence = derivePostBuildEvidenceV15({
    ...baseEvidenceInput(),
    combos: {
      sourceStatus: 'available',
      verificationComplete: true,
      counts: { included: 5 },
      included: [
        { id: 'life', bracketTag: 'R', results: ['Infinite life'] },
        { id: 'mana', bracketTag: 'R', results: ['Infinite mana'] },
        { id: 'single', bracketTag: 'R', results: ['Target opponent loses the game'] },
        { id: 'damage', bracketTag: 'R', results: ['Infinite damage'] },
        { id: 'win', bracketTag: 'R', results: ['Win the game'] },
      ],
    },
  });
  assert.equal(evidence.completeComboCount, 5);
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

test('post-build evidence requires explicit multiplayer scope for lethal engines', () => {
  const evidence = derivePostBuildEvidenceV15({
    ...baseEvidenceInput(),
    combos: {
      sourceStatus: 'available',
      verificationComplete: true,
      counts: { included: 3 },
      included: [
        { id: 'mana-only', bracketTag: 'R', results: ['Infinite mana'] },
        { id: 'generic-damage', bracketTag: 'R', results: ['Infinite damage'] },
        { id: 'table-damage', bracketTag: 'R', results: ['Infinite damage to each opponent'] },
      ],
    },
  });
  assert.equal(evidence.verifiedWinningCombos, 1);
  assert.deepEqual(evidence.verifiedWinningComboIds, ['table-damage']);
  assert.equal(evidence.ruthlessWinningCombos, 1);
});

test('post-build winning details preserve explicit dependencies and template-requirement uncertainty', () => {
  const evidence = derivePostBuildEvidenceV15({
    ...baseEvidenceInput(),
    combos: {
      sourceStatus: 'available',
      verificationComplete: true,
      counts: { included: 2 },
      included: [
        {
          id: 'commander-route',
          bracketTag: 'R',
          cards: [
            { name: 'Commander', quantity: 1, mustBeCommander: false },
            { name: 'Piece A', quantity: 1, mustBeCommander: false },
          ],
          results: ['Each opponent loses the game'],
          requirements: [],
        },
        {
          id: 'templated-route',
          bracketTag: null,
          cards: [{ name: 'Piece B', quantity: 1, mustBeCommander: false }],
          results: ['Win the game at the beginning of your next upkeep'],
          requirements: [{ name: 'A creature you control' }],
        },
      ],
    },
  });
  assert.deepEqual(evidence.verifiedWinningComboIds, ['commander-route', 'templated-route']);
  assert.deepEqual(evidence.verifiedWinningComboDetails[0], {
    comboId: 'commander-route',
    bracketTag: 'R',
    comboCardNames: ['Commander', 'Piece A'],
    seedNames: ['Piece A'],
    results: ['Each opponent loses the game'],
    requirementNames: [],
    dependencyCompleteness: 'explicit-cards-only',
    closureKind: 'all-opponents-lose',
    closureTiming: 'immediate',
    closureScope: 'all-opponents',
  });
  assert.equal(evidence.verifiedWinningComboDetails[1]?.dependencyCompleteness, 'template-requirements-present');
  assert.equal(evidence.verifiedWinningComboDetails[1]?.closureKind, 'delayed-game-win');
  assert.equal(evidence.verifiedWinningComboDetails[1]?.closureTiming, 'delayed');
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
  assert.equal(evidence.verifiedWinningComboDetails.length, 1);
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
  assert.deepEqual(evidence.verifiedWinningComboDetails, []);
  assert.equal(evidence.spellbookBracketSourceStatus, 'unavailable');
  assert.deepEqual(evidence.spellbookBracketSourceFailure, { kind: 'request-failed', attempts: 2 });
  assert.equal(evidence.spellbookComboSourceStatus, 'unavailable');
  assert.deepEqual(evidence.spellbookComboSourceFailure, { kind: 'request-failed', attempts: 2 });
  assert.equal(evidence.comboVerificationComplete, false);
  assert.equal(evidence.spellbookTag, null);
  assert.equal(evidence.strategicallyRelevantCombos, 0);
});
