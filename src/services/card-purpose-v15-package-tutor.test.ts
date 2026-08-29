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
  };
}

const ballista = card({ name: 'Walking Ballista', type_line: 'Artifact Creature — Construct', cmc: 0 });
const scales = card({ name: 'Hardened Scales', type_line: 'Enchantment', cmc: 1 });
const sword = card({ name: 'Triggered Sword', type_line: 'Artifact — Equipment', oracle_text: 'Whenever equipped creature deals combat damage to a player, draw a card.' });
const boots = card({ name: 'Protective Boots', type_line: 'Artifact — Equipment', oracle_text: 'Equipped creature has hexproof and haste.' });
const mask = card({ name: 'Memory Mask', type_line: 'Artifact — Equipment', oracle_text: 'Whenever equipped creature deals combat damage to a player, draw two cards, then discard a card.' });

test('healthy Equipment tutor package is meaningful even when it is not combo access', () => {
  const cloudLike = card({
    name: 'Equipment Package Tutor',
    type_line: 'Legendary Creature — Human Soldier',
    oracle_text: 'When Equipment Package Tutor enters, search your library for an Equipment card, reveal it, put it into your hand, then shuffle. As long as Equipment Package Tutor is equipped, if a triggered ability of an Equipment attached to it triggers, that ability triggers an additional time.',
  });
  const deck = [cloudLike, sword, boots, mask, ballista, scales];
  const result = auditCardPurposeV15(cloudLike, { deck, comboPieces: [ballista, scales] });

  assert.equal(result.status, 'supported');
  assert.deepEqual(result.deterministicComboHits, []);
  assert.ok(result.purposes.includes('Equipment package access'));
  assert.ok(result.supportEvidence.some((evidence) => evidence.includes('3 legal library targets')));
  assert.ok(result.warnings.some((warning) => warning.includes('does not deterministically access')));
});

test('one-target Vehicle tutor still faces narrow-package pressure', () => {
  const vehicle = card({ name: 'Only Vehicle', type_line: 'Artifact — Vehicle' });
  const tutor = card({
    name: 'Narrow Vehicle Tutor',
    type_line: 'Sorcery',
    oracle_text: 'Search your library for a Vehicle card, reveal it, put it into your hand, then shuffle.',
  });
  const result = auditCardPurposeV15(tutor, { deck: [tutor, vehicle, ballista, scales], comboPieces: [ballista, scales] });

  assert.equal(result.status, 'challenge');
  assert.ok(!result.purposes.includes('Vehicle package access'));
  assert.ok(result.warnings.some((warning) => warning.includes('only 1 other target')));
});

test('land tutor can remain meaningful as mana development without being combo access', () => {
  const landTutor = card({
    name: 'Mana Route',
    type_line: 'Sorcery',
    oracle_text: 'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
  });
  const forest = card({ name: 'Forest', type_line: 'Basic Land — Forest' });
  const result = auditCardPurposeV15(landTutor, { deck: [landTutor, forest, ballista, scales], comboPieces: [ballista, scales] });

  assert.equal(result.status, 'supported');
  assert.deepEqual(result.deterministicComboHits, []);
  assert.ok(result.purposes.includes('mana development'));
});
