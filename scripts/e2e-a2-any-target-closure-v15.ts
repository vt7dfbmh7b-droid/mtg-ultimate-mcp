import assert from 'node:assert/strict';
import { assessFullTableWinClosureV15 } from '../src/services/full-table-win-closure-v15.js';
import { derivePostBuildEvidenceV15 } from '../src/services/commander-build-evaluation-v15.js';

const ballistaDescription = `Cast Gatta and Luzzu by paying {2}{W}.
When Gatta and Luzzu enters the battlefield, it triggers, targeting Walking Ballista.
Activate Walking Ballista by removing a +1/+1 counter from it, targeting itself, but instead putting two +1/+1 counters on it due to Gatta and Luzzu and The Earth Crystal.
Activate Walking Ballista by removing a +1/+1 counter from it, dealing 1 damage to any target.
Repeat from step 3.`;

const generic = assessFullTableWinClosureV15(['Infinite damage']);
assert.equal(generic.verifiedFullTableWin, false, 'generic unscoped Infinite damage must remain conservative');
assert.equal(generic.kind, 'unscoped-lethal-engine');

const ballista = assessFullTableWinClosureV15(['Infinite damage', 'Infinite +1/+1 counters on a creature'], ballistaDescription);
assert.equal(ballista.verifiedFullTableWin, true, 'repeatable any-target infinite damage must close the multiplayer table');
assert.equal(ballista.kind, 'all-opponents-damage');
assert.equal(ballista.scope, 'all-opponents');

const singleOpponent = assessFullTableWinClosureV15(['Target opponent loses the game']);
assert.equal(singleOpponent.verifiedFullTableWin, false, 'single-opponent kill must not become full-table closure');
assert.equal(singleOpponent.kind, 'single-opponent-kill');

const resourceOnly = assessFullTableWinClosureV15(['Infinite colorless mana']);
assert.equal(resourceOnly.verifiedFullTableWin, false, 'resource-only infinity must remain non-winning');
assert.equal(resourceOnly.kind, 'resource-engine-only');

const evidence = derivePostBuildEvidenceV15({
  commanderLegal: true,
  exactCardCount: true,
  fullyResolved: true,
  printingPolicyCompliant: true,
  averageNonlandManaValue: 2.17,
  earlyPlayCount: 46,
  fastManaCount: 3,
  freeInteractionCount: 1,
  cheapInteractionCount: 12,
  tutorCount: 4,
  gameChangerNames: ['Cyclonic Rift', 'Rhystic Study'],
  commanderNames: ["Tidus, Yuna's Guardian"],
  spellbookBracket: {
    bracketTag: 'P',
    sourceStatus: 'available',
    strategicallyRelevantCombos: [{}],
  },
  combos: {
    counts: { included: 1 },
    sourceStatus: 'available',
    verificationComplete: true,
    included: [{
      id: '3693-6593-6627',
      bracketTag: 'S',
      cards: [
        { name: 'Gatta and Luzzu', quantity: 1, mustBeCommander: false },
        { name: 'Walking Ballista', quantity: 1, mustBeCommander: false },
        { name: 'The Earth Crystal', quantity: 1, mustBeCommander: false },
      ],
      results: ['Infinite damage', 'Infinite +1/+1 counters on a creature'],
      requirements: [],
      description: ballistaDescription,
      manaNeeded: '{2}{W}',
    }],
  },
  efficientWinPlanSupported: true,
  cedhIntent: true,
  optimizedPlanEvidence: true,
  competitiveMetagameEvidence: false,
});

assert.equal(evidence.verifiedWinningCombos, 1, 'V15 post-build evidence must now recognize the verified Ballista table-closure line');
assert.deepEqual(evidence.verifiedWinningComboIds, ['3693-6593-6627']);
assert.equal(evidence.verifiedWinningComboDetails[0]?.closureKind, 'all-opponents-damage');
assert.equal(evidence.verifiedWinningComboDetails[0]?.closureScope, 'all-opponents');

console.log(JSON.stringify({
  status: 'pass',
  genericInfiniteDamage: generic,
  repeatableAnyTargetDamage: ballista,
  v15VerifiedWinningCombos: evidence.verifiedWinningCombos,
  verifiedWinningComboIds: evidence.verifiedWinningComboIds,
}, null, 2));
