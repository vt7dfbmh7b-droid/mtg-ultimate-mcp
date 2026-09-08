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
  assert.equal(result.requestedRelationshipAffinityDelta, 0);
  assert.equal(result.identityErosion, 4);
});

test('preserves exact requested mechanisms across contrasting Commander strategy families', () => {
  for (const componentId of ['aura-enchantment', 'elf-typal', 'counter-explore', 'artifact-enchantment-shape']) {
    const preserves = replacementIdentityPriorityV15(
      { matchesControlledTheme: true, matchedRequestedComponentIds: [componentId], substantiveStrategyAffinity: 4 },
      { matchesControlledTheme: true, matchedRequestedComponentIds: [componentId], substantiveStrategyAffinity: 4 },
    );
    const loses = replacementIdentityPriorityV15(
      { matchesControlledTheme: true, matchedRequestedComponentIds: [], substantiveStrategyAffinity: 4 },
      { matchesControlledTheme: true, matchedRequestedComponentIds: [componentId], substantiveStrategyAffinity: 4 },
    );
    assert.equal(preserves.requestedComponentLossCount, 0);
    assert.equal(loses.requestedComponentLossCount, 1);
    assert.ok(compareReplacementIdentityPriorityV15(preserves, loses) < 0, componentId);
  }
});

test('can trade one requested component for another but records the lost mechanism independently', () => {
  const result = replacementIdentityPriorityV15(
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['secondary-payoff'], substantiveStrategyAffinity: 6 },
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['primary-engine'], substantiveStrategyAffinity: 6 },
  );
  assert.equal(result.requestedComponentLossCount, 1);
  assert.equal(result.requestedComponentGainCount, 1);
  assert.equal(result.identityErosion, 1);
  assert.equal(result.identityGain, 1);
});

test('relationship affinity distinguishes payoff or commander-shape preservation inside the same broad component', () => {
  const preserves = replacementIdentityPriorityV15(
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['enchantment'], substantiveStrategyAffinity: 4, requestedRelationshipAffinity: 6 },
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['enchantment'], substantiveStrategyAffinity: 4, requestedRelationshipAffinity: 6 },
  );
  const erodes = replacementIdentityPriorityV15(
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['enchantment'], substantiveStrategyAffinity: 4, requestedRelationshipAffinity: 1 },
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['enchantment'], substantiveStrategyAffinity: 4, requestedRelationshipAffinity: 6 },
  );
  assert.equal(preserves.requestedRelationshipAffinityDelta, 0);
  assert.equal(erodes.requestedRelationshipAffinityDelta, -5);
  assert.ok(erodes.identityErosion > preserves.identityErosion);
  assert.ok(compareReplacementIdentityPriorityV15(preserves, erodes) < 0);
});

test('stronger substantive strategy can still justify cutting a relational card because the signal remains advisory', () => {
  const result = replacementIdentityPriorityV15(
    { matchesControlledTheme: false, substantiveStrategyAffinity: 12, requestedRelationshipAffinity: 0 },
    { matchesControlledTheme: true, substantiveStrategyAffinity: 2, requestedRelationshipAffinity: 5 },
  );
  assert.equal(result.requestedRelationshipAffinityDelta, -5);
  assert.equal(result.verdict, 'identity-improving');
});

test('keeps legacy structural fallback ranking unchanged when exact component and relationship evidence are unavailable', () => {
  const withUnknownComponents = replacementIdentityPriorityV15(
    { matchesControlledTheme: false, substantiveStrategyAffinity: 3 },
    { matchesControlledTheme: false, substantiveStrategyAffinity: 3 },
  );
  assert.equal(withUnknownComponents.requestedComponentLossCount, 0);
  assert.equal(withUnknownComponents.requestedComponentGainCount, 0);
  assert.equal(withUnknownComponents.requestedRelationshipAffinityDelta, 0);
  assert.equal(withUnknownComponents.verdict, 'identity-neutral');
});
