import type {
  Bracket5ThresholdCheckV15,
  BracketAssessmentSignalsV15,
  CommanderBracketV15,
} from './bracket-ceiling-v15.js';

export interface ActualBracketAssessmentV15 {
  assessedBracket: CommanderBracketV15 | null;
  assessedBand: string;
  confidence: 'low' | 'medium' | 'high';
  hardGatesPassed: boolean;
  bracket5ConstructionCandidate: boolean;
  bracket5CertifiedByThisAssessment: boolean;
  bracket5ThresholdChecks: Bracket5ThresholdCheckV15[];
  supportingSignals: string[];
  constraints: string[];
  restrictionObservations: string[];
  guidance: string;
}

function finite(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nonNegative(value: number | undefined): number {
  return Math.max(0, Math.trunc(finite(value, 0)));
}

function threshold(
  key: Bracket5ThresholdCheckV15['key'],
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

/**
 * Target-free bracket assessment for neutral construction workflows.
 *
 * This deliberately has no targetBracket parameter. The finished deck is measured first,
 * using the same conservative signal thresholds as bracket-ceiling-v15. A later caller may
 * compare the returned bracket with a user target, but neutral construction never needs to
 * manufacture one merely to access the assessor.
 */
export function assessActualBracketV15(
  signals: BracketAssessmentSignalsV15,
  constraints: string[] = [],
): ActualBracketAssessmentV15 {
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
      assessedBracket: null,
      assessedBand: 'unassessable',
      confidence: 'high',
      hardGatesPassed: false,
      bracket5ConstructionCandidate: false,
      bracket5CertifiedByThisAssessment: false,
      bracket5ThresholdChecks: [],
      supportingSignals: [],
      constraints: [...constraints],
      restrictionObservations: failures,
      guidance: 'Fix hard deck-construction and printing failures before assigning a bracket. Neutral construction does not invent a bracket target to bypass those failures.',
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

  const supportingSignals: string[] = [];
  if (winning > 0) supportingSignals.push(`${winning} verified win-oriented combo${winning === 1 ? '' : 's'}.`);
  if (ruthlessWinning > 0) supportingSignals.push(`${ruthlessWinning} Ruthless-tagged winning combo${ruthlessWinning === 1 ? '' : 's'}.`);
  if (strategic > 0) supportingSignals.push(`${strategic} strategically relevant combo signal${strategic === 1 ? '' : 's'}.`);
  if (efficientWinPlan) supportingSignals.push('Independent evidence supports an efficient non-combo win condition suitable for optimized play.');
  if (gameChangers > 0) supportingSignals.push(`${gameChangers} current Game Changer${gameChangers === 1 ? '' : 's'}.`);
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
    || tag === 'R';
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

  if (gameChangers > 3 && assessed < 4) {
    assessed = 4;
    assessedBand = 'bracket-4-game-changer-floor';
  }

  const bracket5EvidenceComplete = bracket5ConstructionCandidate
    && signals.cedhIntent === true
    && signals.competitiveMetagameEvidence === true;
  if (bracket5EvidenceComplete) {
    assessed = 5;
    assessedBand = 'bracket-5-cedh-evidence-supported';
  }

  let confidence: ActualBracketAssessmentV15['confidence'] = 'medium';
  if (assessed === 5 && bracket5EvidenceComplete) confidence = 'high';
  else if (assessed <= 2 && !upgradedSignals) confidence = 'medium';
  else if (tag === 'P' || tag === 'R' || winning > 0 || efficientWinPlan || optimizedSignals || gameChangers > 3) confidence = 'high';

  const constructionMisses = constructionChecks.filter((check) => !check.passed);
  const restrictionObservations = constraints.map((constraint) => {
    if (constructionMisses.length === 0) {
      return `Constraint "${constraint}" was active while the finished list cleared every measured Bracket-5 construction gate. That observation does not prove the restriction caused or prevented any bracket result.`;
    }
    const misses = constructionMisses.map((check) => `${check.label} (${String(check.observed)} vs ${check.required})`).join('; ');
    return `Constraint "${constraint}" was active while the finished list missed ${constructionMisses.length} Bracket-5 construction gate${constructionMisses.length === 1 ? '' : 's'}: ${misses}. These are observed shortfalls under the constraint, not proof that the restriction alone caused them.`;
  });

  return {
    assessedBracket: assessed,
    assessedBand,
    confidence,
    hardGatesPassed: true,
    bracket5ConstructionCandidate,
    bracket5CertifiedByThisAssessment: assessed === 5,
    bracket5ThresholdChecks,
    supportingSignals,
    constraints: [...constraints],
    restrictionObservations,
    guidance: assessed === 5
      ? 'Bracket 5 is reported only because strong cEDH construction, explicit competitive intent, and independent metagame evidence are all present.'
      : 'This is an after-construction assessment. No requested bracket was supplied to the assessor, and a strong commander name or themed restriction is not evidence for a higher bracket.',
  };
}
