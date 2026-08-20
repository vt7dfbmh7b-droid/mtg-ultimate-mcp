import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import {
  discoverAutoCommanderCandidatesV15,
  type AutoCommanderCandidateV15,
} from '../src/services/auto-commander-selection-v15.js';
import { assessBracketCeilingV15, type BracketCeilingAssessmentV15 } from '../src/services/bracket-ceiling-v15.js';
import { assessCedhReadinessV14, buildCommanderForCedhV14 } from '../src/services/cedh-workflow-v14.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { deriveEfficientCommanderWinPlanV15 } from '../src/services/efficient-win-plan-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function allEntries(parsed: ParsedDeck): DeckEntry[] {
  return [...parsed.commanders, ...parsed.main];
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return allEntries(parsed).map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

interface EvaluatedBuildV15 {
  candidate: AutoCommanderCandidateV15;
  buildStatus: string;
  decklist: string;
  commanderNames: string[];
  resolvedEntryCount: number;
  gameChangerNames: string[];
  readinessStatus: string;
  readinessMetrics: Record<string, unknown>;
  spellbookTag: string | null;
  completeCombos: number;
  winningCombos: number;
  ruthlessCombos: number;
  strategicallyRelevantCombos: number;
  efficientWinPlanSupported: boolean;
  bracket: BracketCeilingAssessmentV15;
  constructionPassCount: number;
  constructionCheckCount: number;
}

function compareEvaluated(left: EvaluatedBuildV15, right: EvaluatedBuildV15): number {
  const leftBracket = left.bracket.assessedBracket ?? 0;
  const rightBracket = right.bracket.assessedBracket ?? 0;
  if (leftBracket !== rightBracket) return rightBracket - leftBracket;
  if (left.constructionPassCount !== right.constructionPassCount) return right.constructionPassCount - left.constructionPassCount;
  if (left.winningCombos !== right.winningCombos) return right.winningCombos - left.winningCombos;
  const leftCompetitive = left.ruthlessCombos + left.strategicallyRelevantCombos;
  const rightCompetitive = right.ruthlessCombos + right.strategicallyRelevantCombos;
  if (leftCompetitive !== rightCompetitive) return rightCompetitive - leftCompetitive;
  const leftMv = finiteNumber(left.readinessMetrics.averageNonlandManaValue, 99);
  const rightMv = finiteNumber(right.readinessMetrics.averageNonlandManaValue, 99);
  if (leftMv !== rightMv) return leftMv - rightMv;
  const leftEarly = finiteNumber(left.readinessMetrics.earlyPlayCount);
  const rightEarly = finiteNumber(right.readinessMetrics.earlyPlayCount);
  if (leftEarly !== rightEarly) return rightEarly - leftEarly;
  if (left.candidate.score !== right.candidate.score) return right.candidate.score - left.candidate.score;
  return left.candidate.label.localeCompare(right.candidate.label);
}

async function evaluateBuild(
  candidate: AutoCommanderCandidateV15,
  built: Record<string, unknown>,
): Promise<EvaluatedBuildV15> {
  const decklist = typeof built.finalDecklist === 'string' ? built.finalDecklist : '';
  assert.ok(decklist.trim(), `builder must produce a final decklist for ${candidate.label}`);
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, `${candidate.label} final build must contain exactly 100 cards`);
  assert.deepEqual(
    parsed.commanders.map((entry) => entry.name).sort((a, b) => a.localeCompare(b)),
    [...candidate.commanderNames].sort((a, b) => a.localeCompare(b)),
    `${candidate.label} build must preserve the auto-selected commander identity`,
  );

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], `${candidate.label} must fully resolve every exact deck entry`);
  assert.equal(resolved.cards.length, allEntries(parsed).length, `${candidate.label} must resolve every unique physical entry`);
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, `${candidate.label} must pass hard Commander legality`);

  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    `${candidate.label} must use only FINAL FANTASY-family physical printings`,
  );

  const [readiness, spellbookBracket, combos] = await Promise.all([
    assessCedhReadinessV14(decklist, {
      printingFamily: 'Final Fantasy',
      includePromos: true,
      includeSpecialReleases: true,
    }),
    estimateCommanderBracket(decklist),
    findDeckCombos(decklist, 100),
  ]);
  assert.notEqual(readiness.status, 'invalid-or-policy-noncompliant', `${candidate.label} independent readiness assessment must accept the finished deck`);

  const comboCounts = record(combos.counts);
  const completeCombos = finiteNumber(comboCounts.included);
  const included = Array.isArray(combos.included) ? combos.included.map(record) : [];
  const ruthlessCombos = included.filter((combo) => String(combo.bracketTag ?? '') === 'R').length;
  const strategicallyRelevantCombos = Array.isArray(spellbookBracket.strategicallyRelevantCombos)
    ? spellbookBracket.strategicallyRelevantCombos.length
    : 0;
  const readinessMetrics = record(readiness.metrics);
  const winningCombos = finiteNumber(readiness.winningCombos);
  const commanderCards: ScryfallCard[] = parsed.commanders
    .map((entry) => resolved.cards.find((card) => card.name.toLocaleLowerCase() === entry.name.toLocaleLowerCase()))
    .filter((card): card is ScryfallCard => Boolean(card));
  const winPlan = deriveEfficientCommanderWinPlanV15(decklist, commanderCards);
  const gameChangerNames = resolved.cards.filter((card) => card.game_changer === true).map((card) => card.name).sort();

  const bracket = assessBracketCeilingV15(5, {
    commanderLegal: rules.isLegal,
    exactCardCount: parsed.totalCards === 100,
    fullyResolved: true,
    printingPolicyCompliant: true,
    spellbookTag: typeof spellbookBracket.bracketTag === 'string' ? spellbookBracket.bracketTag : null,
    verifiedWinningCombos: winningCombos,
    ruthlessWinningCombos: ruthlessCombos,
    strategicallyRelevantCombos,
    averageNonlandManaValue: finiteNumber(readinessMetrics.averageNonlandManaValue, 99),
    earlyPlayCount: finiteNumber(readinessMetrics.earlyPlayCount),
    fastManaCount: finiteNumber(readinessMetrics.fastManaCount),
    freeInteractionCount: finiteNumber(readinessMetrics.freeInteractionCount),
    cheapInteractionCount: finiteNumber(readinessMetrics.cheapInteractionCount),
    tutorCount: finiteNumber(readinessMetrics.tutorCount),
    gameChangerCount: gameChangerNames.length,
    efficientWinConditionEvidence: winPlan.supported,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
  }, ['Final Fantasy physical printings only.', 'Commander selected automatically with no user-supplied commander.']);

  const construction = bracket.bracket5ThresholdChecks.filter((check) => check.category === 'construction');
  return {
    candidate,
    buildStatus: String(built.status ?? 'unknown'),
    decklist,
    commanderNames: parsed.commanders.map((entry) => entry.name),
    resolvedEntryCount: resolved.cards.length,
    gameChangerNames,
    readinessStatus: String(readiness.status ?? 'unknown'),
    readinessMetrics,
    spellbookTag: typeof spellbookBracket.bracketTag === 'string' ? spellbookBracket.bracketTag : null,
    completeCombos,
    winningCombos,
    ruthlessCombos,
    strategicallyRelevantCombos,
    efficientWinPlanSupported: winPlan.supported,
    bracket,
    constructionPassCount: construction.filter((check) => check.passed).length,
    constructionCheckCount: construction.length,
  };
}

