import assert from 'node:assert/strict';
import test from 'node:test';
import { countWinningCombosV14, isWinResultV14 } from './cedh-win-package-v14.js';

test('winning-result gate accepts deterministic game-ending outputs', () => {
  assert.equal(isWinResultV14(['Infinite damage']), true);
  assert.equal(isWinResultV14(['Each opponent loses the game']), true);
  assert.equal(isWinResultV14(['Win the game']), true);
  assert.equal(isWinResultV14(['Infinite combat phases']), true);
  assert.equal(isWinResultV14(["Mill each opponent's library"]), true);
  assert.equal(isWinResultV14(['Draw your library']), true);
});

test('winning-result gate rejects non-winning infinite engines', () => {
  assert.equal(isWinResultV14(['Infinite life']), false);
  assert.equal(isWinResultV14(['Infinite mana']), false);
  assert.equal(isWinResultV14(['Infinite Treasures']), false);
  assert.equal(isWinResultV14(['Infinite creature tokens']), false);
  assert.equal(isWinResultV14(['Infinite ETB triggers']), false);
  assert.equal(isWinResultV14(['Gain arbitrarily large amounts of life and mana']), false);
});

test('winning combo counter only counts distinct included win-oriented variants', () => {
  const combos = {
    included: [
      { id: 'damage-line', results: ['Infinite damage'] },
      { id: 'life-line', results: ['Infinite life'] },
      { id: 'mana-line', results: ['Infinite mana'] },
      { id: 'damage-line', results: ['Infinite damage'] },
      { id: 'combat-line', results: ['Infinite combat phases'] },
    ],
  };

  assert.equal(countWinningCombosV14(combos), 2);
});

test('missing or malformed combo payloads do not become winning evidence', () => {
  assert.equal(countWinningCombosV14({}), 0);
  assert.equal(countWinningCombosV14({ included: [{ id: 'unknown' }, null, 'bad'] }), 0);
});
