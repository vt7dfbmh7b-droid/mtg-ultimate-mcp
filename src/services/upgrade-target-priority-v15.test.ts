import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  auditUpgradeStrategyPreservationV15,
  pairUpgradeSwapsByStructureV15,
} from './deck-builder-v07.js';
import { candidateStrategyPreservationGateV15 } from './optimizer-v12.js';
import {
  restrictedUpgradeCandidatesForRoleV15,
  selectUpgradeCutCandidatesV15,
  upgradeCandidatePrioritiesV15,
  type UpgradeCandidateMetricsV15,
  type UpgradeStructuralTargetsV15,
} from './upgrade.js';

const marvelMetrics: UpgradeCandidateMetricsV15 = {
  rampCount: 31,
  drawCount: 22,
  interactionCount: 18,
  protectionCount: 13,
  tutorCount: 8,
  recursionCount: 4,
  boardWipeCount: 2,
  earlyPlayCount: 41,
  cheapInteractionCount: 8,
  fastManaCount: 3,
  averageNonlandManaValue: 2.71,
  roleCounts: { 'free interaction': 1 },
};

const bracketFiveTargets: UpgradeStructuralTargetsV15 = {
  ramp: 14,
  draw: 14,
  interaction: 18,
  freeInteraction: 1,
  protection: 8,
  tutors: 10,
  recursion: 4,
  boardWipes: 2,
  earlyPlays: 20,
};

function card(name: string, cmc: number, typeLine = 'Creature — Test'): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${name}-oracle`,
    lang: 'en',
    name,
    set: 'tst',
    set_name: 'Target Priority Test',
    collector_number: String(cmc + 1),
    released_at: '2026-01-01',
    type_line: typeLine,
    oracle_text: 'Test text.',
    mana_cost: cmc === 0 ? '{0}' : `{${cmc}}`,
    cmc,
    colors: [],
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'common',
    prices: { usd: '1.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: `https://scryfall.com/card/tst/${encodeURIComponent(name)}`,
  } as ScryfallCard;
}

test('Bracket-5 candidate generation puts the failed real curve gate ahead of tutor ten', () => {
  const priorities = upgradeCandidatePrioritiesV15(marvelMetrics, bracketFiveTargets, 5);

  assert.equal(priorities[0]?.role, 'average-nonland-mv');
  assert.equal(priorities[0]?.prioritySource, 'authoritative-target-gate');
  assert.equal(priorities[0]?.targetGate, 'average-nonland-mv');
  assert.equal(priorities[1]?.role, 'tutor');
  assert.equal(priorities[1]?.prioritySource, 'aspirational-role-target');
  assert.equal(priorities[1]?.current, 8);
  assert.equal(priorities[1]?.target, 10);
});

test('lower-bracket candidate generation does not inherit the Bracket-5 curve lane', () => {
  const priorities = upgradeCandidatePrioritiesV15(marvelMetrics, {
    ...bracketFiveTargets,
    tutors: 6,
    freeInteraction: 0,
  }, 4);

  assert.equal(priorities.some((priority) => priority.prioritySource === 'authoritative-target-gate'), false);
  assert.equal(priorities.some((priority) => priority.role === 'average-nonland-mv'), false);
});

test('Bracket-4 candidate generation exposes actual failed construction gates before aspirational role targets', () => {
  const priorities = upgradeCandidatePrioritiesV15({
    ...marvelMetrics,
    averageNonlandManaValue: 3.5,
    earlyPlayCount: 18,
    cheapInteractionCount: 2,
    fastManaCount: 0,
    tutorCount: 0,
  }, {
    ...bracketFiveTargets,
    ramp: 12,
    draw: 12,
    interaction: 14,
    freeInteraction: 0,
    protection: 6,
    tutors: 6,
    recursion: 3,
    earlyPlays: 16,
  }, 4);

  assert.deepEqual(
    priorities.filter((priority) => priority.prioritySource === 'authoritative-target-gate').map((priority) => priority.targetGate),
    ['average-nonland-mv', 'early-plays', 'cheap-interaction', 'fast-mana', 'tutors'],
  );
  assert.equal(priorities.find((priority) => priority.role === 'tutor')?.target, 2);
  assert.equal(priorities.find((priority) => priority.role === 'tutor')?.prioritySource, 'authoritative-target-gate');
  assert.equal(priorities.some((priority) => priority.role === 'tutor' && priority.target === 6), false);
});

