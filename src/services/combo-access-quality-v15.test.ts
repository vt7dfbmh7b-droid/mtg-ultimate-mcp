import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { comboAccessQualityV15, preservesComboAccessQualityV15 } from './combo-access-quality-v15.js';

function card(name: string, typeLine: string, oracleText: string, cmc = 2): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    lang: 'en',
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: 'https://scryfall.com/',
  };
}

const ballista = card('Walking Ballista', 'Artifact Creature — Construct', '', 0);
const scales = card('Hardened Scales', 'Enchantment', '', 1);
const gatta = card('Gatta and Luzzu', 'Legendary Creature — Human Rebel', '', 2);
const earth = card('The Earth Crystal', 'Legendary Artifact', '', 2);
const pieces = [ballista, scales, gatta, earth];

const ranger = card('Ranger-Captain of Eos', 'Creature — Human Soldier', 'When Ranger-Captain of Eos enters, you may search your library for a creature card with mana value 1 or less, reveal it, put it into your hand, then shuffle.', 3);
const narrowVehicleTutor = card('Narrow Vehicle Tutor', 'Sorcery', 'Search your library for a Vehicle card, reveal it, put it into your hand, then shuffle.', 2);
const dig = card('Deep Selection', 'Instant', 'Look at the top seven cards of your library. Put two of them into your hand and the rest on the bottom of your library in any order.', 8);

test('generic tutor count does not inflate effective combo access when restrictions miss every piece', () => {
  const quality = comboAccessQualityV15([ranger, narrowVehicleTutor], pieces);
  assert.deepEqual(quality.deterministicSources.map((source) => source.cardName), ['Ranger-Captain of Eos']);
  assert.equal(quality.deterministicPieceLinks, 1);
  assert.deepEqual(quality.accessiblePieces, ['Walking Ballista']);
});

test('broad bounded selection can replace an irrelevant tutor while preserving deterministic access', () => {
  const result = preservesComboAccessQualityV15([ranger, narrowVehicleTutor], [ranger, dig], pieces);
  assert.equal(result.preserved, true);
  assert.equal(result.after.deterministicSources.length, result.before.deterministicSources.length);
  assert.ok(result.after.accessiblePieces.length > result.before.accessiblePieces.length);
  assert.ok(result.after.weightedScore > result.before.weightedScore);
});

test('bounded selection does not excuse removing the only deterministic combo tutor', () => {
  const result = preservesComboAccessQualityV15([ranger, narrowVehicleTutor], [narrowVehicleTutor, dig], pieces);
  assert.equal(result.preserved, false);
  assert.ok(result.failures.includes('deterministic-source-count'));
  assert.ok(result.failures.includes('deterministic-piece-links'));
});
