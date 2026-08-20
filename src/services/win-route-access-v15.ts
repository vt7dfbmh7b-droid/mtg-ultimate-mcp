import type { ScryfallCard } from '../types/scryfall.js';
import {
  calculateExactAccessCurveV15,
  type ExactAccessCheckpointV15,
} from './exact-access-curve-v15.js';
import type { ExactOverlapCardCategoryV15 } from './exact-overlap-package-statistics-v15.js';
import { resolveEntryCard, type ParsedDeck } from './deck.js';
import { getCardOracleText } from './scryfall.js';
import { parseTutorSpec } from './simulation-v04.js';

export type WinRouteTutorUseV15 =
  | 'qualifying-access'
  | 'conditional-destination'
  | 'unsupported-or-ambiguous'
  | 'not-route-relevant';

export interface WinRouteAccessInputV15 {
  comboId: string;
  comboCardNames: readonly string[];
  seedNames?: readonly string[];
  dependencyCompleteness?: 'explicit-cards-only' | 'template-requirements-present';
}

export interface WinRoutePieceAccessV15 {
  pieceName: string;
  location: 'command-zone' | 'library' | 'missing';
  naturalCopies: number;
  qualifyingTutorNames: string[];
  conditionalTutorNames: string[];
}

export interface WinRouteTutorAuditV15 {
  tutorName: string;
  physicalCopies: number;
  destination: 'hand' | 'top' | 'battlefield' | 'graveyard' | 'unknown';
  use: WinRouteTutorUseV15;
  coversPieces: string[];
  observedUsd: number | null;
  reason: string;
}

export interface WinRouteExactAccessCheckpointV15 {
  label: 'opening-hand' | 'turn-3' | 'turn-5';
  turn: number;
  cumulativeLibraryDraws: number;
  favorableHands: string;
  totalHands: string;
  probability: ExactAccessCheckpointV15['probability'];
}

export interface WinRouteExactAccessV15 {
  scope: 'card-components-only';
  naturalDrawContext: 'multiplayer';
  tutorDestinationsCounted: Array<'hand' | 'battlefield'>;
  checkpoints: WinRouteExactAccessCheckpointV15[];
  formula: 'commander-zone-exact-access-curve-v15';
  caveat: string;
}

