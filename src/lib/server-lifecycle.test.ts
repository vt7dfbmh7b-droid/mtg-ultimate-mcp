import assert from 'node:assert/strict';
import test from 'node:test';
import { gracefulShutdown } from './server-lifecycle.js';

function mockServer(close: (callback: (error?: Error) => void) => void) {
  const calls: string[] = [];
  return {
    calls,
    close(callback: (error?: Error) => void) {
      calls.push('close');
      close(callback);
    },
    closeIdleConnections() {
      calls.push('close-idle');
    },
    closeAllConnections() {
      calls.push('close-all');
    },
  };
}

test('graceful shutdown drains HTTP before closing MCP and is idempotent for an already-closed server', async () => {
  const server = mockServer((callback) => callback());
  const events: string[] = [];
  const result = await gracefulShutdown({
    server,
    closeMcp: async () => {
      events.push('mcp-close');
    },
    timeoutMs: 100,
  });

  assert.deepEqual(server.calls, ['close', 'close-idle']);
  assert.deepEqual(events, ['mcp-close']);
  assert.deepEqual(result, { forcedHttpClose: false, mcpCloseTimedOut: false });
});

test('graceful shutdown force-closes stuck HTTP connections after the deadline', async () => {
  const server = mockServer(() => undefined);
  const events: string[] = [];
  const result = await gracefulShutdown({
    server,
    closeMcp: async () => {
      events.push('mcp-close');
    },
    timeoutMs: 10,
  });

  assert.deepEqual(server.calls, ['close', 'close-idle', 'close-all']);
  assert.deepEqual(events, ['mcp-close']);
  assert.equal(result.forcedHttpClose, true);
  assert.equal(result.mcpCloseTimedOut, false);
});

test('graceful shutdown bounds a stuck MCP close as well as HTTP draining', async () => {
  const server = mockServer((callback) => callback());
  const result = await gracefulShutdown({
    server,
    closeMcp: () => new Promise<void>(() => undefined),
    timeoutMs: 10,
  });

  assert.deepEqual(result, { forcedHttpClose: false, mcpCloseTimedOut: true });
});

test('already-closed HTTP server errors are treated as a completed drain', async () => {
  const server = mockServer((callback) => callback(Object.assign(new Error('closed'), { code: 'ERR_SERVER_NOT_RUNNING' })));
  const result = await gracefulShutdown({
    server,
    closeMcp: async () => undefined,
    timeoutMs: 100,
  });

  assert.equal(result.forcedHttpClose, false);
});

test('a non-terminal HTTP close error is surfaced after MCP cleanup', async () => {
  const server = mockServer((callback) => callback(new Error('close failed')));
  const events: string[] = [];
  const result = await gracefulShutdown({
    server,
    closeMcp: async () => {
      events.push('mcp-close');
    },
    timeoutMs: 100,
  });

  assert.deepEqual(server.calls, ['close', 'close-idle', 'close-all']);
  assert.deepEqual(events, ['mcp-close']);
  assert.equal(result.forcedHttpClose, true);
  assert.equal(result.httpCloseError?.message, 'close failed');
});

test('an MCP close error is surfaced without leaving an unhandled rejection', async () => {
  const server = mockServer((callback) => callback());
  const result = await gracefulShutdown({
    server,
    closeMcp: async () => {
      throw new Error('mcp close failed');
    },
    timeoutMs: 100,
  });

  assert.equal(result.mcpCloseError?.message, 'mcp close failed');
});
