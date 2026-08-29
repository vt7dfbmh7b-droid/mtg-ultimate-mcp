import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { auditCardPurposeV15 } from './card-purpose-v15.js';
import { deterministicTutorAccessV15 } from './combo-access-v15.js';
import { boundedComboSelectionAccessV15 } from './combo-selection-v15.js';
import { libraryTypeHasV15, libraryVisibleTypeLineV15 } from './library-characteristics-v15.js';

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
    ...(input.layout !== undefined ? { layout: input.layout } : {}),
    ...(input.card_faces !== undefined ? { card_faces: input.card_faces } : {}),
    ...(input.mana_cost !== undefined ? { mana_cost: input.mana_cost } : {}),
  };
}

const balambLike = card({
  name: 'Academy Front // Airborne Back',
  layout: 'transform',
  type_line: 'Land — Town // Legendary Artifact — Vehicle',
  card_faces: [
    { name: 'Academy Front', type_line: 'Land — Town', oracle_text: '{T}: Add {U}.' },
    { name: 'Airborne Back', type_line: 'Legendary Artifact — Vehicle', oracle_text: 'Flying' },
  ],
});

const copter = card({
  name: "Smuggler's Copter",
  type_line: 'Artifact — Vehicle',
  oracle_text: 'Flying. Crew 1.',
});

const fatherToSon = card({
  name: 'From Father to Son',
  type_line: 'Sorcery',
  oracle_text: 'Search your library for a Vehicle card, reveal it, put it into your hand, then shuffle.',
});

const artifactSelector = card({
  name: 'Artifact Looker',
  type_line: 'Sorcery',
  oracle_text: 'Look at the top five cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library.',
});

test('transforming DFC presents only its front-face type in the library', () => {
  assert.equal(libraryVisibleTypeLineV15(balambLike), 'Land — Town');
  assert.equal(libraryTypeHasV15(balambLike, 'land'), true);
  assert.equal(libraryTypeHasV15(balambLike, 'vehicle'), false);
  assert.equal(libraryTypeHasV15(balambLike, 'artifact'), false);
});

test('Vehicle tutor cannot find a land-front Vehicle-back DFC in the library', () => {
  const access = deterministicTutorAccessV15(fatherToSon, balambLike);
  assert.equal(access.deterministic, false);
});

test('artifact-only top-N selection cannot select a land-front artifact-back DFC', () => {
  const access = boundedComboSelectionAccessV15(artifactSelector, balambLike);
  assert.equal(access.matched, false);
});

test('narrow Vehicle-purpose audit counts only library-visible Vehicle targets', () => {
  const result = auditCardPurposeV15(fatherToSon, {
    deck: [fatherToSon, copter, balambLike],
  });
  assert.equal(result.status, 'challenge');
  assert.ok(result.supportEvidence.includes('vehicle-search target count: 1'));
  assert.ok(result.warnings.some((warning) => warning.includes('only 1 other target')));
});
