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
import { getUsdNzdRateV13, nzdToUsdV13, usdToNzdV13, withNzdPricingV13 } from '../src/services/currency-v13.js';
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
    'Doomsday Excruciator', 'Shared Trauma', 'Cryptbreaker', 'Undead Augur', 'Dreadmalkin',
    'Hungry Ghoul', 'Sepulcher Ghoul', 'Headless Rider', 'Plague Belcher', 'Plague of Vermin',
    "Commander's Sphere", 'Staff of Compleation', 'Diabolic Tutor', 'Sword of Forge and Frontier',
    "Champion's Helm", 'Darksteel Plate', 'Myr Retriever', 'Scrap Trawler',
  ];
  const mustInclude = [
    'Warren Soultrader', 'Gravecrawler', 'Blood Artist', 'Entomb', 'Diabolic Intent',
    'Yawgmoth, Thran Physician', 'Animate Dead', 'Cabal Ritual', 'Jet Medallion', 'Accursed Marauder',
  ];

  const rate = await getUsdNzdRateV13();
  const maxDeckUsdReference = nzdToUsdV13(maxDeckNzd, rate.rate);
  console.log(`LILIANA NZ$${maxDeckNzd} ZERO-TRIBAL AUDIT CANDIDATE`);
  console.log(`FX REFERENCE: 1 USD = ${rate.rate} NZD (${rate.rateDate}, ${rate.source}).`);
  console.log('CREATURE-TYPE POLICY: disabled. Creature type cannot contribute candidate quality, cut protection, or material-improvement credit.');

  const commanderResolution = await getCardsByNames([commanderLookupName]);
  assert.deepEqual(commanderResolution.notFound, []);
  assert.equal(commanderResolution.cards.length, 1);
  assert.equal(commanderResolution.cards[0]?.name, commanderName);

  const result = await buildCommanderDeckUnderWholeBudgetV15(commanderResolution.cards, {
    targetBracket,
    maxDeckUsd: maxDeckUsdReference,
    landCount: 30,
    excludedCards,
    mustInclude,
    creatureTypeOptimization: false,
  });
  const nzdBuild = withNzdPricingV13(result, rate, { maxDeckNzd });
  const decklist = String(result.decklist ?? '').trim();

  const writeFailureEvidence = (): void => {
    writeFileSync('liliana-budget-500-result.json', `${JSON.stringify({
      commanderName,
      maxDeckNzd,
      maxDeckUsdReference,
      targetBracket,
      creatureTypePolicy: 'none',
      excludedCards,
      mustInclude,
      currencyPolicy: nzdBuild.currencyPolicy,
      build: nzdBuild,
    }, null, 2)}\n`);
    if (decklist) writeFileSync('liliana-budget-500-deck.txt', `${decklist}\n`);
  };

  if (result.status !== 'budget-compliant' || !decklist) {
    writeFailureEvidence();
    throw new Error(`Current whole-budget search did not produce a complete budget-compliant Liliana candidate at or below NZ$${maxDeckNzd}.`);
  }

  assert.equal(result.creatureTypeOptimization, false, 'zero-tribal benchmark must disable creature-type refinement');
  const audit = record(result.budgetAudit);
  assert.equal(audit.withinBudget, true);
  assert.deepEqual(audit.unknownPriceEntries ?? [], []);
  assert.deepEqual(audit.unresolvedEntries ?? [], []);
  const auditedTotalUsd = number(audit.auditedTotalUsd, Number.POSITIVE_INFINITY);
  const auditedTotalNzd = usdToNzdV13(auditedTotalUsd, rate.rate);
  assert.ok(auditedTotalNzd <= maxDeckNzd);

  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100);
  assert.equal(parsed.commanders.length, 1);
  assert.equal(parsed.commanders[0]?.name, commanderName);
  const finalNames = new Set([...parsed.commanders, ...parsed.main].map((entry) => entry.name.toLocaleLowerCase()));
  for (const name of mustInclude) {
    assert.equal(finalNames.has(name.toLocaleLowerCase()), true, `required high-confidence engine card missing: ${name}`);
  }
  for (const name of excludedCards) {
    assert.equal(finalNames.has(name.toLocaleLowerCase()), false, `explicitly excluded card reintroduced: ${name}`);
  }

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, []);
  const legality = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(legality.isLegal, true);

  const strategyContext = deriveCommanderStrategyContextV15(parsed, resolved.cards);
  assert.ok(strategyContext.strategies.some((strategy) => strategy.score >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15));
  const strategySupport = measureUpgradeDeckStrategySupportV15(parsed, resolved.cards, strategyContext);
  assert.equal(strategySupport.evidenceComplete, true);
  assert.ok(strategySupport.strategies.some((strategy) => strategy.supportCount >= 6 && strategy.affinityTotal >= 72));

  const [spellbookBracket, combos, readiness] = await Promise.all([
    estimateCommanderBracket(decklist),
    findDeckCombos(decklist, 100),
    assessCedhReadinessV14(decklist, { creatureTypeOptimization: false }),
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
    'creature-type optimization disabled',
    `explicit exclusions: ${excludedCards.join(', ')}`,
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
    comboSummary: { completeCombos, winningCombos, ruthlessCombos, strategicallyRelevant },
    readiness,
    gameChangerNames,
    ceiling,
    build: nzdBuild,
  };
  writeFileSync('liliana-budget-500-result.json', `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync('liliana-budget-500-deck.txt', `${decklist}\n`);

  console.log(`AUDITED EXACT-PRINTING TOTAL: NZ$${auditedTotalNzd.toFixed(2)} / NZ$${maxDeckNzd.toFixed(2)}`);
  console.log(`COMPLETE COMBOS: ${completeCombos}; WIN-ORIENTED: ${winningCombos}; RUTHLESS: ${ruthlessCombos}`);
  console.log(`READINESS: ${String(readiness.status)}`);
  console.log(`METRICS: ${JSON.stringify(metrics)}`);
  console.log(`HONEST ASSESSED BRACKET: ${String(ceiling.assessedBracket ?? 'unassessable')} (${String(ceiling.assessedBand)})`);
  console.log('\nFINAL DECKLIST');
  console.log(decklist);

  assert.equal(ceiling.hardGatesPassed, true);
  assert.ok(number(ceiling.assessedBracket) >= 4);
  assert.ok(winningCombos > 0);
  assert.equal(ceiling.bracket5CertifiedByThisAssessment, false);
  console.log(`\nLILIANA NZ$${maxDeckNzd} ZERO-TRIBAL AUDIT CANDIDATE: PASS`);
}

main().catch((error) => {
  console.error('LILIANA NZ$500 ZERO-TRIBAL AUDIT CANDIDATE: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
