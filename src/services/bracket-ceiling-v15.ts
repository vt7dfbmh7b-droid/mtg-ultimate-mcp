export type CommanderBracketV15 = 1 | 2 | 3 | 4 | 5;

export interface BracketAssessmentSignalsV15 {
  commanderLegal: boolean;
  exactCardCount: boolean;
  fullyResolved: boolean;
  printingPolicyCompliant: boolean;
  spellbookTag?: string | null;
  verifiedWinningCombos?: number;
  ruthlessWinningCombos?: number;
  strategicallyRelevantCombos?: number;
  averageNonlandManaValue?: number | null;
  earlyPlayCount?: number;
  fastManaCount?: number;
  freeInteractionCount?: number;
  cheapInteractionCount?: number;
  tutorCount?: number;
  gameChangerCount?: number;
  efficientWinConditionEvidence?: boolean;
  optimizedPlanEvidence?: boolean;
  cedhIntent?: boolean;
  competitiveMetagameEvidence?: boolean;
  exhibitionIntent?: boolean;
}

export type Bracket5ThresholdKeyV15 =
  | 'average-nonland-mv'
  | 'early-plays'
  | 'fast-mana'
  | 'free-interaction'
  | 'cheap-interaction'
  | 'tutors'
  | 'verified-winning-combo'
  | 'competitive-combo-signal'
  | 'cedh-intent'
  | 'competitive-metagame-evidence';

export interface Bracket5ThresholdCheckV15 {
  key: Bracket5ThresholdKeyV15;
  category: 'construction' | 'evidence';
  label: string;
  observed: number | string | boolean | null;
  required: string;
  passed: boolean;
  detail: string;
  pressurePoint: string;
}

export interface ConstraintAnalysisV15 {
  constraint: string;
  kind: 'budget' | 'card-price-cap' | 'printing-pool' | 'other';
  causality: 'observed-under-constraint-not-proven-causal';
  failedThresholdKeys: Bracket5ThresholdKeyV15[];
  pressurePoints: string[];
  summary: string;
}

export interface BracketCeilingAssessmentV15 {
  targetBracket: CommanderBracketV15;
  assessedBracket: CommanderBracketV15 | null;
  assessedBand: string;
  confidence: 'low' | 'medium' | 'high';
  targetGap: number | null;
  hardGatesPassed: boolean;
  bracket5ConstructionCandidate: boolean;
  bracket5CertifiedByThisAssessment: boolean;
  bracket5ThresholdChecks: Bracket5ThresholdCheckV15[];
  constraintAnalysis: ConstraintAnalysisV15[];
  ceilingReasons: string[];
  supportingSignals: string[];
  constraints: string[];
  guidance: string;
}

