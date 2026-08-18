import assert from 'node:assert/strict';
import test from 'node:test';
import { neutralCommanderLookupNameV15 } from './neutral-deck-builder-v15.js';

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
