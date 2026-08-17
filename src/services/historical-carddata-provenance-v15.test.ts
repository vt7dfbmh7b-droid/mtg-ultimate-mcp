import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  assessHistoricalCardDataProvenanceV15,
  extractProvenancedDeckFeatureSnapshotV15,
  type HistoricalCardDataProvenanceV15,
} from './historical-carddata-provenance-v15.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function card(name: string, typeLine: string, cmc: number, oracleText = ''): ScryfallCard {
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

const decklist = [
  '// COMMANDER',
  '1 Provenance Commander',
  '',
  '// MAIN',
  '34 Provenance Land',
  '10 Provenance Answer',
  '55 Provenance Threat',
].join('\n');

const cards = [
  card('Provenance Commander', 'Legendary Creature — Test', 2),
  card('Provenance Land', 'Basic Land — Wastes', 0, '{T}: Add {C}.'),
  card('Provenance Answer', 'Instant', 1, 'A deck can have any number of cards named Provenance Answer.\nDestroy target creature.'),
  card('Provenance Threat', 'Creature — Test', 3, 'A deck can have any number of cards named Provenance Threat.'),
];

function contemporaneous(overrides: Partial<Extract<HistoricalCardDataProvenanceV15, { method: 'contemporaneous-capture' }>> = {}): HistoricalCardDataProvenanceV15 {
  return {
    method: 'contemporaneous-capture',
    sourceId: 'pinned-scryfall-export',
    sourceUri: 'https://example.test/snapshots/cards-2026-01-09.json',
    sourceContentHash: HASH_A,
    observedAt: '2026-01-09T00:00:00.000Z',
    retrievedAt: '2026-01-09T00:05:00.000Z',
    ...overrides,
  };
}

