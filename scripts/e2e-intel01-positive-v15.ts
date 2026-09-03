import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildCommanderThroughPipelineV15 } from '../src/services/commander-build-pipeline-v15.js';
import { assessFullTableWinClosureV15 } from '../src/services/full-table-win-closure-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist } from '../src/services/deck.js';
import { getCardsByIdentifiers, getCardsByNames } from '../src/services/scryfall.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function arrayRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function exactQuantity(parsed: ReturnType<typeof parseDecklist>, name: string): number {
  const wanted = normalizeName(name);
  return [...parsed.commanders, ...parsed.main]
    .filter((entry) => normalizeName(entry.name) === wanted)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function selectedRoute(
  details: readonly Record<string, unknown>[],
  comboId: string,
): Record<string, unknown> | null {
  return details.find((detail) => String(detail.comboId ?? '') === comboId) ?? null;
}

function routeAudit(
  audits: readonly Record<string, unknown>[],
  comboId: string,
): Record<string, unknown> | null {
  return audits.find((audit) => String(audit.comboId ?? '') === comboId) ?? null;
}

async function main(): Promise<void> {
  const commanderName = "Frodo, Sauron's Bane";
  const maxUsdPerCard = 100;

  console.log('INTEL-01 POSITIVE FULL-TABLE WIN-PACKAGE PIPELINE LIVE CONTROL');
  console.log(`CASE: ${commanderName}; target Bracket 4; required bounded Spellbook package; US$${maxUsdPerCard} exact per-card cap.`);
  console.log('PASS CONDITION: complete package discovery, strict full-table closure, legal affordable exact printings, atomic seed injection, final route recognition, and independent route/access/setup audits.');

  const commanderLookup = await getCardsByNames([commanderName]);
  assert.deepEqual(commanderLookup.notFound, [], 'positive INTEL-01 commander must resolve');
  assert.equal(commanderLookup.cards.length, 1, 'positive INTEL-01 commander lookup must be unambiguous');
  const commander = commanderLookup.cards[0];
  assert.ok(commander, 'positive INTEL-01 commander card must be present');
  assert.equal(commander.name, commanderName, 'the exact commander name must be retained');
  assert.equal(commander.legalities.commander, 'legal', 'the positive control commander must be Commander legal');
  assert.ok(commander.type_line.toLocaleLowerCase().includes('legendary creature'), 'the positive control commander must be a current legal legendary creature');

  const result = await buildCommanderThroughPipelineV15([commander], {
    targetBracket: 4,
    winPackageMode: 'require',
    maxWinPackageCards: 3,
    maxUsdPerCard,
    includePromos: true,
    includeSpecialReleases: true,
    optimizedPlanEvidence: true,
  });

  assert.equal(result.status, 'complete-evaluated-build', `positive package pipeline must complete; status=${String(result.status)}`);
  assert.equal(result.requestedTargetBracket, 4, 'the requested target must remain explicit');

  const plan = record(result.plan);
  assert.equal(plan.lane, 'targeted-v07', 'an explicit target must use the targeted construction lane');
  assert.deepEqual(plan.unsupportedConstraints, [], 'the positive control must not silently drop constraints');
  assert.equal(plan.discoverWinPackages, true, 'required-package mode must discover packages');
  assert.equal(plan.seedWinPackage, true, 'required-package mode must seed the selected package');

  const stages = record(result.stages);
  for (const stage of [
    'constraintsNormalized',
    'commanderStrategyInferred',
    'winPackageDiscoveryAttempted',
    'winPackageDiscoveryComplete',
    'winPackagesDiscovered',
    'winPackageSeeded',
    'deckConstructed',
    'hardTruthEvaluationCompleted',
    'actualBracketAssessedAfterConstruction',
  ]) {
    assert.equal(stages[stage], true, `pipeline stage ${stage} must complete`);
  }

  const packageDiscovery = record(result.packageDiscovery);
  assert.equal(packageDiscovery.status, 'verified-win-packages-found', 'required package discovery must find a verified package');
  assert.equal(packageDiscovery.sourceCompleteness, 'complete', 'positive package discovery must exhaust its bounded provider window');
  const selected = record(result.selectedPackage);
  const selectedComboId = String(selected.comboId ?? '').trim();
  assert.ok(selectedComboId, 'selected package must retain its provider combo ID');
  const selectedNames = Array.isArray(selected.comboCardNames) ? selected.comboCardNames.map(String).filter(Boolean) : [];
  const selectedSeeds = Array.isArray(selected.seedNames) ? selected.seedNames.map(String).filter(Boolean) : [];
  assert.ok(selectedNames.length >= 2 && selectedNames.length <= 3, 'selected package must contain two or three explicit cards');
  assert.ok(selectedSeeds.length >= 1, 'selected package must contain at least one library seed');
  assert.ok(selectedSeeds.length <= 2, 'selected package must fit the targeted builder injection capacity');

  const selectedResults = Array.isArray(selected.results) ? selected.results.map(String) : [];
  const selectedClosure = assessFullTableWinClosureV15(selectedResults);
  assert.equal(selectedClosure.verifiedFullTableWin, true, 'selected package must have strict full-table closure before construction');
  assert.ok(['self-win', 'all-opponents'].includes(selectedClosure.scope), 'selected package closure must be self-win or all-opponents scoped');
  const exactPrintings = arrayRecords(selected.exactPrintings);
  const printingByName = new Map(exactPrintings.map((printing) => [normalizeName(String(printing.name ?? '')), printing]));
  for (const seed of selectedSeeds) {
    const printing = printingByName.get(normalizeName(seed));
    assert.ok(printing, `selected package must retain an exact printing for ${seed}`);
    assert.match(String(printing?.set ?? ''), /^[A-Z0-9]{2,8}$/, `${seed} must retain a physical set code`);
    assert.ok(String(printing?.collectorNumber ?? '').trim(), `${seed} must retain a physical collector number`);
    const price = printing?.priceUsd;
    assert.equal(typeof price, 'number', `${seed} must retain numeric price evidence under the hard cap`);
    assert.ok(Number(price) <= maxUsdPerCard, `${seed} exact printing must satisfy the hard per-card cap`);
  }

  const built = record(result.built);
  const decklist = typeof built.decklist === 'string' ? built.decklist : '';
  assert.ok(decklist.trim(), 'the final build must retain its exact decklist');
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'the final deck must contain exactly 100 Commander cards');
  assert.equal(exactQuantity(parsed, commanderName), 1, 'the final deck must contain exactly one resolved commander');
  for (const seed of selectedSeeds) {
    assert.equal(exactQuantity(parsed, seed), 1, `the selected seed ${seed} must be injected exactly once`);
  }

  const resolved = await getCardsByIdentifiers([...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  })));
  assert.deepEqual(resolved.notFound, [], 'every final exact printing must resolve independently');
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, 'the final deck must pass independent Commander legality');
  assert.equal(result.seededPackageVerifiedInFinalDeck, true, 'the exact selected package must be recognized in the final deck');

  const evaluation = record(result.evaluation);
  assert.equal(evaluation.hardGatesPassed, true, 'the final deck must pass all legality/count/resolution/printing/budget gates');
  assert.equal(evaluation.printingPolicySatisfied, true, 'the final exact printings must satisfy the active policy');
  const finalBudget = record(evaluation.perCardBudgetAudit);
  assert.equal(finalBudget.satisfied, true, 'the independent final budget audit must pass');
  const post = record(evaluation.postBuildEvidence);
  assert.equal(post.comboVerificationComplete, true, 'final combo verification must complete');
  assert.ok(finite(post.verifiedWinningCombos) >= 1, 'the final deck must contain at least one verified full-table route');
  const verifiedIds = Array.isArray(post.verifiedWinningComboIds) ? post.verifiedWinningComboIds.map(String) : [];
  assert.ok(verifiedIds.includes(selectedComboId), 'the selected package ID must survive final Spellbook recognition');
  const details = arrayRecords(post.verifiedWinningComboDetails);
  const finalSelected = selectedRoute(details, selectedComboId);
  assert.ok(finalSelected, 'the selected package must retain detailed final route evidence');
  assert.ok(['self-win', 'all-opponents'].includes(String(finalSelected?.closureScope ?? '')), 'final selected route must retain strict full-table scope');

  const finalRouteAudit = record(evaluation.finalWinRouteAudit);
  assert.notEqual(finalRouteAudit.status, 'verification-unavailable', 'final route audit must complete rather than fail open');
  assert.ok(finite(finalRouteAudit.verifiedFullTableWinCount) >= 1, 'final route audit must count the selected full-table route');
  const portfolio = record(finalRouteAudit.portfolio);
  assert.ok(finite(portfolio.distinctLibraryRouteCount) >= 1, 'final route portfolio must retain at least one distinct library route');
  const setupAudits = arrayRecords(evaluation.winRouteSetupAudits);
  const selectedSetup = routeAudit(setupAudits, selectedComboId);
  assert.ok(selectedSetup, 'selected route setup/interruption audit must be present');
  assert.ok(['provider-explicit', 'provider-partial', 'provider-absent'].includes(String(selectedSetup?.providerSetupStatus ?? '')), 'setup audit must report an explicit provider status');
  const accessAudits = arrayRecords(evaluation.winRouteAccessAudits);
  const selectedAccess = routeAudit(accessAudits, selectedComboId);
  assert.ok(selectedAccess, 'selected route access audit must be present');
  assert.equal(selectedAccess?.status, 'exact-card-access', 'selected route must have exact card access in the final deck');
  assert.equal(selectedAccess?.missingPieces instanceof Array ? (selectedAccess.missingPieces as unknown[]).length : -1, 0, 'selected route may not have missing card pieces');
  assert.equal(record(selectedAccess?.distinctTutorCoverage).allLibraryPiecesFetchableFromDistinctTutors, true, 'selected route access audit must close its explicit library-piece coverage');

  const finalComboProtection = selectedSeeds.every((seed) => exactQuantity(parsed, seed) === 1)
    && verifiedIds.includes(selectedComboId)
    && String(finalRouteAudit.preferredComboId ?? '') !== '';
  assert.equal(finalComboProtection, true, 'package protection must retain every seed and the verified route after construction');

  const targetComparison = record(result.targetComparison);
  assert.equal(targetComparison.requestedBracket, 4, 'target comparison must preserve Bracket 4');
  const meaningfulAlternateRoutesRetained = finite(portfolio.distinctLibraryRouteCount) >= 2
    || finite(finalRouteAudit.verifiedFullTableWinCount) >= 2;
  const summary = {
    schema: 'intel01-positive-full-table-package-live-v15.1',
    sourceSha: process.env.GITHUB_SHA ?? 'local',
    commander: commanderName,
    request: {
      targetBracket: 4,
      winPackageMode: 'require',
      maxWinPackageCards: 3,
      maxUsdPerCard,
      includePromos: true,
      includeSpecialReleases: true,
    },
    packageDiscovery: {
      status: packageDiscovery.status,
      sourceCompleteness: packageDiscovery.sourceCompleteness,
      selectedComboId,
      selectedCardNames: selectedNames,
      selectedSeedNames: selectedSeeds,
      selectedClosure,
      exactPrintings,
      candidateCount: Array.isArray(packageDiscovery.candidates) ? packageDiscovery.candidates.length : 0,
      portfolio: packageDiscovery.portfolio ?? null,
    },
    stages,
    packageProof: {
      fullTableClosure: selectedClosure.verifiedFullTableWin,
      feasibility: selectedSeeds.every((seed) => {
        const price = printingByName.get(normalizeName(seed))?.priceUsd;
        return typeof price === 'number' && Number.isFinite(price) && Number(price) <= maxUsdPerCard;
      }),
      atomicInjection: stages.winPackageSeeded === true && selectedSeeds.every((seed) => exactQuantity(parsed, seed) === 1),
      packageProtection: finalComboProtection,
      finalRecognition: result.seededPackageVerifiedInFinalDeck === true,
      alternateRouteAudit: finalRouteAudit.status !== 'verification-unavailable',
      meaningfulAlternateRoutesRetained,
      finalRouteCount: finite(finalRouteAudit.verifiedFullTableWinCount),
      distinctLibraryRouteCount: finite(portfolio.distinctLibraryRouteCount),
    },
    finalMetrics: {
      status: result.status,
      targetComparison,
      hardGatesPassed: evaluation.hardGatesPassed,
      printingPolicySatisfied: evaluation.printingPolicySatisfied,
      exactCardCount: parsed.totalCards === 100,
      commanderLegality: rules.isLegal,
      printingPolicyTruth: evaluation.printingPolicySatisfied,
      perCardBudgetAudit: finalBudget,
      externalEvidenceComplete: evaluation.externalEvidenceComplete,
      postBuildEvidence: post,
      finalWinRouteAudit: finalRouteAudit,
      selectedRoute: finalSelected,
      selectedSetupAudit: selectedSetup,
      selectedAccessAudit: selectedAccess,
    },
  };
  await writeFile('intel01-positive-result.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`PACKAGE: ${selectedComboId} / cards=${selectedNames.join(' + ')}`);
  console.log(`CLOSURE: ${selectedClosure.kind} / ${selectedClosure.scope}`);
  console.log(`FINAL RECOGNITION: ${String(result.seededPackageVerifiedInFinalDeck)}`);
  console.log(`FINAL ROUTES: ${String(finalRouteAudit.verifiedFullTableWinCount)} / distinct-library=${String(portfolio.distinctLibraryRouteCount)}`);
  console.log(`ROUTE ACCESS: ${String(selectedAccess?.status)} / ROUTE SETUP: ${String(selectedSetup?.providerSetupStatus)}`);
  console.log(`ALTERNATE ROUTES RETAINED: ${String(meaningfulAlternateRoutesRetained)}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('intel01-positive-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
