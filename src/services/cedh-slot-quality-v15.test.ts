import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { cutPressureV14, strictCedhQualityV14 } from './cedh-efficiency-v14.js';
import type { CreatureTypePreferenceV15 } from './creature-type-coherence-v15.js';

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
    colors: [],
    color_identity: ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'common',
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

const zombiePreference: CreatureTypePreferenceV15 = {
  creatureType: 'Zombie',
  score: 20,
  existingCreatureCount: 4,
  commanderPrintedType: false,
  commanderCreatesType: true,
  supportReferenceCount: 2,
  evidence: ['commander creates Zombie creature tokens'],
};

const carrionFeeder = card({
  name: 'Carrion Feeder',
  typeLine: 'Creature — Zombie',
  oracleText: "Carrion Feeder can't block. Sacrifice a creature: Put a +1/+1 counter on Carrion Feeder.",
  cmc: 1,
  manaCost: '{B}',
  edhrecRank: 500,
});

const diabolicTutor = card({
  name: 'Diabolic Tutor',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  cmc: 4,
  manaCost: '{2}{B}{B}',
  edhrecRank: 1200,
});

const cheapTutor = card({
  name: 'Cheap Tutor',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  cmc: 2,
  manaCost: '{1}{B}',
  edhrecRank: 100,
});

const commandersSphere = card({
  name: "Commander's Sphere",
  typeLine: 'Artifact',
  oracleText: '{T}: Add one mana of any color in your commander’s color identity. Sacrifice Commander’s Sphere: Draw a card.',
  cmc: 3,
  manaCost: '{3}',
  edhrecRank: 300,
});

const myrRetriever = card({
  name: 'Myr Retriever',
  typeLine: 'Artifact Creature — Myr',
  oracleText: 'When Myr Retriever dies, return another target artifact card from your graveyard to your hand.',
  cmc: 2,
  manaCost: '{2}',
  edhrecRank: 1700,
});

const roleCounts = {
  'graveyard recursion': 21,
  protection: 6,
  tutor: 6,
  'mana rock': 6,
};

const protectedNames = new Set<string>();

test('cheap Zombie sacrifice outlets receive explicit high-power candidate credit', () => {
  const quality = strictCedhQualityV14(carrionFeeder, zombiePreference);
  assert.equal(quality.eligible, true);
  assert.ok(quality.reasons.includes('cheap repeatable creature sacrifice outlet'));
  assert.ok(quality.score > 120);
});

test('slow broad tutors receive materially more cut pressure than cheap tutors', () => {
  const slow = cutPressureV14(diabolicTutor, protectedNames, roleCounts, zombiePreference);
  const cheap = cutPressureV14(cheapTutor, protectedNames, roleCounts, zombiePreference);
  assert.ok(slow > cheap + 40, `expected slow tutor pressure ${slow} to materially exceed cheap tutor ${cheap}`);
});

test('three-mana rocks receive positive cut pressure in strict high-power refinement', () => {
  const pressure = cutPressureV14(commandersSphere, protectedNames, roleCounts, zombiePreference);
  assert.ok(pressure > 20, `expected Commander's Sphere pressure > 20, got ${pressure}`);
});

test('off-type recursion creatures are pressured when recursion is saturated and a strong type engine exists', () => {
  const pressure = cutPressureV14(myrRetriever, protectedNames, roleCounts, zombiePreference);
  assert.ok(pressure > 25, `expected Myr Retriever pressure > 25, got ${pressure}`);
});
