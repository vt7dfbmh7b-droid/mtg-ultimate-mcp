import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { assessBracketCeilingV15 } from '../src/services/bracket-ceiling-v15.js';
import { assessCedhReadinessV14 } from '../src/services/cedh-workflow-v14.js';
import {
  deriveCommanderStrategyContextV15,
  measureUpgradeDeckStrategySupportV15,
  SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15,
} from '../src/services/commander-strategy-affinity-v15.js';
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
  const commanderLookupName = 'Liliana, Heretical Healer';
  const commanderName = 'Liliana, Heretical Healer // Liliana, Defiant Necromancer';
  const maxDeckUsd = 500;
  const targetBracket = 5;

  console.log(`LILIANA US$${maxDeckUsd} CHALLENGE: build the strongest legal unrestricted Commander deck the current plugin can support under a hard whole-deck cap.`);
  console.log('The budget and Commander rules are hard truths. Bracket 5 is an optimization target, not an automatic claim.');

  const commanderResolution = await getCardsByNames([commanderLookupName]);
  assert.deepEqual(commanderResolution.notFound, [], 'Liliana challenge commander must resolve by its front face');
  assert.equal(commanderResolution.cards.length, 1, 'Liliana challenge requires one resolved commander');
  assert.equal(commanderResolution.cards[0]?.name, commanderName, 'front-face lookup must resolve the requested Liliana transform card');

  const result = await buildCommanderDeckUnderWholeBudgetV15(commanderResolution.cards, {
    targetBracket,
    maxDeckUsd,
    landCount: 30,
  });

  if (result.status !== 'budget-compliant') {
    writeFileSync('liliana-budget-500-result.json', `${JSON.stringify({ commanderName, maxDeckUsd, targetBracket, result }, null, 2)}\n`);
    throw new Error(`Current whole-budget search did not find a fully priced legal Liliana candidate at or below US$${maxDeckUsd}.`);
  }

  const audit = record(result.budgetAudit);
  assert.equal(audit.withinBudget, true, 'Liliana challenge must independently audit within the hard cap');
  const auditedTotal = number(audit.auditedTotalUsd, Number.POSITIVE_INFINITY);
  assert.ok(auditedTotal <= maxDeckUsd, `audited deck total US$${auditedTotal} must not exceed US$${maxDeckUsd}`);
  assert.deepEqual(audit.unknownPriceEntries ?? [], [], 'hard-budget proof cannot contain unknown prices');
  assert.deepEqual(audit.unresolvedEntries ?? [], [], 'hard-budget proof cannot contain unresolved printings');

  const decklist = String(result.decklist ?? '');
  assert.ok(decklist.trim(), 'budget-compliant result must include a complete decklist');
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'Liliana challenge deck must contain exactly 100 cards');
  assert.equal(parsed.commanders.length, 1, 'Liliana challenge keeps one commander');
  assert.equal(parsed.commanders[0]?.name, commanderName, 'construction must not replace the requested commander');

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact Liliana challenge card/printing must resolve');
  const legality = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(legality.isLegal, true, 'budget or power targets never override Commander legality');

  const strategyContext = deriveCommanderStrategyContextV15(parsed, resolved.cards);
  const substantiveStrategies = strategyContext.strategies.filter((strategy) => strategy.score >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15);
  assert.ok(substantiveStrategies.length > 0, 'the plugin must infer at least one substantive strategy from Liliana');
  const strategySupport = measureUpgradeDeckStrategySupportV15(parsed, resolved.cards, strategyContext);
  assert.equal(strategySupport.evidenceComplete, true, 'strategy support audit must resolve every card');
  const supportedSubstantive = strategySupport.strategies.filter((strategy) => strategy.supportCount >= 6 && strategy.affinityTotal >= 72);
  assert.ok(supportedSubstantive.length > 0, 'the finished 99 must materially support at least one substantive Liliana strategy');

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

  const ceiling = assessBracketCeilingV15(targetBracket, {
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
  }, [`US$${maxDeckUsd} maximum total deck budget`, `fixed commander: ${commanderName}`]);

  // Preserve and print the complete candidate before quality assertions so a failed benchmark
  // remains auditable instead of discarding the exact list and the reasons it missed the target.
  const evidence = {
    commanderLookupName,
    commanderName,
    maxDeckUsd,
    targetBracket,
    auditedTotalUsd: auditedTotal,
    legality,
    strategyContext,
    strategySupport,
    spellbookBracket,
    comboSummary: {
      completeCombos,
      winningCombos,
      ruthlessCombos,
      strategicallyRelevant,
    },
    readiness,
    gameChangerNames,
    ceiling,
    build: result,
  };
  writeFileSync('liliana-budget-500-result.json', `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync('liliana-budget-500-deck.txt', `${decklist.trim()}\n`);

  console.log(`AUDITED EXACT-PRINTING TOTAL: US$${auditedTotal.toFixed(2)} / US$${maxDeckUsd.toFixed(2)}`);
  console.log(`SUBSTANTIVE COMMANDER STRATEGIES: ${JSON.stringify(strategyContext.strategies, null, 2)}`);
  console.log(`WHOLE-DECK STRATEGY SUPPORT: ${JSON.stringify(strategySupport.strategies, null, 2)}`);
  console.log(`COMPLETE COMBOS: ${completeCombos}`);
  console.log(`WIN-ORIENTED COMBOS: ${winningCombos}`);
  console.log(`RUTHLESS COMBOS: ${ruthlessCombos}`);
  console.log(`STRATEGICALLY RELEVANT COMBOS: ${strategicallyRelevant}`);
  console.log(`READINESS STATUS: ${readiness.status}`);
  console.log(`READINESS METRICS: ${JSON.stringify(metrics, null, 2)}`);
  console.log(`GAME CHANGERS (${gameChangerNames.length}): ${gameChangerNames.join(', ') || 'none'}`);
  console.log(`HONEST ASSESSED BRACKET: ${ceiling.assessedBracket ?? 'unassessable'}`);
  console.log(`ASSESSED BAND: ${ceiling.assessedBand}`);
  console.log(`BRACKET-5 CONSTRUCTION CANDIDATE: ${ceiling.bracket5ConstructionCandidate}`);
  console.log(`FAILED BRACKET-5 THRESHOLDS: ${JSON.stringify(ceiling.bracket5ThresholdChecks.filter((check) => !check.passed), null, 2)}`);
  console.log('\nFINAL DECKLIST');
  console.log(decklist.trim());

  assert.equal(ceiling.hardGatesPassed, true);
  assert.ok(number(ceiling.assessedBracket) >= 4, `US$${maxDeckUsd} Liliana challenge must reach an independently supported optimized Bracket-4 construction band; got ${String(ceiling.assessedBracket)}`);
  assert.ok(winningCombos > 0, 'the strongest-under-budget challenge requires at least one independently verified win-oriented combo');
  assert.equal(ceiling.bracket5CertifiedByThisAssessment, false, 'this benchmark deliberately has no independent current metagame evidence and must not self-award Bracket 5');

  console.log(`\nLILIANA US$${maxDeckUsd} CHALLENGE: PASS — legal exact-100 list, within hard budget, commander strategy materially supported, verified win route present, and optimized Bracket-4-or-better construction independently supported.`);
}

main().catch((error) => {
  console.error('LILIANA US$500 CHALLENGE: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
