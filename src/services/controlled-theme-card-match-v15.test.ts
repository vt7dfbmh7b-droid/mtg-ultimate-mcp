import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { cardMatchesControlledThemeClauseV15 } from './controlled-theme-card-match-v15.js';

function card(name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/\s+/g, '-'),
    oracle_id: `oracle-${name.toLocaleLowerCase().replace(/\s+/g, '-')}`,
    name,
    lang: 'en',
    cmc: 2,
    type_line: 'Creature — Human',
    oracle_text: '',
    color_identity: ['G'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'common',
    prices: {},
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
    ...overrides,
  };
}

test('resolved typal cards classify directly even when no candidate-search membership exists', () => {
  const merfolk = card('Stock Merfolk Engine', { type_line: 'Creature — Merfolk Wizard' });
  assert.equal(cardMatchesControlledThemeClauseV15(merfolk, 't:"Merfolk"'), true);
});

test('changeling preserves verified typal identity without becoming every card or noncreature subtype', () => {
  const changeling = card('Adaptive Changeling', { type_line: 'Creature — Shapeshifter', keywords: ['Changeling'] });
  assert.equal(cardMatchesControlledThemeClauseV15(changeling, 't:"Merfolk"'), true);
  assert.equal(cardMatchesControlledThemeClauseV15(changeling, 't:"Knight"'), true);
  assert.equal(cardMatchesControlledThemeClauseV15(changeling, 't:artifact'), false);
  assert.equal(cardMatchesControlledThemeClauseV15(changeling, 't:enchantment'), false);
  assert.equal(cardMatchesControlledThemeClauseV15(changeling, 't:equipment'), false);
  assert.equal(cardMatchesControlledThemeClauseV15(changeling, 't:aura'), false);
});

test('oracle every-creature-type text follows the same verified typal boundary', () => {
  const everyType = card('Every Type', { oracle_text: 'This card is every creature type.' });
  assert.equal(cardMatchesControlledThemeClauseV15(everyType, 't:"Elf"'), true);
  assert.equal(cardMatchesControlledThemeClauseV15(everyType, 't:artifact'), false);
});

test('controlled mechanical and card-type clauses classify contrasting Commander mechanisms', () => {
  const counters = card('Counter Engine', { oracle_text: 'Put a +1/+1 counter on target creature, then proliferate.' });
  const aura = card('Stock Aura', { type_line: 'Enchantment — Aura' });
  const artifact = card('Stock Artifact', { type_line: 'Artifact Creature — Construct' });

  assert.equal(cardMatchesControlledThemeClauseV15(counters, 'o:"+1/+1 counter"'), true);
  assert.equal(cardMatchesControlledThemeClauseV15(counters, 'o:proliferate'), true);
  assert.equal(cardMatchesControlledThemeClauseV15(aura, 't:enchantment'), true);
  assert.equal(cardMatchesControlledThemeClauseV15(artifact, 't:artifact'), true);
});

test('controlled OR and implicit AND semantics match the resolver grammar rather than search ranking', () => {
  const equipment = card('Equipment Piece', { type_line: 'Artifact — Equipment', oracle_text: 'Equipped creature gets +2/+2. Equip {2}' });
  const lifegain = card('Life Engine', { oracle_text: 'Whenever another creature enters, you gain 1 life.' });
  const falseGain = card('Resource Engine', { oracle_text: 'Gain control of target artifact.' });

  assert.equal(cardMatchesControlledThemeClauseV15(equipment, '(t:equipment OR o:equip)'), true);
  assert.equal(cardMatchesControlledThemeClauseV15(lifegain, '(o:gain o:life)'), true);
  assert.equal(cardMatchesControlledThemeClauseV15(falseGain, '(o:gain o:life)'), false);
});

test('unsupported Scryfall grammar fails closed instead of becoming a general query parser', () => {
  const cardDraw = card('Draw Engine', { oracle_text: 'Draw two cards.' });
  assert.equal(cardMatchesControlledThemeClauseV15(cardDraw, 'mv<=2 o:draw'), false);
  assert.equal(cardMatchesControlledThemeClauseV15(cardDraw, 'order:edhrec'), false);
  assert.equal(cardMatchesControlledThemeClauseV15(cardDraw, 'o:draw -t:land'), false);
});
