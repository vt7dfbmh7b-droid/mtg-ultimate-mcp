import {
  MAX_EXACT_STATISTICS_POPULATION_V15,
  type ExactFractionV15,
} from './exact-statistics-v15.js';

export const MAX_EXACT_PACKAGE_REQUIREMENTS_V15 = 32;
export const MAX_EXACT_PACKAGE_DP_WORK_V15 = 100_000;

export interface ExactPackageRequirementV15 {
  name: string;
  count: number;
  minimum: number;
}

export interface ExactPackageAssemblyResultV15 {
  population: number;
  draws: number;
  packages: Array<ExactPackageRequirementV15 & { expectation: ExactFractionV15 }>;
  untrackedCards: number;
  favorableHands: string;
  totalHands: string;
  probability: ExactFractionV15;
  complement: ExactFractionV15;
  formula: 'multivariate-hypergeometric-package-v15';
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
  const decimal = Number(n) / Number(d);
  if (!Number.isFinite(decimal)) {
    throw new Error('Exact fraction decimal presentation exceeded the supported finite range.');
  }
  return { numerator: n.toString(), denominator: d.toString(), decimal };
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

/**
 * Exact probability of drawing enough cards from every disjoint package bucket.
 *
 * A package bucket represents interchangeable cards for one role in a combo or
 * setup line. Buckets must be disjoint: a physical card is counted in at most one
 * bucket. Cards not assigned to a bucket are neutral/untracked. Overlapping-role
 * cards (for example a tutor that can satisfy multiple roles) require a separate
 * overlap-aware model rather than double-counting the same physical card here.
 */
export function calculateExactPackageAssemblyV15(input: {
  population: number;
  draws: number;
  packages: readonly ExactPackageRequirementV15[];
}): ExactPackageAssemblyResultV15 {
  const population = requireInteger(
    'population',
    input.population,
    0,
    MAX_EXACT_STATISTICS_POPULATION_V15,
  );
  const draws = requireInteger('draws', input.draws, 0, population);
  if (!Array.isArray(input.packages)) throw new Error('packages must be an array.');
  if (input.packages.length > MAX_EXACT_PACKAGE_REQUIREMENTS_V15) {
    throw new Error(`packages must contain at most ${MAX_EXACT_PACKAGE_REQUIREMENTS_V15} requirements.`);
  }

  const names = new Set<string>();
  let trackedCards = 0;
  let minimumCardsNeeded = 0;
  const packages = input.packages.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`packages[${index}] must be an object.`);
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) throw new Error(`packages[${index}].name must be a non-empty string.`);
    if (name.length > 120) throw new Error(`packages[${index}].name must be at most 120 characters.`);
    if (names.has(name)) throw new Error(`package names must be unique; duplicate: ${name}.`);
    names.add(name);

    const count = requireInteger(`packages[${index}].count`, entry.count, 0, population);
    const minimum = requireInteger(`packages[${index}].minimum`, entry.minimum, 0, population);
    trackedCards += count;
    minimumCardsNeeded += minimum;
    return { name, count, minimum };
  });

  if (trackedCards > population) {
    throw new Error('package counts must be disjoint and sum to no more than population.');
  }

  const untrackedCards = population - trackedCards;
  const total = choose(population, draws);
  const impossible = minimumCardsNeeded > draws
    || packages.some((entry) => entry.minimum > entry.count);

  let favorable = 0n;
  if (!impossible) {
    let waysByTrackedDraws = new Array<bigint>(draws + 1).fill(0n);
    waysByTrackedDraws[0] = 1n;
    let work = 0;

    for (const entry of packages) {
      const maximumPicked = Math.min(entry.count, draws);
      const pickWays = new Array<bigint>(maximumPicked + 1).fill(0n);
      for (let picked = entry.minimum; picked <= maximumPicked; picked += 1) {
        pickWays[picked] = choose(entry.count, picked);
      }

      const next = new Array<bigint>(draws + 1).fill(0n);
      for (let alreadyPicked = 0; alreadyPicked <= draws; alreadyPicked += 1) {
        const previousWays = waysByTrackedDraws[alreadyPicked];
        if (previousWays === 0n) continue;
        const remainingDraws = draws - alreadyPicked;
        const localMaximum = Math.min(maximumPicked, remainingDraws);
        for (let picked = entry.minimum; picked <= localMaximum; picked += 1) {
          work += 1;
          if (work > MAX_EXACT_PACKAGE_DP_WORK_V15) {
            throw new Error(`exact package calculation exceeded the ${MAX_EXACT_PACKAGE_DP_WORK_V15} transition work limit.`);
          }
          next[alreadyPicked + picked] += previousWays * pickWays[picked];
        }
      }
      waysByTrackedDraws = next;
    }

    for (let trackedDraws = 0; trackedDraws <= draws; trackedDraws += 1) {
      const trackedWays = waysByTrackedDraws[trackedDraws];
      if (trackedWays === 0n) continue;
      favorable += trackedWays * choose(untrackedCards, draws - trackedDraws);
    }
  }

  const probability = fraction(favorable, total);
  const complement = fraction(total - favorable, total);
  return {
    population,
    draws,
    packages: packages.map((entry) => ({
      ...entry,
      expectation: population === 0
        ? fraction(0n, 1n)
        : fraction(BigInt(draws) * BigInt(entry.count), BigInt(population)),
    })),
    untrackedCards,
    favorableHands: favorable.toString(),
    totalHands: total.toString(),
    probability,
    complement,
    formula: 'multivariate-hypergeometric-package-v15',
  };
}
