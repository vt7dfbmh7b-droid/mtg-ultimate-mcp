import { scoreResearchObservationV15, type ResearchObservationV15 } from './research-learning-v15.js';

export type CompetitiveEvidenceVerdictV15 = 'supported' | 'rejected' | 'disputed' | 'insufficient';

export interface CompetitiveBracketEvidenceV15 {
  verdict: CompetitiveEvidenceVerdictV15;
  competitiveMetagameEvidence: boolean;
  usableObservations: number;
  ignoredObservations: number;
  supportWeight: number;
  opposeWeight: number;
  supportIndependentGroups: number;
  opposeIndependentGroups: number;
  observedResultsSupportGroups: number;
  conflictedIndependentGroups: string[];
  reasons: string[];
  guidance: string;
}

interface GroupEvidenceV15 {
  key: string;
  support: number;
  oppose: number;
  supportObservedResults: boolean;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function independenceKey(observation: ResearchObservationV15): string {
  const group = typeof observation.independentGroup === 'string' ? observation.independentGroup.trim() : '';
  return normalize(group || observation.sourceId);
}

/**
 * Convert deep-research observations into a conservative yes/no competitive-metagame
 * signal for Bracket 5 assessment. This deliberately requires independent corroboration,
 * at least one observed-results group, meaningful freshness/quality, and no material
 * unresolved contradiction. Mirrored reports sharing an independentGroup count once.
 */
export function evaluateCompetitiveBracketEvidenceV15(
  observations: ResearchObservationV15[],
): CompetitiveBracketEvidenceV15 {
  const groups = new Map<string, GroupEvidenceV15>();
  let usableObservations = 0;
  let ignoredObservations = 0;

  for (const observation of observations) {
    if (observation.focus !== 'competitive' && observation.focus !== 'recorded-games') {
      ignoredObservations += 1;
      continue;
    }

    let scored: ReturnType<typeof scoreResearchObservationV15>;
    try {
      scored = scoreResearchObservationV15(observation);
    } catch {
      ignoredObservations += 1;
      continue;
    }

    // Weak/stale references remain visible in deep research but cannot certify B5.
    if (scored.score < 0.35) {
      ignoredObservations += 1;
      continue;
    }

    usableObservations += 1;
    const key = independenceKey(scored);
    const existing = groups.get(key) ?? {
      key,
      support: 0,
      oppose: 0,
      supportObservedResults: false,
    };
    if (scored.polarity === 'oppose') {
      existing.oppose = Math.max(existing.oppose, scored.score);
    } else {
      existing.support = Math.max(existing.support, scored.score);
      if (scored.source.evidenceClass === 'observed-results') existing.supportObservedResults = true;
    }
    groups.set(key, existing);
  }

  const conflictedIndependentGroups = [...groups.values()]
    .filter((group) => group.support > 0 && group.oppose > 0)
    .map((group) => group.key)
    .sort();
  const conflictedSet = new Set(conflictedIndependentGroups);

  let supportWeight = 0;
  let opposeWeight = 0;
  let supportIndependentGroups = 0;
  let opposeIndependentGroups = 0;
  let observedResultsSupportGroups = 0;

  for (const group of groups.values()) {
    if (conflictedSet.has(group.key)) continue;
    if (group.support > 0) {
      supportWeight += group.support;
      supportIndependentGroups += 1;
      if (group.supportObservedResults) observedResultsSupportGroups += 1;
    }
    if (group.oppose > 0) {
      opposeWeight += group.oppose;
      opposeIndependentGroups += 1;
    }
  }

  supportWeight = round(supportWeight);
  opposeWeight = round(opposeWeight);
  const reasons: string[] = [];

  const materialSupport = supportIndependentGroups >= 2
    && observedResultsSupportGroups >= 1
    && supportWeight >= 1.05;
  const materialOpposition = opposeIndependentGroups >= 1
    && opposeWeight >= 0.55;

  let verdict: CompetitiveEvidenceVerdictV15;
  if (conflictedIndependentGroups.length > 0 || (materialSupport && materialOpposition && opposeWeight >= supportWeight * 0.45)) {
    verdict = 'disputed';
    reasons.push('Material competitive evidence is contradictory; Bracket 5 evidence remains unresolved.');
  } else if (!materialSupport && materialOpposition && opposeWeight > supportWeight) {
    verdict = 'rejected';
    reasons.push('Fresh independent competitive evidence weighs against the Bracket 5 claim.');
  } else if (materialSupport && (!materialOpposition || opposeWeight < supportWeight * 0.45)) {
    verdict = 'supported';
    reasons.push('Fresh competitive evidence is independently corroborated and includes observed-result support.');
  } else {
    verdict = 'insufficient';
    if (supportIndependentGroups < 2) reasons.push('Need at least two independent supporting evidence groups.');
    if (observedResultsSupportGroups < 1) reasons.push('Need at least one fresh observed-results evidence group, not only curated/community references.');
    if (supportWeight < 1.05) reasons.push('Usable supporting evidence is not yet strong/fresh enough for a Bracket 5 claim.');
  }

  if (conflictedIndependentGroups.length > 0) {
    reasons.push(`Conflicting mirror/evidence groups were neutralized instead of double counted: ${conflictedIndependentGroups.join(', ')}.`);
  }
  if (ignoredObservations > 0) {
    reasons.push(`${ignoredObservations} observation${ignoredObservations === 1 ? ' was' : 's were'} ignored because it was irrelevant, invalid, stale, or too weak for Bracket 5 certification.`);
  }

  return {
    verdict,
    competitiveMetagameEvidence: verdict === 'supported',
    usableObservations,
    ignoredObservations,
    supportWeight,
    opposeWeight,
    supportIndependentGroups,
    opposeIndependentGroups,
    observedResultsSupportGroups,
    conflictedIndependentGroups,
    reasons,
    guidance: verdict === 'supported'
      ? 'This evidence may support the competitive-metagame portion of a Bracket 5 assessment, but it does not replace deck legality, construction quality, verified winning lines, or explicit cEDH intent.'
      : 'Do not claim Bracket 5 from these observations. Gather newer independent tournament/game evidence or resolve the contradiction first.',
  };
}
