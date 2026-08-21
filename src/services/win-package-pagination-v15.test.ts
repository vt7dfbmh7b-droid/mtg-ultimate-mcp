import assert from 'node:assert/strict';
import test from 'node:test';
import { collectBoundedSpellbookVariantsV15 } from './win-package-pagination-v15.js';

test('bounded Spellbook collection paginates until the provider result set is exhausted', async () => {
  const offsets: number[] = [];
  const result = await collectBoundedSpellbookVariantsV15('winning', async (_query, options) => {
    offsets.push(options.offset);
    const all = Array.from({ length: 135 }, (_, index) => ({ id: `v${index}` }));
    return {
      count: all.length,
      results: all.slice(options.offset, options.offset + options.limit),
      sourceStatus: 'available',
      verificationComplete: true,
    };
  }, { pageSize: 100, maxRows: 400 });

  assert.deepEqual(offsets, [0, 100]);
  assert.equal(result.rowsFetched, 135);
  assert.equal(result.totalMatching, 135);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.exhausted, true);
  assert.equal(result.truncated, false);
  assert.equal(result.verificationComplete, true);
  assert.equal(result.sourceStatus, 'available');
});

test('bounded Spellbook collection reports a scan cap as partial evidence rather than absence', async () => {
  const result = await collectBoundedSpellbookVariantsV15('winning', async (_query, options) => ({
    count: 900,
    results: Array.from({ length: options.limit }, (_, index) => ({ id: `${options.offset + index}` })),
    sourceStatus: 'available',
    verificationComplete: true,
  }), { pageSize: 100, maxRows: 300 });

  assert.equal(result.rowsFetched, 300);
  assert.equal(result.exhausted, false);
  assert.equal(result.truncated, true);
  assert.equal(result.verificationComplete, false);
  assert.equal(result.sourceStatus, 'partial');
});

test('later-page provider failure preserves earlier positive rows but keeps verification incomplete', async () => {
  const result = await collectBoundedSpellbookVariantsV15('winning', async (_query, options) => {
    if (options.offset === 0) {
      return {
        count: 180,
        results: Array.from({ length: 100 }, (_, index) => ({ id: `v${index}` })),
        sourceStatus: 'available',
        verificationComplete: true,
      };
    }
    return {
      count: 0,
      results: [],
      sourceStatus: 'unavailable',
      verificationComplete: false,
      sourceFailure: { kind: 'request-failed' },
    };
  }, { pageSize: 100, maxRows: 400 });

  assert.equal(result.rowsFetched, 100);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.exhausted, false);
  assert.equal(result.verificationComplete, false);
  assert.equal(result.sourceStatus, 'partial');
  assert.deepEqual(result.sourceFailure, { kind: 'request-failed' });
});
