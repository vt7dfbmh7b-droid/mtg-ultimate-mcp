import assert from 'node:assert/strict';
import test from 'node:test';
import { assessCedhComboPreservationV14, winningComboCoreCountV14 } from './cedh-efficiency-v14.js';

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

function cardEvidence(combos: Array<{ results: string[]; cards: string[] }>): Record<string, unknown> {
  return {
    counts: { included: combos.length },
    included: combos.map((combo, index) => ({
      id: `combo-${index}`,
      results: combo.results,
      cards: combo.cards.map((name) => ({ name, quantity: 1, mustBeCommander: false })),
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

test('winning variants that share a critical combo card are one independent win core', () => {
  const before = cardEvidence([
    {
      results: ['Each opponent loses the game'],
      cards: ['Doomsday Excruciator', 'Shared Trauma'],
    },
    {
      results: ['Each opponent loses the game'],
      cards: ['Doomsday Excruciator', 'One Ring to Rule Them All'],
    },
  ]);
  const after = cardEvidence([
    {
      results: ['Each opponent loses the game'],
      cards: ['Doomsday Excruciator', 'Shared Trauma'],
    },
  ]);

  assert.equal(winningComboCoreCountV14(before), 1);
  assert.equal(winningComboCoreCountV14(after), 1);
  const result = assessCedhComboPreservationV14(before, after);
  assert.equal(result.beforeWinningComboCount, 2);
  assert.equal(result.afterWinningComboCount, 1);
  assert.equal(result.beforeWinningComboCoreCount, 1);
  assert.equal(result.afterWinningComboCoreCount, 1);
  assert.equal(result.acceptable, true);
});

test('efficiency refinement must not collapse two independent winning cores into one', () => {
  const before = cardEvidence([
    {
      results: ['Each opponent loses the game'],
      cards: ['Doomsday Excruciator', 'Shared Trauma'],
    },
    {
      results: ['Each opponent loses an arbitrarily large amount of life'],
      cards: ['Pitiless Plunderer', 'Reassembling Skeleton', "Ashnod's Altar", 'Mirkwood Bats'],
    },
  ]);
  const after = cardEvidence([
    {
      results: ['Each opponent loses the game'],
      cards: ['Doomsday Excruciator', 'Shared Trauma'],
    },
  ]);

  assert.equal(winningComboCoreCountV14(before), 2);
  assert.equal(winningComboCoreCountV14(after), 1);
  const result = assessCedhComboPreservationV14(before, after);
  assert.equal(result.beforeWinningComboCoreCount, 2);
  assert.equal(result.afterWinningComboCoreCount, 1);
  assert.equal(result.acceptable, false);
});
