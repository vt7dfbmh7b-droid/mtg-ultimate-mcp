import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { validateCommanderDeck } from './commander-rules.js';

let collector = 1;
function card(name: string, typeLine: string, colorIdentity: string[], oracleText = '', keywords: string[] = []): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    cmc: 2,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: colorIdentity,
    keywords,
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test("Doctor's companion requires exactly Time Lord Doctor creature subtypes", () => {
  const companion = card('Companion', 'Legendary Creature — Human', ['R'], "Doctor's companion");
  const validDoctor = card('Valid Doctor', 'Legendary Creature — Time Lord Doctor', ['U']);
  const invalidDoctor = card('Changeling Doctor', 'Legendary Creature — Shapeshifter Doctor', ['U']);
  const wastes = card('Wastes', 'Basic Land', []);

  const validDeck = parseDecklist(`
// COMMANDER
1 Valid Doctor
1 Companion
// MAIN
98 Wastes
`);
  const valid = validateCommanderDeck(validDeck, [validDoctor, companion, wastes]);
  assert.equal(valid.pairing.method, "Doctor's companion");

  const invalidDeck = parseDecklist(`
// COMMANDER
1 Changeling Doctor
1 Companion
// MAIN
98 Wastes
`);
  const invalid = validateCommanderDeck(invalidDeck, [invalidDoctor, companion, wastes]);
  assert.equal(invalid.pairing.legal, false);
});

test('Partner—Character select pairs only with the same partner variant', () => {
  const first = card('Character One', 'Legendary Creature — Mutant', ['U'], 'Partner—Character select', ['Partner—Character select']);
  const second = card('Character Two', 'Legendary Creature — Mutant', ['B'], 'Partner—Character select', ['Partner—Character select']);
  const plain = card('Plain Partner', 'Legendary Creature — Human', ['R'], 'Partner');
  const wastes = card('Wastes', 'Basic Land', []);

  const validDeck = parseDecklist(`
// COMMANDER
1 Character One
1 Character Two
// MAIN
98 Wastes
`);
  const valid = validateCommanderDeck(validDeck, [first, second, wastes]);
  assert.equal(valid.pairing.method, 'Partner—Character select');
  assert.equal(valid.commanderColorIdentityLabel, 'UB');

  const mixedDeck = parseDecklist(`
// COMMANDER
1 Character One
1 Plain Partner
// MAIN
98 Wastes
`);
  const mixed = validateCommanderDeck(mixedDeck, [first, plain, wastes]);
  assert.equal(mixed.pairing.legal, false);
});
