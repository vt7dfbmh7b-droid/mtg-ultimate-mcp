import type { ActualBracketAssessmentV15 } from './actual-bracket-assessment-v15.js';
import type { BracketAssessmentSignalsV15, CommanderBracketV15 } from './bracket-ceiling-v15.js';

export type BracketTargetStatusV15 = 'reached' | 'exceeded' | 'under-target' | 'unassessable';
export type BracketProgressCheckStateV15 = 'passed' | 'failed' | 'unverified';

export interface BracketEvidenceHealthV15 {
  spellbookBracketSourceStatus?: 'available' | 'unavailable' | 'unknown';
  spellbookComboSourceStatus?: 'available' | 'unavailable' | 'unknown';
  comboVerificationComplete?: boolean;
}

export interface BracketProgressCheckV15 {
  key: string;
  targetBracket: CommanderBracketV15;
  category: 'construction' | 'evidence' | 'intent' | 'source-health';
  label: string;
  observed: string | number | boolean | null;
  required: string;
  state: BracketProgressCheckStateV15;
  pressurePoint: string;
  detail: string;
}

export interface BracketTargetComparisonV15 {
  requestedBracket: CommanderBracketV15;
  achievedBracket: CommanderBracketV15 | null;
  achievedBand: string;
  status: BracketTargetStatusV15;
  targetGap: number | null;
  assessmentConfidence: ActualBracketAssessmentV15['confidence'];
  evidenceCompleteness: 'complete' | 'partial';
  relevantChecks: BracketProgressCheckV15[];
  knownBlockers: BracketProgressCheckV15[];
  unverifiedChecks: BracketProgressCheckV15[];
  whatWouldReachTarget: string[];
  restrictionObservations: string[];
  guidance: string;
}

