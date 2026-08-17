import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateExactAccessCurveV15,
  MAX_EXACT_ACCESS_SOLVER_EVALUATIONS_V15,
  MAX_EXACT_ACCESS_TURNS_V15,
  type ExactNaturalDrawContextV15,
} from './exact-access-curve-v15.js';

function reduced(numerator: bigint, denominator: bigint): [string, string] {
  let a = numerator < 0n ? -numerator : numerator;
  let b = denominator < 0n ? -denominator : denominator;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return [(numerator / a).toString(), (denominator / a).toString()];
}

function choose(population: number, selected: number): bigint {
  if (selected < 0 || selected > population) return 0n;
  const count = Math.min(selected, population - selected);
  let result = 1n;
  for (let index = 1; index <= count; index += 1) {
    result = (result * BigInt(population - count + index)) / BigInt(index);
  }
  return result;
}

function bruteForceFlexCommanderAccess(draws: number): [string, string] {
  const cards = [
    ['a'],
    ['b'],
    [],
  ];
  let favorable = 0n;
  let total = 0n;
  const maximumMask = 1 << cards.length;
  for (let mask = 0; mask < maximumMask; mask += 1) {
    const selected: string[][] = [];
    for (let index = 0; index < cards.length; index += 1) {
      if ((mask & (1 << index)) !== 0) selected.push(cards[index]!);
    }
    if (selected.length !== draws) continue;
    total += 1n;
    const hasA = selected.some((roles) => roles.includes('a'));
    const hasB = selected.some((roles) => roles.includes('b'));
    // The guaranteed commander can be assigned to exactly one of a/b.
    if (hasA || hasB) favorable += 1n;
  }
  return reduced(favorable, total);
}

test('multiplayer Commander draws on turn one, so singleton access rises from 7/99 to 8/99', () => {
  const result = calculateExactAccessCurveV15({
    deckSize: 100,
    throughTurn: 3,
    naturalDrawContext: 'multiplayer',
    commandZoneCards: [{ name: 'commander', roles: [] }],
    routes: [{ name: 'find target', requirements: [{ role: 'target', minimum: 1 }] }],
    libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
  });

  assert.equal(result.libraryPopulation, 99);
  assert.deepEqual(result.checkpoints.map((checkpoint) => checkpoint.cumulativeLibraryDraws), [7, 8, 9, 10]);
  assert.deepEqual(
    result.checkpoints.map((checkpoint) => [checkpoint.probability.numerator, checkpoint.probability.denominator]),
    [['7', '99'], ['8', '99'], ['1', '11'], ['10', '99']],
  );
});

test('two-player starting player skips the first draw step while the non-starting player does not', () => {
  const base = {
    deckSize: 100,
    throughTurn: 2,
    commandZoneCards: [{ name: 'commander', roles: [] }],
    routes: [{ name: 'find target', requirements: [{ role: 'target', minimum: 1 }] }],
    libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
  } as const;

  const starting = calculateExactAccessCurveV15({ ...base, naturalDrawContext: 'two-player-starting' });
  const nonStarting = calculateExactAccessCurveV15({ ...base, naturalDrawContext: 'two-player-non-starting' });

  assert.deepEqual(starting.checkpoints.map((checkpoint) => checkpoint.cumulativeLibraryDraws), [7, 7, 8]);
  assert.deepEqual(nonStarting.checkpoints.map((checkpoint) => checkpoint.cumulativeLibraryDraws), [7, 8, 9]);
  assert.equal(starting.checkpoints[1]!.naturalDrawsThisTurn, 0);
  assert.equal(nonStarting.checkpoints[1]!.naturalDrawsThisTurn, 1);
});

test('explicit guaranteed extra draws change cumulative exact access without pretending conditional engines are guaranteed', () => {
  const result = calculateExactAccessCurveV15({
    deckSize: 100,
    throughTurn: 3,
    naturalDrawContext: 'multiplayer',
    commandZoneCards: [{ name: 'commander', roles: [] }],
    routes: [{ name: 'find target', requirements: [{ role: 'target', minimum: 1 }] }],
    libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
    guaranteedExtraDraws: [
      { turn: 2, count: 2, name: 'guaranteed draw spell' },
      { turn: 2, count: 1, name: 'guaranteed trigger' },
    ],
  });

  assert.deepEqual(result.checkpoints.map((checkpoint) => checkpoint.cumulativeLibraryDraws), [7, 8, 12, 13]);
  assert.equal(result.checkpoints[2]!.guaranteedExtraDrawsThisTurn, 3);
  assert.equal(result.checkpoints[2]!.probability.numerator, '4');
  assert.equal(result.checkpoints[2]!.probability.denominator, '33');
});

test('small overlapping command-zone access curve matches an independent labeled-card enumerator at every checkpoint', () => {
  const result = calculateExactAccessCurveV15({
    deckSize: 4,
    openingHandSize: 0,
    throughTurn: 3,
    naturalDrawContext: 'multiplayer',
    commandZoneCards: [{ name: 'flex commander', roles: ['a', 'b'] }],
    routes: [{
      name: 'a plus b',
      requirements: [
        { role: 'a', minimum: 1 },
        { role: 'b', minimum: 1 },
      ],
    }],
    libraryCategories: [
      { name: 'a-card', count: 1, roles: ['a'] },
      { name: 'b-card', count: 1, roles: ['b'] },
    ],
  });

  for (const checkpoint of result.checkpoints) {
    const [expectedNumerator, expectedDenominator] = bruteForceFlexCommanderAccess(checkpoint.cumulativeLibraryDraws);
    assert.equal(checkpoint.probability.numerator, expectedNumerator, `turn ${checkpoint.turn} numerator`);
    assert.equal(checkpoint.probability.denominator, expectedDenominator, `turn ${checkpoint.turn} denominator`);
  }
});

