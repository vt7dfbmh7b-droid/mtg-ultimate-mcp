import assert from 'node:assert/strict';
import test from 'node:test';
import { createMtgServerV15Neural } from './server-v15-neural.js';

test('V0.15 neural experimental server can be constructed', async () => {
  const server = createMtgServerV15Neural();
  assert.ok(server);
  const close = (server as unknown as { close?: () => Promise<void> | void }).close;
  if (close) await close.call(server);
});
