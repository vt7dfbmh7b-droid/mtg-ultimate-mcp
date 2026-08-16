import { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';
import {
  completeBestCedhWinPackageV14,
  countWinningCombosV14,
  type CedhWinPackageOptionsV14,
} from './cedh-win-package-v14.js';
import { refineCedhEfficiencyV14, type CedhEfficiencyOptionsV14 } from './cedh-efficiency-v14.js';
import { optimizeCedhManaBaseV14, type CedhManaBaseOptionsV14 } from './cedh-manabase-v14.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from './deck.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
} from './printing-policy-v08.js';
import { getCardsByIdentifiers, getCardsByNames, type CardIdentifierInput } from './scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from './spellbook.js';

export interface CedhWorkflowOptionsV14 extends CedhWinPackageOptionsV14, CedhEfficiencyOptionsV14, CedhManaBaseOptionsV14 {
  maxEfficiencySwaps?: number;
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
  const includedCombos = comboCount(combos);
  const winningCombos = countWinningCombosV14(combos);
  const ruthlessCombos = ruthlessComboCount(combos);
  const strategicallyRelevantCombos = strategicComboCount(bracket);
  const bracketTag = typeof bracket.bracketTag === 'string' ? bracket.bracketTag : null;

  const constructionSignals = {
    verifiedCompleteCombo: includedCombos > 0,
    verifiedWinningCombo: winningCombos > 0,
    ruthlessCombo: ruthlessCombos > 0,
    strategicallyRelevantCombo: strategicallyRelevantCombos > 0,
    spellbookRuthlessDeckTag: bracketTag === 'R',
    lowAverageNonlandManaValue: metrics.averageNonlandManaValue <= 2.6,
    substantialEarlyGameDensity: metrics.earlyPlayCount >= 35,
    freeInteractionPresent: Number(metrics.roleCounts['free interaction'] ?? 0) > 0,
    fastManaPresent: metrics.fastManaCount > 0,
  };

  const strongCompetitiveConstructionSignals = constructionSignals.verifiedWinningCombo
    && (constructionSignals.ruthlessCombo || constructionSignals.strategicallyRelevantCombo || constructionSignals.spellbookRuthlessDeckTag)
    && constructionSignals.lowAverageNonlandManaValue
    && constructionSignals.freeInteractionPresent;

  return {
    status: strongCompetitiveConstructionSignals ? 'strong-competitive-construction-signals' : 'not-yet-strong-competitive-construction-signals',
    bracketTag,
    includedCombos,
    winningCombos,
    ruthlessCombos,
    strategicallyRelevantCombos,
    metrics: {
      landCount: metrics.landCount,
      averageNonlandManaValue: metrics.averageNonlandManaValue,
      earlyPlayCount: metrics.earlyPlayCount,
      fastManaCount: metrics.fastManaCount,
      cheapInteractionCount: metrics.cheapInteractionCount,
      protectionCount: metrics.protectionCount,
      tutorCount: metrics.tutorCount,
      freeInteractionCount: Number(metrics.roleCounts['free interaction'] ?? 0),
    },
    constructionSignals,
    validation: {
      commanderRules: validation.commanderRules,
      printingPolicy: validation.printingPolicy,
    },
    caveat: 'This is a construction-readiness assessment, not a declaration that the deck is officially Bracket 5. A combo only satisfies the win-package gate when Commander Spellbook reports a win-oriented result; lifegain-only, value-only, and standalone infinite-mana engines do not qualify. Bracket 5/cEDH also depends on competitive intent, metagame knowledge, pilot decisions, and tournament-minded play.',
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
  const protectedComboCards = Array.isArray(completedPlan.comboCardNames)
    ? completedPlan.comboCardNames.filter((value): value is string => typeof value === 'string')
    : [];
  const protectedCards = [...new Set([...(options.protectedCards ?? []), ...protectedComboCards])];

  const efficiency = await refineCedhEfficiencyV14(currentDecklist, {
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
    protectedCards,
    maxSwaps: options.maxEfficiencySwaps ?? 3,
  });
  if (typeof efficiency.finalDecklist === 'string') currentDecklist = efficiency.finalDecklist;

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
  const baselineWinningCombos = initialAlreadyHasWinningCombo
    ? Number(initialAssessment.winningCombos ?? 0)
    : Number(winPackage.afterWinningCombos ?? 1);
  const comboWasPreserved = Number(finalAssessment.winningCombos ?? 0) >= baselineWinningCombos;

  return {
    status: finalAssessment.status === 'strong-competitive-construction-signals' && comboWasPreserved
      ? 'cedh-oriented-refinement-complete'
      : 'cedh-oriented-refinement-incomplete',
    initialAssessment,
    stages: {
      winPackageCompletion: winPackage,
      strictEfficiency: efficiency,
      manaBase,
    },
    finalAssessment,
    comboWasPreserved,
    finalDecklist: currentDecklist,
    guidance: 'The cEDH path is win-package-first: verify a real winning package, protect it, improve only with strict high-value roles, optimize lands separately, then independently reassess. It does not translate targetBracket=5 into an automatic Bracket 5 claim.',
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

  const draft = await buildCommanderDeckDraftV07(resolved.cards, {
    targetBracket: 5,
    ...(options.themeQuery ? { themeQuery: options.themeQuery } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
    ...(options.mustInclude ? { mustInclude: options.mustInclude } : {}),
    ...(options.landCount !== undefined ? { landCount: options.landCount } : {}),
    ...(options.maxNonbasicLands !== undefined ? { maxNonbasicLands: options.maxNonbasicLands } : {}),
  });
  if (draft.status !== 'complete-draft' || typeof draft.decklist !== 'string') {
    return {
      status: 'incomplete-first-draft',
      requestedCommanders: requested,
      draft,
    };
  }

  const refinement = await refineCommanderForCedhV14(draft.decklist, options);
  return {
    status: refinement.status === 'cedh-oriented-refinement-complete' ? 'built-with-strong-competitive-signals' : 'built-but-competitive-signals-incomplete',
    requestedCommanders: requested,
    draft: {
      status: draft.status,
      cardCount: draft.cardCount,
      targetBracket: draft.targetBracket,
      roleCounts: draft.roleCounts,
      roleTargets: draft.roleTargets,
      printingPolicy: draft.printingPolicy,
    },
    refinement,
    finalDecklist: typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist : draft.decklist,
    caveat: 'A successful build means the deck passed the plugin’s competitive-construction gates under the requested restrictions, including a verified win-oriented Commander Spellbook package. Official Bracket 5 still describes cEDH intent/metagame/tournament-minded play, not a static card-list certification.',
  };
}
