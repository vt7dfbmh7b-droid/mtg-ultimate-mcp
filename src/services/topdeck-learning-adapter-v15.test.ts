import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestObservedLearningRecordsV15 } from './learning-corpus-ingestion-v15.js';
import {
  adaptTopDeckV2TournamentForLearningV15,
  enrichTopDeckLearningCandidateV15,
  normalizeTopDeckDecklistTextV15,
  TOPDECK_V2_ATTRIBUTION_V15,
  type TopDeckV2BulkTournamentV15,
} from './topdeck-learning-adapter-v15.js';

const topdeckDeck = `~~Commanders~~
1 Kinnan, Bonder Prodigy (IKO) 192

~~Mainboard~~
99 Forest (M21) 272`;

function tournament(overrides: Partial<TopDeckV2BulkTournamentV15> = {}): TopDeckV2BulkTournamentV15 {
  return {
    TID: 'cedh-auckland-1',
    tournamentName: 'Auckland cEDH Open',
    startDate: 1_767_225_600,
    game: 'Magic: The Gathering',
    format: 'EDH',
    topCut: 2,
    eventData: { city: 'Auckland', state: 'Auckland' },
    standings: [
      { standing: 1, id: 'p1', name: 'Player One', decklist: topdeckDeck, wins: 4, draws: 1, losses: 0 },
      { standing: 2, id: 'p2', name: 'Player Two', decklist: topdeckDeck, wins: 4, draws: 0, losses: 1 },
      { standing: 3, id: 'p3', name: 'Player Three', decklist: topdeckDeck, wins: 3, draws: 1, losses: 1 },
      { standing: 4, id: 'p4', name: 'Player Four', decklist: topdeckDeck, wins: 3, draws: 0, losses: 2 },
    ],
    ...overrides,
  };
}

test('TopDeck headings normalize without changing card identities or quantities', () => {
  const normalized = normalizeTopDeckDecklistTextV15(topdeckDeck);
  assert.match(normalized, /^\/\/ COMMANDER/m);
  assert.match(normalized, /^\/\/ MAIN/m);
  assert.match(normalized, /1 Kinnan, Bonder Prodigy \(IKO\) 192/);
  assert.match(normalized, /99 Forest \(M21\) 272/);
});

test('completed EDH-style bulk payload becomes deterministic source candidates with no inferred cross-source identity', () => {
  const result = adaptTopDeckV2TournamentForLearningV15(tournament());

  assert.equal(result.rejected.length, 0);
  assert.equal(result.candidates.length, 4);
  assert.equal(result.attribution, TOPDECK_V2_ATTRIBUTION_V15);
  assert.equal(result.candidates[0]?.providerEventId, 'cedh-auckland-1');
  assert.equal(result.candidates[0]?.providerRecordId, 'cedh-auckland-1:standing:p1');
  assert.equal(result.candidates[0]?.sourceUrl, 'https://topdeck.gg/event/cedh-auckland-1');
  assert.equal(result.candidates[0]?.standing, 1);
  assert.equal(result.candidates[0]?.fieldSize, 4);
  assert.equal(result.candidates[0]?.topCutSize, 2);
  assert.deepEqual(result.candidates[0]?.commanderNames, ['Kinnan, Bonder Prodigy']);
  assert.equal(result.candidates[0]?.metadata.wins, 4);
  assert.equal(result.candidates[0]?.metadata.standingSource, 'provider-field');
  assert.equal(result.candidates[0]?.metadata.eventCity, 'Auckland');
  assert.equal(result.candidates[0]?.metadata.eventState, 'Auckland');
});

test('bulk response without a standing column derives rank from documented standings order', () => {
  const result = adaptTopDeckV2TournamentForLearningV15(tournament({
    standings: [
      { id: 'p1', name: 'Player One', decklist: topdeckDeck, wins: 4, draws: 1, losses: 0 },
      { id: 'p2', name: 'Player Two', decklist: topdeckDeck, wins: 4, draws: 0, losses: 1 },
      { id: 'p3', name: 'Player Three', decklist: topdeckDeck, wins: 3, draws: 1, losses: 1 },
      { id: 'p4', name: 'Player Four', decklist: topdeckDeck, wins: 3, draws: 0, losses: 2 },
    ],
  }));

  assert.equal(result.rejected.length, 0);
  assert.deepEqual(result.candidates.map((candidate) => candidate.standing), [1, 2, 3, 4]);
  assert.equal(result.candidates.every((candidate) => candidate.metadata.standingSource === 'bulk-array-order'), true);
});

test('candidate enrichment requires explicit cross-source identity and features before generic ingestion', () => {
  const candidate = adaptTopDeckV2TournamentForLearningV15(tournament()).candidates[2]!;
  const observed = enrichTopDeckLearningCandidateV15(candidate, {
    canonicalOutcomeId: 'auckland-open-2026:entrant:p3',
    independenceKey: 'auckland-open-2026',
    leakageKey: 'auckland-open-2026',
    sourceObservedAt: '2026-01-02T00:00:00.000Z',
    featureExtractorId: 'deck-features-v15.1',
    features: { tournamentSupport: 0.8, comboVerification: 1 },
  });
  const ingested = ingestObservedLearningRecordsV15([observed]);

  assert.equal(ingested.rejected.length, 0);
  assert.equal(ingested.accepted.length, 1);
  assert.equal(ingested.accepted[0]?.learningTarget, 'event-top-cut');
  assert.equal(ingested.accepted[0]?.label, 0);
  assert.equal(ingested.accepted[0]?.independentGroup, 'auckland-open-2026');
  assert.equal(ingested.accepted[0]?.metadata?.attribution, TOPDECK_V2_ATTRIBUTION_V15);
  assert.equal(ingested.accepted[0]?.metadata?.standingSource, 'provider-field');
  assert.equal(ingested.accepted[0]?.metadata?.eventCity, 'Auckland');
  assert.equal(ingested.accepted[0]?.metadata?.eventState, 'Auckland');
});

