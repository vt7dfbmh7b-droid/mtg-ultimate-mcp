import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

const metrics = {
  averageNonlandManaValue: 3,
  nonlandCount: 60,
  rampCount: 10,
  drawCount: 10,
  interactionCount: 8,
  protectionCount: 0,
  tutorCount: 3,
  recursionCount: 3,
  boardWipeCount: 2,
  earlyPlayCount: 13,
  cheapInteractionCount: 1,
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
  protection: 2,
  tutors: 3,
  recursion: 3,
  boardWipes: 2,
  earlyPlays: 13,
};

function selection(
  role: 'protection' | 'interaction',
  name: string,
  manaValue: number,
  roles: string[],
  options: {
    matchedComponentIds?: string[];
    requestedRelationshipAffinity?: number;
    authoritativeTargetGate?: string;
  } = {},
) {
  return {
    role,
    candidate: {
      card: {
        name,
        manaValue,
        typeLine: 'Instant',
        oracleText: role === 'protection'
          ? 'Permanents you control gain hexproof until end of turn.'
          : 'Exile target nonland permanent.',
        roles,
      },
      ...(options.authoritativeTargetGate ? { authoritativeTargetGate: options.authoritativeTargetGate } : {}),
      explicitTheme: {
        matchesControlledTheme: (options.matchedComponentIds?.length ?? 0) > 0,
        matchedComponentIds: options.matchedComponentIds ?? [],
        requestedRelationshipAffinity: options.requestedRelationshipAffinity ?? 0,
      },
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    },
  };
}

function cut(
  name: string,
  options: {
    matchedComponentIds?: string[];
    requestedRelationshipAffinity?: number;
    heuristicCutPressure?: number;
  } = {},
) {
  return {
    card: {
      name,
      manaValue: 4,
      typeLine: 'Creature — Test',
      oracleText: '',
      roles: [],
    },
    heuristicCutPressure: options.heuristicCutPressure ?? 10,
    explicitTheme: {
      matchesControlledTheme: (options.matchedComponentIds?.length ?? 0) > 0,
      matchedComponentIds: options.matchedComponentIds ?? [],
      requestedRelationshipAffinity: options.requestedRelationshipAffinity ?? 0,
    },
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
  };
}

test('production pairing reserves a strongly requested engine/payoff cut for a replacement that compensates the same relationship', () => {
  const relationshipId = 'relation:engine-payoff:test';
  const pairs = pairUpgradeSwapsByStructureV15(
    [
      selection('protection', 'Generic Structural Protection', 2, ['protection'], {
        authoritativeTargetGate: 'protection',
      }),
      selection('protection', 'Relationship-Preserving Protection', 2, ['protection'], {
        matchedComponentIds: [relationshipId],
        requestedRelationshipAffinity: 5,
        authoritativeTargetGate: 'protection',
      }),
    ] as any,
    [cut('Requested Engine Piece', {
      matchedComponentIds: [relationshipId],
      requestedRelationshipAffinity: 5,
    })] as any,
    metrics,
    targets,
    3,
    { maxPairs: 1 } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.add.card as { name?: string } | undefined)?.name, 'Relationship-Preserving Protection');
  assert.equal((pairs[0]?.cut.card as { name?: string } | undefined)?.name, 'Requested Engine Piece');
});

test('production pairing improves the weakest requested theme component instead of spending the slot on an already dense component', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [
      selection('protection', 'Already-Dense Theme Support', 2, ['protection'], {
        matchedComponentIds: ['theme:component-a'],
        authoritativeTargetGate: 'protection',
      }),
      selection('protection', 'Underrepresented Theme Support', 2, ['protection'], {
        matchedComponentIds: ['theme:component-b'],
        authoritativeTargetGate: 'protection',
      }),
    ] as any,
    [cut('Replaceable Non-Theme Filler')] as any,
    metrics,
    targets,
    3,
    {
      maxPairs: 1,
      contextualComponentCounts: {
        'theme:component-a': 6,
        'theme:component-b': 1,
      },
    } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.add.card as { name?: string } | undefined)?.name, 'Underrepresented Theme Support');
});

test('production pairing prioritizes the cheaper practical interaction when both candidates satisfy the same cheap-interaction pressure', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [
      selection('interaction', 'Two-Mana Answer', 2, ['spot interaction', 'cheap interaction'], {
        authoritativeTargetGate: 'cheap-interaction',
      }),
      selection('interaction', 'One-Mana Answer', 1, ['spot interaction', 'cheap interaction'], {
        authoritativeTargetGate: 'cheap-interaction',
      }),
    ] as any,
    [cut('Replaceable Four-Drop')] as any,
    metrics,
    targets,
    4,
    { maxPairs: 1 } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.add.card as { name?: string } | undefined)?.name, 'One-Mana Answer');
});
