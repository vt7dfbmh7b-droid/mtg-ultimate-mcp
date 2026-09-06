import assert from 'node:assert/strict';
import { unlink, writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { fetchPreconDeckV10 } from '../src/services/precons-v10.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';

const FROZEN_PRODUCT_SHA = process.env.FROZEN_PRODUCT_SHA?.trim();
assert.ok(FROZEN_PRODUCT_SHA, 'FROZEN_PRODUCT_SHA must be supplied by the BENCH workflow');
const MAX_NZD_PER_CARD = 50;
const MAX_TOTAL_NZD = 250;
const MAX_SWAPS = 12;
const BREADTHS = [4, 6] as const;

const FIXTURES = [
  {
    id: 'elven-empire',
    reference: 'Elven Empire',
    family: 'typal-tokens-combat',
    targetBracket: 4,
    themeQuery: 'Elves tokens combat',
  },
  {
    id: 'animated-army',
    reference: 'Animated Army',
    family: 'artifact-enchantment-combat',
    targetBracket: 4,
    themeQuery: 'artifacts enchantments combat',
  },
] as const;

type Json = Record<string, unknown>;

function record(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

async function auditDeck(decklist: string): Promise<Json> {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every benchmark deck entry must resolve');
  const legality = validateCommanderDeck(parsed, resolved.cards);
  const evaluation = await evaluateCommanderBuildV15(decklist, {
    optimizedPlanEvidence: false,
    competitiveMetagameEvidence: false,
    constraintDescriptions: ['BENCH-01 candidate-breadth generalization diagnostic; target bracket is measured, not declared.'],
  });
  return {
    cardCount: parsed.totalCards,
    commanderLegal: legality.isLegal,
    unresolvedCount: resolved.notFound.length,
    commanderNames: parsed.commanders.map((entry) => entry.name).sort((a, b) => a.localeCompare(b)),
    assessedBracket: evaluation.actualBracket.assessedBracket,
    assessedBand: evaluation.actualBracket.assessedBand,
    metrics: {
      averageNonlandManaValue: evaluation.metrics.averageNonlandManaValue,
      earlyPlayCount: evaluation.metrics.earlyPlayCount,
      fastManaCount: evaluation.metrics.fastManaCount,
      cheapInteractionCount: evaluation.metrics.cheapInteractionCount,
      tutorCount: evaluation.metrics.tutorCount,
      recursionCount: evaluation.metrics.recursionCount,
      boardWipeCount: evaluation.metrics.boardWipeCount,
      rampCount: evaluation.metrics.rampCount,
      drawCount: evaluation.metrics.drawCount,
      interactionCount: evaluation.metrics.interactionCount,
      protectionCount: evaluation.metrics.protectionCount,
    },
    postBuildEvidence: evaluation.postBuildEvidence,
  };
}

function terminalRound(refinement: Json): Json | null {
  const rounds = Array.isArray(refinement.rounds) ? refinement.rounds.map(record) : [];
  return rounds.length > 0 ? rounds[rounds.length - 1] ?? null : null;
}

async function refineFixture(
  fixture: typeof FIXTURES[number],
  stockDecklist: string,
  before: Json,
  candidatePackagesPerRound: typeof BREADTHS[number],
): Promise<Json> {
  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: `bench01-breadth-generalization-${fixture.id}-${candidatePackagesPerRound}`, version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://bench01-breadth-generalization-${fixture.id}-${candidatePackagesPerRound}.local/mcp`),
    { fetch: (url, init) => handler.fetch(new Request(url, init)) },
  );

  let rawResult: Json = {};
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'refine_precon_v13',
      arguments: {
        reference: fixture.reference,
        profile: 'custom',
        targetBracket: fixture.targetBracket,
        maxNzdPerCard: MAX_NZD_PER_CARD,
        maxTotalNzd: MAX_TOTAL_NZD,
        maxSwaps: MAX_SWAPS,
        maxRounds: 4,
        swapsPerRound: 4,
        candidatePackagesPerRound,
        minimumImprovementScore: 0.1,
        themeQuery: fixture.themeQuery,
        simulationIterations: 400,
        simulationTurns: 7,
        seed: 20260906,
        detailLevel: 'detailed',
      },
    }, { timeout: 30 * 60_000 }) as unknown as { content: Array<{ type: string; text?: string }>; isError?: boolean };
    assert.notEqual(response.isError, true, `${fixture.reference} breadth ${candidatePackagesPerRound} refinement must execute`);
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, `${fixture.reference} breadth ${candidatePackagesPerRound} refinement must return JSON`);
    rawResult = JSON.parse(text) as Json;
  } finally {
    await client.close();
    await handler.close();
  }

  const preconResult = record(rawResult.result);
  const refinement = record(preconResult.refinement);
  const finalDecklist = typeof refinement.finalDecklist === 'string' && refinement.finalDecklist.trim()
    ? refinement.finalDecklist.trim()
    : stockDecklist.trim();
  const after = await auditDeck(finalDecklist);
  assert.deepEqual(after.commanderNames, before.commanderNames, `${fixture.reference} must preserve the command zone`);

  return {
    candidatePackagesPerRound,
    status: refinement.status ?? null,
    reason: refinement.reason ?? null,
    totalSwaps: finite(refinement.totalSwaps),
    assessedBracket: finite(after.assessedBracket),
    before,
    after,
    terminalRound: terminalRound(refinement),
    rawRefinement: refinement,
  };
}

