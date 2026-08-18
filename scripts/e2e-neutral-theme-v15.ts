import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildCommanderThroughPipelineV15 } from '../src/services/commander-build-pipeline-v15.js';
import { getCardsByIdentifiers } from '../src/services/scryfall.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  console.log('NEUTRAL FREE-FORM THEME LIVE CONTROL');
  console.log('CASE: exact Najeela commander, no bracket target, Warrior typal free-form theme, no seeded win package.');
  console.log('PASS CONDITION: normalize the user theme safely, generate a bounded non-popularity theme supplement, produce an exact legal 100, independently audit at least 20 Warrior-theme main-deck cards, then assess bracket only afterward.');

  const commanderLookup = await getCardsByIdentifiers([
    { name: 'Najeela, the Blade-Blossom', set: 'FCA', collectorNumber: '42' },
  ]);
  assert.deepEqual(commanderLookup.notFound, [], 'exact Najeela commander printing must resolve');
  const commander = commanderLookup.cards[0];
  assert.ok(commander, 'Najeela commander must resolve');

  const result = await buildCommanderThroughPipelineV15([commander], {
    themeQuery: 'Warrior typal',
    winPackageMode: 'forbid',
  });

  assert.equal(result.status, 'complete-evaluated-build', `themed pipeline must complete and pass every hard/theme gate; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, null, 'theme construction must not invent a bracket target');
  assert.equal(result.targetComparison, null, 'no requested target means there must be no requested-vs-achieved comparison');
  assert.equal(result.themeConstraintSatisfied, true, 'the final independent theme gate must pass');

  const plan = record(result.plan);
  assert.equal(plan.lane, 'neutral-themed', 'no-target theme construction must use the neutral lane');
  assert.equal(plan.requestedTargetBracket, null, 'the plan must retain targetBracket=null');
  assert.equal(plan.archetype, 'combat-tokens', 'Najeela semantics should infer the combat-tokens archetype before theme seeding');
  assert.deepEqual(plan.unsupportedConstraints, [], 'the enforceable theme adapter must remove the old blanket unsupported-theme guard');

  const stages = record(result.stages);
  assert.equal(stages.winPackageDiscoveryAttempted, false, 'this control isolates theme construction from package seeding');
  assert.equal(stages.themeConstraintEvaluated, true, 'theme compliance must be audited after construction');
  assert.equal(stages.themeConstraintSatisfied, true, 'the audited theme must be a hard completion gate');
  assert.equal(stages.hardTruthEvaluationCompleted, true, 'ordinary hard truth evaluation must still run');
  assert.equal(stages.actualBracketAssessedAfterConstruction, true, 'actual bracket must remain post-build and target-free');

  const built = record(result.built);
  assert.equal(built.status, 'complete-neutral-themed-draft', 'the neutral theme wrapper must emit a complete themed draft');
  assert.equal(built.constructionIntent, 'neutral-themed', 'construction intent must report the themed neutral lane');
  assert.equal(built.cardCount, 100, 'theme construction must emit exactly 100 Commander cards');
  assert.equal(built.printingPolicySatisfied, true, 'theme construction must preserve exact physical-printing validity');
  assert.equal(built.generatedThemeSeedBudgetSatisfied, true, 'generated theme seeds must retain the optional-card cap semantics when a cap exists');

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
  assert.ok(Array.isArray(themeAudit.matchingCardNames) && themeAudit.matchingCardNames.length >= 20, 'theme audit must expose the matching card identities');

  const themeProvenance = record(built.themeCandidateProvenance);
  assert.equal(themeProvenance.mode, 'controlled-theme-supplement', 'theme candidate discovery must expose its dedicated provenance mode');
  assert.equal(themeProvenance.normalizedTheme, 'Warrior typal', 'theme provenance must retain the normalized intent');
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

  const summary = {
    schema: 'neutral-theme-live-v15.1',
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
  await writeFile('neutral-theme-live-result.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`THEME: ${String(intent.canonicalLabel)}; matched=${String(themeAudit.matchedMainCards)}/${String(themeAudit.totalMainCards)}`);
  console.log(`THEME CANDIDATES: ${String(themeProvenance.eligibleThemeCandidates)}; generated seeds=${String(themeProvenance.generatedThemeSeeds)}`);
  console.log(`ACHIEVED: Bracket ${String(result.achievedBracket)} / ${String(result.achievedBand)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('neutral-theme-live-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
