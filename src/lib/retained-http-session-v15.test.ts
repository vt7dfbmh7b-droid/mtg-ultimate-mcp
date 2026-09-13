import assert from 'node:assert/strict';
import test from 'node:test';
import { createRetainedHttpSessionV15, verifyRetainedHttpCaptureV15, type RetainedHttpCaptureV15 } from './retained-http-session-v15.js';
import { runBoundedProcessV15 } from './bounded-process-v15.js';

test('capture retains actual response bytes and strict replay never calls a live provider', async () => {
  const capture: RetainedHttpCaptureV15 = { schema: 'retained-http-capture-v15.1', sourceSha: 'a'.repeat(40), scryfallManifestFingerprint: 'fixture-only', evaluationTime: '2026-01-01T00:00:00Z', entries: [] };
  let calls = 0;
  const live = createRetainedHttpSessionV15({ mode: 'capture', capture, allowedOrigins: ['https://provider.test'], fetchImpl: async () => { calls++; return Response.json({ actualFixtureValue: 7 }); } });
  await Promise.all([live.fetch('https://provider.test/data'), live.fetch('https://provider.test/data')]);
  assert.equal(calls, 1); assert.equal(capture.entries.length, 1);
  const replay = createRetainedHttpSessionV15({ mode: 'replay', capture: structuredClone(capture), allowedOrigins: ['https://provider.test'], fetchImpl: async () => { throw new Error('network escape'); } });
  assert.deepEqual(await (await replay.fetch('https://provider.test/data')).json(), { actualFixtureValue: 7 });
  await assert.rejects(replay.fetch('https://provider.test/other'), /Missing retained/);
  assert.throws(replay.assertComplete, /incomplete/);
  const corrupt = structuredClone(capture); corrupt.entries[0]!.responseBase64 = Buffer.from('{}').toString('base64');
  assert.throws(() => verifyRetainedHttpCaptureV15(corrupt), /integrity/);
});

test('outer watchdog terminates a worker with a blocked event loop and records timeout', async () => {
  const started = performance.now(); let recorded = false;
  const result = await runBoundedProcessV15(process.execPath, ['-e', 'while (true) {}'], { deadlineMs: 200, graceMs: 100, onTimeout: () => { recorded = true; } });
  assert.equal(result.timedOut, true); assert.equal(recorded, true);
  assert.ok(performance.now() - started < 5_000, 'a blocked worker must not outlive its outer deadline');
});
