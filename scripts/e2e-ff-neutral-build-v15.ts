import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { assessActualBracketV15 } from '../src/services/actual-bracket-assessment-v15.js';
import { countWinningCombosV14 } from '../src/services/cedh-win-package-v14.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { deriveEfficientCommanderWinPlanV15 } from '../src/services/efficient-win-plan-v15.js';
import {
  discoverNeutralCommanderCandidatesV15,
  type NeutralCommanderCandidateV15,
} from '../src/services/neutral-commander-selection-v15.js';
import { buildNeutralCommanderDeckV15 } from '../src/services/neutral-deck-builder-v15.js';
import { deriveNeutralWinRoutesV15 } from '../src/services/neutral-win-routes-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';

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

function chooseBuildCandidates(candidates: NeutralCommanderCandidateV15[]): NeutralCommanderCandidateV15[] {
  const chosen: NeutralCommanderCandidateV15[] = [];
  const top = candidates[0];
  if (top) chosen.push(top);
  const differentArchetype = candidates.find((candidate) =>
    !chosen.some((current) => current.label === candidate.label)
    && candidate.strategy.archetype !== top?.strategy.archetype);
  if (differentArchetype) chosen.push(differentArchetype);
  const partner = candidates.find((candidate) =>
    candidate.kind === 'partner-pair'
    && !chosen.some((current) => current.label === candidate.label));
  if (partner) chosen.push(partner);
  return chosen.slice(0, 3);
}

interface EvaluatedNeutralBuild {
  candidate: NeutralCommanderCandidateV15;
  decklist: string;
  metrics: ReturnType<typeof buildDeckMetrics>;
  gameChangerNames: string[];
  spellbookTag: string | null;
  completeCombos: number;
  verifiedWinningCombos: number;
  ruthlessCombos: number;
  strategicallyRelevantCombos: number;
  efficientWinPlanSupported: boolean;
  winRoutes: ReturnType<typeof deriveNeutralWinRoutesV15>;
  bracket: ReturnType<typeof assessActualBracketV15>;
  eligiblePoolSize: number;
  detectedRoleCounts: Record<string, unknown>;
  remainingRoleDeficits: Record<string, unknown>;
  landPlan: Record<string, unknown>;
}

async function evaluateCandidate(candidate: NeutralCommanderCandidateV15): Promise<EvaluatedNeutralBuild> {
  const built = await buildNeutralCommanderDeckV15(candidate.commanderNames, {
    archetype: candidate.strategy.archetype,
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  assert.equal(built.constructionIntent, 'neutral', `${candidate.label} must use the neutral construction lane`);
  assert.equal(built.targetBracket, null, `${candidate.label} neutral construction must not contain a hidden bracket target`);
  assert.equal(built.status, 'complete-neutral-draft', `${candidate.label} must complete a legal neutral draft; status=${String(built.status)}`);
  const decklist = typeof built.decklist === 'string' ? built.decklist : '';
  assert.ok(decklist.trim(), `${candidate.label} must produce a decklist`);

  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, `${candidate.label} must contain exactly 100 Commander cards`);
  assert.deepEqual(
    parsed.commanders.map((entry) => entry.name).sort((a, b) => a.localeCompare(b)),
    [...candidate.commanderNames].sort((a, b) => a.localeCompare(b)),
    `${candidate.label} must preserve the independently selected commander identity`,
  );

  const resolved = await getCardsByIdentifiers(allIdentifiers(parsed));
  assert.deepEqual(resolved.notFound, [], `${candidate.label} must resolve every exact printed deck entry`);
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
    `${candidate.label} must independently verify as FINAL FANTASY physical printings only`,
  );

  const metrics = buildDeckMetrics(parsed, resolved.cards);
  const [spellbookBracketRaw, combosRaw] = await Promise.all([
    estimateCommanderBracket(decklist),
    findDeckCombos(decklist, 100),
  ]);
  const spellbookBracket = record(spellbookBracketRaw);
  const combos = record(combosRaw);
  const comboCounts = record(combos.counts);
  const completeCombos = finiteNumber(comboCounts.included);
  const verifiedWinningCombos = countWinningCombosV14(combos);
  const included = Array.isArray(combos.included) ? combos.included.map(record) : [];
  const ruthlessCombos = included.filter((combo) => String(combo.bracketTag ?? '') === 'R').length;
  const strategicallyRelevantCombos = Array.isArray(spellbookBracket.strategicallyRelevantCombos)
    ? spellbookBracket.strategicallyRelevantCombos.length
    : 0;
  const spellbookTag = typeof spellbookBracket.bracketTag === 'string' ? spellbookBracket.bracketTag : null;
  const commanderCards: ScryfallCard[] = parsed.commanders
    .map((entry) => resolved.cards.find((card) => card.name.toLocaleLowerCase() === entry.name.toLocaleLowerCase()))
    .filter((card): card is ScryfallCard => Boolean(card));
  const efficientWinPlan = deriveEfficientCommanderWinPlanV15(decklist, commanderCards);
  const gameChangerNames = resolved.cards
    .filter((card) => card.game_changer === true)
    .map((card) => card.name)
    .sort((a, b) => a.localeCompare(b));
  const winRoutes = deriveNeutralWinRoutesV15({
    archetype: candidate.strategy.archetype,
    cards: resolved.cards,
    verifiedWinningCombos,
    efficientWinPlanSupported: efficientWinPlan.supported,
  });

  const bracket = assessActualBracketV15({
    commanderLegal: rules.isLegal,
    exactCardCount: parsed.totalCards === 100,
    fullyResolved: true,
    printingPolicyCompliant: offPolicy.length === 0,
    spellbookTag,
    verifiedWinningCombos,
    ruthlessWinningCombos: ruthlessCombos,
    strategicallyRelevantCombos,
    averageNonlandManaValue: metrics.averageNonlandManaValue,
    earlyPlayCount: metrics.earlyPlayCount,
    fastManaCount: metrics.fastManaCount,
    freeInteractionCount: Number(metrics.roleCounts['free interaction'] ?? 0),
    cheapInteractionCount: metrics.cheapInteractionCount,
    tutorCount: metrics.tutorCount,
    gameChangerCount: gameChangerNames.length,
    efficientWinConditionEvidence: efficientWinPlan.supported,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
  }, ['Final Fantasy physical printings only.']);

  return {
    candidate,
    decklist,
    metrics,
    gameChangerNames,
    spellbookTag,
    completeCombos,
    verifiedWinningCombos,
    ruthlessCombos,
    strategicallyRelevantCombos,
    efficientWinPlanSupported: efficientWinPlan.supported,
    winRoutes,
    bracket,
    eligiblePoolSize: finiteNumber(built.eligiblePoolSize),
    detectedRoleCounts: record(built.detectedRoleCounts),
    remainingRoleDeficits: record(built.remainingRoleDeficits),
    landPlan: record(built.landPlan),
  };
}

