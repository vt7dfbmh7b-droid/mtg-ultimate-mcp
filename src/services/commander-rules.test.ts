import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { validateCommanderDeck } from './commander-rules.js';

function card(
  name: string,
  typeLine: string,
  colorIdentity: string[],
  oracleText = '',
  commanderLegality: 'legal' | 'banned' | 'not_legal' = 'legal',
): ScryfallCard {
  return {
    id: name.toLowerCase().replace(/\W+/g, '-'),
    name,
    lang: 'en',
    cmc: 2,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: colorIdentity,
    keywords: [],
    legalities: { commander: commanderLegality },
    set: 'tst',
    set_name: 'Test',
    collector_number: String(Math.floor(Math.random() * 10000)),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
  };
}

test('Rakdos commander rejects blue, white, and green identities but allows colorless', () => {
  const cards = [
    card('Rakdos Boss', 'Legendary Creature — Vampire', ['B', 'R']),
    card('Black Spell', 'Instant', ['B']),
    card('Red Spell', 'Instant', ['R']),
    card('Rakdos Spell', 'Sorcery', ['B', 'R']),
    card('Colorless Rock', 'Artifact', []),
    card('Blue Spell', 'Instant', ['U']),
  ];
  const deck = parseDecklist(`
// COMMANDER
1 Rakdos Boss
// MAIN
24 Black Spell
24 Red Spell
25 Rakdos Spell
25 Colorless Rock
1 Blue Spell
`);
  const result = validateCommanderDeck(deck, cards);
  assert.equal(result.commanderColorIdentityLabel, 'BR');
  assert.equal(result.colorIdentityViolations.length, 1);
  assert.equal(result.colorIdentityViolations[0]?.name, 'Blue Spell');
  assert.equal(result.isLegal, false);
});

test('hybrid identity counts as both colors for Commander construction', () => {
  const hybrid = card('Black Red Hybrid', 'Creature — Rogue', ['B', 'R']);
  const monoBlackCards = [
    card('Mono Black Boss', 'Legendary Creature — Wizard', ['B']),
    hybrid,
    card('Swamp', 'Basic Land — Swamp', ['B']),
  ];
  const monoBlackDeck = parseDecklist(`
// COMMANDER
1 Mono Black Boss
// MAIN
1 Black Red Hybrid
98 Swamp
`);
  const monoResult = validateCommanderDeck(monoBlackDeck, monoBlackCards);
  assert.equal(monoResult.colorIdentityViolations.some((item) => item.name === 'Black Red Hybrid'), true);

  const rakdosCards = [
    card('Rakdos Boss', 'Legendary Creature — Wizard', ['B', 'R']),
    hybrid,
    card('Swamp', 'Basic Land — Swamp', ['B']),
  ];
  const rakdosDeck = parseDecklist(`
// COMMANDER
1 Rakdos Boss
// MAIN
1 Black Red Hybrid
98 Swamp
`);
  const rakdosResult = validateCommanderDeck(rakdosDeck, rakdosCards);
  assert.equal(rakdosResult.colorIdentityViolations.length, 0);
});

test('combined Partner identities permit cards inside the combined identity', () => {
  const cards = [
    card('Black Partner', 'Legendary Creature — Human', ['B'], 'Partner'),
    card('Red Partner', 'Legendary Creature — Human', ['R'], 'Partner'),
    card('Rakdos Card', 'Sorcery', ['B', 'R']),
    card('Wastes', 'Basic Land', []),
  ];
  const deck = parseDecklist(`
// COMMANDER
1 Black Partner
1 Red Partner
// MAIN
1 Rakdos Card
97 Wastes
`);
  const result = validateCommanderDeck(deck, cards);
  assert.equal(result.commanderColorIdentityLabel, 'BR');
  assert.equal(result.pairing.method, 'Partner');
  assert.equal(result.colorIdentityViolations.length, 0);
  assert.equal(result.deckSize.valid, true);
});

test('invalid two-commander pairing is rejected', () => {
  const cards = [
    card('Legend One', 'Legendary Creature — Human', ['W']),
    card('Legend Two', 'Legendary Creature — Human', ['U']),
    card('Wastes', 'Basic Land', []),
  ];
  const deck = parseDecklist(`
// COMMANDER
1 Legend One
1 Legend Two
// MAIN
98 Wastes
`);
  const result = validateCommanderDeck(deck, cards);
  assert.equal(result.pairing.legal, false);
  assert.equal(result.isLegal, false);
});

test('Choose a Background combines identities', () => {
  const cards = [
    card('Hero', 'Legendary Creature — Human', ['R'], 'Choose a Background'),
    card('Dark Past', 'Legendary Enchantment — Background', ['B']),
    card('Rakdos Card', 'Instant', ['B', 'R']),
    card('Wastes', 'Basic Land', []),
  ];
  const deck = parseDecklist(`
// COMMANDER
1 Hero
1 Dark Past
// MAIN
1 Rakdos Card
97 Wastes
`);
  const result = validateCommanderDeck(deck, cards);
  assert.equal(result.pairing.method, 'Choose a Background');
  assert.equal(result.commanderColorIdentityLabel, 'BR');
  assert.equal(result.commanderChecks.every((check) => check.eligible === true), true);
});

test('Doctor companion pairing is recognized', () => {
  const cards = [
    card('The Test Doctor', 'Legendary Creature — Time Lord Doctor', ['U']),
    card('Faithful Companion', 'Legendary Creature — Human', ['R'], "Doctor's companion"),
    card('Izzet Card', 'Instant', ['U', 'R']),
    card('Wastes', 'Basic Land', []),
  ];
  const deck = parseDecklist(`
// COMMANDER
1 The Test Doctor
1 Faithful Companion
// MAIN
1 Izzet Card
97 Wastes
`);
  const result = validateCommanderDeck(deck, cards);
  assert.equal(result.pairing.method, "Doctor's companion");
  assert.equal(result.commanderColorIdentityLabel, 'UR');
});

test('card-specific copy-count exceptions are honored', () => {
  const rat = card('Endless Rat', 'Creature — Rat', ['B'], 'A deck can have any number of cards named Endless Rat.');
  const cards = [card('Rat King', 'Legendary Creature — Rat', ['B']), rat];
  const deck = parseDecklist(`
// COMMANDER
1 Rat King
// MAIN
99 Endless Rat
`);
  const result = validateCommanderDeck(deck, cards);
  assert.equal(result.singletonViolations.length, 0);
});
