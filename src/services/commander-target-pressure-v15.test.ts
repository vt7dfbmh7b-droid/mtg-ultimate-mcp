import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commanderTargetPressureV15,
  selectTargetAwareWinPackageV15,
} from './commander-target-pressure-v15.js';
import type { GeneralWinPackageCandidateV15 } from './general-win-package-v15.js';

function candidate(comboId: string, bracketTag: string | null, score: number): GeneralWinPackageCandidateV15 {
  return {
    comboId,
    bracketTag,
    comboCardNames: ['A', 'B'],
    seedNames: ['A', 'B'],
    results: ['Win the game.'],
    closureKind: 'direct-game-win',
    closureCaveat: '',
    resourceOutputs: [],
    exactPrintings: [],
    commanderOverlap: 0,
    totalManaValue: 2,
    reusableRoleCount: 0,
    deadPieceRisk: 0,
    score,
    popularity: 0,
  };
}

test('Bracket 5 exposes existing free-interaction and win-package pressure without changing lower brackets', () => {
  const four = commanderTargetPressureV15(4);
  assert.equal(four.minimumFreeInteraction, 0);
  assert.equal(four.verifiedWinningPackageRequired, false);
  assert.equal(four.competitiveComboSignalRequired, false);

  const five = commanderTargetPressureV15(5);
  assert.equal(five.minimumFreeInteraction, 1);
  assert.equal(five.verifiedWinningPackageRequired, true);
  assert.equal(five.competitiveComboSignalRequired, true);
  assert.equal(five.preferRuthlessPackage, true);
});

test('Bracket 5 prefers an existing R-tagged verified package but falls back to the existing portfolio selection', () => {
  const popularP = candidate('p-package', 'P', 2000);
  const ruthless = candidate('r-package', 'R', 1500);
  assert.equal(selectTargetAwareWinPackageV15(5, [popularP, ruthless], popularP)?.comboId, 'r-package');
  assert.equal(selectTargetAwareWinPackageV15(4, [popularP, ruthless], popularP)?.comboId, 'p-package');
  assert.equal(selectTargetAwareWinPackageV15(5, [popularP], popularP)?.comboId, 'p-package');
});
