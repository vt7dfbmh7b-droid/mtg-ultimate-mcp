import assert from 'node:assert/strict';
import test from 'node:test';
import { derivePostBuildEvidenceV15 } from './commander-build-evaluation-v15.js';

test('post-build evidence counts only combos that actually win as Ruthless winning combos', () => {
  const evidence = derivePostBuildEvidenceV15({
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
    combos: {
      counts: { included: 2 },
      included: [
        { id: 'life', bracketTag: 'R', results: ['Infinite life'] },
        { id: 'win', bracketTag: 'R', results: ['Win the game'] },
      ],
    },
    efficientWinPlanSupported: true,
    cedhIntent: true,
    competitiveMetagameEvidence: true,
  });
  assert.equal(evidence.completeComboCount, 2);
  assert.equal(evidence.verifiedWinningCombos, 1);
  assert.deepEqual(evidence.verifiedWinningComboIds, ['win']);
  assert.equal(evidence.ruthlessWinningCombos, 1);
  assert.equal(evidence.strategicallyRelevantCombos, 2);
  assert.equal(evidence.spellbookBracketSourceStatus, 'available');
  assert.equal(evidence.spellbookBracketSourceFailure, null);
  assert.deepEqual(evidence.gameChangerNames, ['A', 'B']);
  assert.equal(evidence.signals.gameChangerCount, 2);
});

test('post-build evidence carries hard failures and unavailable advisory provenance without manufacturing signals', () => {
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
    combos: { counts: { included: 0 }, included: [] },
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
  assert.equal(evidence.spellbookTag, null);
  assert.equal(evidence.strategicallyRelevantCombos, 0);
});
