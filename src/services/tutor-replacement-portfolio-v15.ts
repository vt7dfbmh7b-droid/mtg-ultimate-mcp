import type { ScryfallCard } from '../types/scryfall.js';
import {
  resolveEntryCard,
  type DeckEntry,
  type ParsedDeck,
} from './deck.js';
import type { ExactFractionV15 } from './exact-statistics-v15.js';
import {
  getCardsByIdentifiers,
  type CardIdentifierInput,
} from './scryfall.js';
import type {
  TutorReplacementCandidateV15,
  TutorReplacementIntelligenceV15,
} from './tutor-replacement-intelligence-v15.js';
import {
  auditWinRouteAccessV15,
  type WinRouteAccessInputV15,
  type WinRouteExactAccessCheckpointV15,
} from './win-route-access-v15.js';

export const MAX_TUTOR_REPLACEMENT_PORTFOLIO_ROUTES_V15 = 8;

export type TutorReplacementPortfolioRouteStatusV15 =
  | 'no-access-loss'
  | 'within-requested-access-loss'
  | 'access-loss'
  | 'access-unavailable';

export type TutorReplacementPortfolioStatusV15 =
  | 'no-access-loss'
  | 'within-requested-access-loss'
  | 'access-loss'
  | 'incomplete';

export interface TutorReplacementPortfolioCheckpointV15 {
  label: 'opening-hand' | 'turn-3' | 'turn-5';
  turn: number;
  baselineProbability: ExactFractionV15;
  replacementProbability: ExactFractionV15;
  exactDifference: ExactFractionV15;
  differencePercentagePoints: number;
  accessLossPercentagePoints: number;
}

export interface TutorReplacementPortfolioRouteAuditV15 {
  comboId: string;
  status: TutorReplacementPortfolioRouteStatusV15;
  exactAccess: TutorReplacementPortfolioCheckpointV15[] | null;
  maximumAccessLossPercentagePoints: number | null;
  reason: string;
}

export interface TutorReplacementPortfolioCandidateAuditV15 {
  sourceTutorName: string;
  replacementTutorName: string;
  sourceMainEntryIndex: number;
  replacementPrinting: {
    set: string;
    collectorNumber: string;
    finish: 'foil' | 'etched' | 'nonfoil' | null;
  };
  primaryRouteClassification: TutorReplacementCandidateV15['classification'];
  status: TutorReplacementPortfolioStatusV15;
  safeNoExactAccessLossAcrossPortfolio: boolean;
  withinRequestedToleranceAcrossPortfolio: boolean;
  maximumAccessLossPercentagePoints: number | null;
  routes: TutorReplacementPortfolioRouteAuditV15[];
}

export interface TutorReplacementPortfolioAuditV15 {
  status:
    | 'portfolio-evaluated'
    | 'no-replacement-candidates'
    | 'too-many-verified-routes'
    | 'candidate-resolution-unavailable';
  routeCount: number;
  maximumRoutes: number;
  routeIds: string[];
  thresholdPercentagePoints: number | null;
  candidates: TutorReplacementPortfolioCandidateAuditV15[];
  unresolvedReplacementPrintings: string[];
  guidance: string;
}

