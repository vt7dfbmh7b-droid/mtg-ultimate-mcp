import assert from 'node:assert/strict';
import { unlink, writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { deriveUpgradeStrategyContextV15 } from '../src/services/commander-strategy-affinity-v15.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { fetchPreconDeckV10 } from '../src/services/precons-v10.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';

const PRECON_REFERENCE = 'Cavalry Charge';
const TARGET_BRACKET = 4;
const MAX_NZD_PER_CARD = 35;
const MAX_TOTAL_NZD = 200;
const MAX_SWAPS = 12;
const THEME_QUERY = 'Knights typal combat graveyard recursion reanimation';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

function oracleText(card: { oracle_text?: string; card_faces?: Array<{ oracle_text?: string }> }): string {
  return [card.oracle_text ?? '', ...(card.card_faces ?? []).map((face) => face.oracle_text ?? '')]
    .filter(Boolean)
    .join('\n');
}

async function auditDeck(decklist: string): Promise<Record<string, unknown>> {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact Cavalry Charge deck entry must resolve');
  const legality = validateCommanderDeck(parsed, resolved.cards);
  const context = deriveUpgradeStrategyContextV15(parsed, resolved.cards);
  const evaluation = await evaluateCommanderBuildV15(decklist, {
    optimizedPlanEvidence: false,
    competitiveMetagameEvidence: false,
    constraintDescriptions: [
      `Exact Cavalry Charge stock lineage with at most ${MAX_SWAPS} upgrades.`,
      `NZ$${MAX_NZD_PER_CARD} maximum per added card and NZ$${MAX_TOTAL_NZD} total upgrade budget.`,
      `Natural compound request: ${THEME_QUERY}.`,
      `Target Bracket ${TARGET_BRACKET} is assessed after construction rather than declared from intent.`,
    ],
  });

  const byName = new Map(resolved.cards.map((card) => [card.name.toLocaleLowerCase(), card] as const));
  let knightCreatureCount = 0;
  let combatReferenceCount = 0;
  let graveyardReferenceCount = 0;
  let recursionReanimationCount = 0;

  for (const entry of parsed.main) {
    const card = byName.get(entry.name.toLocaleLowerCase());
    if (!card) continue;
    const text = oracleText(card).toLocaleLowerCase();
    const typeLine = card.type_line.toLocaleLowerCase();
    if (typeLine.includes('creature') && /\bknight\b/.test(typeLine)) knightCreatureCount += entry.quantity;
    if (/\battack(?:s|ing|ed)?\b|\bcombat damage\b|\battacking\b|\bfirst strike\b|\bdouble strike\b|\bmenace\b|\bvigilance\b/.test(text)) {
      combatReferenceCount += entry.quantity;
    }
    if (/\bgraveyard\b/.test(text)) graveyardReferenceCount += entry.quantity;
    if (
      /return [^.\n]{0,100}(?:creature|permanent|card)[^.\n]{0,100}from (?:your|a|the) graveyard/.test(text)
      || /put [^.\n]{0,100}(?:creature|permanent|card)[^.\n]{0,100}from (?:your|a|the) graveyard onto the battlefield/.test(text)
      || /cast [^.\n]{0,100}from (?:your|a|the) graveyard/.test(text)
      || /reanimate/.test(text)
    ) {
      recursionReanimationCount += entry.quantity;
    }
  }

  return {
    cardCount: parsed.totalCards,
    commanderLegal: legality.isLegal,
    unresolvedCount: resolved.notFound.length,
    commanderNames: parsed.commanders.map((entry) => entry.name).sort((a, b) => a.localeCompare(b)),
    commanderStrategies: context.strategies,
    requestedAxes: {
      knightCreatureCount,
      combatReferenceCount,
      graveyardReferenceCount,
      recursionReanimationCount,
    },
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

async function main(): Promise<void> {
  await Promise.all([
    unlink('bench01-batch-b-cavalry-result.json').catch(() => undefined),
    unlink('bench01-batch-b-cavalry-raw-result.json').catch(() => undefined),
    unlink('bench01-batch-b-cavalry-stock-deck.txt').catch(() => undefined),
    unlink('bench01-batch-b-cavalry-refined-deck.txt').catch(() => undefined),
    unlink('bench01-batch-b-cavalry-failure.txt').catch(() => undefined),
  ]);

  const stock = await fetchPreconDeckV10(PRECON_REFERENCE);
  const before = await auditDeck(stock.decklist);
  assert.equal(before.cardCount, 100, 'Cavalry Charge stock fixture must contain exactly 100 cards');
  assert.equal(before.commanderLegal, true, 'Cavalry Charge stock fixture must be Commander legal');
  await writeFile('bench01-batch-b-cavalry-stock-deck.txt', `${stock.decklist.trim()}\n`);

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'bench01-batch-b-cavalry-charge-compound-v15', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://bench01-batch-b-cavalry.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  let rawResult: Record<string, unknown> = {};
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'refine_precon_v13',
      arguments: {
        reference: PRECON_REFERENCE,
        profile: 'custom',
        targetBracket: TARGET_BRACKET,
        maxNzdPerCard: MAX_NZD_PER_CARD,
        maxTotalNzd: MAX_TOTAL_NZD,
        maxSwaps: MAX_SWAPS,
        maxRounds: 4,
        swapsPerRound: 4,
        candidatePackagesPerRound: 4,
        minimumImprovementScore: 0.1,
        themeQuery: THEME_QUERY,
        simulationIterations: 500,
        simulationTurns: 7,
        seed: 20260905,
        detailLevel: 'detailed',
      },
    }, { timeout: 30 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    assert.notEqual(response.isError, true, 'Cavalry Charge compound-plan MCP call must execute');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'Cavalry Charge compound-plan MCP call must return JSON');
    rawResult = JSON.parse(text) as Record<string, unknown>;
    await writeFile('bench01-batch-b-cavalry-raw-result.json', `${JSON.stringify(rawResult, null, 2)}\n`);
  } finally {
    await client.close();
    await handler.close();
  }

  const preconResult = record(rawResult.result);
  const refinement = record(preconResult.refinement);
  const refinementStatus = String(refinement.status ?? 'unknown');
  const candidateFinalDecklist = typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist.trim() : '';
  const finalDecklist = candidateFinalDecklist || stock.decklist.trim();
  const totalSwaps = finite(refinement.totalSwaps);
  await writeFile('bench01-batch-b-cavalry-refined-deck.txt', `${finalDecklist}\n`);

  const after = await auditDeck(finalDecklist);
  assert.deepEqual(after.commanderNames, before.commanderNames, 'Batch B must preserve the exact Cavalry Charge command zone');

  const beforeAxes = record(before.requestedAxes);
  const afterAxes = record(after.requestedAxes);
  const beforeMetrics = record(before.metrics);
  const afterMetrics = record(after.metrics);
  const themeIntent = record(refinement.themeIntent);

  const result = {
    schema: 'bench01-batch-b-cavalry-charge-compound-v1',
    fixture: 'BENCH-01 Batch B / Cavalry Charge unseen compound-plan test',
    productRuntimeBaselineSha: '5829b37b686255ba35d419b37be17095e54fb696',
    sourceRelationship: 'measurement-only descendant; no src intelligence change before fixture execution',
    sourceBaseline: 'MTGJSON exact stock precon',
    precon: {
      name: stock.entry.name,
      fileName: stock.entry.fileName,
      releaseDate: stock.entry.releaseDate,
      commanders: before.commanderNames,
    },
    constraints: {
      targetBracket: TARGET_BRACKET,
      maxNzdPerCard: MAX_NZD_PER_CARD,
      maxTotalNzd: MAX_TOTAL_NZD,
      maxSwaps: MAX_SWAPS,
      themeQuery: THEME_QUERY,
      hardTruthFirst: true,
      targetIsMeasurementNotAutomaticPassClaim: true,
      unseenForBench01: true,
    },
    refinement: {
      status: refinementStatus,
      totalSwaps,
      reason: refinement.reason ?? null,
      themeIntent,
      rawRefinement: refinement,
    },
    before,
    after,
    requestedAxisDeltas: {
      knightCreatureCount: finite(afterAxes.knightCreatureCount) - finite(beforeAxes.knightCreatureCount),
      combatReferenceCount: finite(afterAxes.combatReferenceCount) - finite(beforeAxes.combatReferenceCount),
      graveyardReferenceCount: finite(afterAxes.graveyardReferenceCount) - finite(beforeAxes.graveyardReferenceCount),
      recursionReanimationCount: finite(afterAxes.recursionReanimationCount) - finite(beforeAxes.recursionReanimationCount),
    },
    structuralDeltas: {
      assessedBracket: finite(after.assessedBracket) - finite(before.assessedBracket),
      averageNonlandManaValue: finite(afterMetrics.averageNonlandManaValue) - finite(beforeMetrics.averageNonlandManaValue),
      earlyPlayCount: finite(afterMetrics.earlyPlayCount) - finite(beforeMetrics.earlyPlayCount),
      cheapInteractionCount: finite(afterMetrics.cheapInteractionCount) - finite(beforeMetrics.cheapInteractionCount),
      tutorCount: finite(afterMetrics.tutorCount) - finite(beforeMetrics.tutorCount),
      recursionCount: finite(afterMetrics.recursionCount) - finite(beforeMetrics.recursionCount),
    },
    interpretationOutcome: refinementStatus === 'unsupported-theme'
      ? 'compound-theme-rejected'
      : totalSwaps > 0
        ? 'compound-request-produced-refinement'
        : 'compound-request-executed-without-swaps',
  };

  await writeFile('bench01-batch-b-cavalry-result.json', `${JSON.stringify(result, null, 2)}\n`);

  console.log('BENCH-01 BATCH B / CAVALRY CHARGE — EXECUTION COMPLETE');
  console.log(`PRECON: ${stock.entry.name} [${stock.entry.fileName}]`);
  console.log(`COMMANDERS: ${JSON.stringify(before.commanderNames)}`);
  console.log(`THEME QUERY: ${THEME_QUERY}`);
  console.log(`REFINEMENT: ${refinementStatus}; SWAPS: ${totalSwaps}`);
  console.log(`INTERPRETATION OUTCOME: ${result.interpretationOutcome}`);
  console.log(`REQUESTED AXES BEFORE: ${JSON.stringify(before.requestedAxes)}`);
  console.log(`REQUESTED AXES AFTER: ${JSON.stringify(after.requestedAxes)}`);
  console.log(`BRACKET: ${String(before.assessedBracket)} -> ${String(after.assessedBracket)}`);

  // BENCH-01 Batch B is a measurement fixture. Unsupported compound intent or
  // target misses are evidence, not harness failures. Only hard truth fails CI.
  assert.equal(after.cardCount, 100, 'Batch B result must retain exactly 100 cards');
  assert.equal(after.commanderLegal, true, 'Batch B result must retain Commander legality');
  assert.equal(after.unresolvedCount, 0, 'Batch B result must remain fully resolved');
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  await writeFile('bench01-batch-b-cavalry-failure.txt', `${message}\n`).catch(() => undefined);
  console.error('BENCH-01 BATCH B / CAVALRY CHARGE — HARD FAILURE');
  console.error(message);
  process.exitCode = 1;
});
