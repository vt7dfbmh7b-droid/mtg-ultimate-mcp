import assert from 'node:assert/strict';
import test from 'node:test';
import {
  upgradeThemeComponentAffinityScoreV15,
  type UpgradeThemeComponentSignalV15,
} from './upgrade.js';

const components = (overrides: Partial<Record<'broad' | 'anchor', Partial<UpgradeThemeComponentSignalV15>>> = {}): UpgradeThemeComponentSignalV15[] => [
  {
    id: 'broad',
    queryClause: 'o:draw',
    currentMainMatches: 30,
    requiredMainMatches: 12,
    ...overrides.broad,
  },
  {
    id: 'anchor',
    queryClause: 'o:"+1/+1 counter"',
    currentMainMatches: 18,
    requiredMainMatches: 15,
    ...overrides.anchor,
  },
];

test('relatively underrepresented compound-theme components outrank saturated broad components after both floors are met', () => {
  const signals = components();
  const broad = upgradeThemeComponentAffinityScoreV15(['broad'], signals);
  const anchor = upgradeThemeComponentAffinityScoreV15(['anchor'], signals);
  assert.ok(anchor > broad, `expected anchor affinity ${anchor} to exceed broad affinity ${broad}`);
});

test('a component still below its required floor receives stronger affinity than a saturated component', () => {
  const signals = components({ anchor: { currentMainMatches: 9 } });
  const broad = upgradeThemeComponentAffinityScoreV15(['broad'], signals);
  const anchor = upgradeThemeComponentAffinityScoreV15(['anchor'], signals);
  assert.ok(anchor > broad, `expected deficient anchor affinity ${anchor} to exceed broad affinity ${broad}`);
});

test('cards without controlled component evidence receive no component affinity', () => {
  assert.equal(upgradeThemeComponentAffinityScoreV15([], components()), 0);
  assert.equal(upgradeThemeComponentAffinityScoreV15(['unknown'], components()), 0);
});

test('multi-component affinity remains bounded so theme preference cannot become a hard structural override', () => {
  const signals: UpgradeThemeComponentSignalV15[] = [
    ...components({ anchor: { currentMainMatches: 0 } }),
    { id: 'third', queryClause: 't:artifact', currentMainMatches: 0, requiredMainMatches: 18 },
  ];
  assert.equal(upgradeThemeComponentAffinityScoreV15(['broad', 'anchor', 'third'], signals), 12);
});
