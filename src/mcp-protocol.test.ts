import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server';
import { createCurrentMtgServer } from './server-current.js';
import { createMtgServerV15Neural } from './server-v15-neural.js';

type ProtocolMode = 'legacy' | 'auto';
type ToolJson = Record<string, unknown>;

async function withClient<T>(
  factory: () => McpServer,
  versionNegotiation: ProtocolMode,
  action: (client: Client) => Promise<T>,
): Promise<T> {
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
    return await action(client);
  } finally {
    await client.close();
    await handler.close();
  }
}

async function listToolNames(factory: () => McpServer, versionNegotiation: ProtocolMode): Promise<string[]> {
  return withClient(factory, versionNegotiation, async (client) => {
    const { tools } = await client.listTools();
    return tools.map((tool) => tool.name).sort();
  });
}

async function callToolJson(client: Client, name: string, args: Record<string, unknown>): Promise<ToolJson> {
  const result = await client.callTool({ name, arguments: args }) as unknown as {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  assert.notEqual(result.isError, true, `${name} should not return an MCP tool error`);
  const text = result.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
  assert.ok(text, `${name} should return JSON text content`);
  return JSON.parse(text) as ToolJson;
}

test('stable current server completes MCP handshake and advertises V0.13 tools', async () => {
  const tools = await listToolNames(createCurrentMtgServer, 'legacy');

  assert.ok(tools.includes('pricing_policy_v13'));
  assert.ok(tools.includes('price_card_nzd_v13'));
  assert.ok(tools.includes('refine_precon_v13'));
  assert.ok(tools.includes('build_and_refine_commander_deck_v13'));
  assert.equal(tools.includes('assess_bracket_ceiling_v15'), false, 'experimental conservative grading must not leak into the stable runtime');
  assert.equal(tools.includes('train_neural_ranker_v15'), false, 'experimental neural tools must not leak into the stable runtime');
  assert.equal(tools.includes('evaluate_neural_temporal_corpus_v15'), false, 'experimental temporal neural evaluation must not leak into the stable runtime');
  assert.equal(tools.includes('detect_metagame_drift_v15'), false, 'experimental drift diagnostics must not leak into the stable runtime');
});

test('experimental V0.15 neural server negotiates modern MCP and advertises research and learning tools', async () => {
  const tools = await listToolNames(createMtgServerV15Neural, 'auto');

  assert.ok(tools.includes('assess_bracket_ceiling_v15'));
  assert.ok(tools.includes('deep_research_commander_v15'));
  assert.ok(tools.includes('synthesize_deep_research_v15'));
  assert.ok(tools.includes('audit_learning_corpus_v15'));
  assert.ok(tools.includes('detect_metagame_drift_v15'));
  assert.ok(tools.includes('evaluate_neural_temporal_corpus_v15'));
  assert.ok(tools.includes('train_neural_ranker_v15'));
  assert.ok(tools.includes('score_candidate_with_neural_v15'));
  assert.ok(tools.includes('refine_precon_v13'), 'experimental server must retain stable V0.13 tools underneath');
});

test('conservative bracket ceiling refuses to turn target 5 into evidence for achieved 5', async () => {
  await withClient(createMtgServerV15Neural, 'auto', async (client) => {
    const assessment = await callToolJson(client, 'assess_bracket_ceiling_v15', {
      targetBracket: 5,
      constraints: ['FINAL FANTASY physical printings only'],
      signals: {
        commanderLegal: true,
        exactCardCount: true,
        fullyResolved: true,
        printingPolicyCompliant: true,
        spellbookTag: 'R',
        verifiedWinningCombos: 2,
        ruthlessWinningCombos: 1,
        strategicallyRelevantCombos: 1,
        averageNonlandManaValue: 2.1,
        earlyPlayCount: 44,
        fastManaCount: 7,
        freeInteractionCount: 4,
        cheapInteractionCount: 13,
        tutorCount: 8,
        gameChangerCount: 5,
        optimizedPlanEvidence: true,
        cedhIntent: true,
        competitiveMetagameEvidence: false,
      },
    });

    assert.equal(assessment.assessedBracket, 4);
    assert.equal(assessment.assessedBand, 'high-bracket-4-cedh-construction-candidate');
    assert.equal(assessment.bracket5CertifiedByThisAssessment, false);
    const reasons = assessment.ceilingReasons as string[];
    assert.ok(reasons.some((reason) => reason.includes('metagame')));
  });
});

test('deep-learning readiness accepts corpus quality rates through the real MCP tool boundary', async () => {
  await withClient(createMtgServerV15Neural, 'auto', async (client) => {
    const readiness = await callToolJson(client, 'evaluate_deep_learning_readiness_v15', {
      labelledExamples: 3000,
      positiveExamples: 1600,
      negativeExamples: 1400,
      temporalCoverageDays: 365,
      independentEvidenceGroups: 8,
      evidenceClassCount: 5,
      duplicateRate: 0.03,
      conflictRate: 0.03,
      malformedRate: 0,
      leakageChecksPassed: true,
      transparentBaselineAccuracy: 0.76,
      candidateModelAccuracy: 0.82,
      temporalHoldoutExamples: 500,
    });

    assert.equal(readiness.status, 'not-ready');
    const blockers = readiness.blockers as string[];
    assert.ok(blockers.some((blocker) => blocker.includes('Conflicting outcome')));
  });
});

test('temporal neural evaluator fingerprints, splits and scores a corpus through MCP', async () => {
  await withClient(createMtgServerV15Neural, 'auto', async (client) => {
    const fingerprintResult = await callToolJson(client, 'fingerprint_exact_deck_v15', {
      decklist: `// COMMANDER
1 Kinnan, Bonder Prodigy (IKO) 192

// MAIN
1 Sol Ring (CMM) 396
98 Forest (M21) 272`,
    });
    const fingerprint = fingerprintResult.fingerprint;
    assert.equal(typeof fingerprint, 'string');
    assert.equal((fingerprint as string).length, 64);

    const patterns = [
      { a: -1, b: -1, label: 0 },
      { a: -1, b: 1, label: 1 },
      { a: 1, b: -1, label: 1 },
      { a: 1, b: 1, label: 0 },
    ];
    const start = Date.UTC(2026, 0, 1);
    const records = Array.from({ length: 40 }, (_, index) => {
      const pattern = patterns[index % patterns.length];
      if (!pattern) throw new Error('missing protocol XOR fixture');
      return {
        outcomeId: `protocol-outcome-${index}`,
        observedAt: new Date(start + index * 86_400_000).toISOString(),
        sourceId: index % 2 === 0 ? 'topdeck' : 'playgroup',
        evidenceClass: index % 2 === 0 ? 'observed-results' : 'recorded-games',
        independentGroup: `protocol-event-${index}`,
        leakageGroup: `protocol-event-${index}`,
        deckFingerprint: fingerprint,
        commanderNames: ['Kinnan, Bonder Prodigy'],
        features: {
          tournamentSupport: pattern.a,
          comboVerification: pattern.b,
        },
        label: pattern.label,
      };
    });

    const drift = await callToolJson(client, 'detect_metagame_drift_v15', {
      records,
      minimumWindowRecords: 20,
    });
    assert.equal(drift.severity, 'insufficient');

    const evaluation = await callToolJson(client, 'evaluate_neural_temporal_corpus_v15', {
      records,
      holdoutFraction: 0.2,
      epochs: 120,
      seed: 42,
    });
    const split = evaluation.split as { trainingRecords: number; holdoutRecords: number; leakageChecksPassed: boolean };
    const neuralMetrics = evaluation.neuralTemporalMetrics as { examples: number };
    const transparentMetrics = evaluation.transparentTemporalMetrics as { examples: number };

    assert.equal(split.trainingRecords, 32);
    assert.equal(split.holdoutRecords, 8);
    assert.equal(split.leakageChecksPassed, true);
    assert.equal(neuralMetrics.examples, 8);
    assert.equal(transparentMetrics.examples, 8);
  });
});
