import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { pairUpgradeSwapsByStructureV15 } from './deck-builder-v07.js';
import { replacementIdentityPriorityV15 } from './replacement-identity-priority-v15.js';
import { upgradeRequestedIdentityAffinityV15 } from './upgrade.js';

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

function scryfallCard(name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/\s+/g, '-'),
    oracle_id: `oracle-${name.toLocaleLowerCase().replace(/\s+/g, '-')}`,
    name,
    lang: 'en',
    cmc: 3,
    type_line: 'Enchantment — Aura',
    oracle_text: '',
    color_identity: ['G'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'uncommon',
    prices: {},
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
    ...overrides,
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

test('actual Upgrade pairing preserves stronger requested relationship affinity when component IDs tie', () => {
  const incoming = {
    ...interactionAdd,
    explicitTheme: {
      matchesControlledTheme: true,
      matchedComponentIds: ['requested-value', 'relation:value-engine'],
      requestedRelationshipAffinity: 4,
    },
  };
  const strongEngineCut = {
    ...summarized('Strong Requested Engine'),
    explicitTheme: {
      matchesControlledTheme: true,
      matchedComponentIds: ['requested-value', 'relation:value-engine'],
      requestedRelationshipAffinity: 8,
    },
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    heuristicCutPressure: 10,
  };
  const incidentalRelationshipCut = {
    ...summarized('Incidental Requested Relationship'),
    explicitTheme: {
      matchesControlledTheme: true,
      matchedComponentIds: ['requested-value', 'relation:value-engine'],
      requestedRelationshipAffinity: 1,
    },
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
    heuristicCutPressure: 8,
  };

  const pairings = pairUpgradeSwapsByStructureV15(
    [{ candidate: incoming, role: 'interaction' }],
    [strongEngineCut, incidentalRelationshipCut],
    metrics,
    targets,
    3,
    { rejectMeaningfulStrategyLoss: true, maxPairs: 1 },
  );

  assert.equal(pairings.length, 1);
  assert.equal(
    (pairings[0]?.cut.card as { name?: string } | undefined)?.name,
    'Incidental Requested Relationship',
  );
});

test('commander-compatible Aura target shape propagates through requested identity into replacement priority', () => {
  const commander = scryfallCard('Generic Enchanted-Creature Commander', {
    type_line: 'Legendary Creature — Human',
    oracle_text: 'Whenever a creature you control becomes enchanted, draw a card.',
  });
  const creatureAura = scryfallCard('Creature-Support Aura', {
    oracle_text: 'Enchant creature\nEnchanted creature gets +2/+2.',
  });
  const compatibleCreatureAura = scryfallCard('Second Creature-Support Aura', {
    oracle_text: 'Enchant creature you control\nEnchanted creature has vigilance.',
  });
  const artifactAura = scryfallCard('Artifact-Only Aura', {
    oracle_text: 'Enchant artifact\nEnchanted artifact loses all abilities.',
  });
  const components = [
    { id: 'enchantments', queryClause: 't:enchantment', currentMainMatches: 18, requiredMainMatches: 12 },
    { id: 'auras', queryClause: 't:aura', currentMainMatches: 11, requiredMainMatches: 8 },
  ];
  const broadIds = ['enchantments', 'auras'];
  const creatureIdentity = upgradeRequestedIdentityAffinityV15(creatureAura, [commander], components, broadIds);
  const compatibleIdentity = upgradeRequestedIdentityAffinityV15(compatibleCreatureAura, [commander], components, broadIds);
  const artifactIdentity = upgradeRequestedIdentityAffinityV15(artifactAura, [commander], components, broadIds);

  assert.ok(creatureIdentity.matchedComponentIds.includes('relation:aura-enchant-creature'));
  assert.ok(compatibleIdentity.matchedComponentIds.includes('relation:aura-enchant-creature'));
  assert.ok(!artifactIdentity.matchedComponentIds.includes('relation:aura-enchant-creature'));

  const incompatibleSwap = replacementIdentityPriorityV15(
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: artifactIdentity.matchedComponentIds,
      requestedRelationshipAffinity: artifactIdentity.requestedRelationshipAffinity,
    },
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: creatureIdentity.matchedComponentIds,
      requestedRelationshipAffinity: creatureIdentity.requestedRelationshipAffinity,
    },
  );
  const compatibleSwap = replacementIdentityPriorityV15(
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: compatibleIdentity.matchedComponentIds,
      requestedRelationshipAffinity: compatibleIdentity.requestedRelationshipAffinity,
    },
    {
      matchesControlledTheme: true,
      matchedRequestedComponentIds: creatureIdentity.matchedComponentIds,
      requestedRelationshipAffinity: creatureIdentity.requestedRelationshipAffinity,
    },
  );

  assert.equal(incompatibleSwap.requestedRelationshipLossCount, 1);
  assert.equal(compatibleSwap.requestedRelationshipLossCount, 0);
});

test('commander-compatible Aura target shape remains advisory under a hard structural fallback', () => {
  const onlyEligibleCut = {
    ...summarized('Only Eligible Creature Aura'),
    explicitTheme: {
      matchesControlledTheme: true,
      matchedComponentIds: ['requested-aura', 'relation:aura-specialization', 'relation:aura-enchant-creature'],
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
  assert.equal((pairings[0]?.cut.card as { name?: string } | undefined)?.name, 'Only Eligible Creature Aura');
});
