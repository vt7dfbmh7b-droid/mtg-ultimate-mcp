import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { extractProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';

const SOURCE_HASH = 'c'.repeat(64);
const REPEATABLE_THREAT_TEXT = 'A deck can have any number of cards named Historical Threat.';

function card(options: {
  id: string;
  name: string;
  set: string;
  collector: string;
  releasedAt?: string;
  cmc: number;
  typeLine: string;
  oracleText?: string;
}): ScryfallCard {
  return {
    id: options.id,
    oracle_id: `oracle-${options.name}`,
    name: options.name,
    lang: 'en',
    ...(options.releasedAt ? { released_at: options.releasedAt } : {}),
    mana_cost: options.cmc > 0 ? `{${options.cmc}}` : '',
    cmc: options.cmc,
    type_line: options.typeLine,
    oracle_text: options.oracleText ?? '',
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: options.set,
    set_name: options.set,
    collector_number: options.collector,
    rarity: 'common',
    scryfall_uri: `https://scryfall.com/card/${options.set}/${options.collector}`,
  };
}

const commander = card({
  id: 'commander-old',
  name: 'Historical Commander',
  set: 'old',
  collector: '1',
  releasedAt: '2024-01-01',
  cmc: 2,
  typeLine: 'Legendary Creature — Test',
});
const land = card({
  id: 'land-old',
  name: 'Historical Land',
  set: 'old',
  collector: '2',
  releasedAt: '2024-01-01',
  cmc: 0,
  typeLine: 'Basic Land — Wastes',
  oracleText: '{T}: Add {C}.',
});
const oldThreat = card({
  id: 'threat-old',
  name: 'Historical Threat',
  set: 'old',
  collector: '3',
  releasedAt: '2024-01-01',
  cmc: 3,
  typeLine: 'Creature — Test',
  oracleText: REPEATABLE_THREAT_TEXT,
});
const futureThreat = card({
  id: 'threat-future',
  name: 'Historical Threat',
  set: 'new',
  collector: '77',
  releasedAt: '2026-02-01',
  cmc: 9,
  typeLine: 'Creature — Test',
  oracleText: REPEATABLE_THREAT_TEXT,
});

const nameOnlyDeck = [
  '// COMMANDER',
  '1 Historical Commander',
  '',
  '// MAIN',
  '34 Historical Land',
  '65 Historical Threat',
].join('\n');

const provenance = {
  method: 'archived-versioned-snapshot' as const,
  sourceId: 'historical-archive',
  sourceUri: 'https://example.test/archive/2026-01-01.json',
  sourceContentHash: SOURCE_HASH,
  archiveVersion: '2026-01-01',
  snapshotEffectiveAt: '2026-01-01T00:00:00.000Z',
  archivePublishedAt: '2026-01-01T01:00:00.000Z',
  retrievedAt: '2026-08-18T00:00:00.000Z',
};

test('name-only historical entries ignore post-cutoff printings even when future cards appear first', () => {
  const snapshot = extractProvenancedDeckFeatureSnapshotV15(
    nameOnlyDeck,
    [futureThreat, commander, land, oldThreat],
    { availableAt: '2026-01-10T00:00:00.000Z', provenance },
  );

  assert.ok(snapshot.raw.averageNonlandManaValue < 4);
  assert.equal(snapshot.historicalCommanderValidation.status, 'legal');
});

test('historical name-only resolution is deterministic regardless of printing input order', () => {
  const forward = extractProvenancedDeckFeatureSnapshotV15(
    nameOnlyDeck,
    [futureThreat, commander, land, oldThreat],
    { availableAt: '2026-01-10T00:00:00.000Z', provenance },
  );
  const reverse = extractProvenancedDeckFeatureSnapshotV15(
    nameOnlyDeck,
    [oldThreat, land, commander, futureThreat],
    { availableAt: '2026-01-10T00:00:00.000Z', provenance },
  );

  assert.deepEqual(reverse.raw, forward.raw);
  assert.equal(reverse.cardDataSnapshotFingerprint, forward.cardDataSnapshotFingerprint);
  assert.deepEqual(reverse.historicalCommanderValidation, forward.historicalCommanderValidation);
});

test('name-only historical resolution fails closed when no dated printing proves the card existed by the cutoff', () => {
  const unknownReleaseThreat = card({
    id: 'threat-unknown',
    name: 'Historical Threat',
    set: 'unk',
    collector: '1',
    cmc: 3,
    typeLine: 'Creature — Test',
    oracleText: REPEATABLE_THREAT_TEXT,
  });
  assert.throws(
    () => extractProvenancedDeckFeatureSnapshotV15(
      nameOnlyDeck,
      [commander, land, unknownReleaseThreat, futureThreat],
      { availableAt: '2026-01-10T00:00:00.000Z', provenance },
    ),
    /prove.*existed|release date|no historical printing/i,
  );
});

test('an exact set/collector deck line remains exact and a future exact printing is rejected', () => {
  const exactFutureDeck = [
    '// COMMANDER',
    '1 Historical Commander',
    '',
    '// MAIN',
    '34 Historical Land',
    '65 Historical Threat (NEW) 77',
  ].join('\n');

  assert.throws(
    () => extractProvenancedDeckFeatureSnapshotV15(
      exactFutureDeck,
      [commander, land, oldThreat, futureThreat],
      { availableAt: '2026-01-10T00:00:00.000Z', provenance },
    ),
    /exact.*printing.*after|future.*printing|released after/i,
  );
});

test('when several pre-cutoff name-only printings exist, selection is deterministic and prefers the latest known available printing', () => {
  const older = oldThreat;
  const later = card({
    id: 'threat-mid',
    name: 'Historical Threat',
    set: 'mid',
    collector: '5',
    releasedAt: '2025-12-01',
    cmc: 4,
    typeLine: 'Creature — Test',
    oracleText: REPEATABLE_THREAT_TEXT,
  });
  const snapshot = extractProvenancedDeckFeatureSnapshotV15(
    nameOnlyDeck,
    [older, futureThreat, later, commander, land],
    { availableAt: '2026-01-10T00:00:00.000Z', provenance },
  );

  assert.ok(snapshot.raw.averageNonlandManaValue > 3.8 && snapshot.raw.averageNonlandManaValue < 4.1);
  assert.equal(snapshot.historicalCommanderValidation.status, 'legal');
});
