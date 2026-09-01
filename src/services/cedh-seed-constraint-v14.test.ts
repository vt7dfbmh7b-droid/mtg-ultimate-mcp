import assert from 'node:assert/strict';
import test from 'node:test';
import { seedConstraintAdjustmentV14 } from './cedh-seed-package-v14.js';

test('win seed constraints hard-block excluded cards and reward overlap with preferred cards', () => {
  const preferred = seedConstraintAdjustmentV14(
    ['Warren Soultrader', 'Gravecrawler', 'Blood Artist'],
    ['Warren Soultrader', 'Gravecrawler', 'Blood Artist'],
    ['Doomsday Excruciator'],
  );
  assert.equal(preferred.eligible, true);
  assert.equal(preferred.preferredOverlap, 3);
  assert.equal(preferred.scoreAdjustment, 540);
  assert.deepEqual(preferred.blockedCards, []);

  const blocked = seedConstraintAdjustmentV14(
    ['Doomsday Excruciator', 'Shared Trauma'],
    ['Blood Artist'],
    ['Doomsday Excruciator', 'Shared Trauma'],
  );
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.preferredOverlap, 0);
  assert.deepEqual(blocked.blockedCards, ['Doomsday Excruciator', 'Shared Trauma']);
});
