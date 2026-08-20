import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { extractDeckFeatureSnapshotV15 } from './deck-feature-snapshot-v15.js';
import { extractProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import {
  materializeTopDeckTemporalCorpusV15,
  TOPDECK_HISTORICAL_OUTCOME_SOURCE_VERSION_V15,
  type TopDeckTemporalCorpusItemV15,
} from './topdeck-temporal-corpus-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';

const FIXTURE_SOURCE_HASH = 'd'.repeat(64);

function card(name: string, typeLine: string, cmc: number, oracleText = ''): ScryfallCard {
  return {
    id: `id-${name}`, oracle_id: `oracle-${name}`, name, lang: 'en', released_at: '2024-01-01', mana_cost: cmc > 0 ? `{${cmc}}` : '', cmc,
    type_line: typeLine, oracle_text: oracleText, color_identity: [], keywords: [], legalities: { commander: 'legal' }, set: 'tst', set_name: 'Test Set',
    collector_number: '1', rarity: 'common', scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
  };
}

function structuralDeck(prefix: string, cheapInteraction: number, threatManaValue: number) {
  const commanderName = `${prefix} Commander`;
  const landName = `${prefix} Land`;
  const answerName = `${prefix} Answer`;
  const threatName = `${prefix} Threat`;
  return {
    commanderName,
    decklist: ['// COMMANDER', `1 ${commanderName}`, '', '// MAIN', `34 ${landName}`, `${cheapInteraction} ${answerName}`, `${65 - cheapInteraction} ${threatName}`].join('\n'),
    cards: [
      card(commanderName, 'Legendary Creature — Test', 2),
      card(landName, 'Basic Land — Wastes', 0, '{T}: Add {C}.'),
      card(answerName, 'Instant', 1, `A deck can have any number of cards named ${answerName}.\nDestroy target creature.`),
      card(threatName, 'Creature — Test', threatManaValue, `A deck can have any number of cards named ${threatName}.`),
    ],
  };
}

function item(options: { id: string; outcomeAt: string; standing: number; cheapInteraction: number; threatManaValue: number; leakageKey?: string }): TopDeckTemporalCorpusItemV15 {
  const fixture = structuralDeck(options.id, options.cheapInteraction, options.threatManaValue);
  const outcomeMs = Date.parse(options.outcomeAt);
  const snapshotAt = new Date(outcomeMs - 86_400_000).toISOString();
  const observedAt = new Date(outcomeMs + 86_400_000).toISOString();
  const retrievedAt = new Date(outcomeMs + 86_460_000).toISOString();
  const candidate: TopDeckLearningCandidateV15 = {
    sourceId: 'topdeck', providerEventId: options.id, providerPlayerId: `player-${options.id}`,
    providerRecordId: `${options.id}:standing:player-${options.id}`, sourceUrl: `https://topdeck.gg/event/${options.id}`,
    outcomeOccurredAt: new Date(outcomeMs).toISOString(), standing: options.standing, fieldSize: 32, topCutSize: 8,
    decklist: fixture.decklist, commanderNames: [fixture.commanderName],
    metadata: {
      provider: 'topdeck-v2', tournamentName: options.id, wins: null, draws: null, losses: null,
      standingSource: 'provider-field', deckSource: 'inline-text',
    },
  };
  return {
    candidate,
    snapshot: extractProvenancedDeckFeatureSnapshotV15(fixture.decklist, fixture.cards, {
      availableAt: snapshotAt,
      provenance: {
        method: 'contemporaneous-capture', sourceId: 'fixture-card-snapshot', sourceUri: `https://example.test/fixtures/${encodeURIComponent(options.id)}.json`,
        sourceContentHash: FIXTURE_SOURCE_HASH, observedAt: '2024-12-31T00:00:00.000Z', retrievedAt: '2024-12-31T00:05:00.000Z',
      },
    }),
    linkage: {
      canonicalOutcomeId: `canonical:${options.id}`, independenceKey: `event:${options.id}`, leakageKey: options.leakageKey ?? `event:${options.id}`,
      sourceObservedAt: observedAt, sourceRetrievedAt: retrievedAt,
    },
  };
}

function baseItems(holdoutInteraction: number, holdoutManaValue: number): TopDeckTemporalCorpusItemV15[] {
  return [
    item({ id: 'train-1', outcomeAt: '2026-01-01T00:00:00Z', standing: 2, cheapInteraction: 4, threatManaValue: 5 }),
    item({ id: 'train-2', outcomeAt: '2026-01-10T00:00:00Z', standing: 20, cheapInteraction: 8, threatManaValue: 4 }),
    item({ id: 'train-3', outcomeAt: '2026-01-20T00:00:00Z', standing: 3, cheapInteraction: 12, threatManaValue: 3 }),
    item({ id: 'train-4', outcomeAt: '2026-02-01T00:00:00Z', standing: 18, cheapInteraction: 16, threatManaValue: 2 }),
    item({ id: 'future', outcomeAt: '2026-03-01T00:00:00Z', standing: 1, cheapInteraction: holdoutInteraction, threatManaValue: holdoutManaValue }),
  ];
}

test('future holdout deck structure cannot change the normalizer fitted on planned training snapshots', () => {
  const ordinary = materializeTopDeckTemporalCorpusV15(baseItems(10, 3), { holdoutFraction: 0.2 });
  const extreme = materializeTopDeckTemporalCorpusV15(baseItems(40, 7), { holdoutFraction: 0.2 });
  assert.deepEqual(ordinary.partition, extreme.partition);
  assert.deepEqual(ordinary.normalizer, extreme.normalizer);
  assert.equal(ordinary.partition.trainingIds.length, 4);
  assert.deepEqual(ordinary.partition.holdoutIds, ['canonical:future']);
  assert.equal(ordinary.normalizer.fittedSnapshotCount, 4);
  const ordinaryTraining = ordinary.ingestion.accepted.filter((record) => ordinary.partition.trainingIds.includes(record.outcomeId));
  const extremeTraining = extreme.ingestion.accepted.filter((record) => extreme.partition.trainingIds.includes(record.outcomeId));
  assert.deepEqual(ordinaryTraining, extremeTraining);
  const holdout = extreme.ingestion.accepted.find((record) => record.outcomeId === 'canonical:future');
  assert.ok(holdout);
  assert.ok(Object.values(holdout.features).every((value) => value >= -1 && value <= 1));
  assert.equal(holdout.metadata?.historicalCardDataMethod, 'contemporaneous-capture');
  assert.equal(holdout.metadata?.historicalCardDataSourceContentHash, FIXTURE_SOURCE_HASH);
  assert.equal(holdout.metadata?.historicalCommanderLegalityStatus, 'legal');
  assert.equal(holdout.metadata?.historicalOutcomeSourceVersion, TOPDECK_HISTORICAL_OUTCOME_SOURCE_VERSION_V15);
  assert.equal(typeof holdout.metadata?.historicalOutcomeSourceContentHash, 'string');
  assert.equal(extreme.manifest.audit.uniqueRecords, 5);
  assert.deepEqual(extreme.manifest.refreshAudit, { providerCandidates: 5, providerRejected: 0, ingestionAccepted: 5, ingestionRejected: 0 });
  assert.equal(extreme.historicalRecords.length, 5);
  assert.equal(extreme.historicalRecords.every((record) => record.eligibleForHistoricalTraining), true);
  assert.equal(extreme.historicalRecords.every((record) => record.safeguards.outcomeEvidenceTargetOnly), true);
  assert.equal(extreme.historicalRecords.every((record) => record.outcomeEvidence.replayable), true);
  assert.equal(extreme.historicalManifest.recordCount, 5);
  assert.equal(extreme.historicalManifest.eligibleRecordCount, 5);
  assert.equal(extreme.historicalManifest.ineligibleRecordCount, 0);
  assert.equal(extreme.historicalManifest.replayableRecords, 5);
  assert.deepEqual(extreme.historicalManifest.outcomeEvidenceSourceVersions, [TOPDECK_HISTORICAL_OUTCOME_SOURCE_VERSION_V15]);
});

test('planner assigns an entire leakage series before fitting normalization', () => {
  const result = materializeTopDeckTemporalCorpusV15([
    item({ id: 'early-series', outcomeAt: '2026-01-01T00:00:00Z', standing: 2, cheapInteraction: 6, threatManaValue: 4, leakageKey: 'shared-series' }),
    item({ id: 'train-b', outcomeAt: '2026-01-10T00:00:00Z', standing: 20, cheapInteraction: 8, threatManaValue: 4 }),
    item({ id: 'train-c', outcomeAt: '2026-01-20T00:00:00Z', standing: 3, cheapInteraction: 12, threatManaValue: 3 }),
    item({ id: 'late-series', outcomeAt: '2026-02-10T00:00:00Z', standing: 1, cheapInteraction: 30, threatManaValue: 7, leakageKey: 'shared-series' }),
  ], { holdoutFraction: 0.25 });
  assert.deepEqual(result.partition.holdoutIds.sort(), ['canonical:early-series', 'canonical:late-series']);
  assert.equal(result.normalizer.fittedSnapshotCount, 2);
  assert.equal(result.partition.leakageChecksPassed, true);
  assert.equal(result.historicalManifest.eligibleRecordCount, 4);
});

test('workflow fails closed when leakage grouping leaves no historical training snapshots', () => {
  assert.throws(
    () => materializeTopDeckTemporalCorpusV15([
      item({ id: 'same-1', outcomeAt: '2026-01-01T00:00:00Z', standing: 2, cheapInteraction: 6, threatManaValue: 4, leakageKey: 'one-series' }),
      item({ id: 'same-2', outcomeAt: '2026-02-01T00:00:00Z', standing: 20, cheapInteraction: 8, threatManaValue: 4, leakageKey: 'one-series' }),
    ], { holdoutFraction: 0.5 }),
    /no historical training|training snapshots/i,
  );
});

test('historical corpus workflow rejects a plain low-level snapshot without provenance assessment', () => {
  const safeItem = item({ id: 'unprovenanced', outcomeAt: '2026-02-01T00:00:00Z', standing: 2, cheapInteraction: 8, threatManaValue: 3 });
  const fixture = structuralDeck('unprovenanced', 8, 3);
  const plainSnapshot = extractDeckFeatureSnapshotV15(fixture.decklist, fixture.cards, { availableAt: '2026-01-31T00:00:00.000Z', cardDataObservedAt: '2024-12-31T00:00:00.000Z' });
  const unprovenancedItem = { ...safeItem, snapshot: plainSnapshot } as unknown as TopDeckTemporalCorpusItemV15;
  assert.throws(
    () => materializeTopDeckTemporalCorpusV15([
      item({ id: 'historical-train', outcomeAt: '2026-01-01T00:00:00Z', standing: 3, cheapInteraction: 6, threatManaValue: 4 }),
      unprovenancedItem,
    ], { holdoutFraction: 0.5 }),
    /historical.*provenance|provenanced snapshot|provenance assessment/i,
  );
});

test('historical corpus rejects outcome retrieval timestamps that precede source observation', () => {
  const invalid = item({ id: 'bad-retrieval-order', outcomeAt: '2026-02-01T00:00:00Z', standing: 2, cheapInteraction: 8, threatManaValue: 3 });
  invalid.linkage.sourceRetrievedAt = '2026-02-01T12:00:00.000Z';
  assert.throws(
    () => materializeTopDeckTemporalCorpusV15([
      item({ id: 'valid-train', outcomeAt: '2026-01-01T00:00:00Z', standing: 3, cheapInteraction: 6, threatManaValue: 4 }),
      invalid,
    ], { holdoutFraction: 0.5 }),
    /sourceRetrievedAt.*before.*sourceObservedAt/i,
  );
});
