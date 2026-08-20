import assert from 'node:assert/strict';
import test from 'node:test';
import { candidatePriceCapV07 } from './deck-builder-v07.js';

test('candidate search falls back to the user per-card cap when no internal cap exists', () => {
  assert.equal(candidatePriceCapV07({ maxUsdPerCard: 7 }), 7);
});

test('candidate-only search cap works without creating a user required-card cap', () => {
  assert.equal(candidatePriceCapV07({ candidateMaxUsdPerCard: 1.25 }), 1.25);
});

test('candidate search may tighten but never loosen an explicit user per-card cap', () => {
  assert.equal(candidatePriceCapV07({ maxUsdPerCard: 2, candidateMaxUsdPerCard: 1 }), 1);
  assert.equal(candidatePriceCapV07({ maxUsdPerCard: 2, candidateMaxUsdPerCard: 5 }), 2);
});

test('invalid internal candidate cap fails closed', () => {
  assert.throws(() => candidatePriceCapV07({ candidateMaxUsdPerCard: 0 }), /positive and finite/i);
  assert.throws(() => candidatePriceCapV07({ candidateMaxUsdPerCard: Number.NaN }), /positive and finite/i);
});
