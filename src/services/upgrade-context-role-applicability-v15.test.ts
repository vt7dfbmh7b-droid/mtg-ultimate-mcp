import assert from 'node:assert/strict';
import test from 'node:test';
import { cardHasIndependentUtilityBeyondContextDeadCostReductionV15, costReductionApplicableToCommanderIdentityV15 } from './upgrade.js';

test('color-restricted cost reduction is context-dead outside commander identity', () => {
  assert.equal(costReductionApplicableToCommanderIdentityV15('Black spells you cast cost {1} less to cast.', ['R', 'G']), false);
  assert.equal(costReductionApplicableToCommanderIdentityV15('Blue spells you cast cost {1} less to cast.', ['W', 'B']), false);
});

test('color-restricted cost reduction remains usable when the commander identity can cast that color', () => {
  assert.equal(costReductionApplicableToCommanderIdentityV15('Black spells you cast cost {1} less to cast.', ['B', 'G']), true);
  assert.equal(costReductionApplicableToCommanderIdentityV15('Red spells you cast cost {1} less to cast.', ['U', 'R']), true);
});

test('generic and non-color cost reduction stays available', () => {
  assert.equal(costReductionApplicableToCommanderIdentityV15('Artifact spells you cast cost {1} less to cast.', ['R', 'G']), true);
  assert.equal(costReductionApplicableToCommanderIdentityV15('Spells you cast cost {1} less to cast.', ['W']), true);
});

test('non-cost-reduction text is unaffected', () => {
  assert.equal(costReductionApplicableToCommanderIdentityV15('Add {B}{B}.', ['R', 'G']), true);
});


test('context-dead reducer cannot qualify as useful low-curve filler by reducer labels alone', () => {
  assert.equal(cardHasIndependentUtilityBeyondContextDeadCostReductionV15(
    'Black spells you cast cost {1} less to cast.',
    ['cost reduction', 'mana acceleration'],
    ['R', 'G'],
  ), false);
});

test('context-dead reducer remains usable when the card has an independent deck role', () => {
  assert.equal(cardHasIndependentUtilityBeyondContextDeadCostReductionV15(
    'When this enters, draw a card. Black spells you cast cost {1} less to cast.',
    ['cost reduction', 'mana acceleration', 'card draw'],
    ['R', 'G'],
  ), true);
});
