import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

const currentMetrics = {
  rampCount: 8,
  drawCount: 8,
  interactionCount: 8,
  protectionCount: 2,
  tutorCount: 1,
  recursionCount: 2,
  boardWipeCount: 2,
  earlyPlayCount: 10,
};

const structuralTargets = {
  ramp: 8,
  draw: 8,
  interaction: 8,
  protection: 3,
  tutors: 1,
  recursion: 2,
  boardWipes: 2,
  earlyPlays: 10,
};

function countersAffinity() {
  return {
    score: 2,
    protectionApplied: 2,
    matchedStrategies: ['counters'],
    matches: [{ archetype: 'counters', commanderScore: 8, cardScore: 2, overlapScore: 2 }],
  };
}

test('exact strategy component loss outranks cut pressure even below maximum numeric protection', () => {
  const addition = {
    role: 'protection' as const,
    candidate: {
      card: { name: 'New Protection', roles: ['protection'], manaValue: 2, typeLine: 'Instant' },
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    },
  };
  const exactMechanismCut = {
    card: {
      name: 'Narrow Counter Mechanism',
      roles: ['+1/+1 counters'],
      manaValue: 4,
      typeLine: 'Creature — Test',
    },
    heuristicCutPressure: 10,
    strategyAffinity: countersAffinity(),
  };
  const broadStrategyCut = {
    card: { name: 'Broad Strategy Filler', roles: [], manaValue: 4, typeLine: 'Creature — Test' },
    heuristicCutPressure: 8,
    strategyAffinity: countersAffinity(),
  };

  const pairings = pairUpgradeSwapsByStructureV15(
    [addition],
    [exactMechanismCut, broadStrategyCut],
    currentMetrics,
    structuralTargets,
    4,
  );

  assert.equal(pairings.length, 1);
  assert.equal((pairings[0]?.cut.card as Record<string, unknown> | undefined)?.name, 'Broad Strategy Filler');
  assert.equal(pairings[0]?.strategyPreservation.meaningfulStrategyLoss, false);
});

test('an incoming card that preserves the exact strategy component does not trigger categorical loss', () => {
  const addition = {
    role: 'protection' as const,
    candidate: {
      card: {
        name: 'Counter Protection',
        roles: ['protection', '+1/+1 counters'],
        manaValue: 2,
        typeLine: 'Instant',
      },
      strategyAffinity: countersAffinity(),
    },
  };
  const mechanismCut = {
    card: {
      name: 'Counter Mechanism',
      roles: ['+1/+1 counters'],
      manaValue: 4,
      typeLine: 'Creature — Test',
    },
    heuristicCutPressure: 10,
    strategyAffinity: countersAffinity(),
  };

  const pairings = pairUpgradeSwapsByStructureV15(
    [addition],
    [mechanismCut],
    currentMetrics,
    structuralTargets,
    4,
  );

  assert.equal(pairings.length, 1);
  assert.equal(pairings[0]?.strategyPreservation.meaningfulStrategyLoss, false);
  assert.deepEqual(pairings[0]?.strategyPreservation.unreplacedStrategyComponentRoles, []);
});
