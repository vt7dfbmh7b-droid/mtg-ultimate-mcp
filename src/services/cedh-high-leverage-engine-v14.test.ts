import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { cutPressureV14, isHighLeverageTutorEngineV14, strictCedhQualityV14 } from './cedh-efficiency-v14.js';

function card(input: {
  name: string;
  typeLine: string;
  oracleText: string;
  cmc: number;
  manaCost: string;
  edhrecRank?: number;
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
    mana_cost: input.manaCost,
    cmc: input.cmc,
    colors: ['B'],
    color_identity: ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'rare',
    prices: { usd: '1.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: 'https://scryfall.com',
    ...(input.edhrecRank !== undefined ? { edhrec_rank: input.edhrecRank } : {}),
  } as ScryfallCard;
}

const buriedLike = card({
  name: 'Generic Graveyard Setup Tutor',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for up to three creature cards, put them into your graveyard, then shuffle.',
  cmc: 3,
  manaCost: '{2}{B}',
  edhrecRank: 500,
});

const preparedTutor = card({
  name: 'Generic Prepared Tutor Engine',
  typeLine: 'Creature — Vampire Warlock',
  oracleText: 'This creature enters prepared. At the beginning of your end step, if two or more creatures died this turn, this creature becomes prepared. Search your library for a card, put that card into your hand, then shuffle.',
  cmc: 4,
  manaCost: '{3}{B}',
  edhrecRank: 1000,
});

const slowGenericTutor = card({
  name: 'Generic Four Mana Tutor',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  cmc: 4,
  manaCost: '{2}{B}{B}',
  edhrecRank: 1000,
});

const narrowOutlet = card({
  name: 'Generic Narrow Zombie Outlet',
  typeLine: 'Creature — Zombie Fungus',
  oracleText: 'Sacrifice a Saproling: Target creature gets -1/-1 until end of turn.',
  cmc: 2,
  manaCost: '{1}{B}',
  edhrecRank: 1000,
});

test('graveyard setup and reusable prepared tutors are high leverage', () => {
  assert.equal(isHighLeverageTutorEngineV14(buriedLike), true);
  assert.equal(isHighLeverageTutorEngineV14(preparedTutor), true);
  assert.equal(isHighLeverageTutorEngineV14(slowGenericTutor), false);
});

test('high-leverage tutor engines receive lower cut pressure than a generic slow tutor', () => {
  const roles = { tutor: 6, 'graveyard recursion': 18, protection: 5 };
  const protectedNames = new Set<string>();
  const genericPressure = cutPressureV14(slowGenericTutor, protectedNames, roles, null);
  assert.ok(cutPressureV14(buriedLike, protectedNames, roles, null) < genericPressure);
  assert.ok(cutPressureV14(preparedTutor, protectedNames, roles, null) < genericPressure);
});

test('narrow typal sacrifice costs are penalized as engine candidates', () => {
  const quality = strictCedhQualityV14(narrowOutlet, {
    creatureType: 'Zombie',
    score: 20,
    existingCreatureCount: 8,
    commanderPrintedType: false,
    commanderCreatesType: true,
    supportReferenceCount: 2,
    evidence: [],
  });
  assert.ok(quality.reasons.some((reason) => reason.includes('narrow sacrifice cost')));
  assert.equal(quality.reasons.includes('cheap sacrifice-engine support'), false);
});
