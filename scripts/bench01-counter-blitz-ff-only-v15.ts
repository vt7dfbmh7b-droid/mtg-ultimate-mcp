import assert from 'node:assert/strict';
import { unlink, writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { deriveCommanderStrategyContextV15 } from '../src/services/commander-strategy-affinity-v15.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { fetchPreconDeckV10 } from '../src/services/precons-v10.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { findDeckCombosEvidence } from '../src/services/spellbook.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';

const PRECON_REFERENCE = 'CounterBlitzFinalFantasyX_FIC';
const COMMANDER = "Tidus, Yuna's Guardian";
const TARGET_BRACKET = 5;
const COUNTERMAGIC_TARGET = 8;
const COUNTER_ENGINE_TARGET = 16;
const PROLIFERATE_TARGET = 3;
const COMBAT_REFERENCE_TARGET = 8;
const MIN_CREATURES_FOR_HYBRID_PLAN = 18;

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

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLocaleLowerCase() : '';
}

async function auditDeck(decklist: string): Promise<Record<string, unknown>> {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'Counter Blitz benchmark must contain exactly 100 cards');
  assert.equal(parsed.commanders.length, 1, 'Counter Blitz benchmark must have exactly one commander');
  assert.equal(parsed.commanders[0]?.name, COMMANDER, `Counter Blitz benchmark must keep ${COMMANDER} in the command zone`);

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact Counter Blitz deck entry must resolve');
  const legality = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(legality.isLegal, true, 'Counter Blitz benchmark must remain Commander legal');

  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    'Counter Blitz benchmark must use only FINAL FANTASY-family physical printings',
  );

  const byName = new Map(resolved.cards.map((card) => [card.name.toLocaleLowerCase(), card] as const));
  let counterEngineCount = 0;
  let proliferateCount = 0;
  let counterspellCount = 0;
  let combatReferenceCount = 0;
  let creatureCount = 0;
  let nonlandCount = 0;

  for (const entry of parsed.main) {
    const card = byName.get(entry.name.toLocaleLowerCase());
    if (!card) continue;
    const oracle = lower(card.oracle_text);
    const typeLine = lower(card.type_line);
    const quantity = entry.quantity;
    const isLand = typeLine.includes('land');
    const isCreature = typeLine.includes('creature');
    if (!isLand) nonlandCount += quantity;
    if (isCreature) creatureCount += quantity;

    if (/\+1\/\+1 counter|proliferate|move (?:a|any number of) counter|counter(?:s)? on (?:it|them|a|target|another|each)/i.test(oracle)) {
      counterEngineCount += quantity;
    }
    if (/\bproliferate\b/i.test(oracle)) proliferateCount += quantity;
    if (/\bcounter target [^.\n]{0,90}\bspell\b/i.test(oracle) || /\bcounter [^.\n]{0,60}\bspell unless\b/i.test(oracle)) {
      counterspellCount += quantity;
    }
    if (/\battack(?:s|ing|ed)?\b|\bcombat damage\b|\badditional combat\b|\bdouble strike\b|\btrample\b/i.test(oracle)) {
      combatReferenceCount += quantity;
    }
  }

  const strategyContext = deriveCommanderStrategyContextV15(parsed, resolved.cards);
  const evaluation = await evaluateCommanderBuildV15(decklist, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    optimizedPlanEvidence: false,
    competitiveMetagameEvidence: false,
    constraintDescriptions: [
      'Exact Counter Blitz stock-precon lineage.',
      'FINAL FANTASY physical printings only.',
      'Tidus, Yuna\'s Guardian remains the commander.',
      'Target Bracket 5 is a benchmark target, not permission to falsify target achievement.',
      'Preserve a hybrid counters/proliferate combat plan while allowing compact combo routes.',
      'Dense countermagic is an explicit benchmark objective.',
    ],
  });

  let comboEvidence: Record<string, unknown> = {};
  let comboVerificationError: string | null = null;
  try {
    comboEvidence = record(await findDeckCombosEvidence(decklist, 150));
  } catch (error) {
    comboVerificationError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  const includedCombos = Array.isArray(comboEvidence.included) ? comboEvidence.included.map(record) : [];
  const names = new Set(parsed.main.map((entry) => entry.name.toLocaleLowerCase()));
  const metrics = evaluation.metrics;
  const assessedBracket = finite(evaluation.actualBracket.assessedBracket);

  return {
    cardCount: parsed.totalCards,
    commanderLegal: legality.isLegal,
    printingPolicySatisfied: offPolicy.length === 0,
    commanderNames: parsed.commanders.map((entry) => entry.name),
    commanderStrategies: strategyContext.strategies,
    counterEngineCount,
    proliferateCount,
    counterspellCount,
    combatReferenceCount,
    creatureCount,
    nonlandCount,
    notableRoutePieces: {
      walkingBallista: names.has('walking ballista'),
      destinedWhiteMage: names.has('the destined white mage'),
      hardenedScales: names.has('hardened scales'),
      gyreSage: names.has('gyre sage'),
      incubationDruid: names.has('incubation druid'),
      earthCrystal: names.has('the earth crystal'),
      inexorableTide: names.has('inexorable tide'),
      resourcefulDefense: names.has('resourceful defense'),
    },
    comboEvidence: {
      verificationComplete: comboEvidence.verificationComplete ?? false,
      sourceStatus: comboEvidence.sourceStatus ?? 'unknown',
      includedCount: includedCombos.length,
      included: includedCombos,
      error: comboVerificationError,
    },
    assessedBracket,
    assessedBand: evaluation.actualBracket.assessedBand,
    bracketEvidence: evaluation.actualBracket,
    metrics: {
      averageNonlandManaValue: metrics.averageNonlandManaValue,
      earlyPlayCount: metrics.earlyPlayCount,
      cheapInteractionCount: metrics.cheapInteractionCount,
      freeInteractionCount: metrics.freeInteractionCount,
      fastManaCount: metrics.fastManaCount,
      tutorCount: metrics.tutorCount,
      recursionCount: metrics.recursionCount,
      boardWipeCount: metrics.boardWipeCount,
      rampCount: metrics.rampCount,
      drawCount: metrics.drawCount,
      interactionCount: metrics.interactionCount,
      protectionCount: metrics.protectionCount,
      persistentColoredManaSourceCount: metrics.persistentColoredManaSourceCount,
    },
    benchmarkTargets: {
      targetBracket: TARGET_BRACKET,
      bracketTargetAchieved: assessedBracket >= TARGET_BRACKET,
      countermagicTarget: COUNTERMAGIC_TARGET,
      denseCountermagicAchieved: counterspellCount >= COUNTERMAGIC_TARGET,
      counterEngineTarget: COUNTER_ENGINE_TARGET,
      counterEngineTargetAchieved: counterEngineCount >= COUNTER_ENGINE_TARGET,
      proliferateTarget: PROLIFERATE_TARGET,
      proliferateTargetAchieved: proliferateCount >= PROLIFERATE_TARGET,
      combatReferenceTarget: COMBAT_REFERENCE_TARGET,
      combatReferenceTargetAchieved: combatReferenceCount >= COMBAT_REFERENCE_TARGET,
      minimumCreaturesForHybridPlan: MIN_CREATURES_FOR_HYBRID_PLAN,
      hybridCreatureFloorAchieved: creatureCount >= MIN_CREATURES_FOR_HYBRID_PLAN,
    },
  };
}

