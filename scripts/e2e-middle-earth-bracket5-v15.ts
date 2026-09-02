import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { neutralCommanderLookupNameV15 } from '../src/services/neutral-deck-builder-v15.js';
import {
  discoverNeutralCommanderCandidatesV15,
  type NeutralCommanderCandidateV15,
} from '../src/services/neutral-commander-selection-v15.js';
import {
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
} from '../src/services/printing-policy-v08.js';
import {
  getCardsByIdentifiers,
  getCardsByNames,
  type CardIdentifierInput,
} from '../src/services/scryfall.js';

const MIDDLE_EARTH_SETS = ['LTR', 'LTC', 'HOB', 'HOC'] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function allIdentifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

function chooseCandidates(candidates: NeutralCommanderCandidateV15[]): NeutralCommanderCandidateV15[] {
  const chosen: NeutralCommanderCandidateV15[] = [];
  const usedArchetypes = new Set<string>();
  for (const candidate of candidates) {
    if (chosen.length >= 7) break;
    if (usedArchetypes.has(candidate.strategy.archetype)) continue;
    chosen.push(candidate);
    usedArchetypes.add(candidate.strategy.archetype);
  }
  for (const candidate of candidates) {
    if (chosen.length >= 7) break;
    if (chosen.some((current) => current.label === candidate.label)) continue;
    chosen.push(candidate);
  }
  return chosen;
}

async function middleEarthPolicy() {
  return resolvePrintingPolicyV08({
    allowedSets: [...MIDDLE_EARTH_SETS],
    includePromos: true,
    includeSpecialReleases: true,
  });
}

async function exactCommanderRefs(candidate: NeutralCommanderCandidateV15): Promise<Array<{
  name: string;
  set: string;
  collectorNumber: string;
}>> {
  const policy = await middleEarthPolicy();
  const lookupNames = candidate.commanderNames.map(neutralCommanderLookupNameV15);
  const resolved = await getCardsByNames(lookupNames);
  assert.deepEqual(resolved.notFound, [], `${candidate.label} commander Oracle identities must resolve`);

  const refs: Array<{ name: string; set: string; collectorNumber: string }> = [];
  for (const name of candidate.commanderNames) {
    const lookup = neutralCommanderLookupNameV15(name).toLocaleLowerCase();
    const oracle = resolved.cards.find((card) => neutralCommanderLookupNameV15(card.name).toLocaleLowerCase() === lookup);
    assert.ok(oracle, `${name} must bind to resolved Oracle data`);
    const printing = await selectEligiblePrintingV08(oracle, policy);
    assert.ok(printing, `${name} must have an LTR/LTC/HOB/HOC physical printing`);
    refs.push({
      name: printing.card.name,
      set: printing.card.set.toUpperCase(),
      collectorNumber: printing.card.collector_number,
    });
  }
  return refs;
}

async function verifyMiddleEarthDeck(decklist: string): Promise<{
  cardCount: number;
  commanderLegal: boolean;
  setCodes: string[];
}> {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'Middle-earth target build must contain exactly 100 cards');
  const resolved = await getCardsByIdentifiers(allIdentifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact Middle-earth deck entry must resolve');
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, 'Middle-earth target build must pass Commander legality');
  const policy = await middleEarthPolicy();
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    'every exact physical printing must come from LTR/LTC/HOB/HOC',
  );
  return {
    cardCount: parsed.totalCards,
    commanderLegal: rules.isLegal,
    setCodes: [...new Set(resolved.cards.map((card) => card.set.toUpperCase()))].sort(),
  };
}

interface CandidateResult {
  candidate: NeutralCommanderCandidateV15;
  commanderRefs: Array<{ name: string; set: string; collectorNumber: string }>;
  result: Record<string, unknown>;
  decklist: string;
  achievedBracket: number;
  achievedBand: string;
  bracket5ConstructionCandidate: boolean;
  bracket5Certified: boolean;
  verifiedWinningCombos: number;
  hardTruth: Awaited<ReturnType<typeof verifyMiddleEarthDeck>>;
}

