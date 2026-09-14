import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { deriveCommanderStrategyContextV15 } from '../src/services/commander-strategy-affinity-v15.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { findDeckCombosEvidence } from '../src/services/spellbook.js';
import { getCardsByIdentifiers, installRetainedScryfallCardDataV15, type CardIdentifierInput } from '../src/services/scryfall.js';
import { replayRetainedScryfallCardDataSnapshotV15 } from '../src/services/retained-scryfall-carddata-replay-v15.js';
import type { RetainedScryfallCardDataSnapshotManifestV15 } from '../src/services/retained-scryfall-carddata-snapshot-v15.js';
import { assertRetainedScryfallReplayCompleteV15, retainedScryfallDiagnosticsV15 } from '../src/services/retained-scryfall-provider-v15.js';
import { fetchPreconDeckV10 } from '../src/services/precons-v10.js';
import { getCardOracleText } from '../src/services/scryfall.js';
import { config } from '../src/config.js';
import { runBoundedProcessV15 } from '../src/lib/bounded-process-v15.js';
import { createRetainedHttpSessionV15, sha256V15, type RetainedHttpCaptureV15 } from '../src/lib/retained-http-session-v15.js';
import { withEvaluationTimeV15 } from '../src/lib/evaluation-clock-v15.js';
import { withExecutionTraceV15 } from '../src/lib/execution-trace-v15.js';

