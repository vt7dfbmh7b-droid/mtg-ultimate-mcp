import type { ScryfallCard } from '../types/scryfall.js';
import { deterministicTutorAccessV15 } from './combo-access-v15.js';
import { boundedComboSelectionAccessV15 } from './combo-selection-v15.js';

export interface ComboAccessSourceV15 {
  cardName: string;
  hits: string[];
}

export interface BoundedComboAccessSourceV15 extends ComboAccessSourceV15 {
  depth: number;
}

export interface ComboAccessQualityV15 {
  deterministicSources: ComboAccessSourceV15[];
  boundedSources: BoundedComboAccessSourceV15[];
  deterministicPieceLinks: number;
  boundedPieceLinks: number;
  accessiblePieces: string[];
  weightedScore: number;
}

export interface ComboAccessPreservationV15 {
  preserved: boolean;
  before: ComboAccessQualityV15;
  after: ComboAccessQualityV15;
  failures: string[];
}

function unique(values: readonly string[]): string[] { return [...new Set(values)]; }

/**
 * Measures access to the supplied win pieces without pretending every generic tutor is equally
 * useful. Deterministic library search remains a distinct, more valuable class; bounded top-N
 * selection receives partial credit based on how many pieces it can see and how deep it looks.
 */
export function comboAccessQualityV15(cards: readonly ScryfallCard[], comboPieces: readonly ScryfallCard[]): ComboAccessQualityV15 {
  const deterministicSources: ComboAccessSourceV15[] = [];
  const boundedSources: BoundedComboAccessSourceV15[] = [];

  for (const card of cards) {
    const deterministicHits = comboPieces
      .filter((piece) => deterministicTutorAccessV15(card, piece).deterministic)
      .map((piece) => piece.name);
    if (deterministicHits.length > 0) deterministicSources.push({ cardName: card.name, hits: deterministicHits });

    const bounded = comboPieces.map((piece) => boundedComboSelectionAccessV15(card, piece));
    const boundedHits = bounded.filter((entry) => entry.matched).map((entry) => entry.pieceName);
    if (boundedHits.length > 0) {
      const depth = Math.max(...bounded.filter((entry) => entry.matched).map((entry) => entry.depth ?? 0));
      boundedSources.push({ cardName: card.name, hits: boundedHits, depth });
    }
  }

  const deterministicPieceLinks = deterministicSources.reduce((sum, source) => sum + source.hits.length, 0);
  const boundedPieceLinks = boundedSources.reduce((sum, source) => sum + source.hits.length, 0);
  const accessiblePieces = unique([
    ...deterministicSources.flatMap((source) => source.hits),
    ...boundedSources.flatMap((source) => source.hits),
  ]);
  const deterministicScore = deterministicPieceLinks * 4;
  const boundedScore = boundedSources.reduce((sum, source) => sum + source.hits.length * (1 + Math.min(10, source.depth) / 10), 0);

  return {
    deterministicSources,
    boundedSources,
    deterministicPieceLinks,
    boundedPieceLinks,
    accessiblePieces,
    weightedScore: Number((deterministicScore + boundedScore).toFixed(3)),
  };
}

/**
 * Candidate access is preserved only if it keeps the existing deterministic access floor and
 * does not reduce either unique win-piece coverage or the weighted access score. This allows an
 * irrelevant/narrow generic tutor to be replaced by meaningful selection without sacrificing a
 * real deterministic combo tutor.
 */
export function preservesComboAccessQualityV15(
  beforeCards: readonly ScryfallCard[],
  afterCards: readonly ScryfallCard[],
  comboPieces: readonly ScryfallCard[],
): ComboAccessPreservationV15 {
  const before = comboAccessQualityV15(beforeCards, comboPieces);
  const after = comboAccessQualityV15(afterCards, comboPieces);
  const failures: string[] = [];
  if (after.deterministicSources.length < before.deterministicSources.length) failures.push('deterministic-source-count');
  if (after.deterministicPieceLinks < before.deterministicPieceLinks) failures.push('deterministic-piece-links');
  if (after.accessiblePieces.length < before.accessiblePieces.length) failures.push('unique-piece-coverage');
  if (after.weightedScore + 1e-9 < before.weightedScore) failures.push('weighted-access-score');
  return { preserved: failures.length === 0, before, after, failures };
}
