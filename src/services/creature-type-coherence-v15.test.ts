import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import {
  cardCreatureTypeCoherenceScoreV15,
  deriveCreatureTypePreferencesV15,
} from './creature-type-coherence-v15.js';

function card(name: string, typeLine: string, oracleText: string, cmc = 2): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${name}-oracle`,
    lang: 'en',
    name,
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    released_at: '2026-01-01',
    type_line: typeLine,
    oracle_text: oracleText,
    mana_cost: '',
    cmc,
    colors: [],
    color_identity: ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'rare',
    prices: { usd: '1.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: 'https://scryfall.com',
  } as ScryfallCard;
}

test('commander-created creature type plus explicit dependency outranks a merely present subtype', () => {
  const commander = card(
    'Test Liliana',
    'Legendary Creature — Human Cleric // Legendary Planeswalker — Liliana',
    'Whenever another nontoken creature you control dies, exile this permanent, then return it transformed. When you do, create a 2/2 black Zombie creature token.',
    3,
  );
  const gravecrawler = card(
    'Test Gravecrawler',
    'Creature — Zombie',
    'You may cast this card from your graveyard as long as you control a Zombie.',
    1,
  );
  const skeleton = card(
    'Test Skeleton',
    'Creature — Skeleton Warrior',
    '{1}{B}: Return this card from your graveyard to the battlefield tapped.',
    2,
  );
  const parsed = parseDecklist('// COMMANDER\n1 Test Liliana\n// MAIN\n1 Test Gravecrawler\n1 Test Skeleton');
  const preferences = deriveCreatureTypePreferencesV15(parsed, [commander, gravecrawler, skeleton]);
  assert.equal(preferences[0]?.creatureType, 'Zombie');
  assert.equal(preferences[0]?.commanderCreatesType, true);
  assert.ok((preferences[0]?.score ?? 0) > (preferences.find((row) => row.creatureType === 'Skeleton')?.score ?? 0));
});

test('preferred-type sacrifice outlet receives coherence value while a random body does not', () => {
  const preference = {
    creatureType: 'Zombie',
    score: 15,
    existingCreatureCount: 1,
    commanderPrintedType: false,
    commanderCreatesType: true,
    supportReferenceCount: 1,
    evidence: [],
  };
  const outlet = card('Zombie Outlet', 'Creature — Zombie', 'Sacrifice a creature: Put a +1/+1 counter on this creature.', 1);
  const vanilla = card('Zombie Vanilla', 'Creature — Zombie', 'Menace', 2);
  assert.ok(cardCreatureTypeCoherenceScoreV15(outlet, preference).score > 0);
  assert.equal(cardCreatureTypeCoherenceScoreV15(vanilla, preference).score, 0);
});
