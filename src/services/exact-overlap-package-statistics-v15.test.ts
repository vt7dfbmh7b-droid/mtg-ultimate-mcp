import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateExactOverlapPackageAssemblyV15,
  MAX_EXACT_OVERLAP_CATEGORIES_V15,
  MAX_EXACT_OVERLAP_DP_WORK_V15,
  MAX_EXACT_OVERLAP_ROLES_V15,
  MAX_EXACT_OVERLAP_ROUTES_V15,
  type ExactOverlapCardCategoryV15,
  type ExactOverlapRouteV15,
} from './exact-overlap-package-statistics-v15.js';

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

function canSatisfyRoute(selectedCards: readonly string[][], route: ExactOverlapRouteV15): boolean {
  const slots: string[] = [];
  for (const requirement of route.requirements) {
    for (let copy = 0; copy < requirement.minimum; copy += 1) slots.push(requirement.role);
  }
  if (slots.length === 0) return true;
  if (slots.length > selectedCards.length) return false;

  slots.sort((left, right) => {
    const leftOptions = selectedCards.filter((roles) => roles.includes(left)).length;
    const rightOptions = selectedCards.filter((roles) => roles.includes(right)).length;
    return leftOptions - rightOptions;
  });

  const used = new Array<boolean>(selectedCards.length).fill(false);
  function assign(slotIndex: number): boolean {
    if (slotIndex >= slots.length) return true;
    const role = slots[slotIndex]!;
    for (let cardIndex = 0; cardIndex < selectedCards.length; cardIndex += 1) {
      if (used[cardIndex]) continue;
      const roles = selectedCards[cardIndex]!;
      if (!roles.includes(role)) continue;
      used[cardIndex] = true;
      if (assign(slotIndex + 1)) return true;
      used[cardIndex] = false;
    }
    return false;
  }
  return assign(0);
}

function bruteForceOverlap(input: {
  population: number;
  draws: number;
  categories: readonly ExactOverlapCardCategoryV15[];
  routes: readonly ExactOverlapRouteV15[];
}): [bigint, bigint] {
  const cards: string[][] = [];
  for (const category of input.categories) {
    for (let copy = 0; copy < category.count; copy += 1) cards.push([...category.roles]);
  }
  while (cards.length < input.population) cards.push([]);

  let favorable = 0n;
  let total = 0n;
  const maximumMask = 1 << input.population;
  for (let mask = 0; mask < maximumMask; mask += 1) {
    let selectedCount = 0;
    const selectedCards: string[][] = [];
    for (let cardIndex = 0; cardIndex < input.population; cardIndex += 1) {
      if ((mask & (1 << cardIndex)) === 0) continue;
      selectedCount += 1;
      selectedCards.push(cards[cardIndex]!);
    }
    if (selectedCount !== input.draws) continue;
    total += 1n;
    if (input.routes.some((route) => canSatisfyRoute(selectedCards, route))) favorable += 1n;
  }

  const divisor = gcd(favorable, total);
  return [favorable / divisor, total / divisor];
}

test('one universal tutor cannot satisfy two simultaneous missing roles by itself', () => {
  const result = calculateExactOverlapPackageAssemblyV15({
    population: 4,
    draws: 1,
    routes: [{
      name: 'two-piece line',
      requirements: [
        { role: 'piece-a', minimum: 1 },
        { role: 'piece-b', minimum: 1 },
      ],
    }],
    categories: [
      { name: 'universal tutor', count: 1, roles: ['piece-a', 'piece-b'] },
    ],
  });

  assert.equal(result.probability.numerator, '0');
  assert.equal(result.probability.denominator, '1');
  assert.equal(result.complement.numerator, '1');
});

test('universal tutor can fill exactly one missing role next to a real piece', () => {
  const result = calculateExactOverlapPackageAssemblyV15({
    population: 4,
    draws: 2,
    routes: [{
      name: 'two-piece line',
      requirements: [
        { role: 'piece-a', minimum: 1 },
        { role: 'piece-b', minimum: 1 },
      ],
    }],
    categories: [
      { name: 'piece a', count: 1, roles: ['piece-a'] },
      { name: 'universal tutor', count: 1, roles: ['piece-a', 'piece-b'] },
    ],
  });

  assert.equal(result.favorableHands, '1');
  assert.equal(result.totalHands, '6');
  assert.equal(result.probability.numerator, '1');
  assert.equal(result.probability.denominator, '6');
});

