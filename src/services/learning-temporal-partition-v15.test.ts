import assert from 'node:assert/strict';
import test from 'node:test';
import { planTemporalLeakagePartitionV15 } from './learning-temporal-partition-v15.js';

test('pre-feature partition is deterministic for equal timestamps regardless of input order', () => {
  const items = [
    { id: 'b', observedAt: '2026-01-01T00:00:00Z', leakageGroup: 'b' },
    { id: 'a', observedAt: '2026-01-01T00:00:00Z', leakageGroup: 'a' },
    { id: 'd', observedAt: '2026-01-01T00:00:00Z', leakageGroup: 'd' },
    { id: 'c', observedAt: '2026-01-01T00:00:00Z', leakageGroup: 'c' },
    { id: 'f', observedAt: '2026-01-01T00:00:00Z', leakageGroup: 'f' },
    { id: 'e', observedAt: '2026-01-01T00:00:00Z', leakageGroup: 'e' },
  ];

  const forward = planTemporalLeakagePartitionV15(items, 0.34);
  const reverse = planTemporalLeakagePartitionV15([...items].reverse(), 0.34);
  assert.deepEqual(forward, reverse);
});

test('entire leakage group moves to holdout when its latest record crosses the cutoff', () => {
  const plan = planTemporalLeakagePartitionV15([
    { id: 'early-a', observedAt: '2026-01-01T00:00:00Z', leakageGroup: 'series-a' },
    { id: 'train-b', observedAt: '2026-01-10T00:00:00Z', leakageGroup: 'series-b' },
    { id: 'train-c', observedAt: '2026-01-20T00:00:00Z', leakageGroup: 'series-c' },
    { id: 'late-a', observedAt: '2026-02-10T00:00:00Z', leakageGroup: 'series-a' },
  ], 0.25);

  assert.equal(plan.leakageChecksPassed, true);
  assert.deepEqual(plan.holdoutIds.sort(), ['early-a', 'late-a']);
  assert.equal(plan.trainingIds.includes('early-a'), false);
});

test('partition rejects duplicate IDs and malformed temporal provenance', () => {
  assert.throws(
    () => planTemporalLeakagePartitionV15([
      { id: 'same', observedAt: '2026-01-01T00:00:00Z', leakageGroup: 'a' },
      { id: 'same', observedAt: '2026-01-02T00:00:00Z', leakageGroup: 'b' },
    ]),
    /duplicate.*id/i,
  );
  assert.throws(
    () => planTemporalLeakagePartitionV15([
      { id: 'bad-date', observedAt: 'not-a-date', leakageGroup: 'a' },
    ]),
    /observedAt.*valid timestamp/i,
  );
  assert.throws(
    () => planTemporalLeakagePartitionV15([
      { id: 'bad-group', observedAt: '2026-01-01T00:00:00Z', leakageGroup: ' ' },
    ]),
    /leakageGroup.*non-empty/i,
  );
});
