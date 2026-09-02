import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { compareRequestedBracketV15 } from '../src/services/bracket-target-comparison-v15.js';
import {
  evaluateCommanderBuildV15,
  type CommanderBuildEvaluationOptionsV15,
  type CommanderBuildEvaluationV15,
} from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import {
  cardCommanderStrategyAffinityV15,
  deriveCommanderStrategyContextV15,
} from '../src/services/commander-strategy-affinity-v15.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { fetchPreconDeckV10 } from '../src/services/precons-v10.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';

const PRECON_REFERENCE = 'FoodAndFellowship_LTC';
const TARGET_BRACKET = 4;
const B4_TARGETS = {
  averageNonlandManaValue: 3.1,
  earlyPlayCount: 25,
  cheapInteractionCount: 6,
  fastManaCount: 2,
  tutorCount: 2,
  recursionCount: 3,
  boardWipeCount: 2,
  rampCount: 12,
  drawCount: 12,
  interactionCount: 14,
  protectionCount: 6,
  persistentColoredManaSourceCount: 6,
} as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function requireAssessedBracket(evaluation: CommanderBuildEvaluationV15): number {
  const bracket = evaluation.actualBracket.assessedBracket;
  if (bracket === null) throw new Error('Independent bracket assessment must complete for this live control.');
  return bracket;
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

async function verifyMiddleEarthDeck(decklist: string): Promise<{
  cardCount: number;
  commanderLegal: boolean;
  printingPolicySatisfied: boolean;
  setCodes: string[];
  foodLifegainCommanderScore: number;
  foodLifegainSupportCount: number;
  foodLifegainAffinityTotal: number;
}> {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'precon control must retain exactly 100 cards');
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact precon entry must resolve');
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, 'precon control must retain Commander legality');
  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Middle-earth',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    'stock and refined exact printings must remain inside the Middle-earth family',
  );
  const strategyContext = deriveCommanderStrategyContextV15(parsed, resolved.cards);
  const foodLifegainCommanderScore = strategyContext.strategies
    .find((strategy) => strategy.archetype === 'food-lifegain')?.score ?? 0;
  const cardByName = new Map(resolved.cards.map((card) => [card.name.toLocaleLowerCase(), card] as const));
  let foodLifegainSupportCount = 0;
  let foodLifegainAffinityTotal = 0;
  for (const entry of parsed.main) {
    const card = cardByName.get(entry.name.toLocaleLowerCase());
    if (!card) continue;
    const match = cardCommanderStrategyAffinityV15(card, strategyContext).matches
      .find((candidate) => candidate.archetype === 'food-lifegain');
    if (!match || match.overlapScore <= 0) continue;
    foodLifegainSupportCount += entry.quantity;
    foodLifegainAffinityTotal += match.overlapScore * entry.quantity;
  }
  return {
    cardCount: parsed.totalCards,
    commanderLegal: rules.isLegal,
    printingPolicySatisfied: offPolicy.length === 0,
    setCodes: [...new Set(resolved.cards.map((card) => card.set.toUpperCase()))].sort(),
    foodLifegainCommanderScore,
    foodLifegainSupportCount,
    foodLifegainAffinityTotal,
  };
}

function evidenceHealth(evaluation: CommanderBuildEvaluationV15) {
  return {
    spellbookBracketSourceStatus: evaluation.postBuildEvidence.spellbookBracketSourceStatus,
    spellbookComboSourceStatus: evaluation.postBuildEvidence.spellbookComboSourceStatus,
    comboVerificationComplete: evaluation.postBuildEvidence.comboVerificationComplete,
  };
}

function b4Signals(evaluation: CommanderBuildEvaluationV15) {
  return {
    averageNonlandManaValue: evaluation.metrics.averageNonlandManaValue,
    earlyPlayCount: evaluation.metrics.earlyPlayCount,
    cheapInteractionCount: evaluation.metrics.cheapInteractionCount,
    fastManaCount: evaluation.metrics.fastManaCount,
    tutorCount: evaluation.metrics.tutorCount,
    recursionCount: evaluation.metrics.recursionCount,
    boardWipeCount: evaluation.metrics.boardWipeCount,
    rampCount: evaluation.metrics.rampCount,
    drawCount: evaluation.metrics.drawCount,
    interactionCount: evaluation.metrics.interactionCount,
    protectionCount: evaluation.metrics.protectionCount,
    persistentColoredManaSourceCount: evaluation.metrics.persistentColoredManaSourceCount,
  };
}

