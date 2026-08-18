import type { ScryfallCard } from '../types/scryfall.js';
import { resolveEntryCard, type DeckFinish, type ParsedDeck } from './deck.js';

export interface ExactPrintingPriceChoiceV15 {
  finish: DeckFinish;
  priceUsd: number;
}

export interface ExactPrintingBudgetWitnessV15 {
  card: {
    name: string;
    set: string;
    collectorNumber: string;
  };
  requestedFinish: DeckFinish | null;
  finish: DeckFinish | null;
  priceUsd: number | null;
  maxUsdPerCard: number;
  status: 'within-cap' | 'over-cap' | 'price-unavailable' | 'finish-unavailable';
  knownPrices: ExactPrintingPriceChoiceV15[];
}

export interface ExactPerCardBudgetAuditEntryV15 {
  line: string;
  quantity: number;
  name: string;
  set: string | null;
  collectorNumber: string | null;
  requestedFinish: DeckFinish | null;
  finish: DeckFinish | null;
  priceUsd: number | null;
  status: ExactPrintingBudgetWitnessV15['status'] | 'unresolved';
}

export interface ExactPerCardBudgetAuditV15 {
  status: 'not-requested' | 'compliant' | 'over-cap' | 'price-unavailable' | 'finish-unavailable' | 'unresolved';
  satisfied: boolean;
  maxUsdPerCard: number | null;
  auditedEntries: ExactPerCardBudgetAuditEntryV15[];
  overCapEntries: ExactPerCardBudgetAuditEntryV15[];
  unknownPriceEntries: ExactPerCardBudgetAuditEntryV15[];
  unavailableFinishEntries: ExactPerCardBudgetAuditEntryV15[];
  unresolvedEntries: ExactPerCardBudgetAuditEntryV15[];
}

const FINISH_ORDER: Record<DeckFinish, number> = { nonfoil: 0, foil: 1, etched: 2 };

function parsePrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function validateCap(maxUsdPerCard: number): number {
  if (!Number.isFinite(maxUsdPerCard) || maxUsdPerCard <= 0) {
    throw new Error('maxUsdPerCard must be positive and finite when supplied.');
  }
  return maxUsdPerCard;
}

function declaredFinishes(card: ScryfallCard): Set<DeckFinish> {
  const supported = new Set<DeckFinish>();
  for (const finish of card.finishes ?? []) {
    const normalized = finish.trim().toLocaleLowerCase();
    if (normalized === 'nonfoil' || normalized === 'foil' || normalized === 'etched') supported.add(normalized);
  }
  return supported;
}

export function exactPrintingPriceChoicesV15(card: ScryfallCard): ExactPrintingPriceChoiceV15[] {
  const declared = declaredFinishes(card);
  const candidates: Array<{ finish: DeckFinish; priceUsd: number | null }> = [
    { finish: 'nonfoil', priceUsd: parsePrice(card.prices?.usd) },
    { finish: 'foil', priceUsd: parsePrice(card.prices?.usd_foil) },
    { finish: 'etched', priceUsd: parsePrice(card.prices?.usd_etched) },
  ];
  return candidates
    .filter((choice): choice is ExactPrintingPriceChoiceV15 =>
      choice.priceUsd !== null && (declared.size === 0 || declared.has(choice.finish)))
    .sort((a, b) => a.priceUsd - b.priceUsd || FINISH_ORDER[a.finish] - FINISH_ORDER[b.finish]);
}