export interface WinRouteAccessAuditV15 {
  comboId: string;
  status: 'exact-card-access' | 'unknown-missing-piece' | 'no-card-components';
  dependencyCompleteness: 'explicit-cards-only' | 'template-requirements-present';
  commandZonePieces: string[];
  libraryPieces: string[];
  missingPieces: string[];
  pieces: WinRoutePieceAccessV15[];
  tutors: WinRouteTutorAuditV15[];
  distinctTutorCoverage: {
    requiredLibraryPieces: number;
    maxMissingLibraryPiecesFetchableByDistinctTutors: number;
    allLibraryPiecesFetchableFromDistinctTutors: boolean;
  };
  exactAccess: WinRouteExactAccessV15 | null;
  guidance: string;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function typeText(card: ScryfallCard): string {
  return [card.type_line, ...(card.card_faces ?? []).map((face) => face.type_line ?? '')]
    .join(' ')
    .toLocaleLowerCase();
}

function cardHasLandType(card: ScryfallCard, wanted: string): boolean {
  return new RegExp(`\\b${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(typeText(card));
}

function isLandOption(card: ScryfallCard): boolean {
  return /\bland\b/i.test(typeText(card));
}

function tutorSearchClause(card: ScryfallCard): string | null {
  const text = getCardOracleText(card);
  return text.match(/search your library for ([\s\S]*?)(?:,|\.)(?:\s|$)/i)?.[1]?.trim().toLocaleLowerCase() ?? null;
}

/**
 * parseTutorSpec is the established V0.4 Oracle parser. This additional guard is
 * intentionally conservative: it prevents restrictions that the mature parser
 * does not model (power, colour, names, equality/X clauses, etc.) from silently
 * degrading into a universal tutor in route-access calculations.
 */
function tutorRestrictionSupported(card: ScryfallCard, spec: ReturnType<typeof parseTutorSpec>): boolean {
  if (!spec.isTutor) return false;
  const clause = tutorSearchClause(card);
  if (!clause) return false;

  if (/\b(power|toughness|converted mana cost|mana cost|color|colour|colored|coloured|legendary|historic|snow|named|name|shares?|different|odd|even|multicolored|multicoloured|monocolored|monocoloured|nonland|noncreature|nonartifact|nonenchantment|nonbasic|commander|exactly|equal to|greater than|less than)\b/i.test(clause)) {
    return false;
  }
  if (/\bmana value\b/i.test(clause) && spec.maxManaValue === null) return false;
  if (/\b[xyz]\b/i.test(clause)) return false;

  const hasModeledRestriction = spec.anyCard
    || spec.basicOnly
    || spec.types.length > 0
    || spec.landTypes.length > 0;
  return hasModeledRestriction;
}

function tutorCanFindCard(spec: ReturnType<typeof parseTutorSpec>, candidate: ScryfallCard): boolean {
  if (!spec.isTutor) return false;
  const types = typeText(candidate);
  if (spec.maxManaValue !== null && candidate.cmc > spec.maxManaValue) return false;
  if (spec.basicOnly && !(/\bbasic\b/i.test(types) && isLandOption(candidate))) return false;
  if (spec.landTypes.length > 0 && !spec.landTypes.some((landType) => cardHasLandType(candidate, landType))) return false;
  if (spec.types.length > 0 && !spec.types.some((wanted) => types.includes(wanted))) return false;
  return spec.anyCard || spec.basicOnly || spec.types.length > 0 || spec.landTypes.length > 0;
}

function observedUsd(card: ScryfallCard): number | null {
  const values = [card.prices?.usd, card.prices?.usd_foil, card.prices?.usd_etched]
    .map((value) => value ? Number.parseFloat(value) : Number.NaN)
    .filter(Number.isFinite);
  return values.length > 0 ? Math.min(...values) : null;
}

function maxDistinctTutorMatching(
  libraryPieces: readonly string[],
  tutorCopies: readonly { key: string; coversPieces: readonly string[] }[],
): number {
  const pieceNames = [...libraryPieces];
  const candidatesByPiece = new Map(pieceNames.map((piece) => [
    piece,
    tutorCopies.filter((tutor) => tutor.coversPieces.some((covered) => normalizeName(covered) === normalizeName(piece))),
  ] as const));
  pieceNames.sort((left, right) => (candidatesByPiece.get(left)?.length ?? 0) - (candidatesByPiece.get(right)?.length ?? 0));

  let best = 0;
  const used = new Set<string>();
  function visit(index: number, matched: number): void {
    if (matched + (pieceNames.length - index) <= best) return;
    if (index >= pieceNames.length) {
      best = Math.max(best, matched);
      return;
    }
    const piece = pieceNames[index]!;
    visit(index + 1, matched);
    for (const tutor of candidatesByPiece.get(piece) ?? []) {
      if (used.has(tutor.key)) continue;
      used.add(tutor.key);
      visit(index + 1, matched + 1);
      used.delete(tutor.key);
    }
  }
  visit(0, 0);
  return best;
}

function selectedCheckpoints(checkpoints: readonly ExactAccessCheckpointV15[]): WinRouteExactAccessCheckpointV15[] {
  return checkpoints
    .filter((checkpoint) => checkpoint.turn === 0 || checkpoint.turn === 3 || checkpoint.turn === 5)
    .map((checkpoint) => ({
      label: checkpoint.turn === 0 ? 'opening-hand' : checkpoint.turn === 3 ? 'turn-3' : 'turn-5',
      turn: checkpoint.turn,
      cumulativeLibraryDraws: checkpoint.cumulativeLibraryDraws,
      favorableHands: checkpoint.favorableHands,
      totalHands: checkpoint.totalHands,
      probability: checkpoint.probability,
    }));
}

export function auditWinRouteAccessV15(input: {
  route: WinRouteAccessInputV15;
  parsed: ParsedDeck;
  resolvedCards: readonly ScryfallCard[];
}): WinRouteAccessAuditV15 {
  const comboId = input.route.comboId.trim();
  if (!comboId) throw new Error('route.comboId must be non-empty.');
  const comboCardNames = uniqueSorted(input.route.comboCardNames);
  const dependencyCompleteness = input.route.dependencyCompleteness ?? 'explicit-cards-only';
  const commanderNames = new Set(input.parsed.commanders.map((entry) => normalizeName(entry.name)));
  const commandZonePieces = comboCardNames.filter((name) => commanderNames.has(normalizeName(name)));
  const libraryPieces = comboCardNames.filter((name) => !commanderNames.has(normalizeName(name)));
  const roleByPiece = new Map(comboCardNames.map((name, index) => [normalizeName(name), `piece-${index}`] as const));

  if (comboCardNames.length === 0) {
    return {
      comboId,
      status: 'no-card-components',
      dependencyCompleteness,
      commandZonePieces: [],
      libraryPieces: [],
      missingPieces: [],
      pieces: [],
      tutors: [],
      distinctTutorCoverage: {
        requiredLibraryPieces: 0,
        maxMissingLibraryPiecesFetchableByDistinctTutors: 0,
        allLibraryPiecesFetchableFromDistinctTutors: true,
      },
      exactAccess: null,
      guidance: 'No explicit combo card components were available, so route accessibility is unknown rather than zero.',
    };
  }

  const mainResolved = input.parsed.main.map((entry, index) => ({
    entry,
    index,
    card: resolveEntryCard(entry, input.resolvedCards),
  }));
  const targetByPiece = new Map<string, ScryfallCard>();
  for (const piece of libraryPieces) {
    const normalizedPiece = normalizeName(piece);
    const match = mainResolved.find(({ entry, card }) => normalizeName(entry.name) === normalizedPiece && Boolean(card));
    if (match?.card) targetByPiece.set(normalizedPiece, match.card);
  }

  const tutorAudits: WinRouteTutorAuditV15[] = [];
  const qualifyingTutorCopies: Array<{ key: string; coversPieces: string[] }> = [];
  const qualifyingByPiece = new Map(libraryPieces.map((piece) => [normalizeName(piece), new Set<string>()] as const));
  const conditionalByPiece = new Map(libraryPieces.map((piece) => [normalizeName(piece), new Set<string>()] as const));

  for (const { entry, index, card } of mainResolved) {
    if (!card) continue;
    const spec = parseTutorSpec(card);
    if (!spec.isTutor) continue;
    const supported = tutorRestrictionSupported(card, spec);
    const coversPieces = supported
      ? libraryPieces.filter((piece) => {
        if (entry.quantity === 1 && normalizeName(entry.name) === normalizeName(piece)) return false;
        const target = targetByPiece.get(normalizeName(piece));
        return target ? tutorCanFindCard(spec, target) : false;
      })
      : [];
    const countedDestination = spec.destination === 'hand' || spec.destination === 'battlefield';
    const conditionalDestination = spec.destination === 'top' || spec.destination === 'graveyard';
    let use: WinRouteTutorUseV15;
    let reason: string;
    if (!supported || spec.destination === 'unknown') {
      use = 'unsupported-or-ambiguous';
      reason = 'Tutor text contains a restriction or destination that is not modeled safely enough for exact route access.';
    } else if (coversPieces.length === 0) {
      use = 'not-route-relevant';
      reason = 'The modeled tutor restrictions cannot find any missing library piece in this route.';
    } else if (countedDestination) {
      use = 'qualifying-access';
      reason = `The tutor can find ${coversPieces.length} route piece${coversPieces.length === 1 ? '' : 's'} and moves the selected card to a directly usable access zone.`;
      for (const piece of coversPieces) qualifyingByPiece.get(normalizeName(piece))?.add(card.name);
      for (let copy = 0; copy < entry.quantity; copy += 1) {
        qualifyingTutorCopies.push({ key: `${index}:${copy}`, coversPieces: [...coversPieces] });
      }
    } else if (conditionalDestination) {
      use = 'conditional-destination';
      reason = `The tutor can find route pieces but moves them to ${spec.destination}; that is audited but excluded from conservative exact hand/battlefield access.`;
      for (const piece of coversPieces) conditionalByPiece.get(normalizeName(piece))?.add(card.name);
    } else {
      use = 'unsupported-or-ambiguous';
      reason = 'Tutor destination is not safe to count as direct route access.';
    }
    tutorAudits.push({
      tutorName: card.name,
      physicalCopies: entry.quantity,
      destination: spec.destination,
      use,
      coversPieces: uniqueSorted(coversPieces),
      observedUsd: observedUsd(card),
      reason,
    });
  }

  const pieces: WinRoutePieceAccessV15[] = comboCardNames.map((pieceName) => {
    const normalizedPiece = normalizeName(pieceName);
    if (commanderNames.has(normalizedPiece)) {
      const copies = input.parsed.commanders
        .filter((entry) => normalizeName(entry.name) === normalizedPiece)
        .reduce((sum, entry) => sum + entry.quantity, 0);
      return {
        pieceName,
        location: 'command-zone',
        naturalCopies: copies,
        qualifyingTutorNames: [],
        conditionalTutorNames: [],
      };
    }
    const naturalCopies = input.parsed.main
      .filter((entry) => normalizeName(entry.name) === normalizedPiece)
      .reduce((sum, entry) => sum + entry.quantity, 0);
    return {
      pieceName,
      location: naturalCopies > 0 && targetByPiece.has(normalizedPiece) ? 'library' : 'missing',
      naturalCopies,
      qualifyingTutorNames: [...(qualifyingByPiece.get(normalizedPiece) ?? [])].sort((a, b) => a.localeCompare(b)),
      conditionalTutorNames: [...(conditionalByPiece.get(normalizedPiece) ?? [])].sort((a, b) => a.localeCompare(b)),
    };
  });
  const missingPieces = pieces.filter((piece) => piece.location === 'missing').map((piece) => piece.pieceName);
  const maxFetchable = maxDistinctTutorMatching(libraryPieces, qualifyingTutorCopies);

  let exactAccess: WinRouteExactAccessV15 | null = null;
  if (missingPieces.length === 0) {
    const libraryCategories: ExactOverlapCardCategoryV15[] = [];
    for (const { entry, index, card } of mainResolved) {
      if (!card) continue;
      const roles = new Set<string>();
      const ownRole = roleByPiece.get(normalizeName(entry.name));
      if (ownRole && libraryPieces.some((piece) => normalizeName(piece) === normalizeName(entry.name))) roles.add(ownRole);

      const tutorAudit = tutorAudits.find((audit) => audit.tutorName === card.name && audit.use === 'qualifying-access');
      if (tutorAudit) {
        for (const piece of tutorAudit.coversPieces) {
          const role = roleByPiece.get(normalizeName(piece));
          if (role) roles.add(role);
        }
      }
      if (roles.size > 0) {
        libraryCategories.push({ name: `route-card-${index}:${entry.name}`, count: entry.quantity, roles: [...roles] });
      }
    }

    const commandZoneCards = input.parsed.commanders.map((entry, index) => {
      const role = roleByPiece.get(normalizeName(entry.name));
      return {
        name: `commander-${index}:${entry.name}`,
        roles: role ? [role] : [],
      };
    });
    const requirements = comboCardNames.map((piece) => ({ role: roleByPiece.get(normalizeName(piece))!, minimum: 1 }));

    try {
      const curve = calculateExactAccessCurveV15({
        deckSize: input.parsed.totalCards,
        openingHandSize: 7,
        throughTurn: 5,
        naturalDrawContext: 'multiplayer',
        commandZoneCards,
        routes: [{ name: comboId, requirements }],
        libraryCategories,
      });
      exactAccess = {
        scope: 'card-components-only',
        naturalDrawContext: 'multiplayer',
        tutorDestinationsCounted: ['hand', 'battlefield'],
        checkpoints: selectedCheckpoints(curve.checkpoints),
        formula: curve.formula,
        caveat: dependencyCompleteness === 'template-requirements-present'
          ? 'Exact probabilities cover explicit card components only. Provider template requirements, mana, timing, tutor casting costs, interaction and other setup remain additional requirements.'
          : 'Exact probabilities cover card visibility/access only. They do not prove mana, tutor castability, timing, interaction resilience or non-card setup.',
      };
    } catch {
      exactAccess = null;
    }
  }

  return {
    comboId,
    status: missingPieces.length > 0 ? 'unknown-missing-piece' : 'exact-card-access',
    dependencyCompleteness,
    commandZonePieces,
    libraryPieces,
    missingPieces,
    pieces,
    tutors: tutorAudits.sort((left, right) => left.tutorName.localeCompare(right.tutorName)),
    distinctTutorCoverage: {
      requiredLibraryPieces: libraryPieces.length,
      maxMissingLibraryPiecesFetchableByDistinctTutors: maxFetchable,
      allLibraryPiecesFetchableFromDistinctTutors: maxFetchable >= libraryPieces.length,
    },
    exactAccess,
    guidance: missingPieces.length > 0
      ? 'At least one verified route card could not be matched to the finished deck/card data, so access is unknown rather than treated as impossible.'
      : 'Use the exact curve to compare route accessibility, not as a probability of winning the game. Tutor and natural-piece overlap is physical-card matching safe.',
  };
}

export function auditWinRouteAccessPortfolioV15(input: {
  routes: readonly WinRouteAccessInputV15[];
  parsed: ParsedDeck;
  resolvedCards: readonly ScryfallCard[];
}): WinRouteAccessAuditV15[] {
  return input.routes.map((route) => auditWinRouteAccessV15({ route, parsed: input.parsed, resolvedCards: input.resolvedCards }));
}