test('alternative winning routes sharing a physical role are unioned without double-counting', () => {
  const result = calculateExactOverlapPackageAssemblyV15({
    population: 3,
    draws: 2,
    routes: [
      {
        name: 'a plus b',
        requirements: [
          { role: 'a', minimum: 1 },
          { role: 'b', minimum: 1 },
        ],
      },
      {
        name: 'a plus c',
        requirements: [
          { role: 'a', minimum: 1 },
          { role: 'c', minimum: 1 },
        ],
      },
    ],
    categories: [
      { name: 'a-card', count: 1, roles: ['a'] },
      { name: 'b-card', count: 1, roles: ['b'] },
      { name: 'c-card', count: 1, roles: ['c'] },
    ],
  });

  assert.equal(result.probability.numerator, '2');
  assert.equal(result.probability.denominator, '3');
  assert.equal(result.favorableHands, '2');
});

test('role-specific and universal tutors stay matching-safe with redundant pieces', () => {
  const input = {
    population: 7,
    draws: 3,
    routes: [{
      name: 'engine plus payoff',
      requirements: [
        { role: 'engine', minimum: 1 },
        { role: 'payoff', minimum: 1 },
      ],
    }],
    categories: [
      { name: 'engines', count: 2, roles: ['engine'] },
      { name: 'payoff tutor', count: 1, roles: ['payoff'] },
      { name: 'universal tutor', count: 1, roles: ['engine', 'payoff'] },
    ],
  } satisfies Parameters<typeof calculateExactOverlapPackageAssemblyV15>[0];

  const result = calculateExactOverlapPackageAssemblyV15(input);
  const [expectedNumerator, expectedDenominator] = bruteForceOverlap(input);
  assert.equal(result.probability.numerator, expectedNumerator.toString());
  assert.equal(result.probability.denominator, expectedDenominator.toString());
  assert.deepEqual(
    result.categories.map((entry) => [entry.name, entry.expectation.numerator, entry.expectation.denominator]),
    [
      ['engines', '6', '7'],
      ['payoff tutor', '3', '7'],
      ['universal tutor', '3', '7'],
    ],
  );
});

test('all small A/B/AB populations match an independent labeled-card matching enumerator', () => {
  const routes: ExactOverlapRouteV15[] = [
    {
      name: 'a plus b',
      requirements: [
        { role: 'a', minimum: 1 },
        { role: 'b', minimum: 1 },
      ],
    },
    {
      name: 'double a',
      requirements: [{ role: 'a', minimum: 2 }],
    },
  ];

  for (let population = 2; population <= 6; population += 1) {
    for (let aCount = 0; aCount <= population; aCount += 1) {
      for (let bCount = 0; bCount <= population - aCount; bCount += 1) {
        for (let abCount = 0; abCount <= population - aCount - bCount; abCount += 1) {
          const categories: ExactOverlapCardCategoryV15[] = [];
          if (aCount > 0) categories.push({ name: 'a-only', count: aCount, roles: ['a'] });
          if (bCount > 0) categories.push({ name: 'b-only', count: bCount, roles: ['b'] });
          if (abCount > 0) categories.push({ name: 'a-or-b', count: abCount, roles: ['a', 'b'] });

          for (let draws = 0; draws <= population; draws += 1) {
            const input = { population, draws, routes, categories };
            const result = calculateExactOverlapPackageAssemblyV15(input);
            const [expectedNumerator, expectedDenominator] = bruteForceOverlap(input);
            const context = `${population}/${aCount}/${bCount}/${abCount}/${draws}`;
            assert.equal(result.probability.numerator, expectedNumerator.toString(), `${context} numerator`);
            assert.equal(result.probability.denominator, expectedDenominator.toString(), `${context} denominator`);
          }
        }
      }
    }
  }
});

test('zero-requirement route preserves the whole sample space', () => {
  const result = calculateExactOverlapPackageAssemblyV15({
    population: 20,
    draws: 7,
    routes: [{ name: 'already online', requirements: [] }],
    categories: [],
  });
  assert.equal(result.probability.numerator, '1');
  assert.equal(result.complement.numerator, '0');
  assert.equal(result.neutralCards, 20);
});

