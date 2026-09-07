import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compoundComponentCandidateLanesV15,
  genericStructuralFallbackAllowedV15,
} from './upgrade.js';

test('generic structural fallback remains available for authoritative target gates', () => {
  assert.equal(genericStructuralFallbackAllowedV15('authoritative-target-gate'), true);
});

test('aspirational role heuristics do not force identity-free generic fallback', () => {
  assert.equal(genericStructuralFallbackAllowedV15('aspirational-role-target'), false);
});

test('compound candidate lanes omit generic-only cards when aspirational fallback is disabled', () => {
  const candidates = [
    { id: 'anchor' },
    { id: 'component' },
    { id: 'requested-role' },
    { id: 'strategy' },
    { id: 'generic' },
  ];
  const lanes = compoundComponentCandidateLanesV15(
    candidates,
    (candidate) => candidate.id === 'component',
    (candidate) => candidate.id === 'strategy',
    (candidate) => candidate.id === 'anchor',
    (candidate) => candidate.id === 'requested-role',
    false,
  );
  assert.deepEqual(lanes.flat().map((candidate) => candidate.id), [
    'anchor', 'component', 'requested-role', 'strategy',
  ]);
});

test('the same lane hierarchy retains generic fallback for authoritative structural repair', () => {
  const candidates = [
    { id: 'requested-role' },
    { id: 'generic' },
  ];
  const lanes = compoundComponentCandidateLanesV15(
    candidates,
    () => false,
    () => false,
    () => false,
    (candidate) => candidate.id === 'requested-role',
    true,
  );
  assert.deepEqual(lanes.flat().map((candidate) => candidate.id), ['requested-role', 'generic']);
});

test('aspirational fallback policy is archetype-agnostic across contrasting Commander mechanisms', () => {
  for (const family of ['spellslinger', 'enchantment-combat', 'typal', 'counters', 'artifact-enchantment']) {
    assert.equal(genericStructuralFallbackAllowedV15('aspirational-role-target'), false, family);
    assert.equal(genericStructuralFallbackAllowedV15('authoritative-target-gate'), true, family);
  }
});
