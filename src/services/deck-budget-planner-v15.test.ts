import assert from 'node:assert/strict';
import test from 'node:test';
import { planBudgetedSelectionV15 } from './deck-budget-planner-v15.js';

test('planner fills every requested slot without exceeding the whole-deck budget', () => {
  const result = planBudgetedSelectionV15({
    slots: 3,
    maxTotalUsd: 10,
    fixedCostUsd: 2,
    requiredIds: ['required'],
    candidates: [
      { id: 'required', priceUsd: 3, score: 100 },
      { id: 'premium', priceUsd: 7, score: 99 },
      { id: 'efficient', priceUsd: 2, score: 80 },
      { id: 'cheap', priceUsd: 1, score: 60 },
    ],
  });

  assert.equal(result.status, 'complete');
  assert.deepEqual(result.selectedIds, ['required', 'efficient', 'cheap']);
  assert.equal(result.selectedCostUsd, 6);
  assert.equal(result.totalWithFixedCostUsd, 8);
  assert.ok(result.totalWithFixedCostUsd <= 10);
});

test('planner skips a higher-score card when it would make the remaining slots impossible', () => {
  const result = planBudgetedSelectionV15({
    slots: 3,
    maxTotalUsd: 6,
    fixedCostUsd: 0,
    candidates: [
      { id: 'expensive', priceUsd: 5, score: 100 },
      { id: 'a', priceUsd: 2, score: 80 },
      { id: 'b', priceUsd: 2, score: 70 },
      { id: 'c', priceUsd: 2, score: 60 },
    ],
  });

  assert.equal(result.status, 'complete');
  assert.deepEqual(result.selectedIds, ['a', 'b', 'c']);
  assert.equal(result.totalWithFixedCostUsd, 6);
});

test('planner fails closed when known prices prove the requested number of cards cannot fit', () => {
  const result = planBudgetedSelectionV15({
    slots: 3,
    maxTotalUsd: 5,
    fixedCostUsd: 2,
    candidates: [
      { id: 'a', priceUsd: 2, score: 80 },
      { id: 'b', priceUsd: 2, score: 70 },
      { id: 'c', priceUsd: 2, score: 60 },
    ],
  });

  assert.equal(result.status, 'infeasible');
  assert.equal(result.selectedIds.length, 0);
  assert.ok(result.reason?.includes('minimum'));
});

test('required cards are never silently dropped to manufacture budget compliance', () => {
  const result = planBudgetedSelectionV15({
    slots: 2,
    maxTotalUsd: 10,
    fixedCostUsd: 1,
    requiredIds: ['must-play'],
    candidates: [
      { id: 'must-play', priceUsd: 10, score: 1 },
      { id: 'cheap', priceUsd: 1, score: 100 },
    ],
  });

  assert.equal(result.status, 'infeasible');
  assert.ok(result.reason?.includes('required'));
});

test('unknown or invalid candidate prices are rejected rather than treated as free', () => {
  assert.throws(() => planBudgetedSelectionV15({
    slots: 1,
    maxTotalUsd: 10,
    fixedCostUsd: 0,
    candidates: [{ id: 'unknown', priceUsd: Number.NaN, score: 1 }],
  }), /finite non-negative price/i);
});

test('input order does not change a deterministic budget selection', () => {
  const input = {
    slots: 2,
    maxTotalUsd: 5,
    fixedCostUsd: 0,
    candidates: [
      { id: 'beta', priceUsd: 2, score: 10 },
      { id: 'alpha', priceUsd: 2, score: 10 },
      { id: 'gamma', priceUsd: 3, score: 9 },
    ],
  } as const;
  const forward = planBudgetedSelectionV15(input);
  const reverse = planBudgetedSelectionV15({ ...input, candidates: [...input.candidates].reverse() });
  assert.deepEqual(forward, reverse);
  assert.deepEqual(forward.selectedIds, ['alpha', 'beta']);
});
