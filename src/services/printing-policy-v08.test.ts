import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  printingMatchesPolicyV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';

function card(overrides: Partial<ScryfallCard>): ScryfallCard {
  return {
    id: 'test',
    name: 'Test Card',
    lang: 'en',
    cmc: 1,
    type_line: 'Instant',
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: 'https://example.invalid/card',
    ...overrides,
  };
}

function finalFantasyPolicy(overrides: Partial<ResolvedPrintingPolicyV08> = {}): ResolvedPrintingPolicyV08 {
  return {
    family: 'Final Fantasy',
    familyPreset: 'final-fantasy',
    allowedSetCodes: ['fin', 'fic', 'pfin'],
    familyMatchedSetCodes: ['fin', 'fic', 'pfin'],
    includePromos: true,
    includeSpecialReleases: true,
    exactSpecialPrintings: [
      { set: 'sld', collectorNumber: '1869', oracleName: 'Cyclonic Rift' },
      { set: 'sld', collectorNumber: '7003', oracleName: 'Silence' },
      { set: 'sld', collectorNumber: '909', oracleName: 'Gilded Lotus' },
    ],
    specialOracleNames: ['Cyclonic Rift', 'Silence', 'Gilded Lotus'],
    searchClause: '(set:fin OR set:fic OR set:pfin OR !"Cyclonic Rift" OR !"Silence" OR !"Gilded Lotus")',
    explanation: 'test',
    ...overrides,
  };
}

test('family set printings qualify even when marked promo by default', () => {
  const printing = card({ set: 'pfin', set_name: 'FINAL FANTASY Promos', collector_number: '42', promo: true });
  assert.equal(printingMatchesPolicyV08(printing, finalFantasyPolicy()), true);
});

test('promos can be explicitly excluded', () => {
  const printing = card({ set: 'pfin', set_name: 'FINAL FANTASY Promos', collector_number: '42', promo: true });
  assert.equal(printingMatchesPolicyV08(printing, finalFantasyPolicy({ includePromos: false })), false);
});

test('curated Final Fantasy Secret Lair printing qualifies without opening all SLD cards', () => {
  const rift = card({ name: 'Cyclonic Rift', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '1869', promo: true });
  const unrelated = card({ name: 'Cyclonic Rift', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '9999', promo: true });
  assert.equal(printingMatchesPolicyV08(rift, finalFantasyPolicy()), true);
  assert.equal(printingMatchesPolicyV08(unrelated, finalFantasyPolicy()), false);
});

test('special releases can be disabled without disabling normal family sets', () => {
  const special = card({ name: 'Silence', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '7003', promo: true });
  const main = card({ name: 'Cloud, Midgar Mercenary', set: 'fin', set_name: 'Magic: The Gathering—FINAL FANTASY', collector_number: '10' });
  const policy = finalFantasyPolicy({ includeSpecialReleases: false, exactSpecialPrintings: [], specialOracleNames: [] });
  assert.equal(printingMatchesPolicyV08(special, policy), false);
  assert.equal(printingMatchesPolicyV08(main, policy), true);
});

test('bundle promo selector treats leading-zero collector numbers as the same physical selector', () => {
  const lotus = card({ name: 'Gilded Lotus', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '0909', promo: true });
  assert.equal(printingMatchesPolicyV08(lotus, finalFantasyPolicy()), true);
});
