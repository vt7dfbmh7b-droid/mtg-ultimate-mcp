import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateCommanderBracket } from './spellbook.js';

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

test('non-transient Spellbook bracket errors still fail instead of being hidden', async () => {
  await assert.rejects(
    withMockFetch(
      (async () => new Response('bad request', { status: 400, statusText: 'Bad Request' })) as typeof fetch,
      () => estimateCommanderBracket('malformed'),
    ),
    /HTTP 400 Bad Request/,
  );
});
