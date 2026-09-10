import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGeneralWinPackageQueriesV15,
  canonicalIdentityTokenV15,
  rankGeneralWinPackageVariantsV15,
} from './general-win-package-v15.js';

test('general win-package queries cover direct wins plus bounded lethal outcomes without requiring Ruthless/cEDH tags', () => {
  const queries = buildGeneralWinPackageQueriesV15(3, 'WUBRG');
  assert.deepEqual(queries, [
    'card<=2 is:winning legal:commander identity<=WUBRG',
    'card<=2 result="Infinite damage" legal:commander identity<=WUBRG',
    'card<=2 result="Infinite lifeloss" legal:commander identity<=WUBRG',
    'card<=3 is:winning legal:commander identity<=WUBRG',
    'card<=3 result="Infinite damage" legal:commander identity<=WUBRG',
    'card<=3 result="Infinite lifeloss" legal:commander identity<=WUBRG',
  ]);
  assert.equal(queries.some((query) => query.includes('bracket:ruthless')), false);
});

test('general win-package discovery defaults to the production four-card ceiling', () => {
  const queries = buildGeneralWinPackageQueriesV15(undefined, 'WUBRG');
  assert.equal(queries.length, 9);
  assert.deepEqual(queries.slice(-3), [
    'card<=4 is:winning legal:commander identity<=WUBRG',
    'card<=4 result="Infinite damage" legal:commander identity<=WUBRG',
    'card<=4 result="Infinite lifeloss" legal:commander identity<=WUBRG',
  ]);
});

test('Spellbook identity tokens always use canonical WUBRG ordering', () => {
  assert.equal(canonicalIdentityTokenV15(['B', 'G', 'R', 'U', 'W']), 'WUBRG');
  assert.equal(canonicalIdentityTokenV15(['G', 'U']), 'UG');
  assert.equal(canonicalIdentityTokenV15([]), 'C');
  assert.deepEqual(buildGeneralWinPackageQueriesV15(2, 'BGRUW'), [
    'card<=2 is:winning legal:commander identity<=WUBRG',
    'card<=2 result="Infinite damage" legal:commander identity<=WUBRG',
    'card<=2 result="Infinite lifeloss" legal:commander identity<=WUBRG',
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

test('general package ranking uses full-table Commander closure rather than generic lethal-scale output', () => {
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
      id: 'unscoped-damage',
      cards: [{ name: 'E' }, { name: 'F' }],
      results: ['Infinite mana', 'Infinite damage'],
      requirements: [],
      popularity: 100,
    },
    {
      id: 'single-opponent',
      cards: [{ name: 'G' }, { name: 'H' }],
      results: ['Target opponent loses the game'],
      requirements: [],
      popularity: 100,
    },
    {
      id: 'table-kill',
      cards: [{ name: 'I' }, { name: 'J' }],
      results: ['Infinite damage to each opponent'],
      requirements: [],
      popularity: 1,
    },
  ], []);
  assert.deepEqual(ranked.map((row) => row.id), ['table-kill']);
});

test('general package ranking accepts unscoped infinite damage only when verified repeated steps prove player reach', () => {
  const ranked = rankGeneralWinPackageVariantsV15([
    {
      id: 'step-verified-table-damage',
      cards: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      results: ['Infinite damage', 'Infinite counters'],
      requirements: [],
      description: [
        '1. Activate an ability targeting itself.',
        '2. Put two counters on it.',
        '3. Activate the damage ability, dealing 1 damage to any target.',
        '4. Repeat from step 2.',
      ].join('\n'),
      popularity: 5,
    },
    {
      id: 'creature-only-loop',
      cards: [{ name: 'D' }, { name: 'E' }],
      results: ['Infinite damage'],
      requirements: [],
      description: [
        '1. Deal 1 damage to target creature.',
        '2. Untap the source.',
        '3. Repeat from step 1.',
      ].join('\n'),
      popularity: 50,
    },
  ], []);
  assert.deepEqual(ranked.map((row) => row.id), ['step-verified-table-damage']);
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
