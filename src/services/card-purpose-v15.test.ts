import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { auditCardPurposeV15 } from './card-purpose-v15.js';

function card(input: Partial<ScryfallCard> & Pick<ScryfallCard, 'name' | 'type_line'>): ScryfallCard {
  return {
    id: input.id ?? input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: input.name,
    lang: 'en',
    cmc: input.cmc ?? 2,
    type_line: input.type_line,
    oracle_text: input.oracle_text ?? '',
    color_identity: input.color_identity ?? [],
    keywords: input.keywords ?? [],
    legalities: input.legalities ?? { commander: 'legal' },
    set: input.set ?? 'tst',
    set_name: input.set_name ?? 'Test',
    collector_number: input.collector_number ?? '1',
    rarity: input.rarity ?? 'rare',
    scryfall_uri: input.scryfall_uri ?? 'https://scryfall.com/',
    ...(input.mana_cost !== undefined ? { mana_cost: input.mana_cost } : {}),
    ...(input.produced_mana !== undefined ? { produced_mana: input.produced_mana } : {}),
    ...(input.card_faces !== undefined ? { card_faces: input.card_faces } : {}),
  };
}

const ballista = card({
  name: 'Walking Ballista',
  type_line: 'Artifact Creature — Construct',
  cmc: 0,
  mana_cost: '{X}{X}',
  oracle_text: 'Walking Ballista enters with X +1/+1 counters on it. Remove a +1/+1 counter from Walking Ballista: It deals 1 damage to any target.',
});

const scales = card({
  name: 'Hardened Scales',
  type_line: 'Enchantment',
  cmc: 1,
  mana_cost: '{G}',
  oracle_text: 'If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.',
});

const copter = card({
  name: "Smuggler's Copter",
  type_line: 'Artifact — Vehicle',
  oracle_text: 'Flying. Whenever Smuggler’s Copter attacks or blocks, you may draw a card. If you do, discard a card. Crew 1.',
});

test('narrow Vehicle tutor is challenged when its only target does not access the win package', () => {
  const tutor = card({
    name: 'From Father to Son',
    type_line: 'Sorcery',
    cmc: 2,
    oracle_text: 'Search your library for a Vehicle card, reveal it, put it into your hand, then shuffle. Flashback {5}{W}.',
  });
  const deck = [tutor, copter, ballista, scales];
  const result = auditCardPurposeV15(tutor, { deck, comboPieces: [ballista, scales] });
  assert.equal(result.status, 'challenge');
  assert.deepEqual(result.deterministicComboHits, []);
  assert.ok(result.warnings.some((warning) => warning.includes('only 1 other target')));
  assert.ok(result.warnings.some((warning) => warning.includes('does not deterministically access')));
});

test('Ranger-Captain earns purpose when its real restriction finds Walking Ballista', () => {
  const ranger = card({
    name: 'Ranger-Captain of Eos',
    type_line: 'Creature — Human Soldier',
    cmc: 3,
    oracle_text: 'When Ranger-Captain of Eos enters, you may search your library for a creature card with mana value 1 or less, reveal it, put it into your hand, then shuffle. Sacrifice Ranger-Captain of Eos: Your opponents can’t cast noncreature spells this turn.',
  });
  const deck = [ranger, ballista, scales];
  const result = auditCardPurposeV15(ranger, { deck, comboPieces: [ballista, scales] });
  assert.equal(result.status, 'supported');
  assert.deepEqual(result.deterministicComboHits, ['Walking Ballista']);
  assert.ok(result.purposes.includes('deterministic win-piece access'));
});

test('generic but high-impact free interaction remains meaningful without commander-text synergy', () => {
  const endurance = card({
    name: 'Endurance',
    type_line: 'Creature — Elemental Incarnation',
    cmc: 3,
    mana_cost: '{1}{G}{G}',
    keywords: ['Flash', 'Reach'],
    oracle_text: 'Flash. Reach. When Endurance enters, up to one target player puts all the cards from their graveyard on the bottom of their library in a random order. Evoke—Exile a green card from your hand.',
  });
  const result = auditCardPurposeV15(endurance, { deck: [endurance, ballista, scales], comboPieces: [ballista, scales] });
  assert.equal(result.status, 'supported');
  assert.ok(result.purposes.includes('interaction'));
});

test('Saga-dependent counter card is put under review when the exact deck barely supports the Saga clause', () => {
  const garnet = card({
    name: 'Garnet, Princess of Alexandria',
    type_line: 'Legendary Creature — Human Noble',
    cmc: 2,
    oracle_text: 'Lifelink. Whenever Garnet attacks, remove a lore counter from each Saga you control. Put a +1/+1 counter on Garnet for each lore counter removed this way.',
  });
  const saga = card({
    name: 'Esper Origins // Summon: Esper Maduin',
    type_line: 'Instant // Enchantment Creature — Saga Avatar',
    oracle_text: 'Surveil 2, then draw a card. // I, II, III — Put a +1/+1 counter on target creature you control.',
  });
  const result = auditCardPurposeV15(garnet, { deck: [garnet, saga, ballista, scales], comboPieces: [ballista, scales] });
  assert.equal(result.status, 'review');
  assert.ok(result.warnings.some((warning) => warning.includes('only 1 other Saga')));
});

test('a card with no inferred function is challenged rather than silently treated as filler', () => {
  const passenger = card({
    name: 'Vanilla Passenger',
    type_line: 'Creature — Human',
    oracle_text: '',
  });
  const result = auditCardPurposeV15(passenger, { deck: [passenger, ballista, scales], comboPieces: [ballista, scales] });
  assert.equal(result.status, 'challenge');
  assert.ok(result.warnings.includes('no evidence-backed deck function was identified'));
});
