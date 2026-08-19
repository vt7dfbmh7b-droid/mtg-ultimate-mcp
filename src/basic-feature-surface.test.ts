import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createCurrentMtgServer } from './server-current.js';

const PREFERRED_STABLE_BASIC_TOOLS = [
  'card_lookup',
  'card_intelligence_v05',
  'card_search',
  'compare_cards',
  'check_commander_rules',
  'check_card_for_commander',
  'analyze_deck',
  'analyze_mana_base_v04',
  'simulate_deck_consistency',
  'simulate_pod_pressure_v04',
  'find_deck_combos',
  'estimate_commander_bracket',
  'printing_lookup',
  'find_printings_in_family_v08',
  'list_commander_precons_v10',
  'get_precon_stock_deck_v10',
  'analyze_precon_v10',
  'pricing_policy_v13',
  'price_card_nzd_v13',
  'refine_precon_v13',
  'build_and_refine_commander_deck_v13',
] as const;

const EXPERIMENTAL_TOOLS_THAT_MUST_NOT_LEAK_STABLE = [
  'build_commander_through_pipeline_v15',
  'assess_bracket_ceiling_v15',
  'train_neural_ranker_v15',
  'evaluate_neural_temporal_corpus_v15',
  'detect_metagame_drift_v15',
] as const;

test('stable runtime exposes one documented preferred surface for ordinary MTG/Commander jobs', async () => {
  const handler = createMcpHandler(createCurrentMtgServer);
  const client = new Client({ name: 'basic-feature-surface-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = new Set(tools.map((tool) => tool.name));

    for (const name of PREFERRED_STABLE_BASIC_TOOLS) {
      assert.equal(names.has(name), true, `preferred basic tool ${name} must remain available on stable`);
    }
    for (const name of EXPERIMENTAL_TOOLS_THAT_MUST_NOT_LEAK_STABLE) {
      assert.equal(names.has(name), false, `experimental tool ${name} must not leak into stable`);
    }
  } finally {
    await client.close();
    await handler.close();
  }
});