const PRECON_REFERENCE = 'CounterBlitzFinalFantasyX_FIC';
const COMMANDER = "Tidus, Yuna's Guardian";
const TARGET_BRACKET = 5;
const COUNTERMAGIC_TARGET = 8;
const COUNTER_ENGINE_TARGET = 16;
const PROLIFERATE_TARGET = 3;
const COMBAT_REFERENCE_TARGET = 8;
const PROTECTION_TARGET = 8;
const SUBSTANTIAL_SWAP_TARGET = 20;
const OPTIMIZER_BEHAVIOR_REVISION = 'surplus-land-oracle-synergy-v3';
const MIN_CREATURES_FOR_HYBRID_PLAN = 18;
const RETAINED_RAW_PATH = process.env.SCRYFALL_RETAINED_RAW_PATH?.trim();
const RETAINED_MANIFEST_PATH = process.env.SCRYFALL_RETAINED_MANIFEST_PATH?.trim();
const SIMULATION_ITERATIONS = Number.parseInt(process.env.BENCH01_SIMULATION_ITERATIONS ?? '1000', 10);
const SIMULATION_TURNS = Number.parseInt(process.env.BENCH01_SIMULATION_TURNS ?? '8', 10);
const CAPTURE_PATH = process.env.BENCH01_HTTP_CAPTURE_PATH?.trim() || 'bench01-counter-blitz-http-capture.json';
const SOURCE_SHA = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const WORKER_MODE = process.env.BENCH01_WORKER_MODE;
const TRACE_PATH = `bench01-counter-blitz-${WORKER_MODE ?? 'supervisor'}-trace.jsonl`;
let providerSession: ReturnType<typeof createRetainedHttpSessionV15> | undefined;
let inputProvenance: Record<string, unknown> = {};
const trace = (event: Record<string, unknown>): void => {
  const row = { elapsedMs: Math.round(performance.now()), ...event };
  appendFileSync(TRACE_PATH, `${JSON.stringify(row)}\n`);
  if (event.event === 'stage') console.log(JSON.stringify(row));
};
const checkpoint = (stage: string): void => {
  trace({ event: 'stage', stage, scryfall: retainedScryfallDiagnosticsV15() });
  assertRetainedScryfallReplayCompleteV15();
  providerSession?.assertComplete();
};

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
    const oracle = lower(getCardOracleText(card));
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
      freeInteractionCount: Number(metrics.roleCounts['free interaction'] ?? 0),
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
      protectionTarget: PROTECTION_TARGET,
      protectionTargetAchieved: metrics.protectionCount >= PROTECTION_TARGET,
      requestedWhiteMageBallistaAccessAchieved: names.has('the destined white mage') && names.has('walking ballista'),
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

    if (!RETAINED_RAW_PATH || !RETAINED_MANIFEST_PATH) {
      throw new Error('BENCH-01 provider/harness failure: SCRYFALL_RETAINED_RAW_PATH and SCRYFALL_RETAINED_MANIFEST_PATH are required; no live fallback is permitted.');
    }
    const manifest = JSON.parse(await readFile(RETAINED_MANIFEST_PATH, 'utf8')) as RetainedScryfallCardDataSnapshotManifestV15;
    const replay = await replayRetainedScryfallCardDataSnapshotV15(manifest, new Uint8Array(await readFile(RETAINED_RAW_PATH)));
    installRetainedScryfallCardDataV15(replay.capture.acquisition.cards);
    checkpoint('verified-scryfall-installed');
    // Both this audit and refine_precon_v13 consume the exact same retained MTGJSON responses.
    // No archived upgraded deck, output-directory stock copy, or invented product metadata is used.
    const stock = await fetchPreconDeckV10(PRECON_REFERENCE);
  assert.equal(stock.entry.fileName, PRECON_REFERENCE, 'benchmark must bind exact standard Counter Blitz product, not Collector Edition');
  assert.equal(stock.entry.name, 'Counter Blitz (FINAL FANTASY X)');
  inputProvenance = { ...inputProvenance, stockDeckSha256: sha256V15(stock.decklist), stockReference: stock.entry.fileName };
  checkpoint('untouched-stock-resolved');
  const before = await auditDeck(stock.decklist);
  checkpoint('stock-audit-complete');
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
    checkpoint('refinement-started');
    const response = await client.callTool({
      name: 'refine_precon_v13',
      arguments: {
        reference: PRECON_REFERENCE,
        profile: 'custom',
        targetBracket: TARGET_BRACKET,
        maxSwaps: 30,
        swapsPerRound: 6,
        candidatePackagesPerRound: 6,
        minimumImprovementScore: 0.1,
        printingFamily: 'Final Fantasy',
        includePromos: true,
        includeSpecialReleases: true,
        themeQuery: '+1/+1 counters proliferate countermagic combat',
        simulationIterations: SIMULATION_ITERATIONS,
        simulationTurns: SIMULATION_TURNS,
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
    checkpoint('refinement-complete');
  } finally {
    await client.close();
    await handler.close();
  }

  const preconResult = record(rawResult.result);
  const refinement = record(preconResult.refinement);
  const refinementStatus = String(refinement.status ?? 'unknown');
  const candidateFinalDecklist = typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist.trim() : '';
  assert.ok(candidateFinalDecklist, 'Refinement must return an actual final deck; no silent stock fallback.');
  const finalDecklist = candidateFinalDecklist;
  const totalSwaps = finite(refinement.totalSwaps);
  const refinementRounds = Array.isArray(refinement.rounds)
    ? refinement.rounds.map((entry) => record(entry))
    : [];
  const terminationEvidence = {
    stopReason: typeof refinement.stopReason === 'string' ? refinement.stopReason : null,
    roundsAccepted: finite(refinement.roundsAccepted),
    roundsAttempted: refinementRounds.length,
    rounds: refinementRounds.map((round) => ({
      round: finite(round.round),
      accepted: round.accepted === true,
      acceptedSwaps: finite(round.acceptedSwaps),
      candidatePackagesGenerated: finite(round.candidatePackagesGenerated),
      candidatePackagesEligible: finite(round.candidatePackagesEligible),
      stopReason: typeof round.stopReason === 'string' ? round.stopReason : null,
    })),
    finalRoundCandidates: (() => {
      const detailedRounds = Array.isArray(refinement.detailedRounds)
        ? refinement.detailedRounds.map((entry) => record(entry))
        : [];
      const finalRound = detailedRounds.at(-1);
      const comparisons = finalRound && Array.isArray(finalRound.candidateComparisons)
        ? finalRound.candidateComparisons.map((entry) => record(entry))
        : [];
      return comparisons.map((candidate) => {
        const provenance = record(candidate.planProvenance);
        return {
          candidate: finite(candidate.candidate),
          eligible: candidate.eligible === true,
          reason: typeof candidate.reason === 'string' ? candidate.reason : null,
          actualSwaps: finite(candidate.actualSwaps),
          improvementScore: finite(candidate.improvementScore),
          structuralDeficits: Array.isArray(provenance.structuralDeficits)
            ? provenance.structuralDeficits
            : [],
          swaps: Array.isArray(candidate.swaps)
            ? candidate.swaps.map((entry) => {
              const swap = record(entry);
              return {
                out: typeof swap.out === 'string' ? swap.out : null,
                in: typeof swap.in === 'string' ? swap.in : null,
              };
            })
            : [],
        };
      });
    })(),
  };
  await writeFile('bench01-counter-blitz-refined-deck.txt', `${finalDecklist}\n`);

  const after = await auditDeck(finalDecklist);
  checkpoint('final-audit-complete');
  const beforeNames = new Map(parseDecklist(stock.decklist).main.map(entry => [entry.name, entry.quantity]));
  const afterNames = new Map(parseDecklist(finalDecklist).main.map(entry => [entry.name, entry.quantity]));
  const netChanges = {
    removed: [...beforeNames].flatMap(([name, count]) => count > (afterNames.get(name) ?? 0) ? [{ name, quantity: count - (afterNames.get(name) ?? 0) }] : []),
    added: [...afterNames].flatMap(([name, count]) => count > (beforeNames.get(name) ?? 0) ? [{ name, quantity: count - (beforeNames.get(name) ?? 0) }] : []),
  };
  const netSwaps = netChanges.added.reduce((sum, entry) => sum + entry.quantity, 0);
  assert.equal(netSwaps, netChanges.removed.reduce((sum, entry) => sum + entry.quantity, 0));
  const beforeTargets = record(before.benchmarkTargets);
  const afterTargets = record(after.benchmarkTargets);
  const beforeMetrics = record(before.metrics);
  const afterMetrics = record(after.metrics);
  const requiredTargetAchievement = {
    substantialUpgrade: netSwaps >= SUBSTANTIAL_SWAP_TARGET,
    targetBracket: afterTargets.bracketTargetAchieved === true,
    denseCountermagic: afterTargets.denseCountermagicAchieved === true,
    counterEngine: afterTargets.counterEngineTargetAchieved === true,
    proliferate: afterTargets.proliferateTargetAchieved === true,
    combatReference: afterTargets.combatReferenceTargetAchieved === true,
    hybridCreatureFloor: afterTargets.hybridCreatureFloorAchieved === true,
    protection: afterTargets.protectionTargetAchieved === true,
    requestedWhiteMageBallistaAccess: afterTargets.requestedWhiteMageBallistaAccessAchieved === true,
    commanderLegal: after.commanderLegal === true,
    finalFantasyPhysicalPrinting: after.printingPolicySatisfied === true,
  };
  const missedRequiredTargets = Object.entries(requiredTargetAchievement)
    .filter(([, achieved]) => !achieved)
    .map(([target]) => target);

  const benchmark = {
    schema: 'bench01-counter-blitz-ff-only-v1',
    provenance: { ...inputProvenance, sourceSha: SOURCE_SHA, optimizerBehaviorRevision: OPTIMIZER_BEHAVIOR_REVISION, workerMode: WORKER_MODE, finalDeckSha256: sha256V15(finalDecklist), replayDiagnostics: retainedScryfallDiagnosticsV15() },
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
      maxSwaps: 30,
      roundBudget: 'derived-from-maxSwaps-because-maxRounds-is-omitted',
      substantialSwapTarget: SUBSTANTIAL_SWAP_TARGET,
      identity: 'Bant +1/+1 counters/proliferate with dense countermagic and hybrid combat/combo routes',
      hardTruthFirst: true,
      benchmarkTargetsAreMeasurementsNotAutomaticPassClaims: true,
    },
    qualityVerdict: {
      status: missedRequiredTargets.length === 0 ? 'complete-target-achievement' : 'incomplete-target-achievement',
      achieved: missedRequiredTargets.length === 0,
      requiredTargetAchievement,
      missedRequiredTargets,
    },
    refinement: {
      status: refinementStatus,
      totalSwaps,
      netSwaps,
      substantialUpgradeAchieved: netSwaps >= SUBSTANTIAL_SWAP_TARGET,
      netChanges,
      terminationEvidence,
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
      protection: { before: beforeTargets.protectionTargetAchieved ?? false, after: afterTargets.protectionTargetAchieved ?? false },
      requestedWhiteMageBallistaAccess: { before: beforeTargets.requestedWhiteMageBallistaAccessAchieved ?? false, after: afterTargets.requestedWhiteMageBallistaAccessAchieved ?? false },
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
  console.log(`PROTECTION: ${String(beforeMetrics.protectionCount)} -> ${String(afterMetrics.protectionCount)} (target ${PROTECTION_TARGET})`);
  console.log(`SUBSTANTIAL UPGRADE: ${String(netSwaps)} swaps (target ${SUBSTANTIAL_SWAP_TARGET})`);
  console.log(`TARGET MOVEMENT: ${JSON.stringify(benchmark.targetMovement)}`);

  // BENCH-01 is a measurement fixture. Only fail the harness on hard-truth or
  // execution failures; target misses remain recorded evidence for comparison.
  assert.equal(after.cardCount, 100);
  assert.equal(after.commanderLegal, true);
  assert.equal(after.printingPolicySatisfied, true);
}

async function runWorker(): Promise<void> {
  assert.ok(RETAINED_MANIFEST_PATH && RETAINED_RAW_PATH, 'Provider/harness blocker: verified retained Scryfall raw data and manifest paths are required.');
  assert.ok(WORKER_MODE === 'capture' || WORKER_MODE === 'replay');
  const manifest = JSON.parse(await readFile(RETAINED_MANIFEST_PATH, 'utf8')) as RetainedScryfallCardDataSnapshotManifestV15;
  const retainedCapture = await readFile(CAPTURE_PATH, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT' && WORKER_MODE === 'capture') return null;
    throw error;
  });
  // A failed acquisition can resume from actual responses already retained at this same SHA.
  // A stale or different-source capture is rejected, never silently overwritten or used as a seed.
  const capture: RetainedHttpCaptureV15 = retainedCapture
    ? JSON.parse(retainedCapture) as RetainedHttpCaptureV15
    : { schema: 'retained-http-capture-v15.1', sourceSha: SOURCE_SHA, scryfallManifestFingerprint: manifest.manifestFingerprint, evaluationTime: manifest.observedAt, entries: [] };
  assert.equal(capture.sourceSha, SOURCE_SHA, 'Provider capture must match the frozen executable SHA.');
  assert.equal(capture.scryfallManifestFingerprint, manifest.manifestFingerprint, 'Provider capture must bind the same verified Scryfall snapshot.');
  const originalFetch = globalThis.fetch;
  providerSession = createRetainedHttpSessionV15({
    mode: WORKER_MODE, capture,
    allowedOrigins: [config.scryfallApiBase, config.mtgJsonApiBase, config.fxApiBase, config.commanderSpellbookApiBase].map(url => new URL(url).origin),
    fetchImpl: originalFetch,
    onEntry: () => writeFileSync(CAPTURE_PATH, `${JSON.stringify(capture)}\n`),
    onRequest: trace,
  });
  globalThis.fetch = providerSession.fetch;
  inputProvenance = { sourceSha: SOURCE_SHA, manifestFingerprint: manifest.manifestFingerprint, evaluationTime: capture.evaluationTime };
  trace({ event: 'stage', stage: 'worker-started', ...inputProvenance });
  try { await withExecutionTraceV15(trace, () => withEvaluationTimeV15(capture.evaluationTime, main)); }
  finally { globalThis.fetch = originalFetch; }
}

function qualitySignature(result: Record<string, unknown>): unknown {
  const project = (audit: Record<string, unknown>): unknown => ({
    cardCount: audit.cardCount, commanderLegal: audit.commanderLegal, printingPolicySatisfied: audit.printingPolicySatisfied,
    counterEngineCount: audit.counterEngineCount, proliferateCount: audit.proliferateCount, counterspellCount: audit.counterspellCount,
    combatReferenceCount: audit.combatReferenceCount, creatureCount: audit.creatureCount, metrics: audit.metrics,
    comboEvidence: audit.comboEvidence, benchmarkTargets: audit.benchmarkTargets,
  });
  const refinement = record(result.refinement);
  return { before: project(record(result.before)), after: project(record(result.after)), netChanges: refinement.netChanges,
    totalSwaps: refinement.totalSwaps, stock: record(result.provenance).stockDeckSha256, final: record(result.provenance).finalDeckSha256 };
}

async function supervise(): Promise<void> {
  assert.equal(execFileSync('git', ['diff', 'HEAD', '--', 'src', 'scripts'], { encoding: 'utf8' }).trim(), '', 'Freeze source and scripts before a benchmark run.');
  assert.equal(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src', 'scripts'], { encoding: 'utf8' }).trim(), '', 'Untracked executable files cannot be part of a frozen benchmark.');
  const deadlineMs = Number(process.env.BENCH01_PASS_DEADLINE_MS ?? 1_200_000);
  const modes = process.env.BENCH01_HTTP_CAPTURE_PATH ? ['replay', 'replay'] : ['capture', 'replay'];
  let first: unknown;
  for (const mode of modes) {
    const run = await runBoundedProcessV15(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url)], {
      deadlineMs, env: { ...process.env, BENCH01_WORKER_MODE: mode },
      onTimeout: () => writeFileSync('bench01-counter-blitz-failure.txt', JSON.stringify({ sourceSha: SOURCE_SHA, classification: 'provider-or-harness-timeout', mode, deadlineMs, tracePath: `bench01-counter-blitz-${mode}-trace.jsonl`, nextAction: 'Inspect the last stage/provider trace and resume from retained responses; no deck-quality verdict.' }, null, 2)),
    });
    if (run.timedOut || run.code !== 0) throw new Error(`Frozen benchmark ${mode} worker failed: ${JSON.stringify(run)}; inspect retained failure and trace artifacts.`);
    const result = JSON.parse(await readFile('bench01-counter-blitz-result.json', 'utf8')) as Record<string, unknown>;
    const signature = qualitySignature(result);
    if (first === undefined) {
      first = signature;
      await writeFile('bench01-counter-blitz-first-pass.json', `${JSON.stringify(result, null, 2)}\n`);
    } else {
      assert.deepEqual(signature, first, 'Fresh-process frozen replay must reproduce the complete deck and quality measurements.');
      result.determinism = { freshProcesses: 2, exactDeckAndMetricsEqual: true, networkFallbackInReplay: false, sourceSha: SOURCE_SHA };
      await writeFile('bench01-counter-blitz-result.json', `${JSON.stringify(result, null, 2)}\n`);
    }
  }
}

(WORKER_MODE ? runWorker() : supervise()).catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  appendFileSync('bench01-counter-blitz-failure.txt', `${message}\n`);
  console.error('BENCH-01 COUNTER BLITZ — HARD FAILURE');
  console.error(message);
  process.exitCode = 1;
});
