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

test('explicit +1/+1 counter engine is supported when it bridges to a generic counter-matters commander', () => {
  const commander = card({
    name: 'Counter Commander',
    type_line: 'Legendary Creature — Human Warrior',
    cmc: 3,
    oracle_text: 'At the beginning of combat on your turn, you may move a counter from target creature you control onto a second target creature you control. Whenever one or more creatures you control with counters on them deal combat damage to a player, draw a card and proliferate.',
  });
  const sphereLikeEngine = card({
    name: 'Combat Counter Engine',
    type_line: 'Enchantment',
    cmc: 2,
    oracle_text: 'Whenever a creature you control deals combat damage to a player, put a +1/+1 counter on that creature. Creatures you control with +1/+1 counters on them have trample.',
  });

  const result = auditCardPurposeV15(sphereLikeEngine, {
    deck: [sphereLikeEngine],
    commander,
  });

  assert.equal(result.status, 'supported');
  assert.ok(result.roles.includes('+1/+1 counters'));
  assert.ok(result.purposes.includes('commander-plan bridge'));
  assert.ok(result.supportEvidence.some((evidence) => evidence.includes('counter-matters commander')));
});
