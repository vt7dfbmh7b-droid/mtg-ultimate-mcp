import type { ScryfallCard } from '../types/scryfall.js';
import { resolveEntryCard, type DeckEntry, type ParsedDeck } from './deck.js';

export interface ResolvedDeckSlotV15 {
  section: 'commander' | 'main';
  slot: number;
  copy: number;
  entry: DeckEntry;
  card: ScryfallCard;
}

export interface ExpandedDeckSlotsV15 {
  commanders: ResolvedDeckSlotV15[];
  main: ResolvedDeckSlotV15[];
  all: ResolvedDeckSlotV15[];
  unresolved: Array<{ section: 'commander' | 'main'; entry: DeckEntry }>;
}

function expandSection(
  section: 'commander' | 'main',
  entries: readonly DeckEntry[],
  cards: ScryfallCard[],
): { slots: ResolvedDeckSlotV15[]; unresolved: Array<{ section: 'commander' | 'main'; entry: DeckEntry }> } {
  const slots: ResolvedDeckSlotV15[] = [];
  const unresolved: Array<{ section: 'commander' | 'main'; entry: DeckEntry }> = [];
  let slot = 0;

  for (const entry of entries) {
    const card = resolveEntryCard(entry, cards);
    if (!card) {
      unresolved.push({ section, entry });
      continue;
    }
    for (let copy = 1; copy <= entry.quantity; copy += 1) {
      slot += 1;
      slots.push({ section, slot, copy, entry, card });
    }
  }

  return { slots, unresolved };
}

/**
 * Expands deduplicated resolved card data back into physical deck slots using parsed quantities.
 * Scryfall identifier resolution intentionally deduplicates repeated identifiers, so callers that
 * reason about the actual 99 must use this boundary instead of assuming resolved-card length is
 * equal to physical deck size.
 */
export function expandResolvedDeckSlotsV15(parsed: ParsedDeck, cards: ScryfallCard[]): ExpandedDeckSlotsV15 {
  const commanders = expandSection('commander', parsed.commanders, cards);
  const main = expandSection('main', parsed.main, cards);
  return {
    commanders: commanders.slots,
    main: main.slots,
    all: [...commanders.slots, ...main.slots],
    unresolved: [...commanders.unresolved, ...main.unresolved],
  };
}