function b4Progress(
  before: ReturnType<typeof b4Signals>,
  after: ReturnType<typeof b4Signals>,
): {
  advanced: string[];
  repaired: string[];
  regressedPassing: string[];
  regressedStructuralFloor: string[];
} {
  const advanced: string[] = [];
  const repaired: string[] = [];
  const regressedPassing: string[] = [];
  const regressedStructuralFloor: string[] = [];
  const checks = [
    {
      key: 'b4-average-mv',
      before: before.averageNonlandManaValue,
      after: after.averageNonlandManaValue,
      passes: (value: number) => value <= B4_TARGETS.averageNonlandManaValue,
      improves: after.averageNonlandManaValue < before.averageNonlandManaValue,
    },
    ...([
      'earlyPlayCount',
      'cheapInteractionCount',
      'fastManaCount',
      'tutorCount',
      'recursionCount',
      'boardWipeCount',
      'rampCount',
      'drawCount',
      'interactionCount',
      'protectionCount',
      'persistentColoredManaSourceCount',
    ] as const).map((key) => ({
      key: `b4-${key}`,
      before: before[key],
      after: after[key],
      passes: (value: number) => value >= B4_TARGETS[key],
      improves: after[key] > before[key],
    })),
  ];
  for (const check of checks) {
    const passedBefore = check.passes(check.before);
    const passedAfter = check.passes(check.after);
    if (!passedBefore && passedAfter) repaired.push(check.key);
    else if (check.improves) advanced.push(check.key);
    if (passedBefore && !passedAfter) regressedPassing.push(check.key);
  }
  for (const key of [
    'earlyPlayCount',
    'cheapInteractionCount',
    'fastManaCount',
    'tutorCount',
    'recursionCount',
    'boardWipeCount',
    'rampCount',
    'drawCount',
    'interactionCount',
    'protectionCount',
    'persistentColoredManaSourceCount',
  ] as const) {
    if (after[key] < Math.min(before[key], B4_TARGETS[key])) {
      regressedStructuralFloor.push(`b4-${key}`);
    }
  }
  return { advanced, repaired, regressedPassing, regressedStructuralFloor };
}

