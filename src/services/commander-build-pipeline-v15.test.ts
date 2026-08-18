import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { planCommanderBuildPipelineV15 } from './commander-build-pipeline-v15.js';

function commander(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: 'test',
    name: 'Test Commander',
    set: 'tst',
    collector_number: '1',
    released_at: '2020-01-01',
    type_line: 'Legendary Creature — Human',
    oracle_text: 'Whenever you attack, create a 1/1 creature token.',
    mana_cost: '{2}{R}',
    cmc: 3,
    colors: ['R'],
    color_identity: ['R'],
    keywords: [],
    legalities: { commander: 'legal' },
    prices: {},
    ...overrides,
  } as ScryfallCard;
}

test('missing target never falls through to the legacy hidden-Bracket-4 builder', () => {
  const plan = planCommanderBuildPipelineV15([commander()], { printingFamily: 'Final Fantasy' });
  assert.equal(plan.requestedTargetBracket, null);
  assert.equal(plan.lane, 'neutral-themed');
  assert.equal(plan.seedWinPackage, false);
  assert.equal(plan.unsupportedConstraints.length, 0);
});

test('an explicit target uses the targeted lane and high-power targets can seed verified packages', () => {
  const plan = planCommanderBuildPipelineV15([commander()], { targetBracket: 5 });
  assert.equal(plan.lane, 'targeted-v07');
  assert.equal(plan.requestedTargetBracket, 5);
  assert.equal(plan.discoverWinPackages, true);
  assert.equal(plan.seedWinPackage, true);
});

test('neutral unsupported constraints fail closed instead of being silently ignored', () => {
  const plan = planCommanderBuildPipelineV15([commander()], {
    printingFamily: 'Final Fantasy',
    maxUsdPerCard: 20,
    themeQuery: 'vampire',
  });
  assert.deepEqual(plan.unsupportedConstraints, [
    'neutral per-card budget enforcement',
    'neutral free-form theme query',
  ]);
});

test('forbid mode disables package discovery and seeding regardless of requested bracket', () => {
  const plan = planCommanderBuildPipelineV15([commander()], { targetBracket: 5, winPackageMode: 'forbid' });
  assert.equal(plan.discoverWinPackages, false);
  assert.equal(plan.seedWinPackage, false);
});
