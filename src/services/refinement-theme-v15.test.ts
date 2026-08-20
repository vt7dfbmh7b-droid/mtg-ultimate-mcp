import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  auditNeutralThemeV15,
  type NeutralThemeIntentV15,
} from './neutral-theme-v15.js';

function card(name: string, typeLine: string): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    lang: 'en',
    oracle_id: `${name}-oracle`,
    name,
    set: 'tst',
    set_name: 'Test Set',
    collector_number: String(Math.max(1, name.length)),
    released_at: '2026-01-01',
    type_line: typeLine,
    oracle_text: '',
    mana_cost: '{2}',
    cmc: 2,
    colors: [],
    color_identity: [],
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
    scryfall_uri: `https://scryfall.com/search?q=${encodeURIComponent(name)}`,
  } as ScryfallCard;
}

const artifactIntent: NeutralThemeIntentV15 = {
  original: 'artifacts',
  normalizedInput: 'artifacts',
  kind: 'card-type',
  enforceability: 'full',
  canonicalLabel: 'Artifacts',
  queryClause: 't:artifact',
  minimumMainMatches: 3,
  printingFamily: null,
  matchRule: { type: 'card-type', cardType: 'artifact' },
  explanation: 'Synthetic deterministic test intent.',
};

function entries(artifactCount: number, creatureCount: number): Array<{ card: ScryfallCard; quantity: number; zone: 'commander' | 'main' }> {
  return [
    { card: card('Test Commander', 'Legendary Creature — Human Artificer'), quantity: 1, zone: 'commander' },
    ...Array.from({ length: artifactCount }, (_, index) => ({
      card: card(`Artifact ${index + 1}`, 'Artifact'),
      quantity: 1,
      zone: 'main' as const,
    })),
    ...Array.from({ length: creatureCount }, (_, index) => ({
      card: card(`Creature ${index + 1}`, 'Creature — Human'),
      quantity: 1,
      zone: 'main' as const,
    })),
  ];
}

test('controlled theme audit is satisfied exactly at the required main-deck density', () => {
  const audit = auditNeutralThemeV15(entries(3, 2), artifactIntent);

  assert.equal(audit.status, 'satisfied');
  assert.equal(audit.satisfied, true);
  assert.equal(audit.matchedMainCards, 3);
  assert.equal(audit.requiredMainMatches, 3);
  assert.equal(audit.totalMainCards, 5);
  assert.equal(audit.mainCoverage, 0.6);
});

test('controlled theme audit fails closed when a candidate deck drops below the minimum', () => {
  const before = auditNeutralThemeV15(entries(3, 2), artifactIntent);
  const after = auditNeutralThemeV15(entries(2, 3), artifactIntent);

  assert.equal(before.satisfied, true);
  assert.equal(after.status, 'under-minimum');
  assert.equal(after.satisfied, false);
  assert.equal(after.matchedMainCards, 2);
});

test('an under-minimum deck can measurably advance theme density without being falsely called compliant', () => {
  const before = auditNeutralThemeV15(entries(1, 4), artifactIntent);
  const after = auditNeutralThemeV15(entries(2, 3), artifactIntent);

  assert.equal(before.satisfied, false);
  assert.equal(after.satisfied, false);
  assert.ok(after.matchedMainCards > before.matchedMainCards);
  assert.equal(after.status, 'under-minimum');
});

test('printing-family theme requires both the matching active family and an independently passing printing policy', () => {
  const intent: NeutralThemeIntentV15 = {
    original: 'Final Fantasy',
    normalizedInput: 'final fantasy',
    kind: 'printing-family',
    enforceability: 'delegated-printing-policy',
    canonicalLabel: 'Final Fantasy physical printings',
    queryClause: null,
    minimumMainMatches: 0,
    printingFamily: 'Final Fantasy',
    matchRule: { type: 'printing-family', family: 'Final Fantasy' },
    explanation: 'Synthetic deterministic printing-family intent.',
  };
  const deckEntries = entries(0, 5);

  const passed = auditNeutralThemeV15(deckEntries, intent, {
    activePrintingFamily: 'Final Fantasy',
    printingPolicySatisfied: true,
  });
  const wrongFamily = auditNeutralThemeV15(deckEntries, intent, {
    activePrintingFamily: 'Universes Beyond',
    printingPolicySatisfied: true,
  });
  const failedPrintingTruth = auditNeutralThemeV15(deckEntries, intent, {
    activePrintingFamily: 'Final Fantasy',
    printingPolicySatisfied: false,
  });

  assert.equal(passed.satisfied, true);
  assert.equal(wrongFamily.satisfied, false);
  assert.equal(failedPrintingTruth.satisfied, false);
});
