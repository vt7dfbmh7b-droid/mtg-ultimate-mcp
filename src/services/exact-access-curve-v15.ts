import {
  calculateExactCommanderZonePackageAssemblyV15,
  type ExactCommandZoneCardV15,
  type ExactCommanderZonePackageAssemblyResultV15,
} from './exact-commander-zone-statistics-v15.js';
import type {
  ExactOverlapCardCategoryV15,
  ExactOverlapRouteV15,
} from './exact-overlap-package-statistics-v15.js';
import type { ExactFractionV15 } from './exact-statistics-v15.js';

export const MAX_EXACT_ACCESS_TURNS_V15 = 50;
export const MAX_EXACT_ACCESS_EXTRA_DRAW_EVENTS_V15 = 64;
export const MAX_EXACT_ACCESS_SOLVER_EVALUATIONS_V15 = 16;

export type ExactNaturalDrawContextV15 =
  | 'two-player-starting'
  | 'two-player-non-starting'
  | 'multiplayer';

export interface ExactGuaranteedExtraDrawV15 {
  turn: number;
  count: number;
  name?: string;
}

export interface ExactAccessCheckpointV15 {
  kind: 'opening-hand' | 'turn';
  turn: number;
  naturalDrawsThisTurn: number;
  guaranteedExtraDrawsThisTurn: number;
  attemptedCumulativeLibraryDraws: number;
  cumulativeLibraryDraws: number;
  libraryFullySeen: boolean;
  wouldDrawPastLibrary: boolean;
  favorableHands: string;
  totalHands: string;
  probability: ExactFractionV15;
  complement: ExactFractionV15;
}

export interface ExactAccessCurveResultV15 {
  deckSize: number;
  libraryPopulation: number;
  openingHandSize: number;
  throughTurn: number;
  naturalDrawContext: ExactNaturalDrawContextV15;
  guaranteedExtraDraws: ExactGuaranteedExtraDrawV15[];
  commandZoneCards: ExactCommanderZonePackageAssemblyResultV15['commandZoneCards'];
  checkpoints: ExactAccessCheckpointV15[];
  solverEvaluations: number;
  formula: 'commander-zone-exact-access-curve-v15';
}

function requireInteger(name: string, value: number, minimum: number, maximum?: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error(`${name} must be a finite integer.`);
  if (value < minimum) throw new Error(`${name} must be at least ${minimum}.`);
  if (maximum !== undefined && value > maximum) throw new Error(`${name} must be at most ${maximum}.`);
  return value;
}

function requireDrawContext(value: unknown): ExactNaturalDrawContextV15 {
  if (value === 'two-player-starting' || value === 'two-player-non-starting' || value === 'multiplayer') {
    return value;
  }
  throw new Error('naturalDrawContext must be two-player-starting, two-player-non-starting, or multiplayer.');
}

function naturalDrawsOnTurn(context: ExactNaturalDrawContextV15, turn: number): number {
  if (context === 'two-player-starting' && turn === 1) return 0;
  return 1;
}

function exactLessThan(left: ExactFractionV15, right: ExactFractionV15): boolean {
  return BigInt(left.numerator) * BigInt(right.denominator)
    < BigInt(right.numerator) * BigInt(left.denominator);
}

function normalizeExtraDraws(
  input: readonly ExactGuaranteedExtraDrawV15[] | undefined,
  throughTurn: number,
): ExactGuaranteedExtraDrawV15[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new Error('guaranteedExtraDraws must be an array.');
  if (input.length > MAX_EXACT_ACCESS_EXTRA_DRAW_EVENTS_V15) {
    throw new Error(`guaranteedExtraDraws must contain at most ${MAX_EXACT_ACCESS_EXTRA_DRAW_EVENTS_V15} events.`);
  }

  return input.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`guaranteedExtraDraws[${index}] must be an object.`);
    const turn = requireInteger(`guaranteedExtraDraws[${index}].turn`, entry.turn, 1, throughTurn);
    const count = requireInteger(`guaranteedExtraDraws[${index}].count`, entry.count, 0);
    const name = entry.name === undefined ? undefined : entry.name.trim();
    if (name !== undefined && !name) throw new Error(`guaranteedExtraDraws[${index}].name must be non-empty when supplied.`);
    if (name !== undefined && name.length > 120) {
      throw new Error(`guaranteedExtraDraws[${index}].name must be at most 120 characters.`);
    }
    return name === undefined ? { turn, count } : { turn, count, name };
  }).sort((left, right) => left.turn - right.turn || (left.name ?? '').localeCompare(right.name ?? ''));
}

/**
 * Exact cumulative package-access probabilities from the opening hand through
 * ordered turn checkpoints.
 *
 * This is an access/visibility curve, not a castability curve: mana, tutor mana,
 * timing windows, interaction and conditional draw engines are deliberately out
 * of scope. Guaranteed extra draws are accepted only as explicit deterministic
 * card counts at a specified turn.
 */
