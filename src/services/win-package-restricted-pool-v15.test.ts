import assert from 'node:assert/strict';
import test from 'node:test';
import { prefilterRestrictedWinPackageCandidatesV15 } from './win-package-restricted-pool-v15.js';

test('restricted win-package prefilter rejects packages with any noncommander piece outside the eligible physical pool', () => {
  const input = [
    { id: 'all-marvel', names: ['Commander', 'Marvel A', 'Marvel B'] },
    { id: 'one-off-policy', names: ['Commander', 'Marvel A', 'Generic Staple'] },
  ];
  const result = prefilterRestrictedWinPackageCandidatesV15(input, ['Commander'], ['Marvel A', 'Marvel B']);
  assert.deepEqual(result.candidates.map((candidate) => candidate.id), ['all-marvel']);
  assert.deepEqual(result.audit, {
    candidatesBefore: 2,
    candidatesAfter: 1,
    rejectedCandidates: 1,
    eligibleCardNames: 2,
  });
});

test('commander dependencies do not need to appear in the library eligible pool', () => {
  const input = [{ id: 'commander-line', names: ['Chosen Commander', 'Marvel Piece'] }];
  const result = prefilterRestrictedWinPackageCandidatesV15(input, ['Chosen Commander'], ['Marvel Piece']);
  assert.deepEqual(result.candidates.map((candidate) => candidate.id), ['commander-line']);
});

test('restricted win-package prefilter fails closed on malformed candidates', () => {
  const input = [{ id: 'missing-names' }, { id: 'empty-names', names: [] }, { id: 'good', names: ['Piece'] }];
  const result = prefilterRestrictedWinPackageCandidatesV15(input, [], ['Piece']);
  assert.deepEqual(result.candidates.map((candidate) => candidate.id), ['good']);
});
