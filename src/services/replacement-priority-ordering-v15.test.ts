import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

function summarized(name: string, roles: string[] = []) {
  return {
    card: {
      name,
      manaValue: 3,
      typeLine: 'Enchantment',
      roles,
    },
  };
}

function strategyAffinity(archetype: string, overlapScore: number) {
  return {
    score: overlapScore,
    protectionApplied: 0,
    matchedStrategies: [archetype],
    matches: [{ archetype, overlapScore, commanderScore: 6 }],
  };
}

const metrics = {
  averageNonlandManaValue: 3,
  nonlandCount: 60,
  rampCount: 10,
  drawCount: 10,
  interactionCount: 9,
  protectionCount: 4,
  tutorCount: 3,
  recursionCount: 3,
  boardWipeCount: 2,
  earlyPlayCount: 13,
  cheapInteractionCount: 2,
  fastManaCount: 1,
  roleCounts: {},
  persistentColoredManaSourceCount: 4,
  commanderColorCount: 2,
};

const targets = {
  ramp: 10,
  draw: 10,
  interaction: 10,
  freeInteraction: 0,
  protection: 4,
  tutors: 3,
  recursion: 3,
  boardWipes: 2,
  earlyPlays: 13,
};

const interactionAdd = {
  ...summarized('Generic Interaction Upgrade', ['spot interaction', 'cheap interaction']),
  authoritativeTargetGate: null,
  explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [] },
};

test('actual Upgrade pairing preserves a typed requested mechanism ahead of weaker quantitative legacy affinity', () => {
  const relationshipBearingCut = {
    ...summarized('Requested Mechanism Engine'),
    explicitTheme: {
      matchesControlledTheme: true,
      matchedComponentIds: ['requested-typal', 'relation:typal-engine'],
    },
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    heuristicCutPressure: 10,
  };
  const weakLegacyAffinityCut = {
    ...summarized('Broad Legacy Value Card'),
    explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [] },
    strategyAffinity: strategyAffinity('value-engine', 1),
    heuristicCutPressure: 1,
  };

  const pairings = pairUpgradeSwapsByStructureV15(
    [{ candidate: interactionAdd, role: 'interaction' }],
    [relationshipBearingCut, weakLegacyAffinityCut],
    metrics,
    targets,
    3,
    { rejectMeaningfulStrategyLoss: true, maxPairs: 1 },
  );

  assert.equal(pairings.length, 1);
  assert.equal((pairings[0]?.cut.card as { name?: string } | undefined)?.name, 'Broad Legacy Value Card');
});

test('typed requested mechanisms remain advisory when no better hard-valid cut exists', () => {
  const onlyEligibleCut = {
    ...summarized('Only Eligible Requested Mechanism'),
    explicitTheme: {
      matchesControlledTheme: true,
      matchedComponentIds: ['requested-aura', 'relation:aura-specialization'],
    },
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    heuristicCutPressure: 1,
  };

  const pairings = pairUpgradeSwapsByStructureV15(
    [{ candidate: interactionAdd, role: 'interaction' }],
    [onlyEligibleCut],
    metrics,
    targets,
    3,
    { rejectMeaningfulStrategyLoss: true, maxPairs: 1 },
  );

  assert.equal(pairings.length, 1);
  assert.equal((pairings[0]?.cut.card as { name?: string } | undefined)?.name, 'Only Eligible Requested Mechanism');
});
