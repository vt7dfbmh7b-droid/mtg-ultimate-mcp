import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendRefinementCandidateAttemptV15,
  candidatePlanProvenanceV15,
  rejectedStrategyCutNamesV15,
  refinementSwapEvidenceV15,
  type RefinementCandidateAttemptV15,
} from './optimizer-v12.js';

function plan(sourceStatus: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v15TargetPressure: {
      targetPressure: { targetBracket: 5 },
      winRouteVerificationStatus: 'no-verified-route',
      winPackageDiscoveryAttempted: true,
      winPackageSourceStatus: sourceStatus,
      selectedComboId: null,
      selectedBracketTag: null,
      missingSeedNames: [],
      atomicWinPackageInjected: false,
      reason: 'diagnostic reason',
      ...overrides,
    },
    sourceUpgradeAnalysis: {
      candidateDiscovery: { mode: 'exhaustive-bounded-printing-policy' },
      authoritativeTargetGatePriorities: [{ role: 'average-nonland-mv', targetGate: 'average-nonland-mv' }],
      structuralDeficits: [{ role: 'tutor', current: 8, target: 10 }],
      candidateAddsByDeficit: [{
        role: 'average-nonland-mv',
        prioritySource: 'authoritative-target-gate',
        targetGate: 'average-nonland-mv',
        current: 2.71,
        target: 2.6,
        deficit: 0.11,
        candidateDiscoveryMode: 'exhaustive-bounded-printing-policy',
        candidates: [{ card: { name: 'Low Curve Candidate' } }],
      }],
    },
  };
}

test('candidate provenance distinguishes completed absence, unavailable evidence, and post-discovery selection failure', () => {
  const absent = candidatePlanProvenanceV15(plan('no-verified-win-package'));
  const unavailable = candidatePlanProvenanceV15(plan('verification-unavailable'));
  const selectionFailure = candidatePlanProvenanceV15(plan('verified-win-packages-found'));

  assert.equal(absent.winPackageOutcome, 'completed-no-verified-package');
  assert.equal(unavailable.winPackageOutcome, 'verification-unavailable');
  assert.equal(selectionFailure.winPackageOutcome, 'selection-failed-after-discovery');
  assert.deepEqual(absent.authoritativeTargetGatePriorities, [{
    role: 'average-nonland-mv',
    targetGate: 'average-nonland-mv',
  }]);
  assert.equal((absent.candidateGroups as Array<Record<string, unknown>>)[0]?.candidateCount, 1);
});

test('candidate provenance retains constrained-pool absence diagnostics', () => {
  const input = plan('no-verified-win-package');
  const source = input.sourceUpgradeAnalysis as Record<string, unknown>;
  const groupsInput = source.candidateAddsByDeficit as Array<Record<string, unknown>>;
  groupsInput[0] = {
    ...groupsInput[0],
    candidateAvailability: 'all-role-cards-already-present-or-excluded',
    roleMatchesBeforeExistingExclusions: 2,
  };
  const result = candidatePlanProvenanceV15(input);
  const groups = result.candidateGroups as Array<Record<string, unknown>>;
  assert.equal(groups[0]?.candidateAvailability, 'all-role-cards-already-present-or-excluded');
  assert.equal(groups[0]?.roleMatchesBeforeExistingExclusions, 2);
});

test('attempt trace accumulation retains every attempted swap size and its candidate comparisons', () => {
  let attempts: RefinementCandidateAttemptV15[] = [];
  attempts = appendRefinementCandidateAttemptV15(attempts, {
    attemptSize: 5,
    winningCandidate: null,
    candidates: [{
      candidate: 1,
      eligible: false,
      reason: 'no-supported-swaps-found',
      comparison: { candidate: 1, planProvenance: candidatePlanProvenanceV15(plan('no-verified-win-package')) },
    }],
  });
  attempts = appendRefinementCandidateAttemptV15(attempts, {
    attemptSize: 4,
    winningCandidate: 2,
    candidates: [{
      candidate: 2,
      eligible: true,
      reason: 'eligible',
      comparison: { candidate: 2, planProvenance: candidatePlanProvenanceV15(plan('verified-win-packages-found', {
        selectedComboId: 'combo-1',
        atomicWinPackageInjected: true,
      })) },
    }],
  });

  assert.deepEqual(attempts.map((attempt) => attempt.attemptSize), [5, 4]);
  assert.deepEqual(attempts[0]?.reasonCounts, { 'no-supported-swaps-found': 1 });
  assert.equal(attempts[1]?.winningCandidate, 2);
  const provenance = attempts[1]?.candidateComparisons[0]?.planProvenance as Record<string, unknown> | undefined;
  assert.equal(provenance?.winPackageOutcome, 'verified-package-injected');
});

test('refinement evidence projection retains persistent colored-mana floors', () => {
  const projected = refinementSwapEvidenceV15({
    out: 'Arcane Signet',
    in: 'Ponder',
    structuralPairing: {
      addressedRole: 'average-nonland-mv',
      persistentColoredManaSourcesAfterSwap: 12,
      persistentColoredManaSourceFloor: 8,
      strategyPreservation: { verdict: 'preserved' },
    },
  });
  const pairing = projected.structuralPairing as Record<string, unknown>;

  assert.equal(pairing.persistentColoredManaSourcesAfterSwap, 12);
  assert.equal(pairing.persistentColoredManaSourceFloor, 8);
});

test('strategy-rejected package diversity protects only the cuts that caused meaningful loss', () => {
  const names = rejectedStrategyCutNamesV15({
    swaps: [
      {
        out: 'Protected Engine',
        in: 'Generic Upgrade',
        structuralPairing: { strategyPreservation: { meaningfulStrategyLoss: true } },
      },
      {
        out: 'Safe Surplus',
        in: 'Second Upgrade',
        structuralPairing: { strategyPreservation: { meaningfulStrategyLoss: false } },
      },
      {
        out: 'protected engine',
        in: 'Third Upgrade',
        structuralPairing: { strategyPreservation: { meaningfulStrategyLoss: true } },
      },
    ],
  });

  assert.deepEqual(names.map((name) => name.toLocaleLowerCase()), ['protected engine']);
});
