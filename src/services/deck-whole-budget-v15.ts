import type { ScryfallCard } from '../types/scryfall.js';
import { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';
import { parseDecklist, type DeckEntry } from './deck.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from './scryfall.js';

export interface WholeDeckBudgetBuildOptionsV15 extends DeckBuildOptionsV07 {
  maxDeckUsd: number;
}

interface ResolveResultV15 {
  cards: ScryfallCard[];
  notFound: unknown[];
}

export interface WholeDeckBudgetDependenciesV15 {
  buildDraft?: (commanders: ScryfallCard[], options: DeckBuildOptionsV07) => Promise<Record<string, unknown>>;
  resolveDeckCards?: (identifiers: CardIdentifierInput[]) => Promise<ResolveResultV15>;
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

function money(value: number): number {
  return Number(value.toFixed(2));
}

function selectedPrice(card: ScryfallCard): number | null {
  const values = [card.prices?.usd, card.prices?.usd_foil, card.prices?.usd_etched]
    .map((value) => value ? Number.parseFloat(value) : Number.NaN)
    .filter(Number.isFinite);
  return values.length > 0 ? Math.min(...values) : null;
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
    upper,
    candidateBudgetUsd / 10,
    candidateBudgetUsd / 20,
    candidateBudgetUsd / 40,
    candidateBudgetUsd / 60,
    candidateBudgetUsd / 80,
    average * 1.5,
    average * 1.25,
    average,
    average * 0.8,
  ]
    .filter((value) => value > 0 && value <= upper + 1e-9)
    .map((value) => Math.max(0.01, money(value)));
  return [...new Set(derived)].sort((a, b) => b - a);
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
  const caps = capSchedule(candidateBudgetUsd, optionalSlots, options.maxUsdPerCard);
  const attempts: Array<Record<string, unknown>> = [];
  let cheapestAuditedTotal: number | null = null;

  for (const cap of caps) {
    const draftOptions: DeckBuildOptionsV07 = {
      ...options,
      // Preserve the user's explicit per-card cap as the hard required-card rule.
      maxUsdPerCard: options.maxUsdPerCard,
      // Internal whole-deck search pressure applies only to optional candidates/lands.
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
      unknownPriceEntries: audit.unknownPriceEntries,
      unresolvedEntries: audit.unresolvedEntries,
    });

    if (audit.withinBudget) {
      return {
        status: 'budget-compliant',
        maxDeckUsd: money(options.maxDeckUsd),
        estimatedFixedCommanderCostUsd: commanderEstimateUsd,
        remainingCandidateBudgetEstimateUsd: money(candidateBudgetUsd),
        chosenCandidateSearchCapUsd: cap,
        userMaxUsdPerCard: options.maxUsdPerCard ?? null,
        budgetAudit: audit,
        attempts,
        draft,
        decklist,
        constraint: `US$${money(options.maxDeckUsd)} maximum total deck budget`,
        caveat: 'Whole-deck compliance is based on an independent exact-printing price audit of every deck quantity. Commander cost is treated as fixed budget pressure for the search heuristic; internally generated candidate caps never become a fake commander price rule. The search remains heuristic and is not proof of the globally strongest possible list under the same budget.',
      };
    }
  }

  return {
    status: 'budget-infeasible',
    maxDeckUsd: money(options.maxDeckUsd),
    estimatedFixedCommanderCostUsd: commanderEstimateUsd,
    remainingCandidateBudgetEstimateUsd: money(candidateBudgetUsd),
    userMaxUsdPerCard: options.maxUsdPerCard ?? null,
    budgetAudit: null,
    attempts,
    cheapestAuditedCompleteAttemptUsd: cheapestAuditedTotal,
    constraint: `US$${money(options.maxDeckUsd)} maximum total deck budget`,
    guidance: cheapestAuditedTotal === null
      ? 'The current builder could not produce a fully resolved, fully priced 100-card candidate under the requested hard budget. It cannot honestly claim budget compliance or that the budget ceiling itself is mathematically impossible for every conceivable deck.'
      : `The cheapest fully priced complete candidate found was US$${money(cheapestAuditedTotal)}, above the US$${money(options.maxDeckUsd)} hard cap. The current search therefore cannot honestly claim a compliant deck; this is a search result, not proof that no possible Commander deck exists under the cap.`,
  };
}
