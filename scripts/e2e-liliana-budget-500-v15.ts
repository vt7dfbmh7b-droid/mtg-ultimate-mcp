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
import {
  getUsdNzdRateV13,
  nzdToUsdV13,
  usdToNzdV13,
  withNzdPricingV13,
} from '../src/services/currency-v13.js';
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
  const maxDeckNzd = 500;
  const targetBracket = 5;
  const excludedCards = [
    'Doomsday Excruciator',
    'Shared Trauma',
    'Cryptbreaker',
    'Undead Augur',
    'Dreadmalkin',
    'Hungry Ghoul',
    'Sepulcher Ghoul',
    'Headless Rider',
    'Plague Belcher',
    'Plague of Vermin',
    "Commander's Sphere",
    'Staff of Compleation',
    'Diabolic Tutor',
    'Sword of Forge and Frontier',
    "Champion's Helm",
    'Darksteel Plate',
    'Myr Retriever',
    'Scrap Trawler',
  ];
  const mustInclude = [
    'Warren Soultrader',
    'Gravecrawler',
    'Blood Artist',
    'Entomb',
    'Diabolic Intent',
    'Yawgmoth, Thran Physician',
    'Animate Dead',
    'Cabal Ritual',
    'Jet Medallion',
    'Accursed Marauder',
  ];
  const rate = await getUsdNzdRateV13();
  const maxDeckUsdReference = nzdToUsdV13(maxDeckNzd, rate.rate);

  console.log(`LILIANA NZ$${maxDeckNzd} ZERO-TRIBAL AUDIT CANDIDATE: build the strongest legal Commander deck the current plugin can support under a hard whole-deck cap.`);
  console.log(`FX REFERENCE: 1 USD = ${rate.rate} NZD (${rate.rateDate}, ${rate.source}${rate.stale ? ', stale/fallback' : ''}).`);
  console.log('The NZD budget and Commander rules are hard truths. USD is only the Scryfall/search reference currency. Bracket 5 is an optimization target, not an automatic claim.');
  console.log('CREATURE-TYPE POLICY: no Zombie, Skeleton, or other creature-type theme is an optimization objective; cards must earn slots through actual engine, interaction, mana, tutor, recursion, or win value.');
  console.log(`AUDIT EXCLUSIONS: ${excludedCards.join(', ')}.`);
  console.log(`HIGH-CONFIDENCE ENGINE TEST CARDS: ${mustInclude.join(', ')}.`);

  const commanderResolution = await getCardsByNames([commanderLookupName]);
  assert.deepEqual(commanderResolution.notFound, [], 'Liliana challenge commander must resolve by its front face');
  assert.equal(commanderResolution.cards.length, 1, 'Liliana challenge requires one resolved commander');
  assert.equal(commanderResolution.cards[0]?.name, commanderName, 'front-face lookup must resolve the requested Liliana transform card');

  const result = await buildCommanderDeckUnderWholeBudgetV15(commanderResolution.cards, {
    targetBracket,
    maxDeckUsd: maxDeckUsdReference,
    landCount: 30,
    excludedCards,
    mustInclude,
  });
  const nzdBuild = withNzdPricingV13(result, rate, { maxDeckNzd });

  if (result.status !== 'budget-compliant') {
    writeFileSync('liliana-budget-500-result.json', `${JSON.stringify({
      commanderName,
      maxDeckNzd,
      maxDeckUsdReference,
      targetBracket,
      excludedCards,
      mustInclude,
      currencyPolicy: nzdBuild.currencyPolicy,
      build: nzdBuild,
    }, null, 2)}\n`);
    throw new Error(`Current whole-budget search did not find a fully priced legal Liliana candidate at or below NZ$${maxDeckNzd}.`);
  }

  const audit = record(result.budgetAudit);
  assert.equal(audit.withinBudget, true, 'Liliana challenge must independently audit within the hard converted cap');
  const auditedTotalUsd = number(audit.auditedTotalUsd, Number.POSITIVE_INFINITY);
  const auditedTotalNzd = usdToNzdV13(auditedTotalUsd, rate.rate);
  assert.ok(auditedTotalNzd <= maxDeckNzd, `audited deck total NZ$${auditedTotalNzd} must not exceed NZ$${maxDeckNzd}`);
  assert.deepEqual(audit.unknownPriceEntries ?? [], [], 'hard-budget proof cannot contain unknown prices');
  assert.deepEqual(audit.unresolvedEntries ?? [], [], 'hard-budget proof cannot contain unresolved printings');

  const decklist = String(result.decklist ?? '');
  assert.ok(decklist.trim(), 'budget-compliant result must include a complete decklist');
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'Liliana challenge deck must contain exactly 100 cards');
  assert.equal(parsed.commanders.length, 1, 'Liliana challenge keeps one commander');
  assert.equal(parsed.commanders[0]?.name, commanderName, 'construction must not replace the requested commander');
  const finalNames = new Set([...parsed.commanders, ...parsed.main].map((entry) => entry.name.toLocaleLowerCase()));
  for (const name of mustInclude) assert.equal(finalNames.has(name.toLocaleLowerCase()), true, `high-confidence engine test card must remain present: ${name}`);
  for (const name of excludedCards) assert.equal(finalNames.has(name.toLocaleLowerCase()), false, `audit-excluded weak/tribal package card must remain absent: ${name}`);

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
  }, [
    `NZ$${maxDeckNzd} maximum total deck budget`,
    `fixed commander: ${commanderName}`,
    'no creature-type theme objective',
    `audit exclusions: ${excludedCards.join(', ')}`,
    `required high-confidence engine cards: ${mustInclude.join(', ')}`,
  ]);

  const evidence = {
    commanderLookupName,
    commanderName,
    maxDeckNzd,
    maxDeckUsdReference,
    targetBracket,
    creatureTypePolicy: 'none',
    excludedCards,
    mustInclude,
    auditedTotalNzd,
    auditedTotalUsdReference: auditedTotalUsd,
    currencyPolicy: nzdBuild.currencyPolicy,
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
    build: nzdBuild,
  };
  writeFileSync('liliana-budget-500-result.json', `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync('liliana-budget-500-deck.txt', `${decklist.trim()}\n`);

  console.log(`AUDITED EXACT-PRINTING TOTAL: NZ$${auditedTotalNzd.toFixed(2)} / NZ$${maxDeckNzd.toFixed(2)} (US$${auditedTotalUsd.toFixed(2)} Scryfall reference)`);
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
  assert.ok(number(ceiling.assessedBracket) >= 4, `NZ$${maxDeckNzd} Liliana challenge must reach an independently supported optimized Bracket-4 construction band; got ${String(ceiling.assessedBracket)}`);
  assert.ok(winningCombos > 0, 'the strongest-under-budget challenge requires at least one independently verified win-oriented combo');
  assert.equal(ceiling.bracket5CertifiedByThisAssessment, false, 'this benchmark deliberately has no independent current metagame evidence and must not self-award Bracket 5');

  console.log(`\nLILIANA NZ$${maxDeckNzd} ZERO-TRIBAL AUDIT CANDIDATE: PASS — legal exact-100 list, within hard NZD budget, commander strategy materially supported, verified win route present, and optimized Bracket-4-or-better construction independently supported.`);
}

main().catch((error) => {
  console.error('LILIANA NZ$500 ZERO-TRIBAL AUDIT CANDIDATE: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