function finite(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nonNegative(value: number | undefined): number {
  return Math.max(0, Math.trunc(finite(value, 0)));
}

function boundedBracket(value: number): CommanderBracketV15 {
  if (!Number.isFinite(value)) throw new Error('requested bracket must be finite');
  return Math.max(1, Math.min(5, Math.trunc(value))) as CommanderBracketV15;
}

function check(
  key: string,
  targetBracket: CommanderBracketV15,
  category: BracketProgressCheckV15['category'],
  label: string,
  observed: BracketProgressCheckV15['observed'],
  required: string,
  state: BracketProgressCheckStateV15,
  pressurePoint: string,
  detail?: string,
): BracketProgressCheckV15 {
  return {
    key,
    targetBracket,
    category,
    label,
    observed,
    required,
    state,
    pressurePoint,
    detail: detail ?? `${label}: observed ${String(observed)}; Bracket ${targetBracket} requires ${required}.`,
  };
}

function state(passed: boolean): BracketProgressCheckStateV15 {
  return passed ? 'passed' : 'failed';
}

function sourceUnavailable(value: BracketEvidenceHealthV15[keyof BracketEvidenceHealthV15]): boolean {
  return value === 'unavailable';
}

function signalSummary(signals: BracketAssessmentSignalsV15): {
  tag: string;
  winning: number;
  ruthlessWinning: number;
  strategic: number;
  avgMv: number;
  early: number;
  fastMana: number;
  freeInteraction: number;
  cheapInteraction: number;
  tutors: number;
  gameChangers: number;
  efficientWinPlan: boolean;
  upgradedSignals: boolean;
  optimizedStructure: boolean;
  optimizedWinEvidence: boolean;
  optimizedSignals: boolean;
} {
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
  const upgradedSignals = tag === 'P' || tag === 'R'
    || winning > 0
    || gameChangers > 0
    || (early >= 18 && cheapInteraction >= 4 && tutors >= 1);
  const optimizedStructure = avgMv <= 3.1
    && early >= 25
    && cheapInteraction >= 6
    && fastMana >= 2
    && tutors >= 2;
  const optimizedWinEvidence = efficientWinPlan || winning > 0 || ruthlessWinning > 0 || tag === 'R';
  const optimizedSignals = signals.optimizedPlanEvidence === true
    ? optimizedWinEvidence
    : optimizedStructure && optimizedWinEvidence;
  return {
    tag,
    winning,
    ruthlessWinning,
    strategic,
    avgMv,
    early,
    fastMana,
    freeInteraction,
    cheapInteraction,
    tutors,
    gameChangers,
    efficientWinPlan,
    upgradedSignals,
    optimizedStructure,
    optimizedWinEvidence,
    optimizedSignals,
  };
}

function bracket2Checks(signals: BracketAssessmentSignalsV15, target: CommanderBracketV15): BracketProgressCheckV15[] {
  const summary = signalSummary(signals);
  const exhibitionOnly = signals.exhibitionIntent === true && !summary.upgradedSignals;
  return [check(
    'b2-beyond-exhibition-only',
    target,
    'intent',
    'Beyond exhibition-only construction',
    `exhibitionIntent=${signals.exhibitionIntent === true}, upgradedSignal=${summary.upgradedSignals}`,
    'either non-exhibition intent or at least one upgraded-deck signal',
    state(!exhibitionOnly),
    'deck intent / upgraded signal',
  )];
}

function bracket3Checks(signals: BracketAssessmentSignalsV15, target: CommanderBracketV15): BracketProgressCheckV15[] {
  const summary = signalSummary(signals);
  return [check(
    'b3-upgraded-signal',
    target,
    'construction',
    'Upgraded-deck signal',
    `Spellbook=${summary.tag || 'none'}, wins=${summary.winning}, Game Changers=${summary.gameChangers}, early=${summary.early}, cheap interaction=${summary.cheapInteraction}, tutors=${summary.tutors}`,
    'P/R Spellbook signal, a verified win, a Game Changer, or ordinary upgraded density (18+ early plays, 4+ cheap interaction, 1+ tutor)',
    state(summary.upgradedSignals),
    'upgraded consistency / interaction density',
  )];
}

function bracket4Checks(signals: BracketAssessmentSignalsV15, target: CommanderBracketV15): BracketProgressCheckV15[] {
  const summary = signalSummary(signals);
  const gameChangerFloor = summary.gameChangers > 3;
  const pathwayPassed = summary.optimizedSignals || gameChangerFloor;
  const checks: BracketProgressCheckV15[] = [check(
    'b4-optimized-pathway',
    target,
    'construction',
    'Optimized Bracket-4 pathway',
    `optimized=${summary.optimizedSignals}, Game Changers=${summary.gameChangers}`,
    'optimized structure + efficient/verified win evidence, explicit optimized-plan evidence + win evidence, or the current >3 Game Changer floor',
    state(pathwayPassed),
    'optimized structure / win plan',
  )];
  if (pathwayPassed) return checks;

  checks.push(
    check('b4-average-mv', target, 'construction', 'Average nonland mana value', summary.avgMv, 'at most 3.1', state(summary.avgMv <= 3.1), 'speed/curve'),
    check('b4-early-plays', target, 'construction', 'Early plays', summary.early, 'at least 25', state(summary.early >= 25), 'speed/curve'),
    check('b4-cheap-interaction', target, 'construction', 'Cheap interaction', summary.cheapInteraction, 'at least 6', state(summary.cheapInteraction >= 6), 'interaction density'),
    check('b4-fast-mana', target, 'construction', 'Fast mana', summary.fastMana, 'at least 2', state(summary.fastMana >= 2), 'fast-mana density'),
    check('b4-tutors', target, 'construction', 'Tutors', summary.tutors, 'at least 2', state(summary.tutors >= 2), 'tutor consistency'),
    check(
      'b4-win-evidence',
      target,
      'evidence',
      'Optimized win evidence',
      `efficient commander plan=${summary.efficientWinPlan}, verified wins=${summary.winning}, Ruthless wins=${summary.ruthlessWinning}, Spellbook=${summary.tag || 'none'}`,
      'an efficient commander/non-combo win plan, verified winning combo, Ruthless winning combo, or R-tagged Spellbook signal',
      state(summary.optimizedWinEvidence),
      'efficient win plan',
    ),
  );
  return checks;
}

function bracket5Checks(
  actual: ActualBracketAssessmentV15,
  health: BracketEvidenceHealthV15,
  target: CommanderBracketV15,
): BracketProgressCheckV15[] {
  const comboUnavailable = sourceUnavailable(health.spellbookComboSourceStatus) || health.comboVerificationComplete === false;
  const bracketUnavailable = sourceUnavailable(health.spellbookBracketSourceStatus);
  const mapped = actual.bracket5ThresholdChecks.map((item): BracketProgressCheckV15 => {
    let itemState: BracketProgressCheckStateV15 = state(item.passed);
    if (!item.passed && item.key === 'verified-winning-combo' && comboUnavailable) itemState = 'unverified';
    if (!item.passed && item.key === 'competitive-combo-signal' && (comboUnavailable || bracketUnavailable)) itemState = 'unverified';
    return check(
      item.key,
      target,
      item.category === 'evidence' && item.key === 'cedh-intent' ? 'intent' : item.category,
      item.label,
      item.observed,
      item.required,
      itemState,
      item.pressurePoint,
      itemState === 'unverified'
        ? `${item.label} could not be fully verified because required external combo/bracket evidence was unavailable. This is not proof the deck lacks the capability.`
        : item.detail,
    );
  });

  if (comboUnavailable) {
    mapped.unshift(check(
      'b5-combo-source-health',
      target,
      'source-health',
      'Commander Spellbook combo verification',
      health.spellbookComboSourceStatus ?? 'unknown',
      'available, completed verification',
      'unverified',
      'external combo evidence',
      'Commander Spellbook combo verification was unavailable/incomplete. Bracket 5 cannot receive positive combo credit until verification succeeds.',
    ));
  }
  if (bracketUnavailable) {
    mapped.unshift(check(
      'b5-bracket-source-health',
      target,
      'source-health',
      'Commander Spellbook bracket advisory',
      health.spellbookBracketSourceStatus ?? 'unknown',
      'available advisory evidence where needed',
      'unverified',
      'external bracket evidence',
      'The Spellbook bracket advisory was unavailable. No positive tag/strategic-combo signal was inferred from the outage.',
    ));
  }
  return mapped;
}

function checksForTarget(
  target: CommanderBracketV15,
  actual: ActualBracketAssessmentV15,
  signals: BracketAssessmentSignalsV15,
  health: BracketEvidenceHealthV15,
): BracketProgressCheckV15[] {
  if (target === 1) return [];
  if (target === 2) return bracket2Checks(signals, target);
  if (target === 3) return bracket3Checks(signals, target);
  if (target === 4) return bracket4Checks(signals, target);
  return bracket5Checks(actual, health, target);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function compareRequestedBracketV15(
  requestedBracket: number,
  actual: ActualBracketAssessmentV15,
  signals: BracketAssessmentSignalsV15,
  health: BracketEvidenceHealthV15 = {},
): BracketTargetComparisonV15 {
  const requested = boundedBracket(requestedBracket);
  const achieved = actual.assessedBracket;
  const evidenceCompleteness = sourceUnavailable(health.spellbookBracketSourceStatus)
    || sourceUnavailable(health.spellbookComboSourceStatus)
    || health.comboVerificationComplete === false
    ? 'partial'
    : 'complete';

  if (!actual.hardGatesPassed || achieved === null) {
    return {
      requestedBracket: requested,
      achievedBracket: null,
      achievedBand: actual.assessedBand,
      status: 'unassessable',
      targetGap: null,
      assessmentConfidence: actual.confidence,
      evidenceCompleteness,
      relevantChecks: [],
      knownBlockers: [],
      unverifiedChecks: [],
      whatWouldReachTarget: ['Fix hard Commander legality, exact-card-count, resolution, and physical-printing-policy failures before comparing power targets.'],
      restrictionObservations: [...actual.restrictionObservations],
      guidance: 'Power targeting is suspended until hard truth gates pass.',
    };
  }

  const status: BracketTargetStatusV15 = achieved > requested
    ? 'exceeded'
    : achieved === requested
      ? 'reached'
      : 'under-target';
  const relevantChecks = checksForTarget(requested, actual, signals, health);
  const knownBlockers = relevantChecks.filter((item) => item.state === 'failed');
  const unverifiedChecks = relevantChecks.filter((item) => item.state === 'unverified');
  const sourceActions = unverifiedChecks
    .filter((item) => item.category === 'source-health')
    .map((item) => item.key === 'b5-combo-source-health'
      ? 'Restore/re-run verified Commander Spellbook combo evidence before making a Bracket 5 win-package claim; the current outage does not prove a combo is absent.'
      : 'Restore/re-run the unavailable external bracket evidence before treating missing advisory signals as deck weaknesses.');
  const blockerActions = knownBlockers.map((item) => `Improve ${item.pressurePoint}: ${item.label} needs ${item.required}.`);
  const whatWouldReachTarget = status === 'under-target'
    ? unique([...sourceActions, ...blockerActions])
    : [];

  return {
    requestedBracket: requested,
    achievedBracket: achieved,
    achievedBand: actual.assessedBand,
    status,
    targetGap: requested - achieved,
    assessmentConfidence: actual.confidence,
    evidenceCompleteness,
    relevantChecks,
    knownBlockers,
    unverifiedChecks,
    whatWouldReachTarget,
    restrictionObservations: [...actual.restrictionObservations],
    guidance: status === 'under-target'
      ? 'The target comparison uses only checks relevant to the requested bracket. Unavailable external evidence is reported as unverified rather than converted into a false deck weakness.'
      : 'The finished deck meets or exceeds the requested bracket under the target-free post-build assessment.',
  };
}
