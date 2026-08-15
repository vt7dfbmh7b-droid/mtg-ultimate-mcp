import assert from 'node:assert/strict';
import test from 'node:test';
import { isColorIdentitySubset, parseDecklist } from './deck.js';

test('parseDecklist understands Commander sections and printing annotations', () => {
  const deck = parseDecklist(`
// COMMANDER
1 Edgar Markov (INR) 234

// MAIN
1 Sol Ring (CMM) 396
3 Swamp (NEO) 297 *F*
1 Blood Artist
`);

  assert.deepEqual(deck.commanders, [{ name: 'Edgar Markov', quantity: 1 }]);
  assert.deepEqual(deck.main, [
    { name: 'Sol Ring', quantity: 1 },
    { name: 'Swamp', quantity: 3 },
    { name: 'Blood Artist', quantity: 1 },
  ]);
  assert.equal(deck.totalCommanders, 1);
  assert.equal(deck.totalMain, 5);
  assert.equal(deck.totalCards, 6);
});

test('parseDecklist can promote supplied commander names', () => {
  const deck = parseDecklist('1 Atraxa, Praetors’ Voice\n1 Sol Ring', ['Atraxa, Praetors’ Voice']);
  assert.deepEqual(deck.commanders, [{ name: 'Atraxa, Praetors’ Voice', quantity: 1 }]);
  assert.deepEqual(deck.main, [{ name: 'Sol Ring', quantity: 1 }]);
});

test('parseDecklist recognizes commander tags', () => {
  const deck = parseDecklist('1 Kenrith, the Returned King # Commander\n1 Arcane Signet');
  assert.equal(deck.commanders[0]?.name, 'Kenrith, the Returned King');
  assert.equal(deck.main[0]?.name, 'Arcane Signet');
});

test('color identity subset validation is order independent', () => {
  assert.equal(isColorIdentitySubset(['W', 'B'], ['R', 'B', 'W']), true);
  assert.equal(isColorIdentitySubset(['U'], ['R', 'B', 'W']), false);
  assert.equal(isColorIdentitySubset([], ['R']), true);
});
