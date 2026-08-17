import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_EXACT_STATISTICS_POPULATION_V15,
  calculateExactHypergeometricV15,
  exactFractionSumsToOneV15,
} from './exact-statistics-v15.js';

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

function bruteForceMass(population: number, successes: number, draws: number, target: number): [bigint, bigint] {
  let favorable = 0n;
  let total = 0n;
  const maximumMask = 1 << population;
  for (let mask = 0; mask < maximumMask; mask += 1) {
    let selected = 0;
    let selectedSuccesses = 0;
    for (let index = 0; index < population; index += 1) {
      if ((mask & (1 << index)) === 0) continue;
      selected += 1;
      if (index < successes) selectedSuccesses += 1;
    }
    if (selected !== draws) continue;
    total += 1n;
    if (selectedSuccesses === target) favorable += 1n;
  }
  const divisor = gcd(favorable, total);
  return [favorable / divisor, total / divisor];
}

test('99-card Commander opening hand exact 3+ land probability matches pinned mathematical fixture', () => {
  const result = calculateExactHypergeometricV15({
    population: 99,
    successes: 36,
    draws: 7,
    event: { kind: 'at-least', value: 3 },
  });

  assert.equal(result.probability.numerator, '26736733');
  assert.equal(result.probability.denominator, '53358536');
  assert.ok(Math.abs(result.probability.decimal - 0.5010769598326311) < 1e-15);
  assert.equal(exactFractionSumsToOneV15(result.probability, result.complement), true);
  assert.deepEqual(result.support, { minimum: 0, maximum: 7 });
});

test('all small exact-success masses match independent labeled-card enumeration', () => {
  for (let population = 1; population <= 8; population += 1) {
    for (let successes = 0; successes <= population; successes += 1) {
      for (let draws = 0; draws <= population; draws += 1) {
        for (let target = 0; target <= draws; target += 1) {
          const result = calculateExactHypergeometricV15({
            population,
            successes,
            draws,
            event: { kind: 'exactly', value: target },
          });
          const [expectedNumerator, expectedDenominator] = bruteForceMass(population, successes, draws, target);
          assert.equal(result.probability.numerator, expectedNumerator.toString(), `${population}/${successes}/${draws}/${target} numerator`);
          assert.equal(result.probability.denominator, expectedDenominator.toString(), `${population}/${successes}/${draws}/${target} denominator`);
          assert.equal(exactFractionSumsToOneV15(result.probability, result.complement), true);
        }
      }
    }
  }
});

test('event variants share exact expectation and variance independent of event selection', () => {
  const events = [
    { kind: 'zero' } as const,
    { kind: 'at-most', value: 1 } as const,
    { kind: 'range', minimum: 1, maximum: 2 } as const,
    { kind: 'exactly', value: 9 } as const,
    { kind: 'at-least', value: 2 } as const,
  ];

  for (const event of events) {
    const result = calculateExactHypergeometricV15({ population: 10, successes: 4, draws: 3, event });
    assert.equal(result.expectation.numerator, '6');
    assert.equal(result.expectation.denominator, '5');
    assert.equal(result.variance.numerator, '14');
    assert.equal(result.variance.denominator, '25');
  }

  const impossible = calculateExactHypergeometricV15({
    population: 10,
    successes: 4,
    draws: 3,
    event: { kind: 'exactly', value: 9 },
  });
  assert.equal(impossible.probability.numerator, '0');
  assert.equal(impossible.probability.denominator, '1');
});

test('physical support handles forced successes when failures are insufficient', () => {
  const result = calculateExactHypergeometricV15({
    population: 10,
    successes: 8,
    draws: 5,
    event: { kind: 'at-least', value: 3 },
  });
  assert.deepEqual(result.support, { minimum: 3, maximum: 5 });
  assert.equal(result.probability.numerator, '1');
  assert.equal(result.probability.denominator, '1');
});

test('boundary populations and draw-all cases remain exact', () => {
  const empty = calculateExactHypergeometricV15({ population: 0, successes: 0, draws: 0, event: { kind: 'zero' } });
  assert.equal(empty.probability.numerator, '1');
  assert.equal(empty.variance.numerator, '0');

  const drawAll = calculateExactHypergeometricV15({ population: 10, successes: 4, draws: 10, event: { kind: 'exactly', value: 4 } });
  assert.equal(drawAll.probability.numerator, '1');
  assert.deepEqual(drawAll.support, { minimum: 4, maximum: 4 });
});

test('supported ceiling remains finite and exact while oversized requests fail closed', () => {
  const ceiling = calculateExactHypergeometricV15({
    population: MAX_EXACT_STATISTICS_POPULATION_V15,
    successes: 500,
    draws: 500,
    event: { kind: 'at-least', value: 250 },
  });
  assert.equal(Number.isFinite(ceiling.probability.decimal), true);
  assert.equal(Number.isFinite(ceiling.complement.decimal), true);
  assert.equal(exactFractionSumsToOneV15(ceiling.probability, ceiling.complement), true);

  assert.throws(
    () => calculateExactHypergeometricV15({
      population: MAX_EXACT_STATISTICS_POPULATION_V15 + 1,
      successes: 500,
      draws: 7,
      event: { kind: 'at-least', value: 1 },
    }),
    /population must be at most/,
  );
});

test('increasing success count cannot reduce a fixed at-least event', () => {
  let previous = -1;
  for (let successes = 0; successes <= 30; successes += 1) {
    const result = calculateExactHypergeometricV15({
      population: 60,
      successes,
      draws: 7,
      event: { kind: 'at-least', value: 2 },
    });
    assert.ok(result.probability.decimal + 1e-15 >= previous);
    previous = result.probability.decimal;
  }
});

test('malformed requests fail closed instead of returning partial-looking probabilities', () => {
  const invalidCalls = [
    () => calculateExactHypergeometricV15({ population: -1, successes: 0, draws: 0, event: { kind: 'zero' } }),
    () => calculateExactHypergeometricV15({ population: 10, successes: 11, draws: 1, event: { kind: 'zero' } }),
    () => calculateExactHypergeometricV15({ population: 10, successes: 4, draws: 11, event: { kind: 'zero' } }),
    () => calculateExactHypergeometricV15({ population: 10, successes: 4, draws: 3, event: { kind: 'exactly', value: -1 } }),
    () => calculateExactHypergeometricV15({ population: 10, successes: 4, draws: 3, event: { kind: 'range', minimum: 2, maximum: 1 } }),
    () => calculateExactHypergeometricV15({ population: 10.5, successes: 4, draws: 3, event: { kind: 'zero' } }),
  ];

  for (const call of invalidCalls) assert.throws(call);
});