function archive(overrides: Partial<Extract<HistoricalCardDataProvenanceV15, { method: 'archived-versioned-snapshot' }>> = {}): HistoricalCardDataProvenanceV15 {
  return {
    method: 'archived-versioned-snapshot',
    sourceId: 'versioned-card-archive',
    sourceUri: 'https://example.test/archive/cards-v2026-01-08.json',
    sourceContentHash: HASH_B,
    archiveVersion: 'cards-v2026-01-08',
    snapshotEffectiveAt: '2026-01-08T00:00:00.000Z',
    archivePublishedAt: '2026-01-08T06:00:00.000Z',
    retrievedAt: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}

test('genuinely contemporaneous capture is eligible only when the source was observable before the feature cutoff', () => {
  const safe = assessHistoricalCardDataProvenanceV15(
    contemporaneous(),
    '2026-01-10T00:00:00.000Z',
  );
  assert.equal(safe.eligibleForRichStructuralFeatures, true);
  assert.equal(safe.sourceDataAvailableAt, '2026-01-09T00:00:00.000Z');
  assert.deepEqual(safe.reasons, []);

  const future = assessHistoricalCardDataProvenanceV15(
    contemporaneous({
      observedAt: '2026-01-11T00:00:00.000Z',
      retrievedAt: '2026-01-11T00:05:00.000Z',
    }),
    '2026-01-10T00:00:00.000Z',
  );
  assert.equal(future.eligibleForRichStructuralFeatures, false);
  assert.match(future.reasons.join(' '), /after.*feature|future/i);
});

test('a verifiable archive published before the event may be retrieved later without becoming future leakage', () => {
  const result = assessHistoricalCardDataProvenanceV15(
    archive(),
    '2026-01-10T00:00:00.000Z',
  );

  assert.equal(result.eligibleForRichStructuralFeatures, true);
  assert.equal(result.sourceDataAvailableAt, '2026-01-08T06:00:00.000Z');
  assert.equal(result.retrievedAt, '2026-08-18T00:00:00.000Z');
  assert.equal(result.archiveVersion, 'cards-v2026-01-08');
});

test('an archive published after the predicted event is rejected even if it claims an older effective date', () => {
  const result = assessHistoricalCardDataProvenanceV15(
    archive({
      snapshotEffectiveAt: '2025-12-01T00:00:00.000Z',
      archivePublishedAt: '2026-01-12T00:00:00.000Z',
      retrievedAt: '2026-08-18T00:00:00.000Z',
    }),
    '2026-01-10T00:00:00.000Z',
  );

  assert.equal(result.eligibleForRichStructuralFeatures, false);
  assert.match(result.reasons.join(' '), /published.*after|after.*feature/i);
});

test('current data retrieved retrospectively is never eligible for the rich Oracle-derived feature contract', () => {
  const result = assessHistoricalCardDataProvenanceV15({
    method: 'retrospective-current-data',
    sourceId: 'scryfall-current',
    sourceUri: 'https://api.scryfall.com/bulk-data',
    sourceContentHash: HASH_A,
    retrievedAt: '2026-08-18T00:00:00.000Z',
  }, '2025-06-01T00:00:00.000Z');

  assert.equal(result.eligibleForRichStructuralFeatures, false);
  assert.equal(result.sourceDataAvailableAt, '2026-08-18T00:00:00.000Z');
  assert.match(result.reasons.join(' '), /retrospective current data|future knowledge|not eligible/i);
});

test('archive time ordering, content hashes, source URI, and version identity fail closed', () => {
  assert.throws(
    () => assessHistoricalCardDataProvenanceV15(archive({ sourceContentHash: 'not-a-sha' }), '2026-01-10T00:00:00Z'),
    /sourceContentHash.*SHA-256/i,
  );
  assert.throws(
    () => assessHistoricalCardDataProvenanceV15(archive({ sourceUri: 'not a url' }), '2026-01-10T00:00:00Z'),
    /sourceUri.*https?/i,
  );
  assert.throws(
    () => assessHistoricalCardDataProvenanceV15(archive({ archiveVersion: ' ' }), '2026-01-10T00:00:00Z'),
    /archiveVersion.*non-empty/i,
  );
  assert.throws(
    () => assessHistoricalCardDataProvenanceV15(archive({
      snapshotEffectiveAt: '2026-01-09T00:00:00Z',
      archivePublishedAt: '2026-01-08T00:00:00Z',
    }), '2026-01-10T00:00:00Z'),
    /effective.*published|published.*effective/i,
  );
  assert.throws(
    () => assessHistoricalCardDataProvenanceV15(archive({
      archivePublishedAt: '2026-01-08T06:00:00Z',
      retrievedAt: '2026-01-07T00:00:00Z',
    }), '2026-01-10T00:00:00Z'),
    /retrieved.*published|published.*retrieved/i,
  );
});

test('provenanced extraction rejects retrospective current data before constructing a rich snapshot', () => {
  assert.throws(
    () => extractProvenancedDeckFeatureSnapshotV15(decklist, cards, {
      availableAt: '2025-06-01T00:00:00.000Z',
      provenance: {
        method: 'retrospective-current-data',
        sourceId: 'current-scryfall',
        sourceUri: 'https://api.scryfall.com/bulk-data',
        sourceContentHash: HASH_A,
        retrievedAt: '2026-08-18T00:00:00.000Z',
      },
    }),
    /not eligible|retrospective current data|future knowledge/i,
  );
});

test('provenanced extraction grounds cardDataObservedAt in the verified source availability time', () => {
  const contemporaneousSnapshot = extractProvenancedDeckFeatureSnapshotV15(decklist, cards, {
    availableAt: '2026-01-10T00:00:00.000Z',
    provenance: contemporaneous(),
  });
  assert.equal(contemporaneousSnapshot.cardDataObservedAt, '2026-01-09T00:00:00.000Z');
  assert.equal(contemporaneousSnapshot.historicalCardDataProvenance.method, 'contemporaneous-capture');
  assert.equal(contemporaneousSnapshot.historicalCardDataProvenance.sourceContentHash, HASH_A);
  assert.equal(contemporaneousSnapshot.historicalCommanderValidation.status, 'legal');

  const archivedSnapshot = extractProvenancedDeckFeatureSnapshotV15(decklist, cards, {
    availableAt: '2026-01-10T00:00:00.000Z',
    provenance: archive(),
  });
  assert.equal(archivedSnapshot.cardDataObservedAt, '2026-01-08T06:00:00.000Z');
  assert.equal(archivedSnapshot.historicalCardDataProvenance.method, 'archived-versioned-snapshot');
  assert.equal(archivedSnapshot.historicalCardDataProvenance.archiveVersion, 'cards-v2026-01-08');
  assert.equal(archivedSnapshot.historicalCommanderValidation.status, 'legal');
});

test('assessment is deterministic and contains no outcome label or standing surface', () => {
  const first = assessHistoricalCardDataProvenanceV15(archive(), '2026-01-10T00:00:00Z');
  const second = assessHistoricalCardDataProvenanceV15(archive(), '2026-01-10T00:00:00Z');
  assert.deepEqual(first, second);
  assert.doesNotMatch(JSON.stringify(first), /standing|label|winRate|topCut/i);
});
