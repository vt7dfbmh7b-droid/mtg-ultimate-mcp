import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { effectiveCardRolesV15, interactionRoleTruthV15, manaRoleTruthV15 } from './card-role-truth-v15.js';
import { buildDeckMetrics, parseDecklist } from './deck.js';
import { restrictedUpgradeCandidatesForRoleV15 } from './upgrade.js';

function card(input: {
  name: string;
  cmc: number;
  typeLine: string;
  oracleText: string;
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
    ...(input.producedMana ? { produced_mana: input.producedMana } : {}),
  } as ScryfallCard;
}

const paidFilterWithLateRemoval = card({
  name: 'Generic Paid Filter',
  cmc: 1,
  typeLine: 'Artifact',
  manaCost: '{1}',
  oracleText: '{1}, {T}: Add one mana of any color.\n{7}, {T}, Sacrifice this artifact: Destroy target permanent.',
  producedMana: ['W', 'U', 'B', 'R', 'G'],
});

const netPositivePaidRock = card({
  name: 'Generic Net-Positive Rock',
  cmc: 2,
  typeLine: 'Artifact',
  manaCost: '{2}',
  oracleText: '{1}, {T}: Add {W}{U}.',
  producedMana: ['W', 'U'],
});

const graveyardOnlyZero = card({
  name: 'Generic Graveyard Capsule',
  cmc: 0,
  typeLine: 'Artifact',
  manaCost: '{0}',
  oracleText: '{T}, Sacrifice this artifact: Exile target player\'s graveyard.',
});

const efficientRemoval = card({
  name: 'Generic Efficient Removal',
  cmc: 1,
  typeLine: 'Instant',
  manaCost: '{B}',
  oracleText: 'Destroy target creature.',
});

const repeatableDeathPayoff = card({
  name: 'Generic Repeatable Death Payoff',
  cmc: 4,
  typeLine: 'Creature — Archer',
  manaCost: '{2}{B}{G}',
  oracleText: 'Whenever another creature dies, each opponent loses 1 life.',
});

const oneShotDeathRider = card({
  name: 'Generic One-Shot Death Rider',
  cmc: 1,
  typeLine: 'Instant',
  manaCost: '{B}',
  oracleText: 'When this Aura is put into a graveyard from the battlefield, each opponent loses 1 life.',
});

test('paid one-for-one color filtering cannot impersonate acceleration, fast mana, or a colored mana source', () => {
  const truth = manaRoleTruthV15(paidFilterWithLateRemoval);
  const roles = new Set(effectiveCardRolesV15(paidFilterWithLateRemoval));
  assert.equal(truth.manaFilteringOnly, true);
  assert.equal(truth.positiveActivationManaProfit, false);
  assert.equal(roles.has('mana acceleration'), false);
  assert.equal(roles.has('fast mana'), false);
  assert.equal(roles.has('mana rock'), false);
  assert.equal(roles.has('persistent colored mana source'), false);
  assert.equal(roles.has('mana filtering'), true);
});

test('a paid activation that produces net mana remains acceleration', () => {
  const truth = manaRoleTruthV15(netPositivePaidRock);
  const roles = new Set(effectiveCardRolesV15(netPositivePaidRock));
  assert.equal(truth.positiveActivationManaProfit, true);
  assert.equal(truth.manaFilteringOnly, false);
  assert.equal(roles.has('mana acceleration'), true);
  assert.equal(roles.has('mana rock'), true);
  assert.equal(roles.has('persistent colored mana source'), true);
  assert.equal(roles.has('fast mana'), false);
});

test('a low-mana permanent with seven-mana removal does not satisfy the cheap-interaction gate', () => {
  const truth = interactionRoleTruthV15(paidFilterWithLateRemoval);
  assert.equal(truth.genericDirectInteraction, true);
  assert.equal(truth.activatedOnlyInteraction, true);
  assert.equal(truth.minimumActivationManaCost, 7);
  assert.equal(truth.cheapInteraction, false);

  const metrics = buildDeckMetrics(parseDecklist('1 Generic Paid Filter'), [paidFilterWithLateRemoval]);
  assert.equal(metrics.rampCount, 0);
  assert.equal(metrics.fastManaCount, 0);
  assert.equal(metrics.interactionCount, 1);
  assert.equal(metrics.cheapInteractionCount, 0);
  assert.equal(restrictedUpgradeCandidatesForRoleV15(
    [paidFilterWithLateRemoval],
    'interaction',
    new Set(),
    new Set(),
    'cheap-interaction',
  ).length, 0);
});

test('graveyard-only zero-mana utility is hate, not free or cheap generic interaction', () => {
  const truth = interactionRoleTruthV15(graveyardOnlyZero);
  const roles = new Set(effectiveCardRolesV15(graveyardOnlyZero));
  assert.equal(truth.graveyardOnlyInteraction, true);
  assert.equal(truth.reliableFreeInteraction, false);
  assert.equal(truth.cheapInteraction, false);
  assert.equal(roles.has('graveyard hate'), true);
  assert.equal(roles.has('graveyard interaction'), true);
  assert.equal(roles.has('spot interaction'), false);
  assert.equal(roles.has('free interaction'), false);

  const metrics = buildDeckMetrics(parseDecklist('1 Generic Graveyard Capsule'), [graveyardOnlyZero]);
  assert.equal(metrics.interactionCount, 0);
  assert.equal(metrics.cheapInteractionCount, 0);
});

test('ordinary efficient removal still satisfies generic and cheap interaction truth', () => {
  const truth = interactionRoleTruthV15(efficientRemoval);
  assert.equal(truth.genericDirectInteraction, true);
  assert.equal(truth.activatedOnlyInteraction, false);
  assert.equal(truth.cheapInteraction, true);
  const metrics = buildDeckMetrics(parseDecklist('1 Generic Efficient Removal'), [efficientRemoval]);
  assert.equal(metrics.interactionCount, 1);
  assert.equal(metrics.cheapInteractionCount, 1);
});

test('repeatable death payoffs stay distinct from one-shot life-loss riders', () => {
  const repeatableRoles = new Set(effectiveCardRolesV15(repeatableDeathPayoff));
  const oneShotRoles = new Set(effectiveCardRolesV15(oneShotDeathRider));
  assert.equal(repeatableRoles.has('life drain'), true);
  assert.equal(repeatableRoles.has('repeatable life drain'), true);
  assert.equal(oneShotRoles.has('life drain'), true);
  assert.equal(oneShotRoles.has('repeatable life drain'), false);
});