function finite(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nonNegative(value: number | undefined): number {
  return Math.max(0, Math.trunc(finite(value, 0)));
}

function clampBracket(value: number): CommanderBracketV15 {
  return Math.min(5, Math.max(1, Math.trunc(value))) as CommanderBracketV15;
}

function threshold(
  key: Bracket5ThresholdKeyV15,
  category: Bracket5ThresholdCheckV15['category'],
  label: string,
  observed: Bracket5ThresholdCheckV15['observed'],
  required: string,
  passed: boolean,
  pressurePoint: string,
): Bracket5ThresholdCheckV15 {
  return {
    key,
    category,
    label,
    observed,
    required,
    passed,
    detail: `${label}: observed ${String(observed)}; Bracket-5 ${category === 'construction' ? 'construction gate' : 'evidence gate'} requires ${required}.`,
    pressurePoint,
  };
}

function classifyConstraint(constraint: string): ConstraintAnalysisV15['kind'] {
  const normalized = constraint.toLocaleLowerCase();
  if (/whole[- ]deck|total deck|deck budget|budget/.test(normalized)) return 'budget';
  if (/per[- ]card|max(?:imum)? .*card|card price/.test(normalized)) return 'card-price-cap';
  if (/printing|printings|printing family|allowed sets?|set[- ]only|set only|themed/.test(normalized)) return 'printing-pool';
  return 'other';
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function buildConstraintAnalysis(
  constraints: readonly string[],
  checks: readonly Bracket5ThresholdCheckV15[],
): ConstraintAnalysisV15[] {
  const constructionMisses = checks.filter((check) => check.category === 'construction' && !check.passed);
  const pressurePoints = unique(constructionMisses.map((check) => check.pressurePoint));
  const failedThresholdKeys = constructionMisses.map((check) => check.key);
  const missSummary = constructionMisses.map((check) => `${check.label} (${String(check.observed)} vs ${check.required})`).join('; ');

  return constraints.map((constraint) => ({
    constraint,
    kind: classifyConstraint(constraint),
    causality: 'observed-under-constraint-not-proven-causal' as const,
    failedThresholdKeys: [...failedThresholdKeys],
    pressurePoints: [...pressurePoints],
    summary: constructionMisses.length > 0
      ? `Constraint "${constraint}" was active while the finished list missed ${constructionMisses.length} Bracket-5 construction gate${constructionMisses.length === 1 ? '' : 's'}: ${missSummary}. These are observed shortfalls in the constrained build; this does not prove the restriction alone caused every miss.`
      : `Constraint "${constraint}" was active, but the finished list cleared every measured Bracket-5 construction gate. Any remaining Bracket-5 gap comes from non-construction evidence such as competitive intent or current metagame support; this does not prove the restriction caused that gap.`,
  }));
}

/**
 * Conservative deck-list assessment. The requested target is deliberately not an input
 * to the power decision; it is only compared with the independently assessed result.
 * Bracket 4 may be supported by an independently evidenced efficient non-combo win plan;
 * Bracket 5 keeps the stricter cEDH construction + intent + metagame evidence gates.
 */
export function assessBracketCeilingV15(
  targetBracket: CommanderBracketV15,
  signals: BracketAssessmentSignalsV15,
  constraints: string[] = [],
): BracketCeilingAssessmentV15 {
  const target = clampBracket(targetBracket);
  const hardGatesPassed = signals.commanderLegal
    && signals.exactCardCount
    && signals.fullyResolved
    && signals.printingPolicyCompliant;

  if (!hardGatesPassed) {
    const failures: string[] = [];
    if (!signals.commanderLegal) failures.push('Commander legality has not passed.');
    if (!signals.exactCardCount) failures.push('The deck is not exactly 100 cards under Commander construction rules.');
    if (!signals.fullyResolved) failures.push('One or more cards/printings are unresolved.');
    if (!signals.printingPolicyCompliant) failures.push('The requested physical-printing policy is not fully satisfied.');
    return {
      targetBracket: target,
      assessedBracket: null,
      assessedBand: 'unassessable',
      confidence: 'high',
      targetGap: null,
      hardGatesPassed: false,
      bracket5ConstructionCandidate: false,
      bracket5CertifiedByThisAssessment: false,
      bracket5ThresholdChecks: [],
      constraintAnalysis: [],
      ceilingReasons: failures,
      supportingSignals: [],
      constraints: [...constraints],
      guidance: 'Fix hard deck-construction and printing failures before assigning a bracket. Requested bracket never overrides legality or exact-printing constraints.',
    };
  }

  const tag = String(signals.spellbookTag ?? '').toUpperCase();
  const winning = nonNegative(signals.verifiedWinningCombos);
  const ruthlessWinning = nonNegative(signals.ruthlessWinningCombos);
  const strategic = nonNegative(signals.strategicallyRelevantCombos);
  const avgMv = finite(signals.averageNonlandManaValue, 99);
  const early = nonNegative(signals.earlyPlayCount);
  const fastMana = nonNegative(signals.fastManaCount);
  const freeInteraction = nonNegative(signals.freeInteractionCount);
  const cheapInteraction = nonNegative(signals.cheapInteractionCount);
  const tutors = nonNegative(signals.tutorCount);
  const gameChangers = nonNegative(signals.gameChangerCount);
  const efficientWinPlan = signals.efficientWinConditionEvidence === true;
  const competitiveComboSignal = ruthlessWinning > 0 || strategic > 0 || tag === 'R';

  const bracket5ThresholdChecks: Bracket5ThresholdCheckV15[] = [
    threshold('average-nonland-mv', 'construction', 'Average nonland mana value', avgMv, 'at most 2.6', avgMv <= 2.6, 'speed/curve'),
    threshold('early-plays', 'construction', 'Early plays', early, 'at least 35', early >= 35, 'speed/curve'),
    threshold('fast-mana', 'construction', 'Fast mana', fastMana, 'at least 3', fastMana >= 3, 'fast-mana density'),
    threshold('free-interaction', 'construction', 'Free interaction', freeInteraction, 'at least 1', freeInteraction >= 1, 'free/cheap interaction'),
    threshold('cheap-interaction', 'construction', 'Cheap interaction', cheapInteraction, 'at least 8', cheapInteraction >= 8, 'free/cheap interaction'),
    threshold('tutors', 'construction', 'Tutors', tutors, 'at least 4', tutors >= 4, 'tutor consistency'),
    threshold('verified-winning-combo', 'construction', 'Verified win-oriented combos', winning, 'at least 1', winning > 0, 'win-package quality/redundancy'),
    threshold(
      'competitive-combo-signal',
      'construction',
      'Competitive combo signal',
      `Ruthless=${ruthlessWinning}, strategic=${strategic}, Spellbook=${tag || 'none'}`,
      'at least one Ruthless/strategically relevant/R-tagged signal',
      competitiveComboSignal,
      'win-package quality/redundancy',
    ),
    threshold('cedh-intent', 'evidence', 'Explicit cEDH intent', signals.cedhIntent === true, 'true', signals.cedhIntent === true, 'competitive intent'),
    threshold(
      'competitive-metagame-evidence',
      'evidence',
      'Independent current competitive-metagame evidence',
      signals.competitiveMetagameEvidence === true,
      'true',
      signals.competitiveMetagameEvidence === true,
      'metagame evidence',
    ),
  ];
  const constructionChecks = bracket5ThresholdChecks.filter((check) => check.category === 'construction');
  const bracket5ConstructionCandidate = constructionChecks.every((check) => check.passed);
  const constraintAnalysis = buildConstraintAnalysis(constraints, bracket5ThresholdChecks);

  const supportingSignals: string[] = [];
  if (winning > 0) supportingSignals.push(`${winning} verified win-oriented combo${winning === 1 ? '' : 's'}.`);
  if (ruthlessWinning > 0) supportingSignals.push(`${ruthlessWinning} Ruthless-tagged winning combo${ruthlessWinning === 1 ? '' : 's'}.`);
  if (strategic > 0) supportingSignals.push(`${strategic} strategically relevant combo signal${strategic === 1 ? '' : 's'}.`);
  if (efficientWinPlan) supportingSignals.push('Independent evidence supports an efficient non-combo win condition suitable for optimized play.');
  if (fastMana > 0) supportingSignals.push(`${fastMana} fast-mana signal${fastMana === 1 ? '' : 's'}.`);
  if (freeInteraction > 0) supportingSignals.push(`${freeInteraction} free-interaction signal${freeInteraction === 1 ? '' : 's'}.`);
  if (tutors > 0) supportingSignals.push(`${tutors} tutor signal${tutors === 1 ? '' : 's'}.`);

  const upgradedSignals = tag === 'P' || tag === 'R'
    || winning > 0
    || gameChangers > 0
    || (early >= 18 && cheapInteraction >= 4 && tutors >= 1);

  const optimizedStructure = avgMv <= 3.1
    && early >= 25
    && cheapInteraction >= 6
    && fastMana >= 2
    && tutors >= 2;
  const optimizedWinEvidence = efficientWinPlan
    || winning > 0
    || ruthlessWinning > 0
    || tag === 'R'
    || gameChangers >= 3;
  const optimizedSignals = Boolean(signals.optimizedPlanEvidence)
    ? optimizedWinEvidence
    : optimizedStructure && optimizedWinEvidence;

  let assessed: CommanderBracketV15;
  let assessedBand: string;

  if (signals.exhibitionIntent === true && !upgradedSignals) {
    assessed = 1;
    assessedBand = 'bracket-1-exhibition-intent';
  } else if (!upgradedSignals) {
    assessed = 2;
    assessedBand = 'bracket-2-core-range';
  } else if (!optimizedSignals) {
    assessed = 3;
    assessedBand = 'bracket-3-upgraded-range';
  } else {
    assessed = 4;
    assessedBand = bracket5ConstructionCandidate
      ? 'high-bracket-4-cedh-construction-candidate'
      : 'bracket-4-optimized-range';
  }

  const bracket5EvidenceComplete = bracket5ConstructionCandidate
    && signals.cedhIntent === true
    && signals.competitiveMetagameEvidence === true;
  if (bracket5EvidenceComplete) {
    assessed = 5;
    assessedBand = 'bracket-5-cedh-evidence-supported';
  }

  const ceilingReasons: string[] = [];
  if (target > assessed) {
    if (target === 5) {
      if (!bracket5ConstructionCandidate) {
        ceilingReasons.push('The finished list does not yet satisfy the plugin’s conservative cEDH construction gate.');
        ceilingReasons.push(...constructionChecks.filter((check) => !check.passed).map((check) => check.detail));
      }
      if (signals.cedhIntent !== true) ceilingReasons.push('Bracket 5 requires explicit cEDH/competitive intent; a static list cannot supply that intent by itself.');
      if (signals.competitiveMetagameEvidence !== true) ceilingReasons.push('No independent competitive-metagame evidence currently supports a Bracket 5 claim.');
    } else {
      ceilingReasons.push(`The finished deck’s independently measured signals support Bracket ${assessed}, below the requested Bracket ${target}.`);
    }
    ceilingReasons.push(...constraints.map((constraint) => `Constraint ceiling: ${constraint}`));
    ceilingReasons.push(...constraintAnalysis.map((analysis) => `Constraint analysis: ${analysis.summary}`));
  }

  let confidence: BracketCeilingAssessmentV15['confidence'] = 'medium';
  if (assessed === 5 && bracket5EvidenceComplete) confidence = 'high';
  else if (assessed <= 2 && !upgradedSignals) confidence = 'medium';
  else if (tag === 'P' || tag === 'R' || winning > 0 || efficientWinPlan || optimizedSignals) confidence = 'high';

  return {
    targetBracket: target,
    assessedBracket: assessed,
    assessedBand,
    confidence,
    targetGap: target - assessed,
    hardGatesPassed: true,
    bracket5ConstructionCandidate,
    bracket5CertifiedByThisAssessment: assessed === 5,
    bracket5ThresholdChecks,
    constraintAnalysis,
    ceilingReasons,
    supportingSignals,
    constraints: [...constraints],
    guidance: assessed === 5
      ? 'Bracket 5 is only reported because strong cEDH construction, explicit competitive intent, and independent metagame evidence are all present. Continue to reassess as the metagame changes.'
      : 'Optimize toward the requested bracket, but report the bracket the finished deck actually supports. Bracket 4 may be supported by an independently evidenced efficient non-combo win plan; Bracket 5 keeps stricter cEDH package and metagame requirements. A target, budget, theme, printing family, or requested label is never evidence for a higher bracket. When restrictions are active, report the measured threshold misses under those restrictions without claiming the restriction alone caused every miss.',
  };
}
