import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildCommanderThroughPipelineV15 } from '../src/services/commander-build-pipeline-v15.js';
import { getCardsByIdentifiers } from '../src/services/scryfall.js';
import type { ScryfallCard } from '../src/types/scryfall.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function validateWarriorTheme(commander: ScryfallCard): Promise<Record<string, unknown>> {
  console.log('\nCASE 1: exact Najeela commander, no bracket target, Warrior typal free-form theme, no seeded win package.');
  console.log('PASS CONDITION: normalize safely, generate a bounded non-popularity supplement, produce an exact legal 100, independently audit at least 20 Warrior-theme main-deck cards, then assess bracket only afterward.');

  const result = await buildCommanderThroughPipelineV15([commander], {
    themeQuery: 'Warrior typal',
    winPackageMode: 'forbid',
  });

  assert.equal(result.status, 'complete-evaluated-build', `Warrior-themed pipeline must complete and pass every hard/theme gate; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, null, 'theme construction must not invent a bracket target');
  assert.equal(result.targetComparison, null, 'no requested target means there must be no requested-vs-achieved comparison');
  assert.equal(result.themeConstraintSatisfied, true, 'the final independent theme gate must pass');
  assert.equal(result.effectivePrintingFamily, null, 'typal theme must not invent a printing-family restriction');

  const plan = record(result.plan);
  assert.equal(plan.lane, 'neutral-themed', 'no-target theme construction must use the neutral lane');
  assert.equal(plan.requestedTargetBracket, null, 'the plan must retain targetBracket=null');
  assert.equal(plan.archetype, 'combat-tokens', 'Najeela semantics should infer the combat-tokens archetype before theme seeding');
  assert.deepEqual(plan.unsupportedConstraints, [], 'the enforceable theme adapter must remove the old blanket unsupported-theme guard');

  const stages = record(result.stages);
  assert.equal(stages.winPackageDiscoveryAttempted, false, 'this control isolates typal construction from package seeding');
  assert.equal(stages.themeConstraintEvaluated, true, 'theme compliance must be audited after construction');
  assert.equal(stages.themeConstraintSatisfied, true, 'the audited theme must be a hard completion gate');
  assert.equal(stages.hardTruthEvaluationCompleted, true, 'ordinary hard truth evaluation must still run');
  assert.equal(stages.actualBracketAssessedAfterConstruction, true, 'actual bracket must remain post-build and target-free');

  const built = record(result.built);
  assert.equal(built.status, 'complete-neutral-themed-draft', 'the neutral theme wrapper must emit a complete themed draft');
  assert.equal(built.constructionIntent, 'neutral-themed', 'construction intent must report the themed neutral lane');
  assert.equal(built.cardCount, 100, 'theme construction must emit exactly 100 Commander cards');
  assert.equal(built.printingPolicySatisfied, true, 'theme construction must preserve exact physical-printing validity');
  assert.equal(built.generatedThemeSeedBudgetSatisfied, true, 'generated theme seeds must retain optional-card cap semantics when a cap exists');

  const intent = record(built.themeIntent);
  assert.equal(intent.kind, 'creature-type', 'Warrior typal must resolve as a verified creature-type theme');
  assert.equal(intent.enforceability, 'full', 'Warrior typal must be fully enforceable');
  assert.equal(intent.canonicalLabel, 'Warrior typal', 'the normalized theme label must be auditable');
  assert.equal(intent.queryClause, 't:"Warrior"', 'the generated Scryfall clause must be controlled and quoted');
  assert.equal(intent.minimumMainMatches, 20, 'the live typal control requires at least 20 matching main-deck cards');

  const themeAudit = record(built.themeAudit);
  assert.equal(themeAudit.status, 'satisfied', 'the independent final theme audit must pass');
  assert.equal(themeAudit.satisfied, true, 'theme audit must be a hard positive result');
  assert.ok(Number(themeAudit.matchedMainCards) >= 20, 'the final main deck must contain at least 20 independently matched Warrior-theme cards');
  assert.equal(Number(themeAudit.totalMainCards), 99, 'single-commander final main deck must contain 99 cards');
  assert.ok(Number(themeAudit.mainCoverage) >= 20 / 99, 'reported theme coverage must agree with the minimum density');
  assert.ok(Array.isArray(themeAudit.matchingCardNames) && themeAudit.matchingCardNames.length >= 20, 'theme audit must expose matching card identities');

  const themeProvenance = record(built.themeCandidateProvenance);
  assert.equal(themeProvenance.mode, 'controlled-theme-supplement', 'theme candidate discovery must expose its dedicated provenance mode');
  assert.equal(themeProvenance.normalizedTheme, 'Warrior typal', 'theme provenance must retain normalized intent');
  assert.equal(themeProvenance.generatedQueryClause, 't:"Warrior"', 'theme provenance must expose the generated safe query, not raw user grammar');
  assert.equal(themeProvenance.exhaustiveWithinBounds, true, 'theme search must finish within explicit safety ceilings or fail closed');
  assert.equal(themeProvenance.constructionRankingUsesPopularity, false, 'theme seed ranking must never use EDHREC popularity');
  assert.ok(Number(themeProvenance.eligibleThemeCandidates) >= 20, 'live discovery must find enough legal theme candidates to prove density');
  assert.ok(Number(themeProvenance.generatedThemeSeeds) >= 20, 'with no pre-existing must-includes this control should seed at least the minimum theme density');

  const baseProvenance = record(built.candidatePoolProvenance);
  assert.equal(baseProvenance.mode, 'bounded-stratified-neutral-sample', 'ordinary unrestricted neutral support cards must still come from the anti-popularity sampled pool');
  assert.equal(baseProvenance.popularityOrdered, false, 'base candidate discovery must remain non-popularity-ordered');
  assert.equal(baseProvenance.edhrecOrdered, false, 'base candidate discovery must remain non-EDHREC-ordered');

  const evaluation = record(result.evaluation);
  const actualBracket = record(evaluation.actualBracket);
  const parsed = record(evaluation.parsed);
  assert.equal(actualBracket.hardGatesPassed, true, 'final themed deck must still pass legality/count/resolution/printing hard gates');
  assert.equal(parsed.totalCards, 100, 'independent post-build parsing must confirm exactly 100 cards');
  assert.equal(evaluation.printingPolicySatisfied, true, 'independent post-build evaluation must confirm exact physical printings');
  assert.ok(Number.isInteger(result.achievedBracket) && Number(result.achievedBracket) >= 1 && Number(result.achievedBracket) <= 5, 'post-build assessment must report an honest bracket in range 1-5');

  console.log(`WARRIOR THEME: matched=${String(themeAudit.matchedMainCards)}/${String(themeAudit.totalMainCards)}; candidates=${String(themeProvenance.eligibleThemeCandidates)}; seeds=${String(themeProvenance.generatedThemeSeeds)}`);
  console.log(`WARRIOR ACHIEVED: Bracket ${String(result.achievedBracket)} / ${String(result.achievedBand)}`);

  return {
    requestedTargetBracket: result.requestedTargetBracket,
    achievedBracket: result.achievedBracket,
    achievedBand: result.achievedBand,
    bracketConfidence: result.bracketConfidence,
    plan,
    stages,
    themeIntent: intent,
    themeAudit,
    themeCandidateProvenance: themeProvenance,
    baseCandidatePoolProvenance: baseProvenance,
    hardGatesPassed: actualBracket.hardGatesPassed,
    cardCount: parsed.totalCards,
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    externalEvidenceComplete: evaluation.externalEvidenceComplete,
  };
}

async function validateFinalFantasyTheme(commander: ScryfallCard): Promise<Record<string, unknown>> {
  console.log('\nCASE 2: exact Najeela commander, no bracket target, free-form theme "Final Fantasy", no explicit printingFamily.');
  console.log('PASS CONDITION: theme intent alone must become the exact Final Fantasy physical-printing constraint before win-package discovery and remain active through construction and independent post-build evaluation.');

  const result = await buildCommanderThroughPipelineV15([commander], {
    themeQuery: 'Final Fantasy',
    winPackageMode: 'auto',
  });

  assert.equal(result.status, 'complete-evaluated-build', `Final Fantasy theme-only pipeline must complete; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, null, 'printing-family theme must not invent a bracket target');
  assert.equal(result.targetComparison, null, 'no requested target means no requested-vs-achieved comparison');
  assert.equal(result.themeConstraintSatisfied, true, 'delegated printing-family theme must pass its final theme gate');
  assert.equal(result.effectivePrintingFamily, 'Final Fantasy', 'free-form FF theme must become the effective printing-family constraint');

  const plan = record(result.plan);
  assert.equal(plan.lane, 'neutral-themed', 'theme-only FF construction must use the neutral lane');
  assert.equal(plan.requestedTargetBracket, null, 'theme-only FF plan must remain target-free');

  const intent = record(result.themeIntent);
  assert.equal(intent.kind, 'printing-family', 'Final Fantasy free-form theme must resolve as a printing-family theme');
  assert.equal(intent.enforceability, 'delegated-printing-policy', 'FF theme must delegate to exact physical-printing policy');
  assert.equal(intent.printingFamily, 'Final Fantasy', 'normalized theme must carry the exact family name');

  const built = record(result.built);
  assert.equal(built.status, 'complete-neutral-themed-draft', 'FF theme wrapper must emit a complete neutral themed draft');
  assert.equal(built.cardCount, 100, 'FF theme-only build must contain exactly 100 cards');
  assert.equal(built.printingPolicySatisfied, true, 'inner construction must prove every exact printing is FF-eligible');
  const builtThemeAudit = record(built.themeAudit);
  assert.equal(builtThemeAudit.status, 'satisfied', 'delegated printing-family theme audit must pass');
  assert.equal(builtThemeAudit.satisfied, true, 'delegated printing-family theme must be a hard positive result');

  const packageDiscovery = record(result.packageDiscovery);
  const packagePolicy = record(packageDiscovery.printingPolicy);
  assert.equal(packagePolicy.familyPreset, 'final-fantasy', 'win-package discovery must use FF physical-printing policy even though printingFamily was not explicitly supplied');
  assert.equal(packagePolicy.family, 'Final Fantasy', 'win-package discovery must expose the effective FF family');

  const evaluation = record(result.evaluation);
  const evaluationPolicy = record(evaluation.printingPolicy);
  const actualBracket = record(evaluation.actualBracket);
  const parsed = record(evaluation.parsed);
  assert.equal(evaluationPolicy.familyPreset, 'final-fantasy', 'independent post-build evaluator must reapply FF physical-printing policy');
  assert.equal(evaluationPolicy.family, 'Final Fantasy', 'independent evaluator must expose the effective FF family');
  assert.equal(evaluation.printingPolicySatisfied, true, 'outer independent evaluation must prove every resolved exact printing is FF-eligible');
  assert.equal(actualBracket.hardGatesPassed, true, 'theme-only FF build must pass ordinary post-build hard gates');
  assert.equal(parsed.totalCards, 100, 'independent evaluator must confirm exact 100 cards');

  const stages = record(result.stages);
  assert.equal(stages.winPackageDiscoveryAttempted, true, 'auto mode should still perform package discovery under the effective FF restriction');
  assert.equal(stages.themeConstraintEvaluated, true, 'delegated theme must be independently audited');
  assert.equal(stages.themeConstraintSatisfied, true, 'delegated FF theme must remain a completion gate');
  assert.equal(stages.actualBracketAssessedAfterConstruction, true, 'actual bracket remains target-free and post-build');

  console.log(`FF THEME: innerPolicy=${String(record(built.printingPolicy).familyPreset)} packagePolicy=${String(packagePolicy.familyPreset)} outerPolicy=${String(evaluationPolicy.familyPreset)}`);
  console.log(`FF THEME ACHIEVED: Bracket ${String(result.achievedBracket)} / ${String(result.achievedBand)}; package source=${String(packageDiscovery.sourceCompleteness)}`);

  return {
    requestedTargetBracket: result.requestedTargetBracket,
    achievedBracket: result.achievedBracket,
    achievedBand: result.achievedBand,
    bracketConfidence: result.bracketConfidence,
    effectivePrintingFamily: result.effectivePrintingFamily,
    plan,
    stages,
    themeIntent: intent,
    themeAudit: builtThemeAudit,
    packageDiscoveryStatus: packageDiscovery.status,
    packageDiscoveryCompleteness: packageDiscovery.sourceCompleteness,
    packagePrintingPolicy: packagePolicy,
    evaluationPrintingPolicy: evaluationPolicy,
    hardGatesPassed: actualBracket.hardGatesPassed,
    cardCount: parsed.totalCards,
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    externalEvidenceComplete: evaluation.externalEvidenceComplete,
  };
}

async function main(): Promise<void> {
  console.log('NEUTRAL FREE-FORM THEME LIVE CONTROL');
  const commanderLookup = await getCardsByIdentifiers([
    { name: 'Najeela, the Blade-Blossom', set: 'FCA', collectorNumber: '42' },
  ]);
  assert.deepEqual(commanderLookup.notFound, [], 'exact Najeela commander printing must resolve');
  const commander = commanderLookup.cards[0];
  assert.ok(commander, 'Najeela commander must resolve');

  const warrior = await validateWarriorTheme(commander);
  const finalFantasy = await validateFinalFantasyTheme(commander);
  const summary = {
    schema: 'neutral-theme-live-v15.2',
    warrior,
    finalFantasy,
  };
  await writeFile('neutral-theme-live-result.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log('\nNEUTRAL FREE-FORM THEME LIVE CONTROL: PASS');
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('neutral-theme-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
