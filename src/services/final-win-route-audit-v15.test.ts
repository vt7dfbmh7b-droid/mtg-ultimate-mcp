import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerifiedWinningComboDetailV15 } from './commander-build-evaluation-v15.js';
import { auditFinalWinRoutesV15 } from './final-win-route-audit-v15.js';

function detail(overrides: Partial<VerifiedWinningComboDetailV15> & Pick<VerifiedWinningComboDetailV15, 'comboId'>): VerifiedWinningComboDetailV15 {
  return {
    comboId: overrides.comboId,
    bracketTag: overrides.bracketTag ?? null,
    comboCardNames: overrides.comboCardNames ?? ['A', 'B'],
    seedNames: overrides.seedNames ?? ['A', 'B'],
    results: overrides.results ?? ['Win the game'],
    requirementNames: overrides.requirementNames ?? [],
    description: overrides.description ?? null,
    manaNeeded: overrides.manaNeeded ?? null,
    otherPrerequisites: overrides.otherPrerequisites ?? null,
    dependencyCompleteness: overrides.dependencyCompleteness ?? 'explicit-cards-only',
    closureKind: overrides.closureKind ?? 'direct-game-win',
    closureTiming: overrides.closureTiming ?? 'immediate',
    closureScope: overrides.closureScope ?? 'self-win',
  };
}

test('unavailable combo verification never manufactures route resilience', () => {
  const audit = auditFinalWinRoutesV15({
    comboVerificationComplete: false,
    verifiedWinningComboDetails: [],
  });
  assert.equal(audit.status, 'verification-unavailable');
  assert.equal(audit.verifiedFullTableWinCount, 0);
  assert.equal(audit.portfolio.resilienceBand, 'none');
});

test('one full-table combo is reported as a single route', () => {
  const audit = auditFinalWinRoutesV15({
    comboVerificationComplete: true,
    verifiedWinningComboDetails: [detail({ comboId: 'only' })],
  });
  assert.equal(audit.status, 'single-route');
  assert.equal(audit.portfolio.primaryComboId, 'only');
  assert.equal(audit.portfolio.backupComboId, null);
  assert.equal(audit.portfolio.resilienceBand, 'single-route');
});

test('preferred seeded combo remains the primary final route when it survived verification', () => {
  const audit = auditFinalWinRoutesV15({
    comboVerificationComplete: true,
    preferredComboId: 'seeded',
    verifiedWinningComboDetails: [
      detail({ comboId: 'natural', comboCardNames: ['N1', 'N2'], seedNames: ['N1', 'N2'] }),
      detail({ comboId: 'seeded', comboCardNames: ['S1', 'S2', 'S3'], seedNames: ['S1', 'S2', 'S3'] }),
    ],
  });
  assert.equal(audit.preferredComboVerified, true);
  assert.equal(audit.portfolio.primaryComboId, 'seeded');
});

test('disjoint explicit packages earn independent-backup resilience', () => {
  const audit = auditFinalWinRoutesV15({
    comboVerificationComplete: true,
    verifiedWinningComboDetails: [
      detail({ comboId: 'a', comboCardNames: ['A1', 'A2'], seedNames: ['A1', 'A2'] }),
      detail({ comboId: 'b', comboCardNames: ['B1', 'B2'], seedNames: ['B1', 'B2'] }),
    ],
  });
  assert.equal(audit.status, 'multiple-routes-analyzed');
  assert.equal(audit.portfolio.resilienceBand, 'independent-backup');
  assert.equal(audit.portfolio.fullyIndependentRouteCount, 2);
});

test('two combo IDs sharing a core do not earn independent redundancy', () => {
  const audit = auditFinalWinRoutesV15({
    comboVerificationComplete: true,
    verifiedWinningComboDetails: [
      detail({ comboId: 'a', comboCardNames: ['A', 'B'], seedNames: ['A', 'B'] }),
      detail({ comboId: 'b', comboCardNames: ['B', 'C'], seedNames: ['B', 'C'] }),
    ],
  });
  assert.equal(audit.status, 'multiple-routes-analyzed');
  assert.notEqual(audit.portfolio.resilienceBand, 'independent-backup');
  assert.equal(audit.portfolio.sharedCoreCandidateCount, 1);
});

test('shared commander is reported as commander-coupled rather than fully independent', () => {
  const audit = auditFinalWinRoutesV15({
    comboVerificationComplete: true,
    verifiedWinningComboDetails: [
      detail({ comboId: 'a', comboCardNames: ['Commander', 'A'], seedNames: ['A'] }),
      detail({ comboId: 'b', comboCardNames: ['Commander', 'B'], seedNames: ['B'] }),
    ],
  });
  assert.equal(audit.portfolio.resilienceBand, 'commander-coupled');
  assert.equal(audit.portfolio.fullyIndependentRouteCount, 1);
  assert.equal(audit.portfolio.distinctLibraryRouteCount, 2);
});

test('template requirements block a complete independence claim without deleting the verified win', () => {
  const audit = auditFinalWinRoutesV15({
    comboVerificationComplete: true,
    verifiedWinningComboDetails: [
      detail({ comboId: 'explicit', comboCardNames: ['A', 'B'], seedNames: ['A', 'B'] }),
      detail({
        comboId: 'templated',
        comboCardNames: ['C'],
        seedNames: ['C'],
        requirementNames: ['A creature you control'],
        dependencyCompleteness: 'template-requirements-present',
      }),
    ],
  });
  assert.equal(audit.verifiedFullTableWinCount, 2);
  assert.equal(audit.explicitDependencyRouteCount, 1);
  assert.equal(audit.unresolvedDependencyRouteCount, 1);
  assert.deepEqual(audit.unresolvedDependencyComboIds, ['templated']);
  assert.equal(audit.status, 'multiple-routes-independence-partial');
  assert.equal(audit.portfolio.resilienceBand, 'single-route');
});

test('delayed wins are retained but exposed separately for speed/resilience consumers', () => {
  const audit = auditFinalWinRoutesV15({
    comboVerificationComplete: true,
    verifiedWinningComboDetails: [
      detail({ comboId: 'now' }),
      detail({
        comboId: 'later',
        comboCardNames: ['L1', 'L2'],
        seedNames: ['L1', 'L2'],
        results: ['Win the game at the beginning of your next upkeep'],
        closureKind: 'delayed-game-win',
        closureTiming: 'delayed',
      }),
    ],
  });
  assert.deepEqual(audit.delayedWinComboIds, ['later']);
  assert.equal(audit.portfolio.primaryComboId, 'now');
});