test('restricted curve discovery admits only legal nonland additions at mana value two or less', () => {
  const low = card('Low Curve Candidate', 2);
  const expensive = card('Expensive Candidate', 3);
  const land = card('Low Curve Land', 0, 'Land');

  const candidates = restrictedUpgradeCandidatesForRoleV15(
    [expensive, land, low],
    'average-nonland-mv',
  );

  assert.deepEqual(candidates.map((candidate) => candidate.name), ['Low Curve Candidate']);
});

test('curve-priority pairing chooses a positive mana-value reduction and records the gate provenance', () => {
  const pairings = pairUpgradeSwapsByStructureV15(
    [{
      role: 'average-nonland-mv' as const,
      candidate: { card: { name: 'One Drop', roles: [], manaValue: 1, typeLine: 'Creature — Test' } },
    }],
    [
      { card: { name: 'Two Drop', roles: [], manaValue: 2, typeLine: 'Creature — Test' }, heuristicCutPressure: 9 },
      { card: { name: 'Five Drop', roles: [], manaValue: 5, typeLine: 'Creature — Test' }, heuristicCutPressure: 4 },
    ],
    {
      rampCount: 14,
      drawCount: 14,
      interactionCount: 18,
      protectionCount: 8,
      tutorCount: 8,
      earlyPlayCount: 41,
      roleCounts: { 'free interaction': 1 },
    },
    { ...bracketFiveTargets },
  );

  assert.equal((pairings[0]?.cut.card as Record<string, unknown> | undefined)?.name, 'Five Drop');
  assert.equal(pairings[0]?.authoritativeTargetGate, 'average-nonland-mv');
  assert.equal(pairings[0]?.nonlandManaValueReduction, 4);
});

test('curve repair can inspect non-positive-pressure cuts only when the real curve gate is active', () => {
  const candidates = [
    { card: { name: 'Positive Cut' }, heuristicCutPressure: 2 },
    { card: { name: 'Neutral Cut' }, heuristicCutPressure: 0 },
    { card: { name: 'Protected Cut' }, heuristicCutPressure: -2 },
  ];

  assert.deepEqual(
    selectUpgradeCutCandidatesV15(candidates, false).map((candidate) => (candidate.card as { name: string }).name),
    ['Positive Cut'],
  );
  assert.deepEqual(
    selectUpgradeCutCandidatesV15(candidates, true).map((candidate) => (candidate.card as { name: string }).name),
    ['Positive Cut', 'Neutral Cut', 'Protected Cut'],
  );
});

test('swap pairing preserves board-wipe and recursion minima before heuristic cut pressure', () => {
  for (const protectedRole of ['board wipe', 'graveyard recursion'] as const) {
    const pairings = pairUpgradeSwapsByStructureV15(
      [{
        role: 'protection' as const,
        candidate: {
          card: {
            name: `New Protection for ${protectedRole}`,
            roles: ['protection', 'spot interaction'],
            manaValue: 2,
            typeLine: 'Instant',
          },
          strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
        },
      }],
      [
        {
          card: { name: `Last Safe ${protectedRole}`, roles: [protectedRole], manaValue: 5, typeLine: 'Sorcery' },
          heuristicCutPressure: 20,
          strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
        },
        {
          card: { name: `Surplus Generic for ${protectedRole}`, roles: [], manaValue: 4, typeLine: 'Creature — Test' },
          heuristicCutPressure: 1,
          strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
        },
      ],
      {
        rampCount: 12,
        drawCount: 12,
        interactionCount: 14,
        protectionCount: 5,
        tutorCount: 6,
        recursionCount: 3,
        boardWipeCount: 2,
        earlyPlayCount: 16,
        roleCounts: { 'free interaction': 0 },
      },
      {
        ramp: 12,
        draw: 12,
        interaction: 14,
        freeInteraction: 0,
        protection: 6,
        tutors: 6,
        recursion: 3,
        boardWipes: 2,
        earlyPlays: 16,
      },
    );

    assert.equal(
      (pairings[0]?.cut.card as Record<string, unknown> | undefined)?.name,
      `Surplus Generic for ${protectedRole}`,
    );
    assert.equal(pairings[0]?.structuralDeficitAfterSwap, 0);
  }
});

