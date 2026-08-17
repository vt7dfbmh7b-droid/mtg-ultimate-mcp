import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateExactPackageAssemblyV15,
  MAX_EXACT_PACKAGE_DP_WORK_V15,
  MAX_EXACT_PACKAGE_REQUIREMENTS_V15,
} from './exact-package-statistics-v15.js';

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function bruteForcePackages(input: {
  population: number;
  draws: number;
  counts: number[];
  minimums: number[];
}): [bigint, bigint] {
  const ownership: number[] = [];
  for (let packageIndex = 0; packageIndex < input.counts.length; packageIndex += 1) {
    for (let copy = 0; copy < input.counts[packageIndex]!; copy += 1) ownership.push(packageIndex);
  }
  while (ownership.length < input.population) ownership.push(-1);

  let favorable = 0n;
  let total = 0n;
  const maximumMask = 1 << input.population;
  for (let mask = 0; mask < maximumMask; mask += 1) {
    let selected = 0;
    const hits = new Array<number>(input.counts.length).fill(0);
    for (let card = 0; card < input.population; card += 1) {
      if ((mask & (1 << card)) === 0) continue;
      selected += 1;
      const owner = ownership[card] ?? -1;
      if (owner >= 0) hits[owner] = (hits[owner] ?? 0) + 1;
    }
    if (selected !== input.draws) continue;
    total += 1n;
    if (hits.every((value, index) => value >= input.minimums[index]!)) favorable += 1n;
  }
  const divisor = gcd(favorable, total);
  return [favorable / divisor, total / divisor];
}

test('two unique combo pieces in a 99-card Commander library are exact', () => {
  const result = calculateExactPackageAssemblyV15({
    population: 99,
    draws: 7,
    packages: [
      { name: 'piece-a', count: 1, minimum: 1 },
      { name: 'piece-b', count: 1, minimum: 1 },
    ],
  });

  assert.equal(result.probability.numerator, '1');
  assert.equal(result.probability.denominator, '231');
  assert.ok(Math.abs(result.probability.decimal - 0.004329004329004329) < 1e-15);
  assert.equal(result.complement.numerator, '230');
  assert.equal(result.complement.denominator, '231');
  assert.equal(result.untrackedCards, 97);
});

test('interchangeable role buckets match inclusion-exclusion fixture', () => {
  const result = calculateExactPackageAssemblyV15({
    population: 99,
    draws: 7,
    packages: [
      { name: 'role-a', count: 3, minimum: 1 },
      { name: 'role-b', count: 4, minimum: 1 },
    ],
  });

  assert.equal(result.probability.numerator, '226102819');
  assert.equal(result.probability.denominator, '4962343848');
  assert.ok(Math.abs(result.probability.decimal - 0.04556371463277931) < 1e-15);
  assert.deepEqual(
    result.packages.map((entry) => [entry.expectation.numerator, entry.expectation.denominator]),
    [['7', '33'], ['28', '99']],
  );
});

test('all small two-package populations match independent labeled-card enumeration', () => {
  for (let population = 1; population <= 8; population += 1) {
    for (let firstCount = 0; firstCount <= population; firstCount += 1) {
      for (let secondCount = 0; secondCount <= population - firstCount; secondCount += 1) {
        for (let draws = 0; draws <= population; draws += 1) {
          const firstMinimums = [0, 1, 2].filter((value) => value <= firstCount + 1 && value <= population);
          const secondMinimums = [0, 1, 2].filter((value) => value <= secondCount + 1 && value <= population);
          for (const firstMinimum of firstMinimums) {
            for (const secondMinimum of secondMinimums) {
              const result = calculateExactPackageAssemblyV15({
                population,
                draws,
                packages: [
                  { name: 'first', count: firstCount, minimum: firstMinimum },
                  { name: 'second', count: secondCount, minimum: secondMinimum },
                ],
              });
              const [expectedNumerator, expectedDenominator] = bruteForcePackages({
                population,
                draws,
                counts: [firstCount, secondCount],
                minimums: [firstMinimum, secondMinimum],
              });
              const context = `${population}/${firstCount}/${secondCount}/${draws}/${firstMinimum}/${secondMinimum}`;
              assert.equal(result.probability.numerator, expectedNumerator.toString(), `${context} numerator`);
              assert.equal(result.probability.denominator, expectedDenominator.toString(), `${context} denominator`);
            }
          }
        }
      }
    }
  }
});

test('impossible assembly requirements return exact zero instead of partial success', () => {
  const tooManyCopies = calculateExactPackageAssemblyV15({
    population: 10,
    draws: 5,
    packages: [{ name: 'singleton', count: 1, minimum: 2 }],
  });
  assert.equal(tooManyCopies.probability.numerator, '0');
  assert.equal(tooManyCopies.probability.denominator, '1');

  const tooManyRequiredDraws = calculateExactPackageAssemblyV15({
    population: 10,
    draws: 3,
    packages: [
      { name: 'a', count: 4, minimum: 2 },
      { name: 'b', count: 4, minimum: 2 },
    ],
  });
  assert.equal(tooManyRequiredDraws.probability.numerator, '0');
  assert.equal(tooManyRequiredDraws.complement.numerator, '1');
});

test('empty and zero-minimum package requests preserve the whole sample space', () => {
  const empty = calculateExactPackageAssemblyV15({ population: 0, draws: 0, packages: [] });
  assert.equal(empty.probability.numerator, '1');
  assert.equal(empty.totalHands, '1');

  const noRequirements = calculateExactPackageAssemblyV15({
    population: 20,
    draws: 7,
    packages: [
      { name: 'a', count: 5, minimum: 0 },
      { name: 'b', count: 5, minimum: 0 },
    ],
  });
  assert.equal(noRequirements.probability.numerator, '1');
  assert.equal(noRequirements.complement.numerator, '0');
});

test('pathologically broad package requests stop at the explicit DP work ceiling', () => {
  assert.throws(
    () => calculateExactPackageAssemblyV15({
      population: 1000,
      draws: 500,
      packages: [
        { name: 'half-a', count: 500, minimum: 0 },
        { name: 'half-b', count: 500, minimum: 0 },
      ],
    }),
    new RegExp(`${MAX_EXACT_PACKAGE_DP_WORK_V15} transition work limit`),
  );
});

test('malformed or overlapping bucket-count requests fail closed', () => {
  assert.throws(
    () => calculateExactPackageAssemblyV15({
      population: 10,
      draws: 7,
      packages: [
        { name: 'a', count: 6, minimum: 1 },
        { name: 'b', count: 5, minimum: 1 },
      ],
    }),
    /disjoint/,
  );
  assert.throws(
    () => calculateExactPackageAssemblyV15({
      population: 10,
      draws: 7,
      packages: [
        { name: 'duplicate', count: 1, minimum: 1 },
        { name: 'duplicate', count: 1, minimum: 1 },
      ],
    }),
    /unique/,
  );
  assert.throws(
    () => calculateExactPackageAssemblyV15({
      population: 10,
      draws: 7,
      packages: Array.from({ length: MAX_EXACT_PACKAGE_REQUIREMENTS_V15 + 1 }, (_, index) => ({
        name: `p-${index}`,
        count: 0,
        minimum: 0,
      })),
    }),
    /at most/,
  );
  assert.throws(
    () => calculateExactPackageAssemblyV15({ population: 1001, draws: 7, packages: [] }),
    /population must be at most/,
  );
});