export interface TutorReplacementPortfolioDependenciesV15 {
  resolveCards?: typeof getCardsByIdentifiers;
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

function signedFraction(numerator: bigint, denominator: bigint): ExactFractionV15 {
  if (denominator === 0n) throw new Error('Tutor replacement portfolio fraction denominator cannot be zero.');
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
  if (!Number.isFinite(decimal)) throw new Error('Tutor replacement portfolio decimal exceeded the finite Number range.');
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

function checkpointMap(access: ReturnType<typeof auditWinRouteAccessV15>): Map<
  TutorReplacementPortfolioCheckpointV15['label'],
  WinRouteExactAccessCheckpointV15
> | null {
  if (!access.exactAccess) return null;
  const output = new Map<TutorReplacementPortfolioCheckpointV15['label'], WinRouteExactAccessCheckpointV15>();
  for (const checkpoint of access.exactAccess.checkpoints) output.set(checkpoint.label, checkpoint);
  for (const label of ['opening-hand', 'turn-3', 'turn-5'] as const) if (!output.has(label)) return null;
  return output;
}

function compareAccess(
  baseline: Map<TutorReplacementPortfolioCheckpointV15['label'], WinRouteExactAccessCheckpointV15>,
  replacement: Map<TutorReplacementPortfolioCheckpointV15['label'], WinRouteExactAccessCheckpointV15>,
): TutorReplacementPortfolioCheckpointV15[] {
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

function uniqueRoutes(routes: readonly WinRouteAccessInputV15[]): WinRouteAccessInputV15[] {
  const output = new Map<string, WinRouteAccessInputV15>();
  for (const route of routes) {
    const id = route.comboId.trim();
    if (!id || output.has(id)) continue;
    output.set(id, route);
  }
  return [...output.values()];
}

function candidateIdentifier(candidate: TutorReplacementCandidateV15): CardIdentifierInput {
  return {
    name: candidate.replacementTutorName,
    set: candidate.replacementPrice.printing.set,
    collectorNumber: candidate.replacementPrice.printing.collectorNumber,
  };
}

function candidateKey(candidate: TutorReplacementCandidateV15): string {
  return [
    normalizeName(candidate.replacementTutorName),
    normalizeName(candidate.replacementPrice.printing.set),
    normalizeName(candidate.replacementPrice.printing.collectorNumber),
  ].join('|');
}

function printingLabel(candidate: TutorReplacementCandidateV15): string {
  return `${candidate.replacementTutorName} (${candidate.replacementPrice.printing.set.toUpperCase()}) ${candidate.replacementPrice.printing.collectorNumber}`;
}

function resolveCandidateCard(candidate: TutorReplacementCandidateV15, cards: readonly ScryfallCard[]): ScryfallCard | undefined {
  return cards.find((card) =>
    normalizeName(card.name) === normalizeName(candidate.replacementTutorName)
    && normalizeName(card.set) === normalizeName(candidate.replacementPrice.printing.set)
    && normalizeName(card.collector_number) === normalizeName(candidate.replacementPrice.printing.collectorNumber));
}

function replacementParsedDeck(
  parsed: ParsedDeck,
  candidate: TutorReplacementCandidateV15,
): ParsedDeck {
  if (candidate.sourceMainEntryIndex < 0 || candidate.sourceMainEntryIndex >= parsed.main.length) {
    throw new Error('Tutor replacement portfolio sourceMainEntryIndex is outside the parsed main deck.');
  }
  const main: DeckEntry[] = [];
  for (let index = 0; index < parsed.main.length; index += 1) {
    const entry = parsed.main[index]!;
    if (index !== candidate.sourceMainEntryIndex) {
      main.push({ ...entry });
      continue;
    }
    if (entry.quantity < 1) throw new Error('Tutor replacement portfolio cannot remove a zero-quantity source tutor.');
    if (entry.quantity > 1) main.push({ ...entry, quantity: entry.quantity - 1 });
  }
  main.push({
    name: candidate.replacementTutorName,
    quantity: 1,
    set: candidate.replacementPrice.printing.set.toUpperCase(),
    collectorNumber: candidate.replacementPrice.printing.collectorNumber,
    ...(candidate.replacementPrice.finish ? { finish: candidate.replacementPrice.finish } : {}),
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

function routeStatus(
  access: TutorReplacementPortfolioCheckpointV15[],
  threshold: number | null,
): TutorReplacementPortfolioRouteStatusV15 {
  const noLoss = access.every((checkpoint) => compareFractions(
    checkpoint.replacementProbability,
    checkpoint.baselineProbability,
  ) >= 0);
  if (noLoss) return 'no-access-loss';
  if (threshold !== null && access.every((checkpoint) => checkpoint.accessLossPercentagePoints <= threshold + 1e-9)) {
    return 'within-requested-access-loss';
  }
  return 'access-loss';
}

function portfolioStatus(routes: readonly TutorReplacementPortfolioRouteAuditV15[]): TutorReplacementPortfolioStatusV15 {
  if (routes.some((route) => route.status === 'access-unavailable')) return 'incomplete';
  if (routes.some((route) => route.status === 'access-loss')) return 'access-loss';
  if (routes.some((route) => route.status === 'within-requested-access-loss')) return 'within-requested-access-loss';
  return 'no-access-loss';
}

export async function auditTutorReplacementPortfolioV15(input: {
  routes: readonly WinRouteAccessInputV15[];
  parsed: ParsedDeck;
  resolvedCards: readonly ScryfallCard[];
  replacementAudit: TutorReplacementIntelligenceV15;
}, dependencies: TutorReplacementPortfolioDependenciesV15 = {}): Promise<TutorReplacementPortfolioAuditV15> {
  const routes = uniqueRoutes(input.routes);
  const threshold = input.replacementAudit.threshold.maxAccessLossPercentagePoints;
  const base = {
    routeCount: routes.length,
    maximumRoutes: MAX_TUTOR_REPLACEMENT_PORTFOLIO_ROUTES_V15,
    routeIds: routes.map((route) => route.comboId),
    thresholdPercentagePoints: threshold,
  };

  if (routes.length > MAX_TUTOR_REPLACEMENT_PORTFOLIO_ROUTES_V15) {
    return {
      ...base,
      status: 'too-many-verified-routes',
      candidates: [],
      unresolvedReplacementPrintings: [],
      guidance: `The deck has ${routes.length} verified full-table routes, above the bounded ${MAX_TUTOR_REPLACEMENT_PORTFOLIO_ROUTES_V15}-route portfolio audit. No replacement was labelled portfolio-safe from a partial route sample.`,
    };
  }

  const replacements = input.replacementAudit.sources.flatMap((source) => source.replacements);
  if (replacements.length === 0) {
    return {
      ...base,
      status: 'no-replacement-candidates',
      candidates: [],
      unresolvedReplacementPrintings: [],
      guidance: 'The primary replacement audit produced no accepted replacement candidates, so there is no cross-route swap to audit.',
    };
  }

  const uniqueCandidates = new Map<string, TutorReplacementCandidateV15>();
  for (const candidate of replacements) if (!uniqueCandidates.has(candidateKey(candidate))) uniqueCandidates.set(candidateKey(candidate), candidate);
  const resolveCards = dependencies.resolveCards ?? getCardsByIdentifiers;
  let resolvedCandidateCards: ScryfallCard[];
  let notFound: string[];
  try {
    const resolved = await resolveCards([...uniqueCandidates.values()].map(candidateIdentifier));
    resolvedCandidateCards = resolved.cards;
    notFound = resolved.notFound;
  } catch (error) {
    return {
      ...base,
      status: 'candidate-resolution-unavailable',
      candidates: [],
      unresolvedReplacementPrintings: [...uniqueCandidates.values()].map(printingLabel),
      guidance: `Exact replacement-printing resolution was unavailable${error instanceof Error ? `: ${error.message}` : ''}. No cross-route safety claim was fabricated.`,
    };
  }

  const baselineByRoute = new Map<string, Map<TutorReplacementPortfolioCheckpointV15['label'], WinRouteExactAccessCheckpointV15> | null>();
  for (const route of routes) {
    baselineByRoute.set(route.comboId, checkpointMap(auditWinRouteAccessV15({
      route,
      parsed: input.parsed,
      resolvedCards: input.resolvedCards,
    })));
  }

  const candidates: TutorReplacementPortfolioCandidateAuditV15[] = [];
  const unresolvedReplacementPrintings = new Set<string>(notFound);
  for (const candidate of replacements) {
    const replacementCard = resolveCandidateCard(candidate, resolvedCandidateCards);
    if (!replacementCard) {
      unresolvedReplacementPrintings.add(printingLabel(candidate));
      candidates.push({
        sourceTutorName: candidate.sourceTutorName,
        replacementTutorName: candidate.replacementTutorName,
        sourceMainEntryIndex: candidate.sourceMainEntryIndex,
        replacementPrinting: {
          set: candidate.replacementPrice.printing.set.toUpperCase(),
          collectorNumber: candidate.replacementPrice.printing.collectorNumber,
          finish: candidate.replacementPrice.finish,
        },
        primaryRouteClassification: candidate.classification,
        status: 'incomplete',
        safeNoExactAccessLossAcrossPortfolio: false,
        withinRequestedToleranceAcrossPortfolio: false,
        maximumAccessLossPercentagePoints: null,
        routes: routes.map((route) => ({
          comboId: route.comboId,
          status: 'access-unavailable',
          exactAccess: null,
          maximumAccessLossPercentagePoints: null,
          reason: 'The exact replacement printing could not be resolved for this portfolio audit.',
        })),
      });
      continue;
    }

    const replaced = replacementParsedDeck(input.parsed, candidate);
    if (replaced.totalCards !== 100 || replaced.totalCards !== input.parsed.totalCards) {
      throw new Error('Tutor replacement portfolio audit must preserve the exact 100-card Commander population.');
    }
    const replacementResolvedCards = [replacementCard, ...input.resolvedCards];
    const routeAudits: TutorReplacementPortfolioRouteAuditV15[] = [];
    for (const route of routes) {
      const baseline = baselineByRoute.get(route.comboId) ?? null;
      if (!baseline) {
        routeAudits.push({
          comboId: route.comboId,
          status: 'access-unavailable',
          exactAccess: null,
          maximumAccessLossPercentagePoints: null,
          reason: 'Baseline exact card-component access was unavailable for this verified route.',
        });
        continue;
      }
      const replacementAccess = checkpointMap(auditWinRouteAccessV15({
        route,
        parsed: replaced,
        resolvedCards: replacementResolvedCards,
      }));
      if (!replacementAccess) {
        routeAudits.push({
          comboId: route.comboId,
          status: 'access-unavailable',
          exactAccess: null,
          maximumAccessLossPercentagePoints: null,
          reason: 'Exact card-component access became unavailable after this one-for-one tutor swap.',
        });
        continue;
      }
      const exactAccess = compareAccess(baseline, replacementAccess);
      const maximumAccessLossPercentagePoints = Math.max(...exactAccess.map((checkpoint) => checkpoint.accessLossPercentagePoints));
      const status = routeStatus(exactAccess, threshold);
      routeAudits.push({
        comboId: route.comboId,
        status,
        exactAccess,
        maximumAccessLossPercentagePoints,
        reason: status === 'no-access-loss'
          ? 'This swap causes no exact selected-checkpoint card-access loss on this verified route.'
          : status === 'within-requested-access-loss'
            ? 'This route loses some exact card access, but every selected checkpoint remains within the caller-supplied tolerance.'
            : 'This swap reduces exact selected-checkpoint card access on this verified route beyond any caller-supplied tolerance.',
      });
    }

    const status = portfolioStatus(routeAudits);
    const maximumAccessLossPercentagePoints = status === 'incomplete'
      ? null
      : Math.max(0, ...routeAudits.map((route) => route.maximumAccessLossPercentagePoints ?? 0));
    candidates.push({
      sourceTutorName: candidate.sourceTutorName,
      replacementTutorName: candidate.replacementTutorName,
      sourceMainEntryIndex: candidate.sourceMainEntryIndex,
      replacementPrinting: {
        set: replacementCard.set.toUpperCase(),
        collectorNumber: replacementCard.collector_number,
        finish: candidate.replacementPrice.finish,
      },
      primaryRouteClassification: candidate.classification,
      status,
      safeNoExactAccessLossAcrossPortfolio: status === 'no-access-loss',
      withinRequestedToleranceAcrossPortfolio: status === 'no-access-loss' || status === 'within-requested-access-loss',
      maximumAccessLossPercentagePoints,
      routes: routeAudits,
    });
  }

  candidates.sort((left, right) => {
    const priority = (value: TutorReplacementPortfolioStatusV15): number => ({
      'no-access-loss': 0,
      'within-requested-access-loss': 1,
      'access-loss': 2,
      incomplete: 3,
    })[value];
    return priority(left.status) - priority(right.status)
      || (left.maximumAccessLossPercentagePoints ?? Number.POSITIVE_INFINITY) - (right.maximumAccessLossPercentagePoints ?? Number.POSITIVE_INFINITY)
      || left.replacementTutorName.localeCompare(right.replacementTutorName);
  });

  return {
    ...base,
    status: 'portfolio-evaluated',
    candidates,
    unresolvedReplacementPrintings: [...unresolvedReplacementPrintings].sort((left, right) => left.localeCompare(right)),
    guidance: 'Treat safeNoExactAccessLossAcrossPortfolio=true as the conservative cross-route card-access safeguard. Primary-route classifications remain useful, but a candidate that hurts any other verified route is not portfolio-safe. This still does not model tutor mana/timing, interaction, non-card prerequisites or card utility outside verified winning routes.',
  };
}
