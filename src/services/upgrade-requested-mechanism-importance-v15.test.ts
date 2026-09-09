import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';
import { requestedComponentRelationshipAffinityV15 } from './requested-component-relationship-v15.js';

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

test('production pairing receives artifact-resource importance from an anonymous persistent improvise engine before choosing a safer filler cut', () => {
  const artifactComponent = {
    id: 'theme:artifacts',
    label: 'artifact',
    queryClause: 't:artifact',
  };
  const improviseEngineCard = {
    name: 'Anonymous Artifact Resource Engine',
    cmc: 3,
    type_line: 'Artifact',
    oracle_text: 'Nonartifact spells you cast have improvise.',
  };
  const relationship = requestedComponentRelationshipAffinityV15(improviseEngineCard as any, [], [artifactComponent]);

  assert.ok(
    relationship.score >= 5,
    'a persistent effect that lets requested artifacts pay for spells must carry meaningful artifact-resource relationship evidence',
  );

  const improviseEngine = {
    card: {
      name: improviseEngineCard.name,
      manaValue: improviseEngineCard.cmc,
      typeLine: improviseEngineCard.type_line,
      oracleText: improviseEngineCard.oracle_text,
      roles: ['ramp'],
    },
    heuristicCutPressure: 12,
    explicitTheme: {
      matchesControlledTheme: true,
      matchedComponentIds: ['theme:artifacts'],
      requestedRelationshipAffinity: relationship.score,
    },
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
  };

  const pairs = pairUpgradeSwapsByStructureV15(
    [protection('Anonymous Broad Protection', ['theme:artifacts'], 1)] as any,
    [improviseEngine, filler] as any,
    metrics,
    targets,
    3,
    { maxPairs: 1 } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal(
    (pairs[0]?.cut.card as { name?: string } | undefined)?.name,
    'Anonymous Replaceable Filler',
    'once upstream artifact-resource evidence exists, the production pairer should preserve the improvise engine when safer filler exists',
  );
});