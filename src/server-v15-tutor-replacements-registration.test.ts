import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server';
import { createCurrentMtgServer } from './server-current.js';
import { createMtgServerV15 } from './server-v15.js';

async function listedTools(factory: () => McpServer): Promise<string[]> {
  const handler = createMcpHandler(factory);
  const client = new Client(
    { name: 'mtg-ultimate-v15-tutor-replacement-registration-test', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    return tools.map((tool) => tool.name);
  } finally {
    await client.close();
    await handler.close();
  }
}

test('tutor replacement audit is registered only on experimental V0.15', async () => {
  const experimental = await listedTools(createMtgServerV15);
  assert.equal(experimental.includes('audit_verified_route_tutor_replacements_v15'), true);

  const stable = await listedTools(createCurrentMtgServer);
  assert.equal(stable.includes('audit_verified_route_tutor_replacements_v15'), false);
});
