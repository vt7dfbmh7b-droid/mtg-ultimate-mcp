import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveWinRouteProtectionV15 } from './optimizer-v12.js';

test('route protection keeps the V0.15 portfolio primary and backup but not unrelated incidental combos', () => {
  const protection = deriveWinRouteProtectionV15({
    comboVerificationComplete: true,
    primaryComboId: 'primary',
    backupComboId: 'backup',
    verifiedWinningComboDetails: [
      { comboId: 'primary', comboCardNames: ['Commander', 'Primary A', 'Primary B'] },
      { comboId: 'backup', comboCardNames: ['Commander', 'Backup A', 'Backup B'] },
      { comboId: 'incidental', comboCardNames: ['Incidental A', 'Incidental B'] },
    ],
  });

  assert.equal(protection.status, 'protected');
  assert.deepEqual(protection.protectedComboIds, ['backup', 'primary']);
  assert.deepEqual(protection.protectedCardNames, [
    'Backup A',
    'Backup B',
    'Commander',
    'Primary A',
    'Primary B',
  ]);
  assert.ok(!protection.protectedCardNames.includes('Incidental A'));
});

test('one verified route is protected even when portfolio independence cannot name a primary', () => {
  const protection = deriveWinRouteProtectionV15({
    comboVerificationComplete: true,
    primaryComboId: null,
    backupComboId: null,
    verifiedWinningComboDetails: [
      { comboId: 'single-partial-route', comboCardNames: ['Known Piece A', 'Known Piece B'] },
    ],
  });

  assert.equal(protection.status, 'protected');
  assert.deepEqual(protection.protectedComboIds, ['single-partial-route']);
  assert.deepEqual(protection.protectedCardNames, ['Known Piece A', 'Known Piece B']);
});

test('verification unavailable never becomes a false no-route claim', () => {
  const protection = deriveWinRouteProtectionV15({
    comboVerificationComplete: false,
    primaryComboId: 'stale-primary',
    backupComboId: null,
    verifiedWinningComboDetails: [
      { comboId: 'stale-primary', comboCardNames: ['A', 'B'] },
    ],
  });

  assert.equal(protection.status, 'verification-unavailable');
  assert.deepEqual(protection.protectedComboIds, []);
  assert.deepEqual(protection.protectedCardNames, []);
});
