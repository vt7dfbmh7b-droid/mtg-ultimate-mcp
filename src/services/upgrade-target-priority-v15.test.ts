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
  earlyPlayCount: 41,
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
