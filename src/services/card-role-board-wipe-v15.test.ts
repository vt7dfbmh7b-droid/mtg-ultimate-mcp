import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { inferCardRoles } from './scryfall.js';

function card(name: string, oracleText: string, typeLine = 'Sorcery'): ScryfallCard {
  return {
    id: name,
    name,
    lang: 'en',
    cmc: 2,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'common',
    prices: { usd: '0.10' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('a symmetric one-creature edict is interaction, not a board wipe', () => {
  const marauderLike = card(
    'Symmetric Marauder',
    'When this creature enters, each player sacrifices a nontoken creature.',
    'Creature — Human Mercenary',
  );
  const roles = new Set(inferCardRoles(marauderLike));
  assert.equal(roles.has('board wipe'), false);
});

test('true mass sacrifice effects still count as board wipes', () => {
  const allCreatures = card('Mass Edict', 'Each player sacrifices all creatures they control.');
  const twoCreatures = card('Double Edict', 'Each player sacrifices two creatures.');
  assert.equal(new Set(inferCardRoles(allCreatures)).has('board wipe'), true);
  assert.equal(new Set(inferCardRoles(twoCreatures)).has('board wipe'), true);
});

test('Deluge-like global shrink remains a board wipe', () => {
  const delugeLike = card('Global Shrink', 'All creatures get -X/-X until end of turn.');
  assert.equal(new Set(inferCardRoles(delugeLike)).has('board wipe'), true);
});
