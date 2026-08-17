import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConservativeOutcomeLinkageV15,
  type OutcomeLinkEvidenceV15,
} from './learning-outcome-linkage-v15.js';

const DECK_A = 'a'.repeat(64);
const DECK_B = 'b'.repeat(64);

function evidence(overrides: Partial<OutcomeLinkEvidenceV15> = {}): OutcomeLinkEvidenceV15 {
  return {
    sourceId: 'topdeck',
    sourceRecordId: 'topdeck:event-1:player-1',
    eventName: 'Auckland cEDH Open',
    outcomeOccurredAt: '2026-05-10T00:00:00.000Z',
    fieldSize: 64,
    standing: 3,
    commanderNames: ['Kinnan, Bonder Prodigy'],
    deckFingerprint: DECK_A,
    ...overrides,
  };
}

test('exact deck fingerprint plus exact event/standing/commander evidence links cross-source mirrors', () => {
  const result = buildConservativeOutcomeLinkageV15([
    evidence(),
    evidence({
      sourceId: 'edhtop16',
      sourceRecordId: 'edhtop16:event-x:entry-y',
      eventName: '  auckland   cedh open ',
    }),
  ]);

  assert.equal(result.quarantined.length, 0);
  assert.equal(result.assignments.length, 2);
  assert.equal(result.assignments[0]?.linkageStatus, 'linked');
  assert.equal(result.assignments[0]?.canonicalOutcomeId, result.assignments[1]?.canonicalOutcomeId);
  assert.equal(result.assignments[0]?.independenceKey, result.assignments[1]?.independenceKey);
  assert.equal(result.assignments[0]?.leakageKey, result.assignments[1]?.leakageKey);
});

test('explicit entrant identity can link mirrors when exact deck fingerprint is unavailable', () => {
  const result = buildConservativeOutcomeLinkageV15([
    evidence({ deckFingerprint: undefined, entrantIdentityKey: 'player:1234' }),
    evidence({
      sourceId: 'edhtop16',
      sourceRecordId: 'edhtop16:row-2',
      deckFingerprint: undefined,
      entrantIdentityKey: ' PLAYER:1234 ',
    }),
  ]);

  assert.equal(result.quarantined.length, 0);
  assert.equal(result.assignments.length, 2);
  assert.ok(result.assignments.every((entry) => entry.linkageStatus === 'linked'));
  assert.equal(result.assignments[0]?.canonicalOutcomeId, result.assignments[1]?.canonicalOutcomeId);
});

test('same event/standing/commander without a shared strong entrant proof is quarantined as ambiguous', () => {
  const result = buildConservativeOutcomeLinkageV15([
    evidence({ deckFingerprint: undefined }),
    evidence({
      sourceId: 'edhtop16',
      sourceRecordId: 'edhtop16:ambiguous',
      deckFingerprint: undefined,
    }),
  ]);

  assert.equal(result.assignments.length, 0);
  assert.equal(result.quarantined.length, 1);
  assert.equal(result.quarantined[0]?.status, 'ambiguous');
  assert.match(result.quarantined[0]?.reason ?? '', /strong.*proof|fingerprint|entrant/i);
});

test('conflicting commander or strong identity evidence is quarantined rather than guessed', () => {
  const commanderConflict = buildConservativeOutcomeLinkageV15([
    evidence(),
    evidence({
      sourceId: 'edhtop16',
      sourceRecordId: 'edhtop16:conflict-commander',
      commanderNames: ['Tymna the Weaver', 'Kraum, Ludevic’s Opus'],
    }),
  ]);
  assert.equal(commanderConflict.assignments.length, 0);
  assert.equal(commanderConflict.quarantined[0]?.status, 'conflict');

  const deckConflict = buildConservativeOutcomeLinkageV15([
    evidence(),
    evidence({
      sourceId: 'edhtop16',
      sourceRecordId: 'edhtop16:conflict-deck',
      deckFingerprint: DECK_B,
    }),
  ]);
  assert.equal(deckConflict.assignments.length, 0);
  assert.equal(deckConflict.quarantined[0]?.status, 'conflict');
});

