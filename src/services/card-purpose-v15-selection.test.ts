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
  oracle_text: 'Walking Ballista enters with X +1/+1 counters on it.',
});

const scales = card({
  name: 'Hardened Scales',
  type_line: 'Enchantment',
  cmc: 1,
  mana_cost: '{G}',
  oracle_text: 'If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.',
});

test('Delve reminder text is a cost, not graveyard hate or recursion, while top-N combo selection is credited', () => {
  const digLike = card({
    name: 'Deep Selection',
    type_line: 'Instant',
    cmc: 8,
    mana_cost: '{6}{U}{U}',
    keywords: ['Delve'],
    oracle_text: 'Delve (Each card you exile from your graveyard while casting this spell pays for {1}.)\nLook at the top seven cards of your library. Put two of them into your hand and the rest on the bottom of your library in any order.',
  });

  const result = auditCardPurposeV15(digLike, {
    deck: [digLike, ballista, scales],
    comboPieces: [ballista, scales],
  });

  assert.equal(result.status, 'supported');
  assert.ok(result.roles.includes('card selection'));
  assert.ok(!result.roles.includes('graveyard hate'));
  assert.ok(!result.roles.includes('graveyard recursion'));
  assert.deepEqual(result.boundedComboHits, ['Walking Ballista', 'Hardened Scales']);
  assert.ok(result.purposes.includes('bounded win-piece selection'));
  assert.ok(result.supportEvidence.some((evidence) => evidence.includes('top-7 selection reaches')));
});
