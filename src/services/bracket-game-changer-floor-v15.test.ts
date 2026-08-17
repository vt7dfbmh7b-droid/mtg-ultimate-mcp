import assert from 'node:assert/strict';
import test from 'node:test';
import { assessBracketCeilingV15 } from './bracket-ceiling-v15.js';

const base = {
  commanderLegal: true,
  exactCardCount: true,
  fullyResolved: true,
  printingPolicyCompliant: true,
  verifiedWinningCombos: 0,
  averageNonlandManaValue: 3.4,
  earlyPlayCount: 20,
  fastManaCount: 1,
  freeInteractionCount: 0,
  cheapInteractionCount: 5,
  tutorCount: 1,
  optimizedPlanEvidence: false,
} as const;

test('four Game Changers force at least Bracket 4 under the current Commander bracket limits', () => {
  const result = assessBracketCeilingV15(4, { ...base, gameChangerCount: 4 });
  assert.equal(result.assessedBracket, 4);
  assert.equal(result.assessedBand, 'bracket-4-game-changer-floor');
});

test('three Game Changers are still permitted in Bracket 3 and do not prove an optimized win plan', () => {
  const result = assessBracketCeilingV15(4, { ...base, gameChangerCount: 3 });
  assert.equal(result.assessedBracket, 3);
  assert.equal(result.assessedBand, 'bracket-3-upgraded-range');
});

test('zero Game Changers does not cap a genuinely optimized deck below Bracket 4', () => {
  const result = assessBracketCeilingV15(4, {
    ...base,
    gameChangerCount: 0,
    averageNonlandManaValue: 2.5,
    earlyPlayCount: 40,
    fastManaCount: 4,
    freeInteractionCount: 2,
    cheapInteractionCount: 10,
    tutorCount: 5,
    efficientWinConditionEvidence: true,
    optimizedPlanEvidence: true,
  });
  assert.equal(result.assessedBracket, 4);
});
