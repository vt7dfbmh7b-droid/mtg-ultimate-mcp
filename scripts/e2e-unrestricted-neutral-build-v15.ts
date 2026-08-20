import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildCommanderThroughPipelineV15 } from '../src/services/commander-build-pipeline-v15.js';
import { getCardsByIdentifiers } from '../src/services/scryfall.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  console.log('UNRESTRICTED NEUTRAL COMMANDER BUILD LIVE CONTROL');
  console.log('CASE: Najeela exact commander input, no bracket target, no printing-family/set restriction, no seeded win package.');
  console.log('PASS CONDITION: use the neutral strategy-first lane, build a legal exact 100 from an auditable non-popularity sample, then assess bracket only afterward.');

  const commanderLookup = await getCardsByIdentifiers([
    { name: 'Najeela, the Blade-Blossom', set: 'FCA', collectorNumber: '42' },
  ]);
  assert.deepEqual(commanderLookup.notFound, [], 'exact Najeela commander printing must resolve');
  const commander = commanderLookup.cards[0];
  assert.ok(commander, 'Najeela commander must resolve');

  const result = await buildCommanderThroughPipelineV15([commander], {
    winPackageMode: 'forbid',
  });

  assert.equal(result.status, 'complete-evaluated-build', `pipeline must complete and pass hard gates; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, null, 'unrestricted neutral construction must not invent a bracket target');
  assert.equal(result.targetComparison, null, 'no requested target means there must be no requested-vs-achieved comparison');
  assert.equal(result.targetGap, null, 'no requested target means there must be no target gap');
  assert.equal(result.selectedPackage, null, 'win-package mode forbid must not seed a package');
  assert.equal(result.seededPackageVerifiedInFinalDeck, false, 'no package was seeded, so none may be claimed as preserved');

  const plan = record(result.plan);
  assert.equal(plan.lane, 'neutral-themed', 'no-target construction must use the neutral lane');
  assert.equal(plan.requestedTargetBracket, null, 'the plan must retain targetBracket=null');
  assert.equal(plan.archetype, 'combat-tokens', 'Najeela semantics should infer the combat-tokens neutral archetype');
  assert.deepEqual(plan.unsupportedConstraints, [], 'unrestricted no-target construction should have no unsupported constraints');

  const stages = record(result.stages);
  assert.equal(stages.winPackageDiscoveryAttempted, false, 'this control isolates neutral construction from package seeding');
  assert.equal(stages.winPackageSeeded, false, 'this control must not seed a winning package');
  assert.equal(stages.deckConstructed, true, 'the deck must be constructed before assessment');
  assert.equal(stages.hardTruthEvaluationCompleted, true, 'hard truth evaluation must run after construction');
  assert.equal(stages.actualBracketAssessedAfterConstruction, true, 'actual bracket must be assessed only after the deck exists');
  assert.equal(stages.targetComparedAfterAssessment, false, 'no target comparison may run when no bracket was requested');

  const built = record(result.built);
  assert.equal(built.status, 'complete-neutral-draft', 'neutral builder must produce a complete draft');
  assert.equal(built.constructionIntent, 'neutral', 'construction intent must remain neutral');
  assert.equal(built.targetBracket, null, 'neutral builder must neither accept nor infer a target bracket');
  assert.equal(built.cardCount, 100, 'neutral builder must emit exactly 100 Commander cards');
  assert.equal(built.printingPolicySatisfied, true, 'all emitted cards must have valid eligible physical printings');

  const provenance = record(built.candidatePoolProvenance);
  assert.equal(provenance.mode, 'bounded-stratified-neutral-sample', 'unrestricted neutral construction must use the dedicated sampled pool');
  assert.equal(provenance.popularityOrdered, false, 'candidate discovery must not be popularity ordered');
  assert.equal(provenance.edhrecOrdered, false, 'candidate discovery must not be EDHREC ordered');
  assert.ok(Number(provenance.uniqueEligibleNonlands) >= 80, 'sample must retain at least 80 eligible nonlands');
  assert.ok(Number(provenance.uniqueEligibleLands) >= 20, 'sample must retain at least 20 eligible lands');
  assert.ok(Array.isArray(provenance.strata) && provenance.strata.length > 0, 'sample provenance must expose its strata audit');

  const constraints = record(built.constraints);
  assert.equal(constraints.printingFamily, null, 'this control must not silently apply a printing family');
  assert.deepEqual(constraints.allowedSets, [], 'this control must not silently apply allowed-set restrictions');
  const explanation = Array.isArray(built.constructionExplanation) ? built.constructionExplanation.map(String).join(' ') : '';
  assert.match(explanation, /No bracket target is accepted or inferred/i, 'construction explanation must explicitly state target neutrality');
  assert.match(explanation, /does not award EDHREC popularity/i, 'construction explanation must explicitly state that EDHREC popularity is not a scoring signal');

  const evaluation = record(result.evaluation);
  const actualBracket = record(evaluation.actualBracket);
  const parsed = record(evaluation.parsed);
  assert.equal(actualBracket.hardGatesPassed, true, 'final deck must pass legality/count/resolution/printing hard gates');
  assert.equal(parsed.totalCards, 100, 'independent post-build parsing must confirm exactly 100 cards');
  assert.equal(evaluation.printingPolicySatisfied, true, 'independent post-build evaluation must confirm exact physical printings');
  assert.equal(evaluation.externalEvidenceChecked, true, 'external evidence may be checked only after the hard gates pass');
  assert.ok(Number.isInteger(result.achievedBracket) && Number(result.achievedBracket) >= 1 && Number(result.achievedBracket) <= 5, 'post-build assessment must report an actual bracket in range 1-5');
  assert.equal(result.achievedBracket, actualBracket.assessedBracket, 'reported achieved bracket must come from the post-build assessment');

  const summary = {
    schema: 'unrestricted-neutral-build-live-v15.1',
    requestedTargetBracket: result.requestedTargetBracket,
    achievedBracket: result.achievedBracket,
    achievedBand: result.achievedBand,
    bracketConfidence: result.bracketConfidence,
    plan,
    stages,
    candidatePoolProvenance: provenance,
    hardGatesPassed: actualBracket.hardGatesPassed,
    cardCount: parsed.totalCards,
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    externalEvidenceComplete: evaluation.externalEvidenceComplete,
    postBuildEvidence: evaluation.postBuildEvidence,
  };
  await writeFile('unrestricted-neutral-build-live-result.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`ACHIEVED: Bracket ${String(result.achievedBracket)} / ${String(result.achievedBand)}`);
  console.log(`CANDIDATE POOL: ${String(provenance.mode)}; nonlands=${String(provenance.uniqueEligibleNonlands)} lands=${String(provenance.uniqueEligibleLands)}`);
  console.log(`POPULARITY ORDERED: ${String(provenance.popularityOrdered)}`);
  console.log(`EDHREC ORDERED: ${String(provenance.edhrecOrdered)}`);
  console.log(`EXTERNAL EVIDENCE COMPLETE: ${String(evaluation.externalEvidenceComplete)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('unrestricted-neutral-build-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
