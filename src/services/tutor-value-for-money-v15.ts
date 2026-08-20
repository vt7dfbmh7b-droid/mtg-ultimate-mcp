import type { ScryfallCard } from '../types/scryfall.js';
import {
  exactPrintingPriceChoicesV15,
  type ExactPrintingPriceChoiceV15,
} from './exact-printing-budget-v15.js';
import type { ExactFractionV15 } from './exact-statistics-v15.js';
import {
  resolveEntryCard,
  type DeckEntry,
  type DeckFinish,
  type ParsedDeck,
} from './deck.js';
import {
  auditWinRouteAccessV15,
  type WinRouteAccessAuditV15,
  type WinRouteAccessInputV15,
  type WinRouteExactAccessCheckpointV15,
} from './win-route-access-v15.js';

export const MAX_TUTOR_VALUE_CANDIDATES_V15 = 24;

export type TutorValueCheckpointLabelV15 = 'opening-hand' | 'turn-3' | 'turn-5';

export interface TutorExactPrintingPriceV15 {
  status: 'available' | 'price-unavailable' | 'requested-finish-unavailable';
  printing: {
    name: string;
    set: string;
    collectorNumber: string;
  };
  requestedFinish: DeckFinish | null;
  pricedFinish: DeckFinish | null;
  priceUsd: number | null;
  basis: 'exact-printing-requested-finish' | 'exact-printing-cheapest-known-finish' | 'unavailable';
  knownPrices: ExactPrintingPriceChoiceV15[];
}

export interface TutorMarginalAccessCheckpointV15 {
  label: TutorValueCheckpointLabelV15;
  turn: number;
  baselineProbability: ExactFractionV15;
  withoutTutorProbability: ExactFractionV15;
  exactMarginalProbability: ExactFractionV15;
  marginalPercentagePoints: number;
  marginalPercentagePointsPerUsd: number | null;
}

export interface TutorValueCandidateV15 {
  tutorName: string;
  mainEntryIndex: number;
  physicalCopiesInEntry: number;
  removedCopiesForCounterfactual: 1;
  coversPieces: string[];
  destination: 'hand' | 'battlefield';
  price: TutorExactPrintingPriceV15;
  exactMarginalAccess: TutorMarginalAccessCheckpointV15[];
  zeroMarginalAtSelectedCheckpoints: boolean;
  dominatedByTutorNames: string[];
  comparisonStatus: 'priced' | 'price-unknown';
  caveat: string;
}

