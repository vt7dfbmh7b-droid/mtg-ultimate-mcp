import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

const metrics = {
  rampCount: 8,
  drawCount: 8,
  interactionCount: 8,
  protectionCount: 2,
  tutorCount: 1,
  recursionCount: 2,
  boardWipeCount: 2,
  earlyPlayCount: 10,
  cheapInteractionCount: 6,
  fastManaCount: 2,
  averageNonlandManaValue: 3,
  nonlandCount: 60,
  commanderColorCount: 2,
  persistentColoredManaSourceCount: 4,
  roleCounts: {},
};

const targets = {
  ramp: 8,
  draw: 8,
  interaction: 8,
  freeInteraction: 0,
  protection: 3,
  tutors: 1,
  recursion: 2,
  boardWipes: 2,
  earlyPlays: 10,
};

function addition(theme: boolean, strategy = 0) {
  return {
    role: 'protection' as const,
    candidate: {
      card: {
        name: 'Unnamed Protective Upgrade',
        roles: ['protection'],
        manaValue: 2,
        typeLine: 'Instant',
      },
      explicitTheme: { matchesControlledTheme: theme },
      strategyAffinity: { score: strategy, protectionApplied: 0, matchedStrategies: [] },
    },
  };
}

function cut(name: string, pressure: number, theme: boolean, strategy = 0) {
  return {
    card: { name, roles: [], manaValue: 4, typeLine: 'Creature — Test' },
    heuristicCutPressure: pressure,
    explicitTheme: { matchesControlledTheme: theme },
    strategyAffinity: { score: strategy, protectionApplied: 0, matchedStrategies: [] },
  };
}

test('safe-cut ranking preserves requested identity when an equally legal neutral cut exists', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [addition(false)] as any,
    [cut('Unnamed Identity Engine', 10, true), cut('Unnamed Neutral Filler', 8, false)],
    metrics,
    targets,
    3,
  );
  assert.equal((pairs[0]?.cut.card as any)?.name, 'Unnamed Neutral Filler');
});

test('equal identity loss leaves normal cut-pressure tie-break intact', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [addition(true)] as any,
    [cut('Unnamed Higher Pressure Identity Card', 10, true), cut('Unnamed Lower Pressure Identity Card', 8, true)],
    metrics,
    targets,
    3,
  );
  assert.equal((pairs[0]?.cut.card as any)?.name, 'Unnamed Higher Pressure Identity Card');
});

test('identity-rich cards remain cuttable when no safer legal alternative exists', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [addition(false)] as any,
    [cut('Unnamed Required Identity Cut', 10, true)],
    metrics,
    targets,
    3,
  );
  assert.equal((pairs[0]?.cut.card as any)?.name, 'Unnamed Required Identity Cut');
});

test('substantive strategy gain can compensate for spending controlled-theme identity', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [addition(false, 10)] as any,
    [cut('Unnamed Low Strategy Theme Card', 8, true, 2), cut('Unnamed High Strategy Theme Card', 10, true, 8)],
    metrics,
    targets,
    3,
  );
  assert.equal((pairs[0]?.cut.card as any)?.name, 'Unnamed Low Strategy Theme Card');
});

test('existing substantive strategy preservation still outranks advisory theme identity', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [addition(false, 0)] as any,
    [cut('Unnamed High Strategy Neutral Card', 10, false, 8), cut('Unnamed Low Strategy Theme Card', 8, true, 2)],
    metrics,
    targets,
    3,
  );
  assert.equal((pairs[0]?.cut.card as any)?.name, 'Unnamed Low Strategy Theme Card');
});
