import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTERNAL_ORACLES_V15 } from './external-oracles-v15.js';
import {
  EXTERNAL_ORACLE_BASELINE_PINS_V15,
  baselineExternalOracleVersionV15,
  isPinnedExternalOracleVersionV15,
} from './external-oracle-pins-v15.js';

test('every registered external oracle has one explicit baseline revision pin', () => {
  const registered = EXTERNAL_ORACLES_V15.map((oracle) => oracle.id).sort();
  const pinned = Object.keys(EXTERNAL_ORACLE_BASELINE_PINS_V15).sort();
  assert.deepEqual(pinned, registered);
});

test('baseline pins are full immutable-looking Git commit SHAs', () => {
  for (const pin of Object.values(EXTERNAL_ORACLE_BASELINE_PINS_V15)) {
    assert.match(pin.commit, /^[0-9a-f]{40}$/);
    assert.match(pin.capturedDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(pin.repository.includes('/'));
  }
});

test('pin helpers require exact revision equality rather than prefixes or whitespace tricks', () => {
  const version = baselineExternalOracleVersionV15('forge');
  assert.equal(isPinnedExternalOracleVersionV15('forge', version), true);
  assert.equal(isPinnedExternalOracleVersionV15('forge', ` ${version} `), true);
  assert.equal(isPinnedExternalOracleVersionV15('forge', version.slice(0, 12)), false);
  assert.equal(isPinnedExternalOracleVersionV15('manabrew', version), false);
});