async function main(): Promise<void> {
  await Promise.all([
    unlink('bench01-counter-blitz-result.json').catch(() => undefined),
    unlink('bench01-counter-blitz-raw-result.json').catch(() => undefined),
    unlink('bench01-counter-blitz-stock-deck.txt').catch(() => undefined),
    unlink('bench01-counter-blitz-refined-deck.txt').catch(() => undefined),
    unlink('bench01-counter-blitz-failure.txt').catch(() => undefined),
  ]);

  const stock = await fetchPreconDeckV10(PRECON_REFERENCE);
  assert.equal(stock.entry.fileName, PRECON_REFERENCE, 'benchmark must bind exact standard Counter Blitz product, not Collector Edition');
  assert.equal(stock.entry.name, 'Counter Blitz (FINAL FANTASY X)');
  const before = await auditDeck(stock.decklist);
  await writeFile('bench01-counter-blitz-stock-deck.txt', `${stock.decklist.trim()}\n`);

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'bench01-counter-blitz-ff-only-v15', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://bench01-counter-blitz.local/mcp'), {
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
        maxSwaps: 20,
        maxRounds: 5,
        swapsPerRound: 5,
        candidatePackagesPerRound: 6,
        minimumImprovementScore: 0.1,
        printingFamily: 'Final Fantasy',
        includePromos: true,
        includeSpecialReleases: true,
        themeQuery: '+1/+1 counters proliferate countermagic combat',
        simulationIterations: 1000,
        simulationTurns: 8,
        seed: 20260905,
        detailLevel: 'detailed',
      },
    }, { timeout: 30 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    assert.notEqual(response.isError, true, 'Counter Blitz refinement MCP call must execute');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'Counter Blitz refinement MCP call must return JSON');
    rawResult = JSON.parse(text) as Record<string, unknown>;
    await writeFile('bench01-counter-blitz-raw-result.json', `${JSON.stringify(rawResult, null, 2)}\n`);
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
  await writeFile('bench01-counter-blitz-refined-deck.txt', `${finalDecklist}\n`);

  const after = await auditDeck(finalDecklist);
  const beforeTargets = record(before.benchmarkTargets);
  const afterTargets = record(after.benchmarkTargets);
  const beforeMetrics = record(before.metrics);
  const afterMetrics = record(after.metrics);

  const benchmark = {
    schema: 'bench01-counter-blitz-ff-only-v1',
    fixture: 'BENCH-01 Batch A / Counter Blitz',
    sourceBaseline: 'MTGJSON exact standard precon',
    precon: {
      name: stock.entry.name,
      fileName: stock.entry.fileName,
      releaseDate: stock.entry.releaseDate,
      commanders: (stock.deck.commander ?? []).map((card) => card.name),
    },
    constraints: {
      commander: COMMANDER,
      printingFamily: 'Final Fantasy',
      targetBracket: TARGET_BRACKET,
      maxSwaps: 20,
      identity: 'Bant +1/+1 counters/proliferate with dense countermagic and hybrid combat/combo routes',
      hardTruthFirst: true,
      benchmarkTargetsAreMeasurementsNotAutomaticPassClaims: true,
    },
    refinement: {
      status: refinementStatus,
      totalSwaps,
      rawRefinement: refinement,
    },
    before,
    after,
    deltas: {
      counterEngineCount: finite(after.counterEngineCount) - finite(before.counterEngineCount),
      proliferateCount: finite(after.proliferateCount) - finite(before.proliferateCount),
      counterspellCount: finite(after.counterspellCount) - finite(before.counterspellCount),
      combatReferenceCount: finite(after.combatReferenceCount) - finite(before.combatReferenceCount),
      creatureCount: finite(after.creatureCount) - finite(before.creatureCount),
      assessedBracket: finite(after.assessedBracket) - finite(before.assessedBracket),
      averageNonlandManaValue: finite(afterMetrics.averageNonlandManaValue) - finite(beforeMetrics.averageNonlandManaValue),
      earlyPlayCount: finite(afterMetrics.earlyPlayCount) - finite(beforeMetrics.earlyPlayCount),
      cheapInteractionCount: finite(afterMetrics.cheapInteractionCount) - finite(beforeMetrics.cheapInteractionCount),
      fastManaCount: finite(afterMetrics.fastManaCount) - finite(beforeMetrics.fastManaCount),
      tutorCount: finite(afterMetrics.tutorCount) - finite(beforeMetrics.tutorCount),
    },
    targetMovement: {
      bracket: { before: beforeTargets.bracketTargetAchieved ?? false, after: afterTargets.bracketTargetAchieved ?? false },
      denseCountermagic: { before: beforeTargets.denseCountermagicAchieved ?? false, after: afterTargets.denseCountermagicAchieved ?? false },
      counterEngine: { before: beforeTargets.counterEngineTargetAchieved ?? false, after: afterTargets.counterEngineTargetAchieved ?? false },
      proliferate: { before: beforeTargets.proliferateTargetAchieved ?? false, after: afterTargets.proliferateTargetAchieved ?? false },
      combatReference: { before: beforeTargets.combatReferenceTargetAchieved ?? false, after: afterTargets.combatReferenceTargetAchieved ?? false },
      hybridCreatureFloor: { before: beforeTargets.hybridCreatureFloorAchieved ?? false, after: afterTargets.hybridCreatureFloorAchieved ?? false },
    },
  };

  await writeFile('bench01-counter-blitz-result.json', `${JSON.stringify(benchmark, null, 2)}\n`);

  console.log('BENCH-01 COUNTER BLITZ — EXECUTION COMPLETE');
  console.log(`REFINEMENT STATUS: ${refinementStatus}; SWAPS: ${totalSwaps}`);
  console.log(`BRACKET: ${String(before.assessedBracket)} -> ${String(after.assessedBracket)}`);
  console.log(`COUNTERMAGIC: ${String(before.counterspellCount)} -> ${String(after.counterspellCount)} (target ${COUNTERMAGIC_TARGET})`);
  console.log(`COUNTER ENGINE: ${String(before.counterEngineCount)} -> ${String(after.counterEngineCount)} (target ${COUNTER_ENGINE_TARGET})`);
  console.log(`PROLIFERATE: ${String(before.proliferateCount)} -> ${String(after.proliferateCount)} (target ${PROLIFERATE_TARGET})`);
  console.log(`COMBAT REFERENCES: ${String(before.combatReferenceCount)} -> ${String(after.combatReferenceCount)} (target ${COMBAT_REFERENCE_TARGET})`);
  console.log(`TARGET MOVEMENT: ${JSON.stringify(benchmark.targetMovement)}`);

  // BENCH-01 is a measurement fixture. Only fail the harness on hard-truth or
  // execution failures; target misses remain recorded evidence for comparison.
  assert.equal(after.cardCount, 100);
  assert.equal(after.commanderLegal, true);
  assert.equal(after.printingPolicySatisfied, true);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  await writeFile('bench01-counter-blitz-failure.txt', `${message}\n`).catch(() => undefined);
  console.error('BENCH-01 COUNTER BLITZ — HARD FAILURE');
  console.error(message);
  process.exitCode = 1;
});
