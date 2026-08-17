import assert from 'node:assert/strict';
import { assessBracketCeilingV15 } from '../src/services/bracket-ceiling-v15.js';
import { assessCedhReadinessV14, buildCommanderForCedhV14 } from '../src/services/cedh-workflow-v14.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown, fallback = 0): number {
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

async function verifyFinalDeck(decklist: string): Promise<{
  parsed: ParsedDeck;
  rules: ReturnType<typeof validateCommanderDeck>;
  resolvedCount: number;
  gameChangerNames: string[];
}> {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'final deck must contain exactly 100 cards');
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact card/printing identifier must resolve');
  assert.equal(resolved.cards.length, allEntries(parsed).length, 'every unique deck entry must resolve to an exact printing');
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, 'final deck must pass hard Commander legality');
  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    'every physical printing, including commander and basics, must belong to the active FINAL FANTASY printing family',
  );
  const gameChangerNames = resolved.cards.filter((card) => card.game_changer === true).map((card) => card.name).sort();
  return { parsed, rules, resolvedCount: resolved.cards.length, gameChangerNames };
}

async function main(): Promise<void> {
  const commander = 'Najeela, the Blade-Blossom';
  console.log('FF BRACKET 5 TARGET E2E: building a FINAL FANTASY-printings-only Commander deck...');
  console.log(`Commander Oracle identity: ${commander}`);
  console.log('Goal: strongest cEDH-oriented construction the current FF physical-printing pool can support.');
  console.log('Important: Bracket 5 is a target, not an assumed result. The final reported bracket comes from the conservative V0.15 ceiling assessor.');

  const ffOptions = {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  } as const;

  const built = await buildCommanderForCedhV14([commander], {
    ...ffOptions,
    requireVerifiedCombo: true,
    maxMissingCards: 2,
    maxCandidatesToVerify: 8,
    maxEfficiencySwaps: 3,
    maxManaBaseSwaps: 5,
  });
  assert.notEqual(built.status, 'commander-resolution-failed', 'the FF control must resolve its commander');
  assert.notEqual(built.status, 'incomplete-first-draft', 'the FF control must produce a complete 100-card candidate before power can be assessed');

  const finalDecklist = typeof built.finalDecklist === 'string' ? built.finalDecklist : '';
  assert.ok(finalDecklist.trim(), 'V0.14 build must return a complete final decklist');
  const verified = await verifyFinalDeck(finalDecklist);
  const [spellbookBracket, combos, readiness] = await Promise.all([
    estimateCommanderBracket(finalDecklist),
    findDeckCombos(finalDecklist, 100),
    assessCedhReadinessV14(finalDecklist, ffOptions),
  ]);

  assert.notEqual(readiness.status, 'invalid-or-policy-noncompliant', 'the independently reassessed final deck must remain legal and FF-printing compliant');

  const comboCounts = record(combos.counts);
  const completeCombos = number(comboCounts.included);
  const ruthlessCombos = Array.isArray(combos.included)
    ? combos.included.map(record).filter((combo) => String(combo.bracketTag ?? '') === 'R').length
    : 0;
  const strategicallyRelevant = Array.isArray(spellbookBracket.strategicallyRelevantCombos)
    ? spellbookBracket.strategicallyRelevantCombos.length
    : 0;
  const readinessMetrics = record(readiness.metrics);
  const constructionSignals = record(readiness.constructionSignals);
  const winningCombos = number(readiness.winningCombos);
  const refinement = record(built.refinement);
  const stages = record(refinement.stages);
  const comboStage = record(stages.comboCompletion);
  const efficiencyStage = record(stages.strictEfficiency);
  const manaStage = record(stages.manaBase);

  // A static FF-only construction run does not, by itself, prove current cEDH metagame performance.
  // Efficient non-combo win evidence also remains false until a separate win-plan verifier proves it.
  const competitiveMetagameEvidence = false;
  const efficientWinConditionEvidence = false;
  const ceiling = assessBracketCeilingV15(5, {
    commanderLegal: verified.rules.isLegal,
    exactCardCount: verified.parsed.totalCards === 100,
    fullyResolved: true,
    printingPolicyCompliant: true,
    spellbookTag: typeof spellbookBracket.bracketTag === 'string' ? spellbookBracket.bracketTag : null,
    verifiedWinningCombos: winningCombos,
    ruthlessWinningCombos: ruthlessCombos,
    strategicallyRelevantCombos: strategicallyRelevant,
    averageNonlandManaValue: number(readinessMetrics.averageNonlandManaValue, 99),
    earlyPlayCount: number(readinessMetrics.earlyPlayCount),
    fastManaCount: number(readinessMetrics.fastManaCount),
    freeInteractionCount: number(readinessMetrics.freeInteractionCount),
    cheapInteractionCount: number(readinessMetrics.cheapInteractionCount),
    tutorCount: number(readinessMetrics.tutorCount),
    gameChangerCount: verified.gameChangerNames.length,
    efficientWinConditionEvidence,
    optimizedPlanEvidence: readiness.status === 'strong-competitive-construction-signals',
    cedhIntent: true,
    competitiveMetagameEvidence,
  }, ['Final Fantasy physical printings only.']);

  assert.equal(ceiling.hardGatesPassed, true, 'hard legality/construction/printing gates must pass before a bracket can be reported');
  assert.equal(
    ceiling.bracket5CertifiedByThisAssessment,
    false,
    'a static FF-only construction test must never certify Bracket 5 without independent current metagame evidence',
  );
  assert.ok(
    ceiling.assessedBracket !== null && ceiling.assessedBracket <= 4,
    'without independent competitive-metagame evidence, the honest reported ceiling must remain below Bracket 5',
  );

  const commanderEntry = verified.parsed.commanders[0];
  const bracket5TargetAchieved = ceiling.bracket5CertifiedByThisAssessment;
  const failedThresholds = ceiling.bracket5ThresholdChecks.filter((check) => !check.passed);
  console.log(`\nCOMMANDER PRINTING: ${commanderEntry?.name ?? commander} (${commanderEntry?.set ?? '?'}) ${commanderEntry?.collectorNumber ?? '?'}`);
  console.log(`FINAL CARD COUNT: ${verified.parsed.totalCards}`);
  console.log(`COMMANDER LEGAL: ${verified.rules.isLegal}`);
  console.log(`FF PRINTING POLICY: PASS (${verified.resolvedCount}/${verified.resolvedCount} exact printing entries eligible)`);
  console.log(`CURRENT GAME CHANGERS (${verified.gameChangerNames.length}): ${verified.gameChangerNames.join(', ') || 'none'}`);
  console.log(`BUILD STATUS: ${String(built.status)}`);
  console.log(`INDEPENDENT cEDH READINESS: ${String(readiness.status)}`);
  console.log(`FINAL SPELLBOOK TAG: ${String(spellbookBracket.bracketTag ?? 'unknown')}`);
  console.log(`COMPLETE COMBOS: ${completeCombos}`);
  console.log(`WIN-ORIENTED COMBOS: ${winningCombos}`);
  console.log(`RUTHLESS COMBOS: ${ruthlessCombos}`);
  console.log(`STRATEGICALLY RELEVANT COMBOS: ${strategicallyRelevant}`);
  console.log(`READINESS METRICS: ${JSON.stringify(readinessMetrics, null, 2)}`);
  console.log(`CONSTRUCTION SIGNALS: ${JSON.stringify(constructionSignals, null, 2)}`);
  console.log(`EFFICIENT NON-COMBO WIN EVIDENCE: ${efficientWinConditionEvidence}`);
  console.log(`BRACKET 5 CONSTRUCTION CANDIDATE: ${ceiling.bracket5ConstructionCandidate}`);
  console.log(`INDEPENDENT CURRENT METAGAME EVIDENCE: ${competitiveMetagameEvidence}`);
  console.log(`HONEST ASSESSED BRACKET: ${ceiling.assessedBracket ?? 'unassessable'}`);
  console.log(`ASSESSED BAND: ${ceiling.assessedBand}`);
  console.log(`BRACKET 5 TARGET ACHIEVED: ${bracket5TargetAchieved}`);
  console.log(`FAILED BRACKET 5 THRESHOLDS: ${JSON.stringify(failedThresholds, null, 2)}`);
  console.log(`RESTRICTION ANALYSIS: ${JSON.stringify(ceiling.constraintAnalysis, null, 2)}`);
  console.log(`CEILING REASONS: ${JSON.stringify(ceiling.ceilingReasons, null, 2)}`);
  console.log(`COMBO STAGE: ${JSON.stringify(comboStage, null, 2)}`);
  console.log(`EFFICIENCY STAGE: ${JSON.stringify(efficiencyStage, null, 2)}`);
  console.log(`MANA STAGE: ${JSON.stringify(manaStage, null, 2)}`);

  console.log('\nFINAL DECKLIST');
  console.log(finalDecklist.trim());
  console.log('\nCONTROL RESULT: PASS means the strongest FF-only construction was built, legally verified, and honestly classified. It does NOT mean Bracket 5 was achieved.');
  console.log(`FF BRACKET 5 TARGET RESULT: assessed Bracket ${ceiling.assessedBracket ?? 'unassessable'}; Bracket 5 target achieved=${bracket5TargetAchieved}.`);
}

main().catch((error) => {
  console.error('\nFF BRACKET 5 CONTROL RESULT: FAIL — the control itself could not produce and honestly assess a valid FF-only deck.');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
