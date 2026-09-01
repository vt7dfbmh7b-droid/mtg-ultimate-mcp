import type { ScryfallCard } from '../types/scryfall.js';
import {
  discoverCedhSeedWinPackageV14,
  type CedhSeedPackageOptionsV14,
} from './cedh-seed-package-v14.js';
import {
  refineCommanderForCedhV14,
  type CedhWorkflowOptionsV14,
} from './cedh-workflow-v14.js';
import { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';
import { parseDecklist, type DeckEntry } from './deck.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from './scryfall.js';

export interface WholeDeckBudgetBuildOptionsV15 extends DeckBuildOptionsV07 {
  maxDeckUsd: number;
  creatureTypeOptimization?: boolean;
}

interface ResolveResultV15 {
  cards: ScryfallCard[];
  notFound: unknown[];
}

export interface WholeDeckBudgetDependenciesV15 {
  buildDraft?: (commanders: ScryfallCard[], options: DeckBuildOptionsV07) => Promise<Record<string, unknown>>;
  resolveDeckCards?: (identifiers: CardIdentifierInput[]) => Promise<ResolveResultV15>;
  discoverWinSeed?: (
    commanders: ScryfallCard[],
    options: CedhSeedPackageOptionsV14,
  ) => Promise<Record<string, unknown>>;
  refineCandidate?: (
    decklist: string,
    options: CedhWorkflowOptionsV14,
  ) => Promise<Record<string, unknown>>;
}

interface BudgetAuditV15 {
  status: 'complete' | 'over-budget' | 'unknown-price' | 'unresolved';
  withinBudget: boolean;
  maxDeckUsd: number;
  auditedTotalUsd: number | null;
  overageUsd: number | null;
  unknownPriceEntries: string[];
  unresolvedEntries: string[];
}

interface CompliantCandidateV15 {
  cap: number;
  draft: Record<string, unknown>;
  decklist: string;
  audit: BudgetAuditV15;
  remainingStructuralDeficitTotal: number;
}

interface NameConstraintAuditV15 {
  valid: boolean;
  missingRequired: string[];
  excludedPresent: string[];
}

interface RefinementQualityV15 {
  acceptable: boolean;
  comboWasPreserved: boolean;
  winningComboCountPreserved: boolean;
  winningComboCoreCountPreserved: boolean;
  averageNonlandManaValueNonWorsened: boolean;
  protectionFloorPreserved: boolean;
  materialQualityImprovement: boolean;
  creatureTypeCoherenceImproved: boolean;
  recursionSaturationImproved: boolean;
  initialStatus: string;
  finalStatus: string;
  initialWinningCombos: number;
  finalWinningCombos: number;
  initialWinningComboCores: number;
  finalWinningComboCores: number;
  initialAverageNonlandManaValue: number | null;
  finalAverageNonlandManaValue: number | null;
  initialProtectionCount: number;
  finalProtectionCount: number;
  initialFreeInteractionCount: number;
  finalFreeInteractionCount: number;
  initialFastManaCount: number;
  finalFastManaCount: number;
  initialTutorCount: number;
  finalTutorCount: number;
}

function money(value: number): number {
  return Number(value.toFixed(2));
}

function selectedPrice(card: ScryfallCard): number | null {
  const values = [card.prices?.usd, card.prices?.usd_foil, card.prices?.usd_etched]
    .map((value) => value ? Number.parseFloat(value) : Number.NaN)
    .filter(Number.isFinite);
  return values.length > 0 ? Math.min(...values) : null;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nullableFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function entryKey(entry: DeckEntry): string {
  return `${entry.name.toLocaleLowerCase()}|${entry.set?.toLocaleLowerCase() ?? ''}|${entry.collectorNumber ?? ''}`;
}

function cardKey(card: ScryfallCard): string {
  return `${card.name.toLocaleLowerCase()}|${card.set.toLocaleLowerCase()}|${card.collector_number}`;
}

function allEntries(decklist: string): DeckEntry[] {
  const parsed = parseDecklist(decklist);
  return [...parsed.commanders, ...parsed.main];
}

function identifiers(entries: readonly DeckEntry[]): CardIdentifierInput[] {
  return entries.map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

function auditNameConstraintsV15(
  decklist: string,
  requiredCards: readonly string[],
  excludedCards: readonly string[],
): NameConstraintAuditV15 {
  const names = new Set(allEntries(decklist).map((entry) => normalize(entry.name)));
  const missingRequired = requiredCards.filter((name) => !names.has(normalize(name)));
  const excludedPresent = excludedCards.filter((name) => names.has(normalize(name)));
  return {
    valid: missingRequired.length === 0 && excludedPresent.length === 0,
    missingRequired,
    excludedPresent,
  };
}

async function auditExactDeckBudgetV15(
  decklist: string,
  maxDeckUsd: number,
  resolveDeckCards: (identifiers: CardIdentifierInput[]) => Promise<ResolveResultV15>,
): Promise<BudgetAuditV15> {
  const entries = allEntries(decklist);
  const resolved = await resolveDeckCards(identifiers(entries));
  const byExact = new Map(resolved.cards.map((card) => [cardKey(card), card]));
  const byName = new Map(resolved.cards.map((card) => [card.name.toLocaleLowerCase(), card]));
  const unresolvedEntries: string[] = [];
  const unknownPriceEntries: string[] = [];
  let total = 0;

  for (const entry of entries) {
    const exact = byExact.get(entryKey(entry));
    const card = exact ?? (!entry.set || !entry.collectorNumber ? byName.get(entry.name.toLocaleLowerCase()) : undefined);
    if (!card) {
      unresolvedEntries.push(`${entry.quantity} ${entry.name}${entry.set ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber ?? ''}` : ''}`.trim());
      continue;
    }
    const price = selectedPrice(card);
    if (price === null) {
      unknownPriceEntries.push(`${entry.quantity} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`);
      continue;
    }
    total += price * entry.quantity;
  }

  if (resolved.notFound.length > 0 || unresolvedEntries.length > 0) {
    return {
      status: 'unresolved',
      withinBudget: false,
      maxDeckUsd: money(maxDeckUsd),
      auditedTotalUsd: null,
      overageUsd: null,
      unknownPriceEntries,
      unresolvedEntries,
    };
  }
  if (unknownPriceEntries.length > 0) {
    return {
      status: 'unknown-price',
      withinBudget: false,
      maxDeckUsd: money(maxDeckUsd),
      auditedTotalUsd: null,
      overageUsd: null,
      unknownPriceEntries,
      unresolvedEntries: [],
    };
  }

  const auditedTotalUsd = money(total);
  const withinBudget = auditedTotalUsd <= maxDeckUsd + 1e-9;
  return {
    status: withinBudget ? 'complete' : 'over-budget',
    withinBudget,
    maxDeckUsd: money(maxDeckUsd),
    auditedTotalUsd,
    overageUsd: withinBudget ? 0 : money(auditedTotalUsd - maxDeckUsd),
    unknownPriceEntries: [],
    unresolvedEntries: [],
  };
}

function fixedCommanderEstimate(commanders: readonly ScryfallCard[]): number | null {
  let total = 0;
  for (const commander of commanders) {
    const price = selectedPrice(commander);
    if (price === null) return null;
    total += price;
  }
  return money(total);
}

function capSchedule(candidateBudgetUsd: number, optionalSlots: number, userPerCardCap: number | undefined): number[] {
  const upper = Math.min(candidateBudgetUsd, userPerCardCap ?? candidateBudgetUsd);
  const average = optionalSlots > 0 ? candidateBudgetUsd / optionalSlots : candidateBudgetUsd;
  const derived = [
    average * 1.5,
    average * 1.25,
    average,
    average * 0.8,
    candidateBudgetUsd / 40,
    candidateBudgetUsd / 20,
    candidateBudgetUsd / 10,
    upper,
  ]
    .filter((value) => value > 0 && value <= upper + 1e-9)
    .map((value) => Math.max(0.01, money(value)));
  return [...new Set(derived)];
}

function remainingStructuralDeficitTotal(draft: Record<string, unknown>): number {
  const deficits = draft.remainingRoleDeficits;
  if (!deficits || typeof deficits !== 'object' || Array.isArray(deficits)) return Number.POSITIVE_INFINITY;
  const values = Object.values(deficits)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .map((value) => Math.max(0, value));
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : Number.POSITIVE_INFINITY;
}

function strongerCompliantCandidate(left: CompliantCandidateV15, right: CompliantCandidateV15): number {
  if (left.remainingStructuralDeficitTotal !== right.remainingStructuralDeficitTotal) {
    return left.remainingStructuralDeficitTotal - right.remainingStructuralDeficitTotal;
  }
  return right.cap - left.cap;
}

function uniqueNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    const key = normalize(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }
  return output;
}

function refinementQualityV15(refinement: Record<string, unknown>): RefinementQualityV15 {
  const initial = record(refinement.initialAssessment);
  const final = record(refinement.finalAssessment);
  const stages = record(refinement.stages);
  const efficiency = record(stages.strictEfficiency);
  const initialMetrics = record(initial.metrics);
  const finalMetrics = record(final.metrics);
  const initialStatus = String(initial.status ?? 'unknown');
  const finalStatus = String(final.status ?? 'unknown');
  const initialWinningCombos = finiteNumber(initial.winningCombos);
  const finalWinningCombos = finiteNumber(final.winningCombos);
  const initialWinningComboCores = finiteNumber(initial.winningComboCoreCount, initialWinningCombos > 0 ? 1 : 0);
  const finalWinningComboCores = finiteNumber(final.winningComboCoreCount, finalWinningCombos > 0 ? 1 : 0);
  const initialAverageNonlandManaValue = nullableFiniteNumber(initialMetrics.averageNonlandManaValue);
  const finalAverageNonlandManaValue = nullableFiniteNumber(finalMetrics.averageNonlandManaValue);
  const initialProtectionCount = finiteNumber(initialMetrics.protectionCount);
  const finalProtectionCount = finiteNumber(finalMetrics.protectionCount);
  const protectionFloorPreserved = finalProtectionCount >= Math.min(initialProtectionCount, 4);
  const initialFreeInteractionCount = finiteNumber(initialMetrics.freeInteractionCount);
  const finalFreeInteractionCount = finiteNumber(finalMetrics.freeInteractionCount);
  const initialFastManaCount = finiteNumber(initialMetrics.fastManaCount);
  const finalFastManaCount = finiteNumber(finalMetrics.fastManaCount);
  const initialTutorCount = finiteNumber(initialMetrics.tutorCount);
  const finalTutorCount = finiteNumber(finalMetrics.tutorCount);
  const comboWasPreserved = refinement.comboWasPreserved === true;
  const winningComboCountPreserved = finalWinningCombos >= initialWinningCombos;
  const winningComboCoreCountPreserved = finalWinningComboCores >= initialWinningComboCores;
  const creatureTypeCoherenceImproved = efficiency.creatureTypeCoherenceImproved === true;
  const recursionSaturationImproved = efficiency.recursionSaturationImproved === true;
  const averageNonlandManaValueNonWorsened = initialAverageNonlandManaValue === null
    || (finalAverageNonlandManaValue !== null && finalAverageNonlandManaValue <= initialAverageNonlandManaValue + 1e-9);
  const materiallyLowerCurve = initialAverageNonlandManaValue !== null
    && finalAverageNonlandManaValue !== null
    && finalAverageNonlandManaValue < initialAverageNonlandManaValue - 0.009;
  const statusImproved = initialStatus !== 'strong-competitive-construction-signals'
    && finalStatus === 'strong-competitive-construction-signals';
  const materialQualityImprovement = materiallyLowerCurve
    || statusImproved
    || finalFreeInteractionCount > initialFreeInteractionCount
    || finalFastManaCount > initialFastManaCount
    || finalTutorCount > initialTutorCount
    || creatureTypeCoherenceImproved
    || recursionSaturationImproved;

  return {
    acceptable: comboWasPreserved
      && winningComboCoreCountPreserved
      && averageNonlandManaValueNonWorsened
      && protectionFloorPreserved
      && materialQualityImprovement,
    comboWasPreserved,
    winningComboCountPreserved,
    winningComboCoreCountPreserved,
    averageNonlandManaValueNonWorsened,
    protectionFloorPreserved,
    materialQualityImprovement,
    creatureTypeCoherenceImproved,
    recursionSaturationImproved,
    initialStatus,
    finalStatus,
    initialWinningCombos,
    finalWinningCombos,
    initialWinningComboCores,
    finalWinningComboCores,
    initialAverageNonlandManaValue,
    finalAverageNonlandManaValue,
    initialProtectionCount,
    finalProtectionCount,
    initialFreeInteractionCount,
    finalFreeInteractionCount,
    initialFastManaCount,
    finalFastManaCount,
    initialTutorCount,
    finalTutorCount,
  };
}

export async function buildCommanderDeckUnderWholeBudgetV15(
  commanders: ScryfallCard[],
  options: WholeDeckBudgetBuildOptionsV15,
  dependencies: WholeDeckBudgetDependenciesV15 = {},
): Promise<Record<string, unknown>> {
  if (!Number.isFinite(options.maxDeckUsd) || options.maxDeckUsd <= 0) {
    throw new Error('maxDeckUsd must be a positive finite whole-deck budget.');
  }
  if (options.maxUsdPerCard !== undefined && (!Number.isFinite(options.maxUsdPerCard) || options.maxUsdPerCard <= 0)) {
    throw new Error('maxUsdPerCard must be positive and finite when supplied.');
  }
  if (commanders.length < 1 || commanders.length > 2) throw new Error('Whole-deck budget building requires one or two resolved commanders.');

  const commanderEstimateUsd = fixedCommanderEstimate(commanders);
  const candidateBudgetUsd = Math.max(0.01, options.maxDeckUsd - (commanderEstimateUsd ?? 0));
  const optionalSlots = Math.max(1, 100 - commanders.length);
  const buildDraft = dependencies.buildDraft ?? buildCommanderDeckDraftV07;
  const resolveDeckCards = dependencies.resolveDeckCards ?? (async (ids: CardIdentifierInput[]) => getCardsByIdentifiers(ids));
  const discoverWinSeed = dependencies.discoverWinSeed ?? discoverCedhSeedWinPackageV14;
  const refineCandidate = dependencies.refineCandidate ?? refineCommanderForCedhV14;
  const targetBracket = Math.max(1, Math.min(5, Math.trunc(options.targetBracket ?? 4)));

  let autoWinSeed: Record<string, unknown> = {
    attempted: false,
    status: 'not-requested-for-target-bracket',
    seedNames: [],
  };
  let autoWinSeedNames: string[] = [];

  if (targetBracket >= 5) {
    const seedSearchCapUsd = Math.min(candidateBudgetUsd, options.maxUsdPerCard ?? candidateBudgetUsd);
    try {
      const discovered = await discoverWinSeed(commanders, {
        ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
        ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
        ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
        ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
        maxUsdPerCard: seedSearchCapUsd,
        maxPackageCards: 3,
        maxCandidatesToVerify: 20,
      });
      const discoveredSeedNames = uniqueNames(strings(discovered.seedNames));
      const excluded = new Set((options.excludedCards ?? []).map(normalize));
      const blockedCards = discoveredSeedNames.filter((name) => excluded.has(normalize(name)));
      if (discovered.status === 'eligible-winning-seed-package-found' && discoveredSeedNames.length > 0 && blockedCards.length === 0) {
        autoWinSeedNames = discoveredSeedNames;
        autoWinSeed = {
          ...discovered,
          attempted: true,
          seedNames: autoWinSeedNames,
          seedSearchCapUsd: money(seedSearchCapUsd),
        };
      } else if (discovered.status === 'eligible-winning-seed-package-found' && blockedCards.length > 0) {
        autoWinSeed = {
          ...discovered,
          attempted: true,
          status: 'winning-seed-package-blocked-by-exclusions',
          seedNames: [],
          blockedCards,
          seedSearchCapUsd: money(seedSearchCapUsd),
        };
      } else {
        autoWinSeed = {
          ...discovered,
          attempted: true,
          seedNames: [],
          seedSearchCapUsd: money(seedSearchCapUsd),
        };
      }
    } catch (error) {
      autoWinSeed = {
        attempted: true,
        status: 'seed-discovery-unavailable',
        seedNames: [],
        seedSearchCapUsd: money(seedSearchCapUsd),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const effectiveMustInclude = uniqueNames([...(options.mustInclude ?? []), ...autoWinSeedNames]);
  const caps = capSchedule(candidateBudgetUsd, optionalSlots, options.maxUsdPerCard);
  const attempts: Array<Record<string, unknown>> = [];
  const compliantCandidates: CompliantCandidateV15[] = [];
  let cheapestAuditedTotal: number | null = null;

  for (const cap of caps) {
    const draftOptions: DeckBuildOptionsV07 = {
      ...options,
      ...(effectiveMustInclude.length > 0 ? { mustInclude: effectiveMustInclude } : {}),
      candidateMaxUsdPerCard: cap,
    };
    const draft = await buildDraft(commanders, draftOptions);
    const draftStatus = String(draft.status ?? 'unknown');
    const decklist = typeof draft.decklist === 'string' ? draft.decklist : '';
    if (draftStatus !== 'complete-draft' || !decklist.trim()) {
      attempts.push({
        candidateMaxUsdPerCard: cap,
        userMaxUsdPerCard: options.maxUsdPerCard ?? null,
        buildStatus: draftStatus,
        auditStatus: 'not-a-complete-draft',
        auditedTotalUsd: null,
      });
      continue;
    }

    const nameConstraints = auditNameConstraintsV15(decklist, effectiveMustInclude, options.excludedCards ?? []);
    if (!nameConstraints.valid) {
      attempts.push({
        candidateMaxUsdPerCard: cap,
        userMaxUsdPerCard: options.maxUsdPerCard ?? null,
        buildStatus: draftStatus,
        auditStatus: 'hard-card-constraint-failure',
        auditedTotalUsd: null,
        nameConstraints,
      });
      continue;
    }

    const remainingDeficitTotal = remainingStructuralDeficitTotal(draft);
    const audit = await auditExactDeckBudgetV15(decklist, options.maxDeckUsd, resolveDeckCards);
    if (audit.auditedTotalUsd !== null) {
      cheapestAuditedTotal = cheapestAuditedTotal === null ? audit.auditedTotalUsd : Math.min(cheapestAuditedTotal, audit.auditedTotalUsd);
    }
    attempts.push({
      candidateMaxUsdPerCard: cap,
      userMaxUsdPerCard: options.maxUsdPerCard ?? null,
      buildStatus: draftStatus,
      auditStatus: audit.status,
      auditedTotalUsd: audit.auditedTotalUsd,
      overageUsd: audit.overageUsd,
      remainingStructuralDeficitTotal: Number.isFinite(remainingDeficitTotal) ? remainingDeficitTotal : null,
      unknownPriceEntries: audit.unknownPriceEntries,
      unresolvedEntries: audit.unresolvedEntries,
      nameConstraints,
    });

    if (audit.withinBudget) {
      compliantCandidates.push({
        cap,
        draft,
        decklist,
        audit,
        remainingStructuralDeficitTotal: remainingDeficitTotal,
      });
    }
  }

  if (compliantCandidates.length > 0) {
    compliantCandidates.sort(strongerCompliantCandidate);
    const selected = compliantCandidates[0] as CompliantCandidateV15;
    let finalDecklist = selected.decklist;
    let finalBudgetAudit = selected.audit;
    let postBudgetRefinement: Record<string, unknown> = {
      attempted: false,
      status: 'not-requested-for-target-bracket',
    };

    if (targetBracket >= 5) {
      const refinementSearchCapUsd = Math.min(selected.cap, options.maxUsdPerCard ?? selected.cap);
      try {
        const refinement = await refineCandidate(selected.decklist, {
          ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
          ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
          ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
          ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
          maxUsdPerCard: refinementSearchCapUsd,
          ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
          ...(options.creatureTypeOptimization !== undefined ? { creatureTypeOptimization: options.creatureTypeOptimization } : {}),
          protectedCards: effectiveMustInclude,
          requireVerifiedCombo: true,
          maxEfficiencySwaps: 10,
          maxManaBaseSwaps: 8,
        });
        const refinedDecklist = typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist : '';
        const quality = refinementQualityV15(refinement);
        const nameConstraints = refinedDecklist.trim()
          ? auditNameConstraintsV15(refinedDecklist, effectiveMustInclude, options.excludedCards ?? [])
          : { valid: false, missingRequired: effectiveMustInclude, excludedPresent: [] };
        if (!refinedDecklist.trim()) {
          postBudgetRefinement = {
            attempted: true,
            status: 'rejected-no-final-decklist',
            refinementSearchCapUsd: money(refinementSearchCapUsd),
            quality,
            nameConstraints,
            refinement,
          };
        } else if (!nameConstraints.valid) {
          postBudgetRefinement = {
            attempted: true,
            status: 'rejected-hard-card-constraints',
            refinementSearchCapUsd: money(refinementSearchCapUsd),
            quality,
            nameConstraints,
            refinement,
          };
        } else if (!quality.acceptable) {
          postBudgetRefinement = {
            attempted: true,
            status: 'rejected-no-material-safe-improvement',
            refinementSearchCapUsd: money(refinementSearchCapUsd),
            quality,
            nameConstraints,
            refinement,
          };
        } else {
          const refinedAudit = await auditExactDeckBudgetV15(refinedDecklist, options.maxDeckUsd, resolveDeckCards);
          if (refinedAudit.withinBudget) {
            finalDecklist = refinedDecklist;
            finalBudgetAudit = refinedAudit;
            postBudgetRefinement = {
              attempted: true,
              status: 'accepted',
              refinementSearchCapUsd: money(refinementSearchCapUsd),
              quality,
              nameConstraints,
              budgetAudit: refinedAudit,
              refinement,
            };
          } else {
            postBudgetRefinement = {
              attempted: true,
              status: 'rejected-hard-budget',
              refinementSearchCapUsd: money(refinementSearchCapUsd),
              quality,
              nameConstraints,
              budgetAudit: refinedAudit,
              refinement,
            };
          }
        }
      } catch (error) {
        postBudgetRefinement = {
          attempted: true,
          status: 'refinement-unavailable',
          refinementSearchCapUsd: money(refinementSearchCapUsd),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      status: 'budget-compliant',
      maxDeckUsd: money(options.maxDeckUsd),
      estimatedFixedCommanderCostUsd: commanderEstimateUsd,
      remainingCandidateBudgetEstimateUsd: money(candidateBudgetUsd),
      chosenCandidateSearchCapUsd: selected.cap,
      userMaxUsdPerCard: options.maxUsdPerCard ?? null,
      creatureTypeOptimization: options.creatureTypeOptimization ?? true,
      budgetAudit: finalBudgetAudit,
      attempts,
      compliantCandidateCount: compliantCandidates.length,
      selectionBasis: 'fewest remaining structural deficits, then widest candidate search cap',
      selectedRemainingStructuralDeficitTotal: Number.isFinite(selected.remainingStructuralDeficitTotal)
        ? selected.remainingStructuralDeficitTotal
        : null,
      autoWinSeed,
      postBudgetRefinement,
      draft: selected.draft,
      baseDecklist: selected.decklist,
      decklist: finalDecklist,
      constraint: `US$${money(options.maxDeckUsd)} maximum total deck budget`,
      caveat: 'Whole-deck compliance is based on an independent exact-printing price audit of every deck quantity. Explicit exclusions and required cards are rechecked after draft selection and again after every accepted refinement; later win-package or efficiency stages cannot silently override them. The search compares every generated budget-compliant draft rather than stopping at the first cheap fit. Candidate quality is ordered by remaining structural deficits and then by the widest legal candidate search cap; raw spend is never treated as power by itself. Bracket-5 whole-budget construction attempts a broader generic verified Commander Spellbook win-seed search, then routes the selected legal draft through strict efficiency and mana-base refinement. A refined list is accepted only when its independent winning-combo cores are preserved, its average nonland mana value does not worsen, its protection floor is preserved, at least one material high-power signal improves, and a second independent exact-printing whole-deck audit still passes the original hard budget. Creature-type optimization can be explicitly disabled when the requested construction objective has no tribal component. The search remains heuristic rather than proof of the globally strongest possible list.',
    };
  }

  return {
    status: 'budget-infeasible',
    maxDeckUsd: money(options.maxDeckUsd),
    estimatedFixedCommanderCostUsd: commanderEstimateUsd,
    remainingCandidateBudgetEstimateUsd: money(candidateBudgetUsd),
    userMaxUsdPerCard: options.maxUsdPerCard ?? null,
    budgetAudit: null,
    attempts,
    autoWinSeed,
    cheapestAuditedCompleteAttemptUsd: cheapestAuditedTotal,
    constraint: `US$${money(options.maxDeckUsd)} maximum total deck budget`,
    guidance: cheapestAuditedTotal === null
      ? 'The current builder could not produce a fully resolved, fully priced 100-card candidate under the requested hard budget. It cannot honestly claim budget compliance or that the budget ceiling itself is mathematically impossible for every conceivable deck.'
      : `The cheapest fully priced complete candidate found was US$${money(cheapestAuditedTotal)}, above the US$${money(options.maxDeckUsd)} hard cap. The current search therefore cannot honestly claim a compliant deck; this is a search result, not proof that no possible Commander deck exists under the cap.`,
  };
}
