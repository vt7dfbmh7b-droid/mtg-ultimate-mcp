import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { effectiveCardRolesV15, manaRoleTruthV15 } from './card-role-truth-v15.js';

function card(input: { name: string; typeLine: string; oracleText: string; cmc: number; manaCost: string }): ScryfallCard {
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
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'uncommon',
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

test('token-granted mana is indirect rather than reliable card-native acceleration', () => {
  const warpingLike = card({
    name: 'Generic Scion Modal Spell',
    typeLine: 'Instant',
    oracleText: 'Choose one — Exile target creature with power or toughness 1 or less; counter target sorcery spell; or create a 1/1 colorless Eldrazi Scion creature token. It has "Sacrifice this token: Add {C}."',
    cmc: 2,
    manaCost: '{1}{C}',
  });
  const truth = manaRoleTruthV15(warpingLike);
  const roles = new Set(effectiveCardRolesV15(warpingLike));
  assert.equal(truth.createsManaToken, true);
  assert.equal(truth.reliableLowCostManaAcceleration, false);
  assert.equal(truth.reliableImmediateFastMana, false);
  assert.equal(roles.has('mana acceleration'), false);
  assert.equal(roles.has('conditional mana acceleration'), true);
});
