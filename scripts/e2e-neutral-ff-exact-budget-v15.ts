import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildCommanderThroughPipelineV15 } from '../src/services/commander-build-pipeline-v15.js';
import { getCardsByIdentifiers } from '../src/services/scryfall.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  console.log('NEUTRAL FINAL FANTASY + PER-CARD BUDGET LIVE CONTROL');
  console.log('CASE: Najeela, no bracket target, FINAL FANTASY physical printings only, US$100 hard cap, US$20 optional candidate cap.');
  console.log('PASS CONDITION: both printing restriction and exact finish-aware budget remain hard gates through a legal exact 100-card neutral build.');

  const commanderLookup = await getCardsByIdentifiers([
    { name: 'Najeela, the Blade-Blossom', set: 'FCA', collectorNumber: '42' },
  ]);
  assert.deepEqual(commanderLookup.notFound, [], 'exact FF Najeela control commander must resolve');
  const commander = commanderLookup.cards[0];
  assert.ok(commander, 'Najeela commander must resolve');

  const result = await buildCommanderThroughPipelineV15([commander], {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxUsdPerCard: 100,
    candidateMaxUsdPerCard: 20,
    winPackageMode: 'forbid',
  });

  assert.equal(result.status, 'complete-evaluated-build', `FF budgeted neutral pipeline must complete; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, null, 'FF budget composition must not invent a bracket target');
  const plan = record(result.plan);
  assert.equal(plan.lane, 'neutral-themed', 'no-target FF budget build must remain neutral');
  assert.deepEqual(plan.unsupportedConstraints, [], 'FF + exact budget must be a supported neutral composition');

  const built = record(result.built);
  assert.equal(built.status, 'complete-neutral-draft', 'FF budgeted neutral builder must produce a complete draft');
  assert.equal(built.cardCount, 100, 'builder must emit exactly 100 cards');
  assert.equal(built.printingPolicySatisfied, true, 'every emitted exact printing must satisfy the Final Fantasy family');
  assert.equal(built.candidateBudgetSatisfied, true, 'optional FF candidates must satisfy the effective candidate cap');
  const constraints = record(built.constraints);
  assert.equal(constraints.printingFamily, 'Final Fantasy', 'FF family restriction must survive construction');
  assert.equal(constraints.maxUsdPerCard, 100, 'user hard cap must survive construction');
  assert.equal(constraints.candidateMaxUsdPerCard, 20, 'candidate cap must survive construction');
  assert.equal(constraints.effectiveCandidateMaxUsdPerCard, 20, 'effective candidate cap must be the tighter US$20 cap');

  const provenance = record(built.candidatePoolProvenance);
  assert.equal(provenance.mode, 'exhaustive-bounded-printing-policy', 'FF family build must use the bounded restricted-pool lane');
  assert.equal(provenance.rankingUsesPopularity, false, 'restricted budget composition must not score by popularity');
  assert.equal(provenance.budgetCapUsd, 20, 'restricted-pool provenance must report the effective candidate cap');

  const evaluation = record(result.evaluation);
  assert.equal(evaluation.hardGatesPassed, true, 'post-build hard gates must include FF printing policy and user budget');
  assert.equal(evaluation.printingPolicySatisfied, true, 'independent evaluator must reconfirm Final Fantasy physical printings');
  const parsed = record(evaluation.parsed);
  assert.equal(parsed.totalCards, 100, 'independent post-build parser must confirm exact 100');
  const budget = record(evaluation.perCardBudgetAudit);
  assert.equal(budget.status, 'compliant', 'independent exact budget audit must pass');
  assert.equal(budget.satisfied, true, 'user hard per-card budget must pass independently');
  assert.deepEqual(budget.overCapEntries, [], 'no exact FF printing may exceed US$100');
  assert.deepEqual(budget.unknownPriceEntries, [], 'unknown FF prices may not silently satisfy the cap');
  assert.deepEqual(budget.unavailableFinishEntries, [], 'unavailable finishes may not satisfy the FF budget');
  assert.deepEqual(budget.unresolvedEntries, [], 'every final FF exact printing must resolve');

  const summary = {
    schema: 'neutral-ff-exact-budget-live-v15.1',
    requestedTargetBracket: result.requestedTargetBracket,
    achievedBracket: result.achievedBracket,
    achievedBand: result.achievedBand,
    printingFamily: constraints.printingFamily,
    hardCapUsd: constraints.maxUsdPerCard,
    effectiveCandidateCapUsd: constraints.effectiveCandidateMaxUsdPerCard,
    candidatePoolProvenance: provenance,
    postBuildBudgetAudit: budget,
    hardGatesPassed: evaluation.hardGatesPassed,
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    cardCount: parsed.totalCards,
    externalEvidenceComplete: evaluation.externalEvidenceComplete,
  };
  await writeFile('neutral-ff-exact-budget-live-result.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`ACHIEVED: Bracket ${String(result.achievedBracket)} / ${String(result.achievedBand)}`);
  console.log(`FF PRINTING POLICY: ${String(evaluation.printingPolicySatisfied)}`);
  console.log(`HARD CAP: US$${String(constraints.maxUsdPerCard)}; OPTIONAL CAP: US$${String(constraints.effectiveCandidateMaxUsdPerCard)}`);
  console.log(`POST-BUILD BUDGET: ${String(budget.status)}`);
  console.log(`EXTERNAL EVIDENCE COMPLETE: ${String(evaluation.externalEvidenceComplete)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('neutral-ff-exact-budget-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
