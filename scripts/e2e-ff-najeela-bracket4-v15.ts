import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessBracketCeilingV15 } from '../src/services/bracket-ceiling-v15.js';
import { assessCedhReadinessV14 } from '../src/services/cedh-workflow-v14.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { deriveEfficientCommanderWinPlanV15 } from '../src/services/efficient-win-plan-v15.js';
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

async function main(): Promise<void> {
  const decklist = await readFile(new URL('../testdata/ff-najeela-powerful-baseline.txt', import.meta.url), 'utf8');
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'the pinned Najeela calibration deck must contain exactly 100 cards');
  assert.equal(parsed.commanders.length, 1, 'the calibration must have exactly one commander');
  assert.equal(parsed.commanders[0]?.name, 'Najeela, the Blade-Blossom', 'the pinned calibration commander must remain Najeela');

  console.log('FF NAJEELA HIGH-BRACKET-4 CALIBRATION: verifying the pinned 100-card FINAL FANTASY-only Najeela shell...');
  console.log('Purpose: prove the assessor can recognize an optimized commander-centric combat win plan as Bracket 4 without inventing a cEDH/Bracket-5 claim.');

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact card/printing identifier in the Najeela calibration must resolve');
  assert.equal(resolved.cards.length, allEntries(parsed).length, 'every unique deck entry must resolve to an exact physical printing');

  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, 'the Najeela calibration must pass hard Commander legality');

  const ffOptions = {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  } as const;
  const policy = await resolvePrintingPolicyV08(ffOptions);
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    'every exact physical printing in the calibration must be an eligible FINAL FANTASY printing',
  );

  const [readiness, spellbookBracket, combos] = await Promise.all([
    assessCedhReadinessV14(decklist, ffOptions),
    estimateCommanderBracket(decklist),
    findDeckCombos(decklist, 100),
  ]);
  assert.notEqual(readiness.status, 'invalid-or-policy-noncompliant', 'independent readiness analysis must accept the exact deck and FF printing policy');

  const winPlan = deriveEfficientCommanderWinPlanV15(decklist, resolved.cards);
  assert.equal(
    winPlan.supported,
    true,
    `Najeela's Oracle text should independently prove the commander-centric combat route; blockers=${winPlan.blockers.join(' | ')}`,
  );

  const comboCounts = record(combos.counts);
  const completeCombos = number(comboCounts.included);
  const ruthlessCombos = Array.isArray(combos.included)
    ? combos.included.map(record).filter((combo) => String(combo.bracketTag ?? '') === 'R').length
    : 0;
  const strategicallyRelevant = Array.isArray(spellbookBracket.strategicallyRelevantCombos)
    ? spellbookBracket.strategicallyRelevantCombos.length
    : 0;
  const readinessMetrics = record(readiness.metrics);
  const gameChangerNames = resolved.cards.filter((card) => card.game_changer === true).map((card) => card.name).sort();
  const winningCombos = number(readiness.winningCombos);

  const baseSignals = {
    commanderLegal: rules.isLegal,
    exactCardCount: parsed.totalCards === 100,
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
    efficientWinConditionEvidence: winPlan.supported,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
  } as const;

  const ceiling = assessBracketCeilingV15(5, {
    ...baseSignals,
    gameChangerCount: gameChangerNames.length,
  }, ['Final Fantasy physical printings only.']);

  // This shadow pass removes the current Game Changer bracket floor entirely. If it still
  // assesses Bracket 4, the result is coming from optimized construction + proven Najeela
  // combat evidence, not from a shortcut based on the number of Game Changers.
  const withoutGameChangerFloor = assessBracketCeilingV15(5, {
    ...baseSignals,
    gameChangerCount: 0,
  }, ['Final Fantasy physical printings only.']);

  assert.equal(ceiling.hardGatesPassed, true);
  assert.equal(
    withoutGameChangerFloor.assessedBracket,
    4,
    'the pinned Najeela shell must independently calibrate to Bracket 4 even with the Game Changer floor removed',
  );
  assert.equal(
    ceiling.assessedBracket,
    4,
    'the real current-card-data assessment should classify this FF Najeela calibration as Bracket 4',
  );
  assert.equal(ceiling.bracket5CertifiedByThisAssessment, false, 'the high-Bracket-4 calibration must never be promoted to Bracket 5 without cEDH evidence');
  assert.ok(
    ceiling.supportingSignals.some((signal) => /efficient non-combo win condition/i.test(signal)),
    'the reported Bracket 4 result must expose the commander-centric win-plan evidence',
  );

  const failedBracket5 = ceiling.bracket5ThresholdChecks.filter((check) => !check.passed);
  console.log(`COMMANDER: ${parsed.commanders[0]?.name}`);
  console.log(`FINAL CARD COUNT: ${parsed.totalCards}`);
  console.log(`COMMANDER LEGAL: ${rules.isLegal}`);
  console.log(`FF PRINTING POLICY: PASS (${resolved.cards.length}/${resolved.cards.length} exact printing entries eligible)`);
  console.log(`CURRENT GAME CHANGERS (${gameChangerNames.length}): ${gameChangerNames.join(', ') || 'none'}`);
  console.log(`SPELLBOOK TAG: ${String(spellbookBracket.bracketTag ?? 'unknown')}`);
  console.log(`COMPLETE COMBOS: ${completeCombos}`);
  console.log(`WIN-ORIENTED COMBOS: ${winningCombos}`);
  console.log(`RUTHLESS COMBOS: ${ruthlessCombos}`);
  console.log(`STRATEGICALLY RELEVANT COMBOS: ${strategicallyRelevant}`);
  console.log(`READINESS STATUS: ${String(readiness.status)}`);
  console.log(`READINESS METRICS: ${JSON.stringify(readinessMetrics, null, 2)}`);
  console.log(`NAJEELA COMBAT WIN-PLAN EVIDENCE: ${JSON.stringify(winPlan, null, 2)}`);
  console.log(`HONEST ASSESSED BRACKET: ${ceiling.assessedBracket ?? 'unassessable'}`);
  console.log(`ASSESSED BAND: ${ceiling.assessedBand}`);
  console.log(`SHADOW ASSESSMENT WITH GAME CHANGERS FORCED TO ZERO: ${withoutGameChangerFloor.assessedBracket ?? 'unassessable'}`);
  console.log(`BRACKET 5 CERTIFIED: ${ceiling.bracket5CertifiedByThisAssessment}`);
  console.log(`FAILED BRACKET 5 THRESHOLDS: ${JSON.stringify(failedBracket5, null, 2)}`);
  console.log(`RESTRICTION ANALYSIS: ${JSON.stringify(ceiling.constraintAnalysis, null, 2)}`);
  console.log(`CEILING REASONS: ${JSON.stringify(ceiling.ceilingReasons, null, 2)}`);
  console.log('\nFF NAJEELA HIGH-BRACKET-4 CALIBRATION: PASS');
}

main().catch((error) => {
  console.error('\nFF NAJEELA HIGH-BRACKET-4 CALIBRATION: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