test('event location is preserved only when TopDeck supplies usable city/state values', () => {
  const missing = adaptTopDeckV2TournamentForLearningV15(tournament({ eventData: undefined }));
  const malformed = adaptTopDeckV2TournamentForLearningV15(tournament({ eventData: { city: 123, state: '' } }));
  const trimmed = adaptTopDeckV2TournamentForLearningV15(tournament({ eventData: { city: '  Wellington  ', state: ' Wellington ' } }));

  assert.equal(missing.candidates[0]?.metadata.eventCity, undefined);
  assert.equal(missing.candidates[0]?.metadata.eventState, undefined);
  assert.equal(malformed.candidates[0]?.metadata.eventCity, undefined);
  assert.equal(malformed.candidates[0]?.metadata.eventState, undefined);
  assert.equal(trimmed.candidates[0]?.metadata.eventCity, 'Wellington');
  assert.equal(trimmed.candidates[0]?.metadata.eventState, 'Wellington');
});

test('adapter rejects non-EDH or team events instead of coercing their standings into Commander outcomes', () => {
  const modern = adaptTopDeckV2TournamentForLearningV15(tournament({ format: 'Modern' }));
  const team = adaptTopDeckV2TournamentForLearningV15(tournament({ isTeamEvent: true }));

  assert.equal(modern.candidates.length, 0);
  assert.equal(modern.rejected[0]?.code, 'wrong-game-or-format');
  assert.equal(team.candidates.length, 0);
  assert.equal(team.rejected[0]?.code, 'team-event-unsupported');
});

test('event-top-cut adapter requires a positive physically possible top cut', () => {
  const missing = adaptTopDeckV2TournamentForLearningV15(tournament({ topCut: 0 }));
  const tooLarge = adaptTopDeckV2TournamentForLearningV15(tournament({ topCut: 8 }));

  assert.equal(missing.candidates.length, 0);
  assert.equal(missing.rejected[0]?.code, 'missing-top-cut');
  assert.equal(tooLarge.candidates.length, 0);
  assert.equal(tooLarge.rejected[0]?.code, 'missing-top-cut');
});

test('missing stable player id is quarantined instead of falling back to mutable display name', () => {
  const payload = tournament();
  const standings = [...(payload.standings as object[])];
  standings[1] = { standing: 2, name: 'No ID', decklist: topdeckDeck };
  const result = adaptTopDeckV2TournamentForLearningV15({ ...payload, standings });

  assert.equal(result.candidates.length, 3);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0]?.code, 'missing-player-id');
});

test('external deck URLs are not fetched or guessed by the deterministic adapter', () => {
  const payload = tournament();
  const standings = [...(payload.standings as object[])];
  standings[0] = { standing: 1, id: 'p1', decklist: 'https://moxfield.com/decks/example' };
  const result = adaptTopDeckV2TournamentForLearningV15({ ...payload, standings });

  assert.equal(result.candidates.length, 3);
  assert.equal(result.rejected[0]?.code, 'external-decklist-url');
});

test('undocumented structured deck object is not guessed when inline deck text is missing', () => {
  const payload = tournament();
  const standings = [...(payload.standings as object[])];
  standings[0] = {
    standing: 1,
    id: 'p1',
    deckObj: { Commanders: { 'Kinnan, Bonder Prodigy': 1 }, Mainboard: { Forest: 99 } },
  };
  const result = adaptTopDeckV2TournamentForLearningV15({ ...payload, standings });

  assert.equal(result.candidates.length, 3);
  assert.equal(result.rejected[0]?.code, 'missing-decklist-text');
  assert.match(result.rejected[0]?.reason ?? '', /schema is not documented tightly enough/);
});

test('partial or malformed Commander lists are quarantined before learning ingestion', () => {
  const payload = tournament();
  const standings = [...(payload.standings as object[])];
  standings[0] = {
    standing: 1,
    id: 'p1',
    decklist: `~~Commanders~~\n1 Kinnan, Bonder Prodigy\n~~Mainboard~~\n98 Forest`,
  };
  const result = adaptTopDeckV2TournamentForLearningV15({ ...payload, standings });

  assert.equal(result.candidates.length, 3);
  assert.equal(result.rejected[0]?.code, 'invalid-commander-deck');
  assert.match(result.rejected[0]?.reason ?? '', /exactly 100 cards/);
});

test('malformed tournament and explicit standing bounds fail closed while preserving usable rows', () => {
  const malformed = adaptTopDeckV2TournamentForLearningV15({
    TID: 'bad',
    startDate: 'tomorrow',
    game: 'Magic: The Gathering',
    format: 'EDH',
    topCut: 1,
    standings: [],
  });
  assert.equal(malformed.rejected[0]?.code, 'malformed-tournament');

  const payload = tournament();
  const standings = [...(payload.standings as object[])];
  standings[0] = { standing: 99, id: 'p1', decklist: topdeckDeck };
  const partial = adaptTopDeckV2TournamentForLearningV15({ ...payload, standings });
  assert.equal(partial.candidates.length, 3);
  assert.equal(partial.rejected[0]?.code, 'invalid-standing');

  standings[0] = { standing: 'first', id: 'p1', decklist: topdeckDeck };
  const malformedStanding = adaptTopDeckV2TournamentForLearningV15({ ...payload, standings });
  assert.equal(malformedStanding.candidates.length, 3);
  assert.equal(malformedStanding.rejected[0]?.code, 'invalid-standing');
});
