import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSimulationBackedUpgradePlanV07 } from '../src/services/deck-builder-v07.js';
import { parseDecklist } from '../src/services/deck.js';
import { discoverGeneralWinPackagesV15 } from '../src/services/general-win-package-v15.js';
import {
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
} from '../src/services/printing-policy-v08.js';
import { boundedScryfallSearchV15 } from '../src/services/scryfall-paged-search-v15.js';
import { getCardsByIdentifiers, inferCardRoles } from '../src/services/scryfall.js';
import { suggestDeckUpgrades } from '../src/services/upgrade.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  const decklist = await readFile('test-results/marvel-bracket5/selected-deck.txt', 'utf8');
  const parsed = parseDecklist(decklist);
  const identifiers = [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
  const resolved = await getCardsByIdentifiers(identifiers);
  assert.deepEqual(resolved.notFound, [], 'diagnostic starting deck must fully resolve');
  const commanderNames = new Set(parsed.commanders.map((entry) => entry.name.toLocaleLowerCase()));
  const commanders = resolved.cards.filter((card) => commanderNames.has(card.name.toLocaleLowerCase()));
  assert.equal(commanders.length, parsed.commanders.length, 'diagnostic must resolve all commanders');
  const identity = [...new Set(commanders.flatMap((card) => card.color_identity))].sort();

  const options = {
    targetBracket: 5,
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
    maxCandidatesPerRole: 12,
  } as const;

  const suggestions = await suggestDeckUpgrades(parsed, resolved.cards, identity, options);
  const freeGroup = ((suggestions.candidateAddsByDeficit ?? []) as Array<Record<string, unknown>>)
    .find((group) => group.role === 'free-interaction') ?? null;

  const packageDiscovery = await discoverGeneralWinPackagesV15(commanders, {
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
    maxPackageCards: 3,
    maxCandidatesToVerify: 20,
  });

  const plan = await buildSimulationBackedUpgradePlanV07(parsed, resolved.cards, identity, {
    ...options,
    maxSwaps: 8,
    protectedCards: [],
    winRouteVerificationStatus: 'no-verified-route',
    simulationIterations: 250,
    simulationTurns: 7,
    seed: 20260821,
  });

  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
  });
  assert.ok(policy.allowedSetCodes.length > 0, 'Marvel printing policy must resolve physical set codes');
  const setClause = `(${policy.allowedSetCodes.map((set) => `set:${set}`).join(' OR ')})`;
  const familyCards = await boundedScryfallSearchV15(`${setClause} f:commander game:paper`, {
    maxCards: 2_000,
    maxPages: 50,
    minRequestGapMs: 500,
    unique: 'prints',
  });
  const eligibleFamilyCards = familyCards.cards.filter((card) => printingMatchesPolicyV08(card, policy));
  const freeInteractionPrintings = eligibleFamilyCards
    .filter((card) => inferCardRoles(card).includes('free interaction'))
    .map((card) => ({
      name: card.name,
      set: card.set.toUpperCase(),
      collectorNumber: card.collector_number,
      manaValue: card.cmc,
      oracleText: card.oracle_text ?? null,
    }));
  const uniqueFreeInteraction = [...new Map(
    freeInteractionPrintings.map((card) => [card.name.toLocaleLowerCase(), card]),
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  const sourceAnalysis = record(plan.sourceUpgradeAnalysis);
  const planPressure = record(plan.v15TargetPressure);
  const result = {
    schema: 'marvel-target-pressure-diagnostic-v15.1',
    commander: parsed.commanders.map((entry) => entry.name),
    identity,
    suggestionTargetPressure: suggestions.targetPressure ?? null,
    structuralDeficits: suggestions.structuralDeficits ?? null,
    freeInteractionSuggestionGroup: freeGroup,
    exhaustiveMarvelFreeInteractionAudit: {
      allowedSetCodes: policy.allowedSetCodes.map((set) => set.toUpperCase()),
      physicalPrintingsScanned: eligibleFamilyCards.length,
      uniqueFreeInteractionCards: uniqueFreeInteraction,
    },
    packageDiscovery: {
      status: packageDiscovery.status,
      sourceCompleteness: packageDiscovery.sourceCompleteness,
      selected: packageDiscovery.selected,
      candidateCount: packageDiscovery.candidates.length,
      candidates: packageDiscovery.candidates,
      queryAudit: packageDiscovery.queryAudit,
      rejectionAudit: packageDiscovery.rejectionAudit,
    },
    planner: {
      status: plan.status ?? null,
      swaps: plan.swaps ?? [],
      v15TargetPressure: planPressure,
      structuralDeficits: sourceAnalysis.structuralDeficits ?? null,
      candidateAddsByDeficit: sourceAnalysis.candidateAddsByDeficit ?? null,
    },
  };

  await writeFile('marvel-target-pressure-diagnostic-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`MARVEL FREE INTERACTION CARDS: ${uniqueFreeInteraction.length}`);
  console.log(`FREE INTERACTION SUGGESTIONS: ${freeGroup ? JSON.stringify(freeGroup) : 'none'}`);
  console.log(`VERIFIED WIN PACKAGE STATUS: ${packageDiscovery.status} / ${packageDiscovery.sourceCompleteness}`);
  console.log(`VERIFIED WIN PACKAGE CANDIDATES: ${packageDiscovery.candidates.length}`);
  console.log(`PLANNER V0.15 PRESSURE: ${JSON.stringify(planPressure)}`);
  console.log(`PLANNER SWAPS: ${JSON.stringify(plan.swaps ?? [])}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('marvel-target-pressure-diagnostic-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
