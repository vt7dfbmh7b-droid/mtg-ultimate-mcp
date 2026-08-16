import assert from 'node:assert/strict';
import test from 'node:test';
import { isRetryableHttpStatus, parseRetryAfterMs } from './http.js';

test('HTTP retry status classification is conservative', () => {
  assert.equal(isRetryableHttpStatus(429), true);
  assert.equal(isRetryableHttpStatus(503), true);
  assert.equal(isRetryableHttpStatus(404), false);
  assert.equal(isRetryableHttpStatus(401), false);
});

test('Retry-After supports seconds and clamps long waits', () => {
  assert.equal(parseRetryAfterMs('1.5', 0), 1500);
  assert.equal(parseRetryAfterMs('999', 0), 30000);
  assert.equal(parseRetryAfterMs('not-a-date', 0), null);
});

test('Retry-After supports HTTP dates', () => {
  const now = Date.parse('2026-08-16T00:00:00Z');
  assert.equal(parseRetryAfterMs('Sun, 16 Aug 2026 00:00:02 GMT', now), 2000);
});
