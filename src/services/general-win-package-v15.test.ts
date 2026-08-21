import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGeneralWinPackageQueriesV15,
  canonicalIdentityTokenV15,
  rankGeneralWinPackageVariantsV15,
} from './general-win-package-v15.js';

test('general win-package queries are winning-outcome searches without requiring Ruthless/cEDH tags', () => {
  const queries = buildGeneralWinPackageQueriesV15(3, 'WUBRG');
  assert.deepEqual(queries, [
    'card<=2 is:winning legal:commander identity<=WUBRG',
    'card<=3 is:winning legal:commander identity<=WUBRG',
  ]);
  assert.equal(queries.some((query) => query.includes('bracket:ruthless')), false);
});

test('general win-package discovery defaults to the production four-card ceiling', () => {
  assert.deepEqual(buildGeneralWinPackageQueriesV15(undefined, 'WUBRG'), [
    'card<=2 is:winning legal:commander identity<=WUBRG',
    'card<=3 is:winning legal:commander identity<=WUBRG',
    'card<=4 is:winning legal:commander identity<=WUBRG',
  ]);
});

test('Spellbook identity tokens always use canonical WUBRG ordering', () => {
  assert.equal(canonicalIdentityTokenV15(['B', 'G', 'R', 'U', 'W']), 'WUBRG');
  assert.equal(canonicalIdentityTokenV15(['G', 'U']), 'UG');
  assert.equal(canonicalIdentityTokenV15([]), 'C');
  assert.deepEqual(buildGeneralWinPackageQueriesV15(2, 'BGRUW'), [
    'card<=2 is:winning legal:commander identity<=WUBRG',
  ]);
});

test('general package ranking accepts four-card wins by default', () => {
  const ranked = rankGeneralWinPackageVariantsV15([
    {
      id: 'four-card-win',
      cards: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
      results: ['Win the game'],
      requirements: [],
      popularity: 1,
    },
  ], []);
  assert.deepEqual(ranked.map((row) => row.id), ['four-card-win']);
});

test('general package ranking rejects impressive non-winning outcomes and excluded pieces', () => {
  const variants = [
    {
      id: 'life-only',
      cards: [{ name: 'A' }, { name: 'B' }],
      results: ['Infinite life'],
      requirements: [],
      popularity: 9999,
    },
    {
      id: 'actual-win',
      cards: [{ name: 'A' }, { name: 'C' }],
      results: ['Win the game'],
      requirements: [],
      popularity: 2,
    },
    {
      id: 'excluded-win',
      cards: [{ name: 'A' }, { name: 'Forbidden Piece' }],
      results: ['Each opponent loses the game'],
      requirements: [],
      popularity: 10000,
    },
  ];
  const ranked = rankGeneralWinPackageVariantsV15(variants, [], { excludedCards: ['Forbidden Piece'] });
  assert.deepEqual(ranked.map((row) => row.id), ['actual-win']);
});

test('general package ranking does not treat resource loops or combat loops as deterministic wins', () => {
  const ranked = rankGeneralWinPackageVariantsV15([
    {
      id: 'mana-only',
      cards: [{ name: 'A' }, { name: 'B' }],
      results: ['Infinite mana'],
      requirements: [],
      popularity: 9999,
    },
    {
      id: 'combat-only',
      cards: [{ name: 'C' }, { name: 'D' }],
      results: ['Infinite combat phases'],
      requirements: [],
      popularity: 9999,
    },
    {
      id: 'mana-with-outlet',
      cards: [{ name: 'E' }, { name: 'F' }],
      results: ['Infinite mana', 'Infinite damage'],
      requirements: [],
      popularity: 1,
    },
  ], []);
  assert.deepEqual(ranked.map((row) => row.id), ['mana-with-outlet']);
});

test('a package requiring the commander is rejected when that commander is not selected', () => {
  const ranked = rankGeneralWinPackageVariantsV15([
    {
      id: 'wrong-commander',
      cards: [{ name: 'Other Commander', mustBeCommander: true }, { name: 'Piece' }],
      results: ['Win the game'],
      requirements: [],
    },
  ], ['Chosen Commander']);
  assert.deepEqual(ranked, []);
});

test('a package requiring two copies of a card is rejected for Commander singleton safety', () => {
  const ranked = rankGeneralWinPackageVariantsV15([
    {
      id: 'quantity-two',
      cards: [{ name: 'A', quantity: 2 }, { name: 'B' }],
      results: ['Win the game'],
      requirements: [],
    },
  ], []);
  assert.deepEqual(ranked, []);
});
