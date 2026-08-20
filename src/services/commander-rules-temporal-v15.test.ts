import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { extractProvenancedDeckFeatureSnapshotV15 } from './historical-carddata-provenance-v15.js';
import { validateCommanderDeck } from './commander-rules.js';
import {
  validateCommanderDeckAsOfV15,
  VEHICLE_SPACECRAFT_COMMANDER_RULE_EFFECTIVE_AT_V15,
} from './commander-rules-temporal-v15.js';
import { parseDecklist } from './deck.js';

function card(options: {
  name: string;
  typeLine: string;
  releasedAt: string;
  oracleText?: string;
  power?: string;
  toughness?: string;
}): ScryfallCard {
  return {
    id: `id-${options.name}`,
    oracle_id: `oracle-${options.name}`,
    name: options.name,
    lang: 'en',
    released_at: options.releasedAt,
    cmc: 4,
    type_line: options.typeLine,
    ...(options.oracleText !== undefined ? { oracle_text: options.oracleText } : {}),
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Historical Commander Rule Test',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(options.name)}`,
    ...(options.power !== undefined ? { power: options.power } : {}),
    ...(options.toughness !== undefined ? { toughness: options.toughness } : {}),
  };
}

const wastes = card({ name: 'Wastes', typeLine: 'Basic Land', releasedAt: '2016-01-22' });
const oldVehicle = card({
  name: 'Old Legendary Vehicle',
  typeLine: 'Legendary Artifact — Vehicle',
  releasedAt: '2018-04-27',
  power: '4',
  toughness: '5',
});
const explicitVehicle = card({
  name: 'Explicit Old Vehicle',
  typeLine: 'Legendary Artifact — Vehicle',
  releasedAt: '2022-02-18',
  oracleText: 'Explicit Old Vehicle can be your commander.',
  power: '8',
  toughness: '8',
});

function deckFor(name: string) {
  return parseDecklist([
    '// COMMANDER',
    `1 ${name}`,
    '',
    '// MAIN',
    '99 Wastes',
  ].join('\n'));
}

test('current rule accepts an older legendary Vehicle with printed stats, but pre-EOE historical rules do not', () => {
  const parsed = deckFor(oldVehicle.name);
  const cards = [oldVehicle, wastes];

  assert.equal(validateCommanderDeck(parsed, cards).isLegal, true);
  const before = validateCommanderDeckAsOfV15(parsed, cards, '2025-07-31T23:59:59.999Z');
  const fromEffectiveDate = validateCommanderDeckAsOfV15(parsed, cards, VEHICLE_SPACECRAFT_COMMANDER_RULE_EFFECTIVE_AT_V15);

  assert.equal(before.status, 'illegal');
  assert.equal(before.isLegal, false);
  assert.equal(before.commanderChecks[0]?.eligible, false);
  assert.match(String(before.commanderChecks[0]?.reason), /not effective before/i);
  assert.equal(fromEffectiveDate.status, 'legal');
  assert.equal(fromEffectiveDate.isLegal, true);
});

test('explicit can-be-your-commander permission remains valid before the 2025 broad Vehicle rule', () => {
  const result = validateCommanderDeckAsOfV15(
    deckFor(explicitVehicle.name),
    [explicitVehicle, wastes],
    '2024-06-01T00:00:00.000Z',
  );
  assert.equal(result.status, 'legal');
  assert.equal(result.isLegal, true);
});

test('historical feature extraction uses the dated Commander gate instead of current eligibility', () => {
  const decklist = [
    '// COMMANDER',
    `1 ${oldVehicle.name}`,
    '',
    '// MAIN',
    '99 Wastes',
  ].join('\n');
  const cards = [oldVehicle, wastes];

  assert.throws(
    () => extractProvenancedDeckFeatureSnapshotV15(decklist, cards, {
      availableAt: '2025-07-31T12:00:00.000Z',
      provenance: {
        method: 'contemporaneous-capture',
        sourceId: 'historical-rule-fixture',
        sourceUri: 'https://example.test/card-snapshot.json',
        sourceContentHash: 'a'.repeat(64),
        observedAt: '2025-07-31T10:00:00.000Z',
        retrievedAt: '2025-07-31T10:05:00.000Z',
      },
    }),
    /Historical Commander construction is illegal/i,
  );

  const after = extractProvenancedDeckFeatureSnapshotV15(decklist, cards, {
    availableAt: '2025-08-02T12:00:00.000Z',
    provenance: {
      method: 'contemporaneous-capture',
      sourceId: 'historical-rule-fixture',
      sourceUri: 'https://example.test/card-snapshot.json',
      sourceContentHash: 'b'.repeat(64),
      observedAt: '2025-08-02T10:00:00.000Z',
      retrievedAt: '2025-08-02T10:05:00.000Z',
    },
  });

  assert.equal(after.historicalCommanderValidation.isLegal, true);
  assert.match(after.historicalCommanderValidation.ruleset, /as of 2025-08-02T12:00:00.000Z/i);
});

test('invalid historical rules timestamps fail closed', () => {
  assert.throws(
    () => validateCommanderDeckAsOfV15(deckFor(oldVehicle.name), [oldVehicle, wastes], 'not-a-date'),
    /valid timestamp/i,
  );
});
