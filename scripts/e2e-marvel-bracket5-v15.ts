import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
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
    if (chosen.length >= 5) break;
    if (usedArchetypes.has(candidate.strategy.archetype)) continue;
    chosen.push(candidate);
    usedArchetypes.add(candidate.strategy.archetype);
  }
  for (const candidate of candidates) {
    if (chosen.length >= 5) break;
    if (chosen.some((current) => current.label === candidate.label)) continue;
    chosen.push(candidate);
  }
  return chosen;
}

async function exactMarvelCommanderRefs(candidate: NeutralCommanderCandidateV15): Promise<Array<{
  name: string;
  set: string;
  collectorNumber: string;
}>> {
  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
  });
  assert.ok(policy.familyMatchedSetCodes.length > 0, 'generic Marvel printing-family discovery must find at least one physical set code');

  const resolved = await getCardsByNames(candidate.commanderNames);
  assert.deepEqual(resolved.notFound, [], `${candidate.label} commander Oracle identities must resolve`);
  assert.equal(resolved.cards.length, candidate.commanderNames.length, `${candidate.label} must resolve every commander identity`);

  const refs: Array<{ name: string; set: string; collectorNumber: string }> = [];
  for (const name of candidate.commanderNames) {
    const oracle = resolved.cards.find((card) => card.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    assert.ok(oracle, `${name} must bind back to a resolved commander card`);
    const printing = await selectEligiblePrintingV08(oracle, policy);
    assert.ok(printing, `${name} must have an eligible Marvel physical printing`);
    refs.push({
      name: printing.card.name,
      set: printing.card.set.toUpperCase(),
      collectorNumber: printing.card.collector_number,
    });
  }
  return refs;
}

async function verifyMarvelDeck(decklist: string): Promise<{
  cardCount: number;
  commanderLegal: boolean;
  resolvedEntries: number;
  setCodes: string[];
}> {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'Marvel target build must contain exactly 100 Commander cards');
  const resolved = await getCardsByIdentifiers(allIdentifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact Marvel deck entry must resolve');
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, 'Marvel target build must pass hard Commander legality');

  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    'every exact physical printing, including commanders and basics, must satisfy the generic Marvel printing-family policy',
  );

  return {
    cardCount: parsed.totalCards,
    commanderLegal: rules.isLegal,
    resolvedEntries: resolved.cards.length,
    setCodes: [...new Set(resolved.cards.map((card) => card.set.toUpperCase()))].sort((a, b) => a.localeCompare(b)),
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
  hardTruth: Awaited<ReturnType<typeof verifyMarvelDeck>>;
}

