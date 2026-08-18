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
  assert.equal(stages.winPackageDiscoveryAttempted, true, 'winning-package discovery must be attempted before construction');
  assert.equal(stages.hardTruthEvaluationCompleted, true, 'hard truth evaluation must run after construction');
  assert.equal(stages.actualBracketAssessedAfterConstruction, true, 'actual bracket must be assessed after the deck exists');
  assert.equal(stages.targetComparedAfterAssessment, true, 'requested-vs-achieved comparison must happen only after actual assessment');

  const packageDiscovery = record(result.packageDiscovery);
  assert.ok(
    packageDiscovery.status === 'verified-win-packages-found'
      || packageDiscovery.status === 'no-verified-win-package'
      || packageDiscovery.status === 'verification-unavailable',
    'package discovery must distinguish verified package, verified absence, and unavailable verification',
  );
  if (packageDiscovery.status === 'verification-unavailable') {
    assert.notEqual(packageDiscovery.sourceCompleteness, 'complete', 'unavailable verification cannot be reported as a complete search');
  }

  const selectedPackage = record(result.selectedPackage);
  const evaluation = record(result.evaluation);
  const postBuildEvidence = record(evaluation.postBuildEvidence);
  if (Object.keys(selectedPackage).length > 0) {
    assert.equal(stages.winPackageSeeded, true, 'preferred verified package should be seeded before deck construction');
    if (postBuildEvidence.comboVerificationComplete === true) {
      assert.equal(result.seededPackageVerifiedInFinalDeck, true, 'when final combo verification completes, the exact seeded combo ID must survive in the final 100');
    } else {
      assert.equal(result.seededPackageVerifiedInFinalDeck, false, 'an unavailable final combo source must not manufacture seeded-package verification');
    }
  }

  const actualBracket = record(evaluation.actualBracket);
  assert.equal(actualBracket.hardGatesPassed, true, 'final deck must pass legality/count/resolution/printing hard gates');
  assert.equal(evaluation.printingPolicySatisfied, true, 'final exact physical printings must satisfy the FF policy');
  const parsed = record(evaluation.parsed);
  assert.equal(parsed.totalCards, 100, 'final deck must contain exactly 100 Commander cards');
  assert.equal(evaluation.externalEvidenceChecked, true, 'external evidence should only be checked after hard gates pass');

  const targetComparison = record(result.targetComparison);
  assert.equal(targetComparison.requestedBracket, 4, 'target comparison must preserve the requested Bracket 4');
  assert.equal(targetComparison.achievedBracket, 4, 'live control should still honestly assess the finished build as Bracket 4');
  assert.equal(targetComparison.status, 'reached', 'a Bracket 4 result for a Bracket 4 request must be reported as reached');
  const relevantChecks = Array.isArray(targetComparison.relevantChecks) ? targetComparison.relevantChecks.map(record) : [];
  assert.equal(
    relevantChecks.some((check) => /cedh|metagame/i.test(`${String(check.key ?? '')} ${String(check.label ?? '')} ${String(check.detail ?? '')}`)),
    false,
    'Bracket 4 comparison must not leak Bracket 5/cEDH metagame blockers',
  );

  const summary = {
    schema: 'universal-build-pipeline-live-v15.2',
    requestedTargetBracket: result.requestedTargetBracket,
    achievedBracket: result.achievedBracket,
    achievedBand: result.achievedBand,
    bracketConfidence: result.bracketConfidence,
    targetGap: result.targetGap,
    targetComparison,
    packageDiscoveryStatus: packageDiscovery.status,
    packageDiscoveryCompleteness: packageDiscovery.sourceCompleteness,
    selectedPackage: Object.keys(selectedPackage).length > 0 ? selectedPackage : null,
    seededPackageVerifiedInFinalDeck: result.seededPackageVerifiedInFinalDeck,
    stages,
    hardGatesPassed: actualBracket.hardGatesPassed,
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    cardCount: parsed.totalCards,
    externalEvidenceComplete: evaluation.externalEvidenceComplete,
    postBuildEvidence,
    ceilingExplanation: result.ceilingExplanation,
  };
  await writeFile('universal-build-pipeline-live-result.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`ACHIEVED: Bracket ${String(result.achievedBracket)} / ${String(result.achievedBand)}`);
  console.log(`TARGET STATUS: ${String(targetComparison.status)}`);
  console.log(`TARGET GAP: ${String(result.targetGap)}`);
  console.log(`PACKAGE DISCOVERY: ${String(packageDiscovery.status)} / ${String(packageDiscovery.sourceCompleteness)}`);
  console.log(`SEEDED PACKAGE VERIFIED IN FINAL DECK: ${String(result.seededPackageVerifiedInFinalDeck)}`);
  console.log(`EXTERNAL EVIDENCE COMPLETE: ${String(evaluation.externalEvidenceComplete)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('universal-build-pipeline-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
