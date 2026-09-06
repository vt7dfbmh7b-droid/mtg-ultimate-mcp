import assert from 'node:assert/strict';
import test from 'node:test';
import { strategyCompatibleCandidateLanesV15 } from './upgrade.js';

type Candidate = { name: string; identityFit: boolean; printingEligible?: boolean };

test('typal role candidates use aligned normal lane before generic fallback', () => {
  const aligned = { name: 'Typal draw engine', identityFit: true };
  const generic = { name: 'Generic draw spell', identityFit: false };
  assert.deepEqual(
    strategyCompatibleCandidateLanesV15([generic, aligned], (candidate) => candidate.identityFit),
    [[aligned], [generic]],
  );
});

test('non-typal spells strategy uses the same aligned-first behavior', () => {
  const aligned = { name: 'Spellslinger interaction', identityFit: true };
  const generic = { name: 'Generic removal', identityFit: false };
  assert.deepEqual(
    strategyCompatibleCandidateLanesV15([generic, aligned], (candidate) => candidate.identityFit),
    [[aligned], [generic]],
  );
});

test('generic structural candidates remain available when no aligned option exists', () => {
  const first = { name: 'Generic ramp A', identityFit: false };
  const second = { name: 'Generic ramp B', identityFit: false };
  assert.deepEqual(
    strategyCompatibleCandidateLanesV15([first, second], (candidate) => candidate.identityFit),
    [[first, second]],
  );
});

test('generic fallback is entered only when aligned lane yields zero eligible printings', () => {
  const unavailable: Candidate = { name: 'Aligned unavailable', identityFit: true, printingEligible: false };
  const generic: Candidate = { name: 'Generic available', identityFit: false, printingEligible: true };
  const choose = (pool: Candidate[]) => {
    const out: Candidate[] = [];
    for (const lane of strategyCompatibleCandidateLanesV15(pool, (candidate) => candidate.identityFit)) {
      const before = out.length;
      out.push(...lane.filter((candidate) => candidate.printingEligible));
      if (out.length > before) break;
    }
    return out;
  };

  assert.deepEqual(choose([generic, unavailable]), [generic]);
  const available: Candidate = { name: 'Aligned available', identityFit: true, printingEligible: true };
  assert.deepEqual(choose([generic, available]), [available]);
});
