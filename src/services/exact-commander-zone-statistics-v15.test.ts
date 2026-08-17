import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateExactCommanderZonePackageAssemblyV15,
  MAX_EXACT_COMMAND_ZONE_CARDS_V15,
  MAX_EXACT_COMMAND_ZONE_FRONTIER_STATES_V15,
  type ExactCommandZoneCardV15,
} from './exact-commander-zone-statistics-v15.js';
import type {
  ExactOverlapCardCategoryV15,
  ExactOverlapRouteV15,
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

function canSatisfyRoute(availableCards: readonly string[][], route: ExactOverlapRouteV15): boolean {
  const slots: string[] = [];
  for (const requirement of route.requirements) {
    for (let copy = 0; copy < requirement.minimum; copy += 1) slots.push(requirement.role);
  }
  if (slots.length === 0) return true;
  if (slots.length > availableCards.length) return false;

  slots.sort((left, right) => {
    const leftOptions = availableCards.filter((roles) => roles.includes(left)).length;
    const rightOptions = availableCards.filter((roles) => roles.includes(right)).length;
    return leftOptions - rightOptions;
  });

  const used = new Array<boolean>(availableCards.length).fill(false);
  function assign(slotIndex: number): boolean {
    if (slotIndex >= slots.length) return true;
    const role = slots[slotIndex]!;
    for (let cardIndex = 0; cardIndex < availableCards.length; cardIndex += 1) {
      if (used[cardIndex]) continue;
      const roles = availableCards[cardIndex]!;
      if (!roles.includes(role)) continue;
      used[cardIndex] = true;
      if (assign(slotIndex + 1)) return true;
      used[cardIndex] = false;
    }
    return false;
  }
  return assign(0);
}

function bruteForceCommanderZone(input: {
  deckSize: number;
  draws: number;
  commandZoneCards: readonly ExactCommandZoneCardV15[];
  routes: readonly ExactOverlapRouteV15[];
  libraryCategories: readonly ExactOverlapCardCategoryV15[];
}): [bigint, bigint] {
  const libraryPopulation = input.deckSize - input.commandZoneCards.length;
  const libraryCards: string[][] = [];
  for (const category of input.libraryCategories) {
    for (let copy = 0; copy < category.count; copy += 1) libraryCards.push([...category.roles]);
  }
  while (libraryCards.length < libraryPopulation) libraryCards.push([]);

  const guaranteedCards = input.commandZoneCards.map((card) => [...card.roles]);
  let favorable = 0n;
  let total = 0n;
  const maximumMask = 1 << libraryPopulation;
  for (let mask = 0; mask < maximumMask; mask += 1) {
    let selectedCount = 0;
    const availableCards = guaranteedCards.map((roles) => [...roles]);
    for (let cardIndex = 0; cardIndex < libraryPopulation; cardIndex += 1) {
      if ((mask & (1 << cardIndex)) === 0) continue;
      selectedCount += 1;
      availableCards.push(libraryCards[cardIndex]!);
    }
    if (selectedCount !== input.draws) continue;
    total += 1n;
    if (input.routes.some((route) => canSatisfyRoute(availableCards, route))) favorable += 1n;
  }

  const divisor = gcd(favorable, total);
  return [favorable / divisor, total / divisor];
}

test('single commander is guaranteed while the opening seven comes from the remaining 99 cards', () => {
  const result = calculateExactCommanderZonePackageAssemblyV15({
    deckSize: 100,
    draws: 7,
    commandZoneCards: [{ name: 'engine commander', roles: ['engine'] }],
    routes: [{
      name: 'commander plus payoff',
      requirements: [
        { role: 'engine', minimum: 1 },
        { role: 'payoff', minimum: 1 },
      ],
    }],
    libraryCategories: [{ name: 'payoff singleton', count: 1, roles: ['payoff'] }],
  });

  assert.equal(result.libraryPopulation, 99);
  assert.equal(result.totalHands, '14887031544');
  assert.equal(result.favorableHands, '1052618392');
  assert.equal(result.probability.numerator, '7');
  assert.equal(result.probability.denominator, '99');
});

test('two known commanders leave a 98-card library without changing the seven-card opening hand', () => {
  const result = calculateExactCommanderZonePackageAssemblyV15({
    deckSize: 100,
    draws: 7,
    commandZoneCards: [
      { name: 'first commander', roles: ['first'] },
      { name: 'second commander', roles: ['second'] },
    ],
    routes: [{
      name: 'both commanders plus payoff',
      requirements: [
        { role: 'first', minimum: 1 },
        { role: 'second', minimum: 1 },
        { role: 'payoff', minimum: 1 },
      ],
    }],
    libraryCategories: [{ name: 'payoff singleton', count: 1, roles: ['payoff'] }],
  });

  assert.equal(result.libraryPopulation, 98);
  assert.equal(result.totalHands, '13834413152');
  assert.equal(result.favorableHands, '988172368');
  assert.equal(result.probability.numerator, '1');
  assert.equal(result.probability.denominator, '14');
});

test('one flexible commander cannot satisfy two simultaneous roles by itself', () => {
  const result = calculateExactCommanderZonePackageAssemblyV15({
    deckSize: 4,
    draws: 0,
    commandZoneCards: [{ name: 'flex commander', roles: ['a', 'b'] }],
    routes: [{
      name: 'two-piece line',
      requirements: [
        { role: 'a', minimum: 1 },
        { role: 'b', minimum: 1 },
      ],
    }],
    libraryCategories: [],
  });

  assert.equal(result.probability.numerator, '0');
  assert.equal(result.probability.denominator, '1');
  assert.equal(result.commandZoneFrontierStates, 2);
});

test('flexible commander can cover the missing role next to one drawn physical piece', () => {
  const result = calculateExactCommanderZonePackageAssemblyV15({
    deckSize: 4,
    draws: 1,
    commandZoneCards: [{ name: 'flex commander', roles: ['a', 'b'] }],
    routes: [{
      name: 'a plus b',
      requirements: [
        { role: 'a', minimum: 1 },
        { role: 'b', minimum: 1 },
      ],
    }],
    libraryCategories: [{ name: 'a-piece', count: 1, roles: ['a'] }],
  });

  assert.equal(result.libraryPopulation, 3);
  assert.equal(result.probability.numerator, '1');
  assert.equal(result.probability.denominator, '3');
});

test('two flexible commanders may be assigned separately to two simultaneous roles', () => {
  const result = calculateExactCommanderZonePackageAssemblyV15({
    deckSize: 2,
    draws: 0,
    commandZoneCards: [
      { name: 'flex one', roles: ['a', 'b'] },
      { name: 'flex two', roles: ['a', 'b'] },
    ],
    routes: [{
      name: 'a plus b',
      requirements: [
        { role: 'a', minimum: 1 },
        { role: 'b', minimum: 1 },
      ],
    }],
    libraryCategories: [],
  });

  assert.equal(result.libraryPopulation, 0);
  assert.equal(result.probability.numerator, '1');
  assert.equal(result.probability.denominator, '1');
});

test('an irrelevant commander is removed from the library sample space instead of becoming a fictitious draw', () => {
  const result = calculateExactCommanderZonePackageAssemblyV15({
    deckSize: 100,
    draws: 7,
    commandZoneCards: [{ name: 'irrelevant commander', roles: [] }],
    routes: [{ name: 'find target', requirements: [{ role: 'target', minimum: 1 }] }],
    libraryCategories: [{ name: 'target singleton', count: 1, roles: ['target'] }],
  });

  assert.equal(result.libraryPopulation, 99);
  assert.equal(result.totalHands, '14887031544');
  assert.equal(result.probability.numerator, '7');
  assert.equal(result.probability.denominator, '99');
});

test('alternative routes can choose different assignments for the same flexible commander', () => {
  const result = calculateExactCommanderZonePackageAssemblyV15({
    deckSize: 4,
    draws: 1,
    commandZoneCards: [{ name: 'a-or-c commander', roles: ['a', 'c'] }],
    routes: [
      {
        name: 'a plus b',
        requirements: [
          { role: 'a', minimum: 1 },
          { role: 'b', minimum: 1 },
        ],
      },
      {
        name: 'c plus d',
        requirements: [
          { role: 'c', minimum: 1 },
          { role: 'd', minimum: 1 },
        ],
      },
    ],
    libraryCategories: [
      { name: 'b-card', count: 1, roles: ['b'] },
      { name: 'd-card', count: 1, roles: ['d'] },
    ],
  });

  assert.equal(result.effectiveLibraryRouteCount, 2);
  assert.equal(result.probability.numerator, '2');
  assert.equal(result.probability.denominator, '3');
});

test('all small command-zone plus A/B/AB library populations match independent labeled-card enumeration', () => {
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
  const commandZoneConfigurations: ExactCommandZoneCardV15[][] = [
    [{ name: 'flex commander', roles: ['a', 'b'] }],
    [
      { name: 'a commander', roles: ['a'] },
      { name: 'flex partner', roles: ['a', 'b'] },
    ],
  ];

  for (const commandZoneCards of commandZoneConfigurations) {
    for (let libraryPopulation = 0; libraryPopulation <= 5; libraryPopulation += 1) {
      for (let aCount = 0; aCount <= libraryPopulation; aCount += 1) {
        for (let bCount = 0; bCount <= libraryPopulation - aCount; bCount += 1) {
          for (let abCount = 0; abCount <= libraryPopulation - aCount - bCount; abCount += 1) {
            const libraryCategories: ExactOverlapCardCategoryV15[] = [];
            if (aCount > 0) libraryCategories.push({ name: 'a-only', count: aCount, roles: ['a'] });
            if (bCount > 0) libraryCategories.push({ name: 'b-only', count: bCount, roles: ['b'] });
            if (abCount > 0) libraryCategories.push({ name: 'a-or-b', count: abCount, roles: ['a', 'b'] });

            for (let draws = 0; draws <= libraryPopulation; draws += 1) {
              const input = {
                deckSize: libraryPopulation + commandZoneCards.length,
                draws,
                commandZoneCards,
                routes,
                libraryCategories,
              };
              const result = calculateExactCommanderZonePackageAssemblyV15(input);
              const [expectedNumerator, expectedDenominator] = bruteForceCommanderZone(input);
              const context = `${commandZoneCards.length}/${libraryPopulation}/${aCount}/${bCount}/${abCount}/${draws}`;
              assert.equal(result.probability.numerator, expectedNumerator.toString(), `${context} numerator`);
              assert.equal(result.probability.denominator, expectedDenominator.toString(), `${context} denominator`);
            }
          }
        }
      }
    }
  }
});

test('derived library size rejects category counts that accidentally keep command-zone cards in the draw population', () => {
  assert.throws(
    () => calculateExactCommanderZonePackageAssemblyV15({
      deckSize: 4,
      draws: 1,
      commandZoneCards: [{ name: 'commander', roles: ['a'] }],
      routes: [{ name: 'a', requirements: [{ role: 'a', minimum: 1 }] }],
      libraryCategories: [{ name: 'four library cards', count: 4, roles: ['a'] }],
    }),
    /sum to no more than population/,
  );
});

test('pathologically broad guaranteed-role assignments stop at the explicit frontier ceiling', () => {
  const roles = Array.from({ length: 8 }, (_, index) => `r${index}`);
  const commandZoneCards = Array.from({ length: 8 }, (_, index) => ({
    name: `flex-${index}`,
    roles,
  }));

  assert.throws(
    () => calculateExactCommanderZonePackageAssemblyV15({
      deckSize: 8,
      draws: 0,
      commandZoneCards,
      routes: [{
        name: 'double every role',
        requirements: roles.map((role) => ({ role, minimum: 2 })),
      }],
      libraryCategories: [],
    }),
    new RegExp(`${MAX_EXACT_COMMAND_ZONE_FRONTIER_STATES_V15} state limit`),
  );
});

test('malformed command-zone requests fail closed', () => {
  assert.throws(
    () => calculateExactCommanderZonePackageAssemblyV15({
      deckSize: 1,
      draws: 0,
      commandZoneCards: [
        { name: 'one', roles: [] },
        { name: 'two', roles: [] },
      ],
      routes: [{ name: 'already', requirements: [] }],
      libraryCategories: [],
    }),
    /more physical cards than deckSize/,
  );
  assert.throws(
    () => calculateExactCommanderZonePackageAssemblyV15({
      deckSize: 4,
      draws: 0,
      commandZoneCards: [
        { name: 'duplicate', roles: ['a'] },
        { name: 'duplicate', roles: ['a'] },
      ],
      routes: [{ name: 'a', requirements: [{ role: 'a', minimum: 1 }] }],
      libraryCategories: [],
    }),
    /card names must be unique/,
  );
  assert.throws(
    () => calculateExactCommanderZonePackageAssemblyV15({
      deckSize: 4,
      draws: 0,
      commandZoneCards: [{ name: 'bad commander', roles: ['b'] }],
      routes: [{ name: 'a', requirements: [{ role: 'a', minimum: 1 }] }],
      libraryCategories: [],
    }),
    /unknown role/,
  );
  assert.throws(
    () => calculateExactCommanderZonePackageAssemblyV15({
      deckSize: 3,
      draws: 3,
      commandZoneCards: [{ name: 'commander', roles: [] }],
      routes: [{ name: 'already', requirements: [] }],
      libraryCategories: [],
    }),
    /draws must be at most 2/,
  );
  assert.throws(
    () => calculateExactCommanderZonePackageAssemblyV15({
      deckSize: MAX_EXACT_COMMAND_ZONE_CARDS_V15 + 1,
      draws: 0,
      commandZoneCards: Array.from({ length: MAX_EXACT_COMMAND_ZONE_CARDS_V15 + 1 }, (_, index) => ({
        name: `card-${index}`,
        roles: [],
      })),
      routes: [{ name: 'already', requirements: [] }],
      libraryCategories: [],
    }),
    /commandZoneCards must contain at most/,
  );
});
