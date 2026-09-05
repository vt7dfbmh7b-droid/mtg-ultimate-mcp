import assert from 'node:assert/strict';
import test from 'node:test';
import type { NeutralThemeAuditV15 } from './neutral-theme-v15.js';
import {
  candidateCompoundThemeComponentGateV15,
  candidateThemeGateV15,
} from './optimizer-v12.js';

function audit(input: {
  label: string;
  matched: number;
  required: number;
  satisfied?: boolean;
}): NeutralThemeAuditV15 {
  const satisfied = input.satisfied ?? input.matched >= input.required;
  return {
    status: satisfied ? 'satisfied' : 'under-minimum',
    satisfied,
    original: input.label,
    kind: 'mechanic',
    canonicalLabel: input.label,
    requiredMainMatches: input.required,
    matchedMainCards: input.matched,
    totalMainCards: 99,
    mainCoverage: input.matched / 99,
    matchingCardNames: [],
    entries: [],
    explanation: 'focused component-gate fixture',
  };
}

test('compound theme component gate rejects a package that breaks a previously satisfied component', () => {
  const gate = candidateCompoundThemeComponentGateV15(
    [audit({ label: 'Knights', matched: 32, required: 25 })],
    [audit({ label: 'Knights', matched: 24, required: 25 })],
  );

  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'package-would-break-required-compound-theme-component-density');
});

test('compound theme component gate rejects backward movement on an unsatisfied component', () => {
  const gate = candidateCompoundThemeComponentGateV15(
    [audit({ label: 'Proliferate', matched: 4, required: 10 })],
    [audit({ label: 'Proliferate', matched: 2, required: 10 })],
  );

  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'package-would-regress-required-compound-theme-component-density');
});

test('compound theme component gate permits an unchanged unsatisfied component while another gate decides aggregate progress', () => {
  const gate = candidateCompoundThemeComponentGateV15(
    [
      audit({ label: 'Proliferate', matched: 4, required: 10 }),
      audit({ label: '+1/+1 counters', matched: 16, required: 15 }),
    ],
    [
      audit({ label: 'Proliferate', matched: 4, required: 10 }),
      audit({ label: '+1/+1 counters', matched: 17, required: 15 }),
    ],
  );

  assert.equal(gate.eligible, true);
  assert.equal(gate.reason, 'compound-theme-components-preserved-or-not-regressed');
});

test('compound theme component gate fails closed when component evidence is missing or inconsistent', () => {
  assert.equal(candidateCompoundThemeComponentGateV15(null, null).eligible, false);
  assert.equal(
    candidateCompoundThemeComponentGateV15(
      [audit({ label: 'Combat', matched: 12, required: 12 })],
      [],
    ).reason,
    'compound-theme-component-verification-unavailable',
  );
  assert.equal(
    candidateCompoundThemeComponentGateV15(
      [audit({ label: 'Combat', matched: 12, required: 12 })],
      [audit({ label: 'Combat', matched: 12, required: 13 })],
    ).reason,
    'compound-theme-component-verification-unavailable',
  );
});

test('single-theme aggregate gate behavior remains unchanged', () => {
  const preserved = candidateThemeGateV15(
    audit({ label: 'Equipment', matched: 15, required: 15 }),
    audit({ label: 'Equipment', matched: 15, required: 15 }),
  );
  const advanced = candidateThemeGateV15(
    audit({ label: 'Equipment', matched: 12, required: 15 }),
    audit({ label: 'Equipment', matched: 13, required: 15 }),
  );

  assert.deepEqual(preserved, { eligible: true, reason: 'theme-preserved' });
  assert.deepEqual(advanced, { eligible: true, reason: 'theme-density-advanced' });
});
