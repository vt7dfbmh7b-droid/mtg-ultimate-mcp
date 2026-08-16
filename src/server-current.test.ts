import assert from 'node:assert/strict';
import test from 'node:test';
import { config } from './config.js';
import { createCurrentMtgServer } from './server-current.js';

test('current MTG Ultimate MCP server constructs with current release metadata', async () => {
  assert.equal(config.version, '0.13.0');
  const server = createCurrentMtgServer();
  assert.ok(server, 'current MCP server should construct');

  const maybeClosable = server as unknown as { close?: () => Promise<void> };
  if (typeof maybeClosable.close === 'function') await maybeClosable.close();
});
