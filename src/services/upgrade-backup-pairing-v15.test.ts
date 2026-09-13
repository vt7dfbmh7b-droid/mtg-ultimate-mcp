import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

const protectedAristocratsEvidence = {
  score: 6,
  protectionApplied: 4,
  matchedStrategies: ['aristocrats'],
  matches: [{ archetype: 'aristocrats', overlapScore: 6, commanderScore: 6 }],
};

const targets = {
  ramp: 12,
  draw: 12,
  interaction: 14,
  freeInteraction: 0,
  protection: 6,
  tutors: 6,
  recursion: 3,
  boardWipes: 2,
  earlyPlays: 16,
};

const metrics = {
  rampCount: 12,
  drawCount: 12,
  interactionCount: 14,
  protectionCount: 6,
  tutorCount: 6,
  recursionCount: 3,
  boardWipeCount: 2,
  earlyPlayCount: 20,
  cheapInteractionCount: 6,
  fastManaCount: 2,
  averageNonlandManaValue: 3.2,
  nonlandCount: 60,
  roleCounts: { 'free interaction': 0 },
};

test('autonomous pairing skips a strategy-damaging primary add and uses a safe backup without consuming the cut', () => {
  const pairings = pairUpgradeSwapsByStructureV15(
    [
      {
        role: 'average-nonland-mv' as const,
        candidate: {
          card: {
            name: 'Generic Cheap Draw',
            roles: ['card draw'],
            manaValue: 1,
            typeLine: 'Instant',
          },
          authoritativeTargetGate: 'average-nonland-mv',
          strategyAffinity: protectedAristocratsEvidence,
        },
      },
      {
        role: 'average-nonland-mv' as const,
        candidate: {
          card: {
            name: 'On-Plan Cheap Engine',
            roles: ['card draw', 'death-trigger draw engine'],
            manaValue: 2,
            typeLine: 'Creature — Test',
          },
          authoritativeTargetGate: 'average-nonland-mv',
          strategyAffinity: protectedAristocratsEvidence,
        },
      },
    ],
    [
      {
        card: {
          name: 'Protected Death Draw Engine',
          roles: ['card draw', 'death-trigger draw engine'],
          manaValue: 5,
          typeLine: 'Creature — Test',
        },
        heuristicCutPressure: 10,
        strategyAffinity: protectedAristocratsEvidence,
      },
    ],
    metrics,
    targets,
    4,
    { rejectMeaningfulStrategyLoss: true, maxPairs: 1 },
  );

  assert.equal(pairings.length, 1);
  assert.equal((pairings[0]?.add.card as { name: string }).name, 'On-Plan Cheap Engine');
  assert.equal((pairings[0]?.cut.card as { name: string }).name, 'Protected Death Draw Engine');
  assert.equal(pairings[0]?.strategyPreservation.verdict, 'preserved');
});

test('autonomous pairing tries a safe fallback cut before abandoning a requested mechanism', () => {
  const pairings = pairUpgradeSwapsByStructureV15(
    [{
      role: 'theme-component' as const,
      candidate: {
        card: {
          name: 'Requested Interaction',
          roles: ['countermagic', 'cheap interaction'],
          manaValue: 2,
          typeLine: 'Instant',
        },
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
      },
    }],
    [
      {
        card: {
          name: 'Protected Death Draw Engine',
          roles: ['card draw', 'death-trigger draw engine'],
          manaValue: 5,
          typeLine: 'Creature — Test',
        },
        heuristicCutPressure: 10,
        strategyAffinity: protectedAristocratsEvidence,
      },
      {
        card: { name: 'Safe Filler', roles: [], manaValue: 4, typeLine: 'Creature — Test' },
        heuristicCutPressure: 1,
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
      },
    ],
    metrics,
    targets,
    4,
    { rejectMeaningfulStrategyLoss: true, maxPairs: 1 },
  );

  assert.equal(pairings.length, 1);
  assert.equal((pairings[0]?.add.card as { name: string }).name, 'Requested Interaction');
  assert.equal((pairings[0]?.cut.card as { name: string }).name, 'Safe Filler');
  assert.equal(pairings[0]?.strategyPreservation.verdict, 'preserved');
});
