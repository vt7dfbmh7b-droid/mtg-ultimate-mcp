import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareReplacementIdentityPriorityV15,
  replacementIdentityPriorityV15,
} from './replacement-identity-priority-v15.js';

test('prefers preserving requested typal identity when both replacements are otherwise legal', () => {
  const onPlan = replacementIdentityPriorityV15(
    { matchesControlledTheme: true, substantiveStrategyAffinity: 6 },
    { matchesControlledTheme: true, substantiveStrategyAffinity: 6 },
  );
  const offPlan = replacementIdentityPriorityV15(
    { matchesControlledTheme: false, substantiveStrategyAffinity: 0 },
    { matchesControlledTheme: true, substantiveStrategyAffinity: 6 },
  );

  assert.equal(onPlan.identityErosion, 0);
  assert.ok(offPlan.identityErosion > 0);
  assert.ok(compareReplacementIdentityPriorityV15(onPlan, offPlan) < 0);
});

test('allows an artifact or enchantment identity card to be cut when the incoming card preserves more substantive strategy value', () => {
  const strategyUpgrade = replacementIdentityPriorityV15(
    { matchesControlledTheme: false, substantiveStrategyAffinity: 10 },
    { matchesControlledTheme: true, substantiveStrategyAffinity: 2 },
  );
  const genericReplacement = replacementIdentityPriorityV15(
    { matchesControlledTheme: false, substantiveStrategyAffinity: 0 },
    { matchesControlledTheme: true, substantiveStrategyAffinity: 2 },
  );

  assert.equal(strategyUpgrade.verdict, 'identity-improving');
  assert.equal(genericReplacement.verdict, 'identity-eroding');
  assert.ok(compareReplacementIdentityPriorityV15(strategyUpgrade, genericReplacement) < 0);
});

test('spellslinger control keeps existing structural tie-break behavior when relative identity is equal', () => {
  const left = replacementIdentityPriorityV15(
    { matchesControlledTheme: true, substantiveStrategyAffinity: 8 },
    { matchesControlledTheme: true, substantiveStrategyAffinity: 8 },
  );
  const right = replacementIdentityPriorityV15(
    { matchesControlledTheme: false, substantiveStrategyAffinity: 0 },
    { matchesControlledTheme: false, substantiveStrategyAffinity: 0 },
  );

  assert.equal(compareReplacementIdentityPriorityV15(left, right), 0);
});

test('relative identity ranking is advisory and reports erosion rather than hard-vetoing the swap', () => {
  const result = replacementIdentityPriorityV15(
    { matchesControlledTheme: false, substantiveStrategyAffinity: 4 },
    { matchesControlledTheme: true, substantiveStrategyAffinity: 7 },
  );

  assert.equal(result.verdict, 'identity-eroding');
  assert.equal(result.requestedThemeDelta, -1);
  assert.equal(result.substantiveStrategyAffinityDelta, -3);
  assert.equal(result.identityErosion, 4);
});
