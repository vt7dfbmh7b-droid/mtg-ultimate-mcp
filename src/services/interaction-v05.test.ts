import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { analyzeInteractionProfileV05, evaluateInteractionExchangeV05 } from './interaction-v05.js';

let collector = 1;
function card(name: string, typeLine: string, oracleText: string): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    mana_cost: '{1}{U}',
    cmc: 2,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('hard counter matches a spell on the stack', () => {
  const threat = card('Threat', 'Creature — Dragon', 'Flying');
  const counter = card('Counter', 'Instant', 'Counter target spell.');
  const result = evaluateInteractionExchangeV05(threat, counter, 'stack');
  assert.equal(result.answerAssessment.canInteract, true);
  assert.equal(result.answerAssessment.certainty, 'definite');
});

test('noncreature counter does not match a creature spell', () => {
  const threat = card('Creature Threat', 'Creature — Dragon', 'Flying');
  const counter = card('Narrow Counter', 'Instant', 'Counter target noncreature spell.');
  const result = evaluateInteractionExchangeV05(threat, counter, 'stack');
  assert.equal(result.answerAssessment.canInteract, false);
});

test('soft counter is reported as conditional', () => {
  const threat = card('Threat Spell', 'Sorcery', 'Draw three cards.');
  const counter = card('Tax Counter', 'Instant', 'Counter target spell unless its controller pays {3}.');
  const result = evaluateInteractionExchangeV05(threat, counter, 'stack');
  assert.equal(result.answerAssessment.canInteract, true);
  assert.equal(result.answerAssessment.certainty, 'conditional');
  assert.equal(result.answer.softCounterTax, 3);
});

test('indestructible protects against destroy but not exile', () => {
  const threat = card('Creature', 'Creature — Human', '');
  const destroy = card('Destroy', 'Instant', 'Destroy target creature.');
  const exile = card('Exile', 'Instant', 'Exile target creature.');
  const protect = card('Protect', 'Instant', 'Target creature gains indestructible until end of turn.');

  const vsDestroy = evaluateInteractionExchangeV05(threat, destroy, 'battlefield', protect);
  const vsExile = evaluateInteractionExchangeV05(threat, exile, 'battlefield', protect);
  assert.equal(vsDestroy.protectorAssessment.canProtect, true);
  assert.equal(vsDestroy.protectorAssessment.certainty, 'definite');
  assert.equal(vsExile.protectorAssessment.canProtect, false);
});

test('profile detects phasing and hexproof', () => {
  const phase = analyzeInteractionProfileV05(card('Phase', 'Instant', 'Target creature phases out.'));
  const hex = analyzeInteractionProfileV05(card('Hex', 'Instant', 'Target creature gains hexproof until end of turn.'));
  assert.ok(phase.kinds.includes('phase-out'));
  assert.ok(hex.grants.includes('hexproof'));
});
