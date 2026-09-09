import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

const metrics = {
  averageNonlandManaValue: 3,
  nonlandCount: 60,
  rampCount: 10,
  drawCount: 10,
  interactionCount: 8,
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

function addition(name: string, oracleText: string) {
  return {
    role: 'interaction' as const,
    candidate: {
      card: {
        name,
        manaValue: 2,
        typeLine: oracleText.includes('equipped creature') ? 'Artifact — Equipment' : 'Enchantment',
        oracleText,
        roles: ['spot interaction', 'repeatable draw'],
      },
      authoritativeTargetGate: 'interaction',
      explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [] },
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    },
  };
}

const persistentEngine = {
  card: {
    name: 'Anonymous Persistent Study',
    manaValue: 6,
    typeLine: 'Enchantment',
    oracleText: 'At the beginning of your upkeep, draw two cards.',
    roles: ['repeatable draw'],
  },
  heuristicCutPressure: 12,
  explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [] },
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
  heuristicCutPressure: 4,
  explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [] },
  strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
};

test('production pairing does not treat setup-heavy broad-role overlap as full compensation for a persistent engine', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [addition(
      'Anonymous Combat Study',
      'Whenever equipped creature deals combat damage to a player, draw a card. Exile target nonland permanent.',
    )] as any,
    [persistentEngine, filler] as any,
    metrics,
    targets,
    3,
    {
      maxPairs: 1,
      contextualDeckCards: [
        { name: 'Ordinary Creature', typeLine: 'Creature — Test', oracleText: '', roles: [] },
        { name: 'Basic Island', typeLine: 'Basic Land — Island', oracleText: '', roles: [] },
      ],
    } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.add.card as { name?: string } | undefined)?.name, 'Anonymous Combat Study');
  assert.equal(
    (pairs[0]?.cut.card as { name?: string } | undefined)?.name,
    'Anonymous Replaceable Filler',
    'setup-heavy repeatable draw should not fully compensate a direct recurring engine when a safer cut exists',
  );
});

test('production pairing still permits a direct same-mechanism engine to replace an expensive direct engine', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [addition(
      'Anonymous Efficient Study',
      'At the beginning of your upkeep, draw two cards. Exile target nonland permanent.',
    )] as any,
    [persistentEngine, filler] as any,
    metrics,
    targets,
    3,
    { maxPairs: 1 } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.add.card as { name?: string } | undefined)?.name, 'Anonymous Efficient Study');
  assert.equal(
    (pairs[0]?.cut.card as { name?: string } | undefined)?.name,
    'Anonymous Persistent Study',
    'direct same-mechanism compensation should remain eligible',
  );
});
