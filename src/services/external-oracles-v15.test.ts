import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXTERNAL_ORACLES_V15,
  compareExternalOracleSnapshotV15,
  externalOraclesForDomainV15,
  summarizeExternalBenchmarkComparisonsV15,
} from './external-oracles-v15.js';

test('Forge and Manabrew share one independence family', () => {
  const forge = EXTERNAL_ORACLES_V15.find((entry) => entry.id === 'forge');
  const manabrew = EXTERNAL_ORACLES_V15.find((entry) => entry.id === 'manabrew');
  assert.equal(forge?.independenceGroup, 'forge-family');
  assert.equal(manabrew?.independenceGroup, 'forge-family');
});

test('rules benchmarks expose both Forge-family references', () => {
  const ids = externalOraclesForDomainV15('rules').map((entry) => entry.id);
  assert.ok(ids.includes('forge'));
  assert.ok(ids.includes('manabrew'));
});

test('exact normalized snapshot comparison reports parity', () => {
  const result = compareExternalOracleSnapshotV15(
    {
      winner: 'player-1',
      turn: 4,
      stack: [],
      life: [40, 0],
    },
    {
      oracleId: 'forge',
      caseId: 'combat-001',
      domain: 'rules',
      oracleVersion: 'pinned-test-version',
      deterministicSeed: 42,
      normalizedResult: {
        winner: 'player-1',
        turn: 4,
        stack: [],
        life: [40, 0],
      },
    },
  );

  assert.equal(result.agreement, 'exact');
  assert.deepEqual(result.differencePaths, []);
  assert.equal(result.independenceGroup, 'forge-family');
  assert.equal(result.deterministicSeed, 42);
});

test('nested mismatch reports the precise normalized path', () => {
  const result = compareExternalOracleSnapshotV15(
    {
      combat: { attackerDamage: 7, blockerDestroyed: true },
    },
    {
      oracleId: 'forge',
      caseId: 'trample-001',
      domain: 'rules',
      oracleVersion: 'pinned-test-version',
      normalizedResult: {
        combat: { attackerDamage: 6, blockerDestroyed: true },
      },
    },
  );

  assert.equal(result.agreement, 'mismatch');
  assert.deepEqual(result.differencePaths, ['$.combat.attackerDamage']);
});

test('Forge plus Manabrew agreement counts as one family, not two sources', () => {
  const forge = compareExternalOracleSnapshotV15(
    { result: 'same' },
    {
      oracleId: 'forge',
      caseId: 'same-case',
      domain: 'simulation',
      oracleVersion: 'forge-pin',
      deterministicSeed: 17,
      normalizedResult: { result: 'same' },
    },
  );
  const manabrew = compareExternalOracleSnapshotV15(
    { result: 'same' },
    {
      oracleId: 'manabrew',
      caseId: 'same-case',
      domain: 'simulation',
      oracleVersion: 'manabrew-pin',
      deterministicSeed: 17,
      normalizedResult: { result: 'same' },
    },
  );

  const summary = summarizeExternalBenchmarkComparisonsV15([forge, manabrew]);
  assert.equal(summary.comparableCase, true);
  assert.equal(summary.exactComparisons, 2);
  assert.equal(summary.independentExactGroups, 1);
  assert.equal(summary.corroboration, 'single-family');
});

test('independent MCP and Forge-family agreement produces multi-source corroboration', () => {
  const forge = compareExternalOracleSnapshotV15(
    { legal: true },
    {
      oracleId: 'forge',
      caseId: 'shared-case',
      domain: 'rules',
      oracleVersion: 'forge-pin',
      normalizedResult: { legal: true },
    },
  );
  const j4th = compareExternalOracleSnapshotV15(
    { legal: true },
    {
      oracleId: 'j4th-mtg-mcp',
      caseId: 'shared-case',
      domain: 'rules',
      oracleVersion: 'j4th-pin',
      normalizedResult: { legal: true },
    },
  );

  const summary = summarizeExternalBenchmarkComparisonsV15([forge, j4th]);
  assert.equal(summary.comparableCase, true);
  assert.equal(summary.independentExactGroups, 2);
  assert.equal(summary.corroboration, 'multi-source');
});

