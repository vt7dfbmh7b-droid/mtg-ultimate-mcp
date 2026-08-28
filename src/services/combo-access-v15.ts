import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText } from './scryfall.js';

export interface ComboTutorAccessV15 {
  tutorName: string;
  pieceName: string;
  deterministic: boolean;
  matchedClause: string | null;
  reason: string;
}

function normalize(value: string): string { return value.trim().toLocaleLowerCase(); }
function typeHas(card: ScryfallCard, token: string): boolean { return card.type_line.toLocaleLowerCase().includes(token); }
function nameMatches(card: ScryfallCard, name: string): boolean {
  return normalize(card.name).split(' // ').some((part) => part === normalize(name));
}

function clauseMatchesPiece(clause: string, piece: ScryfallCard): { matched: boolean; reason: string } {
  const text = clause.toLocaleLowerCase();
  const named = text.match(/card named ([^,.;]+)/i)?.[1]?.trim();
  if (named && !nameMatches(piece, named)) return { matched: false, reason: `name-restricted to ${named}` };

  const typeRestrictions: Array<[RegExp, string]> = [
    [/\bequipment card\b/, 'equipment'],
    [/\bvehicle card\b/, 'vehicle'],
    [/\bartifact card\b/, 'artifact'],
    [/\benchantment card\b/, 'enchantment'],
    [/\bcreature card\b/, 'creature'],
    [/\binstant card\b/, 'instant'],
    [/\bsorcery card\b/, 'sorcery'],
    [/\bplaneswalker card\b/, 'planeswalker'],
    [/\bbasic land card\b/, 'basic land'],
    [/\bland card\b/, 'land'],
  ];
  for (const [pattern, type] of typeRestrictions) {
    if (pattern.test(text) && !typeHas(piece, type)) return { matched: false, reason: `requires ${type}` };
  }

  if (/\blegendary creature card\b/.test(text) && !(typeHas(piece, 'legendary') && typeHas(piece, 'creature'))) {
    return { matched: false, reason: 'requires legendary creature' };
  }

  const atMost = text.match(/mana value (\d+) or less/);
  if (atMost && piece.cmc > Number(atMost[1])) return { matched: false, reason: `mana value exceeds ${atMost[1]}` };
  const exact = text.match(/mana value (?:equal to )?(\d+)(?!\s+or less)/);
  if (exact && piece.cmc !== Number(exact[1])) return { matched: false, reason: `mana value is not ${exact[1]}` };

  return { matched: true, reason: 'piece satisfies search restriction' };
}

/**
 * Conservative deterministic library-search audit. This intentionally excludes look-at-top-N,
 * impulse, draw, and conditional non-library selection. It answers only whether an explicit
 * "search your library for ... card" clause can deterministically find the supplied combo piece.
 */
export function deterministicTutorAccessV15(tutor: ScryfallCard, piece: ScryfallCard): ComboTutorAccessV15 {
  const oracle = getCardOracleText(tutor).replace(/\s+/g, ' ').trim();
  const clauses = [...oracle.matchAll(/search your library for ([^.]+?card[^.]*?)(?:,|\. |$)/gi)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  if (clauses.length === 0) {
    return { tutorName: tutor.name, pieceName: piece.name, deterministic: false, matchedClause: null, reason: 'no explicit library-search-for-card clause' };
  }
  for (const clause of clauses) {
    const result = clauseMatchesPiece(clause, piece);
    if (result.matched) return { tutorName: tutor.name, pieceName: piece.name, deterministic: true, matchedClause: clause, reason: result.reason };
  }
  return { tutorName: tutor.name, pieceName: piece.name, deterministic: false, matchedClause: clauses.join(' | '), reason: 'piece fails every library-search restriction' };
}

export function auditComboTutorAccessV15(tutors: readonly ScryfallCard[], comboPieces: readonly ScryfallCard[]): Record<string, unknown> {
  const matrix = tutors.flatMap((tutor) => comboPieces.map((piece) => deterministicTutorAccessV15(tutor, piece)));
  const usefulTutors = tutors
    .filter((tutor) => matrix.some((entry) => entry.tutorName === tutor.name && entry.deterministic))
    .map((tutor) => tutor.name);
  const pieceAccess = comboPieces.map((piece) => ({
    piece: piece.name,
    deterministicTutors: matrix.filter((entry) => entry.pieceName === piece.name && entry.deterministic).map((entry) => entry.tutorName),
  }));
  return {
    deterministicComboTutorCount: usefulTutors.length,
    deterministicComboTutors: usefulTutors,
    pieceAccess,
    matrix,
    note: 'This is deterministic library-search access only; top-N selection and draw/filtering are intentionally separate evidence.',
  };
}
