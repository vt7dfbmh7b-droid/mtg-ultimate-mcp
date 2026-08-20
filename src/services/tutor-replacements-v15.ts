import type { ScryfallCard } from '../types/scryfall.js';
import type { ExactFractionV15 } from './exact-statistics-v15.js';
import {
  isColorIdentitySubset,
  resolveEntryCard,
  type DeckEntry,
  type DeckFinish,
  type ParsedDeck,
} from './deck.js';
import { validateCommanderDeck } from './commander-rules.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type EligiblePrintingChoiceV08,
  type PrintingPolicyInputV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { searchCards } from './scryfall.js';
import { parseTutorSpec } from './simulation-v04.js';
import {
  auditTutorValueForMoneyV15,
  type TutorExactPrintingPriceV15,
} from './tutor-value-for-money-v15.js';
import {
  auditWinRouteAccessV15,
  type WinRouteAccessInputV15,
  type WinRouteExactAccessCheckpointV15,
} from './win-route-access-v15.js';

export const MAX_TUTOR_REPLACEMENT_ORACLE_CANDIDATES_V15 = 48;
export const MAX_TUTOR_REPLACEMENT_EXACT_PRINTINGS_V15 = 24;

export type TutorReplacementCheckpointLabelV15 = 'opening-hand' | 'turn-3' | 'turn-5';
export type TutorReplacementAccessRelationshipV15 = 'exact-equivalent' | 'improves' | 'loses' | 'mixed';
export type TutorReplacementPriceRelationshipV15 = 'cheaper' | 'same-price' | 'more-expensive' | 'unknown';
export type TutorReplacementRecommendationClassV15 =
  | 'cheaper-no-worse'
  | 'cheaper-tradeoff'
  | 'price-comparison-unknown'
  | 'not-cost-improvement';

export interface TutorReplacementCheckpointV15 {
  label: TutorReplacementCheckpointLabelV15;
  turn: number;
  incumbentProbability: ExactFractionV15;
  replacementProbability: ExactFractionV15;
  exactReplacementMinusIncumbent: ExactFractionV15;
  percentagePointDelta: number;
}

export interface TutorReplacementCandidateV15 {
  tutorName: string;
  printing: {
    set: string;
    collectorNumber: string;
    finish: DeckFinish | null;
    matchedBy: EligiblePrintingChoiceV08['matchedBy'];
  };
  candidatePriceUsd: number | null;
  incumbentPriceUsd: number | null;
  savingsUsd: number | null;
  priceRelationship: TutorReplacementPriceRelationshipV15;
  accessRelationship: TutorReplacementAccessRelationshipV15;
  recommendationClass: TutorReplacementRecommendationClassV15;
  coversPieces: string[];
  destination: 'hand' | 'battlefield';
  exactAccessComparison: TutorReplacementCheckpointV15[];
  swappedDeckStillExactly100Cards: boolean;
  commanderRulesStillLegal: boolean;
  caveat: string;
}

export type TutorReplacementRejectionCodeV15 =
  | 'same-oracle-card'
  | 'printing-policy-rejected'
  | 'budget-or-price-rejected'
  | 'commander-rules-rejected'
  | 'not-direct-route-access'
  | 'exact-access-unavailable';

export interface TutorReplacementRejectionV15 {
  tutorName: string;
  set: string;
  collectorNumber: string;
  code: TutorReplacementRejectionCodeV15;
  reason: string;
}

export interface TutorReplacementAuditV15 {
  comboId: string;
  incumbentTutorName: string;
  status:
    | 'exact-replacements-audited'
    | 'route-access-unavailable'
    | 'incumbent-not-qualifying'
    | 'incumbent-ambiguous'
    | 'no-candidates';
  incumbentPrice: TutorExactPrintingPriceV15 | null;
  baselineAccess: ReturnType<typeof auditWinRouteAccessV15>;
  candidates: TutorReplacementCandidateV15[];
  rejected: TutorReplacementRejectionV15[];
  candidatePrintingsEvaluated: number;
  comparisonMethod: 'real-one-card-swap-rerun-exact-route-access-v15';
  rankingMethod: 'explicit-class-then-exact-checkpoint-lexicographic-v15';
  guidance: string;
}

