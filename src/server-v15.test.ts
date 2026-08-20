import assert from 'node:assert/strict';
import test from 'node:test';
import { createMtgServerV15 } from './server-v15.js';

test('V0.15 experimental server can be constructed', async () => {
  const server = createMtgServerV15();
  assert.ok(server);
  const close = (server as unknown as { close?: () => Promise<void> | void }).close;
  if (close) await close.call(server);
});
