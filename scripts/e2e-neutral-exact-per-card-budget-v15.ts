import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildCommanderThroughPipelineV15 } from '../src/services/commander-build-pipeline-v15.js';
import { getCardsByIdentifiers } from '../src/services/scryfall.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  console.log('NEUTRAL EXACT PER-CARD BUDGET LIVE CONTROL');
  console.log('CASE: Najeela exact commander input, no bracket target, unrestricted physical printings, US$20 hard cap, US$5 optional candidate cap.');
  console.log('PASS CONDITION: legal exact 100, no hidden bracket target, exact finish-aware budget evidence for every final card, independent post-build budget audit, and no EDHREC construction bias.');

  const commanderLookup = await getCardsByIdentifiers([
    { name: 'Najeela, the Blade-Blossom', set: 'FCA', collectorNumber: '42' },
  ]);
  assert.deepEqual(commanderLookup.notFound, [], 'exact Najeela control commander must resolve');
  const commander = commanderLookup.cards[0];
  assert.ok(commander, 'Najeela commander must resolve');

  const result = await buildCommanderThroughPipelineV15([commander], {
    maxUsdPerCard: 20,
    candidateMaxUsdPerCard: 5,
    winPackageMode: 'forbid',
  });

  assert.equal(result.status, 'complete-evaluated-build', `budgeted neutral pipeline must complete; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, null, 'budget request must not invent a bracket target');
  assert.equal(result.targetComparison, null, 'no bracket target means no target comparison');
  const plan = record(result.plan);
  assert.equal(plan.lane, 'neutral-themed', 'budgeted no-target construction must remain neutral');
  assert.deepEqual(plan.unsupportedConstraints, [], 'neutral per-card budget must be a supported constraint');

  const built = record(result.built);
  assert.equal(built.status, 'complete-neutral-draft', 'neutral builder must complete under the cap');
  assert.equal(built.cardCount, 100, 'builder must emit exactly 100 cards');
  assert.equal(built.printingPolicySatisfied, true, 'all exact physical printings must remain eligible');
  assert.equal(built.candidateBudgetSatisfied, true, 'optional candidates and lands must satisfy the effective candidate cap');
  const constraints = record(built.constraints);
  assert.equal(constraints.maxUsdPerCard, 20, 'user hard cap must be preserved exactly');
  assert.equal(constraints.candidateMaxUsdPerCard, 5, 'candidate-only cap must be preserved exactly');
  assert.equal(constraints.effectiveCandidateMaxUsdPerCard, 5, 'candidate cap may tighten but never loosen the user cap');

  const provenance = record(built.candidatePoolProvenance);
  assert.equal(provenance.mode, 'bounded-stratified-neutral-sample', 'unrestricted budgeted build must still use neutral sampled discovery');
  assert.equal(provenance.popularityOrdered, false, 'budget filtering must not reintroduce popularity ordering');
  assert.equal(provenance.edhrecOrdered, false, 'budget filtering must not reintroduce EDHREC ordering');
  assert.equal(provenance.budgetCapUsd, 5, 'candidate pool provenance must expose the effective search cap');
  assert.equal(provenance.budgetFilterMode, 'exact-sampled-printing', 'candidate budget evidence must come from exact sampled printings');

  const builderBudget = record(built.perCardBudgetAudit);
  assert.equal(builderBudget.status, 'compliant', 'builder-side exact budget audit must pass');
  assert.equal(builderBudget.satisfied, true, 'builder-side hard budget gate must pass');
  assert.deepEqual(builderBudget.overCapEntries, [], 'builder must emit no over-cap exact printing');
  assert.deepEqual(builderBudget.unknownPriceEntries, [], 'missing price evidence may not pass as zero dollars');
  assert.deepEqual(builderBudget.unavailableFinishEntries, [], 'unavailable finishes may not satisfy the budget');
  assert.deepEqual(builderBudget.unresolvedEntries, [], 'budget audit must resolve every exact printing');

  const evaluation = record(result.evaluation);
  assert.equal(evaluation.hardGatesPassed, true, 'independent post-build hard gates must include the user budget');
  assert.equal(evaluation.externalEvidenceChecked, true, 'external evidence may run only after budget/legal/printing hard gates pass');
  const parsed = record(evaluation.parsed);
  assert.equal(parsed.totalCards, 100, 'post-build parser must independently confirm exact 100');
  const finalBudget = record(evaluation.perCardBudgetAudit);
  assert.equal(finalBudget.status, 'compliant', 'independent post-build exact budget audit must pass');
  assert.equal(finalBudget.satisfied, true, 'independent budget gate must pass');
  const auditedEntries = Array.isArray(finalBudget.auditedEntries) ? finalBudget.auditedEntries.map(record) : [];
  assert.ok(auditedEntries.length > 0, 'final budget audit must expose exact entry evidence');
  assert.ok(auditedEntries.every((entry) => Number(entry.priceUsd) <= 20), 'every audited exact printing must be at or below the US$20 hard cap');
  assert.ok(auditedEntries.every((entry) => ['nonfoil', 'foil', 'etched'].includes(String(entry.finish))), 'every budgeted final entry must identify the physical finish used as price evidence');

  const decklist = String(built.decklist ?? '');
  assert.match(decklist, /\*(?:N|F|E)\*/i, 'budgeted decklist must carry physical finish markers');

  const summary = {
    schema: 'neutral-exact-per-card-budget-live-v15.1',
    requestedTargetBracket: result.requestedTargetBracket,
    achievedBracket: result.achievedBracket,
    achievedBand: result.achievedBand,
    hardCapUsd: constraints.maxUsdPerCard,
    candidateCapUsd: constraints.candidateMaxUsdPerCard,
    effectiveCandidateCapUsd: constraints.effectiveCandidateMaxUsdPerCard,
    candidatePoolProvenance: provenance,
    builderBudgetAudit: builderBudget,
    postBuildBudgetAudit: finalBudget,
    hardGatesPassed: evaluation.hardGatesPassed,
    cardCount: parsed.totalCards,
    externalEvidenceComplete: evaluation.externalEvidenceComplete,
  };
  await writeFile('neutral-exact-per-card-budget-live-result.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`ACHIEVED: Bracket ${String(result.achievedBracket)} / ${String(result.achievedBand)}`);
  console.log(`HARD CAP: US$${String(constraints.maxUsdPerCard)}; OPTIONAL CAP: US$${String(constraints.effectiveCandidateMaxUsdPerCard)}`);
  console.log(`CANDIDATE POOL: ${String(provenance.mode)}; budgetMode=${String(provenance.budgetFilterMode)}`);
  console.log(`POST-BUILD BUDGET: ${String(finalBudget.status)}`);
  console.log(`EXTERNAL EVIDENCE COMPLETE: ${String(evaluation.externalEvidenceComplete)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('neutral-exact-per-card-budget-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
