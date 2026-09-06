import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateDiversificationBudgetV15,
  shouldContinueCandidateDiversificationV15,
} from './optimizer-v12.js';

test('default candidate diversification keeps the historical minimum but can adapt to the existing hard ceiling', () => {
  assert.deepEqual(candidateDiversificationBudgetV15(), {
    minimumAttempts: 3,
    hardLimit: 6,
    adaptive: true,
  });
});

test('explicit candidate breadth remains an exact caller-controlled bound', () => {
  assert.deepEqual(candidateDiversificationBudgetV15(4), {
    minimumAttempts: 4,
    hardLimit: 4,
    adaptive: false,
  });
  assert.deepEqual(candidateDiversificationBudgetV15(99), {
    minimumAttempts: 6,
    hardLimit: 6,
    adaptive: false,
  });
});

test('adaptive diversification continues past the minimum only while a new search state is produced', () => {
  const budget = candidateDiversificationBudgetV15();
  assert.equal(shouldContinueCandidateDiversificationV15({
    attemptsCompleted: 2,
    budget,
    candidateProducedPlan: false,
    searchStateChanged: false,
  }), true);
  assert.equal(shouldContinueCandidateDiversificationV15({
    attemptsCompleted: 3,
    budget,
    candidateProducedPlan: true,
    searchStateChanged: true,
  }), true);
  assert.equal(shouldContinueCandidateDiversificationV15({
    attemptsCompleted: 4,
    budget,
    candidateProducedPlan: true,
    searchStateChanged: false,
  }), false);
  assert.equal(shouldContinueCandidateDiversificationV15({
    attemptsCompleted: 4,
    budget,
    candidateProducedPlan: false,
    searchStateChanged: true,
  }), false);
  assert.equal(shouldContinueCandidateDiversificationV15({
    attemptsCompleted: 6,
    budget,
    candidateProducedPlan: true,
    searchStateChanged: true,
  }), false);
});
