import assert from 'node:assert/strict';
import test from 'node:test';
import { neutralCandidatePriceCapV15, neutralCommanderLookupNameV15 } from './neutral-deck-builder-v15.js';

test('neutral commander lookup preserves ordinary single-face names', () => {
  assert.equal(neutralCommanderLookupNameV15('Najeela, the Blade-Blossom'), 'Najeela, the Blade-Blossom');
});

test('neutral commander lookup uses the front face for canonical DFC display names', () => {
  assert.equal(
    neutralCommanderLookupNameV15('Garland, Knight of Cornelia // Chaos, the Endless'),
    'Garland, Knight of Cornelia',
  );
  assert.equal(
    neutralCommanderLookupNameV15('  Terra, Magical Adept // Esper Terra  '),
    'Terra, Magical Adept',
  );
});

test('neutral candidate cap falls back to the user hard per-card cap', () => {
  assert.equal(neutralCandidatePriceCapV15({ maxUsdPerCard: 20 }), 20);
});

test('neutral candidate-only cap works without becoming a commander or must-include cap', () => {
  assert.equal(neutralCandidatePriceCapV15({ candidateMaxUsdPerCard: 3 }), 3);
});

test('neutral candidate cap may tighten but never loosen a user hard cap', () => {
  assert.equal(neutralCandidatePriceCapV15({ maxUsdPerCard: 20, candidateMaxUsdPerCard: 5 }), 5);
  assert.equal(neutralCandidatePriceCapV15({ maxUsdPerCard: 5, candidateMaxUsdPerCard: 20 }), 5);
});

test('invalid neutral price caps fail closed', () => {
  assert.throws(() => neutralCandidatePriceCapV15({ maxUsdPerCard: 0 }), /positive and finite/i);
  assert.throws(() => neutralCandidatePriceCapV15({ candidateMaxUsdPerCard: Number.NaN }), /positive and finite/i);
});