export function calculateExactAccessCurveV15(input: {
  deckSize: number;
  openingHandSize?: number;
  throughTurn: number;
  naturalDrawContext: ExactNaturalDrawContextV15;
  commandZoneCards: readonly ExactCommandZoneCardV15[];
  routes: readonly ExactOverlapRouteV15[];
  libraryCategories: readonly ExactOverlapCardCategoryV15[];
  guaranteedExtraDraws?: readonly ExactGuaranteedExtraDrawV15[];
}): ExactAccessCurveResultV15 {
  const openingHandSize = requireInteger('openingHandSize', input.openingHandSize ?? 7, 0);
  const throughTurn = requireInteger('throughTurn', input.throughTurn, 0, MAX_EXACT_ACCESS_TURNS_V15);
  const naturalDrawContext = requireDrawContext(input.naturalDrawContext);
  const guaranteedExtraDraws = normalizeExtraDraws(input.guaranteedExtraDraws, throughTurn);

  const baseInput = {
    deckSize: input.deckSize,
    commandZoneCards: input.commandZoneCards,
    routes: input.routes,
    libraryCategories: input.libraryCategories,
  };
  const openingResult = calculateExactCommanderZonePackageAssemblyV15({
    ...baseInput,
    draws: openingHandSize,
  });
  const libraryPopulation = openingResult.libraryPopulation;

  const attemptedDrawsByCheckpoint: number[] = [openingHandSize];
  const naturalDrawsByTurn = new Array<number>(throughTurn + 1).fill(0);
  const extraDrawsByTurn = new Array<number>(throughTurn + 1).fill(0);
  for (let turn = 1; turn <= throughTurn; turn += 1) {
    naturalDrawsByTurn[turn] = naturalDrawsOnTurn(naturalDrawContext, turn);
  }
  for (const event of guaranteedExtraDraws) {
    extraDrawsByTurn[event.turn] = (extraDrawsByTurn[event.turn] ?? 0) + event.count;
  }

  let attemptedCumulativeDraws = openingHandSize;
  for (let turn = 1; turn <= throughTurn; turn += 1) {
    attemptedCumulativeDraws += (naturalDrawsByTurn[turn] ?? 0) + (extraDrawsByTurn[turn] ?? 0);
    attemptedDrawsByCheckpoint.push(attemptedCumulativeDraws);
  }

  const cappedDraws = attemptedDrawsByCheckpoint.map((draws) => Math.min(draws, libraryPopulation));
  const uniqueCappedDraws = [...new Set(cappedDraws)];
  if (uniqueCappedDraws.length > MAX_EXACT_ACCESS_SOLVER_EVALUATIONS_V15) {
    throw new Error(
      `exact access curve requires ${uniqueCappedDraws.length} distinct solver evaluations, exceeding the ${MAX_EXACT_ACCESS_SOLVER_EVALUATIONS_V15} evaluation limit.`,
    );
  }

  const resultByDrawCount = new Map<number, ExactCommanderZonePackageAssemblyResultV15>();
  resultByDrawCount.set(openingHandSize, openingResult);
  for (const draws of uniqueCappedDraws) {
    if (resultByDrawCount.has(draws)) continue;
    resultByDrawCount.set(draws, calculateExactCommanderZonePackageAssemblyV15({ ...baseInput, draws }));
  }

  const checkpoints: ExactAccessCheckpointV15[] = attemptedDrawsByCheckpoint.map((attempted, index) => {
    const turn = index;
    const cumulative = cappedDraws[index]!;
    const result = resultByDrawCount.get(cumulative);
    if (!result) throw new Error(`Internal exact access result missing for ${cumulative} draws.`);
    return {
      kind: turn === 0 ? 'opening-hand' : 'turn',
      turn,
      naturalDrawsThisTurn: turn === 0 ? 0 : (naturalDrawsByTurn[turn] ?? 0),
      guaranteedExtraDrawsThisTurn: turn === 0 ? 0 : (extraDrawsByTurn[turn] ?? 0),
      attemptedCumulativeLibraryDraws: attempted,
      cumulativeLibraryDraws: cumulative,
      libraryFullySeen: cumulative === libraryPopulation,
      wouldDrawPastLibrary: attempted > libraryPopulation,
      favorableHands: result.favorableHands,
      totalHands: result.totalHands,
      probability: result.probability,
      complement: result.complement,
    };
  });

  for (let index = 1; index < checkpoints.length; index += 1) {
    const previous = checkpoints[index - 1]!;
    const current = checkpoints[index]!;
    if (exactLessThan(current.probability, previous.probability)) {
      throw new Error(`Internal exact access curve regressed between turn ${previous.turn} and turn ${current.turn}.`);
    }
  }

  return {
    deckSize: input.deckSize,
    libraryPopulation,
    openingHandSize,
    throughTurn,
    naturalDrawContext,
    guaranteedExtraDraws,
    commandZoneCards: openingResult.commandZoneCards,
    checkpoints,
    solverEvaluations: uniqueCappedDraws.length,
    formula: 'commander-zone-exact-access-curve-v15',
  };
}
