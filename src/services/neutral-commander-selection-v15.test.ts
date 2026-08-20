import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  inferNeutralStrategyV15,
  rankNeutralCommanderCandidatesV15,
} from './neutral-commander-selection-v15.js';

function card(input: {
  name: string;
  cmc?: number;
  colors?: string[];
  oracle?: string;
  keywords?: string[];
  oracleId?: string;
}): ScryfallCard {
  return {
    id: `id-${input.name}`,
    oracle_id: input.oracleId ?? `oracle-${input.name}`,
    name: input.name,
    lang: 'en',
    cmc: input.cmc ?? 4,
    type_line: 'Legendary Creature — Test Hero',
    oracle_text: input.oracle ?? '',
    color_identity: input.colors ?? ['U'],
    keywords: input.keywords ?? [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: input.name.length.toString(),
    rarity: 'rare',
    scryfall_uri: 'https://scryfall.com/card/tst/1/test',
  };
}

test('neutral inference finds a combat-token identity from semantics', () => {
  const result = inferNeutralStrategyV15([card({
    name: 'Unknown Warrior',
    oracle: [
      'Whenever a Warrior attacks, create a 1/1 Warrior creature token that is tapped and attacking.',
      'Untap all attacking creatures. After this phase, there is an additional combat phase.',
    ].join('\n'),
  })]);
  assert.equal(result[0]?.archetype, 'combat-tokens');
  assert.ok((result[0]?.score ?? 0) > 0);
});

test('neutral inference distinguishes graveyard and equipment identities', () => {
  const graveyard = inferNeutralStrategyV15([card({
    name: 'Grave Hero',
    oracle: 'Whenever you discard a card, mill two cards. You may return target creature card from your graveyard to the battlefield.',
  })]);
  const equipment = inferNeutralStrategyV15([card({
    name: 'Blade Hero',
    oracle: 'Whenever Blade Hero attacks, you may attach target Equipment you control to it. Equipped creature has double strike.',
  })]);
  assert.equal(graveyard[0]?.archetype, 'graveyard-reanimator');
  assert.equal(equipment[0]?.archetype, 'equipment-voltron');
});

test('renaming an identical commander does not change neutral coherence score', () => {
  const oracle = 'Whenever a creature you control dies, each opponent loses 1 life. Sacrifice another creature: Draw a card.';
  const first = rankNeutralCommanderCandidatesV15([card({ name: 'Alpha', oracle, oracleId: 'a' })], 1)[0]!;
  const renamed = rankNeutralCommanderCandidatesV15([card({ name: 'Extremely Famous Name', oracle, oracleId: 'b' })], 1)[0]!;
  assert.equal(first.coherenceScore, renamed.coherenceScore);
  assert.equal(first.strategy.archetype, renamed.strategy.archetype);
});

test('colour access and low mana value do not secretly award neutral selection points', () => {
  const oracle = 'Whenever you cast a noncreature spell, draw a card.';
  const narrow = rankNeutralCommanderCandidatesV15([card({ name: 'Narrow', cmc: 7, colors: ['U'], oracle, oracleId: 'n' })], 1)[0]!;
  const broadFast = rankNeutralCommanderCandidatesV15([card({ name: 'Broad Fast', cmc: 2, colors: ['W', 'U', 'B', 'R', 'G'], oracle, oracleId: 'b' })], 1)[0]!;
  assert.equal(narrow.coherenceScore, broadFast.coherenceScore);
  assert.equal(narrow.strategy.score, broadFast.strategy.score);
});

test('generic Partner pairs are considered only when the two commanders share semantic strategy support', () => {
  const left = card({
    name: 'Partner Sac A',
    oracle: 'Partner\nWhenever a creature you control dies, each opponent loses 1 life.',
    keywords: ['Partner'],
  });
  const right = card({
    name: 'Partner Sac B',
    oracle: 'Partner\nSacrifice another creature: Draw a card.',
    keywords: ['Partner'],
  });
  const ranked = rankNeutralCommanderCandidatesV15([left, right], 10);
  const pair = ranked.find((candidate) => candidate.kind === 'partner-pair');
  assert.ok(pair);
  assert.equal(pair.strategy.archetype, 'aristocrats');
  assert.ok(pair.selectionSignals.some((signal) => signal.includes('both partners support')));
});

test('restricted Partner with cards are not treated as generic Partner pairs', () => {
  const left = card({ name: 'Specific A', oracle: 'Partner with Specific B', keywords: ['Partner'] });
  const right = card({ name: 'Specific B', oracle: 'Partner with Specific A', keywords: ['Partner'] });
  const ranked = rankNeutralCommanderCandidatesV15([left, right], 10);
  assert.equal(ranked.some((candidate) => candidate.kind === 'partner-pair'), false);
});

test('neutral ranking is deterministic across provider ordering', () => {
  const cards = [
    card({ name: 'Token Hero', oracle: 'Whenever Token Hero attacks, create two 1/1 creature tokens that are tapped and attacking.' }),
    card({ name: 'Counter Hero', oracle: 'Whenever a +1/+1 counter is put on a creature you control, proliferate.' }),
    card({ name: 'Value Hero', oracle: 'At the beginning of your end step, draw a card.' }),
  ];
  const forward = rankNeutralCommanderCandidatesV15(cards, 3);
  const reverse = rankNeutralCommanderCandidatesV15([...cards].reverse(), 3);
  assert.deepEqual(forward, reverse);
});
