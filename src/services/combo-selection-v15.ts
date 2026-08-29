import type { ScryfallCard } from '../types/scryfall.js';
import { libraryTypeHasV15 } from './library-characteristics-v15.js';
import { getCardOracleText } from './scryfall.js';

export interface BoundedComboSelectionAccessV15 {
  selectorName: string;
  pieceName: string;
  matched: boolean;
  depth: number | null;
  restriction: string | null;
  reason: string;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function typeHas(card: ScryfallCard, token: string): boolean {
  return libraryTypeHasV15(card, token);
}

function selectionDepth(text: string): number | null {
  const match = text.match(/(?:look at|reveal) the top (one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards?/);
  if (!match?.[1]) return null;
  return /^\d+$/.test(match[1]) ? Number(match[1]) : NUMBER_WORDS[match[1]] ?? null;
}

function restrictionFor(text: string): string {
  const restrictions: Array<[RegExp, string]> = [
    [/artifact, creature, or land card|artifact, creature, and\/or land card/, 'artifact-creature-land'],
    [/legendary creature card/, 'legendary-creature'],
    [/creature card/, 'creature'],
    [/artifact card/, 'artifact'],
    [/enchantment card/, 'enchantment'],
    [/instant card/, 'instant'],
    [/sorcery card/, 'sorcery'],
    [/land card/, 'land'],
  ];
  return restrictions.find(([pattern]) => pattern.test(text))?.[1] ?? 'unrestricted';
}

function piecePassesRestriction(piece: ScryfallCard, restriction: string): boolean {
  if (restriction === 'unrestricted') return true;
  if (restriction === 'artifact-creature-land') return typeHas(piece, 'artifact') || typeHas(piece, 'creature') || typeHas(piece, 'land');
  if (restriction === 'legendary-creature') return typeHas(piece, 'legendary') && typeHas(piece, 'creature');
  return typeHas(piece, restriction);
}

/**
 * Conservative bounded top-of-library selection evidence. This is intentionally distinct from
 * deterministic tutoring: it only credits explicit top-N inspection/reveal that can move a
 * qualifying card into hand.
 */
export function boundedComboSelectionAccessV15(selector: ScryfallCard, piece: ScryfallCard): BoundedComboSelectionAccessV15 {
  const text = getCardOracleText(selector).replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  const depth = selectionDepth(text);
  if (!depth) {
    return { selectorName: selector.name, pieceName: piece.name, matched: false, depth: null, restriction: null, reason: 'no bounded top-of-library selection clause' };
  }

  const movesToHand = /(?:put|choose|reveal)[^.]{0,220}(?:into your hand|put it into your hand|put that card into your hand)/.test(text)
    || /put (?:one|two|three|four|five|\d+) of them into your hand/.test(text);
  if (!movesToHand) {
    return { selectorName: selector.name, pieceName: piece.name, matched: false, depth, restriction: null, reason: 'bounded selection does not clearly move a selected card to hand' };
  }

  const restriction = restrictionFor(text);
  const matched = piecePassesRestriction(piece, restriction);
  return {
    selectorName: selector.name,
    pieceName: piece.name,
    matched,
    depth,
    restriction,
    reason: matched ? `piece passes ${restriction} top-${depth} selection` : `piece fails ${restriction} restriction`,
  };
}

export function auditBoundedComboSelectionV15(selectors: readonly ScryfallCard[], comboPieces: readonly ScryfallCard[]): Record<string, unknown> {
  const matrix = selectors.flatMap((selector) => comboPieces.map((piece) => boundedComboSelectionAccessV15(selector, piece)));
  return {
    selectors: selectors.map((selector) => ({
      selector: selector.name,
      hits: matrix.filter((entry) => entry.selectorName === selector.name && entry.matched).map((entry) => entry.pieceName),
      depth: Math.max(0, ...matrix.filter((entry) => entry.selectorName === selector.name && entry.matched).map((entry) => entry.depth ?? 0)),
    })).filter((entry) => entry.hits.length > 0),
    matrix,
    note: 'Bounded top-of-library selection only; these cards improve access but are not deterministic tutors.',
  };
}
