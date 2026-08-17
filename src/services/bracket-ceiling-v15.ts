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
  optimizedPlanEvidence?: boolean;
  cedhIntent?: boolean;
  competitiveMetagameEvidence?: boolean;
  exhibitionIntent?: boolean;
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

/**
 * Conservative deck-list assessment. The requested target is deliberately not an input
 * to the power decision; it is only compared with the independently assessed result.
 * Official Commander brackets also include intent/table-context, so Bracket 5 requires
 * explicit cEDH intent and competitive-metagame evidence in addition to deck construction.
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

  const supportingSignals: string[] = [];
  if (winning > 0) supportingSignals.push(`${winning} verified win-oriented combo${winning === 1 ? '' : 's'}.`);
  if (ruthlessWinning > 0) supportingSignals.push(`${ruthlessWinning} Ruthless-tagged winning combo${ruthlessWinning === 1 ? '' : 's'}.`);
  if (strategic > 0) supportingSignals.push(`${strategic} strategically relevant combo signal${strategic === 1 ? '' : 's'}.`);
  if (fastMana > 0) supportingSignals.push(`${fastMana} fast-mana signal${fastMana === 1 ? '' : 's'}.`);
  if (freeInteraction > 0) supportingSignals.push(`${freeInteraction} free-interaction signal${freeInteraction === 1 ? '' : 's'}.`);
  if (tutors > 0) supportingSignals.push(`${tutors} tutor signal${tutors === 1 ? '' : 's'}.`);

  const upgradedSignals = tag === 'P' || tag === 'R'
    || winning > 0
    || gameChangers > 0
    || (early >= 18 && cheapInteraction >= 4 && tutors >= 1);

  const optimizedSignals = Boolean(signals.optimizedPlanEvidence)
    || (
      avgMv <= 3.1
      && early >= 25
      && cheapInteraction >= 6
      && fastMana >= 2
      && tutors >= 2
      && (winning > 0 || ruthlessWinning > 0 || tag === 'R' || gameChangers >= 3)
    );

  const bracket5ConstructionCandidate = avgMv <= 2.6
    && early >= 35
    && fastMana >= 3
    && freeInteraction >= 1
    && cheapInteraction >= 8
    && tutors >= 4
    && winning > 0
    && (ruthlessWinning > 0 || strategic > 0 || tag === 'R');

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
      if (!bracket5ConstructionCandidate) ceilingReasons.push('The finished list does not yet satisfy the plugin’s conservative cEDH construction gate.');
      if (signals.cedhIntent !== true) ceilingReasons.push('Bracket 5 requires explicit cEDH/competitive intent; a static list cannot supply that intent by itself.');
      if (signals.competitiveMetagameEvidence !== true) ceilingReasons.push('No independent competitive-metagame evidence currently supports a Bracket 5 claim.');
    } else {
      ceilingReasons.push(`The finished deck’s independently measured signals support Bracket ${assessed}, below the requested Bracket ${target}.`);
    }
    ceilingReasons.push(...constraints.map((constraint) => `Constraint ceiling: ${constraint}`));
  }

  let confidence: BracketCeilingAssessmentV15['confidence'] = 'medium';
  if (assessed === 5 && bracket5EvidenceComplete) confidence = 'high';
  else if (assessed <= 2 && !upgradedSignals) confidence = 'medium';
  else if (tag === 'P' || tag === 'R' || winning > 0 || optimizedSignals) confidence = 'high';

  return {
    targetBracket: target,
    assessedBracket: assessed,
    assessedBand,
    confidence,
    targetGap: target - assessed,
    hardGatesPassed: true,
    bracket5ConstructionCandidate,
    bracket5CertifiedByThisAssessment: assessed === 5,
    ceilingReasons,
    supportingSignals,
    constraints: [...constraints],
    guidance: assessed === 5
      ? 'Bracket 5 is only reported because strong cEDH construction, explicit competitive intent, and independent metagame evidence are all present. Continue to reassess as the metagame changes.'
      : 'Optimize toward the requested bracket, but report the bracket the finished deck actually supports. A target, budget, theme, printing family, or requested label is never evidence for a higher bracket.',
  };
}
