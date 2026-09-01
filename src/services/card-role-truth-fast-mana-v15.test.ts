import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { effectiveCardRolesV15, manaRoleTruthV15 } from './card-role-truth-v15.js';

function card(input: {
  name: string;
  typeLine: string;
  oracleText: string;
  cmc: number;
  manaCost: string;
  keywords?: string[];
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
    color_identity: [],
    keywords: input.keywords ?? [],
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
  } as ScryfallCard;
}

const masterOfDarkRites = card({
  name: 'Master of Dark Rites',
  typeLine: 'Creature — Vampire Cleric',
  oracleText: '{T}, Sacrifice another creature: Add {B}{B}{B}. Spend this mana only to cast Vampire, Cleric, and/or Demon spells.',
  cmc: 1,
  manaCost: '{B}',
});

const llanowarElves = card({
  name: 'Llanowar Elves',
  typeLine: 'Creature — Elf Druid',
  oracleText: '{T}: Add {G}.',
  cmc: 1,
  manaCost: '{G}',
});

const solRing = card({
  name: 'Sol Ring',
  typeLine: 'Artifact',
  oracleText: '{T}: Add {C}{C}.',
  cmc: 1,
  manaCost: '{1}',
});

const cullingTheWeak = card({
  name: 'Culling the Weak',
  typeLine: 'Instant',
  oracleText: 'As an additional cost to cast this spell, sacrifice a creature. Add {B}{B}{B}{B}.',
  cmc: 1,
  manaCost: '{B}',
});

test('restricted tap-creature mana cannot impersonate reliable immediate fast mana', () => {
  const truth = manaRoleTruthV15(masterOfDarkRites);
  assert.equal(truth.externalBoardPrerequisite, true);
  assert.equal(truth.tapActivationBeforeMana, true);
  assert.equal(truth.summoningSicknessDelay, true);
  assert.equal(truth.spendingRestriction, true);
  assert.equal(truth.reliableImmediateFastMana, false);
  assert.equal(truth.reliableLowCostManaAcceleration, false);
  assert.equal(effectiveCardRolesV15(masterOfDarkRites).includes('fast mana'), false);
});

test('ordinary one-mana dorks remain low-cost acceleration but not immediate fast mana', () => {
  const truth = manaRoleTruthV15(llanowarElves);
  assert.equal(truth.summoningSicknessDelay, true);
  assert.equal(truth.spendingRestriction, false);
  assert.equal(truth.reliableLowCostManaAcceleration, true);
  assert.equal(truth.reliableImmediateFastMana, false);
});

test('Sol Ring still counts as reliable immediate fast mana', () => {
  const truth = manaRoleTruthV15(solRing);
  assert.equal(truth.summoningSicknessDelay, false);
  assert.equal(truth.spendingRestriction, false);
  assert.equal(truth.reliableLowCostManaAcceleration, true);
  assert.equal(truth.reliableImmediateFastMana, true);
});

test('spell-based sacrifice rituals remain immediate acceleration', () => {
  const truth = manaRoleTruthV15(cullingTheWeak);
  assert.equal(truth.summoningSicknessDelay, false);
  assert.equal(truth.spendingRestriction, false);
  assert.equal(truth.reliableImmediateFastMana, true);
});
