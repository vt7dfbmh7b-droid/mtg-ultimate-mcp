import assert from 'node:assert/strict';
import test from 'node:test';
import { criticalRoleFloorsPreservedV14 } from './cedh-efficiency-v14.js';

function metrics(protection: number, boardWipes: number) {
  return {
    protectionCount: protection,
    roleCounts: { protection, 'board wipe': boardWipes },
  } as any;
}

test('strict refinement rejects collapsing three genuine wipes to one', () => {
  const result = criticalRoleFloorsPreservedV14(metrics(5, 3), metrics(5, 1));
  assert.equal(result.preserved, false);
  assert.match(result.reasons.join('\n'), /board wipes fell below preserved floor 2: 3 -> 1/i);
});

test('strict refinement may reduce three wipes to two when other quality gates pass', () => {
  const result = criticalRoleFloorsPreservedV14(metrics(5, 3), metrics(5, 2));
  assert.equal(result.preserved, true);
});

test('a deck that starts with one wipe is not forced to invent a second one', () => {
  assert.equal(criticalRoleFloorsPreservedV14(metrics(4, 1), metrics(4, 1)).preserved, true);
  assert.equal(criticalRoleFloorsPreservedV14(metrics(4, 1), metrics(4, 0)).preserved, false);
});
