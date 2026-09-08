import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareReplacementIdentityPriorityV15,
  replacementIdentityPriorityV15,
} from './replacement-identity-priority-v15.js';

test('typed requested relationship loss is prioritized ahead of broad strategy gain', () => {
  const preservesMechanism = replacementIdentityPriorityV15(
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['typal', 'relation:typal-engine'],
      substantiveStrategyAffinity: 4,
    },
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['typal'],
      substantiveStrategyAffinity: 1,
    },
  );
  const losesMechanismForGenericStrategy = replacementIdentityPriorityV15(
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['typal'],
      substantiveStrategyAffinity: 10,
    },
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['typal', 'relation:typal-engine'],
      substantiveStrategyAffinity: 0,
    },
  );

  assert.equal(preservesMechanism.requestedRelationshipLossCount, 0);
  assert.equal(losesMechanismForGenericStrategy.requestedRelationshipLossCount, 1);
  assert.ok(
    compareReplacementIdentityPriorityV15(preservesMechanism, losesMechanismForGenericStrategy) < 0,
    'an eligible swap that preserves the typed requested mechanism must rank ahead of one that trades it for broad strategy affinity',
  );
});

test('typed relationship priority remains advisory when all eligible cuts lose a mechanism', () => {
  const lowerErosion = replacementIdentityPriorityV15(
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['enchantments'],
      substantiveStrategyAffinity: 6,
    },
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['enchantments', 'relation:aura-specialization'],
      substantiveStrategyAffinity: 4,
    },
  );
  const higherErosion = replacementIdentityPriorityV15(
    {
      matchesControlledTheme: false,
      matchedRequestedComponentIds: [],
      substantiveStrategyAffinity: 0,
    },
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['enchantments', 'relation:commander-shape'],
      substantiveStrategyAffinity: 4,
    },
  );

  assert.equal(lowerErosion.requestedRelationshipLossCount, 1);
  assert.equal(higherErosion.requestedRelationshipLossCount, 1);
  assert.ok(compareReplacementIdentityPriorityV15(lowerErosion, higherErosion) < 0);
});

test('relationship gain is preferred only after relationship-loss and erosion are tied', () => {
  const gainsPayoff = replacementIdentityPriorityV15(
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['typal', 'relation:typal-payoff'],
      substantiveStrategyAffinity: 4,
    },
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['typal'],
      substantiveStrategyAffinity: 4,
    },
  );
  const broadOnly = replacementIdentityPriorityV15(
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['typal'],
      substantiveStrategyAffinity: 4,
    },
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: ['typal'],
      substantiveStrategyAffinity: 4,
    },
  );

  assert.equal(gainsPayoff.requestedRelationshipLossCount, 0);
  assert.equal(broadOnly.requestedRelationshipLossCount, 0);
  assert.equal(gainsPayoff.identityErosion, broadOnly.identityErosion);
  assert.ok(compareReplacementIdentityPriorityV15(gainsPayoff, broadOnly) < 0);
});