export interface TutorValueForMoneyAuditV15 {
  comboId: string;
  status: 'exact-marginal-value' | 'access-unavailable' | 'no-qualifying-tutors' | 'too-many-qualifying-tutors';
  baselineAccess: WinRouteAccessAuditV15;
  candidates: TutorValueCandidateV15[];
  qualifyingTutorCount: number;
  evaluatedTutorCount: number;
  maxTutorCandidates: number;
  comparisonMethod: 'same-deck-one-slot-neutral-replacement-v15';
  priceMethod: 'exact-resolved-printing-v15';
  dominanceMethod: 'pareto-price-and-selected-checkpoint-marginal-access-v15';
  guidance: string;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function exactFraction(numerator: bigint, denominator: bigint): ExactFractionV15 {
  if (denominator === 0n) throw new Error('Exact tutor-value fraction denominator cannot be zero.');
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  n /= divisor;
  d /= divisor;
  const decimal = Number(n) / Number(d);
  if (!Number.isFinite(decimal)) throw new Error('Exact tutor-value decimal presentation exceeded the finite Number range.');
  return { numerator: n.toString(), denominator: d.toString(), decimal };
}

function subtractFractions(left: ExactFractionV15, right: ExactFractionV15): ExactFractionV15 {
  const leftNumerator = BigInt(left.numerator);
  const leftDenominator = BigInt(left.denominator);
  const rightNumerator = BigInt(right.numerator);
  const rightDenominator = BigInt(right.denominator);
  const numerator = leftNumerator * rightDenominator - rightNumerator * leftDenominator;
  const denominator = leftDenominator * rightDenominator;
  if (numerator < 0n) {
    throw new Error('Tutor counterfactual unexpectedly increased exact route access; marginal access must be non-negative.');
  }
  return exactFraction(numerator, denominator);
}

function compareFractions(left: ExactFractionV15, right: ExactFractionV15): number {
  const difference = BigInt(left.numerator) * BigInt(right.denominator)
    - BigInt(right.numerator) * BigInt(left.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function selectedCheckpointMap(access: WinRouteAccessAuditV15): Map<TutorValueCheckpointLabelV15, WinRouteExactAccessCheckpointV15> | null {
  if (!access.exactAccess) return null;
  const map = new Map<TutorValueCheckpointLabelV15, WinRouteExactAccessCheckpointV15>();
  for (const checkpoint of access.exactAccess.checkpoints) map.set(checkpoint.label, checkpoint);
  for (const label of ['opening-hand', 'turn-3', 'turn-5'] as const) {
    if (!map.has(label)) return null;
  }
  return map;
}

function exactEntryPrice(entry: DeckEntry, card: ScryfallCard): TutorExactPrintingPriceV15 {
  const knownPrices = exactPrintingPriceChoicesV15(card);
  const requestedFinish = entry.finish ?? null;
  const printing = {
    name: card.name,
    set: card.set.toUpperCase(),
    collectorNumber: card.collector_number,
  };
  if (requestedFinish) {
    const declared = new Set((card.finishes ?? []).map((finish) => finish.trim().toLocaleLowerCase()));
    if (declared.size > 0 && !declared.has(requestedFinish)) {
      return {
        status: 'requested-finish-unavailable',
        printing,
        requestedFinish,
        pricedFinish: null,
        priceUsd: null,
        basis: 'unavailable',
        knownPrices,
      };
    }
    const choice = knownPrices.find((candidate) => candidate.finish === requestedFinish);
    if (!choice) {
      return {
        status: 'price-unavailable',
        printing,
        requestedFinish,
        pricedFinish: requestedFinish,
        priceUsd: null,
        basis: 'unavailable',
        knownPrices,
      };
    }
    return {
      status: 'available',
      printing,
      requestedFinish,
      pricedFinish: choice.finish,
      priceUsd: choice.priceUsd,
      basis: 'exact-printing-requested-finish',
      knownPrices,
    };
  }
  const choice = knownPrices[0];
  if (!choice) {
    return {
      status: 'price-unavailable',
      printing,
      requestedFinish: null,
      pricedFinish: null,
      priceUsd: null,
      basis: 'unavailable',
      knownPrices,
    };
  }
  return {
    status: 'available',
    printing,
    requestedFinish: null,
    pricedFinish: choice.finish,
    priceUsd: choice.priceUsd,
    basis: 'exact-printing-cheapest-known-finish',
    knownPrices,
  };
}

function replaceOneTutorCopyWithNeutral(parsed: ParsedDeck, mainEntryIndex: number): ParsedDeck {
  if (mainEntryIndex < 0 || mainEntryIndex >= parsed.main.length) throw new Error('mainEntryIndex is outside the parsed main deck.');
  const main: DeckEntry[] = [];
  for (let index = 0; index < parsed.main.length; index += 1) {
    const entry = parsed.main[index]!;
    if (index !== mainEntryIndex) {
      main.push({ ...entry });
      continue;
    }
    if (entry.quantity < 1) throw new Error('Tutor counterfactual cannot remove a copy from a zero-quantity entry.');
    if (entry.quantity > 1) main.push({ ...entry, quantity: entry.quantity - 1 });
  }
  main.push({ name: `__V15_NEUTRAL_TUTOR_SLOT_${mainEntryIndex}__`, quantity: 1 });
  const totalMain = main.reduce((sum, entry) => sum + entry.quantity, 0);
  return {
    main,
    commanders: parsed.commanders.map((entry) => ({ ...entry })),
    totalMain,
    totalCommanders: parsed.totalCommanders,
    totalCards: totalMain + parsed.totalCommanders,
  };
}

function marginalCheckpoints(
  baseline: Map<TutorValueCheckpointLabelV15, WinRouteExactAccessCheckpointV15>,
  counterfactual: Map<TutorValueCheckpointLabelV15, WinRouteExactAccessCheckpointV15>,
  priceUsd: number | null,
): TutorMarginalAccessCheckpointV15[] {
  return (['opening-hand', 'turn-3', 'turn-5'] as const).map((label) => {
    const baselineCheckpoint = baseline.get(label)!;
    const withoutTutorCheckpoint = counterfactual.get(label)!;
    const exactMarginalProbability = subtractFractions(
      baselineCheckpoint.probability,
      withoutTutorCheckpoint.probability,
    );
    const marginalPercentagePoints = exactMarginalProbability.decimal * 100;
    return {
      label,
      turn: baselineCheckpoint.turn,
      baselineProbability: baselineCheckpoint.probability,
      withoutTutorProbability: withoutTutorCheckpoint.probability,
      exactMarginalProbability,
      marginalPercentagePoints,
      marginalPercentagePointsPerUsd: priceUsd !== null && priceUsd > 0
        ? marginalPercentagePoints / priceUsd
        : null,
    };
  });
}

function candidateDominates(left: TutorValueCandidateV15, right: TutorValueCandidateV15): boolean {
  if (left.price.priceUsd === null || right.price.priceUsd === null) return false;
  if (left.price.priceUsd > right.price.priceUsd + 1e-9) return false;
  let strictlyBetter = left.price.priceUsd + 1e-9 < right.price.priceUsd;
  for (const label of ['opening-hand', 'turn-3', 'turn-5'] as const) {
    const leftCheckpoint = left.exactMarginalAccess.find((checkpoint) => checkpoint.label === label);
    const rightCheckpoint = right.exactMarginalAccess.find((checkpoint) => checkpoint.label === label);
    if (!leftCheckpoint || !rightCheckpoint) return false;
    const comparison = compareFractions(leftCheckpoint.exactMarginalProbability, rightCheckpoint.exactMarginalProbability);
    if (comparison < 0) return false;
    if (comparison > 0) strictlyBetter = true;
  }
  return strictlyBetter;
}

function applyDominance(candidates: TutorValueCandidateV15[]): TutorValueCandidateV15[] {
  return candidates.map((candidate, index) => ({
    ...candidate,
    dominatedByTutorNames: candidates
      .filter((other, otherIndex) => otherIndex !== index && candidateDominates(other, candidate))
      .map((other) => other.tutorName)
      .filter((name, nameIndex, names) => names.indexOf(name) === nameIndex)
      .sort((left, right) => left.localeCompare(right)),
  }));
}

export function auditTutorValueForMoneyV15(input: {
  route: WinRouteAccessInputV15;
  parsed: ParsedDeck;
  resolvedCards: readonly ScryfallCard[];
}): TutorValueForMoneyAuditV15 {
  const baselineAccess = auditWinRouteAccessV15({
    route: input.route,
    parsed: input.parsed,
    resolvedCards: input.resolvedCards,
  });
  const baselineCheckpoints = selectedCheckpointMap(baselineAccess);
  const qualifyingTutorNames = new Set(
    baselineAccess.tutors
      .filter((tutor) => tutor.use === 'qualifying-access')
      .map((tutor) => normalizeName(tutor.tutorName)),
  );
  const mutableResolvedCards = [...input.resolvedCards];
  const qualifyingEntries = input.parsed.main
    .map((entry, mainEntryIndex) => ({
      entry,
      mainEntryIndex,
      card: resolveEntryCard(entry, mutableResolvedCards),
    }))
    .filter((candidate): candidate is { entry: DeckEntry; mainEntryIndex: number; card: ScryfallCard } =>
      Boolean(candidate.card) && qualifyingTutorNames.has(normalizeName(candidate.card!.name)));

  const base = {
    comboId: baselineAccess.comboId,
    baselineAccess,
    qualifyingTutorCount: qualifyingEntries.length,
    maxTutorCandidates: MAX_TUTOR_VALUE_CANDIDATES_V15,
    comparisonMethod: 'same-deck-one-slot-neutral-replacement-v15' as const,
    priceMethod: 'exact-resolved-printing-v15' as const,
    dominanceMethod: 'pareto-price-and-selected-checkpoint-marginal-access-v15' as const,
  };

  if (!baselineCheckpoints) {
    return {
      ...base,
      status: 'access-unavailable',
      candidates: [],
      evaluatedTutorCount: 0,
      guidance: 'Exact route access was unavailable, so tutor value is unknown rather than estimated from generic tutor counts.',
    };
  }
  if (qualifyingEntries.length === 0) {
    return {
      ...base,
      status: 'no-qualifying-tutors',
      candidates: [],
      evaluatedTutorCount: 0,
      guidance: 'No direct hand/battlefield tutor in the finished deck was proven to find an explicit library component of this route.',
    };
  }
  if (qualifyingEntries.length > MAX_TUTOR_VALUE_CANDIDATES_V15) {
    return {
      ...base,
      status: 'too-many-qualifying-tutors',
      candidates: [],
      evaluatedTutorCount: 0,
      guidance: `Route has ${qualifyingEntries.length} qualifying tutor entries, above the bounded ${MAX_TUTOR_VALUE_CANDIDATES_V15}-candidate exact counterfactual limit. No partial ranking was fabricated.`,
    };
  }

  const candidates: TutorValueCandidateV15[] = [];
  for (const { entry, mainEntryIndex, card } of qualifyingEntries) {
    const tutorAudit = baselineAccess.tutors.find((tutor) =>
      tutor.use === 'qualifying-access' && normalizeName(tutor.tutorName) === normalizeName(card.name));
    if (!tutorAudit || (tutorAudit.destination !== 'hand' && tutorAudit.destination !== 'battlefield')) continue;

    const withoutTutor = auditWinRouteAccessV15({
      route: input.route,
      parsed: replaceOneTutorCopyWithNeutral(input.parsed, mainEntryIndex),
      resolvedCards: input.resolvedCards,
    });
    const counterfactualCheckpoints = selectedCheckpointMap(withoutTutor);
    if (!counterfactualCheckpoints) {
      return {
        ...base,
        status: 'access-unavailable',
        candidates: [],
        evaluatedTutorCount: 0,
        guidance: `Removing one copy of ${card.name} made the exact card-access counterfactual unavailable, so no price/value claim was fabricated.`,
      };
    }
    const price = exactEntryPrice(entry, card);
    const exactMarginalAccess = marginalCheckpoints(baselineCheckpoints, counterfactualCheckpoints, price.priceUsd);
    candidates.push({
      tutorName: card.name,
      mainEntryIndex,
      physicalCopiesInEntry: entry.quantity,
      removedCopiesForCounterfactual: 1,
      coversPieces: [...tutorAudit.coversPieces],
      destination: tutorAudit.destination,
      price,
      exactMarginalAccess,
      zeroMarginalAtSelectedCheckpoints: exactMarginalAccess.every((checkpoint) => checkpoint.exactMarginalProbability.numerator === '0'),
      dominatedByTutorNames: [],
      comparisonStatus: price.priceUsd === null ? 'price-unknown' : 'priced',
      caveat: 'Marginal access is exact card visibility/access after replacing one physical tutor copy with a neutral slot. It does not model tutor mana, casting timing, interaction, non-card prerequisites, card quality outside this route, or tournament causality.',
    });
  }

  const ranked = applyDominance(candidates)
    .sort((left, right) => {
      const leftTurn3 = left.exactMarginalAccess.find((checkpoint) => checkpoint.label === 'turn-3')?.exactMarginalProbability;
      const rightTurn3 = right.exactMarginalAccess.find((checkpoint) => checkpoint.label === 'turn-3')?.exactMarginalProbability;
      if (leftTurn3 && rightTurn3) {
        const exactComparison = compareFractions(rightTurn3, leftTurn3);
        if (exactComparison !== 0) return exactComparison;
      }
      const leftPrice = left.price.priceUsd ?? Number.POSITIVE_INFINITY;
      const rightPrice = right.price.priceUsd ?? Number.POSITIVE_INFINITY;
      return leftPrice - rightPrice || left.tutorName.localeCompare(right.tutorName);
    });

  return {
    ...base,
    status: 'exact-marginal-value',
    candidates: ranked,
    evaluatedTutorCount: ranked.length,
    guidance: 'Compare exact marginal access and exact-printing price together. Pareto dominance only means another tutor is no more expensive and has at least as much selected-checkpoint marginal card access in this finished deck; it is not an instruction to cut a card and is not a power-level verdict.',
  };
}