export function exactPrintingBudgetWitnessV15(
  card: ScryfallCard,
  maxUsdPerCard: number,
  requestedFinish?: DeckFinish,
): ExactPrintingBudgetWitnessV15 {
  const cap = validateCap(maxUsdPerCard);
  const knownPrices = exactPrintingPriceChoicesV15(card);
  const declared = declaredFinishes(card);
  const base = {
    card: {
      name: card.name,
      set: card.set.toUpperCase(),
      collectorNumber: card.collector_number,
    },
    requestedFinish: requestedFinish ?? null,
    maxUsdPerCard: cap,
    knownPrices,
  };

  if (requestedFinish && declared.size > 0 && !declared.has(requestedFinish)) {
    return { ...base, finish: null, priceUsd: null, status: 'finish-unavailable' };
  }
  const eligible = requestedFinish
    ? knownPrices.filter((choice) => choice.finish === requestedFinish)
    : knownPrices;
  const choice = eligible[0];
  if (!choice) return { ...base, finish: requestedFinish ?? null, priceUsd: null, status: 'price-unavailable' };
  return {
    ...base,
    finish: choice.finish,
    priceUsd: choice.priceUsd,
    status: choice.priceUsd <= cap + 1e-9 ? 'within-cap' : 'over-cap',
  };
}

export function exactPrintingWithinCapV15(card: ScryfallCard, maxUsdPerCard: number): boolean {
  return exactPrintingBudgetWitnessV15(card, maxUsdPerCard).status === 'within-cap';
}

function entryLine(entry: ParsedDeck['main'][number]): string {
  const printing = entry.set ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber ?? ''}` : '';
  const finish = entry.finish === 'foil' ? ' *F*' : entry.finish === 'etched' ? ' *E*' : entry.finish === 'nonfoil' ? ' *N*' : '';
  return `${entry.quantity} ${entry.name}${printing}${finish}`.trim();
}

export function auditExactPerCardBudgetV15(
  parsed: ParsedDeck,
  cards: readonly ScryfallCard[],
  maxUsdPerCard?: number,
): ExactPerCardBudgetAuditV15 {
  if (maxUsdPerCard === undefined) {
    return {
      status: 'not-requested',
      satisfied: true,
      maxUsdPerCard: null,
      auditedEntries: [],
      overCapEntries: [],
      unknownPriceEntries: [],
      unavailableFinishEntries: [],
      unresolvedEntries: [],
    };
  }
  const cap = validateCap(maxUsdPerCard);
  const auditedEntries: ExactPerCardBudgetAuditEntryV15[] = [];
  for (const entry of [...parsed.commanders, ...parsed.main]) {
    const card = resolveEntryCard(entry, [...cards]);
    if (!card) {
      auditedEntries.push({
        line: entryLine(entry),
        quantity: entry.quantity,
        name: entry.name,
        set: entry.set ?? null,
        collectorNumber: entry.collectorNumber ?? null,
        requestedFinish: entry.finish ?? null,
        finish: null,
        priceUsd: null,
        status: 'unresolved',
      });
      continue;
    }
    const witness = exactPrintingBudgetWitnessV15(card, cap, entry.finish);
    auditedEntries.push({
      line: entryLine(entry),
      quantity: entry.quantity,
      name: card.name,
      set: card.set.toUpperCase(),
      collectorNumber: card.collector_number,
      requestedFinish: entry.finish ?? null,
      finish: witness.finish,
      priceUsd: witness.priceUsd,
      status: witness.status,
    });
  }
  const unresolvedEntries = auditedEntries.filter((entry) => entry.status === 'unresolved');
  const unavailableFinishEntries = auditedEntries.filter((entry) => entry.status === 'finish-unavailable');
  const unknownPriceEntries = auditedEntries.filter((entry) => entry.status === 'price-unavailable');
  const overCapEntries = auditedEntries.filter((entry) => entry.status === 'over-cap');
  const status: ExactPerCardBudgetAuditV15['status'] = unresolvedEntries.length > 0
    ? 'unresolved'
    : unavailableFinishEntries.length > 0
      ? 'finish-unavailable'
      : unknownPriceEntries.length > 0
        ? 'price-unavailable'
        : overCapEntries.length > 0
          ? 'over-cap'
          : 'compliant';
  return {
    status,
    satisfied: status === 'compliant',
    maxUsdPerCard: cap,
    auditedEntries,
    overCapEntries,
    unknownPriceEntries,
    unavailableFinishEntries,
    unresolvedEntries,
  };
}
