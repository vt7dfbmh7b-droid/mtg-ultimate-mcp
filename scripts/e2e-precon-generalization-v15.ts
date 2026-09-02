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
  deriveUpgradeStrategyContextV15,
  SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15,
} from '../src/services/commander-strategy-affinity-v15.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { fetchPreconDeckV10 } from '../src/services/precons-v10.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';

const PRECON_REFERENCE = process.env.PRECON_REFERENCE?.trim() || 'NecronDynasties_40K';
const TARGET_BRACKET = 4;
const MAX_NZD_PER_CARD = 35;
const MAX_TOTAL_NZD = 200;
const MAX_SWAPS = 12;
const MIN_STRATEGY_AFFINITY_RETENTION = 0.90;
const MIN_STRATEGY_SUPPORT_RETENTION = 0.80;
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
  persistentColoredManaSourceCount: 4,
} as const;

function requireAssessedBracket(evaluation: CommanderBuildEvaluationV15): number {
  const bracket = evaluation.actualBracket.assessedBracket;
  if (bracket === null) throw new Error('Independent bracket assessment must complete for this live control.');
  return bracket;
}

type StrategyTruthV15 = {
  archetype: string;
  commanderScore: number;
  supportCount: number;
  affinityTotal: number;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
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

async function verifyDeck(decklist: string): Promise<{
  cardCount: number;
  commanderLegal: boolean;
  commanderNames: string[];
  substantiveStrategyCount: number;
  strategies: StrategyTruthV15[];
}> {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'generalization control must retain exactly 100 cards');
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact deck entry must resolve');
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, 'generalization control must retain Commander legality');

  const context = deriveUpgradeStrategyContextV15(parsed, resolved.cards);
  const substantive = context.strategies.filter((strategy) => strategy.score >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15);
  const cardByName = new Map(resolved.cards.map((card) => [card.name.toLocaleLowerCase(), card] as const));
  const strategies = substantive.map((strategy) => {
    let supportCount = 0;
    let affinityTotal = 0;
    for (const entry of parsed.main) {
      const card = cardByName.get(entry.name.toLocaleLowerCase());
      if (!card) continue;
      const match = cardCommanderStrategyAffinityV15(card, context).matches
        .find((candidate) => candidate.archetype === strategy.archetype);
      if (!match || match.overlapScore <= 0) continue;
      supportCount += entry.quantity;
      affinityTotal += match.overlapScore * entry.quantity;
    }
    return {
      archetype: strategy.archetype,
      commanderScore: strategy.score,
      supportCount,
      affinityTotal,
    };
  });

  return {
    cardCount: parsed.totalCards,
    commanderLegal: rules.isLegal,
    commanderNames: [...parsed.commanders.map((entry) => entry.name)].sort((a, b) => a.localeCompare(b)),
    substantiveStrategyCount: strategies.length,
    strategies,
  };
}

