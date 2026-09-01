import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCedhSeedQueriesV14,
  rankCedhSeedCandidatesV14,
  scoreCedhSeedPracticalityV14,
  selectCedhSeedVerificationCandidatesV14,
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

test('seed queries search exact package sizes by deterministic result evidence and allow one lightweight prerequisite', () => {
  assert.deepEqual(buildCedhSeedQueriesV14(2), [
    'card=2 legal:commander template=0 prerequisites<=1 result:infinite',
    'card=2 legal:commander template=0 prerequisites<=1 result:game',
    'card=2 legal:commander template=0 prerequisites<=1 result:library',
  ]);
  assert.deepEqual(buildCedhSeedQueriesV14(3, 'UB'), [
    'card=2 legal:commander template=0 prerequisites<=1 identity<=UB result:infinite',
    'card=2 legal:commander template=0 prerequisites<=1 identity<=UB result:game',
    'card=2 legal:commander template=0 prerequisites<=1 identity<=UB result:library',
    'card=3 legal:commander template=0 prerequisites<=1 identity<=UB result:infinite',
    'card=3 legal:commander template=0 prerequisites<=1 identity<=UB result:game',
    'card=3 legal:commander template=0 prerequisites<=1 identity<=UB result:library',
  ]);
  const fiveColor = buildCedhSeedQueriesV14(9, 'bgurw');
  assert.equal(fiveColor.length, 9);
  assert.ok(fiveColor.every((query) => query.includes('identity<=WUBRG')));
  assert.ok(fiveColor.every((query) => !query.includes('is:winning')));
  assert.match(buildCedhSeedQueriesV14(3, 'C')[0] ?? '', /identity<=C/);
});

test('seed ranking accepts deterministic wins across bracket tags but rejects non-winning and heavy-setup packages', () => {
  const ranked = rankCedhSeedCandidatesV14([
    variant({
      id: 'exhibition',
      bracketTag: 'E',
      cards: [
        { name: 'Card C', quantity: 1, mustBeCommander: false },
        { name: 'Card D', quantity: 1, mustBeCommander: false },
      ],
    }),
    variant({ id: 'life', results: ['Infinite life'] }),
    variant({ id: 'heavy-setup', requirements: [{ name: 'Setup A' }, { name: 'Setup B' }] }),
    variant({ id: 'ruthless' }),
  ], [], 3);

  assert.deepEqual(new Set(ranked.map((candidate) => candidate.id)), new Set(['exhibition', 'ruthless']));
  assert.equal(ranked[0]?.id, 'ruthless', 'Ruthless remains useful evidence but is not a hard eligibility gate');
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

test('verification shortlist reserves room for larger practical packages instead of letting two-card popularity crowd them out', () => {
  const ranked: Array<Record<string, unknown>> = [];
  for (let index = 0; index < 20; index += 1) {
    ranked.push({
      id: `two-${index}`,
      cards: [{ name: `A${index}` }, { name: `B${index}` }],
      score: 2000 - index,
    });
  }
  for (let index = 0; index < 8; index += 1) {
    ranked.push({
      id: `three-${index}`,
      cards: [{ name: `C${index}` }, { name: `D${index}` }, { name: `E${index}` }],
      score: 1000 - index,
    });
  }

  const selected = selectCedhSeedVerificationCandidatesV14(ranked, 10, 3);
  assert.equal(selected.length, 10);
  assert.ok(selected.filter((candidate) => String(candidate.id).startsWith('three-')).length >= 5);
});

test('practical seed scoring rewards sacrifice and recursion utility over expensive dead-card spectacle', () => {
  const efficient = scoreCedhSeedPracticalityV14([
    { name: 'Cheap Sacrifice Engine', cmc: 3, typeLine: 'Creature — Zombie', roles: ['sacrifice outlet', 'treasure'] },
    { name: 'Recursive Zombie', cmc: 1, typeLine: 'Creature — Zombie', roles: ['graveyard recursion'] },
    { name: 'Drain Payoff', cmc: 2, typeLine: 'Creature', roles: ['sacrifice synergy'] },
  ], ['Commander X']);
  const clunky = scoreCedhSeedPracticalityV14([
    {
      name: 'All-In Exiler',
      cmc: 6,
      typeLine: 'Creature — Demon',
      oracleText: 'When you cast this spell, exile your library.',
      roles: [],
    },
    { name: 'Expensive Win Spell', cmc: 6, typeLine: 'Sorcery', roles: [] },
  ], ['Commander X']);

  assert.ok(efficient.scoreAdjustment > clunky.scoreAdjustment);
  assert.ok(efficient.reusableRoleCount > clunky.reusableRoleCount);
  assert.ok(clunky.deadPieceRisk > efficient.deadPieceRisk);
  assert.ok(clunky.totalManaValue > efficient.totalManaValue);
});

test('reusable three-card engine can outrank a compact bracket-tagged spectacle line', () => {
  const ranked = rankCedhSeedCandidatesV14([
    variant({ id: 'spectacle-two', bracketTag: 'R', popularity: 10 }),
    variant({
      id: 'engine-three',
      bracketTag: 'E',
      popularity: 10,
      cards: [
        { name: 'Sacrifice Engine', quantity: 1, mustBeCommander: false },
        { name: 'Recursive Body', quantity: 1, mustBeCommander: false },
        { name: 'Drain Payoff', quantity: 1, mustBeCommander: false },
      ],
    }),
  ], [], 3);
  const spectacle = ranked.find((candidate) => candidate.id === 'spectacle-two');
  const engine = ranked.find((candidate) => candidate.id === 'engine-three');
  assert.ok(spectacle && engine);

  const spectaclePracticality = scoreCedhSeedPracticalityV14([
    { name: 'Spectacle A', cmc: 4, typeLine: 'Enchantment', roles: [] },
    { name: 'Spectacle B', cmc: 2, typeLine: 'Creature', roles: [] },
  ], []);
  const enginePracticality = scoreCedhSeedPracticalityV14([
    { name: 'Sacrifice Engine', cmc: 3, typeLine: 'Creature — Zombie', roles: ['sacrifice outlet', 'treasure'] },
    { name: 'Recursive Body', cmc: 1, typeLine: 'Creature — Zombie', roles: ['graveyard recursion'] },
    { name: 'Drain Payoff', cmc: 2, typeLine: 'Creature', roles: ['sacrifice synergy'] },
  ], []);

  const spectacleFinal = Number(spectacle.score) + spectaclePracticality.scoreAdjustment;
  const engineFinal = Number(engine.score) + enginePracticality.scoreAdjustment;
  assert.ok(engineFinal > spectacleFinal, `${engineFinal} should beat ${spectacleFinal}`);
});