async function main(): Promise<void> {
  console.log('MARVEL-ONLY BRACKET 5 TARGET LIVE CONTROL');
  console.log('INPUT: Use Marvel physical printings only and try to reach Commander Bracket 5.');
  console.log('No commander is hand-picked. Existing neutral commander discovery supplies candidate configurations; the universal V0.15 MCP Build pipeline receives targetBracket=5.');
  console.log('Bracket 5 remains an honest target: current competitive-metagame evidence is NOT fabricated.');

  const discovery = await discoverNeutralCommanderCandidatesV15({
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
    maxCandidates: 40,
  });
  assert.ok(discovery.discoveredCardCount > 0, 'Marvel printing-family discovery must find eligible commander cards');
  assert.ok(discovery.candidates.length > 0, 'Marvel printing-family discovery must produce commander configurations');

  console.log(`DISCOVERED MARVEL COMMANDER CARDS: ${discovery.discoveredCardCount}`);
  console.log(`DISCOVERY BUCKETS: ${JSON.stringify(discovery.discoveryBuckets)}`);
  console.log('TOP DISCOVERED COMMANDER CONFIGURATIONS:');
  discovery.candidates.slice(0, 12).forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.label} / ${candidate.strategy.archetype} / coherence=${candidate.coherenceScore}`);
  });

  const candidates = chooseCandidates(discovery.candidates);
  assert.ok(candidates.length > 0, 'Marvel Bracket 5 experiment must have at least one candidate');
  console.log(`TARGETED BUILD CANDIDATES: ${candidates.map((candidate) => candidate.label).join(' | ')}`);

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'mtg-ultimate-v15-marvel-bracket5-live', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://marvel-control.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  const successes: CandidateResult[] = [];
  const failures: Array<{ candidate: string; error: string; status?: string }> = [];

  try {
    await client.connect(transport);
    for (const candidate of candidates) {
      console.log(`\nBUILDING: ${candidate.label}`);
      try {
        const commanderRefs = await exactMarvelCommanderRefs(candidate);
        console.log(`EXACT MARVEL COMMANDER PRINTINGS: ${commanderRefs.map((ref) => `${ref.name} (${ref.set}) ${ref.collectorNumber}`).join(' + ')}`);

        const response = await client.callTool({
          name: 'build_commander_through_pipeline_v15',
          arguments: {
            commanders: commanderRefs,
            targetBracket: 5,
            printingFamily: 'Marvel',
            includePromos: true,
            includeSpecialReleases: true,
            winPackageMode: 'prefer',
            maxWinPackageCards: 3,
            cedhIntent: true,
            optimizedPlanEvidence: true,
            competitiveMetagameEvidence: false,
          },
        }, { timeout: 8 * 60_000 }) as unknown as {
          content: Array<{ type: string; text?: string }>;
          isError?: boolean;
        };
        assert.notEqual(response.isError, true, `${candidate.label} MCP call must not fail at the transport/tool boundary`);
        const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
        assert.ok(text, `${candidate.label} MCP call must return JSON text`);
        const result = JSON.parse(text) as Record<string, unknown>;
        if (result.status !== 'complete-evaluated-build') {
          failures.push({
            candidate: candidate.label,
            status: String(result.status ?? 'unknown'),
            error: String(result.guidance ?? 'pipeline did not return a complete evaluated build'),
          });
          console.log(`INCOMPLETE ${candidate.label}: status=${String(result.status)} guidance=${String(result.guidance ?? '')}`);
          continue;
        }

        assert.equal(result.requestedTargetBracket, 5, `${candidate.label} must preserve the requested Bracket 5 target`);
        const evaluation = record(result.evaluation);
        const actualBracket = record(evaluation.actualBracket);
        const targetComparison = record(result.targetComparison);
        const postBuildEvidence = record(evaluation.postBuildEvidence);
        const built = record(result.built);
        const decklist = typeof built.decklist === 'string' ? built.decklist : '';
        assert.ok(decklist.trim(), `${candidate.label} must retain the exact final decklist`);
        assert.equal(actualBracket.hardGatesPassed, true, `${candidate.label} must pass hard truth before power is reported`);
        assert.equal(evaluation.printingPolicySatisfied, true, `${candidate.label} must pass the Marvel physical-printing policy`);
        assert.equal(targetComparison.requestedBracket, 5, `${candidate.label} target comparison must stay Bracket 5`);

        const achievedBracket = finiteNumber(result.achievedBracket, -1);
        assert.ok(achievedBracket >= 1 && achievedBracket <= 5, `${candidate.label} must return a bounded achieved bracket`);
        if (achievedBracket < 5) assert.equal(targetComparison.status, 'under-target', `${candidate.label} below 5 must be reported honestly as under-target`);
        if (achievedBracket === 5) assert.equal(targetComparison.status, 'reached', `${candidate.label} at 5 must be reported as reached`);

        const hardTruth = await verifyMarvelDeck(decklist);
        const candidateResult: CandidateResult = {
          candidate,
          commanderRefs,
          result,
          decklist,
          achievedBracket,
          achievedBand: String(result.achievedBand ?? actualBracket.assessedBand ?? 'unknown'),
          bracket5ConstructionCandidate: actualBracket.bracket5ConstructionCandidate === true,
          bracket5Certified: actualBracket.bracket5CertifiedByThisAssessment === true,
          verifiedWinningCombos: finiteNumber(postBuildEvidence.verifiedWinningCombos),
          hardTruth,
        };
        successes.push(candidateResult);

        console.log(`RESULT ${candidate.label}: Bracket ${candidateResult.achievedBracket} (${candidateResult.achievedBand}); B5 construction candidate=${candidateResult.bracket5ConstructionCandidate}; certified=${candidateResult.bracket5Certified}; verified wins=${candidateResult.verifiedWinningCombos}`);
        const blockers = Array.isArray(targetComparison.knownBlockers) ? targetComparison.knownBlockers.map(record) : [];
        const unverified = Array.isArray(targetComparison.unverifiedChecks) ? targetComparison.unverifiedChecks.map(record) : [];
        console.log(`KNOWN B5 BLOCKERS: ${JSON.stringify(blockers, null, 2)}`);
        console.log(`UNVERIFIED B5 CHECKS: ${JSON.stringify(unverified, null, 2)}`);
      } catch (error) {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        failures.push({ candidate: candidate.label, error: message });
        console.log(`FAILED ${candidate.label}: ${message}`);
      }
    }
  } finally {
    await client.close();
    await handler.close();
  }

  assert.ok(successes.length > 0, `at least one Marvel-only targeted build must complete; failures=${JSON.stringify(failures)}`);
  successes.sort((left, right) =>
    right.achievedBracket - left.achievedBracket
    || Number(right.bracket5ConstructionCandidate) - Number(left.bracket5ConstructionCandidate)
    || right.verifiedWinningCombos - left.verifiedWinningCombos
    || right.candidate.coherenceScore - left.candidate.coherenceScore
    || left.candidate.label.localeCompare(right.candidate.label));
  const selected = successes[0]!;
  const selectedTarget = record(selected.result.targetComparison);
  const selectedEvaluation = record(selected.result.evaluation);
  const selectedActual = record(selectedEvaluation.actualBracket);

  const serializable = {
    schema: 'marvel-bracket5-target-live-v15.1',
    request: {
      printingFamily: 'Marvel',
      targetBracket: 5,
      cedhIntent: true,
      optimizedPlanEvidence: true,
      competitiveMetagameEvidence: false,
      commanderSuppliedByUser: false,
      selectionMethod: 'existing semantic commander discovery -> five diverse/top candidates -> real universal targeted builds -> strongest honestly assessed completed result',
    },
    discovery: {
      discoveredCardCount: discovery.discoveredCardCount,
      discoveryBuckets: discovery.discoveryBuckets,
      topCandidates: discovery.candidates.slice(0, 12),
      attemptedCandidates: candidates,
    },
    successes: successes.map((item) => {
      const evaluation = record(item.result.evaluation);
      const actual = record(evaluation.actualBracket);
      const target = record(item.result.targetComparison);
      const post = record(evaluation.postBuildEvidence);
      return {
        candidate: item.candidate,
        commanderRefs: item.commanderRefs,
        achievedBracket: item.achievedBracket,
        achievedBand: item.achievedBand,
        bracket5ConstructionCandidate: item.bracket5ConstructionCandidate,
        bracket5Certified: item.bracket5Certified,
        verifiedWinningCombos: item.verifiedWinningCombos,
        targetComparison: target,
        bracket5ThresholdChecks: actual.bracket5ThresholdChecks,
        metrics: evaluation.metrics,
        gameChangerNames: post.gameChangerNames,
        selectedPackage: item.result.selectedPackage ?? null,
        seededPackageVerifiedInFinalDeck: item.result.seededPackageVerifiedInFinalDeck ?? false,
        exactPrintingVerification: item.hardTruth,
      };
    }),
    failures,
    selected: {
      candidate: selected.candidate,
      commanderRefs: selected.commanderRefs,
      achievedBracket: selected.achievedBracket,
      achievedBand: selected.achievedBand,
      bracket5ConstructionCandidate: selected.bracket5ConstructionCandidate,
      bracket5Certified: selected.bracket5Certified,
      verifiedWinningCombos: selected.verifiedWinningCombos,
      targetComparison: selectedTarget,
      bracket5ThresholdChecks: selectedActual.bracket5ThresholdChecks,
      exactPrintingVerification: selected.hardTruth,
    },
  };

  await writeFile('marvel-bracket5-live-result.json', `${JSON.stringify(serializable, null, 2)}\n`, 'utf8');
  await writeFile('marvel-bracket5-selected-deck.txt', `${selected.decklist.trim()}\n`, 'utf8');

  console.log('\nSELECTED MARVEL-ONLY RESULT');
  console.log(`COMMANDER(S): ${selected.candidate.commanderNames.join(' + ')}`);
  console.log(`ACHIEVED: Bracket ${selected.achievedBracket} (${selected.achievedBand})`);
  console.log(`BRACKET 5 CONSTRUCTION CANDIDATE: ${selected.bracket5ConstructionCandidate}`);
  console.log(`BRACKET 5 CERTIFIED: ${selected.bracket5Certified}`);
  console.log(`VERIFIED WINNING COMBOS: ${selected.verifiedWinningCombos}`);
  console.log(`TARGET STATUS: ${String(selectedTarget.status)}`);
  console.log(`WHAT WOULD REACH TARGET: ${JSON.stringify(selectedTarget.whatWouldReachTarget ?? [], null, 2)}`);
  console.log(`MARVEL SETS USED: ${selected.hardTruth.setCodes.join(', ')}`);
  console.log('\nSELECTED 100-CARD MARVEL-ONLY DECKLIST');
  console.log(selected.decklist);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('marvel-bracket5-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