function cumulativeStrategyRetention(
  before: readonly StrategyTruthV15[],
  after: readonly StrategyTruthV15[],
): {
  preserved: boolean;
  missingStrategies: string[];
  materiallyErodedStrategies: string[];
  strategies: Array<{
    archetype: string;
    beforeSupportCount: number;
    afterSupportCount: number | null;
    supportRetention: number | null;
    beforeAffinityTotal: number;
    afterAffinityTotal: number | null;
    affinityRetention: number | null;
    preserved: boolean;
  }>;
  minimumAffinityRetention: number;
  minimumSupportRetention: number;
} {
  const afterByArchetype = new Map(after.map((strategy) => [strategy.archetype, strategy] as const));
  const missingStrategies: string[] = [];
  const materiallyErodedStrategies: string[] = [];
  const strategies = before.map((prior) => {
    const next = afterByArchetype.get(prior.archetype);
    if (!next) {
      missingStrategies.push(prior.archetype);
      return {
        archetype: prior.archetype,
        beforeSupportCount: prior.supportCount,
        afterSupportCount: null,
        supportRetention: null,
        beforeAffinityTotal: prior.affinityTotal,
        afterAffinityTotal: null,
        affinityRetention: null,
        preserved: false,
      };
    }
    const supportRetention = prior.supportCount > 0 ? next.supportCount / prior.supportCount : 1;
    const affinityRetention = prior.affinityTotal > 0 ? next.affinityTotal / prior.affinityTotal : 1;
    const preserved = supportRetention >= MIN_STRATEGY_SUPPORT_RETENTION
      && affinityRetention >= MIN_STRATEGY_AFFINITY_RETENTION;
    if (!preserved) materiallyErodedStrategies.push(prior.archetype);
    return {
      archetype: prior.archetype,
      beforeSupportCount: prior.supportCount,
      afterSupportCount: next.supportCount,
      supportRetention,
      beforeAffinityTotal: prior.affinityTotal,
      afterAffinityTotal: next.affinityTotal,
      affinityRetention,
      preserved,
    };
  });
  return {
    preserved: missingStrategies.length === 0 && materiallyErodedStrategies.length === 0,
    missingStrategies,
    materiallyErodedStrategies,
    strategies,
    minimumAffinityRetention: MIN_STRATEGY_AFFINITY_RETENTION,
    minimumSupportRetention: MIN_STRATEGY_SUPPORT_RETENTION,
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
    else if (!passedBefore && check.improves) advanced.push(check.key);
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

function strategyAudit(refinement: Record<string, unknown>): {
  acceptedRounds: number;
  evidenceComplete: boolean;
  aggregatePreserved: boolean;
  perSwapPreserved: boolean;
  meaningfulLosses: unknown[];
} {
  const detailedRounds = Array.isArray(refinement.detailedRounds)
    ? refinement.detailedRounds.map(record)
    : [];
  const accepted = detailedRounds.filter((round) => round.accepted === true);
  let evidenceComplete = accepted.length > 0;
  let aggregatePreserved = accepted.length > 0;
  let perSwapPreserved = accepted.length > 0;
  const meaningfulLosses: unknown[] = [];
  for (const round of accepted) {
    const comparisons = Array.isArray(round.candidateComparisons)
      ? round.candidateComparisons.map(record)
      : [];
    const winner = comparisons.find((candidate) => candidate.candidate === round.winningCandidate);
    const strategy = record(winner?.strategyPreservation);
    if (strategy.evidenceComplete !== true) evidenceComplete = false;
    if (strategy.status !== 'preserved') aggregatePreserved = false;
    const losses = Array.isArray(strategy.meaningfulLosses) ? strategy.meaningfulLosses : [];
    meaningfulLosses.push(...losses);
    const swaps = Array.isArray(winner?.swaps) ? winner.swaps.map(record) : [];
    if (swaps.length === 0) perSwapPreserved = false;
    for (const swap of swaps) {
      if (record(record(swap.structuralPairing).strategyPreservation).verdict !== 'preserved') {
        perSwapPreserved = false;
      }
    }
  }
  return {
    acceptedRounds: accepted.length,
    evidenceComplete,
    aggregatePreserved,
    perSwapPreserved,
    meaningfulLosses,
  };
}

async function main(): Promise<void> {
  const stock = await fetchPreconDeckV10(PRECON_REFERENCE);
  assert.equal(stock.entry.fileName, PRECON_REFERENCE, 'control must bind the requested exact MTGJSON stock product');
  const stockTruth = await verifyDeck(stock.decklist);
  const evaluationOptions: CommanderBuildEvaluationOptionsV15 = {
    optimizedPlanEvidence: false,
    competitiveMetagameEvidence: false,
    constraintDescriptions: [
      `Exact ${stock.entry.name} stock baseline; unrestricted Commander-legal physical upgrades under NZ$${MAX_NZD_PER_CARD}/card and NZ$${MAX_TOTAL_NZD} total.`,
    ],
  };
  const before = await evaluateCommanderBuildV15(stock.decklist, evaluationOptions);
  const beforeBracket = requireAssessedBracket(before);

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'precon-generalization-v15', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://precon-generalization.local/mcp'), {
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
        maxNzdPerCard: MAX_NZD_PER_CARD,
        maxTotalNzd: MAX_TOTAL_NZD,
        maxSwaps: MAX_SWAPS,
        maxRounds: 4,
        swapsPerRound: 4,
        candidatePackagesPerRound: 4,
        minimumImprovementScore: 0.1,
        simulationIterations: 500,
        simulationTurns: 7,
        seed: 20260822,
        detailLevel: 'detailed',
      },
    }, { timeout: 15 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    assert.notEqual(response.isError, true, 'precon generalization MCP call must execute');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'precon generalization MCP call must return JSON');
    result = JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
    await handler.close();
  }

  const refinedPrecon = record(result.result);
  await writeFile('precon-generalization-raw-result.json', `${JSON.stringify(result, null, 2)}\n`);
  const refinement = record(refinedPrecon.refinement);
  const finalDecklist = typeof refinement.finalDecklist === 'string' && refinement.finalDecklist.trim()
    ? refinement.finalDecklist
    : stock.decklist;
  const finalTruth = await verifyDeck(finalDecklist);
  assert.deepEqual(finalTruth.commanderNames, stockTruth.commanderNames, 'generalization control must preserve the exact command zone');
  const after = await evaluateCommanderBuildV15(finalDecklist, evaluationOptions);
  const afterBracket = requireAssessedBracket(after);

  const beforeSignals = b4Signals(before);
  const afterSignals = b4Signals(after);
  const progress = b4Progress(beforeSignals, afterSignals);
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
  const strategy = strategyAudit(refinement);
  const cumulativeStrategy = cumulativeStrategyRetention(stockTruth.strategies, finalTruth.strategies);
  const output = {
    schema: 'precon-generalization-v15.2',
    sourceBaseline: 'MTGJSON exact stock deck',
    precon: {
      name: stock.entry.name,
      fileName: stock.entry.fileName,
      releaseDate: stock.entry.releaseDate,
      commanders: stockTruth.commanderNames,
    },
    request: {
      targetBracket: TARGET_BRACKET,
      printingPolicy: 'unrestricted-physical',
      maxNzdPerCard: MAX_NZD_PER_CARD,
      maxTotalNzd: MAX_TOTAL_NZD,
      maxSwaps: MAX_SWAPS,
    },
    before: {
      truth: stockTruth,
      assessedBracket: before.actualBracket.assessedBracket,
      assessedBand: before.actualBracket.assessedBand,
      signals: beforeSignals,
      verifiedWinningCombos: before.postBuildEvidence.verifiedWinningCombos,
      targetComparison: beforeTarget,
      evidenceHealth: evidenceHealth(before),
    },
    refinement,
    after: {
      truth: finalTruth,
      assessedBracket: after.actualBracket.assessedBracket,
      assessedBand: after.actualBracket.assessedBand,
      signals: afterSignals,
      verifiedWinningCombos: after.postBuildEvidence.verifiedWinningCombos,
      targetComparison: afterTarget,
      evidenceHealth: evidenceHealth(after),
    },
    progress,
    strategyAudit: strategy,
    cumulativeStrategyRetention: cumulativeStrategy,
    outcome: {
      refined: refinement.status === 'refined' && finite(refinement.totalSwaps) > 0,
      measurableTargetProgress: progress.repaired.length > 0
        || progress.advanced.length > 0
        || afterBracket > beforeBracket,
      noPassingGateRegression: progress.regressedPassing.length === 0,
      noStructuralFloorRegression: progress.regressedStructuralFloor.length === 0,
      bracketNotLowered: afterBracket >= beforeBracket,
      strategyEvidenceComplete: strategy.evidenceComplete,
      commanderStrategyPreserved: strategy.aggregatePreserved
        && strategy.perSwapPreserved
        && strategy.meaningfulLosses.length === 0
        && cumulativeStrategy.preserved,
      cumulativeCommanderStrategyPreserved: cumulativeStrategy.preserved,
    },
  };
  await writeFile('precon-generalization-result.json', `${JSON.stringify(output, null, 2)}\n`);
  await writeFile('precon-generalization-stock-deck.txt', `${stock.decklist.trim()}\n`);
  await writeFile('precon-generalization-refined-deck.txt', `${finalDecklist.trim()}\n`);
  console.log(JSON.stringify({
    precon: stock.entry.name,
    status: refinement.status ?? 'unknown',
    totalSwaps: refinement.totalSwaps ?? 0,
    beforeBracket,
    afterBracket,
    beforeSignals,
    afterSignals,
    progress,
    strategyAudit: strategy,
    cumulativeStrategyRetention: cumulativeStrategy,
  }, null, 2));
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('precon-generalization-failure.txt', `${message}\n`).catch(() => undefined);
  process.exitCode = 1;
});