test('routes requiring more physical assignments than draws return exact zero', () => {
  const result = calculateExactOverlapPackageAssemblyV15({
    population: 10,
    draws: 2,
    routes: [{
      name: 'three slots',
      requirements: [
        { role: 'a', minimum: 1 },
        { role: 'b', minimum: 1 },
        { role: 'c', minimum: 1 },
      ],
    }],
    categories: [
      { name: 'a', count: 1, roles: ['a'] },
      { name: 'b', count: 1, roles: ['b'] },
      { name: 'c', count: 1, roles: ['c'] },
    ],
  });
  assert.equal(result.probability.numerator, '0');
  assert.equal(result.probability.denominator, '1');
});

test('pathologically broad overlap requests stop at the explicit transition work ceiling', () => {
  const roleNames = Array.from({ length: 8 }, (_, index) => `r${index}`);
  const categories = Array.from({ length: 32 }, (_, categoryIndex) => ({
    name: `c${categoryIndex}`,
    count: 2,
    roles: roleNames.filter((_, roleIndex) => ((categoryIndex * 31 + roleIndex * 13) % 7) < 3),
  })).filter((category) => category.roles.length > 0);

  assert.throws(
    () => calculateExactOverlapPackageAssemblyV15({
      population: 99,
      draws: 7,
      routes: [
        {
          name: 'first four',
          requirements: roleNames.slice(0, 4).map((role) => ({ role, minimum: 1 })),
        },
        {
          name: 'last four',
          requirements: roleNames.slice(4).map((role) => ({ role, minimum: 1 })),
        },
      ],
      categories,
    }),
    new RegExp(`${MAX_EXACT_OVERLAP_DP_WORK_V15} transition work limit`),
  );
});

test('malformed overlap requests fail closed at role, route, category and physical-card boundaries', () => {
  assert.throws(
    () => calculateExactOverlapPackageAssemblyV15({ population: 10, draws: 7, routes: [], categories: [] }),
    /at least one route/,
  );
  assert.throws(
    () => calculateExactOverlapPackageAssemblyV15({
      population: 10,
      draws: 7,
      routes: Array.from({ length: MAX_EXACT_OVERLAP_ROUTES_V15 + 1 }, (_, index) => ({
        name: `route-${index}`,
        requirements: [],
      })),
      categories: [],
    }),
    /routes must contain at most/,
  );
  assert.throws(
    () => calculateExactOverlapPackageAssemblyV15({
      population: 100,
      draws: 7,
      routes: [{
        name: 'too many roles',
        requirements: Array.from({ length: MAX_EXACT_OVERLAP_ROLES_V15 + 1 }, (_, index) => ({
          role: `r-${index}`,
          minimum: 0,
        })),
      }],
      categories: [],
    }),
    /unique roles/,
  );
  assert.throws(
    () => calculateExactOverlapPackageAssemblyV15({
      population: 100,
      draws: 7,
      routes: [{ name: 'a', requirements: [{ role: 'a', minimum: 1 }] }],
      categories: Array.from({ length: MAX_EXACT_OVERLAP_CATEGORIES_V15 + 1 }, (_, index) => ({
        name: `c-${index}`,
        count: 0,
        roles: ['a'],
      })),
    }),
    /categories must contain at most/,
  );
  assert.throws(
    () => calculateExactOverlapPackageAssemblyV15({
      population: 10,
      draws: 7,
      routes: [{
        name: 'duplicate role',
        requirements: [
          { role: 'a', minimum: 1 },
          { role: 'a', minimum: 1 },
        ],
      }],
      categories: [],
    }),
    /duplicate role requirement/,
  );
  assert.throws(
    () => calculateExactOverlapPackageAssemblyV15({
      population: 10,
      draws: 7,
      routes: [{ name: 'a', requirements: [{ role: 'a', minimum: 1 }] }],
      categories: [{ name: 'bad tutor', count: 1, roles: ['b'] }],
    }),
    /unknown role/,
  );
  assert.throws(
    () => calculateExactOverlapPackageAssemblyV15({
      population: 10,
      draws: 7,
      routes: [{ name: 'a', requirements: [{ role: 'a', minimum: 1 }] }],
      categories: [
        { name: 'one', count: 6, roles: ['a'] },
        { name: 'two', count: 5, roles: ['a'] },
      ],
    }),
    /disjoint physical cards/,
  );
  assert.throws(
    () => calculateExactOverlapPackageAssemblyV15({
      population: 1001,
      draws: 7,
      routes: [{ name: 'a', requirements: [{ role: 'a', minimum: 1 }] }],
      categories: [],
    }),
    /population must be at most/,
  );
});
