import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { effectiveCardRolesV15, manaRoleTruthV15 } from './card-role-truth-v15.js';

function card(name: string, cmc: number, typeLine: string, oracleText: string, manaCost = ''): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${name}-oracle`,
    lang: 'en',
    name,
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    released_at: '2026-01-01',
    type_line: typeLine,
    oracle_text: oracleText,
    mana_cost: manaCost,
    cmc,
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
  } as ScryfallCard;
}

test('Mox Jasper cannot count as reliable fast mana without its Dragon prerequisite', () => {
  const jasper = card('Mox Jasper', 0, 'Artifact', '{T}: Add one mana of any color. Activate only if you control a Dragon.', '{0}');
  const truth = manaRoleTruthV15(jasper);
  assert.equal(truth.externalBoardPrerequisite, true);
  assert.equal(truth.reliableImmediateFastMana, false);
  assert.equal(effectiveCardRolesV15(jasper).includes('fast mana'), false);
  assert.equal(effectiveCardRolesV15(jasper).includes('conditional mana acceleration'), true);
});

test('suspend mana and equipment-granted mana do not impersonate immediate fast mana', () => {
  const talisman = card('Sol Talisman', 0, 'Artifact', 'Suspend 3—{1}\n{T}: Add {C}{C}.');
  const mantle = card('Paradise Mantle', 0, 'Artifact — Equipment', 'Equipped creature has "{T}: Add one mana of any color."\nEquip {1}', '{0}');
  assert.equal(manaRoleTruthV15(talisman).reliableImmediateFastMana, false);
  assert.equal(manaRoleTruthV15(talisman).delayed, true);
  assert.equal(manaRoleTruthV15(mantle).reliableImmediateFastMana, false);
  assert.equal(manaRoleTruthV15(mantle).grantsManaAbilityToAnotherPermanent, true);
});

test('creature-tap setup mana is conditional while rituals and direct rocks remain reliable', () => {
  const drum = card('Springleaf Drum', 1, 'Artifact', '{T}, Tap an untapped creature you control: Add one mana of any color.', '{1}');
  const ritual = card('Culling the Weak', 1, 'Instant', 'As an additional cost to cast this spell, sacrifice a creature.\nAdd {B}{B}{B}{B}.', '{B}');
  const solRing = card('Sol Ring', 1, 'Artifact', '{T}: Add {C}{C}.', '{1}');
  const signet = card('Arcane Signet', 2, 'Artifact', '{T}: Add one mana of any color in your commander’s color identity.', '{2}');

  assert.equal(manaRoleTruthV15(drum).reliableImmediateFastMana, false);
  assert.equal(manaRoleTruthV15(ritual).reliableImmediateFastMana, true);
  assert.equal(manaRoleTruthV15(solRing).reliableImmediateFastMana, true);
  assert.equal(manaRoleTruthV15(signet).reliableImmediateFastMana, false);
  assert.equal(manaRoleTruthV15(signet).reliableLowCostManaAcceleration, true);
});
