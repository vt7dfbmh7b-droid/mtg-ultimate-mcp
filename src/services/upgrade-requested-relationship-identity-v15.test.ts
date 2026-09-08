import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { replacementIdentityPriorityV15 } from './replacement-identity-priority-v15.js';
import { upgradeRequestedIdentityAffinityV15 } from './upgrade.js';

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

const components = [{ id: 'typal', queryClause: 't:"Merfolk"', currentMainMatches: 18, requiredMainMatches: 12 }];

test('upgrade identity bridge keeps broad component membership separate while adding typed payoff identity', () => {
  const commander = card('Typal Commander', { oracle_text: 'Whenever one or more Merfolk you control attack, draw a card.' });
  const payoff = card('Typal Payoff', {
    type_line: 'Creature — Merfolk Advisor',
    oracle_text: 'Other Merfolk you control get +1/+1. Whenever a Merfolk you control deals combat damage to a player, draw a card.',
  });
  const signal = upgradeRequestedIdentityAffinityV15(payoff, [commander], components, ['typal']);
  assert.deepEqual(signal.broadMatchedComponentIds, ['typal']);
  assert.ok(signal.matchedComponentIds.includes('typal'));
  assert.ok(signal.matchedComponentIds.includes('relation:typal-payoff'));
  assert.ok(signal.requestedRelationshipAffinity >= 4);
});

test('bare requested membership stays cuttable while losing a typed relationship is visible to symmetric replacement identity', () => {
  const commander = card('Typal Commander', { oracle_text: 'Merfolk you control have ward {1}.' });
  const bare = card('Plain Member', { type_line: 'Creature — Merfolk' });
  const engine = card('Adaptive Engine', {
    type_line: 'Enchantment',
    oracle_text: 'As this enchantment enters, choose a creature type. Whenever you cast a spell of the chosen type, copy that spell.',
  });
  const bareSignal = upgradeRequestedIdentityAffinityV15(bare, [commander], components, ['typal']);
  const engineSignal = upgradeRequestedIdentityAffinityV15(engine, [commander], components, []);
  assert.equal(bareSignal.requestedRelationshipAffinity, 1);
  assert.deepEqual(bareSignal.matchedComponentIds, ['typal']);
  assert.ok(engineSignal.matchedComponentIds.includes('relation:typal-engine'));

  const preservesEngine = replacementIdentityPriorityV15(
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['typal', 'relation:typal-engine'], substantiveStrategyAffinity: 4 },
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['typal', 'relation:typal-engine'], substantiveStrategyAffinity: 4 },
  );
  const losesEngine = replacementIdentityPriorityV15(
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['typal'], substantiveStrategyAffinity: 4 },
    { matchesControlledTheme: true, matchedRequestedComponentIds: ['typal', 'relation:typal-engine'], substantiveStrategyAffinity: 4 },
  );
  assert.equal(preservesEngine.requestedComponentLossCount, 0);
  assert.equal(losesEngine.requestedComponentLossCount, 1);
  assert.ok(losesEngine.identityErosion > preservesEngine.identityErosion);
});

test('commander-shape relationship does not become hard broad theme membership', () => {
  const commander = card('Shape Commander', {
    oracle_text: 'During your turn, each noncreature artifact you control with mana value 4 or greater becomes a 4/4 creature.',
  });
  const qualifying = card('Large Relic', { type_line: 'Artifact', cmc: 4 });
  const signal = upgradeRequestedIdentityAffinityV15(qualifying, [commander], [], []);
  assert.deepEqual(signal.broadMatchedComponentIds, []);
  assert.ok(signal.matchedComponentIds.includes('relation:commander-shape'));
  assert.ok(signal.requestedRelationshipAffinity >= 4);
});
