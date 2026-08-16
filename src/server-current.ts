import type { McpServer } from '@modelcontextprotocol/server';
import { createMtgServerV12 } from './server-v12.js';

/**
 * Stable runtime entry point for the currently supported MTG Ultimate server.
 *
 * Historical version modules remain importable for regression/backward compatibility,
 * but application code should depend on this file so a future release does not require
 * another index.ts import rewrite or another stale version identity.
 */
export function createCurrentMtgServer(): McpServer {
  return createMtgServerV12();
}
