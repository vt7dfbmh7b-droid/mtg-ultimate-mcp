import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

const metrics = {
  averageNonlandManaValue: 3,
  nonlandCount: 60,
  rampCount: 10,
  drawCount: 10,
  interactionCount: 9,
  protectionCount: 1,
  tutorCount: 3,
  recursionCount: 3,
  boardWipeCount: 2,
  earlyPlayCount: 13,
  cheapInteractionCount: 2,
  fastManaCount: 1,
  roleCounts: {},
  persistentColoredManaSourceCount: 4,
  commanderColorCount: 3,
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

function protection(name: string, componentIds: string[], affinity = 0) {
  return {
    role: 'protection' as const,
    candidate: {
      card: {
        name,
        manaValue: 2,
        typeLine: 'Instant',
        oracleText: 'Permanents you control gain hexproof until end of turn.',
        roles: ['protection'],
      },
      authoritativeTargetGate: 'protection',
      explicitTheme: {
        matchesControlledTheme: componentIds.length > 0,
        matchedComponentIds: componentIds,
        requestedRelationshipAffinity: affinity,
      },
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    },
  };
}

const requestedMechanism = {
  card: {
    name: 'Anonymous Requested Multiplier',
    manaValue: 3,
    typeLine: 'Creature — Investigator',
    oracleText: 'Whenever you create one or more artifact tokens for the first time each turn, create an additional artifact token.',
    roles: ['token production'],
  },
  heuristicCutPressure: 12,
  explicitTheme: {
    matchesControlledTheme: true,
    matchedComponentIds: ['theme:artifacts', 'theme:tokens'],
    requestedRelationshipAffinity: 8,
  },
  strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
};

const filler = {
  card: {
    name: 'Anonymous Replaceable Filler',
    manaValue: 4,
    typeLine: 'Creature — Test',
    oracleText: '',
    roles: [],
  },
  heuristicCutPressure: 5,
  explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [], requestedRelationshipAffinity: 0 },
  strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
};

test('production pairing preserves a high-affinity requested mechanism over filler when generic protection only shares broad component membership', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [protection('Anonymous Broad Protection', ['theme:artifacts'], 1)] as any,
    [requestedMechanism, filler] as any,
    metrics,
    targets,
    3,
    { maxPairs: 1 } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.add.card as { name?: string } | undefined)?.name, 'Anonymous Broad Protection');
  assert.equal(
    (pairs[0]?.cut.card as { name?: string } | undefined)?.name,
    'Anonymous Replaceable Filler',
    'broad component overlap should not outweigh substantially stronger requested-mechanism importance when a safer filler cut exists',
  );
});

test('production pairing retains structural fallback when a requested mechanism is the only available cut', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [protection('Anonymous Mechanism-Aligned Protection', ['theme:artifacts', 'theme:tokens'], 8)] as any,
    [requestedMechanism] as any,
    metrics,
    targets,
    3,
    { maxPairs: 1 } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.add.card as { name?: string } | undefined)?.name, 'Anonymous Mechanism-Aligned Protection');
  assert.equal(
    (pairs[0]?.cut.card as { name?: string } | undefined)?.name,
    'Anonymous Requested Multiplier',
    'advisory preservation must not freeze construction when no safer cut exists',
  );
});