test('a mismatch in an oracle family keeps that family unresolved', () => {
  const exact = compareExternalOracleSnapshotV15(
    { value: 1 },
    {
      oracleId: 'forge',
      caseId: 'family-conflict',
      domain: 'rules',
      oracleVersion: 'forge-pin',
      normalizedResult: { value: 1 },
    },
  );
  const mismatch = compareExternalOracleSnapshotV15(
    { value: 1 },
    {
      oracleId: 'manabrew',
      caseId: 'family-conflict',
      domain: 'rules',
      oracleVersion: 'manabrew-pin',
      normalizedResult: { value: 2 },
    },
  );

  const summary = summarizeExternalBenchmarkComparisonsV15([exact, mismatch]);
  assert.equal(summary.independentExactGroups, 0);
  assert.equal(summary.corroboration, 'none');
  assert.deepEqual(summary.mismatchGroups, ['forge-family']);
});

test('different case IDs cannot be pooled into fake multi-source corroboration', () => {
  const forge = compareExternalOracleSnapshotV15(
    { result: 'ok' },
    {
      oracleId: 'forge',
      caseId: 'combat-case',
      domain: 'rules',
      oracleVersion: 'forge-pin',
      normalizedResult: { result: 'ok' },
    },
  );
  const j4th = compareExternalOracleSnapshotV15(
    { result: 'ok' },
    {
      oracleId: 'j4th-mtg-mcp',
      caseId: 'different-case',
      domain: 'rules',
      oracleVersion: 'j4th-pin',
      normalizedResult: { result: 'ok' },
    },
  );

  const summary = summarizeExternalBenchmarkComparisonsV15([forge, j4th]);
  assert.equal(summary.comparableCase, false);
  assert.equal(summary.corroboration, 'none');
  assert.equal(summary.independentExactGroups, 0);
  assert.ok(summary.boundaryProblems.some((problem) => problem.includes('caseIds')));
});

test('different domains cannot be pooled even when case labels happen to match', () => {
  const rules = compareExternalOracleSnapshotV15(
    { value: 3 },
    {
      oracleId: 'forge',
      caseId: 'shared-label',
      domain: 'rules',
      oracleVersion: 'forge-pin',
      normalizedResult: { value: 3 },
    },
  );
  const analysis = compareExternalOracleSnapshotV15(
    { value: 3 },
    {
      oracleId: 'j4th-mtg-mcp',
      caseId: 'shared-label',
      domain: 'commander-analysis',
      oracleVersion: 'j4th-pin',
      normalizedResult: { value: 3 },
    },
  );

  const summary = summarizeExternalBenchmarkComparisonsV15([rules, analysis]);
  assert.equal(summary.comparableCase, false);
  assert.equal(summary.corroboration, 'none');
  assert.ok(summary.boundaryProblems.some((problem) => problem.includes('domains')));
});

test('different deterministic seeds cannot be pooled as one simulation experiment', () => {
  const forge = compareExternalOracleSnapshotV15(
    { winner: 'a' },
    {
      oracleId: 'forge',
      caseId: 'seeded-game',
      domain: 'simulation',
      oracleVersion: 'forge-pin',
      deterministicSeed: 11,
      normalizedResult: { winner: 'a' },
    },
  );
  const manabrew = compareExternalOracleSnapshotV15(
    { winner: 'a' },
    {
      oracleId: 'manabrew',
      caseId: 'seeded-game',
      domain: 'simulation',
      oracleVersion: 'manabrew-pin',
      deterministicSeed: 12,
      normalizedResult: { winner: 'a' },
    },
  );

  const summary = summarizeExternalBenchmarkComparisonsV15([forge, manabrew]);
  assert.equal(summary.comparableCase, false);
  assert.equal(summary.corroboration, 'none');
  assert.ok(summary.boundaryProblems.some((problem) => problem.includes('seeds')));
});

test('blank benchmark identity metadata is rejected before comparison', () => {
  assert.throws(
    () => compareExternalOracleSnapshotV15(
      { result: true },
      {
        oracleId: 'forge',
        caseId: '   ',
        domain: 'rules',
        oracleVersion: 'forge-pin',
        normalizedResult: { result: true },
      },
    ),
    /caseId must be non-empty/,
  );

  assert.throws(
    () => compareExternalOracleSnapshotV15(
      { result: true },
      {
        oracleId: 'forge',
        caseId: 'valid-case',
        domain: 'rules',
        oracleVersion: '',
        normalizedResult: { result: true },
      },
    ),
    /oracleVersion must be non-empty/,
  );
});