test('swap pairing declines an apparent repair when every cut would create a new structural hole', () => {
  const pairings = pairUpgradeSwapsByStructureV15(
    [{
      role: 'protection' as const,
      candidate: {
        card: { name: 'New Protection', roles: ['protection'], manaValue: 2, typeLine: 'Instant' },
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
    }],
    [{
      card: { name: 'Last Recursion Spell', roles: ['graveyard recursion'], manaValue: 5, typeLine: 'Sorcery' },
      heuristicCutPressure: 20,
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
    }],
    {
      rampCount: 12,
      drawCount: 12,
      interactionCount: 14,
      protectionCount: 5,
      tutorCount: 6,
      recursionCount: 3,
      boardWipeCount: 2,
      earlyPlayCount: 16,
      roleCounts: { 'free interaction': 0 },
    },
    {
      ramp: 12,
      draw: 12,
      interaction: 14,
      freeInteraction: 0,
      protection: 6,
      tutors: 6,
      recursion: 3,
      boardWipes: 2,
      earlyPlays: 16,
    },
  );

  assert.deepEqual(pairings, []);
});

test('five-color curve repair cannot strip persistent colored mana below its floor', () => {
  const additions = Array.from({ length: 8 }, (_, index) => ({
    role: 'average-nonland-mv' as const,
    candidate: {
      card: { name: `One Drop ${index + 1}`, roles: ['card draw'], manaValue: 1, typeLine: 'Instant' },
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
    },
  }));
  const fixingCuts = Array.from({ length: 7 }, (_, index) => ({
    card: {
      name: `Five-Color Fixer ${index + 1}`,
      roles: ['mana acceleration', 'mana rock', 'persistent colored mana source'],
      manaValue: 2,
      typeLine: 'Artifact',
    },
    heuristicCutPressure: 20 - index,
    strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
  }));
  const pairings = pairUpgradeSwapsByStructureV15(
    additions,
    [
      ...fixingCuts,
      {
        card: { name: 'Surplus High-Curve Spell', roles: [], manaValue: 8, typeLine: 'Sorcery' },
        heuristicCutPressure: 1,
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
    ],
    {
      rampCount: 31,
      drawCount: 23,
      interactionCount: 18,
      protectionCount: 9,
      tutorCount: 8,
      recursionCount: 4,
      boardWipeCount: 3,
      earlyPlayCount: 39,
      averageNonlandManaValue: 2.81,
      nonlandCount: 69,
      persistentColoredManaSourceCount: 12,
      commanderColorCount: 5,
      roleCounts: { 'free interaction': 2 },
    },
    { ...bracketFiveTargets },
  );

  const fixingCutCount = pairings.filter((pairing) => (
    ((pairing.cut.card as Record<string, unknown>).roles as string[]).includes('persistent colored mana source')
  )).length;
  assert.equal(fixingCutCount, 4);
  assert.ok(pairings.every((pairing) => pairing.persistentColoredManaSourcesAfterSwap >= 8));
  assert.equal(pairings.at(-1)?.persistentColoredManaSourceFloor, 8);
});

test('near the curve threshold, pairing uses the smallest sufficient safe mana reduction', () => {
  const pairings = pairUpgradeSwapsByStructureV15(
    [{
      role: 'average-nonland-mv' as const,
      candidate: {
        card: { name: 'One Drop', roles: ['card draw'], manaValue: 1, typeLine: 'Artifact' },
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
    }],
    [
      {
        card: { name: 'Safe Two Drop', roles: ['mana acceleration'], manaValue: 2, typeLine: 'Artifact' },
        heuristicCutPressure: -2,
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
      {
        card: { name: 'Safe Five Drop', roles: [], manaValue: 5, typeLine: 'Creature — Test' },
        heuristicCutPressure: 4,
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
    ],
    {
      rampCount: 20,
      drawCount: 20,
      interactionCount: 18,
      protectionCount: 8,
      tutorCount: 8,
      earlyPlayCount: 41,
      averageNonlandManaValue: 2.61,
      nonlandCount: 69,
      roleCounts: { 'free interaction': 1 },
    },
    { ...bracketFiveTargets },
  );

  assert.equal((pairings[0]?.cut.card as Record<string, unknown> | undefined)?.name, 'Safe Two Drop');
  assert.equal(pairings[0]?.nonlandManaValueReduction, 1);
});

test('near-threshold five-color repair uses surplus interaction before a protected combat engine', () => {
  const pairings = pairUpgradeSwapsByStructureV15(
    [{
      role: 'average-nonland-mv' as const,
      candidate: {
        card: { name: 'One-Mana Selection', roles: ['card draw', 'card selection'], manaValue: 1, typeLine: 'Sorcery' },
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
    }],
    [
      {
        card: { name: 'Surplus Free Counter', roles: ['countermagic', 'free interaction'], manaValue: 4, typeLine: 'Instant' },
        heuristicCutPressure: 2,
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
      {
        card: { name: 'Protected Combat Engine', roles: ['token production', 'haste'], manaValue: 5, typeLine: 'Creature — Test' },
        heuristicCutPressure: 0,
        strategyAffinity: { score: 20, protectionApplied: 4, matchedStrategies: ['combat-tokens'] },
      },
    ],
    {
      rampCount: 24,
      drawCount: 25,
      interactionCount: 19,
      protectionCount: 9,
      tutorCount: 8,
      recursionCount: 5,
      boardWipeCount: 2,
      earlyPlayCount: 40,
      averageNonlandManaValue: 2.61,
      nonlandCount: 69,
      persistentColoredManaSourceCount: 8,
      commanderColorCount: 5,
      roleCounts: { 'free interaction': 2 },
    },
    { ...bracketFiveTargets },
  );

  assert.equal((pairings[0]?.cut.card as Record<string, unknown> | undefined)?.name, 'Surplus Free Counter');
  assert.equal(pairings[0]?.nonlandManaValueReduction, 3);
  assert.equal(pairings[0]?.strategyPreservation.verdict, 'preserved');
  assert.equal(pairings[0]?.persistentColoredManaSourcesAfterSwap, 8);
});

test('curve packages stop once cumulative safe reduction crosses the real threshold', () => {
  const additions = ['First One Drop', 'Second One Drop', 'Third One Drop'].map((name) => ({
    role: 'average-nonland-mv' as const,
    candidate: {
      card: {
        name,
        roles: name === 'First One Drop' ? ['card draw', 'spot interaction'] : ['card draw'],
        manaValue: 1,
        typeLine: 'Artifact',
      },
      strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
    },
  }));
  const pairings = pairUpgradeSwapsByStructureV15(
    additions,
    [
      {
        card: { name: 'Vanquish the Horde', roles: ['board wipe'], manaValue: 8, typeLine: 'Sorcery' },
        heuristicCutPressure: 10,
        strategyAffinity: { score: 4, protectionApplied: 0, matchedStrategies: ['big-mana'] },
      },
      {
        card: { name: 'Surplus Two-Mana Rock', roles: ['mana acceleration'], manaValue: 2, typeLine: 'Artifact' },
        heuristicCutPressure: 0,
        strategyAffinity: { score: 4, protectionApplied: 0, matchedStrategies: ['big-mana'] },
      },
      {
        card: { name: 'Lightning Greaves', roles: ['equipment', 'haste'], manaValue: 2, typeLine: 'Artifact — Equipment' },
        heuristicCutPressure: -2,
        strategyAffinity: { score: 2, protectionApplied: 2, matchedStrategies: ['combat-tokens'] },
      },
      {
        card: { name: 'Unneeded Four Drop', roles: [], manaValue: 4, typeLine: 'Creature — Test' },
        heuristicCutPressure: 1,
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
    ],
    {
      rampCount: 30,
      drawCount: 20,
      interactionCount: 18,
      protectionCount: 8,
      tutorCount: 10,
      recursionCount: 4,
      boardWipeCount: 3,
      earlyPlayCount: 41,
      averageNonlandManaValue: 2.71,
      nonlandCount: 69,
      roleCounts: { 'free interaction': 1 },
    },
    { ...bracketFiveTargets },
  );

  assert.equal(pairings.length, 2);
  assert.deepEqual(
    pairings.map((pairing) => (pairing.cut.card as Record<string, unknown>).name),
    ['Vanquish the Horde', 'Surplus Two-Mana Rock'],
  );
  assert.equal(pairings.reduce((total, pairing) => total + (pairing.nonlandManaValueReduction ?? 0), 0), 8);
});

test('Najeela curve repair preserves Aurelia-style combat strategy before maximizing mana reduction', () => {
  const pairings = pairUpgradeSwapsByStructureV15(
    [{
      role: 'average-nonland-mv' as const,
      candidate: {
        card: { name: 'One Drop', roles: [], manaValue: 1, typeLine: 'Creature — Test' },
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
    }],
    [
      {
        card: {
          name: 'Aurelia, the Warleader',
          roles: ['extra combat', 'untap engine', 'haste'],
          manaValue: 6,
          typeLine: 'Creature — Test',
        },
        heuristicCutPressure: 9,
        strategyAffinity: {
          score: 12,
          protectionApplied: 4,
          matchedStrategies: ['combat-tokens'],
        },
      },
      {
        card: { name: 'Safe Five Drop', roles: [], manaValue: 5, typeLine: 'Creature — Test' },
        heuristicCutPressure: 4,
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
    ],
    {
      rampCount: 14,
      drawCount: 14,
      interactionCount: 18,
      protectionCount: 8,
      tutorCount: 8,
      earlyPlayCount: 41,
      roleCounts: { 'free interaction': 1 },
    },
    { ...bracketFiveTargets },
  );

  assert.equal((pairings[0]?.cut.card as Record<string, unknown> | undefined)?.name, 'Safe Five Drop');
  assert.equal(pairings[0]?.nonlandManaValueReduction, 4);
  assert.equal(pairings[0]?.strategyPreservation.verdict, 'preserved');
  assert.deepEqual(pairings[0]?.strategyPreservation.locallyUnreplacedStrategies, []);
});

test('a weak secondary commander signal does not turn every matching curve cut into strategy loss', () => {
  const pairings = pairUpgradeSwapsByStructureV15(
    [{
      role: 'average-nonland-mv' as const,
      candidate: {
        card: { name: 'Skullclamp', roles: ['card draw', 'equipment'], manaValue: 1, typeLine: 'Artifact — Equipment' },
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [], matches: [] },
      },
    }],
    [
      {
        card: {
          name: 'Aurelia, the Warleader',
          roles: ['extra combat', 'haste', 'untap engine'],
          manaValue: 6,
          typeLine: 'Creature — Angel',
        },
        heuristicCutPressure: 9,
        strategyAffinity: {
          score: 24,
          protectionApplied: 4,
          matchedStrategies: ['big-mana', 'combat-tokens'],
          matches: [
            { archetype: 'combat-tokens', commanderScore: 20, cardScore: 20, overlapScore: 20 },
            { archetype: 'big-mana', commanderScore: 4, cardScore: 4, overlapScore: 4 },
          ],
        },
      },
      {
        card: {
          name: 'Vanquish the Horde',
          roles: ['board wipe', 'cost reduction'],
          manaValue: 8,
          typeLine: 'Sorcery',
        },
        heuristicCutPressure: 8,
        strategyAffinity: {
          score: 4,
          protectionApplied: 4,
          matchedStrategies: ['big-mana'],
          matches: [
            { archetype: 'big-mana', commanderScore: 4, cardScore: 8, overlapScore: 4 },
          ],
        },
      },
    ],
    {
      rampCount: 15,
      drawCount: 14,
      interactionCount: 19,
      protectionCount: 8,
      tutorCount: 8,
      recursionCount: 4,
      boardWipeCount: 3,
      earlyPlayCount: 41,
      roleCounts: { 'free interaction': 1 },
    },
    { ...bracketFiveTargets },
  );

  const audit = auditUpgradeStrategyPreservationV15(pairings);
  const gate = candidateStrategyPreservationGateV15({ strategyPreservation: audit });

  assert.equal((pairings[0]?.cut.card as Record<string, unknown> | undefined)?.name, 'Vanquish the Horde');
  assert.equal(pairings[0]?.nonlandManaValueReduction, 7);
  assert.equal(pairings[0]?.strategyPreservation.verdict, 'preserved');
  assert.equal(audit.status, 'preserved');
  assert.equal(gate.eligible, true);
});

test('an uncompensated fully protected commander-strategy cut is explicit and ineligible', () => {
  const pairings = pairUpgradeSwapsByStructureV15(
    [{
      role: 'average-nonland-mv' as const,
      candidate: {
        card: { name: 'One Drop', roles: ['card draw'], manaValue: 1, typeLine: 'Artifact' },
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
    }],
    [{
      card: {
        name: 'Extra Combat Engine',
        roles: ['extra combat', 'untap engine', 'haste'],
        manaValue: 6,
        typeLine: 'Creature — Test',
      },
      heuristicCutPressure: 9,
      strategyAffinity: {
        score: 12,
        protectionApplied: 4,
        matchedStrategies: ['combat-tokens'],
      },
    }],
    {
      rampCount: 14,
      drawCount: 14,
      interactionCount: 18,
      protectionCount: 8,
      tutorCount: 8,
      earlyPlayCount: 41,
      roleCounts: { 'free interaction': 1 },
    },
    { ...bracketFiveTargets },
  );

  const audit = auditUpgradeStrategyPreservationV15(pairings);
  const gate = candidateStrategyPreservationGateV15({ strategyPreservation: audit });

  assert.equal(pairings[0]?.strategyPreservation.verdict, 'meaningful-strategy-loss');
  assert.deepEqual(pairings[0]?.strategyPreservation.unreplacedRoles, ['extra combat', 'haste', 'untap engine']);
  assert.equal(audit.status, 'meaningful-strategy-loss');
  assert.deepEqual(audit.meaningfulLosses.map((loss) => loss.strategy), ['combat-tokens']);
  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'package-causes-a-meaningful-commander-strategy-loss');
});

test('candidate strategy preservation evidence fails closed when it is absent', () => {
  const gate = candidateStrategyPreservationGateV15({ swaps: [] });

  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'strategy-preservation-evidence-missing');
});

test('a strategically matched incoming card can compensate a protected strategy cut', () => {
  const audit = auditUpgradeStrategyPreservationV15([{
    cut: {
      card: { name: 'Outgoing Combat Engine', roles: ['extra combat'], manaValue: 6 },
      strategyAffinity: {
        score: 8,
        protectionApplied: 4,
        matchedStrategies: ['combat-tokens'],
      },
    },
    add: {
      card: { name: 'Incoming Combat Engine', roles: ['extra combat'], manaValue: 4 },
      strategyAffinity: {
        score: 8,
        protectionApplied: 4,
        matchedStrategies: ['combat-tokens'],
      },
    },
  }]);
  const gate = candidateStrategyPreservationGateV15({ strategyPreservation: audit });

  assert.equal(audit.status, 'preserved');
  assert.deepEqual(audit.meaningfulLosses, []);
  assert.equal(gate.eligible, true);
  assert.equal(gate.reason, 'commander-strategy-preserved');
});

test('aggregate archetype points cannot hide a meaningful loss in one pairing', () => {
  const audit = auditUpgradeStrategyPreservationV15([
    {
      cut: {
        card: { name: 'Outgoing Extra Combat Engine', roles: ['extra combat', 'haste', 'untap engine'], manaValue: 6 },
        strategyAffinity: { score: 20, protectionApplied: 4, matchedStrategies: ['combat-tokens'] },
      },
      add: {
        card: { name: 'Generic Token Card', roles: ['token production'], manaValue: 1 },
        strategyAffinity: { score: 6, protectionApplied: 0, matchedStrategies: ['combat-tokens'] },
      },
    },
    {
      cut: {
        card: { name: 'Surplus Utility', roles: [], manaValue: 2 },
        strategyAffinity: { score: 0, protectionApplied: 0, matchedStrategies: [] },
      },
      add: {
        card: { name: 'Second Generic Token Card', roles: ['token production'], manaValue: 1 },
        strategyAffinity: { score: 14, protectionApplied: 0, matchedStrategies: ['combat-tokens'] },
      },
    },
  ]);
  const gate = candidateStrategyPreservationGateV15({ strategyPreservation: audit });

  assert.equal(audit.status, 'preserved');
  assert.deepEqual(audit.meaningfulLosses, []);
  assert.equal(audit.swapImpacts[0]?.verdict, 'meaningful-strategy-loss');
  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'package-causes-a-meaningful-commander-strategy-loss');
});
