import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildDeckMetrics, parseDecklist } from './deck.js';
import { inferCardRoles } from './scryfall.js';

function card(input: {
  name: string;
  typeLine: string;
  oracleText: string;
  cmc?: number;
  manaCost?: string;
  producedMana?: string[];
}): ScryfallCard {
  return {
    id: input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${input.name}-oracle`,
    lang: 'en',
    name: input.name,
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    released_at: '2026-01-01',
    type_line: input.typeLine,
    oracle_text: input.oracleText,
    mana_cost: input.manaCost ?? '',
    cmc: input.cmc ?? 0,
    colors: [],
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'common',
    prices: { usd: null, usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: 'https://scryfall.com',
    ...(input.producedMana ? { produced_mana: input.producedMana } : {}),
  } as ScryfallCard;
}

const forest = card({
  name: 'Forest',
  typeLine: 'Basic Land — Forest',
  oracleText: '({T}: Add {G}.)',
  producedMana: ['G'],
});

const ancientTomb = card({
  name: 'Ancient Tomb',
  typeLine: 'Land',
  oracleText: '{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.',
  producedMana: ['C'],
});

const farseek = card({
  name: 'Farseek',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.',
  cmc: 2,
  manaCost: '{1}{G}',
});

const cultivate = card({
  name: 'Cultivate',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.',
  cmc: 3,
  manaCost: '{2}{G}',
});

const cropRotation = card({
  name: 'Crop Rotation',
  typeLine: 'Instant',
  oracleText: 'As an additional cost to cast this spell, sacrifice a land. Search your library for a land card, put that card onto the battlefield, then shuffle.',
  cmc: 1,
  manaCost: '{G}',
});

const demonicTutor = card({
  name: 'Demonic Tutor',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  cmc: 2,
  manaCost: '{1}{B}',
});

test('ordinary lands are mana sources, not mana acceleration, while true multi-mana lands remain acceleration', () => {
  assert.equal(inferCardRoles(forest).includes('mana acceleration'), false);
  assert.equal(inferCardRoles(forest).includes('land'), true);
  assert.equal(inferCardRoles(ancientTomb).includes('mana acceleration'), true);
});

test('basic-land ramp is not promoted to strategic tutor while unrestricted land and card tutors remain tutors', () => {
  const farseekRoles = inferCardRoles(farseek);
  assert.equal(farseekRoles.includes('land ramp'), true);
  assert.equal(farseekRoles.includes('land tutor'), true);
  assert.equal(farseekRoles.includes('tutor'), false);

  const cultivateRoles = inferCardRoles(cultivate);
  assert.equal(cultivateRoles.includes('land ramp'), true);
  assert.equal(cultivateRoles.includes('land tutor'), true);
  assert.equal(cultivateRoles.includes('tutor'), false);

  const cropRoles = inferCardRoles(cropRotation);
  assert.equal(cropRoles.includes('land tutor'), true);
  assert.equal(cropRoles.includes('tutor'), true);

  assert.equal(inferCardRoles(demonicTutor).includes('tutor'), true);
});

test('deck metrics no longer let basic lands or Farseek-style ramp satisfy ramp and tutor targets simultaneously', () => {
  const parsed = parseDecklist('31 Forest\n1 Farseek\n1 Demonic Tutor');
  const metrics = buildDeckMetrics(parsed, [forest, farseek, demonicTutor]);
  assert.equal(metrics.landCount, 31);
  assert.equal(metrics.rampCount, 1);
  assert.equal(metrics.tutorCount, 1);
  assert.equal(metrics.roleCounts['mana acceleration'] ?? 0, 0);
  assert.equal(metrics.roleCounts['land ramp'] ?? 0, 1);
});
