import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

const metrics = {
  averageNonlandManaValue: 3,
  nonlandCount: 60,
  rampCount: 10,
  drawCount: 10,
  interactionCount: 10,
  protectionCount: 0,
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
  protection: 2,
  tutors: 3,
  recursion: 3,
  boardWipes: 2,
  earlyPlays: 13,
};

function protection(name: string, oracleText: string) {
  return {
    role: 'protection' as const,
    candidate: {
      card: {
        name,
        manaValue: 2,
        typeLine: oracleText.startsWith('Permanents ') ? 'Instant' : 'Creature — Advisor',
        oracleText,
        roles: ['protection'],
      },
      authoritativeTargetGate: 'protection',
      explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [] },
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    },
  };
}

const cut = {
  card: {
    name: 'Replaceable Filler',
    manaValue: 4,
    typeLine: 'Creature — Test',
    oracleText: '',
    roles: [],
  },
  heuristicCutPressure: 10,
  explicitTheme: { matchesControlledTheme: false, matchedComponentIds: [] },
  strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
};

test('production pairing prefers protection that can cover the deck strategic permanents over a nominal role that protects an absent card class', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [
      protection('Narrow Class Guardian', 'Other artifacts you control have hexproof.'),
      protection('Broad Defensive Response', 'Permanents you control gain hexproof and indestructible until end of turn.'),
    ] as any,
    [cut] as any,
    metrics,
    targets,
    3,
    {
      maxPairs: 1,
      contextualDeckCards: [
        {
          name: 'Requested Engine',
          typeLine: 'Enchantment',
          oracleText: 'Whenever you draw your second card each turn, create a token.',
          roles: ['draw payoff'],
        },
        {
          name: 'Commander-Support Creature',
          typeLine: 'Creature — Detective',
          oracleText: 'Whenever you sacrifice a token, draw a card.',
          roles: ['card draw'],
        },
        {
          name: 'Basic Land',
          typeLine: 'Basic Land — Island',
          oracleText: '',
          roles: [],
        },
      ],
    } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal(
    (pairs[0]?.add.card as { name?: string } | undefined)?.name,
    'Broad Defensive Response',
  );
});
