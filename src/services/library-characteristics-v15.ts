import type { ScryfallCard } from '../types/scryfall.js';

const FRONT_FACE_ONLY_LAYOUTS = new Set([
  'transform',
  'modal_dfc',
  'reversible_card',
  'adventure',
  'flip',
  'meld',
]);

/**
 * Returns the type line that a card actually presents while it is in the library.
 *
 * Multi-face cards do not all behave the same way in hidden zones. Transforming/modal
 * double-faced cards, Adventure cards, flip cards, and similar front/back layouts use the
 * front face's characteristics in the library. Split cards are intentionally not collapsed:
 * their combined characteristics remain represented by Scryfall's top-level type line.
 */
export function libraryVisibleTypeLineV15(card: ScryfallCard): string {
  const layout = card.layout?.toLocaleLowerCase() ?? '';
  if (FRONT_FACE_ONLY_LAYOUTS.has(layout)) {
    return card.card_faces?.[0]?.type_line ?? card.type_line.split(' // ')[0]?.trim() ?? card.type_line;
  }
  return card.type_line;
}

export function libraryTypeHasV15(card: ScryfallCard, token: string): boolean {
  return libraryVisibleTypeLineV15(card).toLocaleLowerCase().includes(token.toLocaleLowerCase());
}
