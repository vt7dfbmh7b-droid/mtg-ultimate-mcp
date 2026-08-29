import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { deterministicTutorAccessV15 } from './combo-access-v15.js';

function card(input: Partial<ScryfallCard> & Pick<ScryfallCard, 'name' | 'type_line'>): ScryfallCard {
  return {
    id: input.id ?? input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: input.name,
    lang: 'en',
    cmc: input.cmc ?? 0,
    type_line: input.type_line,
    oracle_text: input.oracle_text ?? '',
    color_identity: input.color_identity ?? [],
    keywords: input.keywords ?? [],
    legalities: input.legalities ?? { commander: 'legal' },
    set: input.set ?? 'tst',
    set_name: input.set_name ?? 'Test',
    collector_number: input.collector_number ?? '1',
    rarity: input.rarity ?? 'common',
    scryfall_uri: input.scryfall_uri ?? 'https://scryfall.com/',
    ...(input.mana_cost !== undefined ? { mana_cost: input.mana_cost } : {}),
    ...(input.card_faces !== undefined ? { card_faces: input.card_faces } : {}),
  };
}

const ballista = card({
  name: 'Walking Ballista',
  type_line: 'Artifact Creature — Construct',
  cmc: 0,
  oracle_text: 'Walking Ballista enters with X +1/+1 counters on it.',
});
const scales = card({ name: 'Hardened Scales', type_line: 'Enchantment', cmc: 1 });
const plains = card({ name: 'Plains', type_line: 'Basic Land — Plains' });
const dualPlains = card({ name: 'Prairie Stream', type_line: 'Land — Plains Island' });
const forest = card({ name: 'Forest', type_line: 'Basic Land — Forest' });
const nonbasicForest = card({ name: 'Dryad Arbor', type_line: 'Land Creature — Forest Dryad' });

test('Plains-only library search cannot masquerade as unrestricted combo access', () => {
  const scholar = card({
    name: 'Scholar of New Horizons',
    type_line: 'Creature — Human Wizard',
    cmc: 2,
    oracle_text: 'Scholar of New Horizons enters with a +1/+1 counter on it. {T}, Remove a counter from a permanent you control: Search your library for a Plains card, reveal it, and put it into your hand, then shuffle. If an opponent controls more lands than you, put that card onto the battlefield tapped instead.',
  });

  assert.equal(deterministicTutorAccessV15(scholar, ballista).deterministic, false);
  assert.equal(deterministicTutorAccessV15(scholar, scales).deterministic, false);
  assert.equal(deterministicTutorAccessV15(scholar, plains).deterministic, true);
  assert.equal(deterministicTutorAccessV15(scholar, dualPlains).deterministic, true);
});

test('plural basic-land search remains restricted to actual Basic lands', () => {
  const rejuvenator = card({
    name: 'Rampant Rejuvenator',
    type_line: 'Creature — Plant Hydra',
    cmc: 4,
    oracle_text: 'Rampant Rejuvenator enters with two +1/+1 counters on it. When Rampant Rejuvenator dies, search your library for up to X basic land cards, where X is the number of +1/+1 counters on Rampant Rejuvenator, put those cards onto the battlefield tapped, then shuffle.',
  });

  assert.equal(deterministicTutorAccessV15(rejuvenator, ballista).deterministic, false);
  assert.equal(deterministicTutorAccessV15(rejuvenator, scales).deterministic, false);
  assert.equal(deterministicTutorAccessV15(rejuvenator, forest).deterministic, true);
  assert.equal(deterministicTutorAccessV15(rejuvenator, nonbasicForest).deterministic, false);
});

test('plural artifact search still recognizes artifact restriction', () => {
  const artifactTutor = card({
    name: 'Plural Artifact Tutor',
    type_line: 'Sorcery',
    oracle_text: 'Search your library for up to two artifact cards, reveal them, put them into your hand, then shuffle.',
  });

  assert.equal(deterministicTutorAccessV15(artifactTutor, ballista).deterministic, true);
  assert.equal(deterministicTutorAccessV15(artifactTutor, scales).deterministic, false);
});
