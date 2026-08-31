import assert from 'node:assert/strict';
import test from 'node:test';
import { assessCedhComboPreservationV14 } from './cedh-efficiency-v14.js';

function evidence(results: string[][]): Record<string, unknown> {
  return {
    counts: { included: results.length },
    included: results.map((comboResults, index) => ({
      id: `combo-${index}`,
      results: comboResults,
      cards: [],
      requirements: [],
    })),
  };
}

test('efficiency refinement may remove incidental value combos when verified win count is preserved', () => {
  const before = evidence([
    ['Each opponent loses the game'],
    ['Infinite colorless mana'],
    ['Infinite artifact ETB'],
  ]);
  const after = evidence([
    ['Each opponent loses the game'],
    ['Infinite colorless mana'],
  ]);

  const result = assessCedhComboPreservationV14(before, after);
  assert.equal(result.beforeComboCount, 3);
  assert.equal(result.afterComboCount, 2);
  assert.equal(result.beforeWinningComboCount, 1);
  assert.equal(result.afterWinningComboCount, 1);
  assert.equal(result.acceptable, true);
});

test('efficiency refinement still fails closed when a verified winning route is lost', () => {
  const before = evidence([
    ['Each opponent loses the game'],
    ['Infinite colorless mana'],
  ]);
  const after = evidence([
    ['Infinite colorless mana'],
  ]);

  const result = assessCedhComboPreservationV14(before, after);
  assert.equal(result.beforeWinningComboCount, 1);
  assert.equal(result.afterWinningComboCount, 0);
  assert.equal(result.acceptable, false);
});

test('deterministic damage and mill wins count as protected winning evidence', () => {
  const before = evidence([
    ['Infinite damage'],
    ['Infinite mill'],
    ['Infinite mana'],
  ]);
  const after = evidence([
    ['Infinite damage'],
    ['Infinite mill'],
  ]);

  const result = assessCedhComboPreservationV14(before, after);
  assert.equal(result.beforeWinningComboCount, 2);
  assert.equal(result.afterWinningComboCount, 2);
  assert.equal(result.acceptable, true);
});
