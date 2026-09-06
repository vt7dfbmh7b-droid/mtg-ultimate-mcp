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
const CANDIDATE_PACKAGES_PER_ROUND = 6;

const FIXTURES = [
  {
    id: 'quick-draw',
    reference: 'Quick Draw',
    family: 'spellslinger-control',
    targetBracket: 4,
    themeQuery: 'spellslinger card draw countermagic',
    originalBatchDTotalSwaps: 8,
    originalBatchDBracket: 3,
  },
  {
    id: 'virtue-and-valor',
    reference: 'Virtue and Valor',
    family: 'enchantment-combat',
    targetBracket: 4,
    themeQuery: 'enchantments combat card draw',
    originalBatchDTotalSwaps: 4,
    originalBatchDBracket: 2,
  },
  {
    id: 'explorers-of-the-deep',
    reference: 'Explorers of the Deep',
    family: 'typal-counters-combat',
    targetBracket: 4,
    themeQuery: 'Merfolk +1/+1 counters card draw combat',
    originalBatchDTotalSwaps: 4,
    originalBatchDBracket: 2,
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
    constraintDescriptions: ['BENCH-01 Batch D candidate-breadth diagnostic; target bracket is measured, not declared.'],
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

async function runFixture(fixture: typeof FIXTURES[number]): Promise<Json> {
  const stock = await fetchPreconDeckV10(fixture.reference);
  const before = await auditDeck(stock.decklist);
  assert.equal(before.cardCount, 100, `${fixture.reference} stock fixture must contain 100 cards`);
  assert.equal(before.commanderLegal, true, `${fixture.reference} stock fixture must be Commander legal`);

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: `bench01-batch-d-breadth-${fixture.id}`, version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL(`http://bench01-batch-d-breadth-${fixture.id}.local/mcp`), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

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
        candidatePackagesPerRound: CANDIDATE_PACKAGES_PER_ROUND,
        minimumImprovementScore: 0.1,
        themeQuery: fixture.themeQuery,
        simulationIterations: 400,
        simulationTurns: 7,
        seed: 20260906,
        detailLevel: 'detailed',
      },
    }, { timeout: 30 * 60_000 }) as unknown as { content: Array<{ type: string; text?: string }>; isError?: boolean };
    assert.notEqual(response.isError, true, `${fixture.reference} MCP refinement must execute`);
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, `${fixture.reference} MCP refinement must return JSON`);
    rawResult = JSON.parse(text) as Json;
  } finally {
    await client.close();
    await handler.close();
  }

  const preconResult = record(rawResult.result);
  const refinement = record(preconResult.refinement);
  const finalDecklist = typeof refinement.finalDecklist === 'string' && refinement.finalDecklist.trim()
    ? refinement.finalDecklist.trim()
    : stock.decklist.trim();
  const after = await auditDeck(finalDecklist);
  assert.deepEqual(after.commanderNames, before.commanderNames, `${fixture.reference} must preserve the command zone`);

  const observedTotalSwaps = finite(refinement.totalSwaps);
  const observedBracket = finite(after.assessedBracket);
  const terminal = terminalRound(refinement);

  return {
    fixture: `BENCH-01 Batch D candidate breadth / ${fixture.reference}`,
    family: fixture.family,
    reference: fixture.reference,
    productRuntimeBaselineSha: FROZEN_PRODUCT_SHA,
    sourceFrozenWithinBatch: true,
    diagnosticChangeOnly: {
      originalCandidatePackagesPerRound: 4,
      diagnosticCandidatePackagesPerRound: CANDIDATE_PACKAGES_PER_ROUND,
      allOtherFixtureInputsUnchanged: true,
    },
    originalBatchD: {
      totalSwaps: fixture.originalBatchDTotalSwaps,
      assessedBracket: fixture.originalBatchDBracket,
    },
    diagnosticOutcome: {
      status: refinement.status ?? null,
      reason: refinement.reason ?? null,
      totalSwaps: observedTotalSwaps,
      assessedBracket: observedBracket,
      additionalSwapsVsOriginal: observedTotalSwaps - fixture.originalBatchDTotalSwaps,
      bracketDeltaVsOriginal: observedBracket - fixture.originalBatchDBracket,
      broaderCandidateBreadthChangedOutcome:
        observedTotalSwaps !== fixture.originalBatchDTotalSwaps || observedBracket !== fixture.originalBatchDBracket,
    },
    before,
    after,
    terminalRound: terminal,
    rawRefinement: refinement,
  };
}

async function main(): Promise<void> {
  await unlink('bench01-batch-d-candidate-breadth-result.json').catch(() => undefined);
  const results: Json[] = [];
  for (const fixture of FIXTURES) results.push(await runFixture(fixture));

  const changedFixtures = results
    .filter((result) => record(result.diagnosticOutcome).broaderCandidateBreadthChangedOutcome === true)
    .map((result) => result.reference);

  const output = {
    schema: 'bench01-batch-d-candidate-breadth-v1',
    batch: 'BENCH-01-D-CANDIDATE-BREADTH',
    productRuntimeBaselineSha: FROZEN_PRODUCT_SHA,
    sourceFrozenWithinBatch: true,
    noCommanderIntelligenceChangesBetweenFixtures: true,
    candidatePackagesPerRound: CANDIDATE_PACKAGES_PER_ROUND,
    purpose: 'Test whether the Batch D terminal component-preservation vetoes are sensitive to the optimizer supported candidate-package breadth before authorizing any product discovery/ranking repair.',
    interpretationRule: 'A repeated improvement for Virtue and Valor and Explorers of the Deep under otherwise identical inputs is evidence that bounded package diversification can hide viable alternatives. No improvement strengthens, but does not by itself prove, the expected-construction-ceiling interpretation.',
    changedFixtures,
    results,
  };

  await writeFile('bench01-batch-d-candidate-breadth-result.json', `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(async (error) => {
  await writeFile(
    'bench01-batch-d-candidate-breadth-failure.txt',
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  ).catch(() => undefined);
  throw error;
});
