import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { requestedComponentRelationshipAffinityV15 } from './requested-component-relationship-v15.js';

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

test('typal payoff/engine relevance outranks bare requested creature-type membership', () => {
  const commander = card('Typal Commander', { oracle_text: 'Whenever one or more Merfolk you control attack, draw a card.' });
  const member = card('Plain Member', { type_line: 'Creature — Merfolk Scout' });
  const payoff = card('Typal Payoff', {
    type_line: 'Creature — Merfolk Advisor',
    oracle_text: 'Other Merfolk you control get +1/+1. Whenever a Merfolk you control deals combat damage to a player, put a +1/+1 counter on it.',
  });
  const components = [{ id: 'typal', queryClause: 't:"Merfolk"' }];
  const memberSignal = requestedComponentRelationshipAffinityV15(member, [commander], components);
  const payoffSignal = requestedComponentRelationshipAffinityV15(payoff, [commander], components);
  assert.ok(payoffSignal.score > memberSignal.score);
  assert.ok(payoffSignal.reasons.some((reason) => reason.includes('payoff/engine')));
});

test('Aura specialization is stronger than broad enchantment membership when the request or commander cares about Auras', () => {
  const commander = card('Aura Commander', { oracle_text: 'Whenever a creature you control becomes enchanted, draw a card.' });
  const aura = card('Specialized Aura', { type_line: 'Enchantment — Aura', oracle_text: 'Enchant creature\nEnchanted creature gets +2/+2.' });
  const anthem = card('Broad Enchantment', { type_line: 'Enchantment', oracle_text: 'Creatures you control get +1/+1.' });
  const components = [
    { id: 'enchantments', queryClause: 't:enchantment' },
    { id: 'auras', queryClause: 't:aura' },
  ];
  assert.ok(
    requestedComponentRelationshipAffinityV15(aura, [commander], components).score
      > requestedComponentRelationshipAffinityV15(anthem, [commander], components).score,
  );
});

test('commander-declared permanent shape recognizes type plus noncreature plus mana-value threshold generically', () => {
  const commander = card('Shape Commander', {
    oracle_text: 'During your turn, each noncreature artifact and noncreature enchantment you control with mana value 4 or greater becomes a 4/4 creature in addition to its other types and gains haste and indestructible.',
  });
  const qualifying = card('Qualifying Permanent', { type_line: 'Enchantment', cmc: 5 });
  const tooSmall = card('Small Permanent', { type_line: 'Enchantment', cmc: 2 });
  const creature = card('Creature Enchantment', { type_line: 'Enchantment Creature — Elemental', cmc: 5 });
  const components = [
    { id: 'artifacts', queryClause: 't:artifact' },
    { id: 'enchantments', queryClause: 't:enchantment' },
  ];
  const qualifyingScore = requestedComponentRelationshipAffinityV15(qualifying, [commander], components).score;
  assert.ok(qualifyingScore > requestedComponentRelationshipAffinityV15(tooSmall, [commander], components).score);
  assert.ok(qualifyingScore > requestedComponentRelationshipAffinityV15(creature, [commander], components).score);
});

test('weak on-theme membership remains a small advisory signal rather than a hard protection class', () => {
  const commander = card('Typal Commander', { oracle_text: 'Merfolk you control have ward {1}.' });
  const vanilla = card('Vanilla Member', { type_line: 'Creature — Merfolk' });
  const signal = requestedComponentRelationshipAffinityV15(vanilla, [commander], [{ id: 'typal', queryClause: 't:"Merfolk"' }]);
  assert.equal(signal.score, 2);
  assert.ok(signal.score < 4);
});
