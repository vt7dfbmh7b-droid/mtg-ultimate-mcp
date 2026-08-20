import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck, type CommanderRulesResult } from './commander-rules.js';
import { candidatePriceCapV07 } from './deck-builder-v07.js';
import {
  isColorIdentitySubset,
  resolveEntryCard,
  type DeckEntry,
  type ParsedDeck,
} from './deck.js';
import type { ExactFractionV15 } from './exact-statistics-v15.js';
import {
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type EligiblePrintingChoiceV08,
  type PrintingPolicyInputV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { searchCards } from './scryfall.js';
import {
  auditTutorValueForMoneyV15,
  type TutorExactPrintingPriceV15,
  type TutorValueCandidateV15,
  type TutorValueForMoneyAuditV15,
} from './tutor-value-for-money-v15.js';
import {
  auditWinRouteAccessV15,
  type WinRouteAccessAuditV15,
  type WinRouteAccessInputV15,
  type WinRouteExactAccessCheckpointV15,
} from './win-route-access-v15.js';

export const MAX_TUTOR_REPLACEMENT_SOURCE_TUTORS_V15 = 8;
export const MAX_TUTOR_REPLACEMENT_SEARCH_RESULTS_V15 = 50;

export type TutorReplacementCheckpointLabelV15 = 'opening-hand' | 'turn-3' | 'turn-5';

export type TutorReplacementClassificationV15 =
  | 'access-equivalent-cheaper'
  | 'cheaper-no-access-loss'
  | 'cheaper-within-requested-access-loss'
  | 'cheaper-with-access-loss'
  | 'not-cheaper'
  | 'price-unknown';

export type TutorReplacementRejectionCodeV15 =
  | 'color-identity-or-legality'
  | 'printing-or-budget-ineligible'
  | 'same-exact-printing'
  | 'commander-rules-failed'
  | 'not-route-qualifying'
  | 'exact-access-unavailable';

export interface TutorReplacementConstraintsV15 extends PrintingPolicyInputV08 {
  maxUsdPerCard?: number;
  candidateMaxUsdPerCard?: number;
  excludedCards?: readonly string[];
  maxAccessLossPercentagePoints?: number;
}

export interface TutorReplacementPriceV15 {
  status: 'available' | 'price-unavailable';
  printing: {
    name: string;
    set: string;
    collectorNumber: string;
  };
  finish: EligiblePrintingChoiceV08['finish'];
  priceUsd: number | null;
  matchedBy: EligiblePrintingChoiceV08['matchedBy'];
  basis: 'eligible-exact-printing-finish-v15';
}

export interface TutorReplacementAccessCheckpointV15 {
  label: TutorReplacementCheckpointLabelV15;
  turn: number;
  baselineProbability: ExactFractionV15;
  replacementProbability: ExactFractionV15;
  exactDifference: ExactFractionV15;
  differencePercentagePoints: number;
  accessLossPercentagePoints: number;
}

export interface TutorReplacementCandidateV15 {
  sourceTutorName: string;
  replacementTutorName: string;
  sourceMainEntryIndex: number;
  sourceCoversPieces: string[];
  replacementCoversPieces: string[];
  replacementDestination: 'hand' | 'battlefield';
  sourcePrice: TutorExactPrintingPriceV15;
  replacementPrice: TutorReplacementPriceV15;
  priceDeltaUsd: number | null;
  priceSavingsUsd: number | null;
  exactAccess: TutorReplacementAccessCheckpointV15[];
  maximumAccessLossPercentagePoints: number;
  classification: TutorReplacementClassificationV15;
  commanderRules: {
    status: CommanderRulesResult['status'];
    isLegal: boolean;
  };
  caveat: string;
}

export interface TutorReplacementRejectedCandidateV15 {
  sourceTutorName: string;
  replacementTutorName: string;
  code: TutorReplacementRejectionCodeV15;
  reason: string;
}

export interface TutorReplacementSourceAuditV15 {
  sourceTutorName: string;
  sourcePrice: TutorExactPrintingPriceV15;
  sourceCoversPieces: string[];
  replacements: TutorReplacementCandidateV15[];
  rejected: TutorReplacementRejectedCandidateV15[];
}

export interface TutorReplacementIntelligenceV15 {
  comboId: string;
  status:
    | 'replacement-options-evaluated'
    | 'access-unavailable'
    | 'no-qualifying-source-tutors'
    | 'source-tutor-not-found'
    | 'source-selection-required'
    | 'commander-context-incomplete'
    | 'candidate-search-unavailable';
  baselineValue: TutorValueForMoneyAuditV15;
  sourceTutorChoices: string[];
  sources: TutorReplacementSourceAuditV15[];
  candidatePool: {
    query: string | null;
    ordering: 'scryfall-edhrec';
    maximumSearchResults: number;
    returnedSearchResults: number;
    eligibleExactPrintings: number;
    completeness: 'bounded-top-results-not-exhaustive';
  };
  threshold: {
    maxAccessLossPercentagePoints: number | null;
    semantics: 'applies-independently-to-opening-turn3-turn5';
  };
  guidance: string;
}

export interface TutorReplacementDependenciesV15 {
  search?: typeof searchCards;
  resolvePrintingPolicy?: typeof resolvePrintingPolicyV08;
  selectEligiblePrinting?: typeof selectEligiblePrintingV08;
  validateDeck?: typeof validateCommanderDeck;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
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

function signedFraction(numerator: bigint, denominator: bigint): ExactFractionV15 {
  if (denominator === 0n) throw new Error('Exact tutor-replacement fraction denominator cannot be zero.');
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
  if (!Number.isFinite(decimal)) throw new Error('Exact tutor-replacement decimal presentation exceeded the finite Number range.');
  return { numerator: n.toString(), denominator: d.toString(), decimal };
}

function subtractFractions(left: ExactFractionV15, right: ExactFractionV15): ExactFractionV15 {
  return signedFraction(
    BigInt(left.numerator) * BigInt(right.denominator) - BigInt(right.numerator) * BigInt(left.denominator),
    BigInt(left.denominator) * BigInt(right.denominator),
  );
}

function compareFractions(left: ExactFractionV15, right: ExactFractionV15): number {
  const difference = BigInt(left.numerator) * BigInt(right.denominator)
    - BigInt(right.numerator) * BigInt(left.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function checkpointMap(access: WinRouteAccessAuditV15): Map<TutorReplacementCheckpointLabelV15, WinRouteExactAccessCheckpointV15> | null {
  if (!access.exactAccess) return null;
  const output = new Map<TutorReplacementCheckpointLabelV15, WinRouteExactAccessCheckpointV15>();
  for (const checkpoint of access.exactAccess.checkpoints) output.set(checkpoint.label, checkpoint);
  for (const label of ['opening-hand', 'turn-3', 'turn-5'] as const) if (!output.has(label)) return null;
  return output;
}

function exactAccessComparison(
  baseline: Map<TutorReplacementCheckpointLabelV15, WinRouteExactAccessCheckpointV15>,
  replacement: Map<TutorReplacementCheckpointLabelV15, WinRouteExactAccessCheckpointV15>,
): TutorReplacementAccessCheckpointV15[] {
  return (['opening-hand', 'turn-3', 'turn-5'] as const).map((label) => {
    const baselineCheckpoint = baseline.get(label)!;
    const replacementCheckpoint = replacement.get(label)!;
    const exactDifference = subtractFractions(replacementCheckpoint.probability, baselineCheckpoint.probability);
    const differencePercentagePoints = exactDifference.decimal * 100;
    return {
      label,
      turn: baselineCheckpoint.turn,
      baselineProbability: baselineCheckpoint.probability,
      replacementProbability: replacementCheckpoint.probability,
      exactDifference,
      differencePercentagePoints,
      accessLossPercentagePoints: Math.max(0, -differencePercentagePoints),
    };
  });
}

function replacementPrice(choice: EligiblePrintingChoiceV08): TutorReplacementPriceV15 {
  return {
    status: choice.priceUsd === null ? 'price-unavailable' : 'available',
    printing: {
      name: choice.card.name,
      set: choice.card.set.toUpperCase(),
      collectorNumber: choice.card.collector_number,
    },
    finish: choice.finish,
    priceUsd: choice.priceUsd,
    matchedBy: choice.matchedBy,
    basis: 'eligible-exact-printing-finish-v15',
  };
}

function classifyReplacement(
  source: TutorValueCandidateV15,
  candidatePrice: TutorReplacementPriceV15,
  access: TutorReplacementAccessCheckpointV15[],
  threshold: number | null,
): TutorReplacementClassificationV15 {
  const sourcePrice = source.price.priceUsd;
  const replacementUsd = candidatePrice.priceUsd;
  if (sourcePrice === null || replacementUsd === null) return 'price-unknown';
  if (replacementUsd >= sourcePrice - 1e-9) return 'not-cheaper';

  const allEqual = access.every((checkpoint) => compareFractions(
    checkpoint.replacementProbability,
    checkpoint.baselineProbability,
  ) === 0);
  if (allEqual) return 'access-equivalent-cheaper';

  const noAccessLoss = access.every((checkpoint) => compareFractions(
    checkpoint.replacementProbability,
    checkpoint.baselineProbability,
  ) >= 0);
  if (noAccessLoss) return 'cheaper-no-access-loss';

  if (threshold !== null && access.every((checkpoint) => checkpoint.accessLossPercentagePoints <= threshold + 1e-9)) {
    return 'cheaper-within-requested-access-loss';
  }
  return 'cheaper-with-access-loss';
}

function classificationPriority(value: TutorReplacementClassificationV15): number {
  return ({
    'access-equivalent-cheaper': 0,
    'cheaper-no-access-loss': 1,
    'cheaper-within-requested-access-loss': 2,
    'cheaper-with-access-loss': 3,
    'not-cheaper': 4,
    'price-unknown': 5,
  } satisfies Record<TutorReplacementClassificationV15, number>)[value];
}

function identityQuery(colors: readonly string[]): string {
  return colors.length === 0 ? 'id:c' : `id<=${colors.join('').toLocaleLowerCase()}`;
}

function replacementSearchQuery(colors: readonly string[], policy: ResolvedPrintingPolicyV08): string {
  return [
    'f:commander',
    identityQuery(colors),
    'o:"search your library for"',
    policy.searchClause,
  ].filter(Boolean).join(' ');
}

function candidatePriceCap(input: TutorReplacementConstraintsV15): number | undefined {
  return candidatePriceCapV07({
    ...(input.maxUsdPerCard !== undefined ? { maxUsdPerCard: input.maxUsdPerCard } : {}),
    ...(input.candidateMaxUsdPerCard !== undefined ? { candidateMaxUsdPerCard: input.candidateMaxUsdPerCard } : {}),
  });
}

function replacementParsedDeck(
  parsed: ParsedDeck,
  sourceMainEntryIndex: number,
  choice: EligiblePrintingChoiceV08,
): ParsedDeck {
  if (sourceMainEntryIndex < 0 || sourceMainEntryIndex >= parsed.main.length) {
    throw new Error('sourceMainEntryIndex is outside the parsed main deck.');
  }
  const main: DeckEntry[] = [];
  for (let index = 0; index < parsed.main.length; index += 1) {
    const entry = parsed.main[index]!;
    if (index !== sourceMainEntryIndex) {
      main.push({ ...entry });
      continue;
    }
    if (entry.quantity < 1) throw new Error('Tutor replacement cannot remove a copy from a zero-quantity entry.');
    if (entry.quantity > 1) main.push({ ...entry, quantity: entry.quantity - 1 });
  }
  main.push({
    name: choice.card.name,
    quantity: 1,
    set: choice.card.set.toUpperCase(),
    collectorNumber: choice.card.collector_number,
    ...(choice.finish ? { finish: choice.finish } : {}),
  });
  const totalMain = main.reduce((sum, entry) => sum + entry.quantity, 0);
  return {
    main,
    commanders: parsed.commanders.map((entry) => ({ ...entry })),
    totalMain,
    totalCommanders: parsed.totalCommanders,
    totalCards: totalMain + parsed.totalCommanders,
  };
}

function sameExactPrinting(sourceEntry: DeckEntry, sourceCard: ScryfallCard, choice: EligiblePrintingChoiceV08): boolean {
  const sourceSet = sourceEntry.set ?? sourceCard.set;
  const sourceCollector = sourceEntry.collectorNumber ?? sourceCard.collector_number;
  const sourceFinish = sourceEntry.finish ?? null;
  return normalizeName(sourceCard.name) === normalizeName(choice.card.name)
    && normalizeName(sourceSet) === normalizeName(choice.card.set)
    && normalizeName(sourceCollector) === normalizeName(choice.card.collector_number)
    && sourceFinish === choice.finish;
}

function commanderContext(parsed: ParsedDeck, resolvedCards: readonly ScryfallCard[]): {
  complete: boolean;
  cards: ScryfallCard[];
  identity: string[];
} {
  const mutable = [...resolvedCards];
  const cards = parsed.commanders
    .map((entry) => resolveEntryCard(entry, mutable))
    .filter((card): card is ScryfallCard => Boolean(card));
  return {
    complete: cards.length === parsed.commanders.length && cards.length > 0,
    cards,
    identity: [...new Set(cards.flatMap((card) => card.color_identity))].sort(),
  };
}

function sourceChoices(value: TutorValueForMoneyAuditV15): string[] {
  return uniqueSorted(value.candidates.map((candidate) => candidate.tutorName));
}

function emptyCandidatePool(query: string | null): TutorReplacementIntelligenceV15['candidatePool'] {
  return {
    query,
    ordering: 'scryfall-edhrec',
    maximumSearchResults: MAX_TUTOR_REPLACEMENT_SEARCH_RESULTS_V15,
    returnedSearchResults: 0,
    eligibleExactPrintings: 0,
    completeness: 'bounded-top-results-not-exhaustive',
  };
}

export async function auditTutorReplacementsV15(input: {
  route: WinRouteAccessInputV15;
  parsed: ParsedDeck;
  resolvedCards: readonly ScryfallCard[];
  sourceTutorName?: string;
  constraints?: TutorReplacementConstraintsV15;
}, dependencies: TutorReplacementDependenciesV15 = {}): Promise<TutorReplacementIntelligenceV15> {
  const constraints = input.constraints ?? {};
  const threshold = constraints.maxAccessLossPercentagePoints ?? null;
  if (threshold !== null && (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)) {
    throw new Error('maxAccessLossPercentagePoints must be between 0 and 100 when supplied.');
  }

  const baselineValue = auditTutorValueForMoneyV15({
    route: input.route,
    parsed: input.parsed,
    resolvedCards: input.resolvedCards,
  });
  const choices = sourceChoices(baselineValue);
  const common = {
    comboId: baselineValue.comboId,
    baselineValue,
    sourceTutorChoices: choices,
    sources: [] as TutorReplacementSourceAuditV15[],
    candidatePool: emptyCandidatePool(null),
    threshold: {
      maxAccessLossPercentagePoints: threshold,
      semantics: 'applies-independently-to-opening-turn3-turn5' as const,
    },
  };

  if (baselineValue.status === 'access-unavailable') {
    return {
      ...common,
      status: 'access-unavailable',
      guidance: 'Exact route access is unavailable, so replacement quality is unknown rather than estimated from tutor counts or prices.',
    };
  }
  if (baselineValue.candidates.length === 0) {
    return {
      ...common,
      status: 'no-qualifying-source-tutors',
      guidance: 'No current direct hand/battlefield tutor was proven to access an explicit library component of this verified route.',
    };
  }

  let sources = baselineValue.candidates;
  if (input.sourceTutorName?.trim()) {
    const wanted = normalizeName(input.sourceTutorName);
    sources = sources.filter((candidate) => normalizeName(candidate.tutorName) === wanted);
    if (sources.length === 0) {
      return {
        ...common,
        status: 'source-tutor-not-found',
        guidance: `${input.sourceTutorName.trim()} is not one of the route-qualified tutor entries in this finished deck.`,
      };
    }
  } else if (sources.length > MAX_TUTOR_REPLACEMENT_SOURCE_TUTORS_V15) {
    return {
      ...common,
      status: 'source-selection-required',
      guidance: `This route has ${sources.length} qualifying tutor entries. Choose one source tutor so replacement search stays within the bounded exact-counterfactual workload of ${MAX_TUTOR_REPLACEMENT_SOURCE_TUTORS_V15} automatic sources.`,
    };
  }

  const commander = commanderContext(input.parsed, input.resolvedCards);
  if (!commander.complete) {
    return {
      ...common,
      status: 'commander-context-incomplete',
      guidance: 'One or more commander cards could not be resolved exactly, so replacement color-identity legality is unknown rather than assumed.',
    };
  }

  const resolvePolicy = dependencies.resolvePrintingPolicy ?? resolvePrintingPolicyV08;
  const policy = await resolvePolicy({
    ...(constraints.allowedSets ? { allowedSets: [...constraints.allowedSets] } : {}),
    ...(constraints.printingFamily ? { printingFamily: constraints.printingFamily } : {}),
    ...(constraints.includePromos !== undefined ? { includePromos: constraints.includePromos } : {}),
    ...(constraints.includeSpecialReleases !== undefined ? { includeSpecialReleases: constraints.includeSpecialReleases } : {}),
  });
  const query = replacementSearchQuery(commander.identity, policy);
  const candidatePool = emptyCandidatePool(query);
  const search = dependencies.search ?? searchCards;
  let rawCandidates: ScryfallCard[];
  try {
    rawCandidates = await search(query, MAX_TUTOR_REPLACEMENT_SEARCH_RESULTS_V15);
  } catch (error) {
    return {
      ...common,
      candidatePool,
      status: 'candidate-search-unavailable',
      guidance: `Scryfall replacement discovery was unavailable${error instanceof Error ? `: ${error.message}` : ''}. This is unknown availability, not evidence that no cheaper tutor exists.`,
    };
  }
  candidatePool.returnedSearchResults = rawCandidates.length;

  const excluded = new Set((constraints.excludedCards ?? []).map(normalizeName));
  const selectPrinting = dependencies.selectEligiblePrinting ?? selectEligiblePrintingV08;
  const priceCap = candidatePriceCap(constraints);
  const eligibleByName = new Map<string, EligiblePrintingChoiceV08>();
  for (const card of rawCandidates) {
    if (excluded.has(normalizeName(card.name))) continue;
    if (card.legalities.commander !== 'legal' || !isColorIdentitySubset(card.color_identity, commander.identity)) continue;
    const choice = await selectPrinting(card, policy, priceCap);
    if (!choice) continue;
    const key = normalizeName(choice.card.name);
    const existing = eligibleByName.get(key);
    if (!existing
      || (choice.priceUsd !== null && (existing.priceUsd === null || choice.priceUsd < existing.priceUsd))) {
      eligibleByName.set(key, choice);
    }
  }
  const eligibleChoices = [...eligibleByName.values()];
  candidatePool.eligibleExactPrintings = eligibleChoices.length;

  const baselineCheckpoints = checkpointMap(baselineValue.baselineAccess);
  if (!baselineCheckpoints) {
    return {
      ...common,
      candidatePool,
      status: 'access-unavailable',
      guidance: 'Baseline route access does not expose all selected exact checkpoints, so replacement access was not estimated.',
    };
  }

  const mutableResolvedCards = [...input.resolvedCards];
  const validateDeck = dependencies.validateDeck ?? validateCommanderDeck;
  const sourceAudits: TutorReplacementSourceAuditV15[] = [];

  for (const source of sources) {
    const sourceEntry = input.parsed.main[source.mainEntryIndex];
    const sourceCard = sourceEntry ? resolveEntryCard(sourceEntry, mutableResolvedCards) : undefined;
    if (!sourceEntry || !sourceCard) continue;
    const accepted: TutorReplacementCandidateV15[] = [];
    const rejected: TutorReplacementRejectedCandidateV15[] = [];

    for (const choice of eligibleChoices) {
      const replacementName = choice.card.name;
      if (sameExactPrinting(sourceEntry, sourceCard, choice)) {
        rejected.push({
          sourceTutorName: source.tutorName,
          replacementTutorName: replacementName,
          code: 'same-exact-printing',
          reason: 'Candidate is the same exact card printing and finish as the source slot.',
        });
        continue;
      }

      const replaced = replacementParsedDeck(input.parsed, source.mainEntryIndex, choice);
      if (replaced.totalCards !== input.parsed.totalCards || replaced.totalCards !== 100) {
        throw new Error('Tutor replacement must preserve the exact 100-card Commander population.');
      }
      const replacementResolvedCards = [choice.card, ...input.resolvedCards];
      const commanderRules = validateDeck(replaced, replacementResolvedCards);
      if (!commanderRules.isLegal) {
        rejected.push({
          sourceTutorName: source.tutorName,
          replacementTutorName: replacementName,
          code: 'commander-rules-failed',
          reason: 'The one-for-one replacement failed the existing Commander legality/singleton/color-identity validation.',
        });
        continue;
      }

      const access = auditWinRouteAccessV15({
        route: input.route,
        parsed: replaced,
        resolvedCards: replacementResolvedCards,
      });
      const tutorAudit = access.tutors.find((candidate) =>
        candidate.use === 'qualifying-access'
        && normalizeName(candidate.tutorName) === normalizeName(choice.card.name));
      if (!tutorAudit || (tutorAudit.destination !== 'hand' && tutorAudit.destination !== 'battlefield')) {
        rejected.push({
          sourceTutorName: source.tutorName,
          replacementTutorName: replacementName,
          code: 'not-route-qualifying',
          reason: 'The existing hardened tutor parser/matcher did not prove this exact card can directly access a required library component of the route.',
        });
        continue;
      }
      const replacementCheckpoints = checkpointMap(access);
      if (!replacementCheckpoints) {
        rejected.push({
          sourceTutorName: source.tutorName,
          replacementTutorName: replacementName,
          code: 'exact-access-unavailable',
          reason: 'Exact route access was unavailable after the swap, so no replacement value claim was fabricated.',
        });
        continue;
      }

      const exactAccess = exactAccessComparison(baselineCheckpoints, replacementCheckpoints);
      const price = replacementPrice(choice);
      const sourceUsd = source.price.priceUsd;
      const replacementUsd = price.priceUsd;
      accepted.push({
        sourceTutorName: source.tutorName,
        replacementTutorName: choice.card.name,
        sourceMainEntryIndex: source.mainEntryIndex,
        sourceCoversPieces: [...source.coversPieces],
        replacementCoversPieces: [...tutorAudit.coversPieces],
        replacementDestination: tutorAudit.destination,
        sourcePrice: source.price,
        replacementPrice: price,
        priceDeltaUsd: sourceUsd !== null && replacementUsd !== null ? replacementUsd - sourceUsd : null,
        priceSavingsUsd: sourceUsd !== null && replacementUsd !== null ? sourceUsd - replacementUsd : null,
        exactAccess,
        maximumAccessLossPercentagePoints: Math.max(...exactAccess.map((checkpoint) => checkpoint.accessLossPercentagePoints)),
        classification: classifyReplacement(source, price, exactAccess, threshold),
        commanderRules: { status: commanderRules.status, isLegal: commanderRules.isLegal },
        caveat: 'This is exact card-component access for a one-for-one physical tutor swap. It does not claim the candidate is globally better, model tutor casting/timing or interaction, or prove tournament causality.',
      });
    }

    accepted.sort((left, right) => {
      const classOrder = classificationPriority(left.classification) - classificationPriority(right.classification);
      if (classOrder !== 0) return classOrder;
      if (left.replacementPrice.priceUsd !== null && right.replacementPrice.priceUsd !== null
        && left.replacementPrice.priceUsd !== right.replacementPrice.priceUsd) {
        return left.replacementPrice.priceUsd - right.replacementPrice.priceUsd;
      }
      if (left.maximumAccessLossPercentagePoints !== right.maximumAccessLossPercentagePoints) {
        return left.maximumAccessLossPercentagePoints - right.maximumAccessLossPercentagePoints;
      }
      return left.replacementTutorName.localeCompare(right.replacementTutorName);
    });

    sourceAudits.push({
      sourceTutorName: source.tutorName,
      sourcePrice: source.price,
      sourceCoversPieces: [...source.coversPieces],
      replacements: accepted,
      rejected,
    });
  }

  return {
    ...common,
    candidatePool,
    status: 'replacement-options-evaluated',
    sources: sourceAudits,
    guidance: eligibleChoices.length === 0
      ? 'No exact-printing candidate survived the active bounded search/printing/budget filters. Because discovery is a bounded EDHREC-ordered Scryfall sample, this is not proof that no replacement exists.'
      : 'Compare exact access and exact-printing price per source tutor. Only access-equivalent-cheaper and cheaper-no-access-loss are hard no-access-loss improvements; a near-equivalent label appears only when the caller explicitly supplied an access-loss threshold. TopDeck evidence, if attached later, remains advisory.',
  };
}
