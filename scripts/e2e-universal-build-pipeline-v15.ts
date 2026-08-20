import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function callUniversalPipelineThroughMcp(): Promise<Record<string, unknown>> {
  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'mtg-ultimate-v15-live-boundary', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://live-control.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'build_commander_through_pipeline_v15',
      arguments: {
        commanders: [
          { name: 'Najeela, the Blade-Blossom', set: 'FCA', collectorNumber: '42' },
        ],
        targetBracket: 4,
        printingFamily: 'Final Fantasy',
        includePromos: true,
        includeSpecialReleases: true,
        winPackageMode: 'prefer',
        maxWinPackageCards: 3,
      },
    }, { timeout: 5 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    assert.notEqual(response.isError, true, 'live universal pipeline MCP call must not return a transport/tool error');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'live universal pipeline MCP call must return JSON text content');
    return JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
    await handler.close();
  }
}

async function main(): Promise<void> {
  console.log('UNIVERSAL COMMANDER MCP PIPELINE LIVE CONTROL');
  console.log('CASE: V0.15 MCP boundary -> Najeela, Final Fantasy physical printings only, requested Bracket 4, verified win packages preferred.');
  console.log('PASS CONDITION: resolve the exact commander at MCP boundary, preserve constraints, run the real universal pipeline, construct a legal exact 100, and report actual achieved bracket honestly.');

  const result = await callUniversalPipelineThroughMcp();

  assert.equal(result.status, 'complete-evaluated-build', `pipeline must complete and pass hard gates; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, 4, 'requested target must remain explicit and unchanged');
  const boundary = record(result.mcpBoundary);
  assert.equal(boundary.tool, 'build_commander_through_pipeline_v15', 'live control must cross the actual V0.15 MCP tool boundary');
  assert.equal(boundary.experimental, true, 'live MCP boundary must remain explicitly experimental');
  assert.equal(boundary.exactCommanderResolutionPassed, true, 'exact commander resolution must pass before construction');
  assert.equal(boundary.requestedCommanderCount, 1);
  assert.equal(boundary.resolvedCommanderCount, 1);
  const resolvedCommanders = Array.isArray(result.resolvedCommanders) ? result.resolvedCommanders.map(record) : [];
  assert.equal(resolvedCommanders.length, 1, 'exact resolved commander provenance must be retained');
  assert.equal(resolvedCommanders[0]?.name, 'Najeela, the Blade-Blossom');
  assert.equal(resolvedCommanders[0]?.set, 'FCA');
  assert.equal(resolvedCommanders[0]?.collectorNumber, '42');

  const plan = record(result.plan);
  assert.equal(plan.lane, 'targeted-v07', 'an explicit target must use the targeted construction lane');
  const stages = record(result.stages);
  assert.equal(stages.winPackageDiscoveryAttempted, true, 'winning-package discovery must be attempted before construction');
  assert.equal(stages.hardTruthEvaluationCompleted, true, 'hard truth evaluation must run after construction');
  assert.equal(stages.actualBracketAssessedAfterConstruction, true, 'actual bracket must be assessed after the deck exists');
  assert.equal(stages.targetComparedAfterAssessment, true, 'requested-vs-achieved comparison must happen only after actual assessment');

  const packageDiscovery = record(result.packageDiscovery);
  assert.ok(
    packageDiscovery.status === 'verified-win-packages-found'
      || packageDiscovery.status === 'no-verified-win-package'
      || packageDiscovery.status === 'verification-unavailable',
    'package discovery must distinguish verified package, verified absence, and unavailable verification',
  );
  if (packageDiscovery.status === 'verification-unavailable') {
    assert.notEqual(packageDiscovery.sourceCompleteness, 'complete', 'unavailable verification cannot be reported as a complete search');
  }

  const selectedPackage = record(result.selectedPackage);
  const evaluation = record(result.evaluation);
  const postBuildEvidence = record(evaluation.postBuildEvidence);
  if (Object.keys(selectedPackage).length > 0) {
    assert.equal(stages.winPackageSeeded, true, 'preferred verified package should be seeded before deck construction');
    if (postBuildEvidence.comboVerificationComplete === true) {
      assert.equal(result.seededPackageVerifiedInFinalDeck, true, 'when final combo verification completes, the exact seeded combo ID must survive in the final 100');
    } else {
      assert.equal(result.seededPackageVerifiedInFinalDeck, false, 'an unavailable final combo source must not manufacture seeded-package verification');
    }
  }

  const actualBracket = record(evaluation.actualBracket);
  assert.equal(actualBracket.hardGatesPassed, true, 'final deck must pass legality/count/resolution/printing hard gates');
  assert.equal(evaluation.printingPolicySatisfied, true, 'final exact physical printings must satisfy the FF policy');
  const parsed = record(evaluation.parsed);
  assert.equal(parsed.totalCards, 100, 'final deck must contain exactly 100 Commander cards');
  assert.equal(evaluation.externalEvidenceChecked, true, 'external evidence should only be checked after hard gates pass');
  const built = record(result.built);
  assert.equal(typeof built.decklist, 'string', 'MCP result must retain the exact final decklist');
  assert.ok((built.decklist as string).includes('Najeela, the Blade-Blossom'), 'exact final decklist must retain commander identity');

  const targetComparison = record(result.targetComparison);
  assert.equal(targetComparison.requestedBracket, 4, 'target comparison must preserve the requested Bracket 4');
  assert.equal(targetComparison.achievedBracket, 4, 'live control should still honestly assess the finished build as Bracket 4');
  assert.equal(targetComparison.status, 'reached', 'a Bracket 4 result for a Bracket 4 request must be reported as reached');
  const relevantChecks = Array.isArray(targetComparison.relevantChecks) ? targetComparison.relevantChecks.map(record) : [];
  assert.equal(
    relevantChecks.some((check) => /cedh|metagame/i.test(`${String(check.key ?? '')} ${String(check.label ?? '')} ${String(check.detail ?? '')}`)),
    false,
    'Bracket 4 comparison must not leak Bracket 5/cEDH metagame blockers',
  );

  const summary = {
    schema: 'universal-build-pipeline-mcp-live-v15.3',
    mcpBoundary: boundary,
    resolvedCommanders,
    requestedTargetBracket: result.requestedTargetBracket,
    achievedBracket: result.achievedBracket,
    achievedBand: result.achievedBand,
    bracketConfidence: result.bracketConfidence,
    targetGap: result.targetGap,
    targetComparison,
    packageDiscoveryStatus: packageDiscovery.status,
    packageDiscoveryCompleteness: packageDiscovery.sourceCompleteness,
    selectedPackage: Object.keys(selectedPackage).length > 0 ? selectedPackage : null,
    seededPackageVerifiedInFinalDeck: result.seededPackageVerifiedInFinalDeck,
    stages,
    hardGatesPassed: actualBracket.hardGatesPassed,
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    cardCount: parsed.totalCards,
    exactDecklistRetained: typeof built.decklist === 'string',
    externalEvidenceComplete: evaluation.externalEvidenceComplete,
    postBuildEvidence,
    perCardBudgetAudit: result.perCardBudgetAudit,
    themeAudit: result.themeAudit,
    ceilingExplanation: result.ceilingExplanation,
  };
  await writeFile('universal-build-pipeline-live-result.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`MCP BOUNDARY: ${String(boundary.tool)} / exact commander resolution=${String(boundary.exactCommanderResolutionPassed)}`);
  console.log(`ACHIEVED: Bracket ${String(result.achievedBracket)} / ${String(result.achievedBand)}`);
  console.log(`TARGET STATUS: ${String(targetComparison.status)}`);
  console.log(`TARGET GAP: ${String(result.targetGap)}`);
  console.log(`PACKAGE DISCOVERY: ${String(packageDiscovery.status)} / ${String(packageDiscovery.sourceCompleteness)}`);
  console.log(`SEEDED PACKAGE VERIFIED IN FINAL DECK: ${String(result.seededPackageVerifiedInFinalDeck)}`);
  console.log(`EXTERNAL EVIDENCE COMPLETE: ${String(evaluation.externalEvidenceComplete)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('universal-build-pipeline-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
