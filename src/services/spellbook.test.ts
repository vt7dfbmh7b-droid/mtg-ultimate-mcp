import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateCommanderBracket, findDeckCombosEvidence } from './spellbook.js';

async function withMockFetch<T>(mock: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('transient Spellbook bracket timeouts degrade to explicit unavailable advisory evidence', async () => {
  let calls = 0;
  const result = await withMockFetch(
    (async () => {
      calls += 1;
      throw new DOMException('timed out', 'TimeoutError');
    }) as typeof fetch,
    () => estimateCommanderBracket('1 Test Commander\n99 Test Card'),
  );
  assert.equal(result.sourceStatus, 'unavailable');
  assert.equal(result.bracketTag, null);
  assert.deepEqual(result.strategicallyRelevantCombos, []);
  assert.ok(calls >= 2, 'the idempotent advisory POST should use the bounded retry policy before degrading');
  const failure = result.sourceFailure as Record<string, unknown>;
  assert.equal(failure.kind, 'request-failed');
  assert.equal(failure.provider, 'commander-spellbook');
});

test('transient combo verification failures return zero positive evidence with incomplete provenance', async () => {
  let calls = 0;
  const result = await withMockFetch(
    (async () => {
      calls += 1;
      throw new DOMException('timed out', 'TimeoutError');
    }) as typeof fetch,
    () => findDeckCombosEvidence('1 Test Commander\n99 Test Card', 100),
  );
  assert.equal(result.sourceStatus, 'unavailable');
  assert.equal(result.verificationComplete, false);
  assert.deepEqual(result.included, []);
  assert.equal((result.counts as Record<string, unknown>).included, 0);
  assert.ok(calls >= 2, 'the idempotent combo POST should exhaust its bounded retry policy before degrading');
  const failure = result.sourceFailure as Record<string, unknown>;
  assert.equal(failure.kind, 'request-failed');
  assert.equal(failure.provider, 'commander-spellbook');
});

test('non-transient Spellbook bracket errors still fail instead of being hidden', async () => {
  await assert.rejects(
    withMockFetch(
      (async () => new Response('bad request', { status: 400, statusText: 'Bad Request' })) as typeof fetch,
      () => estimateCommanderBracket('malformed'),
    ),
    /HTTP 400 Bad Request/,
  );
});

test('non-transient combo verification errors still fail instead of becoming zero evidence', async () => {
  await assert.rejects(
    withMockFetch(
      (async () => new Response('bad request', { status: 400, statusText: 'Bad Request' })) as typeof fetch,
      () => findDeckCombosEvidence('malformed'),
    ),
    /HTTP 400 Bad Request/,
  );
});
