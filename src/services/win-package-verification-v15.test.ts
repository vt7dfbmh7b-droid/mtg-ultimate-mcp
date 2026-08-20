import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessWinPackageRelationshipV15,
  assessWinResultClosureV15,
  buildWinPackagePortfolioV15,
  isStrictDeterministicWinResultV15,
} from './win-package-verification-v15.js';

test('explicit game wins and opponent-loss results pass strict closure', () => {
  assert.equal(isStrictDeterministicWinResultV15(['Win the game']), true);
  assert.equal(isStrictDeterministicWinResultV15(['Each opponent loses the game']), true);
  assert.equal(assessWinResultClosureV15(['Each opponent loses the game']).kind, 'opponent-loss');
});

test('unbounded damage or life loss supplies a lethal outlet in the same result', () => {
  const damage = assessWinResultClosureV15(['Infinite damage']);
  const lifeLoss = assessWinResultClosureV15(['Each opponent loses an arbitrarily large amount of life']);
  assert.equal(damage.verifiedDeterministicWin, true);
  assert.equal(damage.kind, 'deterministic-damage');
  assert.equal(lifeLoss.verifiedDeterministicWin, true);
  assert.equal(lifeLoss.kind, 'deterministic-life-loss');
});

test('infinite mana does not become a win merely because the resource is unbounded', () => {
  const result = assessWinResultClosureV15(['Infinite mana']);
  assert.equal(result.verifiedDeterministicWin, false);
  assert.equal(result.kind, 'resource-engine-only');
  assert.deepEqual(result.resourceOutputs, ['mana']);
});

test('resource generation plus explicit lethal closure is accepted', () => {
  const result = assessWinResultClosureV15(['Infinite mana', 'Infinite damage']);
  assert.equal(result.verifiedDeterministicWin, true);
  assert.equal(result.kind, 'deterministic-damage');
  assert.ok(result.resourceOutputs.includes('mana'));
});

test('generic infinite mill is not assumed to target opponents', () => {
  const generic = assessWinResultClosureV15(['Infinite mill']);
  const opponents = assessWinResultClosureV15(["Mill each opponent's entire library"]);
  assert.equal(generic.verifiedDeterministicWin, false);
  assert.equal(generic.kind, 'resource-engine-only');
  assert.equal(opponents.verifiedDeterministicWin, true);
  assert.equal(opponents.kind, 'deterministic-mill');
});

test('infinite combat phases alone remain conditional rather than deterministic', () => {
  const result = assessWinResultClosureV15(['Infinite combat phases']);
  assert.equal(result.verifiedDeterministicWin, false);
  assert.equal(result.kind, 'conditional-combat-engine');
});

test('two packages sharing half of the smaller seed package are a shared core, not independent redundancy', () => {
  const primary = {
    comboId: 'a',
    comboCardNames: ['Commander', 'Piece A', 'Piece B'],
    seedNames: ['Piece A', 'Piece B'],
    results: ['Win the game'],
    score: 1200,
  };
  const candidate = {
    comboId: 'b',
    comboCardNames: ['Other Piece', 'Piece B'],
    seedNames: ['Other Piece', 'Piece B'],
    results: ['Infinite damage'],
    score: 1190,
  };
  const relation = assessWinPackageRelationshipV15(primary, candidate);
  assert.equal(relation.relationship, 'shared-core');
  assert.equal(relation.seedOverlapRatio, 0.5);
  assert.deepEqual(relation.sharedSeedCards, ['Piece B']);
});

test('disjoint library packages that share the commander are commander-coupled, not fully independent', () => {
  const relation = assessWinPackageRelationshipV15({
    comboId: 'a',
    comboCardNames: ['Commander', 'A'],
    seedNames: ['A'],
    results: ['Win the game'],
    score: 1000,
  }, {
    comboId: 'b',
    comboCardNames: ['Commander', 'B'],
    seedNames: ['B'],
    results: ['Infinite damage'],
    score: 1000,
  });
  assert.equal(relation.relationship, 'commander-coupled');
  assert.deepEqual(relation.sharedSeedCards, []);
  assert.deepEqual(relation.sharedCommanderCards, ['Commander']);
});

test('portfolio selection prefers a genuinely independent backup over a slightly higher-scoring shared core', () => {
  const portfolio = buildWinPackagePortfolioV15([
    {
      comboId: 'primary',
      comboCardNames: ['Commander A', 'A', 'B'],
      seedNames: ['A', 'B'],
      results: ['Win the game'],
      score: 1500,
    },
    {
      comboId: 'shared-high-score',
      comboCardNames: ['B', 'C'],
      seedNames: ['B', 'C'],
      results: ['Infinite damage'],
      score: 1490,
    },
    {
      comboId: 'independent',
      comboCardNames: ['Commander B', 'D', 'E'],
      seedNames: ['D', 'E'],
      results: ['Each opponent loses the game'],
      score: 1300,
    },
  ]);
  assert.equal(portfolio.primaryComboId, 'primary');
  assert.equal(portfolio.backupComboId, 'independent');
  assert.equal(portfolio.resilienceBand, 'independent-backup');
  assert.equal(portfolio.fullyIndependentRouteCount, 2);
  assert.equal(portfolio.sharedCoreCandidateCount, 1);
});

test('resource-only loops receive no portfolio redundancy credit', () => {
  const portfolio = buildWinPackagePortfolioV15([
    {
      comboId: 'mana-loop',
      comboCardNames: ['A', 'B'],
      seedNames: ['A', 'B'],
      results: ['Infinite mana'],
      score: 9999,
    },
    {
      comboId: 'actual-win',
      comboCardNames: ['C', 'D'],
      seedNames: ['C', 'D'],
      results: ['Infinite damage'],
      score: 100,
    },
  ]);
  assert.equal(portfolio.primaryComboId, 'actual-win');
  assert.equal(portfolio.verifiedCandidateCount, 1);
  assert.equal(portfolio.backupComboId, null);
  assert.equal(portfolio.resilienceBand, 'single-route');
});

test('portfolio ordering is deterministic on equal scores', () => {
  const input = [
    { comboId: 'zeta', comboCardNames: ['Z1', 'Z2'], seedNames: ['Z1', 'Z2'], results: ['Win the game'], score: 1000 },
    { comboId: 'alpha', comboCardNames: ['A1', 'A2'], seedNames: ['A1', 'A2'], results: ['Win the game'], score: 1000 },
  ];
  const first = buildWinPackagePortfolioV15(input);
  const second = buildWinPackagePortfolioV15([...input].reverse());
  assert.deepEqual(first, second);
  assert.equal(first.primaryComboId, 'alpha');
});
