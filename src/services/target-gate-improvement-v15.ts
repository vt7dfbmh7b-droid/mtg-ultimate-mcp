import { assessActualBracketV15 } from './actual-bracket-assessment-v15.js';

export type WinRouteEvidenceStateV15 = 'verified' | 'absent' | 'unavailable';

export interface TargetGateRouteStateV15 {
  winRoute: WinRouteEvidenceStateV15;
  competitiveComboSignal: boolean | null;
}

export interface TargetGateImprovementV15 {
  applicable: boolean;
  targetBracket: number;
  score: number;
  thresholdScore: number;
  progressScore: number;
  failedBefore: string[];
  failedAfter: string[];
  repairedGates: string[];
  advancedFailedGates: string[];
  regressedGates: string[];
  passingBefore: string[];
  passingAfter: string[];
  ignoredUnverifiedGates: string[];
  rationale: string;
}

const CONSTRUCTION_WEIGHTS: Record<string, number> = {
  'average-nonland-mv': 10,
  'early-plays': 4,
  'fast-mana': 8,
  'free-interaction': 8,
  'cheap-interaction': 5,
  tutors: 5,
  'verified-winning-combo': 24,
  'competitive-combo-signal': 14,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roleCount(metrics: Record<string, unknown>, role: string): number {
  return finite(record(metrics.roleCounts)[role]);
}

function constructionState(
  metricsValue: unknown,
  route: TargetGateRouteStateV15,
): Map<string, boolean> {
  const metrics = record(metricsValue);
  const assessment = assessActualBracketV15({
    commanderLegal: true,
    exactCardCount: true,
    fullyResolved: true,
    printingPolicyCompliant: true,
    spellbookTag: route.competitiveComboSignal === true ? 'R' : null,
    verifiedWinningCombos: route.winRoute === 'verified' ? 1 : 0,
    ruthlessWinningCombos: route.competitiveComboSignal === true ? 1 : 0,
    strategicallyRelevantCombos: 0,
    averageNonlandManaValue: finite(metrics.averageNonlandManaValue),
    earlyPlayCount: finite(metrics.earlyPlayCount),
    fastManaCount: finite(metrics.fastManaCount),
    freeInteractionCount: roleCount(metrics, 'free interaction'),
    cheapInteractionCount: finite(metrics.cheapInteractionCount),
    tutorCount: finite(metrics.tutorCount),
    gameChangerCount: 0,
    efficientWinConditionEvidence: false,
    cedhIntent: true,
    competitiveMetagameEvidence: false,
    optimizedPlanEvidence: true,
    exhibitionIntent: false,
  });
  return new Map(
    assessment.bracket5ThresholdChecks
      .filter((check) => check.category === 'construction')
      .map((check) => [check.key, check.passed] as const),
  );
}

function failedGateProgress(beforeValue: unknown, afterValue: unknown, key: string): number {
  const before = record(beforeValue);
  const after = record(afterValue);
  if (key === 'average-nonland-mv') return Math.max(0, Math.min(3, (finite(before.averageNonlandManaValue) - finite(after.averageNonlandManaValue)) * 20));
  if (key === 'early-plays') return Math.max(0, Math.min(3, (finite(after.earlyPlayCount) - finite(before.earlyPlayCount)) * 0.5));
  if (key === 'fast-mana') return Math.max(0, Math.min(4, (finite(after.fastManaCount) - finite(before.fastManaCount)) * 2));
  if (key === 'free-interaction') return Math.max(0, Math.min(4, (roleCount(after, 'free interaction') - roleCount(before, 'free interaction')) * 3));
  if (key === 'cheap-interaction') return Math.max(0, Math.min(3, (finite(after.cheapInteractionCount) - finite(before.cheapInteractionCount)) * 0.5));
  if (key === 'tutors') return Math.max(0, Math.min(3, (finite(after.tutorCount) - finite(before.tutorCount)) * 0.5));
  return 0;
}

function emptyResult(targetBracket: number, rationale: string): TargetGateImprovementV15 {
  return {
    applicable: false,
    targetBracket,
    score: 0,
    thresholdScore: 0,
    progressScore: 0,
    failedBefore: [],
    failedAfter: [],
    repairedGates: [],
    advancedFailedGates: [],
    regressedGates: [],
    passingBefore: [],
    passingAfter: [],
    ignoredUnverifiedGates: [],
    rationale,
  };
}

/**
 * Compare a proposed autonomous refinement against the same Bracket-5 construction gates used by
 * final V0.15 assessment. Threshold repairs dominate. Smaller progress credit is only available
 * when a gate is currently failing, so an aspirational role target cannot reward adding tutor #9
 * when the real Bracket-5 tutor gate already passed at four.
 */
export function assessTargetGateImprovementV15(input: {
  targetBracket?: number | null;
  beforeMetrics: unknown;
  afterMetrics: unknown;
  beforeRoute: TargetGateRouteStateV15;
  afterRoute: TargetGateRouteStateV15;
}): TargetGateImprovementV15 {
  const targetBracket = Math.max(1, Math.min(5, Math.trunc(input.targetBracket ?? 4)));
  if (targetBracket < 5) {
    return emptyResult(targetBracket, 'Target-gate prioritisation is inactive below Bracket 5; ordinary strategy and simulation scoring remains authoritative.');
  }

  const before = constructionState(input.beforeMetrics, input.beforeRoute);
  const after = constructionState(input.afterMetrics, input.afterRoute);
  const ignored = new Set<string>();
  if (input.beforeRoute.winRoute === 'unavailable' || input.afterRoute.winRoute === 'unavailable') ignored.add('verified-winning-combo');
  if (input.beforeRoute.competitiveComboSignal === null || input.afterRoute.competitiveComboSignal === null) ignored.add('competitive-combo-signal');

  const repairedGates: string[] = [];
  const advancedFailedGates: string[] = [];
  const regressedGates: string[] = [];
  const failedBefore: string[] = [];
  const failedAfter: string[] = [];
  const passingBefore: string[] = [];
  const passingAfter: string[] = [];
  let thresholdScore = 0;
  let progressScore = 0;

  for (const [key, weight] of Object.entries(CONSTRUCTION_WEIGHTS)) {
    if (ignored.has(key)) continue;
    const wasPassing = before.get(key) === true;
    const isPassing = after.get(key) === true;
    if (wasPassing) passingBefore.push(key);
    else failedBefore.push(key);
    if (isPassing) passingAfter.push(key);
    else failedAfter.push(key);
    if (!wasPassing && isPassing) {
      repairedGates.push(key);
      thresholdScore += weight;
    } else if (wasPassing && !isPassing) {
      regressedGates.push(key);
      thresholdScore -= weight * 2;
    } else if (!wasPassing && !isPassing) {
      const progress = failedGateProgress(input.beforeMetrics, input.afterMetrics, key);
      if (progress > 0) {
        advancedFailedGates.push(key);
        progressScore += progress;
      }
    }
  }

  repairedGates.sort();
  advancedFailedGates.sort();
  regressedGates.sort();
  failedBefore.sort();
  failedAfter.sort();
  passingBefore.sort();
  passingAfter.sort();
  const ignoredUnverifiedGates = [...ignored].sort();
  const score = Number((thresholdScore + progressScore).toFixed(3));
  return {
    applicable: true,
    targetBracket,
    score,
    thresholdScore,
    progressScore: Number(progressScore.toFixed(3)),
    failedBefore,
    failedAfter,
    repairedGates,
    advancedFailedGates,
    regressedGates,
    passingBefore,
    passingAfter,
    ignoredUnverifiedGates,
    rationale: regressedGates.length > 0
      ? `The candidate regresses ${regressedGates.length} Bracket-5 construction gate(s) that were already passing.`
      : repairedGates.length > 0
        ? `The candidate repairs ${repairedGates.length} currently failed Bracket-5 construction gate(s).`
        : advancedFailedGates.length > 0
          ? `The candidate makes measurable progress toward ${advancedFailedGates.length} currently failed Bracket-5 construction gate(s).`
          : 'The candidate does not repair or advance an authoritative failed Bracket-5 construction gate; generic simulation/strategy scoring is only a tie-breaker.',
  };
}

/**
 * Translate the existing V0.15 upgrade-plan provenance into target-gate evidence without another
 * network lookup. A package only becomes a verified post-swap route when the planner says it was
 * injected atomically from verified package discovery. Existing verified routes remain verified
 * because the refinement caller protects their route cards from cuts.
 */
export function assessPlanTargetGateImprovementV15(input: {
  targetBracket?: number | null;
  plan: Record<string, unknown>;
  beforeWinRouteStatus: 'protected' | 'no-verified-route' | 'verification-unavailable';
}): TargetGateImprovementV15 {
  const targetBracket = Math.max(1, Math.min(5, Math.trunc(input.targetBracket ?? 4)));
  const beforeMetrics = record(input.plan.beforeMetrics);
  const afterMetrics = record(input.plan.afterMetrics);
  if (Object.keys(beforeMetrics).length === 0 || Object.keys(afterMetrics).length === 0) {
    return emptyResult(targetBracket, 'Target-gate comparison is unavailable because the candidate plan did not retain complete before/after deck metrics.');
  }

  const pressure = record(input.plan.v15TargetPressure);
  const atomicInjected = pressure.atomicWinPackageInjected === true;
  const selectedBracketTag = typeof pressure.selectedBracketTag === 'string'
    ? pressure.selectedBracketTag.toUpperCase()
    : null;
  const beforeRoute: TargetGateRouteStateV15 = input.beforeWinRouteStatus === 'protected'
    ? { winRoute: 'verified', competitiveComboSignal: null }
    : input.beforeWinRouteStatus === 'no-verified-route'
      ? { winRoute: 'absent', competitiveComboSignal: null }
      : { winRoute: 'unavailable', competitiveComboSignal: null };
  const afterRoute: TargetGateRouteStateV15 = atomicInjected
    ? { winRoute: 'verified', competitiveComboSignal: selectedBracketTag === 'R' ? true : null }
    : beforeRoute;

  return assessTargetGateImprovementV15({
    targetBracket,
    beforeMetrics,
    afterMetrics,
    beforeRoute,
    afterRoute,
  });
}