async function main(): Promise<void> {
  const stock = await fetchPreconDeckV10(PRECON_REFERENCE);
  assert.equal(stock.entry.fileName, PRECON_REFERENCE, 'control must bind the exact MTGJSON stock product');
  const stockTruth = await verifyMiddleEarthDeck(stock.decklist);
  const evaluationOptions: CommanderBuildEvaluationOptionsV15 = {
    printingFamily: 'Middle-earth',
    includePromos: true,
    includeSpecialReleases: true,
    optimizedPlanEvidence: false,
    competitiveMetagameEvidence: false,
    constraintDescriptions: ['Exact Food and Fellowship stock baseline; Middle-earth physical printings only.'],
  };
  const before = await evaluateCommanderBuildV15(stock.decklist, evaluationOptions);
  const beforeBracket = requireAssessedBracket(before);

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'middle-earth-precon-refine-v15', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://middle-earth-precon-refine.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  let result: Record<string, unknown> = {};
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'refine_precon_v13',
      arguments: {
        reference: PRECON_REFERENCE,
        profile: 'custom',
        targetBracket: TARGET_BRACKET,
        maxNzdPerCard: 35,
        maxTotalNzd: 200,
        maxSwaps: 12,
        maxRounds: 4,
        swapsPerRound: 4,
        candidatePackagesPerRound: 4,
        minimumImprovementScore: 0.1,
        printingFamily: 'Middle-earth',
        includePromos: true,
        includeSpecialReleases: true,
        simulationIterations: 500,
        simulationTurns: 7,
        seed: 20260822,
        detailLevel: 'detailed',
      },
    }, { timeout: 15 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    assert.notEqual(response.isError, true, 'precon refinement MCP call must execute');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'precon refinement MCP call must return JSON');
    result = JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
    await handler.close();
  }

  const refinedPrecon = record(result.result);
  await writeFile('middle-earth-precon-refine-raw-result.json', `${JSON.stringify(result, null, 2)}\n`);
  const refinement = record(refinedPrecon.refinement);
  assert.equal(refinement.status, 'refined', 'addressable stock precon must produce a supported improvement');
  assert.ok(finite(refinement.totalSwaps) > 0, 'addressable stock precon must accept at least one swap');
  const finalDecklist = typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist : '';
  assert.ok(finalDecklist.trim(), 'refinement must return the complete final decklist');
  const finalTruth = await verifyMiddleEarthDeck(finalDecklist);
  assert.ok(stockTruth.foodLifegainCommanderScore >= 6, 'stock commanders must expose a substantive Food/lifegain identity');
  assert.ok(
    finalTruth.foodLifegainAffinityTotal >= stockTruth.foodLifegainAffinityTotal,
    'precon refinement must not reduce whole-deck Food/lifegain strategy affinity',
  );
  assert.ok(
    finalTruth.foodLifegainSupportCount >= stockTruth.foodLifegainSupportCount,
    'precon refinement must not reduce Food/lifegain support density',
  );
  const after = await evaluateCommanderBuildV15(finalDecklist, evaluationOptions);
  const afterBracket = requireAssessedBracket(after);

  const detailedRounds = Array.isArray(refinement.detailedRounds)
    ? refinement.detailedRounds.map(record)
    : [];
  const acceptedRounds = detailedRounds.filter((round) => round.accepted === true);
  assert.ok(acceptedRounds.length > 0, 'refined result must retain accepted-round evidence');
  for (const round of acceptedRounds) {
    const comparisons = Array.isArray(round.candidateComparisons)
      ? round.candidateComparisons.map(record)
      : [];
    const winner = comparisons.find((candidate) => candidate.candidate === round.winningCandidate);
    const strategy = record(winner?.strategyPreservation);
    assert.equal(strategy.evidenceComplete, true, `accepted round ${String(round.round)} must have complete strategy evidence`);
    assert.equal(strategy.status, 'preserved', `accepted round ${String(round.round)} must preserve the commander plan`);
    assert.deepEqual(strategy.meaningfulLosses, [], `accepted round ${String(round.round)} must reject meaningful strategy loss`);
    assert.equal(winner?.significantRegression, false, `accepted round ${String(round.round)} must avoid significant simulation regression`);
    const swaps = Array.isArray(winner?.swaps) ? winner.swaps.map(record) : [];
    assert.ok(swaps.length > 0, `accepted round ${String(round.round)} must retain winning swap evidence`);
    for (const swap of swaps) {
      assert.equal(
        record(record(swap.structuralPairing).strategyPreservation).verdict,
        'preserved',
        `accepted round ${String(round.round)} must retain per-swap cut-impact evidence`,
      );
    }
  }

  const beforeSignals = b4Signals(before);
  const afterSignals = b4Signals(after);
  const progress = b4Progress(beforeSignals, afterSignals);
  assert.deepEqual(progress.regressedPassing, [], 'precon refinement must not regress an already-passing Bracket-4 structure gate');
  assert.deepEqual(
    progress.regressedStructuralFloor,
    [],
    'precon refinement must not worsen a structural signal below the lesser of its starting and target counts',
  );
  assert.ok(
    progress.repaired.length > 0 || progress.advanced.length > 0 || afterBracket > beforeBracket,
    'precon refinement must repair or measurably advance Bracket-4 structure, not only improve a private heuristic',
  );
  assert.ok(
    afterBracket >= beforeBracket,
    'precon refinement must not lower the independently assessed bracket',
  );

  const beforeTarget = compareRequestedBracketV15(
    TARGET_BRACKET,
    before.actualBracket,
    before.postBuildEvidence.signals,
    evidenceHealth(before),
  );
  const afterTarget = compareRequestedBracketV15(
    TARGET_BRACKET,
    after.actualBracket,
    after.postBuildEvidence.signals,
    evidenceHealth(after),
  );
  const output = {
    schema: 'middle-earth-precon-refine-v15.1',
    sourceBaseline: 'MTGJSON exact stock deck',
    precon: {
      name: stock.entry.name,
      fileName: stock.entry.fileName,
      releaseDate: stock.entry.releaseDate,
      commanders: (stock.deck.commander ?? []).map((card) => card.name),
    },
    request: {
      targetBracket: TARGET_BRACKET,
      printingFamily: 'Middle-earth',
      maxNzdPerCard: 35,
      maxTotalNzd: 200,
      maxSwaps: 12,
    },
    before: {
      truth: stockTruth,
      assessedBracket: beforeBracket,
      assessedBand: before.actualBracket.assessedBand,
      signals: beforeSignals,
      verifiedWinningCombos: before.postBuildEvidence.verifiedWinningCombos,
      targetComparison: beforeTarget,
    },
    refinement,
    after: {
      truth: finalTruth,
      assessedBracket: afterBracket,
      assessedBand: after.actualBracket.assessedBand,
      signals: afterSignals,
      verifiedWinningCombos: after.postBuildEvidence.verifiedWinningCombos,
      targetComparison: afterTarget,
    },
    progress,
  };
  await writeFile('middle-earth-precon-refine-result.json', `${JSON.stringify(output, null, 2)}\n`);
  await writeFile('middle-earth-precon-stock-deck.txt', `${stock.decklist.trim()}\n`);
  await writeFile('middle-earth-precon-refined-deck.txt', `${finalDecklist.trim()}\n`);
  console.log(JSON.stringify({
    precon: stock.entry.name,
    status: refinement.status,
    totalSwaps: refinement.totalSwaps,
    beforeBracket,
    afterBracket,
    beforeSignals,
    afterSignals,
    progress,
  }, null, 2));
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('middle-earth-precon-refine-failure.txt', `${message}\n`).catch(() => undefined);
  process.exitCode = 1;
});
