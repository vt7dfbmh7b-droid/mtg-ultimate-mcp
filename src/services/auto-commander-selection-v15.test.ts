import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { rankAutoCommanderCandidatesV15 } from './auto-commander-selection-v15.js';

function card(input: {
  name: string;
  cmc: number;
  colors: string[];
  oracle?: string;
  keywords?: string[];
  typeLine?: string;
  oracleId?: string;
}): ScryfallCard {
  return {
    id: `id-${input.name}`,
    oracle_id: input.oracleId ?? `oracle-${input.name}`,
    name: input.name,
    lang: 'en',
    cmc: input.cmc,
    type_line: input.typeLine ?? 'Legendary Creature — Human Warrior',
    oracle_text: input.oracle ?? '',
    color_identity: input.colors,
    keywords: input.keywords ?? [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: input.name.length.toString(),
    rarity: 'mythic',
    scryfall_uri: `https://scryfall.com/card/tst/${input.name.length}/test`,
  };
}

const combatEngine = [
  'Whenever a Warrior attacks, create a 1/1 white Warrior creature token that is tapped and attacking.',
  '{W}{U}{B}{R}{G}: Untap all attacking creatures. After this phase, there is an additional combat phase. Activate only during combat.',
].join('\n');

test('automatic ranking rewards command-zone efficiency, color access, and card-text engines rather than a famous commander name', () => {
  const strong = card({
    name: 'Completely Unknown Hero',
    cmc: 3,
    colors: ['W', 'U', 'B', 'R', 'G'],
    oracle: combatEngine,
  });
  const slow = card({
    name: 'Very Famous Commander Name',
    cmc: 7,
    colors: ['G'],
    oracle: 'Vigilance',
  });

  const ranked = rankAutoCommanderCandidatesV15([slow, strong], 10);
  assert.equal(ranked[0]?.label, 'Completely Unknown Hero');
  assert.ok((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0));
});

test('renaming a commander does not change its numeric score', () => {
  const first = card({
    name: 'Alpha Name',
    cmc: 3,
    colors: ['W', 'U', 'B', 'R', 'G'],
    oracle: combatEngine,
    oracleId: 'alpha',
  });
  const renamed = card({
    name: 'Totally Different Name',
    cmc: 3,
    colors: ['W', 'U', 'B', 'R', 'G'],
    oracle: combatEngine,
    oracleId: 'renamed',
  });

  const firstScore = rankAutoCommanderCandidatesV15([first], 1)[0]?.score;
  const renamedScore = rankAutoCommanderCandidatesV15([renamed], 1)[0]?.score;
  assert.equal(firstScore, renamedScore);
});

test('unrestricted Partner commanders create legal candidate pairs while ordinary legends do not', () => {
  const left = card({
    name: 'Partner Left',
    cmc: 3,
    colors: ['W', 'B'],
    oracle: 'Partner\nWhenever one or more creatures you control deal combat damage to a player, draw a card.',
    keywords: ['Partner'],
  });
  const right = card({
    name: 'Partner Right',
    cmc: 4,
    colors: ['U', 'R'],
    oracle: 'Partner\nWhenever an opponent casts their second spell each turn, draw a card.',
    keywords: ['Partner'],
  });
  const ordinary = card({
    name: 'Ordinary Legend',
    cmc: 2,
    colors: ['G'],
    oracle: 'Trample',
  });

  const ranked = rankAutoCommanderCandidatesV15([ordinary, right, left], 20);
  const pair = ranked.find((candidate) => candidate.kind === 'partner-pair');
  assert.ok(pair);
  assert.deepEqual(pair.commanderNames, ['Partner Left', 'Partner Right']);
  assert.deepEqual(pair.colorIdentity, ['B', 'R', 'U', 'W']);
  assert.equal(ranked.filter((candidate) => candidate.kind === 'partner-pair').length, 1);
});

test('Partner with and other restricted pairing mechanics are not treated as unrestricted Partner', () => {
  const restrictedA = card({
    name: 'Specific Partner A',
    cmc: 2,
    colors: ['U'],
    oracle: 'Partner with Specific Partner B',
    keywords: ['Partner'],
  });
  const restrictedB = card({
    name: 'Specific Partner B',
    cmc: 2,
    colors: ['R'],
    oracle: 'Partner with Specific Partner A',
    keywords: ['Partner'],
  });

  const ranked = rankAutoCommanderCandidatesV15([restrictedA, restrictedB], 20);
  assert.equal(ranked.some((candidate) => candidate.kind === 'partner-pair'), false);
});

test('ranking is deterministic across provider input order and obeys the bounded candidate cap', () => {
  const cards = [
    card({ name: 'A', cmc: 2, colors: ['U'], oracle: 'Draw a card.' }),
    card({ name: 'B', cmc: 3, colors: ['W', 'U'], oracle: 'Whenever a creature attacks, draw a card.' }),
    card({ name: 'C', cmc: 4, colors: ['B', 'R', 'G'], oracle: 'Create a Treasure token.' }),
  ];
  const forward = rankAutoCommanderCandidatesV15(cards, 2);
  const reversed = rankAutoCommanderCandidatesV15([...cards].reverse(), 2);
  assert.deepEqual(forward, reversed);
  assert.equal(forward.length, 2);
});