async function main(): Promise<void> {
  console.log('FF NEUTRAL AUTONOMOUS DECK-BUILD CONTROL');
  console.log('INPUT: Build me a Final Fantasy-only Commander deck.');
  console.log('NO COMMANDER, BRACKET, HIGH-POWER/CEDH INTENT, COMBO REQUIREMENT, OR BUDGET IS SUPPLIED.');
  console.log('Selection is strategy-coherence-first. Power/bracket is measured only after the 100-card deck is complete and independently verified.');

  const discovery = await discoverNeutralCommanderCandidatesV15({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxCandidates: 40,
  });
  assert.ok(discovery.discoveredCardCount > 0, 'neutral discovery must find eligible FF commander cards');
  assert.ok(discovery.candidates.length > 0, 'neutral discovery must produce commander configurations');

  console.log(`DISCOVERED ELIGIBLE COMMANDER CARDS: ${discovery.discoveredCardCount}`);
  console.log('TOP NEUTRAL STRATEGY-COHERENCE CANDIDATES:');
  discovery.candidates.slice(0, 12).forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.label} [${candidate.kind}] archetype=${candidate.strategy.archetype} coherence=${candidate.coherenceScore} evidence=${candidate.strategy.evidence.join('; ')}`);
  });

  const buildCandidates = chooseBuildCandidates(discovery.candidates);
  assert.ok(buildCandidates.length > 0, 'neutral experiment must have at least one candidate to build');
  console.log(`PREDECLARED BUILD ORDER: ${buildCandidates.map((candidate) => candidate.label).join(' | ')}`);
  console.log('The final selection will be the first successfully completed deck in this neutral ranking order, never the deck with the highest later bracket.');

  const evaluated: EvaluatedNeutralBuild[] = [];
  const failures: Array<{ candidate: string; archetype: string; error: string }> = [];
  for (const candidate of buildCandidates) {
    console.log(`\nBUILDING NEUTRAL CANDIDATE: ${candidate.label} / ${candidate.strategy.archetype}`);
    try {
      const result = await evaluateCandidate(candidate);
      evaluated.push(result);
      console.log(`RESULT ${candidate.label}: Bracket ${result.bracket.assessedBracket ?? 'unassessable'} (${result.bracket.assessedBand}); primary=${result.winRoutes.primary.label}; backup=${result.winRoutes.backup?.label ?? 'none'}; combos=${result.verifiedWinningCombos}`);
      console.log(`METRICS ${candidate.label}: lands=${result.metrics.landCount} avgMV=${result.metrics.averageNonlandManaValue} early=${result.metrics.earlyPlayCount} fastMana=${result.metrics.fastManaCount} cheapInteraction=${result.metrics.cheapInteractionCount} tutors=${result.metrics.tutorCount}`);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      failures.push({ candidate: candidate.label, archetype: candidate.strategy.archetype, error: message });
      console.log(`CANDIDATE BUILD FAILED ${candidate.label}: ${message}`);
    }
  }
  assert.ok(evaluated.length > 0, `at least one neutrally selected commander must produce a legal FF-only deck; failures=${JSON.stringify(failures)}`);

  const selected = buildCandidates
    .map((candidate) => evaluated.find((result) => result.candidate.label === candidate.label))
    .find((result): result is EvaluatedNeutralBuild => Boolean(result));
  assert.ok(selected, 'neutral selection must be chosen by predeclared ranking order, not after-the-fact bracket ranking');

  const serializable = {
    schema: 'ff-neutral-build-v15.1',
    input: {
      request: 'Build me a Final Fantasy-only Commander deck.',
      printingFamily: 'Final Fantasy',
      commanderSuppliedByUser: false,
      targetBracket: null,
      strongestPossibleIntent: false,
      optimizedHighPowerIntent: false,
      cedhIntent: false,
      comboRequirement: false,
      budget: null,
    },
    discovery: {
      eligibleCommanderCards: discovery.discoveredCardCount,
      discoveryBuckets: discovery.discoveryBuckets,
      rankedBy: 'semantic strategy coherence only; no name, EDHREC, mana-value, colour-count, bracket, or cEDH bonus',
      candidates: discovery.candidates,
      predeclaredBuildOrder: buildCandidates.map((candidate) => candidate.label),
    },
    evaluated: evaluated.map((result) => ({
      candidate: result.candidate,
      metrics: result.metrics,
      gameChangerNames: result.gameChangerNames,
      spellbookTag: result.spellbookTag,
      completeCombos: result.completeCombos,
      verifiedWinningCombos: result.verifiedWinningCombos,
      ruthlessCombos: result.ruthlessCombos,
      strategicallyRelevantCombos: result.strategicallyRelevantCombos,
      efficientWinPlanSupported: result.efficientWinPlanSupported,
      winRoutes: result.winRoutes,
      actualBracketAfterBuild: result.bracket,
      eligiblePoolSize: result.eligiblePoolSize,
      detectedRoleCounts: result.detectedRoleCounts,
      remainingRoleDeficits: result.remainingRoleDeficits,
      landPlan: result.landPlan,
    })),
    failures,
    selected: {
      candidate: selected.candidate,
      selectionReason: 'First successfully completed build in the predeclared neutral semantic-coherence ranking; bracket was not used to select it.',
      primaryWinRoute: selected.winRoutes.primary,
      backupWinRoute: selected.winRoutes.backup,
      assessedBracket: selected.bracket.assessedBracket,
      assessedBand: selected.bracket.assessedBand,
      bracketConfidence: selected.bracket.confidence,
      bracket5Certified: selected.bracket.bracket5CertifiedByThisAssessment,
      metrics: selected.metrics,
      gameChangerNames: selected.gameChangerNames,
      verifiedWinningCombos: selected.verifiedWinningCombos,
    },
  };

  await writeFile('ff-neutral-build-result.json', `${JSON.stringify(serializable, null, 2)}\n`, 'utf8');
  await writeFile('ff-neutral-build-selected-deck.txt', `${selected.decklist.trim()}\n`, 'utf8');

  console.log('\nNEUTRAL AUTONOMOUS SELECTION');
  console.log(`COMMANDER(S): ${selected.candidate.commanderNames.join(' + ')}`);
  console.log(`INFERRED ARCHETYPE: ${selected.candidate.strategy.archetype}`);
  console.log(`PRIMARY WIN ROUTE: ${selected.winRoutes.primary.label}`);
  console.log(`BACKUP WIN ROUTE: ${selected.winRoutes.backup?.label ?? 'No independently supported backup route'}`);
  console.log(`ACTUAL BRACKET AFTER BUILD: ${selected.bracket.assessedBracket ?? 'unassessable'} (${selected.bracket.assessedBand})`);
  console.log(`BRACKET CONFIDENCE: ${selected.bracket.confidence}`);
  console.log(`BRACKET 5 CERTIFIED: ${selected.bracket.bracket5CertifiedByThisAssessment}`);
  if (failures.length > 0) console.log(`FAILED/INCOMPLETE ALTERNATIVE BUILDS: ${JSON.stringify(failures, null, 2)}`);
  console.log('\nSELECTED 100-CARD DECKLIST');
  console.log(selected.decklist);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('ff-neutral-build-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
