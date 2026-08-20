import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { evaluateComboZoneReadinessV07, inferComboZoneProfileV07 } from './combo-zones-v07.js';

let collector = 1;
function card(name: string, typeLine: string, oracleText = '', keywords: string[] = []): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    cmc: 2,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords,
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('detects graveyard permissions and blocks normal cards stranded there', () => {
  const escape = card('Escape Spell', 'Sorcery', 'Escape—{2}{B}, Exile three other cards from your graveyard.', ['Escape']);
  const normal = card('Normal Permanent', 'Artifact', '');
  assert.equal(inferComboZoneProfileV07(escape).normalUseZones.includes('graveyard'), true);
  const result = evaluateComboZoneReadinessV07([
    { card: escape, currentZone: 'graveyard' },
    { card: normal, currentZone: 'graveyard' },
  ]);
  assert.equal(result.ready, false);
  assert.equal(result.blockers.length, 1);
});

test('honors explicit combo zone requirements', () => {
  const permanent = card('Engine', 'Artifact', '');
  const spell = card('Spell', 'Instant', '');
  const good = evaluateComboZoneReadinessV07([
    { card: permanent, currentZone: 'battlefield', requiredZone: 'battlefield' },
    { card: spell, currentZone: 'hand', requiredZone: 'hand' },
  ]);
  assert.equal(good.ready, true);
  const bad = evaluateComboZoneReadinessV07([
    { card: permanent, currentZone: 'graveyard', requiredZone: 'battlefield' },
    { card: spell, currentZone: 'hand', requiredZone: 'hand' },
  ]);
  assert.equal(bad.ready, false);
});