async function main(): Promise<void> {
  console.log('MIDDLE-EARTH (LTR + HOBBIT) BRACKET 5 LIVE CONTROL');
  console.log(`ALLOWED SETS: ${MIDDLE_EARTH_SETS.join(', ')}`);
  console.log('TARGET: strongest honest Commander Bracket 5 attempt using only these exact physical printings.');

  const discovery = await discoverNeutralCommanderCandidatesV15({
    allowedSets: [...MIDDLE_EARTH_SETS],
    includePromos: true,
    includeSpecialReleases: true,
    maxCandidates: 60,
  });
  assert.ok(discovery.discoveredCardCount > 0, 'Middle-earth discovery must find eligible commander cards');
  assert.ok(discovery.candidates.length > 0, 'Middle-earth discovery must produce commander configurations');

  const candidates = chooseCandidates(discovery.candidates);
  console.log(`DISCOVERED COMMANDER CARDS: ${discovery.discoveredCardCount}`);
  console.log(`TARGETED CANDIDATES: ${candidates.map((candidate) => candidate.label).join(' | ')}`);

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'mtg-ultimate-v15-middle-earth-bracket5-live', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://middle-earth-control.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  const successes: CandidateResult[] = [];
  const failures: Array<{ candidate: string; status?: string; error: string }> = [];

  try {
    await client.connect(transport);
    for (const candidate of candidates) {
      console.log(`\nBUILDING: ${candidate.label}`);
      try {
        const commanderRefs = await exactCommanderRefs(candidate);
        const response = await client.callTool({
          name: 'build_commander_through_pipeline_v15',
          arguments: {
            commanders: commanderRefs,
            targetBracket: 5,
            allowedSets: [...MIDDLE_EARTH_SETS],
            includePromos: true,
            includeSpecialReleases: true,
            winPackageMode: 'prefer',
            maxWinPackageCards: 3,
            cedhIntent: true,
            optimizedPlanEvidence: true,
            // This live control does not fabricate competitive results. If construction reaches the
            // B5 candidate state, exact-commander evidence can be checked independently afterward.
            competitiveMetagameEvidence: false,
          },
        }, { timeout: 10 * 60_000 }) as unknown as {
          content: Array<{ type: string; text?: string }>;
          isError?: boolean;
        };
        assert.notEqual(response.isError, true, `${candidate.label} MCP build must execute`);
        const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
        assert.ok(text, `${candidate.label} must return JSON`);
        const result = JSON.parse(text) as Record<string, unknown>;
        if (result.status !== 'complete-evaluated-build') {
          failures.push({
            candidate: candidate.label,
            status: String(result.status ?? 'unknown'),
            error: String(result.guidance ?? 'pipeline did not return a complete build'),
          });
          continue;
        }

        const evaluation = record(result.evaluation);
        const actual = record(evaluation.actualBracket);
        const post = record(evaluation.postBuildEvidence);
        const built = record(result.built);
        const decklist = typeof built.decklist === 'string' ? built.decklist : '';
        assert.ok(decklist.trim(), `${candidate.label} must retain the final decklist`);
        const hardTruth = await verifyMiddleEarthDeck(decklist);

        successes.push({
          candidate,
          commanderRefs,
          result,
          decklist,
          achievedBracket: finiteNumber(result.achievedBracket, -1),
          achievedBand: String(result.achievedBand ?? actual.assessedBand ?? 'unknown'),
          bracket5ConstructionCandidate: actual.bracket5ConstructionCandidate === true,
          bracket5Certified: actual.bracket5CertifiedByThisAssessment === true,
          verifiedWinningCombos: finiteNumber(post.verifiedWinningCombos),
          hardTruth,
        });
        console.log(`RESULT: bracket=${String(result.achievedBracket)} constructionB5=${String(actual.bracket5ConstructionCandidate)} verifiedWins=${String(post.verifiedWinningCombos)}`);
      } catch (error) {
        failures.push({ candidate: candidate.label, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } finally {
    await client.close();
    await handler.close();
  }

  assert.ok(successes.length > 0, `at least one Middle-earth build must complete: ${JSON.stringify(failures)}`);
  successes.sort((left, right) =>
    Number(right.bracket5ConstructionCandidate) - Number(left.bracket5ConstructionCandidate)
    || right.achievedBracket - left.achievedBracket
    || right.verifiedWinningCombos - left.verifiedWinningCombos
    || right.candidate.coherenceScore - left.candidate.coherenceScore
    || left.candidate.label.localeCompare(right.candidate.label));

  const selected = successes[0]!;
  console.log(`\nSELECTED: ${selected.candidate.label} / bracket ${selected.achievedBracket} / constructionB5=${selected.bracket5ConstructionCandidate}`);

  const handler2 = createMcpHandler(createMtgServerV15);
  const client2 = new Client(
    { name: 'mtg-ultimate-v15-middle-earth-refine-live', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport2 = new StreamableHTTPClientTransport(new URL('http://middle-earth-refine.local/mcp'), {
    fetch: (url, init) => handler2.fetch(new Request(url, init)),
  });

  let refinement: Record<string, unknown> = {};
  try {
    await client2.connect(transport2);
    const response = await client2.callTool({
      name: 'refine_commander_deck_v12',
      arguments: {
        decklist: selected.decklist,
        targetBracket: 5,
        allowedSets: [...MIDDLE_EARTH_SETS],
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
    }, { timeout: 12 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    assert.notEqual(response.isError, true, 'Middle-earth refinement must execute');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'Middle-earth refinement must return JSON');
    refinement = JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client2.close();
    await handler2.close();
  }

  const refinedDecklist = typeof refinement.finalDecklist === 'string' && refinement.finalDecklist.trim()
    ? refinement.finalDecklist
    : selected.decklist;
  const refinedTruth = await verifyMiddleEarthDeck(refinedDecklist);
  const refinedEvaluation = await evaluateCommanderBuildV15(refinedDecklist, {
    allowedSets: [...MIDDLE_EARTH_SETS],
    includePromos: true,
    includeSpecialReleases: true,
    cedhIntent: true,
    optimizedPlanEvidence: true,
    competitiveMetagameEvidence: false,
  });

  const selectedEvaluation = record(selected.result.evaluation);
  const selectedActual = record(selectedEvaluation.actualBracket);
  const serializable = {
    schema: 'middle-earth-bracket5-live-v15.1',
    request: {
      allowedSets: [...MIDDLE_EARTH_SETS],
      includesLordOfTheRings: ['LTR', 'LTC'],
      includesTheHobbit: ['HOB', 'HOC'],
      targetBracket: 5,
      competitiveMetagameEvidence: false,
    },
    discovery: {
      discoveredCardCount: discovery.discoveredCardCount,
      discoveryBuckets: discovery.discoveryBuckets,
      attemptedCandidates: candidates,
    },
    successes: successes.map((item) => {
      const evaluation = record(item.result.evaluation);
      const actual = record(evaluation.actualBracket);
      return {
        candidate: item.candidate,
        commanderRefs: item.commanderRefs,
        achievedBracket: item.achievedBracket,
        achievedBand: item.achievedBand,
        bracket5ConstructionCandidate: item.bracket5ConstructionCandidate,
        bracket5Certified: item.bracket5Certified,
        verifiedWinningCombos: item.verifiedWinningCombos,
        bracket5ThresholdChecks: actual.bracket5ThresholdChecks,
        metrics: evaluation.metrics,
        selectedPackage: item.result.selectedPackage ?? null,
        exactPrintingVerification: item.hardTruth,
      };
    }),
    failures,
    selectedBuild: {
      candidate: selected.candidate,
      commanderRefs: selected.commanderRefs,
      achievedBracket: selected.achievedBracket,
      achievedBand: selected.achievedBand,
      bracket5ConstructionCandidate: selected.bracket5ConstructionCandidate,
      bracket5Certified: selected.bracket5Certified,
      verifiedWinningCombos: selected.verifiedWinningCombos,
      bracket5ThresholdChecks: selectedActual.bracket5ThresholdChecks,
      metrics: selectedEvaluation.metrics,
      exactPrintingVerification: selected.hardTruth,
    },
    refinement: {
      status: refinement.status ?? null,
      stopReason: refinement.stopReason ?? null,
      roundsAccepted: refinement.roundsAccepted ?? null,
      totalSwaps: refinement.totalSwaps ?? null,
      swaps: Array.isArray(refinement.swaps) ? refinement.swaps : [],
      finalBracket: refinedEvaluation.actualBracket.assessedBracket,
      finalBand: refinedEvaluation.actualBracket.assessedBand,
      finalBracket5ConstructionCandidate: refinedEvaluation.actualBracket.bracket5ConstructionCandidate,
      finalBracket5Certified: refinedEvaluation.actualBracket.bracket5CertifiedByThisAssessment,
      finalThresholdChecks: refinedEvaluation.actualBracket.bracket5ThresholdChecks,
      finalMetrics: refinedEvaluation.metrics,
      finalVerifiedWinningCombos: refinedEvaluation.postBuildEvidence.verifiedWinningCombos,
      exactPrintingVerification: refinedTruth,
    },
  };

  await writeFile('middle-earth-bracket5-live-result.json', `${JSON.stringify(serializable, null, 2)}\n`, 'utf8');
  await writeFile('middle-earth-bracket5-selected-deck.txt', `${selected.decklist.trim()}\n`, 'utf8');
  await writeFile('middle-earth-bracket5-refined-deck.txt', `${refinedDecklist.trim()}\n`, 'utf8');

  console.log(`REFINEMENT: status=${String(refinement.status)} swaps=${String(refinement.totalSwaps)} finalBracket=${String(refinedEvaluation.actualBracket.assessedBracket)} constructionB5=${String(refinedEvaluation.actualBracket.bracket5ConstructionCandidate)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('middle-earth-bracket5-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
