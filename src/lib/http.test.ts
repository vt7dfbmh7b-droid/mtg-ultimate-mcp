import assert from 'node:assert/strict';
import test from 'node:test';
import { config } from '../config.js';
import { fetchJson, HttpRequestError } from './http.js';

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function withMockFetch<T>(mock: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('all Scryfall fetchJson calls share one process-wide start-to-start pacing clock', async () => {
  const starts: number[] = [];
  await withMockFetch(
    (async () => {
      starts.push(Date.now());
      return jsonResponse({ object: 'card' });
    }) as typeof fetch,
    async () => {
      await Promise.all([
        fetchJson(`${config.scryfallApiBase}/cards/named?exact=Alpha`),
        fetchJson(`${config.scryfallApiBase}/cards/named?exact=Beta`),
      ]);
    },
  );
  assert.equal(starts.length, 2);
  assert.ok(
    starts[1]! - starts[0]! >= config.scryfallMinRequestGapMs - 25,
    `expected shared Scryfall pacing of about ${config.scryfallMinRequestGapMs}ms; observed ${starts[1]! - starts[0]!}ms`,
  );
});

test('retries a transient timeout for Scryfall collection POST because it is an idempotent read', async () => {
  let calls = 0;
  await withMockFetch(
    (async () => {
      calls += 1;
      if (calls === 1) throw new DOMException('timed out', 'TimeoutError');
      return jsonResponse({ data: [], not_found: [] });
    }) as typeof fetch,
    async () => {
      const result = await fetchJson<{ data: unknown[]; not_found: unknown[] }>(
        `${config.scryfallApiBase}/cards/collection`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers: [{ name: 'Sol Ring' }] }),
        },
        100,
      );
      assert.deepEqual(result, { data: [], not_found: [] });
    },
  );
  assert.equal(calls, 2);
});

test('retries transient Commander Spellbook read POST responses but respects Retry-After', async () => {
  let calls = 0;
  await withMockFetch(
    (async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ detail: 'busy' }, 503, { 'Retry-After': '0' });
      return jsonResponse({ results: {} });
    }) as typeof fetch,
    async () => {
      const result = await fetchJson<{ results: Record<string, unknown> }>(
        `${config.commanderSpellbookApiBase}/find-my-combos`,
        { method: 'POST', body: '1 Sol Ring' },
        100,
      );
      assert.deepEqual(result, { results: {} });
    },
  );
  assert.equal(calls, 2);
});

test('does not retry arbitrary POST requests such as TopDeck ingestion', async () => {
  let calls = 0;
  await assert.rejects(
    withMockFetch(
      (async () => {
        calls += 1;
        throw new DOMException('timed out', 'TimeoutError');
      }) as typeof fetch,
      () => fetchJson(
        `${config.topDeckApiBase}/v2/tournaments`,
        { method: 'POST', body: '{}' },
        100,
      ),
    ),
    (error: unknown) => error instanceof HttpRequestError && error.attempts === 1,
  );
  assert.equal(calls, 1);
});

test('does not retry an explicit caller abort even on an idempotent read endpoint', async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    withMockFetch(
      (async () => {
        calls += 1;
        throw new DOMException('aborted', 'AbortError');
      }) as typeof fetch,
      () => fetchJson(
        `${config.scryfallApiBase}/cards/collection`,
        { method: 'POST', body: '{}', signal: controller.signal },
        100,
      ),
    ),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
  );
  assert.equal(calls, 1);
});
