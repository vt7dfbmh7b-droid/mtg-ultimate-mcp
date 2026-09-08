import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { commanderRelationshipAffinityV15 } from './commander-relationship-affinity-v15.js';

function card(name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/\s+/g, '-'),
    oracle_id: `oracle-${name.toLocaleLowerCase().replace(/\s+/g, '-')}`,
    name,
    lang: 'en',
    cmc: 2,
    type_line: 'Creature — Human',
    oracle_text: '',
    color_identity: ['G'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'common',
    prices: {},
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
    ...overrides,
  };
}

test('generic choose-a-type engines receive typal payoff affinity for an explicit requested creature type', () => {
  const engine = card('Typal Echo', {
    type_line: 'Enchantment',
    oracle_text: 'As this enchantment enters, choose a creature type. Whenever you cast a spell of the chosen type, copy that spell.',
  });
  const unrelated = card('Generic Value', { oracle_text: 'Draw a card.' });
  const components = [{ id: 'elf-typal', queryClause: 't:"Elf"' }];

  const engineAffinity = commanderRelationshipAffinityV15(engine, [], components);
  assert.equal(engineAffinity.score, 5);
  assert.match(engineAffinity.reasons.join(' '), /typal engine/i);
  assert.equal(commanderRelationshipAffinityV15(unrelated, [], components).score, 0);
});

test('Aura specialization is distinguished from broad enchantment membership when commander rules reward enchanted creatures', () => {
  const commander = card('Aura Commander', {
    oracle_text: 'Whenever an enchanted creature you control attacks, draw a card.',
  });
  const aura = card('Combat Aura', { type_line: 'Enchantment — Aura', oracle_text: 'Enchant creature. Enchanted creature gets +2/+2.' });
  const broadEnchantment = card('Broad Anthem', { type_line: 'Enchantment', oracle_text: 'Creatures you control get +1/+1.' });

  assert.equal(commanderRelationshipAffinityV15(aura, [commander], []).score, 5);
  assert.equal(commanderRelationshipAffinityV15(broadEnchantment, [commander], []).score, 0);
});

test('commander-referenced permanent type and mana-value shape is recognized without card or commander names', () => {
  const commander = card('Shape Commander', {
    oracle_text: 'During your turn, each non-Equipment artifact and non-Aura enchantment you control with mana value 4 or greater is a 4/4 Elemental creature in addition to its other types.',
  });
  const vehicle = card('Large Vehicle', { cmc: 4, type_line: 'Artifact — Vehicle' });
  const cheapArtifact = card('Cheap Rock', { cmc: 2, type_line: 'Artifact' });
  const equipment = card('Large Equipment', { cmc: 4, type_line: 'Artifact — Equipment' });
  const aura = card('Large Aura', { cmc: 4, type_line: 'Enchantment — Aura' });
  const enchantment = card('Large Enchantment', { cmc: 5, type_line: 'Enchantment' });

  assert.equal(commanderRelationshipAffinityV15(vehicle, [commander], []).score, 6);
  assert.equal(commanderRelationshipAffinityV15(enchantment, [commander], []).score, 6);
  assert.equal(commanderRelationshipAffinityV15(cheapArtifact, [commander], []).score, 0);
  assert.equal(commanderRelationshipAffinityV15(equipment, [commander], []).score, 0);
  assert.equal(commanderRelationshipAffinityV15(aura, [commander], []).score, 0);
});

test('noncreature shape constraints exclude creature permanents even when type and mana value match', () => {
  const commander = card('Noncreature Commander', {
    oracle_text: 'Each noncreature artifact you control with mana value 4 or greater has menace and trample.',
  });
  const noncreature = card('Large Relic', { cmc: 4, type_line: 'Artifact' });
  const creature = card('Large Construct', { cmc: 4, type_line: 'Artifact Creature — Construct' });

  assert.equal(commanderRelationshipAffinityV15(noncreature, [commander], []).score, 6);
  assert.equal(commanderRelationshipAffinityV15(creature, [commander], []).score, 0);
});
