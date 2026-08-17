export type HypergeometricEventV15 =
  | { kind: 'exactly'; value: number }
  | { kind: 'at-least'; value: number }
  | { kind: 'at-most'; value: number }
  | { kind: 'range'; minimum: number; maximum: number }
  | { kind: 'zero' };

export interface ExactFractionV15 {
  numerator: string;
  denominator: string;
  decimal: number;
}

export interface ExactHypergeometricResultV15 {
  population: number;
  successes: number;
  draws: number;
  event: HypergeometricEventV15;
  probability: ExactFractionV15;
  complement: ExactFractionV15;
  expectation: ExactFractionV15;
  variance: ExactFractionV15;
  support: { minimum: number; maximum: number };
  formula: 'hypergeometric-v15';
}

function requireInteger(name: string, value: number, minimum: number, maximum?: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error(`${name} must be a finite integer.`);
  if (value < minimum) throw new Error(`${name} must be at least ${minimum}.`);
  if (maximum !== undefined && value > maximum) throw new Error(`${name} must be at most ${maximum}.`);
  return value;
}

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

function fraction(numerator: bigint, denominator: bigint): ExactFractionV15 {
  if (denominator === 0n) throw new Error('Exact fraction denominator cannot be zero.');
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  n /= divisor;
  d /= divisor;
  return {
    numerator: n.toString(),
    denominator: d.toString(),
    decimal: Number(n) / Number(d),
  };
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

function exactMass(population: number, successes: number, draws: number, target: number): bigint {
  return choose(successes, target) * choose(population - successes, draws - target);
}

function eventBounds(event: HypergeometricEventV15, supportMinimum: number, supportMaximum: number): [number, number] {
  switch (event.kind) {
    case 'zero':
      return [0, 0];
    case 'exactly': {
      const value = requireInteger('event value', event.value, 0);
      return [value, value];
    }
    case 'at-least': {
      const value = requireInteger('event value', event.value, 0);
      return [Math.max(value, supportMinimum), supportMaximum];
    }
    case 'at-most': {
      const value = requireInteger('event value', event.value, 0);
      return [supportMinimum, Math.min(value, supportMaximum)];
    }
    case 'range': {
      const minimum = requireInteger('event minimum', event.minimum, 0);
      const maximum = requireInteger('event maximum', event.maximum, 0);
      if (minimum > maximum) throw new Error('event minimum must not exceed event maximum.');
      return [Math.max(minimum, supportMinimum), Math.min(maximum, supportMaximum)];
    }
  }
}

/**
 * Exact univariate hypergeometric probability using integer combinations.
 * Fractions are reduced with BigInt; decimal is presentation only and must not
 * be used for equality/proof checks.
 */
export function calculateExactHypergeometricV15(input: {
  population: number;
  successes: number;
  draws: number;
  event: HypergeometricEventV15;
}): ExactHypergeometricResultV15 {
  const population = requireInteger('population', input.population, 0);
  const successes = requireInteger('successes', input.successes, 0, population);
  const draws = requireInteger('draws', input.draws, 0, population);
  if (!input.event || typeof input.event !== 'object') throw new Error('event is required.');

  const supportMinimum = Math.max(0, draws - (population - successes));
  const supportMaximum = Math.min(draws, successes);
  const total = choose(population, draws);
  const [start, end] = eventBounds(input.event, supportMinimum, supportMaximum);

  let favorable = 0n;
  if (start <= end) {
    for (let target = start; target <= end; target += 1) favorable += exactMass(population, successes, draws, target);
  }

  // Exactly/zero events outside the physical support intentionally resolve to 0.
  if (input.event.kind === 'exactly' || input.event.kind === 'zero') {
    const [rawStart] = eventBounds(input.event, 0, Math.max(draws, successes));
    if (rawStart < supportMinimum || rawStart > supportMaximum) favorable = 0n;
  }

  const probability = fraction(favorable, total);
  const complement = fraction(total - favorable, total);
  const expectation = population === 0
    ? fraction(0n, 1n)
    : fraction(BigInt(draws) * BigInt(successes), BigInt(population));

  // Var[X] = n * (K/N) * (1-K/N) * ((N-n)/(N-1)).
  const variance = population <= 1
    ? fraction(0n, 1n)
    : fraction(
      BigInt(draws)
        * BigInt(successes)
        * BigInt(population - successes)
        * BigInt(population - draws),
      BigInt(population)
        * BigInt(population)
        * BigInt(population - 1),
    );

  return {
    population,
    successes,
    draws,
    event: input.event,
    probability,
    complement,
    expectation,
    variance,
    support: { minimum: supportMinimum, maximum: supportMaximum },
    formula: 'hypergeometric-v15',
  };
}

export function exactFractionSumsToOneV15(left: ExactFractionV15, right: ExactFractionV15): boolean {
  const leftNumerator = BigInt(left.numerator);
  const leftDenominator = BigInt(left.denominator);
  const rightNumerator = BigInt(right.numerator);
  const rightDenominator = BigInt(right.denominator);
  return leftNumerator * rightDenominator + rightNumerator * leftDenominator
    === leftDenominator * rightDenominator;
}
