import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

const metrics = {
  averageNonlandManaValue: 3,
  nonlandCount: 60,
  rampCount: 12,
  drawCount: 12,
  interactionCount: 14,
  protectionCount: 6,
  tutorCount: 1,
  recursionCount: 3,
  boardWipeCount: 2,
  earlyPlayCount: 25,
  cheapInteractionCount: 6,
  fastManaCount: 2,
  roleCounts: {},
  persistentColoredManaSourceCount: 4,
  commanderColorCount: 2,
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

test('authoritative target pressure does not consume a high-affinity requested engine when the incoming card does not replace its mechanism', () => {
  const incomingTutor = {
    role: 'tutor' as const,
    candidate: {
      card: {
        name: 'Generic Search Upgrade',
        manaValue: 2,
        typeLine: 'Instant',
        oracleText: 'Search your library for a card, put it into your hand, then shuffle.',
        roles: ['tutor'],
      },
      authoritativeTargetGate: 'tutors',
      explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [] },
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    },
  };
  const existingTutor = {
    card: {
      name: 'Replaceable Existing Search',
      manaValue: 4,
      typeLine: 'Sorcery',
      oracleText: 'Search your library for a card, put it into your hand, then shuffle.',
      roles: ['tutor'],
    },
    heuristicCutPressure: 12,
    explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [] },
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
  };
  const requestedEngine = {
    card: {
      name: 'Requested Synergy Engine',
      manaValue: 4,
      typeLine: 'Enchantment',
      oracleText: 'Whenever you cast a spell of the chosen type, copy that spell.',
      roles: [],
    },
    heuristicCutPressure: 9,
    explicitTheme: {
      matchesControlledTheme: true,
      matchedComponentIds: ['requested-typal', 'relation:typal-engine'],
      requestedRelationshipAffinity: 8,
    },
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
  };

  const pairs = pairUpgradeSwapsByStructureV15(
    [incomingTutor] as any,
    [existingTutor, requestedEngine] as any,
    metrics,
    targets,
    4,
    {
      maxPairs: 1,
      contextualRelationshipCounts: { 'relation:typal-engine': 4 },
    } as any,
  );

  assert.equal(pairs.length, 0);
});