test('different standings are treated as distinct entrant outcomes but share event leakage/independence identity', () => {
  const result = buildConservativeOutcomeLinkageV15([
    evidence({ standing: 3, sourceRecordId: 'topdeck:p3' }),
    evidence({ standing: 7, sourceRecordId: 'topdeck:p7', deckFingerprint: DECK_B }),
  ]);

  assert.equal(result.quarantined.length, 0);
  assert.equal(result.assignments.length, 2);
  assert.notEqual(result.assignments[0]?.canonicalOutcomeId, result.assignments[1]?.canonicalOutcomeId);
  assert.equal(result.assignments[0]?.independenceKey, result.assignments[1]?.independenceKey);
  assert.equal(result.assignments[0]?.leakageKey, result.assignments[1]?.leakageKey);
  assert.ok(result.assignments.every((entry) => entry.linkageStatus === 'unique'));
});

test('field-size mismatch prevents automatic event collapse even when other fallback fields match', () => {
  const result = buildConservativeOutcomeLinkageV15([
    evidence({ sourceRecordId: 'topdeck:64' }),
    evidence({
      sourceId: 'edhtop16',
      sourceRecordId: 'edhtop16:63',
      fieldSize: 63,
    }),
  ]);

  assert.equal(result.quarantined.length, 0);
  assert.equal(result.eventGroupCount, 2);
  assert.notEqual(result.assignments[0]?.independenceKey, result.assignments[1]?.independenceKey);
});

test('explicit event identity is authoritative and mismatched explicit keys do not fall back to fuzzy merging', () => {
  const result = buildConservativeOutcomeLinkageV15([
    evidence({ explicitEventIdentityKey: 'event:official-a' }),
    evidence({
      sourceId: 'edhtop16',
      sourceRecordId: 'edhtop16:explicit-b',
      explicitEventIdentityKey: 'event:official-b',
    }),
  ]);

  assert.equal(result.eventGroupCount, 2);
  assert.equal(result.quarantined.length, 0);
  assert.ok(result.assignments.every((entry) => entry.linkageStatus === 'unique'));
});

test('same-source duplicate standing is quarantined instead of being mistaken for corroboration', () => {
  const result = buildConservativeOutcomeLinkageV15([
    evidence({ sourceRecordId: 'topdeck:duplicate-a' }),
    evidence({ sourceRecordId: 'topdeck:duplicate-b' }),
  ]);

  assert.equal(result.assignments.length, 0);
  assert.equal(result.quarantined.length, 1);
  assert.equal(result.quarantined[0]?.status, 'conflict');
  assert.match(result.quarantined[0]?.reason ?? '', /same source|duplicate/i);
});

test('linkage output is deterministic regardless of provider input order', () => {
  const rows = [
    evidence({ standing: 1, sourceRecordId: 'topdeck:winner', deckFingerprint: DECK_A }),
    evidence({ standing: 8, sourceRecordId: 'topdeck:eighth', deckFingerprint: DECK_B }),
    evidence({
      sourceId: 'edhtop16',
      sourceRecordId: 'edhtop16:winner',
      standing: 1,
      deckFingerprint: DECK_A,
    }),
  ];
  const forward = buildConservativeOutcomeLinkageV15(rows);
  const reverse = buildConservativeOutcomeLinkageV15([...rows].reverse());
  assert.deepEqual(forward, reverse);
});

test('malformed fingerprints and impossible standings fail closed', () => {
  assert.throws(
    () => buildConservativeOutcomeLinkageV15([evidence({ deckFingerprint: 'not-a-sha' })]),
    /fingerprint.*sha-256|sha-256.*fingerprint/i,
  );
  assert.throws(
    () => buildConservativeOutcomeLinkageV15([evidence({ standing: 65, fieldSize: 64 })]),
    /standing.*field/i,
  );
});