async function main(): Promise<void> {
  console.log('FF AUTO-COMMANDER BUILD CONTROL');
  console.log('INPUT CONSTRAINT: FINAL FANTASY physical printings only.');
  console.log('NO COMMANDER NAME IS SUPPLIED TO THE SELECTOR.');
  console.log('The selector discovers commanders from the eligible printing pool, ranks them by command-zone efficiency/card text/color access, then the builder constructs and independently verifies competing full decks.');

  const discovery = await discoverAutoCommanderCandidatesV15({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxCandidates: 30,
  });
  assert.ok(discovery.discoveredCardCount > 0, 'automatic discovery must find eligible FF commander cards');
  assert.ok(discovery.candidates.length > 0, 'automatic discovery must produce ranked commander configurations');

  const singles = discovery.candidates.filter((candidate) => candidate.kind === 'single').slice(0, 2);
  const pairs = discovery.candidates.filter((candidate) => candidate.kind === 'partner-pair').slice(0, 1);
  const buildCandidates = [...singles, ...pairs];
  assert.ok(buildCandidates.length >= 2, 'the live control needs at least two independently selected commander candidates to compare');

  console.log(`DISCOVERED ELIGIBLE COMMANDER CARDS: ${discovery.discoveredCardCount}`);
  console.log('TOP AUTO-SELECTION RANKING:');
  discovery.candidates.slice(0, 12).forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.label} [${candidate.kind}] score=${candidate.score} colors=${candidate.colorIdentity.join('')} avgMV=${candidate.averageManaValue} signals=${candidate.signals.join('; ')}`);
  });
  console.log(`\nFULL BUILDS TO COMPARE: ${buildCandidates.map((candidate) => candidate.label).join(' | ')}`);

  const evaluated: EvaluatedBuildV15[] = [];
  const failures: Array<{ candidate: string; error: string }> = [];
  for (const candidate of buildCandidates) {
    console.log(`\nBUILDING AUTO-SELECTED COMMANDER: ${candidate.label}`);
    try {
      const built = await buildCommanderForCedhV14(candidate.commanderNames, {
        printingFamily: 'Final Fantasy',
        includePromos: true,
        includeSpecialReleases: true,
        requireVerifiedCombo: false,
        maxMissingCards: 3,
        maxCandidatesToVerify: 8,
        maxEfficiencySwaps: 5,
        maxManaBaseSwaps: 6,
      });
      const result = await evaluateBuild(candidate, built);
      evaluated.push(result);
      console.log(`RESULT ${candidate.label}: Bracket ${result.bracket.assessedBracket ?? 'unassessable'} (${result.bracket.assessedBand}), B5 construction gates ${result.constructionPassCount}/${result.constructionCheckCount}, readiness=${result.readinessStatus}, winningCombos=${result.winningCombos}`);
      console.log(`METRICS ${candidate.label}: ${JSON.stringify(result.readinessMetrics)}`);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      failures.push({ candidate: candidate.label, error: message });
      console.log(`BUILD FAILED ${candidate.label}: ${message}`);
    }
  }

  assert.ok(evaluated.length >= 1, `at least one automatically selected commander must produce a fully legal FF-only 100-card deck; failures=${JSON.stringify(failures)}`);
  evaluated.sort(compareEvaluated);
  const winner = evaluated[0]!;

  const serializable = {
    schema: 'ff-auto-commander-build-v15.1',
    input: {
      printingFamily: 'Final Fantasy',
      commanderSuppliedByUser: false,
      target: 'strongest honest construction under the printing restriction',
    },
    discovery: {
      eligibleCommanderCards: discovery.discoveredCardCount,
      rankedCandidates: discovery.candidates,
      fullBuildCandidates: buildCandidates,
    },
    evaluated: evaluated.map((result) => ({
      candidate: result.candidate,
      buildStatus: result.buildStatus,
      commanderNames: result.commanderNames,
      gameChangerNames: result.gameChangerNames,
      readinessStatus: result.readinessStatus,
      readinessMetrics: result.readinessMetrics,
      spellbookTag: result.spellbookTag,
      completeCombos: result.completeCombos,
      winningCombos: result.winningCombos,
      ruthlessCombos: result.ruthlessCombos,
      strategicallyRelevantCombos: result.strategicallyRelevantCombos,
      efficientWinPlanSupported: result.efficientWinPlanSupported,
      constructionPassCount: result.constructionPassCount,
      constructionCheckCount: result.constructionCheckCount,
      bracket: result.bracket,
    })),
    failures,
    winner: {
      candidate: winner.candidate,
      commanderNames: winner.commanderNames,
      assessedBracket: winner.bracket.assessedBracket,
      assessedBand: winner.bracket.assessedBand,
      constructionPassCount: winner.constructionPassCount,
      constructionCheckCount: winner.constructionCheckCount,
      readinessStatus: winner.readinessStatus,
      readinessMetrics: winner.readinessMetrics,
      winningCombos: winner.winningCombos,
      efficientWinPlanSupported: winner.efficientWinPlanSupported,
      gameChangerNames: winner.gameChangerNames,
    },
  };

  await writeFile('ff-auto-commander-result.json', `${JSON.stringify(serializable, null, 2)}\n`, 'utf8');
  await writeFile('ff-auto-commander-winning-deck.txt', `${winner.decklist.trim()}\n`, 'utf8');

  console.log('\nAUTO-COMMANDER COMPARISON RESULTS');
  for (const result of evaluated) {
    console.log(`- ${result.candidate.label}: Bracket ${result.bracket.assessedBracket ?? 'unassessable'} / ${result.bracket.assessedBand}; B5 construction ${result.constructionPassCount}/${result.constructionCheckCount}; avgMV=${finiteNumber(result.readinessMetrics.averageNonlandManaValue, 99)}; early=${finiteNumber(result.readinessMetrics.earlyPlayCount)}; fastMana=${finiteNumber(result.readinessMetrics.fastManaCount)}; cheapInteraction=${finiteNumber(result.readinessMetrics.cheapInteractionCount)}; tutors=${finiteNumber(result.readinessMetrics.tutorCount)}; winningCombos=${result.winningCombos}`);
  }
  if (failures.length > 0) console.log(`FAILED CANDIDATE BUILDS: ${JSON.stringify(failures, null, 2)}`);

  console.log('\nAUTO-SELECTED WINNER');
  console.log(`COMMANDER(S): ${winner.commanderNames.join(' + ')}`);
  console.log(`HONEST ASSESSED BRACKET: ${winner.bracket.assessedBracket ?? 'unassessable'}`);
  console.log(`ASSESSED BAND: ${winner.bracket.assessedBand}`);
  console.log(`B5 CONSTRUCTION GATES: ${winner.constructionPassCount}/${winner.constructionCheckCount}`);
  console.log(`READINESS STATUS: ${winner.readinessStatus}`);
  console.log(`READINESS METRICS: ${JSON.stringify(winner.readinessMetrics, null, 2)}`);
  console.log(`GAME CHANGERS: ${winner.gameChangerNames.join(', ') || 'none'}`);
  console.log(`WINNING COMBOS: ${winner.winningCombos}`);
  console.log(`COMMANDER-CENTRIC EFFICIENT WIN PLAN: ${winner.efficientWinPlanSupported}`);
  console.log(`FAILED BRACKET-5 THRESHOLDS: ${JSON.stringify(winner.bracket.bracket5ThresholdChecks.filter((check) => !check.passed), null, 2)}`);
  console.log('\nWINNING DECKLIST');
  console.log(winner.decklist.trim());
  console.log('\nFF AUTO-COMMANDER BUILD CONTROL: PASS');
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error('\nFF AUTO-COMMANDER BUILD CONTROL: FAIL');
  console.error(message);
  await writeFile('ff-auto-commander-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
