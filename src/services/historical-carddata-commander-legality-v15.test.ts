import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard, ScryfallLegalities } from '../types/scryfall.js';
import { extractProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';

const SOURCE_HASH = 'f'.repeat(64);
const provenance = {
  method: 'archived-versioned-snapshot' as const,
  sourceId: 'historical-legality-fixture',
  sourceUri: 'https://example.test/archive/commander-2026-01-01.json',
  sourceContentHash: SOURCE_HASH,
  archiveVersion: 'commander-2026-01-01',
  snapshotEffectiveAt: '2026-01-01T00:00:00.000Z',
  archivePublishedAt: '2026-01-01T01:00:00.000Z',
  retrievedAt: '2026-08-18T00:00:00.000Z',
};

function card(options: {
  name: string;
  typeLine: string;
  cmc?: number;
  oracleText?: string;
  colorIdentity?: string[];
  commanderLegality?: ScryfallLegalities[string];
}): ScryfallCard {
  const slug = options.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `id-${slug}`,
    oracle_id: `oracle-${slug}`,
    name: options.name,
    lang: 'en',
    released_at: '2024-01-01',
    mana_cost: (options.cmc ?? 0) > 0 ? `{${options.cmc}}` : '',
    cmc: options.cmc ?? 0,
    type_line: options.typeLine,
    oracle_text: options.oracleText ?? '',
    color_identity: options.colorIdentity ?? [],
    keywords: [],
    legalities: { commander: options.commanderLegality ?? 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    rarity: 'common',
    scryfall_uri: `https://scryfall.com/card/tst/1/${slug}`,
  };
}

const commander = card({
  name: 'Legality Commander',
  typeLine: 'Legendary Creature — Test',
  cmc: 2,
});
const wastes = card({
  name: 'Wastes',
  typeLine: 'Basic Land — Wastes',
});

function extract(decklist: string, extraCards: ScryfallCard[]) {
  return extractProvenancedDeckFeatureSnapshotV15(decklist, [commander, wastes, ...extraCards], {
    availableAt: '2026-01-10T00:00:00.000Z',
    provenance,
  });
}

test('historical rich feature extraction rejects duplicate nonbasic cards without a copy-count exception', () => {
  const duplicate = card({ name: 'Ordinary Duplicate', typeLine: 'Creature — Test', cmc: 2 });
  const decklist = [
    '// COMMANDER',
    '1 Legality Commander',
    '',
    '// MAIN',
    '97 Wastes',
    '2 Ordinary Duplicate',
  ].join('\n');

  assert.throws(
    () => extract(decklist, [duplicate]),
    /Commander construction.*illegal|singleton|copy-count/i,
  );
});

test('historical rich feature extraction accepts a card whose archived Oracle text explicitly permits repeated copies', () => {
  const repeatable = card({
    name: 'Archive Petitioners',
    typeLine: 'Creature — Test',
    cmc: 2,
    oracleText: 'A deck can have any number of cards named Archive Petitioners.',
  });
  const decklist = [
    '// COMMANDER',
    '1 Legality Commander',
    '',
    '// MAIN',
    '90 Wastes',
    '9 Archive Petitioners',
  ].join('\n');

  const snapshot = extract(decklist, [repeatable]);
  assert.equal(snapshot.historicalCommanderValidation.status, 'legal');
  assert.equal(snapshot.historicalCommanderValidation.isLegal, true);
});

test('historical rich feature extraction rejects cards marked nonlegal in the archived Commander legality data', () => {
  const banned = card({
    name: 'Archived Banned Card',
    typeLine: 'Artifact',
    cmc: 1,
    commanderLegality: 'banned',
  });
  const decklist = [
    '// COMMANDER',
    '1 Legality Commander',
    '',
    '// MAIN',
    '98 Wastes',
    '1 Archived Banned Card',
  ].join('\n');

  assert.throws(
    () => extract(decklist, [banned]),
    /Commander construction.*illegal|Commander legality|nonlegal|banned/i,
  );
});

test('historical rich feature extraction rejects cards outside the combined commander color identity', () => {
  const offColor = card({
    name: 'Blue Intruder',
    typeLine: 'Instant',
    cmc: 1,
    colorIdentity: ['U'],
  });
  const decklist = [
    '// COMMANDER',
    '1 Legality Commander',
    '',
    '// MAIN',
    '98 Wastes',
    '1 Blue Intruder',
  ].join('\n');

  assert.throws(
    () => extract(decklist, [offColor]),
    /Commander construction.*illegal|color identity/i,
  );
});

test('historical rich feature extraction rejects two commanders that do not form a legal pairing', () => {
  const secondCommander = card({
    name: 'Unpaired Commander',
    typeLine: 'Legendary Creature — Test',
    cmc: 2,
  });
  const decklist = [
    '// COMMANDER',
    '1 Legality Commander',
    '1 Unpaired Commander',
    '',
    '// MAIN',
    '98 Wastes',
  ].join('\n');

  assert.throws(
    () => extract(decklist, [secondCommander]),
    /Commander construction.*illegal|pairing|two-commander/i,
  );
});
