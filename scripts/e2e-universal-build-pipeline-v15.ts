import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildCommanderThroughPipelineV15 } from '../src/services/commander-build-pipeline-v15.js';
import { getCardsByIdentifiers } from '../src/services/scryfall.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  console.log('UNIVERSAL COMMANDER BUILD PIPELINE LIVE CONTROL');
  console.log('CASE: Najeela, Final Fantasy physical printings only, requested Bracket 4, verified win packages preferred.');
  console.log('PASS CONDITION: preserve constraints and ordering, construct a legal exact 100, then report actual achieved bracket honestly.');

  const commanderLookup = await getCardsByIdentifiers([
    { name: 'Najeela, the Blade-Blossom', set: 'FCA', collectorNumber: '42' },
  ]);
  assert.deepEqual(commanderLookup.notFound, [], 'exact FF Najeela commander printing must resolve');
  const commander = commanderLookup.cards[0];
  assert.ok(commander, 'Najeela commander must resolve');

  const result = await buildCommanderThroughPipelineV15([commander], {
    targetBracket: 4,
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    winPackageMode: 'prefer',
    maxWinPackageCards: 3,
  });

  assert.equal(result.status, 'complete-evaluated-build', `pipeline must complete and pass hard gates; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, 4, 'requested target must remain explicit and unchanged');
  const plan = record(result.plan);
  assert.equal(plan.lane, 'targeted-v07', 'an explicit target must use the targeted construction lane');
  const stages = record(result.stages);
  assert.equal(stages.winPackagesDiscovered, true, 'winning packages must be deliberately discovered before construction');
  assert.equal(stages.hardTruthEvaluationCompleted, true, 'hard truth evaluation must run after construction');
  assert.equal(stages.actualBracketAssessedAfterConstruction, true, 'actual bracket must be assessed after the deck exists');

  const packageDiscovery = record(result.packageDiscovery);
  assert.ok(
    packageDiscovery.status === 'verified-win-packages-found' || packageDiscovery.status === 'no-verified-win-package',
    'package discovery must return an explicit verified/no-package outcome',
  );
  const selectedPackage = record(result.selectedPackage);
  if (Object.keys(selectedPackage).length > 0) {
    assert.equal(stages.winPackageSeeded, true, 'preferred verified package should be seeded before deck construction');
    assert.equal(result.seededPackageVerifiedInFinalDeck, true, 'a seeded package must reproduce as a verified winning combo in the final 100');
  }

  const evaluation = record(result.evaluation);
  const actualBracket = record(evaluation.actualBracket);
  assert.equal(actualBracket.hardGatesPassed, true, 'final deck must pass legality/count/resolution/printing hard gates');
  assert.equal(evaluation.printingPolicySatisfied, true, 'final exact physical printings must satisfy the FF policy');
  const parsed = record(evaluation.parsed);
  assert.equal(parsed.totalCards, 100, 'final deck must contain exactly 100 Commander cards');
  assert.equal(evaluation.externalEvidenceChecked, true, 'Spellbook evidence should only be checked after hard gates pass');

  const summary = {
    schema: 'universal-build-pipeline-live-v15.1',
    requestedTargetBracket: result.requestedTargetBracket,
    achievedBracket: result.achievedBracket,
    achievedBand: result.achievedBand,
    bracketConfidence: result.bracketConfidence,
    targetGap: result.targetGap,
    selectedPackage: Object.keys(selectedPackage).length > 0 ? selectedPackage : null,
    seededPackageVerifiedInFinalDeck: result.seededPackageVerifiedInFinalDeck,
    stages,
    hardGatesPassed: actualBracket.hardGatesPassed,
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    cardCount: parsed.totalCards,
    postBuildEvidence: evaluation.postBuildEvidence,
    ceilingExplanation: result.ceilingExplanation,
  };
  await writeFile('universal-build-pipeline-live-result.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`ACHIEVED: Bracket ${String(result.achievedBracket)} / ${String(result.achievedBand)}`);
  console.log(`TARGET GAP: ${String(result.targetGap)}`);
  console.log(`PACKAGE FOUND: ${String(packageDiscovery.status)}`);
  console.log(`SEEDED PACKAGE VERIFIED IN FINAL DECK: ${String(result.seededPackageVerifiedInFinalDeck)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('universal-build-pipeline-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