export interface TutorReplacementDiscoveryV15 extends TutorReplacementAuditV15 {
  discovery: {
    searchQueries: string[];
    uniqueOracleCandidatesScanned: number;
    routeRelevantOracleCandidates: number;
    exactEligiblePrintingsSelected: number;
    maxOracleCandidates: number;
    maxExactPrintings: number;
    printingPolicy: Record<string, unknown>;
    maxUsdPerCard: number | null;
  };
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
  if (denominator === 0n) throw new Error('Tutor replacement exact fraction denominator cannot be zero.');
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
  if (!Number.isFinite(decimal)) throw new Error('Tutor replacement exact fraction exceeded finite presentation range.');
  return { numerator: n.toString(), denominator: d.toString(), decimal };
}

function subtractFractions(left: ExactFractionV15, right: ExactFractionV15): ExactFractionV15 {
  return exactFraction(
    BigInt(left.numerator) * BigInt(right.denominator) - BigInt(right.numerator) * BigInt(left.denominator),
    BigInt(left.denominator) * BigInt(right.denominator),
  );
}

function compareFractions(left: ExactFractionV15, right: ExactFractionV15): number {
  const difference = BigInt(left.numerator) * BigInt(right.denominator)
    - BigInt(right.numerator) * BigInt(left.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function checkpointMap(access: ReturnType<typeof auditWinRouteAccessV15>): Map<TutorReplacementCheckpointLabelV15, WinRouteExactAccessCheckpointV15> | null {
  if (!access.exactAccess) return null;
  const map = new Map<TutorReplacementCheckpointLabelV15, WinRouteExactAccessCheckpointV15>();
  for (const checkpoint of access.exactAccess.checkpoints) map.set(checkpoint.label, checkpoint);
  for (const label of ['opening-hand', 'turn-3', 'turn-5'] as const) if (!map.has(label)) return null;
  return map;
}

function swapOneMainCard(parsed: ParsedDeck, incumbentIndex: number, choice: EligiblePrintingChoiceV08): ParsedDeck {
  if (incumbentIndex < 0 || incumbentIndex >= parsed.main.length) throw new Error('Incumbent tutor index is outside the main deck.');
  const main: DeckEntry[] = [];
  for (let index = 0; index < parsed.main.length; index += 1) {
    const entry = parsed.main[index]!;
    if (index !== incumbentIndex) {
      main.push({ ...entry });
      continue;
    }
    if (entry.quantity < 1) throw new Error('Cannot replace a zero-quantity tutor entry.');
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

function accessComparison(
  baseline: Map<TutorReplacementCheckpointLabelV15, WinRouteExactAccessCheckpointV15>,
  replacement: Map<TutorReplacementCheckpointLabelV15, WinRouteExactAccessCheckpointV15>,
): { relationship: TutorReplacementAccessRelationshipV15; checkpoints: TutorReplacementCheckpointV15[] } {
  const comparisons: number[] = [];
  const checkpoints = (['opening-hand', 'turn-3', 'turn-5'] as const).map((label) => {
    const incumbent = baseline.get(label)!;
    const swapped = replacement.get(label)!;
    const exactReplacementMinusIncumbent = subtractFractions(swapped.probability, incumbent.probability);
    comparisons.push(compareFractions(swapped.probability, incumbent.probability));
    return {
      label,
      turn: incumbent.turn,
      incumbentProbability: incumbent.probability,
      replacementProbability: swapped.probability,
      exactReplacementMinusIncumbent,
      percentagePointDelta: exactReplacementMinusIncumbent.decimal * 100,
    };
  });
  const relationship: TutorReplacementAccessRelationshipV15 = comparisons.every((value) => value === 0)
    ? 'exact-equivalent'
    : comparisons.every((value) => value >= 0) ? 'improves'
      : comparisons.every((value) => value <= 0) ? 'loses'
        : 'mixed';
  return { relationship, checkpoints };
}

function priceRelationship(candidate: number | null, incumbent: number | null): TutorReplacementPriceRelationshipV15 {
  if (candidate === null || incumbent === null) return 'unknown';
  if (candidate < incumbent - 1e-9) return 'cheaper';
  if (candidate > incumbent + 1e-9) return 'more-expensive';
  return 'same-price';
}

function recommendationClass(
  price: TutorReplacementPriceRelationshipV15,
  access: TutorReplacementAccessRelationshipV15,
): TutorReplacementRecommendationClassV15 {
  if (price === 'unknown') return 'price-comparison-unknown';
  if (price !== 'cheaper') return 'not-cost-improvement';
  return access === 'exact-equivalent' || access === 'improves' ? 'cheaper-no-worse' : 'cheaper-tradeoff';
}

function rejected(
  choice: EligiblePrintingChoiceV08,
  code: TutorReplacementRejectionCodeV15,
  reason: string,
): TutorReplacementRejectionV15 {
  return {
    tutorName: choice.card.name,
    set: choice.card.set.toUpperCase(),
    collectorNumber: choice.card.collector_number,
    code,
    reason,
  };
}

function selectedDelta(candidate: TutorReplacementCandidateV15, label: TutorReplacementCheckpointLabelV15): ExactFractionV15 {
  return candidate.exactAccessComparison.find((checkpoint) => checkpoint.label === label)!.exactReplacementMinusIncumbent;
}

function sortCandidates(candidates: TutorReplacementCandidateV15[]): TutorReplacementCandidateV15[] {
  const classOrder: Record<TutorReplacementRecommendationClassV15, number> = {
    'cheaper-no-worse': 0,
    'cheaper-tradeoff': 1,
    'price-comparison-unknown': 2,
    'not-cost-improvement': 3,
  };
  return [...candidates].sort((left, right) => {
    const classDifference = classOrder[left.recommendationClass] - classOrder[right.recommendationClass];
    if (classDifference !== 0) return classDifference;
    for (const label of ['turn-5', 'turn-3', 'opening-hand'] as const) {
      const comparison = compareFractions(selectedDelta(right, label), selectedDelta(left, label));
      if (comparison !== 0) return comparison;
    }
    const leftSavings = left.savingsUsd ?? Number.NEGATIVE_INFINITY;
    const rightSavings = right.savingsUsd ?? Number.NEGATIVE_INFINITY;
    if (leftSavings !== rightSavings) return rightSavings - leftSavings;
    return left.tutorName.localeCompare(right.tutorName)
      || left.printing.set.localeCompare(right.printing.set)
      || left.printing.collectorNumber.localeCompare(right.printing.collectorNumber);
  });
}

export function auditTutorReplacementCandidatesV15(input: {
  route: WinRouteAccessInputV15;
  parsed: ParsedDeck;
  resolvedCards: readonly ScryfallCard[];
  incumbentTutorName: string;
  candidatePrintings: readonly EligiblePrintingChoiceV08[];
  printingPolicy?: ResolvedPrintingPolicyV08;
  maxUsdPerCard?: number;
}): TutorReplacementAuditV15 {
  const incumbentTutorName = input.incumbentTutorName.trim();
  if (!incumbentTutorName) throw new Error('incumbentTutorName must be non-empty.');
  if (input.candidatePrintings.length > MAX_TUTOR_REPLACEMENT_ORACLE_CANDIDATES_V15) {
    throw new Error(`candidatePrintings must contain at most ${MAX_TUTOR_REPLACEMENT_ORACLE_CANDIDATES_V15} entries.`);
  }

  const tutorValue = auditTutorValueForMoneyV15({ route: input.route, parsed: input.parsed, resolvedCards: input.resolvedCards });
  const baselineAccess = tutorValue.baselineAccess;
  const baselineCheckpoints = checkpointMap(baselineAccess);
  const incumbentMatches = tutorValue.candidates.filter((candidate) => normalizeName(candidate.tutorName) === normalizeName(incumbentTutorName));
  const base = {
    comboId: baselineAccess.comboId,
    incumbentTutorName,
    baselineAccess,
    candidatePrintingsEvaluated: input.candidatePrintings.length,
    comparisonMethod: 'real-one-card-swap-rerun-exact-route-access-v15' as const,
    rankingMethod: 'explicit-class-then-exact-checkpoint-lexicographic-v15' as const,
  };

  if (!baselineCheckpoints) {
    return {
      ...base,
      status: 'route-access-unavailable',
      incumbentPrice: incumbentMatches[0]?.price ?? null,
      candidates: [],
      rejected: [],
      guidance: 'Exact baseline route access is unavailable, so replacement quality is unknown rather than inferred from generic tutor labels.',
    };
  }
  if (incumbentMatches.length === 0) {
    return {
      ...base,
      status: 'incumbent-not-qualifying',
      incumbentPrice: null,
      candidates: [],
      rejected: [],
      guidance: 'The requested incumbent is not a proven direct hand/battlefield tutor for this verified route, so no tutor-replacement comparison was fabricated.',
    };
  }
  if (incumbentMatches.length !== 1) {
    return {
      ...base,
      status: 'incumbent-ambiguous',
      incumbentPrice: null,
      candidates: [],
      rejected: [],
      guidance: 'More than one incumbent tutor entry matched this name. Select an exact physical printing before replacement analysis.',
    };
  }

  const incumbent = incumbentMatches[0]!;
  const candidates: TutorReplacementCandidateV15[] = [];
  const rejections: TutorReplacementRejectionV15[] = [];
  for (const choice of input.candidatePrintings) {
    if (normalizeName(choice.card.name) === normalizeName(incumbent.tutorName)) {
      rejections.push(rejected(choice, 'same-oracle-card', 'A different printing of the incumbent is a printing change, not a tutor replacement.'));
      continue;
    }
    if (input.printingPolicy && !printingMatchesPolicyV08(choice.card, input.printingPolicy)) {
      rejections.push(rejected(choice, 'printing-policy-rejected', 'The exact candidate printing does not satisfy the active physical-printing policy.'));
      continue;
    }
    if (input.maxUsdPerCard !== undefined && (choice.priceUsd === null || choice.priceUsd > input.maxUsdPerCard)) {
      rejections.push(rejected(choice, 'budget-or-price-rejected', 'The exact candidate finish is unpriced or exceeds the active hard per-card USD cap.'));
      continue;
    }

    const swappedParsed = swapOneMainCard(input.parsed, incumbent.mainEntryIndex, choice);
    const swappedResolved = [...input.resolvedCards, choice.card];
    const rules = validateCommanderDeck(swappedParsed, swappedResolved);
    if (!rules.isLegal) {
      const reason = rules.singletonViolations.length > 0
        ? `Singleton conflict: ${rules.singletonViolations.map((item) => String(item.name ?? '')).filter(Boolean).join(', ')}.`
        : rules.colorIdentityViolations.length > 0
          ? 'Candidate uses color identity outside the commander identity.'
          : rules.commanderLegalityViolations.length > 0
            ? 'Candidate is not legal in Commander.'
            : 'The one-card swap failed Commander construction rules.';
      rejections.push(rejected(choice, 'commander-rules-rejected', reason));
      continue;
    }

    const swappedAccess = auditWinRouteAccessV15({ route: input.route, parsed: swappedParsed, resolvedCards: swappedResolved });
    const candidateTutor = swappedAccess.tutors.find((tutor) => normalizeName(tutor.tutorName) === normalizeName(choice.card.name));
    if (!candidateTutor || candidateTutor.use !== 'qualifying-access' || (candidateTutor.destination !== 'hand' && candidateTutor.destination !== 'battlefield')) {
      rejections.push(rejected(
        choice,
        'not-direct-route-access',
        candidateTutor?.reason ?? 'The candidate is not proven by the established tutor parser to directly access a library component of this route.',
      ));
      continue;
    }
    const replacementCheckpoints = checkpointMap(swappedAccess);
    if (!replacementCheckpoints) {
      rejections.push(rejected(choice, 'exact-access-unavailable', 'The real one-card swap did not produce a complete exact opening/turn-3/turn-5 route-access curve.'));
      continue;
    }

    const comparison = accessComparison(baselineCheckpoints, replacementCheckpoints);
    const incumbentPriceUsd = incumbent.price.priceUsd;
    const relationship = priceRelationship(choice.priceUsd, incumbentPriceUsd);
    candidates.push({
      tutorName: choice.card.name,
      printing: {
        set: choice.card.set.toUpperCase(),
        collectorNumber: choice.card.collector_number,
        finish: choice.finish,
        matchedBy: choice.matchedBy,
      },
      candidatePriceUsd: choice.priceUsd,
      incumbentPriceUsd,
      savingsUsd: choice.priceUsd !== null && incumbentPriceUsd !== null ? incumbentPriceUsd - choice.priceUsd : null,
      priceRelationship: relationship,
      accessRelationship: comparison.relationship,
      recommendationClass: recommendationClass(relationship, comparison.relationship),
      coversPieces: [...candidateTutor.coversPieces],
      destination: candidateTutor.destination,
      exactAccessComparison: comparison.checkpoints,
      swappedDeckStillExactly100Cards: swappedParsed.totalCards === 100,
      commanderRulesStillLegal: rules.isLegal,
      caveat: 'This compares exact card-component access after a literal one-card swap. Tutor mana cost, timing, card utility outside this route, protection, interaction, non-card prerequisites and tournament causality remain separate considerations.',
    });
  }

  return {
    ...base,
    status: candidates.length > 0 ? 'exact-replacements-audited' : 'no-candidates',
    incumbentPrice: incumbent.price,
    candidates: sortCandidates(candidates),
    rejected: rejections,
    guidance: candidates.length > 0
      ? 'Prefer the explicit cheaper-no-worse class when cost reduction is the goal. Cheaper-tradeoff candidates expose their exact access loss at every checkpoint rather than hiding it in a weighted score.'
      : 'No supplied exact printing survived the one-card Commander legality and direct-route-access audit. Absence from this candidate batch is not proof that no replacement exists outside the bounded discovery set.',
  };
}

function minObservedUsd(card: ScryfallCard): number {
  const values = [card.prices?.usd, card.prices?.usd_foil, card.prices?.usd_etched]
    .map((value) => value ? Number.parseFloat(value) : Number.NaN)
    .filter(Number.isFinite);
  return values.length > 0 ? Math.min(...values) : Number.POSITIVE_INFINITY;
}

function provisionalChoice(card: ScryfallCard): EligiblePrintingChoiceV08 {
  return { card, finish: null, priceUsd: null, matchedBy: 'unrestricted' };
}

export interface TutorReplacementDiscoveryDependenciesV15 {
  search?: typeof searchCards;
  resolvePolicy?: typeof resolvePrintingPolicyV08;
  selectPrinting?: typeof selectEligiblePrintingV08;
}

export async function discoverTutorReplacementsV15(input: {
  route: WinRouteAccessInputV15;
  parsed: ParsedDeck;
  resolvedCards: readonly ScryfallCard[];
  incumbentTutorName: string;
  printingPolicy?: PrintingPolicyInputV08;
  maxUsdPerCard?: number;
}, dependencies: TutorReplacementDiscoveryDependenciesV15 = {}): Promise<TutorReplacementDiscoveryV15> {
  const search = dependencies.search ?? searchCards;
  const resolvePolicy = dependencies.resolvePolicy ?? resolvePrintingPolicyV08;
  const selectPrinting = dependencies.selectPrinting ?? selectEligiblePrintingV08;
  const policy = await resolvePolicy(input.printingPolicy ?? {});
  const commanderRules = validateCommanderDeck(input.parsed, [...input.resolvedCards]);
  const commanderIdentity = commanderRules.commanderColorIdentity;
  const baseQuery = 'game:paper o:"search your library for"';
  const queries = [
    ...(policy.searchClause ? [`${baseQuery} ${policy.searchClause}`] : []),
    `${baseQuery} mv<=2`,
    `${baseQuery} mv=3`,
    `${baseQuery} mv>=4`,
  ];

  const oracleByName = new Map<string, ScryfallCard>();
  for (const query of queries) {
    const found = await search(query, 50);
    for (const card of found) {
      if (oracleByName.size >= MAX_TUTOR_REPLACEMENT_ORACLE_CANDIDATES_V15) break;
      if (card.digital || card.legalities.commander !== 'legal') continue;
      if (!isColorIdentitySubset(card.color_identity, commanderIdentity)) continue;
      if (normalizeName(card.name) === normalizeName(input.incumbentTutorName)) continue;
      if (!parseTutorSpec(card).isTutor) continue;
      if (!oracleByName.has(normalizeName(card.name))) oracleByName.set(normalizeName(card.name), card);
    }
    if (oracleByName.size >= MAX_TUTOR_REPLACEMENT_ORACLE_CANDIDATES_V15) break;
  }

  const oracleCandidates = [...oracleByName.values()].sort((left, right) => minObservedUsd(left) - minObservedUsd(right) || left.name.localeCompare(right.name));
  const provisional = auditTutorReplacementCandidatesV15({
    route: input.route,
    parsed: input.parsed,
    resolvedCards: input.resolvedCards,
    incumbentTutorName: input.incumbentTutorName,
    candidatePrintings: oracleCandidates.map(provisionalChoice),
  });
  const routeRelevantNames = new Set(provisional.candidates.map((candidate) => normalizeName(candidate.tutorName)));

  const exactChoices: EligiblePrintingChoiceV08[] = [];
  for (const card of oracleCandidates) {
    if (!routeRelevantNames.has(normalizeName(card.name))) continue;
    if (exactChoices.length >= MAX_TUTOR_REPLACEMENT_EXACT_PRINTINGS_V15) break;
    const choice = await selectPrinting(card, policy, input.maxUsdPerCard);
    if (choice) exactChoices.push(choice);
  }

  const audited = auditTutorReplacementCandidatesV15({
    route: input.route,
    parsed: input.parsed,
    resolvedCards: input.resolvedCards,
    incumbentTutorName: input.incumbentTutorName,
    candidatePrintings: exactChoices,
    printingPolicy: policy,
    ...(input.maxUsdPerCard !== undefined ? { maxUsdPerCard: input.maxUsdPerCard } : {}),
  });
  return {
    ...audited,
    discovery: {
      searchQueries: queries,
      uniqueOracleCandidatesScanned: oracleCandidates.length,
      routeRelevantOracleCandidates: routeRelevantNames.size,
      exactEligiblePrintingsSelected: exactChoices.length,
      maxOracleCandidates: MAX_TUTOR_REPLACEMENT_ORACLE_CANDIDATES_V15,
      maxExactPrintings: MAX_TUTOR_REPLACEMENT_EXACT_PRINTINGS_V15,
      printingPolicy: describePrintingPolicyV08(policy),
      maxUsdPerCard: input.maxUsdPerCard ?? null,
    },
  };
}
