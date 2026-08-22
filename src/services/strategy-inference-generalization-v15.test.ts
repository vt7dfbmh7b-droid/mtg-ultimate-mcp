import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { inferNeutralStrategyV15 } from './neutral-commander-selection-v15.js';

function commander(oracleText: string): ScryfallCard {
  return {
    id: 'self-mill-recycler',
    oracle_id: 'self-mill-recycler-oracle',
    name: 'Unnamed Self-Mill Recycler',
    lang: 'en',
    cmc: 4,
    type_line: 'Legendary Artifact Creature — Test Construct',
    oracle_text: oracleText,
    color_identity: ['B'],
    keywords: ['Flying'],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: 'https://scryfall.com/card/tst/1/test',
  } as ScryfallCard;
}

test('self-mill recovery outranks an incidental attack trigger without commander-name shortcuts', () => {
  const ranked = inferNeutralStrategyV15([commander(
    'Flying\nWhenever this creature attacks, mill three cards. You may put an artifact creature card from among the cards milled this way into your hand.',
  )]);

  const graveyard = ranked.find((strategy) => strategy.archetype === 'graveyard-reanimator');
  const combat = ranked.find((strategy) => strategy.archetype === 'combat-tokens');

  assert.equal(ranked[0]?.archetype, 'graveyard-reanimator');
  assert.ok((graveyard?.score ?? 0) >= 6, 'self-mill plus recovery must be a substantive graveyard strategy signal');
  assert.ok((combat?.score ?? 0) < 6, 'a generic attack trigger alone must not become a substantive combat-token identity');
  assert.ok(graveyard?.evidence.some((entry) => entry.includes('milled-card recovery')));
});
