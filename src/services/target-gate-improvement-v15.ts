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
  repairedGates: string[];
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

/**
 * Compare a proposed autonomous refinement against the same Bracket-5 construction gates used by
 * final V0.15 assessment. This deliberately does not invent evidence: route-dependent gates are
 * omitted when route verification is unavailable, and a competitive signal is only counted when
 * it is positively known.
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
    return {
      applicable: false,
      targetBracket,
      score: 0,
      repairedGates: [],
      regressedGates: [],
      passingBefore: [],
      passingAfter: [],
      ignoredUnverifiedGates: [],
      rationale: 'Target-gate prioritisation is inactive below Bracket 5; ordinary strategy and simulation scoring remains authoritative.',
    };
  }

  const before = constructionState(input.beforeMetrics, input.beforeRoute);
  const after = constructionState(input.afterMetrics, input.afterRoute);
  const ignored = new Set<string>();
  if (input.beforeRoute.winRoute === 'unavailable' || input.afterRoute.winRoute === 'unavailable') ignored.add('verified-winning-combo');
  if (input.beforeRoute.competitiveComboSignal === null || input.afterRoute.competitiveComboSignal === null) ignored.add('competitive-combo-signal');

  const repairedGates: string[] = [];
  const regressedGates: string[] = [];
  const passingBefore: string[] = [];
  const passingAfter: string[] = [];
  let score = 0;

  for (const [key, weight] of Object.entries(CONSTRUCTION_WEIGHTS)) {
    if (ignored.has(key)) continue;
    const wasPassing = before.get(key) === true;
    const isPassing = after.get(key) === true;
    if (wasPassing) passingBefore.push(key);
    if (isPassing) passingAfter.push(key);
    if (!wasPassing && isPassing) {
      repairedGates.push(key);
      score += weight;
    } else if (wasPassing && !isPassing) {
      regressedGates.push(key);
      score -= weight * 2;
    }
  }

  repairedGates.sort();
  regressedGates.sort();
  passingBefore.sort();
  passingAfter.sort();
  const ignoredUnverifiedGates = [...ignored].sort();
  return {
    applicable: true,
    targetBracket,
    score,
    repairedGates,
    regressedGates,
    passingBefore,
    passingAfter,
    ignoredUnverifiedGates,
    rationale: regressedGates.length > 0
      ? `The candidate regresses ${regressedGates.length} Bracket-5 construction gate(s) that were already passing.`
      : repairedGates.length > 0
        ? `The candidate repairs ${repairedGates.length} currently failed Bracket-5 construction gate(s).`
        : 'The candidate does not cross an authoritative Bracket-5 construction threshold; generic simulation/strategy scoring decides among such candidates.',
  };
}
