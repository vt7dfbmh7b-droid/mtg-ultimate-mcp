import assert from 'node:assert/strict';
import test from 'node:test';
import type { CombatBoardV07 } from './combat-v07.js';
import { calculateExactPackageAssemblyV15 } from './exact-package-statistics-v15.js';
import {
  fingerprintExternalBenchmarkJsonV15,
  normalizeCombatBoardForExternalOracleV15,
  normalizeExactPackageAssemblyForExternalOracleV15,
} from './external-oracle-adapters-v15.js';

function board(overrides: Partial<CombatBoardV07> = {}): CombatBoardV07 {
  return {
    creatures: [
      {
        name: 'Beta',
        printedPower: 2,
        printedToughness: 2,
        effectivePower: 4,
        effectiveToughness: 3,
        modifiers: [
          { source: 'Internal wording', power: 2, toughness: 1, grants: ['Flying'], reason: 'implementation prose' },
        ],
        keywords: ['Flying', 'flying', 'TRAMPLE'],
        commander: true,
        unresolved: [],
      },
      {
        name: 'Alpha',
        printedPower: 1,
        printedToughness: 1,
        effectivePower: null,
        effectiveToughness: 1,
        modifiers: [],
        keywords: [],
        commander: false,
        unresolved: ['printed power is variable or non-numeric'],
      },
    ],
    totalEffectivePower: null,
    commanderPower: { Beta: 4 },
    notes: ['internal explanatory note'],
    ...overrides,
  };
}

test('combat normalization keeps semantic state and removes implementation prose', () => {
  const normalized = normalizeCombatBoardForExternalOracleV15(board());
  assert.deepEqual(normalized, {
    commanderPower: { Beta: 4 },
    creatures: [
      {
        commander: false,
        effectivePower: null,
        effectiveToughness: 1,
        keywords: [],
        name: 'Alpha',
        unresolved: ['printed power is variable or non-numeric'],
      },
      {
        commander: true,
        effectivePower: 4,
        effectiveToughness: 3,
        keywords: ['flying', 'trample'],
        name: 'Beta',
        unresolved: [],
      },
    ],
    totalEffectivePower: null,
  });
});

test('changing notes or modifier wording does not create a false parity mismatch', () => {
  const first = normalizeCombatBoardForExternalOracleV15(board());
  const second = normalizeCombatBoardForExternalOracleV15(board({
    notes: ['completely different wording'],
    creatures: [
      {
        ...board().creatures[0]!,
        modifiers: [
          { source: 'Different explanation', power: 999, toughness: 999, grants: [], reason: 'not part of normalized contract' },
        ],
      },
      board().creatures[1]!,
    ],
  }));
  assert.deepEqual(second, first);
});

test('a semantic combat-state change changes the normalized result', () => {
  const first = normalizeCombatBoardForExternalOracleV15(board());
  const changedBoard = board();
  changedBoard.creatures[0] = { ...changedBoard.creatures[0]!, effectivePower: 5 };
  changedBoard.commanderPower = { Beta: 5 };
  const second = normalizeCombatBoardForExternalOracleV15(changedBoard);
  assert.notDeepEqual(second, first);
});

test('benchmark fingerprints ignore object-key order but preserve semantic changes', () => {
  const first = fingerprintExternalBenchmarkJsonV15({
    b: 2,
    a: { y: true, x: [1, 2, 3] },
  });
  const reordered = fingerprintExternalBenchmarkJsonV15({
    a: { x: [1, 2, 3], y: true },
    b: 2,
  });
  const changed = fingerprintExternalBenchmarkJsonV15({
    a: { x: [1, 2, 4], y: true },
    b: 2,
  });

  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test('exact package normalization uses fractions rather than decimal presentation', () => {
  const exact = calculateExactPackageAssemblyV15({
    population: 99,
    draws: 7,
    packages: [
      { name: 'piece-a', count: 1, minimum: 1 },
      { name: 'piece-b', count: 1, minimum: 1 },
    ],
  });
  const normalized = normalizeExactPackageAssemblyForExternalOracleV15(exact);

  assert.deepEqual(normalized, {
    complement: { denominator: '231', numerator: '230' },
    draws: 7,
    favorableHands: '64446024',
    formula: 'multivariate-hypergeometric-package-v15',
    packages: [
      { count: 1, minimum: 1, name: 'piece-a' },
      { count: 1, minimum: 1, name: 'piece-b' },
    ],
    population: 99,
    probability: { denominator: '231', numerator: '1' },
    totalHands: '14887031544',
    untrackedCards: 97,
  });

  assert.equal(JSON.stringify(normalized).includes('0.004329'), false);
});

test('package benchmark normalization ignores equivalent role-bucket input order', () => {
  const first = normalizeExactPackageAssemblyForExternalOracleV15(calculateExactPackageAssemblyV15({
    population: 99,
    draws: 7,
    packages: [
      { name: 'combo-piece', count: 2, minimum: 1 },
      { name: 'tutor', count: 4, minimum: 1 },
    ],
  }));
  const reversed = normalizeExactPackageAssemblyForExternalOracleV15(calculateExactPackageAssemblyV15({
    population: 99,
    draws: 7,
    packages: [
      { name: 'tutor', count: 4, minimum: 1 },
      { name: 'combo-piece', count: 2, minimum: 1 },
    ],
  }));

  assert.deepEqual(reversed, first);
  assert.equal(
    fingerprintExternalBenchmarkJsonV15(reversed),
    fingerprintExternalBenchmarkJsonV15(first),
  );
});
