import assert from 'node:assert/strict';
import test from 'node:test';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';

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

function add(name: string, oracleText: string, explicitTheme: Record<string, unknown> = {}) {
  return {
    role: 'interaction' as const,
    candidate: {
      card: {
        name,
        manaValue: 2,
        typeLine: oracleText.startsWith('Enchant ') ? 'Enchantment — Aura' : 'Instant',
        oracleText,
        roles: ['spot interaction', 'cheap interaction'],
      },
      explicitTheme: {
        matchesControlledTheme: false,
        matchedComponentIds: [],
        ...explicitTheme,
      },
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    },
  };
}

function cut(name: string, pressure = 5, explicitTheme: Record<string, unknown> = {}) {
  return {
    card: { name, manaValue: 4, typeLine: 'Creature — Test', oracleText: '', roles: [] },
    heuristicCutPressure: pressure,
    explicitTheme: {
      matchesControlledTheme: false,
      matchedComponentIds: [],
      ...explicitTheme,
    },
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
  };
}

test('production pairing does not spend a swap on a self-target Aura whose required permanent shape is absent from deck context', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [
      add('Context-Bound Removal', 'Enchant snow land you control\nWhen this Aura enters, exile target creature.'),
      add('Independent Removal', 'Exile target creature.'),
    ] as any,
    [cut('Replaceable Filler')],
    metrics,
    targets,
    3,
    {
      maxPairs: 1,
      contextualDeckCards: [
        { name: 'Ordinary Plains', typeLine: 'Basic Land — Plains', oracleText: '', roles: [] },
        { name: 'Utility Creature', typeLine: 'Creature — Test', oracleText: '', roles: [] },
      ],
    } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.add.card as { name?: string } | undefined)?.name, 'Independent Removal');
});

test('the same self-target Aura remains eligible when its required permanent shape exists', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [
      add('Context-Bound Removal', 'Enchant snow land you control\nWhen this Aura enters, exile target creature.'),
      add('Independent Removal', 'Exile target creature.'),
    ] as any,
    [cut('Replaceable Filler')],
    metrics,
    targets,
    3,
    {
      maxPairs: 1,
      contextualDeckCards: [
        { name: 'Configured Land', typeLine: 'Basic Snow Land — Plains', oracleText: '', roles: [] },
        { name: 'Utility Creature', typeLine: 'Creature — Test', oracleText: '', roles: [] },
      ],
    } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.add.card as { name?: string } | undefined)?.name, 'Context-Bound Removal');
});

test('target pressure cannot consume the deck last typed engine when the incoming package does not replace that mechanism', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [
      add('First Generic Interaction', 'Exile target creature.'),
      add('Second Generic Interaction', 'Counter target spell.'),
    ] as any,
    [
      cut('Neutral Filler', 8),
      cut('Requested Mechanism Engine', 12, {
        matchesControlledTheme: true,
        matchedComponentIds: ['requested-typal', 'relation:typal-engine'],
        requestedRelationshipAffinity: 8,
      }),
    ],
    { ...metrics, interactionCount: 8 },
    targets,
    3,
    {
      maxPairs: 2,
      contextualRelationshipCounts: { 'relation:typal-engine': 1 },
    } as any,
  );

  assert.equal(pairs.length, 1);
  assert.equal((pairs[0]?.cut.card as { name?: string } | undefined)?.name, 'Neutral Filler');
});

test('a typed engine may be replaced when the incoming card preserves the same mechanism', () => {
  const pairs = pairUpgradeSwapsByStructureV15(
    [
      add('First Generic Interaction', 'Exile target creature.'),
      add('Mechanism-Preserving Interaction', 'Counter target spell.', {
        matchesControlledTheme: true,
        matchedComponentIds: ['requested-typal', 'relation:typal-engine'],
        requestedRelationshipAffinity: 8,
      }),
    ] as any,
    [
      cut('Neutral Filler', 8),
      cut('Requested Mechanism Engine', 12, {
        matchesControlledTheme: true,
        matchedComponentIds: ['requested-typal', 'relation:typal-engine'],
        requestedRelationshipAffinity: 8,
      }),
    ],
    { ...metrics, interactionCount: 8 },
    targets,
    3,
    {
      maxPairs: 2,
      contextualRelationshipCounts: { 'relation:typal-engine': 1 },
    } as any,
  );

  assert.equal(pairs.length, 2);
  assert.ok(pairs.some((pair) => (pair.cut.card as { name?: string } | undefined)?.name === 'Requested Mechanism Engine'));
});
