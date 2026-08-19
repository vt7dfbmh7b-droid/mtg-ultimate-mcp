import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  DECK_FEATURE_EXTRACTOR_ID_V15,
  DECK_FEATURE_NORMALIZER_ID_V15,
  extractDeckFeatureSnapshotV15,
  fitDeckFeatureNormalizerV15,
} from './deck-feature-snapshot-v15.js';
import { ingestObservedLearningRecordsV15 } from './learning-corpus-ingestion-v15.js';
import {
  materializeTopDeckLearningCandidateV15,
} from './topdeck-learning-materializer-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';

function card(
  name: string,
  typeLine: string,
  cmc: number,
  oracleText = '',
): ScryfallCard {
  return {
    id: `id-${name}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    released_at: '2024-01-01',
    mana_cost: cmc > 0 ? `{${cmc}}` : '',
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    rarity: 'common',
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
  };
}

function structuralDeck(prefix: string, cheapInteraction: number, threatManaValue: number): {
  decklist: string;
  cards: ScryfallCard[];
  commanderName: string;
} {
  const commanderName = `${prefix} Commander`;
  const landName = `${prefix} Land`;
  const answerName = `${prefix} Answer`;
  const threatName = `${prefix} Threat`;
  const threatCount = 65 - cheapInteraction;
  return {
    commanderName,
    decklist: [
      '// COMMANDER',
      `1 ${commanderName}`,
      '',
      '// MAIN',
      `34 ${landName}`,
      `${cheapInteraction} ${answerName}`,
      `${threatCount} ${threatName}`,
    ].join('\n'),
    cards: [
      card(commanderName, 'Legendary Creature — Test', 2),
      card(landName, 'Land', 0, '{T}: Add {C}.'),
      card(answerName, 'Instant', 1, 'Destroy target creature.'),
      card(threatName, 'Creature — Test', threatManaValue),
    ],
  };
}

function snapshot(
  fixture: ReturnType<typeof structuralDeck>,
  availableAt: string,
) {
  return extractDeckFeatureSnapshotV15(fixture.decklist, fixture.cards, {
    availableAt,
    cardDataObservedAt: '2024-12-31T00:00:00.000Z',
  });
}

function candidate(
  fixture: ReturnType<typeof structuralDeck>,
  options: { playerId: string; standing: number; eventId?: string },
): TopDeckLearningCandidateV15 {
  const eventId = options.eventId ?? 'test-open-2026';
  return {
    sourceId: 'topdeck',
    providerEventId: eventId,
    providerPlayerId: options.playerId,
    providerRecordId: `${eventId}:standing:${options.playerId}`,
    sourceUrl: `https://topdeck.gg/event/${eventId}`,
    outcomeOccurredAt: '2026-01-10T00:00:00.000Z',
    standing: options.standing,
    fieldSize: 32,
    topCutSize: 8,
    decklist: fixture.decklist,
    commanderNames: [fixture.commanderName],
    metadata: {
      provider: 'topdeck-v2',
      tournamentName: 'Test Open',
      wins: null,
      draws: null,
      losses: null,
      standingSource: 'provider-field',
    },
  };
}

function linkage(playerId: string) {
  return {
    canonicalOutcomeId: `test-open-2026:entrant:${playerId}`,
    independenceKey: 'test-open-2026',
    leakageKey: 'test-open-2026',
    sourceObservedAt: '2026-01-11T00:00:00.000Z',
  };
}

test('same historical deck materializes identical predictors even when TopDeck outcome labels differ', () => {
  const trainLow = snapshot(structuralDeck('Train Low', 4, 5), '2025-10-01T00:00:00.000Z');
  const trainHigh = snapshot(structuralDeck('Train High', 16, 2), '2025-11-01T00:00:00.000Z');
  const normalizer = fitDeckFeatureNormalizerV15([trainLow, trainHigh]);

  const targetFixture = structuralDeck('Target', 10, 3);
  const targetSnapshot = snapshot(targetFixture, '2026-01-09T00:00:00.000Z');
  const winner = materializeTopDeckLearningCandidateV15(
    candidate(targetFixture, { playerId: 'winner', standing: 1 }),
    targetSnapshot,
    normalizer,
    linkage('winner'),
  );
  const miss = materializeTopDeckLearningCandidateV15(
    candidate(targetFixture, { playerId: 'miss', standing: 20 }),
    targetSnapshot,
    normalizer,
    linkage('miss'),
  );

  assert.deepEqual(winner.features, miss.features);
  assert.equal(winner.featureExtractorId, `${DECK_FEATURE_EXTRACTOR_ID_V15}+${DECK_FEATURE_NORMALIZER_ID_V15}`);
  assert.equal(winner.metadata?.featureSnapshotAvailableAt, '2026-01-09T00:00:00.000Z');

  const ingested = ingestObservedLearningRecordsV15([winner, miss]);
  assert.equal(ingested.rejected.length, 0);
  assert.deepEqual(ingested.accepted.map((record) => record.label), [1, 0]);
  assert.deepEqual(ingested.accepted[0]?.features, ingested.accepted[1]?.features);
});

test('materializer rejects a feature snapshot created after the tournament outcome', () => {
  const trainA = snapshot(structuralDeck('Train A', 4, 5), '2025-10-01T00:00:00.000Z');
  const trainB = snapshot(structuralDeck('Train B', 16, 2), '2025-11-01T00:00:00.000Z');
  const normalizer = fitDeckFeatureNormalizerV15([trainA, trainB]);
  const targetFixture = structuralDeck('Late Target', 10, 3);
  const lateSnapshot = snapshot(targetFixture, '2026-01-12T00:00:00.000Z');

  assert.throws(
    () => materializeTopDeckLearningCandidateV15(
      candidate(targetFixture, { playerId: 'late', standing: 4 }),
      lateSnapshot,
      normalizer,
      linkage('late'),
    ),
    /snapshot.*after|after.*outcome/i,
  );
});

test('materializer rejects deck fingerprint and commander identity mismatches', () => {
  const trainA = snapshot(structuralDeck('Train C', 4, 5), '2025-10-01T00:00:00.000Z');
  const trainB = snapshot(structuralDeck('Train D', 16, 2), '2025-11-01T00:00:00.000Z');
  const normalizer = fitDeckFeatureNormalizerV15([trainA, trainB]);
  const candidateFixture = structuralDeck('Candidate', 10, 3);
  const otherFixture = structuralDeck('Other', 10, 3);
  const otherSnapshot = snapshot(otherFixture, '2026-01-09T00:00:00.000Z');

  assert.throws(
    () => materializeTopDeckLearningCandidateV15(
      candidate(candidateFixture, { playerId: 'fingerprint', standing: 2 }),
      otherSnapshot,
      normalizer,
      linkage('fingerprint'),
    ),
    /fingerprint/i,
  );

  const matchingSnapshot = snapshot(candidateFixture, '2026-01-09T00:00:00.000Z');
  const wrongCommanderCandidate = candidate(candidateFixture, { playerId: 'commander', standing: 2 });
  wrongCommanderCandidate.commanderNames = ['Definitely Not The Candidate Commander'];
  assert.throws(
    () => materializeTopDeckLearningCandidateV15(
      wrongCommanderCandidate,
      matchingSnapshot,
      normalizer,
      linkage('commander'),
    ),
    /commander/i,
  );
});
