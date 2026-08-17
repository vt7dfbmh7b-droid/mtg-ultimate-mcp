import assert from 'node:assert/strict';
import { assessBracketCeilingV15 } from '../src/services/bracket-ceiling-v15.js';
import { assessCedhReadinessV14 } from '../src/services/cedh-workflow-v14.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { buildCommanderDeckUnderWholeBudgetV15 } from '../src/services/deck-whole-budget-v15.js';
import { getCardsByIdentifiers, getCardsByNames, type CardIdentifierInput } from '../src/services/scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

async function main(): Promise<void> {
  const commanderName = 'Kinnan, Bonder Prodigy';
  const maxDeckUsd = 100;
  console.log(`US$${maxDeckUsd} WHOLE-DECK CONTROL: building ${commanderName} with a hard total-card-price ceiling...`);
  console.log('Important: the budget is a hard construction constraint, while Bracket 5 remains only a target.');

  const commanderResolution = await getCardsByNames([commanderName]);
  assert.deepEqual(commanderResolution.notFound, [], 'budget control commander must resolve');
  assert.equal(commanderResolution.cards.length, 1, 'budget control requires one resolved commander');

  const result = await buildCommanderDeckUnderWholeBudgetV15(commanderResolution.cards, {
    targetBracket: 5,
    maxDeckUsd,
    landCount: 30,
  });

  console.log(`BUDGET SEARCH STATUS: ${String(result.status)}`);
  console.log(`BUDGET SEARCH ATTEMPTS: ${JSON.stringify(result.attempts ?? [], null, 2)}`);
  if (result.status !== 'budget-compliant') {
    console.log(`GUIDANCE: ${String(result.guidance ?? '')}`);
    throw new Error(`The current hard-budget search did not find a fully priced legal candidate at or below US$${maxDeckUsd}. This is an honest search failure, not permission to exceed the cap.`);
  }

  const audit = record(result.budgetAudit);
  assert.equal(audit.withinBudget, true, 'successful budget control must independently audit at or below the hard cap');
  const auditedTotal = number(audit.auditedTotalUsd, Number.POSITIVE_INFINITY);
  assert.ok(auditedTotal <= maxDeckUsd, `audited deck total US$${auditedTotal} must not exceed US$${maxDeckUsd}`);
  assert.deepEqual(audit.unknownPriceEntries ?? [], [], 'hard-budget proof cannot contain unknown exact-printing prices');
  assert.deepEqual(audit.unresolvedEntries ?? [], [], 'hard-budget proof cannot contain unresolved exact printings');

  const decklist = String(result.decklist ?? '');
  assert.ok(decklist.trim(), 'budget-compliant result must include a complete decklist');
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'hard-budget deck must still contain exactly 100 cards');
  assert.equal(parsed.commanders.length, 1);
  assert.equal(parsed.commanders[0]?.name, commanderName);

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact budget-deck card/printing must resolve');
  const legality = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(legality.isLegal, true, 'budget constraint never overrides Commander legality');

  const [spellbookBracket, combos, readiness] = await Promise.all([
    estimateCommanderBracket(decklist),
    findDeckCombos(decklist, 100),
    assessCedhReadinessV14(decklist, {}),
  ]);
  assert.notEqual(readiness.status, 'invalid-or-policy-noncompliant');
  const metrics = record(readiness.metrics);
  const comboCounts = record(combos.counts);
  const completeCombos = number(comboCounts.included);
  const ruthlessCombos = Array.isArray(combos.included)
    ? combos.included.map(record).filter((combo) => String(combo.bracketTag ?? '') === 'R').length
    : 0;
  const strategicallyRelevant = Array.isArray(spellbookBracket.strategicallyRelevantCombos)
    ? spellbookBracket.strategicallyRelevantCombos.length
    : 0;
  const winningCombos = number(readiness.winningCombos);
  const gameChangerNames = resolved.cards.filter((card) => card.game_changer === true).map((card) => card.name).sort();

  // This benchmark deliberately starts without independent non-combo/metagame proof.
  // A future evidence layer may raise the supported assessment, but the budget itself never does.
  const ceiling = assessBracketCeilingV15(5, {
    commanderLegal: legality.isLegal,
    exactCardCount: parsed.totalCards === 100,
    fullyResolved: true,
    printingPolicyCompliant: true,
    spellbookTag: typeof spellbookBracket.bracketTag === 'string' ? spellbookBracket.bracketTag : null,
    verifiedWinningCombos: winningCombos,
    ruthlessWinningCombos: ruthlessCombos,
    strategicallyRelevantCombos: strategicallyRelevant,
    averageNonlandManaValue: number(metrics.averageNonlandManaValue, 99),
    earlyPlayCount: number(metrics.earlyPlayCount),
    fastManaCount: number(metrics.fastManaCount),
    freeInteractionCount: number(metrics.freeInteractionCount),
    cheapInteractionCount: number(metrics.cheapInteractionCount),
    tutorCount: number(metrics.tutorCount),
    gameChangerCount: gameChangerNames.length,
    efficientWinConditionEvidence: false,
    optimizedPlanEvidence: readiness.status === 'strong-competitive-construction-signals',
    cedhIntent: true,
    competitiveMetagameEvidence: false,
  }, [`US$${maxDeckUsd} maximum total deck budget`]);

  assert.equal(ceiling.hardGatesPassed, true);
  assert.equal(ceiling.bracket5CertifiedByThisAssessment, false, 'a budget benchmark cannot self-award Bracket 5 without current metagame evidence');

  console.log(`AUDITED EXACT-PRINTING TOTAL: US$${auditedTotal.toFixed(2)} / US$${maxDeckUsd.toFixed(2)}`);
  console.log(`CURRENT GAME CHANGERS (${gameChangerNames.length}): ${gameChangerNames.join(', ') || 'none'}`);
  console.log(`COMPLETE COMBOS: ${completeCombos}`);
  console.log(`WIN-ORIENTED COMBOS: ${winningCombos}`);
  console.log(`RUTHLESS COMBOS: ${ruthlessCombos}`);
  console.log(`STRATEGICALLY RELEVANT COMBOS: ${strategicallyRelevant}`);
  console.log(`READINESS METRICS: ${JSON.stringify(metrics, null, 2)}`);
  console.log(`HONEST ASSESSED BRACKET: ${ceiling.assessedBracket ?? 'unassessable'}`);
  console.log(`ASSESSED BAND: ${ceiling.assessedBand}`);
  console.log(`BRACKET 5 TARGET ACHIEVED: ${ceiling.bracket5CertifiedByThisAssessment}`);
  console.log(`FAILED BRACKET 5 THRESHOLDS: ${JSON.stringify(ceiling.bracket5ThresholdChecks.filter((check) => !check.passed), null, 2)}`);
  console.log(`BUDGET RESTRICTION ANALYSIS: ${JSON.stringify(ceiling.constraintAnalysis, null, 2)}`);
  console.log(`CEILING REASONS: ${JSON.stringify(ceiling.ceilingReasons, null, 2)}`);
  console.log('\nFINAL DECKLIST');
  console.log(decklist.trim());
  console.log(`\nUS$${maxDeckUsd} CONTROL: PASS — exact total is within budget and the power ceiling was reported independently of the requested target.`);
}

main().catch((error) => {
  console.error('US$100 WHOLE-DECK CONTROL: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
