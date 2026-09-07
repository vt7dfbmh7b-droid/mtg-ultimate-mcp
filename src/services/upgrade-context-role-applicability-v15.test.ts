import assert from 'node:assert/strict';
import test from 'node:test';
import { costReductionApplicableToCommanderIdentityV15 } from './upgrade.js';

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
