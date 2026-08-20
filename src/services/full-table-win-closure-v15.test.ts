import assert from 'node:assert/strict';
import test from 'node:test';
import { assessFullTableWinClosureV15, isStrictFullTableWinResultV15 } from './full-table-win-closure-v15.js';

test('explicit self win is a full-table win', () => {
  const result = assessFullTableWinClosureV15(['Win the game']);
  assert.equal(result.verifiedFullTableWin, true);
  assert.equal(result.kind, 'direct-game-win');
  assert.equal(result.scope, 'self-win');
  assert.equal(result.timing, 'immediate');
});

test('delayed alternate wins remain wins but expose their slower timing', () => {
  const result = assessFullTableWinClosureV15(['Win the game at the beginning of your next upkeep']);
  assert.equal(result.verifiedFullTableWin, true);
  assert.equal(result.kind, 'delayed-game-win');
  assert.equal(result.timing, 'delayed');
});

test('each opponent loses closes a multiplayer table', () => {
  const result = assessFullTableWinClosureV15(['Each opponent loses the game']);
  assert.equal(result.verifiedFullTableWin, true);
  assert.equal(result.kind, 'all-opponents-lose');
  assert.equal(result.scope, 'all-opponents');
});

test('target opponent loses does not masquerade as a multiplayer win', () => {
  const result = assessFullTableWinClosureV15(['Target opponent loses the game', 'Infinite lifeloss for target opponent']);
  assert.equal(result.verifiedFullTableWin, false);
  assert.equal(result.kind, 'single-opponent-kill');
  assert.equal(result.scope, 'single-opponent');
});

test('generic infinite damage is lethal-scale but not full-table scoped', () => {
  const result = assessFullTableWinClosureV15(['Infinite damage']);
  assert.equal(result.verifiedFullTableWin, false);
  assert.equal(result.kind, 'unscoped-lethal-engine');
});

test('infinite damage explicitly to each opponent is full-table lethal', () => {
  const result = assessFullTableWinClosureV15(['Infinite damage to each opponent']);
  assert.equal(result.verifiedFullTableWin, true);
  assert.equal(result.kind, 'all-opponents-damage');
});

test('generic infinite lifeloss is not assumed to hit the whole table', () => {
  const result = assessFullTableWinClosureV15(['Infinite lifeloss']);
  assert.equal(result.verifiedFullTableWin, false);
  assert.equal(result.kind, 'unscoped-lethal-engine');
});

test('infinite life loss explicitly for all opponents is full-table lethal', () => {
  const result = assessFullTableWinClosureV15(['Infinite lifeloss for all opponents']);
  assert.equal(result.verifiedFullTableWin, true);
  assert.equal(result.kind, 'all-opponents-life-loss');
});

test('infinite mana and near-infinite value are resource engines, not table closure', () => {
  assert.equal(assessFullTableWinClosureV15(['Infinite mana']).kind, 'resource-engine-only');
  assert.equal(assessFullTableWinClosureV15(['Near-infinite card draw']).kind, 'resource-engine-only');
  assert.equal(isStrictFullTableWinResultV15(['Infinite mana']), false);
});

test('a target-opponent result cannot override explicit all-opponent closure in the same variant', () => {
  const result = assessFullTableWinClosureV15([
    'Target opponent loses the game',
    'Each opponent loses the game',
  ]);
  assert.equal(result.verifiedFullTableWin, true);
  assert.equal(result.kind, 'all-opponents-lose');
});
