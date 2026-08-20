import type { ScryfallCard } from '../types/scryfall.js';
import type { DeckEntry, ParsedDeck } from './deck.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  selectEligiblePrintingV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';

function normalizedCollector(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/^0+/, '') || '0';
}

function findResolvedCard(entry: DeckEntry, cards: ScryfallCard[]): ScryfallCard | null {
  const name = entry.name.toLocaleLowerCase();
  if (entry.set && entry.collectorNumber) {
    const set = entry.set.toLocaleLowerCase();
    const collector = normalizedCollector(entry.collectorNumber);
    const exact = cards.find((card) =>
      card.name.toLocaleLowerCase() === name
      && card.set.toLocaleLowerCase() === set
      && normalizedCollector(card.collector_number) === collector,
    );
    if (exact) return exact;
  }
  return cards.find((card) => card.name.toLocaleLowerCase() === name) ?? null;
}

function finishTag(finish: 'nonfoil' | 'foil' | 'etched' | null): string {
  if (finish === 'foil') return ' *F*';
  if (finish === 'etched') return ' *E*';
  if (finish === 'nonfoil') return ' *N*';
  return '';
}

function line(quantity: number, card: ScryfallCard, finish: 'nonfoil' | 'foil' | 'etched' | null): string {
  return `${quantity} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}${finishTag(finish)}`;
}

export async function normalizeDeckToPrintingPolicyV08(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard?: number,
): Promise<Record<string, unknown>> {
  const cache = new Map<string, Awaited<ReturnType<typeof selectEligiblePrintingV08>>>();
  const unavailable: Array<Record<string, unknown>> = [];
  const replacements: Array<Record<string, unknown>> = [];

  const normalizeEntries = async (entries: DeckEntry[]): Promise<string[]> => {
    const lines: string[] = [];
    for (const entry of entries) {
      const current = findResolvedCard(entry, cards);
      if (!current) {
        unavailable.push({ name: entry.name, reason: 'Card could not be resolved.' });
        continue;
      }

      const cacheKey = `${current.name.toLocaleLowerCase()}|${maxUsdPerCard ?? 'any'}`;
      let choice = cache.get(cacheKey);
      if (choice === undefined) {
        choice = await selectEligiblePrintingV08(current, policy, maxUsdPerCard);
        cache.set(cacheKey, choice);
      }
      if (!choice) {
        unavailable.push({
          name: current.name,
          currentPrinting: `${current.set.toUpperCase()} ${current.collector_number}`,
          reason: 'No physical printing satisfies the active printing-family/set/promo/price policy.',
        });
        continue;
      }

      const currentMatches = printingMatchesPolicyV08(current, policy)
        && (maxUsdPerCard === undefined || choice.card.id === current.id);
      if (!currentMatches || current.id !== choice.card.id) {
        replacements.push({
          name: current.name,
          from: `${current.set.toUpperCase()} ${current.collector_number}`,
          to: `${choice.card.set.toUpperCase()} ${choice.card.collector_number}`,
          finish: choice.finish,
          priceUsd: choice.priceUsd,
          familyMatch: choice.matchedBy,
          promo: Boolean(choice.card.promo),
          promoTypes: choice.card.promo_types ?? [],
          flavorName: choice.card.flavor_name ?? null,
        });
      }
      lines.push(line(entry.quantity, choice.card, choice.finish));
    }
    return lines;
  };

  const commanderLines = await normalizeEntries(parsed.commanders);
  const mainLines = await normalizeEntries(parsed.main);
  const decklist = ['// COMMANDER', ...commanderLines, '', '// MAIN', ...mainLines].join('\n');

  return {
    status: unavailable.length === 0 ? 'printing-policy-satisfied' : 'printing-policy-incomplete',
    decklist,
    replacements,
    unavailable,
    printingPolicy: describePrintingPolicyV08(policy),
    explanation:
      unavailable.length === 0
        ? 'Every card line now points to a physical printing that satisfies the active printing policy.'
        : 'Some Oracle cards have no qualifying physical printing under the requested policy. They must be replaced with different cards rather than silently using an unrelated edition.',
  };
}

export function auditResolvedDeckPrintingPolicyV08(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  policy: ResolvedPrintingPolicyV08,
): Record<string, unknown> {
  const entries = [
    ...parsed.commanders.map((entry) => ({ section: 'commander' as const, entry })),
    ...parsed.main.map((entry) => ({ section: 'main' as const, entry })),
  ];
  const violations: Array<Record<string, unknown>> = [];
  const compliant: Array<Record<string, unknown>> = [];

  for (const { section, entry } of entries) {
    const card = findResolvedCard(entry, cards);
    if (!card) {
      violations.push({ section, name: entry.name, reason: 'unresolved' });
      continue;
    }
    const record = {
      section,
      name: card.name,
      set: card.set.toUpperCase(),
      collectorNumber: card.collector_number,
      promo: Boolean(card.promo),
      promoTypes: card.promo_types ?? [],
      flavorName: card.flavor_name ?? null,
    };
    if (printingMatchesPolicyV08(card, policy)) compliant.push(record);
    else violations.push({ ...record, reason: 'printing does not belong to the active family/set policy' });
  }

  return {
    compliantCount: compliant.length,
    violationCount: violations.length,
    compliant,
    violations,
    printingPolicy: describePrintingPolicyV08(policy),
  };
}
