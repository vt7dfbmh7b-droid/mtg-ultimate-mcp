import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server';
import { createCurrentMtgServer } from './server-current.js';
import { createMtgServerV15 } from './server-v15.js';

async function listedToolNames(factory: () => McpServer): Promise<string[]> {
  const handler = createMcpHandler(factory);
  const client = new Client(
    { name: 'mtg-ultimate-v15-tutor-value-registration-test', version: '1.0.0' },
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

test('experimental V0.15 exposes verified-route tutor value while stable current V0.13 does not', async () => {
  const v15 = await listedToolNames(createMtgServerV15);
  assert.equal(v15.includes('audit_verified_route_tutor_value_v15'), true);
  assert.equal(v15.includes('build_commander_through_pipeline_v15'), true);

  const stable = await listedToolNames(createCurrentMtgServer);
  assert.equal(stable.includes('audit_verified_route_tutor_value_v15'), false);
  assert.equal(stable.includes('build_commander_through_pipeline_v15'), false);
});
