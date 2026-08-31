import type { ScryfallCard } from '../types/scryfall.js';
import { resolveEntryCard, type ParsedDeck } from './deck.js';
import { effectiveCardRolesV15 } from './card-role-truth-v15.js';

export function effectiveDeckRoleCountsV15(parsed: ParsedDeck, cards: ScryfallCard[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of [...parsed.commanders, ...parsed.main]) {
    const card = resolveEntryCard(entry, cards);
    if (!card) continue;
    for (const role of effectiveCardRolesV15(card)) {
      counts[role] = (counts[role] ?? 0) + entry.quantity;
    }
  }
  return counts;
}

export function effectiveFastManaCountV15(parsed: ParsedDeck, cards: ScryfallCard[]): number {
  return Number(effectiveDeckRoleCountsV15(parsed, cards)['fast mana'] ?? 0);
}
