import assert from 'node:assert/strict';
import test from 'node:test';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import { auditTopDeckTutorPrevalenceV15 } from './topdeck-tutor-prevalence-v15.js';

function decklist(commander: string, tutor?: string): string {
  const main = tutor ? `1 ${tutor}\n98 Filler` : '99 Filler';
  return `// COMMANDER\n1 ${commander}\n// MAIN\n${main}`;
}

function candidate(input: {
  record: string;
  event: string;
  commander: string;
  standing: number;
  topCut: number;
  tutor?: string;
  date?: string;
}): TopDeckLearningCandidateV15 {
  return {
    sourceId: 'topdeck',
    providerEventId: input.event,
    providerPlayerId: `player-${input.record}`,
    providerRecordId: input.record,
    sourceUrl: `https://topdeck.gg/event/${input.event}`,
    outcomeOccurredAt: input.date ?? '2026-08-01T00:00:00.000Z',
    standing: input.standing,
    fieldSize: 4,
    topCutSize: input.topCut,
    decklist: decklist(input.commander, input.tutor),
    commanderNames: [input.commander],
    metadata: {
      provider: 'topdeck-v2',
      tournamentName: input.event,
      wins: null,
      draws: null,
      losses: null,
      standingSource: 'provider-field',
      deckSource: 'inline-text',
    },
  };
}

test('reports same-commander top-cut versus non-top-cut tutor prevalence without causal claims', () => {
  const candidates = [
    candidate({ record: 'a', event: 'event-1', commander: 'Commander A', standing: 1, topCut: 2, tutor: 'Tutor X', date: '2026-08-01T00:00:00.000Z' }),
    candidate({ record: 'b', event: 'event-1', commander: 'Commander A', standing: 2, topCut: 2, date: '2026-08-01T00:00:00.000Z' }),
    candidate({ record: 'c', event: 'event-1', commander: 'Commander A', standing: 3, topCut: 2, date: '2026-08-01T00:00:00.000Z' }),
    candidate({ record: 'd', event: 'event-1', commander: 'Commander A', standing: 4, topCut: 2, date: '2026-08-01T00:00:00.000Z' }),
    candidate({ record: 'e', event: 'event-2', commander: 'Commander B', standing: 1, topCut: 2, tutor: 'Tutor X', date: '2026-08-10T00:00:00.000Z' }),
  ];
  const result = auditTopDeckTutorPrevalenceV15({
    tutorNames: ['Tutor X'],
    candidates,
    commanderNames: ['Commander A'],
  });

  assert.equal(result.sourceSemantics, 'advisory-tournament-prevalence-only');
  assert.equal(result.sameCommanders?.candidateDecks, 4);
  assert.equal(result.sameCommanders?.topCutDecks, 2);
  assert.equal(result.sameCommanders?.nonTopCutDecks, 2);
  const tutor = result.sameCommanders?.tutors[0]!;
  assert.equal(tutor.topCutDecksWithTutor, 1);
  assert.equal(tutor.topCutInclusionRate, 0.5);
  assert.equal(tutor.nonTopCutDecksWithTutor, 0);
  assert.equal(tutor.nonTopCutInclusionRate, 0);
  assert.equal(tutor.topCutMinusNonTopCutRate, 0.5);
  assert.equal(tutor.eventsWithTutorInTopCut, 1);
  assert.equal(tutor.topCutEventPresenceRate, 1);
  assert.match(result.caveat, /do not prove/i);
});

test('deduplicates provider records before computing prevalence', () => {
  const original = candidate({ record: 'same-record', event: 'event-1', commander: 'Commander A', standing: 1, topCut: 2, tutor: 'Tutor X' });
  const result = auditTopDeckTutorPrevalenceV15({
    tutorNames: ['Tutor X'],
    candidates: [original, { ...original }],
    commanderNames: ['Commander A'],
  });

  assert.equal(result.deduplicatedCandidateCount, 1);
  assert.equal(result.duplicateRecordsDiscarded, 1);
  assert.equal(result.global.candidateDecks, 1);
  assert.equal(result.global.tutors[0]?.allDecksWithTutor, 1);
});

test('same-commander scope is exact while global scope remains separately visible', () => {
  const candidates = [
    candidate({ record: 'a', event: 'event-1', commander: 'Commander A', standing: 1, topCut: 1 }),
    candidate({ record: 'b', event: 'event-2', commander: 'Commander B', standing: 1, topCut: 1, tutor: 'Tutor X' }),
  ];
  const result = auditTopDeckTutorPrevalenceV15({
    tutorNames: ['Tutor X'],
    candidates,
    commanderNames: ['Commander A'],
  });

  assert.equal(result.sameCommanders?.candidateDecks, 1);
  assert.equal(result.sameCommanders?.tutors[0]?.allDecksWithTutor, 0);
  assert.equal(result.global.candidateDecks, 2);
  assert.equal(result.global.tutors[0]?.allDecksWithTutor, 1);
});

test('omitting commander context does not silently label global evidence as commander-specific', () => {
  const result = auditTopDeckTutorPrevalenceV15({
    tutorNames: ['Tutor X'],
    candidates: [candidate({ record: 'a', event: 'event-1', commander: 'Commander A', standing: 1, topCut: 1, tutor: 'Tutor X' })],
  });

  assert.equal(result.sameCommanders, null);
  assert.equal(result.global.tutors[0]?.topCutInclusionRate, 1);
});
