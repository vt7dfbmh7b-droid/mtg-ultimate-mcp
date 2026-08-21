import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function thresholdSummary(evaluation: Awaited<ReturnType<typeof evaluateCommanderBuildV15>>): Array<Record<string, unknown>> {
  return evaluation.actualBracket.bracket5ThresholdChecks.map((check) => ({
    key: check.key,
    category: check.category,
    observed: check.observed,
    required: check.required,
    passed: check.passed,
    pressurePoint: check.pressurePoint,
  }));
}

async function main(): Promise<void> {
  const startingDecklist = await readFile('test-results/marvel-bracket5/selected-deck.txt', 'utf8');
  assert.ok(startingDecklist.includes('Najeela, the Blade-Blossom'), 'refinement control must start from the selected Marvel-only Najeela live build');

  console.log('MARVEL-ONLY BRACKET 5 REFINEMENT LIVE CONTROL');
  console.log('START: strongest completed Marvel-only targeted build from the first live control.');
  console.log('ACTION: run the existing V0.12 iterative Upgrade/refinement tool at target Bracket 5, then independently re-evaluate with V0.15.');

  const before = await evaluateCommanderBuildV15(startingDecklist, {
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
    cedhIntent: true,
    optimizedPlanEvidence: true,
    competitiveMetagameEvidence: false,
  });
  assert.equal(before.hardGatesPassed, true, 'starting Marvel deck must still pass hard truth');
  assert.equal(before.printingPolicySatisfied, true, 'starting Marvel deck must still pass exact printing policy');

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'mtg-ultimate-v15-marvel-bracket5-refine-live', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://marvel-refine-control.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  let refinement: Record<string, unknown>;
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'refine_commander_deck_v12',
      arguments: {
        decklist: startingDecklist,
        targetBracket: 5,
        printingFamily: 'Marvel',
        includePromos: true,
        includeSpecialReleases: true,
        maxSwaps: 20,
        maxRounds: 5,
        swapsPerRound: 5,
        candidatePackagesPerRound: 5,
        minimumImprovementScore: 0.1,
        simulationIterations: 750,
        simulationTurns: 7,
        seed: 20260821,
        detailLevel: 'detailed',
      },
    }, { timeout: 10 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    assert.notEqual(response.isError, true, 'existing refinement MCP tool must execute without a transport/tool error');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'refinement MCP tool must return JSON text');
    refinement = JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
    await handler.close();
  }

  const finalDecklist = typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist : '';
  assert.ok(finalDecklist.trim(), 'refinement must retain a complete final decklist even when no package is accepted');

  const after = await evaluateCommanderBuildV15(finalDecklist, {
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
    cedhIntent: true,
    optimizedPlanEvidence: true,
    competitiveMetagameEvidence: false,
  });
  assert.equal(after.hardGatesPassed, true, 'refined/final deck must pass hard Commander truth');
  assert.equal(after.printingPolicySatisfied, true, 'refined/final deck must remain Marvel physical printings only');
  assert.equal(after.parsed.totalCards, 100, 'refined/final deck must remain exactly 100 cards');

  const swaps = Array.isArray(refinement.swaps) ? refinement.swaps.map(record) : [];
  const rounds = Array.isArray(refinement.rounds) ? refinement.rounds.map(record) : [];
  const detailedRounds = Array.isArray(refinement.detailedRounds) ? refinement.detailedRounds.map(record) : [];
  const beforeFailed = before.actualBracket.bracket5ThresholdChecks.filter((check) => !check.passed).map((check) => check.key);
  const afterFailed = after.actualBracket.bracket5ThresholdChecks.filter((check) => !check.passed).map((check) => check.key);

  const result = {
    schema: 'marvel-bracket5-refinement-live-v15.2',
    startingDeck: {
      commander: before.parsed.commanders.map((entry) => entry.name),
      assessedBracket: before.actualBracket.assessedBracket,
      assessedBand: before.actualBracket.assessedBand,
      bracket5ConstructionCandidate: before.actualBracket.bracket5ConstructionCandidate,
      failedBracket5Checks: beforeFailed,
      bracket5ThresholdChecks: thresholdSummary(before),
      metrics: before.metrics,
      verifiedWinningCombos: before.postBuildEvidence.verifiedWinningCombos,
    },
    refinement: {
      status: refinement.status ?? null,
      stopReason: refinement.stopReason ?? null,
      roundsAccepted: refinement.roundsAccepted ?? null,
      totalSwaps: refinement.totalSwaps ?? null,
      candidatePackagesPerRound: refinement.candidatePackagesPerRound ?? null,
      estimatedUpgradeSpendUsd: refinement.estimatedUpgradeSpendUsd ?? null,
      swaps,
      rounds,
      detailedRounds,
      constraints: refinement.constraints ?? null,
      winRouteProtection: refinement.winRouteProtection ?? null,
      themeConstraint: refinement.themeConstraint ?? null,
    },
    finalDeck: {
      assessedBracket: after.actualBracket.assessedBracket,
      assessedBand: after.actualBracket.assessedBand,
      bracket5ConstructionCandidate: after.actualBracket.bracket5ConstructionCandidate,
      bracket5Certified: after.actualBracket.bracket5CertifiedByThisAssessment,
      failedBracket5Checks: afterFailed,
      bracket5ThresholdChecks: thresholdSummary(after),
      metrics: after.metrics,
      verifiedWinningCombos: after.postBuildEvidence.verifiedWinningCombos,
      printingPolicySatisfied: after.printingPolicySatisfied,
      cardCount: after.parsed.totalCards,
    },
    delta: {
      bracket: (after.actualBracket.assessedBracket ?? 0) - (before.actualBracket.assessedBracket ?? 0),
      failedBracket5ChecksRemoved: beforeFailed.filter((key) => !afterFailed.includes(key)),
      failedBracket5ChecksAdded: afterFailed.filter((key) => !beforeFailed.includes(key)),
      deckChanged: finalDecklist.trim() !== startingDecklist.trim(),
    },
  };

  await writeFile('marvel-bracket5-refine-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile('marvel-bracket5-refined-deck.txt', `${finalDecklist.trim()}\n`, 'utf8');

  console.log(`REFINEMENT STATUS: ${String(refinement.status)}`);
  console.log(`STOP REASON: ${String(refinement.stopReason)}`);
  console.log(`ROUNDS ACCEPTED: ${String(refinement.roundsAccepted)}`);
  console.log(`TOTAL SWAPS: ${String(refinement.totalSwaps)}`);
  console.log(`DECK CHANGED: ${String(result.delta.deckChanged)}`);
  console.log(`BEFORE: Bracket ${String(before.actualBracket.assessedBracket)} / B5 construction=${String(before.actualBracket.bracket5ConstructionCandidate)}`);
  console.log(`AFTER: Bracket ${String(after.actualBracket.assessedBracket)} / B5 construction=${String(after.actualBracket.bracket5ConstructionCandidate)}`);
  console.log(`BEFORE FAILED B5 CHECKS: ${beforeFailed.join(', ')}`);
  console.log(`AFTER FAILED B5 CHECKS: ${afterFailed.join(', ')}`);
  console.log(`SWAPS: ${JSON.stringify(swaps, null, 2)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('marvel-bracket5-refine-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
