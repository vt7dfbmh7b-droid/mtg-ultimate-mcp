import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard, ScryfallCardFace } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import { parseDecklist } from './deck.js';

function card(options: {
  name: string;
  typeLine: string;
  oracleText?: string;
  power?: string;
  toughness?: string;
  faces?: ScryfallCardFace[];
}): ScryfallCard {
  return {
    id: `id-${options.name}`,
    oracle_id: `oracle-${options.name}`,
    name: options.name,
    lang: 'en',
    released_at: '2025-08-01',
    cmc: 4,
    type_line: options.typeLine,
    ...(options.oracleText !== undefined ? { oracle_text: options.oracleText } : {}),
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Commander Eligibility Test',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(options.name)}`,
    ...(options.power !== undefined ? { power: options.power } : {}),
    ...(options.toughness !== undefined ? { toughness: options.toughness } : {}),
    ...(options.faces !== undefined ? { card_faces: options.faces } : {}),
  };
}

const wastes = card({ name: 'Wastes', typeLine: 'Basic Land' });

function validateSingleCommander(commander: ScryfallCard) {
  const parsed = parseDecklist([
    '// COMMANDER',
    `1 ${commander.name}`,
    '',
    '// MAIN',
    '99 Wastes',
  ].join('\n'));
  return validateCommanderDeck(parsed, [commander, wastes]);
}

function commanderEligible(result: ReturnType<typeof validateSingleCommander>): boolean {
  return result.commanderChecks[0]?.eligible === true;
}

test('legendary Vehicle with printed power and toughness is commander-eligible', () => {
  const result = validateSingleCommander(card({
    name: 'Current Vehicle Commander',
    typeLine: 'Legendary Artifact — Vehicle',
    power: '6',
    toughness: '6',
  }));

  assert.equal(result.status, 'legal');
  assert.equal(result.isLegal, true);
  assert.equal(commanderEligible(result), true);
  assert.match(String(result.commanderChecks[0]?.reason), /Vehicle or Spacecraft.*printed power and toughness/i);
});

test('legendary Spacecraft with printed power and toughness is commander-eligible', () => {
  const result = validateSingleCommander(card({
    name: 'Current Spacecraft Commander',
    typeLine: 'Legendary Artifact — Spacecraft',
    power: '5',
    toughness: '7',
  }));

  assert.equal(result.status, 'legal');
  assert.equal(commanderEligible(result), true);
});

test('Vehicle or Spacecraft without a printed power/toughness pair is not automatically commander-eligible', () => {
  for (const commander of [
    card({ name: 'Statless Vehicle', typeLine: 'Legendary Artifact — Vehicle' }),
    card({ name: 'Power Only Spacecraft', typeLine: 'Legendary Artifact — Spacecraft', power: '5' }),
    card({ name: 'Toughness Only Vehicle', typeLine: 'Legendary Artifact — Vehicle', toughness: '5' }),
  ]) {
    const result = validateSingleCommander(commander);
    assert.equal(result.status, 'illegal');
    assert.equal(commanderEligible(result), false);
  }
});

test('printed stats do not make an arbitrary legendary artifact commander-eligible', () => {
  const result = validateSingleCommander(card({
    name: 'Legendary Machine',
    typeLine: 'Legendary Artifact',
    power: '8',
    toughness: '8',
  }));

  assert.equal(result.status, 'illegal');
  assert.equal(commanderEligible(result), false);
});

test('existing explicit can-be-your-commander permission remains supported', () => {
  const result = validateSingleCommander(card({
    name: 'Explicit Commander',
    typeLine: 'Legendary Planeswalker — Test',
    oracleText: 'Explicit Commander can be your commander.',
  }));

  assert.equal(result.status, 'legal');
  assert.equal(commanderEligible(result), true);
});

test('face-local Vehicle/Spacecraft stats are accepted, but type and stats cannot be borrowed across faces', () => {
  const valid = validateSingleCommander(card({
    name: 'Transforming Vessel',
    typeLine: 'Artifact',
    faces: [
      {
        name: 'Transforming Vessel',
        type_line: 'Legendary Artifact — Spacecraft',
        power: '4',
        toughness: '5',
      },
      {
        name: 'Docked Form',
        type_line: 'Artifact',
      },
    ],
  }));
  assert.equal(valid.status, 'legal');
  assert.equal(commanderEligible(valid), true);

  const invalid = validateSingleCommander(card({
    name: 'Split Evidence Vessel',
    typeLine: 'Artifact',
    faces: [
      {
        name: 'Ship Face',
        type_line: 'Legendary Artifact — Vehicle',
      },
      {
        name: 'Creature Face',
        type_line: 'Creature — Construct',
        power: '4',
        toughness: '5',
      },
    ],
  }));
  assert.equal(invalid.status, 'illegal');
  assert.equal(commanderEligible(invalid), false);
});
