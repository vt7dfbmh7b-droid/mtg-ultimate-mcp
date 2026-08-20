import { parseDecklist } from './deck.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';

export const MAX_TOPDECK_TUTOR_PREVALENCE_NAMES_V15 = 64;
export const MAX_TOPDECK_TUTOR_PREVALENCE_CANDIDATES_V15 = 25_000;

export interface TopDeckTutorPrevalenceV15 {
  tutorName: string;
  allDecksWithTutor: number;
  allDeckInclusionRate: number;
  topCutDecksWithTutor: number;
  topCutInclusionRate: number;
  nonTopCutDecksWithTutor: number;
  nonTopCutInclusionRate: number;
  topCutMinusNonTopCutRate: number | null;
  eventsWithTutorInTopCut: number;
  topCutEventPresenceRate: number;
}

export interface TopDeckTutorPrevalenceScopeV15 {
  scope: 'same-commanders' | 'all-edh-candidates';
  commanderNames: string[] | null;
  candidateDecks: number;
  uniqueEvents: number;
  topCutDecks: number;
  nonTopCutDecks: number;
  eventsWithTopCutDecks: number;
  tutors: TopDeckTutorPrevalenceV15[];
}

export interface TopDeckTutorPrevalenceAuditV15 {
  sourceId: 'topdeck';
  sourceSemantics: 'advisory-tournament-prevalence-only';
  deduplicatedCandidateCount: number;
  duplicateRecordsDiscarded: number;
  observedOutcomeRange: { earliest: string | null; latest: string | null };
  sameCommanders: TopDeckTutorPrevalenceScopeV15 | null;
  global: TopDeckTutorPrevalenceScopeV15;
  caveat: string;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueNames(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function normalizedCommanderKey(values: readonly string[]): string {
  return uniqueNames(values).map(normalizeName).sort().join('|');
}

function candidateContains(candidate: TopDeckLearningCandidateV15, normalizedTutorName: string): boolean {
  const parsed = parseDecklist(candidate.decklist);
  return [...parsed.commanders, ...parsed.main]
    .some((entry) => normalizeName(entry.name) === normalizedTutorName && entry.quantity > 0);
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function scopeAudit(
  scope: TopDeckTutorPrevalenceScopeV15['scope'],
  commanderNames: string[] | null,
  candidates: readonly TopDeckLearningCandidateV15[],
  tutorNames: readonly string[],
): TopDeckTutorPrevalenceScopeV15 {
  const topCutCandidates = candidates.filter((candidate) => candidate.standing <= candidate.topCutSize);
  const nonTopCutCandidates = candidates.filter((candidate) => candidate.standing > candidate.topCutSize);
  const uniqueEvents = new Set(candidates.map((candidate) => candidate.providerEventId));
  const topCutEvents = new Set(topCutCandidates.map((candidate) => candidate.providerEventId));

  const tutors = tutorNames.map((tutorName) => {
    const normalized = normalizeName(tutorName);
    const allWithTutor = candidates.filter((candidate) => candidateContains(candidate, normalized));
    const topCutWithTutor = topCutCandidates.filter((candidate) => candidateContains(candidate, normalized));
    const nonTopCutWithTutor = nonTopCutCandidates.filter((candidate) => candidateContains(candidate, normalized));
    const eventsWithTutorInTopCut = new Set(topCutWithTutor.map((candidate) => candidate.providerEventId)).size;
    return {
      tutorName,
      allDecksWithTutor: allWithTutor.length,
      allDeckInclusionRate: rate(allWithTutor.length, candidates.length),
      topCutDecksWithTutor: topCutWithTutor.length,
      topCutInclusionRate: rate(topCutWithTutor.length, topCutCandidates.length),
      nonTopCutDecksWithTutor: nonTopCutWithTutor.length,
      nonTopCutInclusionRate: rate(nonTopCutWithTutor.length, nonTopCutCandidates.length),
      topCutMinusNonTopCutRate: topCutCandidates.length > 0 && nonTopCutCandidates.length > 0
        ? rate(topCutWithTutor.length, topCutCandidates.length) - rate(nonTopCutWithTutor.length, nonTopCutCandidates.length)
        : null,
      eventsWithTutorInTopCut,
      topCutEventPresenceRate: rate(eventsWithTutorInTopCut, topCutEvents.size),
    };
  });

  return {
    scope,
    commanderNames,
    candidateDecks: candidates.length,
    uniqueEvents: uniqueEvents.size,
    topCutDecks: topCutCandidates.length,
    nonTopCutDecks: nonTopCutCandidates.length,
    eventsWithTopCutDecks: topCutEvents.size,
    tutors,
  };
}

export function auditTopDeckTutorPrevalenceV15(input: {
  tutorNames: readonly string[];
  candidates: readonly TopDeckLearningCandidateV15[];
  commanderNames?: readonly string[];
}): TopDeckTutorPrevalenceAuditV15 {
  const tutorNames = uniqueNames(input.tutorNames);
  if (tutorNames.length < 1) throw new Error('tutorNames must contain at least one non-empty tutor name.');
  if (tutorNames.length > MAX_TOPDECK_TUTOR_PREVALENCE_NAMES_V15) {
    throw new Error(`tutorNames must contain at most ${MAX_TOPDECK_TUTOR_PREVALENCE_NAMES_V15} unique names.`);
  }
  if (!Array.isArray(input.candidates)) throw new Error('candidates must be an array.');
  if (input.candidates.length > MAX_TOPDECK_TUTOR_PREVALENCE_CANDIDATES_V15) {
    throw new Error(`candidates must contain at most ${MAX_TOPDECK_TUTOR_PREVALENCE_CANDIDATES_V15} records.`);
  }

  const deduplicatedByRecord = new Map<string, TopDeckLearningCandidateV15>();
  for (const candidate of input.candidates) {
    if (!candidate || typeof candidate !== 'object') throw new Error('Each TopDeck candidate must be an object.');
    if (!deduplicatedByRecord.has(candidate.providerRecordId)) deduplicatedByRecord.set(candidate.providerRecordId, candidate);
  }
  const candidates = [...deduplicatedByRecord.values()];
  const dates = candidates
    .map((candidate) => candidate.outcomeOccurredAt)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const requestedCommanders = input.commanderNames ? uniqueNames(input.commanderNames) : [];
  const requestedCommanderKey = normalizedCommanderKey(requestedCommanders);
  const sameCommanderCandidates = requestedCommanderKey
    ? candidates.filter((candidate) => normalizedCommanderKey(candidate.commanderNames) === requestedCommanderKey)
    : [];

  return {
    sourceId: 'topdeck',
    sourceSemantics: 'advisory-tournament-prevalence-only',
    deduplicatedCandidateCount: candidates.length,
    duplicateRecordsDiscarded: input.candidates.length - candidates.length,
    observedOutcomeRange: {
      earliest: dates[0] ?? null,
      latest: dates.at(-1) ?? null,
    },
    sameCommanders: requestedCommanderKey
      ? scopeAudit('same-commanders', requestedCommanders, sameCommanderCandidates, tutorNames)
      : null,
    global: scopeAudit('all-edh-candidates', null, candidates, tutorNames),
    caveat: 'TopDeck prevalence is advisory observational evidence only. Inclusion rates do not prove that a tutor caused a finish, do not override Commander legality or combo truth, and should be interpreted with sample size, commander context, event composition and time window visible.',
  };
}
