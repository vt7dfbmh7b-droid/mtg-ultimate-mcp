import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { extractProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import { assertProvenancedHistoricalFeatureSnapshotV15 } from './historical-carddata-snapshot-validation-v15.js';

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
    scryfall_uri: 'https://scryfall.com/card/tst/1/test',
  };
}

const decklist = [
  '// COMMANDER',
  '1 Guard Commander',
  '',
  '// MAIN',
  '34 Guard Land',
  '65 Guard Threat',
].join('\n');

const cards = [
  card('Guard Commander', 'Legendary Creature — Test', 2),
  card('Guard Land', 'Basic Land — Wastes', 0),
  card('Guard Threat', 'Creature — Test', 3, 'A deck can have any number of cards named Guard Threat.'),
];

function validSnapshot() {
  return extractProvenancedDeckFeatureSnapshotV15(decklist, cards, {
    availableAt: '2026-01-10T00:00:00.000Z',
    provenance: {
      method: 'archived-versioned-snapshot',
      sourceId: 'archive',
      sourceUri: 'https://example.test/archive/cards.json',
      sourceContentHash: 'e'.repeat(64),
      archiveVersion: 'v1',
      snapshotEffectiveAt: '2026-01-08T00:00:00.000Z',
      archivePublishedAt: '2026-01-08T01:00:00.000Z',
      retrievedAt: '2026-08-18T00:00:00.000Z',
    },
  });
}

test('runtime guard accepts a genuine provenanced snapshot', () => {
  const snapshot = validSnapshot();
  assert.doesNotThrow(() => assertProvenancedHistoricalFeatureSnapshotV15(snapshot));
});

test('runtime guard rejects provenance whose source availability no longer matches recorded cardDataObservedAt', () => {
  const snapshot = validSnapshot();
  const altered = {
    ...snapshot,
    historicalCardDataProvenance: {
      ...snapshot.historicalCardDataProvenance,
      sourceDataAvailableAt: '2026-01-07T00:00:00.000Z',
    },
  };
  assert.throws(
    () => assertProvenancedHistoricalFeatureSnapshotV15(altered),
    /availability time.*cardDataObservedAt|cardDataObservedAt.*availability/i,
  );
});

test('runtime guard rejects a retrospective-current method even if an object falsely marks itself eligible', () => {
  const snapshot = validSnapshot();
  const altered = {
    ...snapshot,
    historicalCardDataProvenance: {
      ...snapshot.historicalCardDataProvenance,
      method: 'retrospective-current-data' as const,
      eligibleForRichStructuralFeatures: true,
      archiveVersion: null,
      snapshotEffectiveAt: null,
    },
  };
  assert.throws(
    () => assertProvenancedHistoricalFeatureSnapshotV15(altered),
    /retrospective current.*cannot|cannot.*retrospective current/i,
  );
});

test('runtime guard revalidates source hash, URI, and archive identity instead of trusting stored eligible=true', () => {
  const snapshot = validSnapshot();
  assert.throws(
    () => assertProvenancedHistoricalFeatureSnapshotV15({
      ...snapshot,
      historicalCardDataProvenance: {
        ...snapshot.historicalCardDataProvenance,
        sourceContentHash: 'bad',
      },
    }),
    /sourceContentHash.*SHA-256/i,
  );
  assert.throws(
    () => assertProvenancedHistoricalFeatureSnapshotV15({
      ...snapshot,
      historicalCardDataProvenance: {
        ...snapshot.historicalCardDataProvenance,
        sourceUri: 'file:///tmp/cards.json',
      },
    }),
    /sourceUri.*http/i,
  );
  assert.throws(
    () => assertProvenancedHistoricalFeatureSnapshotV15({
      ...snapshot,
      historicalCardDataProvenance: {
        ...snapshot.historicalCardDataProvenance,
        archiveVersion: '',
      },
    }),
    /archiveVersion.*non-empty|non-empty.*archiveVersion/i,
  );
});

test('runtime guard rejects stored provenance with retrieval before source availability', () => {
  const snapshot = validSnapshot();
  const altered = {
    ...snapshot,
    historicalCardDataProvenance: {
      ...snapshot.historicalCardDataProvenance,
      retrievedAt: '2026-01-07T00:00:00.000Z',
    },
  };
  assert.throws(
    () => assertProvenancedHistoricalFeatureSnapshotV15(altered),
    /retrieved.*before.*available|retrieval.*source availability|source availability.*retrieval/i,
  );
});

test('runtime guard rejects an internally contradictory eligible assessment that still carries failure reasons', () => {
  const snapshot = validSnapshot();
  const altered = {
    ...snapshot,
    historicalCardDataProvenance: {
      ...snapshot.historicalCardDataProvenance,
      eligibleForRichStructuralFeatures: true,
      reasons: ['This source would contain future knowledge.'],
    },
  };
  assert.throws(
    () => assertProvenancedHistoricalFeatureSnapshotV15(altered),
    /eligible.*reasons|reasons.*eligible|contradictory.*provenance/i,
  );
});

test('runtime guard rejects a blank source identity even when all other stored fields look valid', () => {
  const snapshot = validSnapshot();
  const altered = {
    ...snapshot,
    historicalCardDataProvenance: {
      ...snapshot.historicalCardDataProvenance,
      sourceId: ' ',
    },
  };
  assert.throws(
    () => assertProvenancedHistoricalFeatureSnapshotV15(altered),
    /sourceId.*non-empty|non-empty.*sourceId/i,
  );
});
