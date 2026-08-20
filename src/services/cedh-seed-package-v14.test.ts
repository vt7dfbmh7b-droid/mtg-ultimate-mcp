import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCedhSeedQueriesV14,
  rankCedhSeedCandidatesV14,
  scoreCedhSeedPracticalityV14,
} from './cedh-seed-package-v14.js';

function variant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'base',
    bracketTag: 'R',
    cards: [
      { name: 'Card A', quantity: 1, mustBeCommander: false },
      { name: 'Card B', quantity: 1, mustBeCommander: false },
    ],
    results: ['Infinite damage'],
    requirements: [],
    popularity: 10,
    ...overrides,
  };
}

test('seed queries stay compact and can scope to commander identity', () => {
  assert.deepEqual(buildCedhSeedQueriesV14(2), [
    'bracket:ruthless card<=2 is:winning legal:commander',
  ]);
  assert.deepEqual(buildCedhSeedQueriesV14(3, 'UB'), [
    'bracket:ruthless card<=2 is:winning legal:commander identity<=UB',
    'bracket:ruthless card<=3 is:winning legal:commander identity<=UB',
  ]);
  assert.deepEqual(buildCedhSeedQueriesV14(9, 'bgurw'), [
    'bracket:ruthless card<=2 is:winning legal:commander identity<=WUBRG',
    'bracket:ruthless card<=3 is:winning legal:commander identity<=WUBRG',
    'bracket:ruthless card<=4 is:winning legal:commander identity<=WUBRG',
  ]);
  assert.match(buildCedhSeedQueriesV14(3, 'C')[0] ?? '', /identity<=C/);
});

test('seed ranking rejects non-Ruthless, non-winning and template-dependent packages', () => {
  const ranked = rankCedhSeedCandidatesV14([
    variant({ id: 'strategic', bracketTag: 'S' }),
    variant({ id: 'life', results: ['Infinite life'] }),
    variant({ id: 'template', requirements: [{ name: 'Any haste outlet' }] }),
    variant({ id: 'winner' }),
  ], [], 3);

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.id, 'winner');
});

test('must-be-commander requirements are only accepted for the supplied commander', () => {
  const wrong = variant({
    id: 'wrong',
    cards: [
      { name: 'Commander X', quantity: 1, mustBeCommander: true },
      { name: 'Card B', quantity: 1, mustBeCommander: false },
    ],
  });
  const right = variant({
    id: 'right',
    cards: [
      { name: 'Commander Y', quantity: 1, mustBeCommander: true },
      { name: 'Card C', quantity: 1, mustBeCommander: false },
    ],
  });

  const ranked = rankCedhSeedCandidatesV14([wrong, right], ['Commander Y'], 3);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.id, 'right');
});

test('compact packages rank ahead of otherwise equal larger packages', () => {
  const two = variant({ id: 'two', popularity: 0 });
  const three = variant({
    id: 'three',
    popularity: 0,
    cards: [
      { name: 'Card C', quantity: 1, mustBeCommander: false },
      { name: 'Card D', quantity: 1, mustBeCommander: false },
      { name: 'Card E', quantity: 1, mustBeCommander: false },
    ],
  });

  const ranked = rankCedhSeedCandidatesV14([three, two], [], 3);
  assert.equal(ranked[0]?.id, 'two');
});

test('duplicate card packages keep the stronger evidence record rather than first-seen order', () => {
  const low = variant({ id: 'low', popularity: 1 });
  const high = variant({ id: 'high', popularity: 10000 });
  const ranked = rankCedhSeedCandidatesV14([low, high], [], 3);

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.id, 'high');
});

test('packages requiring duplicate nonbasic combo pieces are rejected', () => {
  const ranked = rankCedhSeedCandidatesV14([
    variant({
      id: 'duplicate-required',
      cards: [
        { name: 'Card A', quantity: 2, mustBeCommander: false },
        { name: 'Card B', quantity: 1, mustBeCommander: false },
      ],
    }),
  ], [], 3);

  assert.equal(ranked.length, 0);
});

test('practical seed scoring prefers cheap commander-centric utility over expensive dead-card spectacle', () => {
  const efficient = scoreCedhSeedPracticalityV14([
    { name: 'Commander X', cmc: 2, typeLine: 'Legendary Creature', roles: ['repeatable draw'] },
    { name: 'Mana Engine', cmc: 3, typeLine: 'Artifact', roles: ['mana acceleration'] },
    { name: 'Win Outlet', cmc: 0, typeLine: 'Artifact Creature', roles: [] },
  ], ['Commander X']);
  const clunky = scoreCedhSeedPracticalityV14([
    {
      name: 'All-In Exiler',
      cmc: 5,
      typeLine: 'Artifact Creature',
      oracleText: 'When this enters, exile your library.',
      roles: [],
    },
    { name: 'Expensive Win Walker', cmc: 4, typeLine: 'Legendary Planeswalker', roles: [] },
  ], ['Commander X']);

  assert.ok(efficient.scoreAdjustment > clunky.scoreAdjustment);
  assert.ok(efficient.commanderOverlap > clunky.commanderOverlap);
  assert.ok(clunky.deadPieceRisk > efficient.deadPieceRisk);
  assert.ok(clunky.totalManaValue > efficient.totalManaValue);
});
