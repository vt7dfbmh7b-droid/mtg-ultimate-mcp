import { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';
import { discoverCedhSeedWinPackageV14 } from './cedh-seed-package-v14.js';
import {
  completeBestCedhWinPackageV14,
  countWinningCombosV14,
  type CedhWinPackageOptionsV14,
} from './cedh-win-package-v14.js';
import {
  refineCedhEfficiencyV14,
  winningComboCoreCountV14,
  type CedhEfficiencyOptionsV14,
} from './cedh-efficiency-v14.js';
import { optimizeCedhManaBaseV14, type CedhManaBaseOptionsV14 } from './cedh-manabase-v14.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from './deck.js';
import { effectiveDeckRoleCountsV15 } from './deck-role-metrics-v15.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
} from './printing-policy-v08.js';
import { getCardsByIdentifiers, getCardsByNames, type CardIdentifierInput } from './scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from './spellbook.js';

export interface CedhWorkflowOptionsV14 extends CedhWinPackageOptionsV14, CedhEfficiencyOptionsV14, CedhManaBaseOptionsV14 {
  maxEfficiencySwaps?: number;
  maxEfficiencyPasses?: number;
  maxManaBaseSwaps?: number;
  requireVerifiedCombo?: boolean;
}

export interface BuildCedhOptionsV14 extends DeckBuildOptionsV07, CedhWorkflowOptionsV14 {
  landCount?: number;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

function ruthlessComboCount(comboData: Record<string, unknown>): number {
  const included = Array.isArray(comboData.included) ? comboData.included.map(record) : [];
  return included.filter((combo) => String(combo.bracketTag ?? '') === 'R').length;
}

function comboCount(comboData: Record<string, unknown>): number {
  return Number(record(comboData.counts).included ?? 0);
}

function strategicComboCount(bracketData: Record<string, unknown>): number {
  return Array.isArray(bracketData.strategicallyRelevantCombos) ? bracketData.strategicallyRelevantCombos.length : 0;
}

async function hardValidateFinalV14(decklist: string, options: CedhWorkflowOptionsV14): Promise<Record<string, unknown>> {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  const rules = validateCommanderDeck(parsed, resolved.cards);
  const policy = await resolvePrintingPolicyV08({
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
  });
  const offPolicy = resolved.cards
    .filter((card) => !printingMatchesPolicyV08(card, policy))
    .map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`);

  return {
    parsed,
    resolvedCards: resolved.cards,
    unresolved: resolved.notFound,
    commanderRules: rules,
    printingPolicy: describePrintingPolicyV08(policy),
    offPolicy,
    valid: parsed.totalCards === 100 && resolved.notFound.length === 0 && rules.isLegal && offPolicy.length === 0,
  };
}

export async function assessCedhReadinessV14(
  decklist: string,
  options: CedhWorkflowOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const validation = await hardValidateFinalV14(decklist, options);
  if (validation.valid !== true) {
    return {
      status: 'invalid-or-policy-noncompliant',
      validation: {
        unresolved: validation.unresolved,
        commanderRules: validation.commanderRules,
        printingPolicy: validation.printingPolicy,
        offPolicy: validation.offPolicy,
      },
    };
  }

  const parsed = validation.parsed as ParsedDeck;
  const cards = validation.resolvedCards as Awaited<ReturnType<typeof getCardsByIdentifiers>>['cards'];
  const [bracket, combos] = await Promise.all([
    estimateCommanderBracket(decklist),
    findDeckCombos(decklist, 100),
  ]);
  const metrics = buildDeckMetrics(parsed, cards);
  const effectiveRoleCounts = effectiveDeckRoleCountsV15(parsed, cards);
  const effectiveFastManaCount = Number(effectiveRoleCounts['fast mana'] ?? 0);
  const effectiveFreeInteractionCount = Number(effectiveRoleCounts['free interaction'] ?? 0);
  const conditionalManaCount = Number(effectiveRoleCounts['conditional mana acceleration'] ?? 0);
  const delayedManaCount = Number(effectiveRoleCounts['delayed mana acceleration'] ?? 0);
  const includedCombos = comboCount(combos);
  const winningCombos = countWinningCombosV14(combos);
  const winningComboCoreCount = winningComboCoreCountV14(combos);
  const ruthlessCombos = ruthlessComboCount(combos);
  const strategicallyRelevantCombos = strategicComboCount(bracket);
  const bracketTag = typeof bracket.bracketTag === 'string' ? bracket.bracketTag : null;

  const constructionSignals = {
    verifiedCompleteCombo: includedCombos > 0,
    verifiedWinningCombo: winningCombos > 0,
    independentWinningComboCore: winningComboCoreCount > 0,
    ruthlessCombo: ruthlessCombos > 0,
    strategicallyRelevantCombo: strategicallyRelevantCombos > 0,
    spellbookRuthlessDeckTag: bracketTag === 'R',
    lowAverageNonlandManaValue: metrics.averageNonlandManaValue <= 2.6,
    substantialEarlyGameDensity: metrics.earlyPlayCount >= 35,
    freeInteractionPresent: effectiveFreeInteractionCount > 0,
    fastManaPresent: effectiveFastManaCount > 0,
  };

  const strongCompetitiveConstructionSignals = constructionSignals.verifiedWinningCombo
    && constructionSignals.independentWinningComboCore
    && (constructionSignals.ruthlessCombo || constructionSignals.strategicallyRelevantCombo || constructionSignals.spellbookRuthlessDeckTag)
    && constructionSignals.lowAverageNonlandManaValue
    && constructionSignals.freeInteractionPresent;

  return {
    status: strongCompetitiveConstructionSignals ? 'strong-competitive-construction-signals' : 'not-yet-strong-competitive-construction-signals',
    bracketTag,
    includedCombos,
    winningCombos,
    winningComboCoreCount,
    ruthlessCombos,
    strategicallyRelevantCombos,
    metrics: {
      landCount: metrics.landCount,
      averageNonlandManaValue: metrics.averageNonlandManaValue,
      earlyPlayCount: metrics.earlyPlayCount,
      fastManaCount: effectiveFastManaCount,
      rawInferredFastManaCount: metrics.fastManaCount,
      conditionalManaCount,
      delayedManaCount,
      cheapInteractionCount: metrics.cheapInteractionCount,
      protectionCount: metrics.protectionCount,
      tutorCount: metrics.tutorCount,
      freeInteractionCount: effectiveFreeInteractionCount,
    },
    constructionSignals,
    validation: {
      commanderRules: validation.commanderRules,
      printingPolicy: validation.printingPolicy,
    },
    roleTruth: {
      source: 'effective-card-role-truth-v15',
      rawInferredFastManaCount: metrics.fastManaCount,
      effectiveFastManaCount,
      conditionalManaCount,
      delayedManaCount,
      rule: 'Conditional or delayed mana cannot satisfy competitive fast-mana evidence merely because Oracle text contains a mana ability.',
    },
    comboTruth: {
      winningComboCount: winningCombos,
      independentWinningComboCoreCount: winningComboCoreCount,
      rule: 'Independent win redundancy is the maximum supported set of pairwise-disjoint non-commander winning packages; overlapping variants sharing a required piece do not multiply redundancy.',
    },
    caveat: 'This is a construction-readiness assessment, not a declaration that the deck is officially Bracket 5. A combo only satisfies the win-package gate when Commander Spellbook reports a win-oriented result; lifegain-only, value-only, and standalone infinite-mana engines do not qualify. Multiple winning variants that require the same non-commander card do not become independent redundancy, while genuinely pairwise-disjoint winning packages remain separate even if other bridge variants connect them. Fast-mana evidence is fail-closed against delayed and prerequisite-dependent mana. Bracket 5/cEDH also depends on competitive intent, metagame knowledge, pilot decisions, and tournament-minded play.',
  };
}

export async function refineCommanderForCedhV14(
  decklist: string,
  options: CedhWorkflowOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const initialAssessment = await assessCedhReadinessV14(decklist, options);
  if (initialAssessment.status === 'invalid-or-policy-noncompliant') {
    return { status: 'invalid-starting-deck', initialAssessment };
  }

  const winPackage = await completeBestCedhWinPackageV14(decklist, {
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    ...(options.protectedCards ? { protectedCards: options.protectedCards } : {}),
    maxMissingCards: options.maxMissingCards ?? 2,
    maxCandidatesToVerify: options.maxCandidatesToVerify ?? 8,
  });

  const initialAlreadyHasWinningCombo = Number(initialAssessment.winningCombos ?? 0) > 0;
  if ((options.requireVerifiedCombo ?? true) && !initialAlreadyHasWinningCombo && winPackage.status !== 'winning-combo-completed') {
    return {
      status: 'stopped-no-verifiable-win-package',
      initialAssessment,
      winPackageStage: winPackage,
      finalDecklist: decklist,
      guidance: 'Target Bracket 5 construction is not allowed to hide a missing win condition behind generic role counts or non-winning infinite engines. No later efficiency tuning was applied because no complete policy-compliant win-oriented package could be verified.',
    };
  }

  let currentDecklist = typeof winPackage.finalDecklist === 'string' ? winPackage.finalDecklist : decklist;
  const completedPlan = record(winPackage.completedPlan);
  const protectedComboCards = strings(completedPlan.comboCardNames);
  const protectedCards = [...new Set([...(options.protectedCards ?? []), ...protectedComboCards])];
  const requestedEfficiencySwaps = Math.max(1, Math.min(10, Math.trunc(options.maxEfficiencySwaps ?? 3)));
  const efficiencyPassLimit = Math.max(
    1,
    Math.min(2, Math.trunc(options.maxEfficiencyPasses ?? (requestedEfficiencySwaps >= 8 ? 2 : 1))),
  );
  const efficiencyPasses: Record<string, unknown>[] = [];
  let acceptedEfficiency: Record<string, unknown> | null = null;

  for (let pass = 0; pass < efficiencyPassLimit; pass += 1) {
    const passSwapLimit = pass === 0 ? requestedEfficiencySwaps : Math.min(5, requestedEfficiencySwaps);
    const beforePassDecklist = currentDecklist;
    const efficiency = await refineCedhEfficiencyV14(currentDecklist, {
      ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
      ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
      ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
      ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
      ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
      ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
      protectedCards,
      maxSwaps: passSwapLimit,
    });
    const annotatedEfficiency = {
      ...efficiency,
      pass: pass + 1,
      requestedPassSwapLimit: passSwapLimit,
    };
    efficiencyPasses.push(annotatedEfficiency);

    const finalDecklist = typeof efficiency.finalDecklist === 'string' ? efficiency.finalDecklist : '';
    if (efficiency.status !== 'cedh-efficiency-refined' || !finalDecklist.trim() || finalDecklist === beforePassDecklist) break;
    currentDecklist = finalDecklist;
    acceptedEfficiency = annotatedEfficiency;

    const selectedCandidateCount = Number(efficiency.selectedCandidateCount ?? (Array.isArray(efficiency.swaps) ? efficiency.swaps.length : 0));
    if (selectedCandidateCount < passSwapLimit) break;
  }

  const efficiency = acceptedEfficiency ?? efficiencyPasses.at(-1) ?? {
    status: 'no-efficiency-pass-attempted',
    finalDecklist: currentDecklist,
  };

  const manaBase = await optimizeCedhManaBaseV14(currentDecklist, {
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    maxSwaps: options.maxManaBaseSwaps ?? 5,
  });
  if (typeof manaBase.finalDecklist === 'string') currentDecklist = manaBase.finalDecklist;

  const finalAssessment = await assessCedhReadinessV14(currentDecklist, options);
  const baselineWinningComboCores = initialAlreadyHasWinningCombo
    ? Math.max(1, Number(initialAssessment.winningComboCoreCount ?? 1))
    : 1;
  const finalWinningComboCores = Number(finalAssessment.winningComboCoreCount ?? 0);
  const comboWasPreserved = finalWinningComboCores >= baselineWinningComboCores;

  return {
    status: finalAssessment.status === 'strong-competitive-construction-signals' && comboWasPreserved
      ? 'cedh-oriented-refinement-complete'
      : 'cedh-oriented-refinement-incomplete',
    initialAssessment,
    stages: {
      winPackageCompletion: winPackage,
      strictEfficiency: efficiency,
      strictEfficiencyPasses: efficiencyPasses,
      manaBase,
    },
    finalAssessment,
    comboWasPreserved,
    baselineWinningComboCores,
    finalWinningComboCores,
    finalDecklist: currentDecklist,
    guidance: 'The cEDH path is win-package-first: verify a real winning package, protect it, then apply up to two marginal-value efficiency passes when a high-swap optimization request still has worthwhile candidates. Each pass recalculates role saturation and creature-type coherence, so later passes attack surviving filler instead of blindly stacking the role that won pass one. Lands are optimized separately and the finished list is independently reassessed. Winning redundancy/preservation is measured by pairwise-disjoint winning packages rather than duplicate or transitively connected variants. Competitive role evidence uses fail-closed role truth for conditional/delayed mana. It does not translate targetBracket=5 into an automatic Bracket 5 claim.',
  };
}

export async function buildCommanderForCedhV14(
  commanderNames: string[],
  options: BuildCedhOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const requested = commanderNames.map((name) => name.trim()).filter(Boolean);
  if (requested.length < 1 || requested.length > 2) throw new Error('Provide one or two Commander names.');
  const resolved = await getCardsByNames(requested);
  if (resolved.notFound.length > 0 || resolved.cards.length !== requested.length) {
    return {
      status: 'commander-resolution-failed',
      requestedCommanders: requested,
      unresolvedCommanders: resolved.notFound,
    };
  }

  let seedDiscovery = await discoverCedhSeedWinPackageV14(resolved.cards, {
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    maxPackageCards: Math.max(2, Math.min(4, options.maxMissingCards ?? 3)),
    maxCandidatesToVerify: options.maxCandidatesToVerify ?? 10,
  });

  const excluded = new Set((options.excludedCards ?? []).map(normalize));
  const discoveredSeedNames = strings(seedDiscovery.seedNames);
  const blockedSeedNames = discoveredSeedNames.filter((name) => excluded.has(normalize(name)));
  if (seedDiscovery.status === 'eligible-winning-seed-package-found' && blockedSeedNames.length > 0) {
    seedDiscovery = {
      ...seedDiscovery,
      status: 'winning-seed-package-blocked-by-exclusions',
      blockedCards: blockedSeedNames,
      guidance: 'A legal winning seed package was found, but one or more required cards were explicitly excluded. The builder will not override the exclusion; it will fall back to ordinary drafting and require later independent win-package verification.',
    };
  }

  const seedNames = seedDiscovery.status === 'eligible-winning-seed-package-found' ? discoveredSeedNames : [];
  const seedComboCards = seedDiscovery.status === 'eligible-winning-seed-package-found' ? strings(seedDiscovery.comboCardNames) : [];
  const mustInclude = [...new Set([...(options.mustInclude ?? []), ...seedNames])];

  const draft = await buildCommanderDeckDraftV07(resolved.cards, {
    targetBracket: 5,
    ...(options.themeQuery ? { themeQuery: options.themeQuery } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
    ...(mustInclude.length > 0 ? { mustInclude } : {}),
    ...(options.landCount !== undefined ? { landCount: options.landCount } : {}),
    ...(options.maxNonbasicLands !== undefined ? { maxNonbasicLands: options.maxNonbasicLands } : {}),
  });
  if (draft.status !== 'complete-draft' || typeof draft.decklist !== 'string') {
    return {
      status: 'incomplete-first-draft',
      requestedCommanders: requested,
      seedDiscovery,
      draft,
    };
  }

  const protectedCards = [...new Set([...(options.protectedCards ?? []), ...seedComboCards])];
  const refinement = await refineCommanderForCedhV14(draft.decklist, {
    ...options,
    protectedCards,
  });
  return {
    status: refinement.status === 'cedh-oriented-refinement-complete' ? 'built-with-strong-competitive-signals' : 'built-but-competitive-signals-incomplete',
    requestedCommanders: requested,
    seedDiscovery,
    draft: {
      status: draft.status,
      cardCount: draft.cardCount,
      targetBracket: draft.targetBracket,
      roleCounts: draft.roleCounts,
      roleTargets: draft.roleTargets,
      printingPolicy: draft.printingPolicy,
      seededMustInclude: seedNames,
    },
    refinement,
    finalDecklist: typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist : draft.decklist,
    caveat: 'A successful build means the deck passed the plugin’s competitive-construction gates under the requested restrictions, including a verified win-oriented Commander Spellbook package. Seed discovery can propose compact winning packages, but the finished 100-card deck must independently reproduce the win package before it counts. Official Bracket 5 still describes cEDH intent/metagame/tournament-minded play, not a static card-list certification.',
  };
}
