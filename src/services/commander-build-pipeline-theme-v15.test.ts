import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { planCommanderBuildPipelineV15 } from './commander-build-pipeline-v15.js';

test('no-target neutral planning accepts a theme for the enforceable theme adapter', () => {
  const commander = {} as ScryfallCard;
  const plan = planCommanderBuildPipelineV15([commander], {
    archetype: 'combat-tokens',
    themeQuery: 'Warrior typal',
    winPackageMode: 'forbid',
  });
  assert.equal(plan.lane, 'neutral-themed');
  assert.equal(plan.requestedTargetBracket, null);
  assert.equal(plan.archetype, 'combat-tokens');
  assert.equal(plan.discoverWinPackages, false);
  assert.deepEqual(plan.unsupportedConstraints, []);
});

test('targeted planning remains on the legacy targeted lane when a target and theme are supplied', () => {
  const commander = {} as ScryfallCard;
  const plan = planCommanderBuildPipelineV15([commander], {
    targetBracket: 4,
    themeQuery: 'Warrior typal',
  });
  assert.equal(plan.lane, 'targeted-v07');
  assert.equal(plan.requestedTargetBracket, 4);
  assert.deepEqual(plan.unsupportedConstraints, []);
});
