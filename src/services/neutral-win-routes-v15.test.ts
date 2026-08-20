import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { deriveNeutralWinRoutesV15 } from './neutral-win-routes-v15.js';

function card(name: string, oracle: string): ScryfallCard {
  return {
    id: `id-${name}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    cmc: 3,
    type_line: 'Creature — Test',
    oracle_text: oracle,
    color_identity: ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: name.length.toString(),
    rarity: 'rare',
    scryfall_uri: 'https://scryfall.com/card/tst/1/test',
  };
}

test('neutral route derivation keeps inferred archetype as primary even when a verified combo exists', () => {
  const result = deriveNeutralWinRoutesV15({
    archetype: 'combat-tokens',
    cards: [card('Token Maker', 'Whenever this creature attacks, create a 1/1 creature token tapped and attacking.')],
    verifiedWinningCombos: 1,
    efficientWinPlanSupported: false,
  });
  assert.equal(result.primary.kind, 'combat');
  assert.equal(result.backup?.kind, 'verified-combo');
});

test('neutral route derivation does not invent a deterministic combo when none is verified', () => {
  const result = deriveNeutralWinRoutesV15({
    archetype: 'aristocrats',
    cards: [
      card('Drain A', 'Whenever another creature dies, each opponent loses 1 life.'),
      card('Sac A', 'Sacrifice another creature: Draw a card.'),
    ],
    verifiedWinningCombos: 0,
    efficientWinPlanSupported: false,
  });
  assert.equal(result.primary.kind, 'drain');
  assert.notEqual(result.backup?.kind, 'verified-combo');
});

test('independent efficient commander evidence may become the primary route without relying on commander name', () => {
  const result = deriveNeutralWinRoutesV15({
    archetype: 'combat-tokens',
    cards: [],
    verifiedWinningCombos: 0,
    efficientWinPlanSupported: true,
  });
  assert.equal(result.primary.kind, 'commander-engine');
});
