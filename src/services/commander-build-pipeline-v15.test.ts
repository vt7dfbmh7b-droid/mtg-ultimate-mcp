import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { planCommanderBuildPipelineV15, selectWinPackagePortfolioV15 } from './commander-build-pipeline-v15.js';
import type { GeneralWinPackageCandidateV15 } from './general-win-package-v15.js';

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

function winPackage(
  comboId: string,
  seedNames: string[],
  score = 1000,
): GeneralWinPackageCandidateV15 {
  return {
    comboId,
    bracketTag: null,
    comboCardNames: seedNames,
    seedNames,
    results: ['Win the game'],
    closureKind: 'direct-game-win',
    closureCaveat: '',
    resourceOutputs: [],
    exactPrintings: [],
    commanderOverlap: 0,
    totalManaValue: seedNames.length,
    reusableRoleCount: 0,
    deadPieceRisk: 0,
    score,
    popularity: 0,
  };
}

test('missing target never falls through to the legacy hidden-Bracket-4 builder', () => {
  const plan = planCommanderBuildPipelineV15([commander()], { printingFamily: 'Final Fantasy' });
  assert.equal(plan.requestedTargetBracket, null);
  assert.equal(plan.lane, 'neutral-themed');
  assert.equal(plan.seedWinPackage, false);
  assert.equal(plan.minimumDistinctLibraryRoutes, 1);
  assert.equal(plan.unsupportedConstraints.length, 0);
});

test('unrestricted neutral construction is now a supported strategy-first lane', () => {
  const plan = planCommanderBuildPipelineV15([commander()]);
  assert.equal(plan.requestedTargetBracket, null);
  assert.equal(plan.lane, 'neutral-themed');
  assert.equal(plan.archetype, 'combat-tokens');
  assert.equal(plan.seedWinPackage, false);
  assert.deepEqual(plan.unsupportedConstraints, []);
});

test('neutral per-card budget constraints are supported without inventing a bracket target', () => {
  const plan = planCommanderBuildPipelineV15([commander()], {
    maxUsdPerCard: 20,
    candidateMaxUsdPerCard: 5,
  });
  assert.equal(plan.requestedTargetBracket, null);
  assert.equal(plan.lane, 'neutral-themed');
  assert.deepEqual(plan.unsupportedConstraints, []);
});

test('an explicit target uses the targeted lane and high-power targets can seed verified packages', () => {
  const plan = planCommanderBuildPipelineV15([commander()], { targetBracket: 5 });
  assert.equal(plan.lane, 'targeted-v07');
  assert.equal(plan.requestedTargetBracket, 5);
  assert.equal(plan.discoverWinPackages, true);
  assert.equal(plan.seedWinPackage, true);
});

test('neutral free-form theme and per-card budget are supported without inventing a bracket target', () => {
  const plan = planCommanderBuildPipelineV15([commander()], {
    printingFamily: 'Final Fantasy',
    maxUsdPerCard: 20,
    candidateMaxUsdPerCard: 5,
    themeQuery: 'vampire',
  });
  assert.equal(plan.requestedTargetBracket, null);
  assert.equal(plan.lane, 'neutral-themed');
  assert.equal(plan.archetype, 'combat-tokens');
  assert.equal(plan.seedWinPackage, false);
  assert.deepEqual(plan.unsupportedConstraints, []);
});

test('forbid mode disables package discovery and seeding regardless of requested bracket', () => {
  const plan = planCommanderBuildPipelineV15([commander()], { targetBracket: 5, winPackageMode: 'forbid' });
  assert.equal(plan.discoverWinPackages, false);
  assert.equal(plan.seedWinPackage, false);
});


test('an explicit multi-route requirement enables package discovery and seeding even without a bracket target', () => {
  const plan = planCommanderBuildPipelineV15([commander()], {
    minimumDistinctLibraryRoutes: 2,
  });
  assert.equal(plan.minimumDistinctLibraryRoutes, 2);
  assert.equal(plan.discoverWinPackages, true);
  assert.equal(plan.seedWinPackage, true);
  assert.deepEqual(plan.unsupportedConstraints, []);
});

test('forbid mode fails closed when a multi-route requirement cannot be discovered or seeded', () => {
  const plan = planCommanderBuildPipelineV15([commander()], {
    winPackageMode: 'forbid',
    minimumDistinctLibraryRoutes: 2,
  });
  assert.equal(plan.discoverWinPackages, false);
  assert.equal(plan.seedWinPackage, false);
  assert.equal(plan.minimumDistinctLibraryRoutes, 2);
  assert.match(plan.unsupportedConstraints[0] ?? '', /requires win-package discovery and seeding/i);
});

test('multi-route portfolio seeding skips overlapping preferred backups and selects the next disjoint package', () => {
  const primary = winPackage('primary', ['Piece A', 'Piece B'], 1200);
  const overlappingPreferred = winPackage('overlap', ['Piece B', 'Piece C'], 1400);
  const independent = winPackage('independent', ['Piece D', 'Piece E'], 900);
  const selected = selectWinPackagePortfolioV15(
    [primary, overlappingPreferred, independent],
    primary,
    2,
    'overlap',
  );
  assert.deepEqual(selected.map((candidate) => candidate.comboId), ['primary', 'independent']);
});