test('pure cumulative access is monotone and matches closed-form singleton sampling', () => {
  const result = calculateExactAccessCurveV15({
    deckSize: 20,
    openingHandSize: 3,
    throughTurn: 5,
    naturalDrawContext: 'multiplayer',
    commandZoneCards: [{ name: 'commander', roles: [] }],
    routes: [{ name: 'target', requirements: [{ role: 'target', minimum: 1 }] }],
    libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
  });

  let previous = -1;
  for (const checkpoint of result.checkpoints) {
    assert.ok(checkpoint.probability.decimal >= previous);
    previous = checkpoint.probability.decimal;
    const expected = reduced(
      choose(19, checkpoint.cumulativeLibraryDraws) - choose(18, checkpoint.cumulativeLibraryDraws),
      choose(19, checkpoint.cumulativeLibraryDraws),
    );
    assert.equal(checkpoint.probability.numerator, expected[0]);
    assert.equal(checkpoint.probability.denominator, expected[1]);
  }
});

test('library exhaustion is explicit and later checkpoints reuse the all-library exact result', () => {
  const result = calculateExactAccessCurveV15({
    deckSize: 4,
    openingHandSize: 2,
    throughTurn: 3,
    naturalDrawContext: 'multiplayer',
    commandZoneCards: [{ name: 'commander', roles: [] }],
    routes: [{ name: 'target', requirements: [{ role: 'target', minimum: 1 }] }],
    libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
  });

  assert.deepEqual(result.checkpoints.map((checkpoint) => checkpoint.cumulativeLibraryDraws), [2, 3, 3, 3]);
  assert.equal(result.checkpoints[1]!.libraryFullySeen, true);
  assert.equal(result.checkpoints[1]!.wouldDrawPastLibrary, false);
  assert.equal(result.checkpoints[2]!.wouldDrawPastLibrary, true);
  assert.equal(result.checkpoints[3]!.wouldDrawPastLibrary, true);
  assert.equal(result.checkpoints[1]!.probability.numerator, '1');
  assert.equal(result.solverEvaluations, 2);
});

test('opening-hand-only query stays exact without inventing turn draws', () => {
  const result = calculateExactAccessCurveV15({
    deckSize: 10,
    openingHandSize: 2,
    throughTurn: 0,
    naturalDrawContext: 'two-player-starting',
    commandZoneCards: [{ name: 'commander', roles: [] }],
    routes: [{ name: 'target', requirements: [{ role: 'target', minimum: 1 }] }],
    libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
  });

  assert.equal(result.checkpoints.length, 1);
  assert.equal(result.checkpoints[0]!.kind, 'opening-hand');
  assert.equal(result.checkpoints[0]!.probability.numerator, '2');
  assert.equal(result.checkpoints[0]!.probability.denominator, '9');
});

test('broad curves stop before multiplying expensive exact solver calls without bound', () => {
  assert.throws(
    () => calculateExactAccessCurveV15({
      deckSize: 100,
      openingHandSize: 0,
      throughTurn: MAX_EXACT_ACCESS_SOLVER_EVALUATIONS_V15,
      naturalDrawContext: 'multiplayer',
      commandZoneCards: [{ name: 'commander', roles: [] }],
      routes: [{ name: 'target', requirements: [{ role: 'target', minimum: 1 }] }],
      libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
    }),
    new RegExp(`${MAX_EXACT_ACCESS_SOLVER_EVALUATIONS_V15} evaluation limit`),
  );
});

test('malformed access-curve schedules fail closed', () => {
  assert.throws(
    () => calculateExactAccessCurveV15({
      deckSize: 100,
      throughTurn: 1,
      naturalDrawContext: 'invalid' as ExactNaturalDrawContextV15,
      commandZoneCards: [{ name: 'commander', roles: [] }],
      routes: [{ name: 'target', requirements: [{ role: 'target', minimum: 1 }] }],
      libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
    }),
    /naturalDrawContext/,
  );
  assert.throws(
    () => calculateExactAccessCurveV15({
      deckSize: 100,
      throughTurn: 2,
      naturalDrawContext: 'multiplayer',
      commandZoneCards: [{ name: 'commander', roles: [] }],
      routes: [{ name: 'target', requirements: [{ role: 'target', minimum: 1 }] }],
      libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
      guaranteedExtraDraws: [{ turn: 3, count: 1 }],
    }),
    /turn must be at most 2/,
  );
  assert.throws(
    () => calculateExactAccessCurveV15({
      deckSize: 100,
      throughTurn: MAX_EXACT_ACCESS_TURNS_V15 + 1,
      naturalDrawContext: 'multiplayer',
      commandZoneCards: [{ name: 'commander', roles: [] }],
      routes: [{ name: 'target', requirements: [{ role: 'target', minimum: 1 }] }],
      libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
    }),
    /throughTurn must be at most/,
  );
  assert.throws(
    () => calculateExactAccessCurveV15({
      deckSize: 4,
      openingHandSize: 4,
      throughTurn: 0,
      naturalDrawContext: 'multiplayer',
      commandZoneCards: [{ name: 'commander', roles: [] }],
      routes: [{ name: 'target', requirements: [{ role: 'target', minimum: 1 }] }],
      libraryCategories: [{ name: 'target', count: 1, roles: ['target'] }],
    }),
    /draws must be at most 3/,
  );
});
