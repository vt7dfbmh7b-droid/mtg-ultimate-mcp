import assert from 'node:assert/strict';
import test from 'node:test';
import { deduplicateTournamentEvidenceV12 } from './evidence-dedup-v12.js';

test('collapses the same event and player across TopDeck and EDHTop16', () => {
  const result = deduplicateTournamentEvidenceV12(
    {
      records: [{
        tournamentId: 'td-1',
        tournamentName: 'Example Open 2026',
        player: 'Alice Smith',
        commanders: ['Tymna the Weaver', "Kraum, Ludevic's Opus"],
        standing: 4,
        wins: 5,
        draws: 1,
        losses: 1,
        sourceDeckUrl: 'https://www.moxfield.com/decks/abc123',
      }],
    },
    {
      entries: [{
        tournamentName: 'Example Open 2026',
        name: 'Alice Smith',
        commander: "Tymna the Weaver / Kraum, Ludevic's Opus",
        standing: 4,
        wins: 5,
        draws: 1,
        losses: 1,
        decklist: 'https://www.moxfield.com/decks/abc123',
      }],
    },
  ) as Record<string, unknown>;

  assert.equal(result.rawRecordCount, 2);
  assert.equal(result.effectiveUniqueRecordCount, 1);
  assert.equal(result.duplicateRecordCount, 1);
});

test('does not deduplicate a reused deck URL across different events', () => {
  const result = deduplicateTournamentEvidenceV12(
    {
      records: [{
        tournamentName: 'Event One',
        player: 'Alice Smith',
        commanders: ['Atraxa, Grand Unifier'],
        wins: 4,
        draws: 0,
        losses: 2,
        sourceDeckUrl: 'https://www.moxfield.com/decks/reused',
      }],
    },
    {
      entries: [{
        tournamentName: 'Event Two',
        name: 'Alice Smith',
        commander: 'Atraxa, Grand Unifier',
        wins: 4,
        draws: 0,
        losses: 2,
        decklist: 'https://www.moxfield.com/decks/reused',
      }],
    },
  ) as Record<string, unknown>;

  assert.equal(result.rawRecordCount, 2);
  assert.equal(result.effectiveUniqueRecordCount, 2);
  assert.equal(result.duplicateRecordCount, 0);
});

test('does not merge records only because player and commander match', () => {
  const result = deduplicateTournamentEvidenceV12(
    {
      records: [{
        tournamentName: 'Regional A',
        player: 'Bob',
        commanders: ['Kinnan, Bonder Prodigy'],
        wins: 5,
        draws: 0,
        losses: 1,
      }],
    },
    {
      entries: [{
        tournamentName: 'Regional B',
        name: 'Bob',
        commander: 'Kinnan, Bonder Prodigy',
        wins: 5,
        draws: 0,
        losses: 1,
      }],
    },
  ) as Record<string, unknown>;

  assert.equal(result.effectiveUniqueRecordCount, 2);
});