async function runFixture(fixture: typeof FIXTURES[number]): Promise<Json> {
  const stock = await fetchPreconDeckV10(fixture.reference);
  const before = await auditDeck(stock.decklist);
  assert.equal(before.cardCount, 100, `${fixture.reference} stock fixture must contain 100 cards`);
  assert.equal(before.commanderLegal, true, `${fixture.reference} stock fixture must be Commander legal`);

  const breadth4 = await refineFixture(fixture, stock.decklist, before, 4);
  const breadth6 = await refineFixture(fixture, stock.decklist, before, 6);
  const swaps4 = finite(breadth4.totalSwaps);
  const swaps6 = finite(breadth6.totalSwaps);
  const bracket4 = finite(breadth4.assessedBracket);
  const bracket6 = finite(breadth6.assessedBracket);

  return {
    fixture: `BENCH-01 candidate breadth generalization / ${fixture.reference}`,
    family: fixture.family,
    reference: fixture.reference,
    themeQuery: fixture.themeQuery,
    productRuntimeBaselineSha: FROZEN_PRODUCT_SHA,
    sourceFrozenWithinBatch: true,
    diagnosticContract: {
      comparedCandidatePackagesPerRound: BREADTHS,
      allOtherFixtureInputsIdenticalBetweenBreadths: true,
      sameStockDeckWithinFixture: true,
      sameSeedWithinFixture: true,
    },
    breadth4,
    breadth6,
    comparison: {
      additionalSwapsAtBreadth6: swaps6 - swaps4,
      bracketDeltaAtBreadth6: bracket6 - bracket4,
      broaderCandidateBreadthChangedOutcome: swaps6 !== swaps4 || bracket6 !== bracket4,
      broaderCandidateBreadthImprovedOutcome: swaps6 > swaps4 || bracket6 > bracket4,
    },
  };
}

async function main(): Promise<void> {
  await unlink('bench01-candidate-breadth-generalization-result.json').catch(() => undefined);
  const results: Json[] = [];
  for (const fixture of FIXTURES) results.push(await runFixture(fixture));

  const changedFixtures = results
    .filter((result) => record(result.comparison).broaderCandidateBreadthChangedOutcome === true)
    .map((result) => result.reference);
  const improvedFixtures = results
    .filter((result) => record(result.comparison).broaderCandidateBreadthImprovedOutcome === true)
    .map((result) => result.reference);

  const output = {
    schema: 'bench01-candidate-breadth-generalization-v1',
    batch: 'BENCH-01-CANDIDATE-BREADTH-GENERALIZATION',
    productRuntimeBaselineSha: FROZEN_PRODUCT_SHA,
    sourceFrozenWithinBatch: true,
    noCommanderIntelligenceChangesBetweenFixturesOrBreadths: true,
    comparedCandidatePackagesPerRound: BREADTHS,
    purpose: 'Test whether Explorers of the Deep breadth sensitivity reproduces in unrelated unseen Commander families before authorizing any generic candidate-discovery/ranking repair.',
    interpretationRule: 'Repeated breadth-6 improvement across unrelated families supports a generic bounded candidate-discovery defect. No repeat means Explorers remains isolated evidence and does not authorize a product change.',
    changedFixtures,
    improvedFixtures,
    results,
  };

  await writeFile('bench01-candidate-breadth-generalization-result.json', `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  await writeFile('bench01-candidate-breadth-generalization-failure.txt', `${message}\n`);
  console.error(message);
  process.exitCode = 1;
});
