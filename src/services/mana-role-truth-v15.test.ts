import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { effectiveCardRolesV15, manaRoleTruthV15, sacrificeRoleTruthV15 } from './card-role-truth-v15.js';

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

test('Treasure creation or triggered mana cannot impersonate immediate fast mana through reminder text', () => {
  const ghast = card(
    'Shambling Ghast',
    1,
    'Creature — Zombie',
    'When Shambling Ghast dies, choose one —\n• Brave the Stench — Target creature an opponent controls gets -1/-1 until end of turn.\n• Search the Body — Create a Treasure token. (It’s an artifact with “{T}, Sacrifice this artifact: Add one mana of any color.”)',
    '{B}',
  );
  const triggered = card('Triggered Mana', 1, 'Creature — God', 'Whenever you cast a spell, add {R}.', '{R}');

  const ghastTruth = manaRoleTruthV15(ghast);
  assert.equal(ghastTruth.createsManaToken, true);
  assert.equal(ghastTruth.reliableImmediateFastMana, false);
  assert.equal(effectiveCardRolesV15(ghast).includes('fast mana'), false);

  const triggeredTruth = manaRoleTruthV15(triggered);
  assert.equal(triggeredTruth.triggeredMana, true);
  assert.equal(triggeredTruth.reliableImmediateFastMana, false);
});

test('graveyard-scaled mana is conditional rather than reliable immediate fast mana', () => {
  const songs = card('Songs of the Damned', 1, 'Instant', 'Add {B} for each creature card in your graveyard.', '{B}');
  const truth = manaRoleTruthV15(songs);
  assert.equal(truth.variableStateMana, true);
  assert.equal(truth.reliableImmediateFastMana, false);
  assert.equal(effectiveCardRolesV15(songs).includes('fast mana'), false);
});

test('named-resource sacrifice costs do not impersonate broad creature sacrifice outlets', () => {
  const tail = card(
    'Unshakable Tail',
    3,
    'Creature — Zombie Detective',
    'When this creature enters and at the beginning of your upkeep, surveil 1. Whenever one or more creature cards are put into your graveyard from your library, investigate. {2}, Sacrifice a Clue: Return this card from your graveyard to your hand.',
    '{2}{B}',
  );
  const thallid = card(
    'Deathspore Thallid',
    2,
    'Creature — Zombie Fungus',
    'Remove three spore counters from this creature: Create a 1/1 green Saproling creature token. Sacrifice a Saproling: Target creature gets -1/-1 until end of turn.',
    '{1}{B}',
  );
  const seer = card('Viscera Seer', 1, 'Creature — Vampire Wizard', 'Sacrifice a creature: Scry 1.', '{B}');

  assert.equal(sacrificeRoleTruthV15(tail).narrowOutlet, true);
  assert.equal(effectiveCardRolesV15(tail).includes('sacrifice outlet'), false);
  assert.equal(effectiveCardRolesV15(tail).includes('narrow sacrifice outlet'), true);
  assert.equal(sacrificeRoleTruthV15(thallid).narrowOutlet, true);
  assert.equal(effectiveCardRolesV15(thallid).includes('creature sacrifice outlet'), false);

  assert.equal(sacrificeRoleTruthV15(seer).creatureOutlet, true);
  assert.equal(effectiveCardRolesV15(seer).includes('sacrifice outlet'), true);
  assert.equal(effectiveCardRolesV15(seer).includes('creature sacrifice outlet'), true);
});
