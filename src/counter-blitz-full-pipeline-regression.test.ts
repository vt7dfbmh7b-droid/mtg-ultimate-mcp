import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from './server-v15.js';
import { rankGeneralWinPackageVariantsV15 } from './services/general-win-package-v15.js';
import { discoverEligiblePoolV15 } from './services/neutral-deck-builder-v15.js';
import { resolvePrintingPolicyV08 } from './services/printing-policy-v08.js';
import { searchSpellbookVariantsEvidence } from './services/spellbook.js';
import { collectBoundedSpellbookVariantsV15 } from './services/win-package-pagination-v15.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

async function emitRestrictedPoolDiagnostics(): Promise<void> {
  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const pool = await discoverEligiblePoolV15(['G', 'U', 'W'], policy, undefined);
  const eligible = new Set(pool.map((card) => normalize(card.name)));
  const spellbook = await collectBoundedSpellbookVariantsV15(
    'card<=3 is:winning legal:commander identity<=WUG',
    searchSpellbookVariantsEvidence,
    { pageSize: 100, maxRows: 400, ordering: '-popularity' },
  );
  const ranked = rankGeneralWinPackageVariantsV15(
    spellbook.rows,
    ["Tidus, Yuna's Guardian"],
    { maxPackageCards: 3 },
  );
  const targetNames = [
    'Walking Ballista',
    'Hardened Scales',
    'Gatta and Luzzu',
    'The Destined White Mage',
  ];
  const targetCandidates = ranked.filter((candidate) => {
    const names = Array.isArray(candidate.names) ? candidate.names.map(String).map(normalize) : [];
    return targetNames.some((name) => names.includes(normalize(name)));
  });

  console.log('COUNTER_BLITZ_RESTRICTED_POOL_DIAGNOSTICS_BEGIN');
  console.log(JSON.stringify({
    eligiblePoolCount: pool.length,
    targetEligibility: Object.fromEntries(targetNames.map((name) => [name, eligible.has(normalize(name))])),
    spellbookRows: spellbook.rows.length,
    spellbookTotalMatching: spellbook.totalMatching,
    spellbookVerificationComplete: spellbook.verificationComplete,
    rankedCandidateCount: ranked.length,
    targetCandidates,
    firstTwentyRankedCandidates: ranked.slice(0, 20),
  }, null, 2));
  console.log('COUNTER_BLITZ_RESTRICTED_POOL_DIAGNOSTICS_END');
}

async function buildCounterBlitzThroughPublicPipeline(): Promise<Record<string, unknown>> {
  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'counter-blitz-full-pipeline-regression', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://counter-blitz-regression.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'build_commander_through_pipeline_v15',
      arguments: {
        commanders: [{ name: "Tidus, Yuna's Guardian" }],
        targetBracket: 4,
        printingFamily: 'Final Fantasy',
        includePromos: true,
        includeSpecialReleases: true,
        themeQuery: '+1/+1 counters and proliferate and countermagic and combat',
        winPackageMode: 'require',
        maxWinPackageCards: 3,
      },
    }, { timeout: 8 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };

    assert.notEqual(response.isError, true, 'public pipeline call must not fail at the MCP boundary');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'public pipeline call must return JSON text');
    return JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
    await handler.close();
  }
}

test('BENCH-01 Counter Blitz full-pipeline historical capability regression', { timeout: 9 * 60_000 }, async () => {
  await emitRestrictedPoolDiagnostics();
  const result = await buildCounterBlitzThroughPublicPipeline();

  // Emit the product output before assertions so a failure is still diagnostically useful.
  console.log('COUNTER_BLITZ_FULL_PIPELINE_RESULT_BEGIN');
  console.log(JSON.stringify(result, null, 2));
  console.log('COUNTER_BLITZ_FULL_PIPELINE_RESULT_END');

  assert.equal(result.status, 'complete-evaluated-build', `full pipeline must complete with all requested hard gates; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, 4, 'requested Bracket 4 must remain explicit');

  const boundary = record(result.mcpBoundary);
  assert.equal(boundary.tool, 'build_commander_through_pipeline_v15');
  assert.equal(boundary.exactCommanderResolutionPassed, true);

  const plan = record(result.plan);
  assert.equal(plan.lane, 'targeted-v07', 'explicit Bracket 4 should use the targeted construction lane');

  const stages = record(result.stages);
  assert.equal(stages.commanderStrategyInferred, true);
  assert.equal(stages.winPackageDiscoveryAttempted, true);
  assert.equal(stages.winPackageSeeded, true, 'a verified generic win package is required for this historical capability regression');
  assert.equal(stages.deckConstructed, true);
  assert.equal(stages.hardTruthEvaluationCompleted, true);
  assert.equal(stages.themeConstraintSatisfied, true);

  const evaluation = record(result.evaluation);
  const actualBracket = record(evaluation.actualBracket);
  const parsed = record(evaluation.parsed);
  assert.equal(actualBracket.hardGatesPassed, true, 'final build must pass Commander legality/count/resolution/printing hard gates');
  assert.equal(evaluation.printingPolicySatisfied, true, 'final physical printings must satisfy Final Fantasy-only policy');
  assert.equal(parsed.totalCards, 100, 'final Commander deck must contain exactly 100 cards');
  assert.equal(result.seededPackageVerifiedInFinalDeck, true, 'the generically discovered winning package must survive into the final 100');

  const built = record(result.built);
  assert.equal(typeof built.decklist, 'string', 'full pipeline must retain its exact final decklist');
  assert.ok((built.decklist as string).includes("Tidus, Yuna's Guardian"), 'final deck must retain Tidus as commander');
});
