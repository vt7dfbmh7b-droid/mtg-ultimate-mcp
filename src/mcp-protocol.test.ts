import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server';
import { createCurrentMtgServer } from './server-current.js';
import { createMtgServerV15Neural } from './server-v15-neural.js';

async function listToolNames(
  factory: () => McpServer,
  versionNegotiation: 'legacy' | 'auto',
): Promise<string[]> {
  const handler = createMcpHandler(factory);
  const client = new Client(
    { name: 'mtg-ultimate-protocol-test', version: '1.0.0' },
    versionNegotiation === 'auto' ? { versionNegotiation: { mode: 'auto' } } : undefined,
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    return tools.map((tool) => tool.name).sort();
  } finally {
    await client.close();
    await handler.close();
  }
}

test('stable current server completes MCP handshake and advertises V0.13 tools', async () => {
  const tools = await listToolNames(createCurrentMtgServer, 'legacy');

  assert.ok(tools.includes('pricing_policy_v13'));
  assert.ok(tools.includes('price_card_nzd_v13'));
  assert.ok(tools.includes('refine_precon_v13'));
  assert.ok(tools.includes('build_and_refine_commander_deck_v13'));
  assert.equal(tools.includes('train_neural_ranker_v15'), false, 'experimental neural tools must not leak into the stable runtime');
});

test('experimental V0.15 neural server negotiates modern MCP and advertises research and learning tools', async () => {
  const tools = await listToolNames(createMtgServerV15Neural, 'auto');

  assert.ok(tools.includes('deep_research_commander_v15'));
  assert.ok(tools.includes('synthesize_deep_research_v15'));
  assert.ok(tools.includes('audit_learning_corpus_v15'));
  assert.ok(tools.includes('train_neural_ranker_v15'));
  assert.ok(tools.includes('score_candidate_with_neural_v15'));
  assert.ok(tools.includes('refine_precon_v13'), 'experimental server must retain stable V0.13 tools underneath');
});
