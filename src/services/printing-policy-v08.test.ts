import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  familySetTypeEligibleV08,
  inspectPrintingFamilyPresetV08,
  printingMatchesPolicyV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';

const EVALUATION_DATE = '2026-08-21';

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
    released_at: '2020-01-01',
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
    specialReleaseCoverageAsOf: null,
    specialReleaseCoverageNote: null,
    searchClause: '(set:fin OR set:fic OR set:pfin OR !"Cyclonic Rift" OR !"Silence" OR !"Gilded Lotus")',
    explanation: 'test',
    ...overrides,
  };
}

function unrestrictedPolicy(): ResolvedPrintingPolicyV08 {
  return finalFantasyPolicy({
    family: null,
    familyPreset: null,
    allowedSetCodes: [],
    familyMatchedSetCodes: [],
    exactSpecialPrintings: [],
    specialOracleNames: [],
    searchClause: '',
  });
}

function inspectedPolicy(family: string, allowedSetCodes: string[] = []): ResolvedPrintingPolicyV08 {
  const inspected = inspectPrintingFamilyPresetV08(family);
  assert.ok(inspected, `${family} must resolve to a curated printing-family preset`);
  return {
    family,
    familyPreset: inspected.id,
    allowedSetCodes,
    familyMatchedSetCodes: allowedSetCodes,
    includePromos: true,
    includeSpecialReleases: true,
    exactSpecialPrintings: inspected.specialPrintingSelectors,
    specialOracleNames: [...new Set(inspected.specialPrintingSelectors.map((entry) => entry.oracleName))],
    specialReleaseCoverageAsOf: inspected.specialReleaseCoverageAsOf,
    specialReleaseCoverageNote: inspected.specialReleaseCoverageNote,
    searchClause: 'test',
    explanation: 'test',
  };
}

function hasSelector(family: string, oracleName: string, collectorNumber: string): boolean {
  const inspected = inspectPrintingFamilyPresetV08(family);
  assert.ok(inspected);
  return inspected.specialPrintingSelectors.some((entry) =>
    entry.set === 'sld'
    && entry.collectorNumber === collectorNumber
    && entry.oracleName === oracleName
  );
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

test('release-date truth admits released family printings and rejects future family printings', () => {
  const released = card({ set: 'fin', set_name: 'Magic: The Gathering—FINAL FANTASY', collector_number: '10', released_at: EVALUATION_DATE });
  const future = card({ set: 'fin', set_name: 'Magic: The Gathering—FINAL FANTASY', collector_number: '11', released_at: '2026-08-22' });
  assert.equal(printingMatchesPolicyV08(released, finalFantasyPolicy(), EVALUATION_DATE), true);
  assert.equal(printingMatchesPolicyV08(future, finalFantasyPolicy(), EVALUATION_DATE), false);
});

test('release-date truth gates exact curated specials until release and still rejects unrelated SLD printings', () => {
  const futureSpecial = card({ name: 'Cyclonic Rift', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '1869', promo: true, released_at: '2026-08-22' });
  const releasedSpecial = card({ name: 'Cyclonic Rift', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '1869', promo: true, released_at: '2026-08-20' });
  const unrelated = card({ name: 'Cyclonic Rift', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '9999', promo: true, released_at: '2026-08-20' });
  assert.equal(printingMatchesPolicyV08(futureSpecial, finalFantasyPolicy(), EVALUATION_DATE), false);
  assert.equal(printingMatchesPolicyV08(futureSpecial, finalFantasyPolicy(), '2026-08-22'), true);
  assert.equal(printingMatchesPolicyV08(releasedSpecial, finalFantasyPolicy(), EVALUATION_DATE), true);
  assert.equal(printingMatchesPolicyV08(unrelated, finalFantasyPolicy(), EVALUATION_DATE), false);
});

test('unrestricted physical printing truth also rejects future or undated printings', () => {
  const released = card({ set: 'tst', collector_number: '1', released_at: '2026-08-20' });
  const future = card({ set: 'tst', collector_number: '2', released_at: '2026-08-22' });
  const undated = card({ set: 'tst', collector_number: '3' });
  delete undated.released_at;
  assert.equal(printingMatchesPolicyV08(released, unrestrictedPolicy(), EVALUATION_DATE), true);
  assert.equal(printingMatchesPolicyV08(future, unrestrictedPolicy(), EVALUATION_DATE), false);
  assert.equal(printingMatchesPolicyV08(undated, unrestrictedPolicy(), EVALUATION_DATE), false);
});

test('Marvel is a first-class curated family with released main, bonus, and promo Secret Lair selectors', () => {
  const marvel = inspectPrintingFamilyPresetV08('MTG Marvel');
  assert.ok(marvel);
  assert.equal(marvel.id, 'marvel');
  assert.ok(marvel.specialPrintingCount >= 100);
  assert.equal(marvel.specialReleaseCoverageAsOf, '2026-08-21');
  assert.equal(hasSelector('Marvel', 'Flawless Maneuver', '1728'), true);
  assert.equal(hasSelector('Marvel', 'Nature\'s Lore', '867'), true);
  assert.equal(hasSelector('Marvel', 'Deadly Rollick', '1754'), true);
  assert.equal(hasSelector('Marvel', 'Brainstorm', '7013'), true);
  assert.equal(hasSelector('Marvel', 'Counterspell', '7117'), true);
  assert.equal(hasSelector('Marvel', 'Ponder', '7125'), true);
  assert.equal(hasSelector('Marvel', 'Sol Ring', 'IFIYW-5'), true);
});

test('Marvel policy admits exact themed Secret Lair bonus but rejects unrelated SLD printing of same Oracle card', () => {
  const policy = inspectedPolicy('Marvel', ['mar', 'spm', 'pspm', 'msh', 'msc']);
  const themed = card({ name: 'Brainstorm', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '7013', promo: true });
  const unrelated = card({ name: 'Brainstorm', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '1162', promo: true });
  assert.equal(printingMatchesPolicyV08(themed, policy), true);
  assert.equal(printingMatchesPolicyV08(unrelated, policy), false);
});

test('Marvel special releases can be disabled without opening or closing normal Marvel family sets incorrectly', () => {
  const policy = inspectedPolicy('Marvel', ['msh', 'msc', 'pspm']);
  const noSpecials = { ...policy, includeSpecialReleases: false };
  const special = card({ name: 'Deadly Rollick', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '1754', promo: true });
  const main = card({ name: 'Lightning Greaves', set: 'msc', set_name: 'Marvel Super Heroes Commander', collector_number: '202' });
  assert.equal(printingMatchesPolicyV08(special, noSpecials), false);
  assert.equal(printingMatchesPolicyV08(main, noSpecials), true);
});

test('Middle-earth aliases include both LOTR and Hobbit set patterns with curated Secret Lair truth', () => {
  const middleEarth = inspectPrintingFamilyPresetV08('LOTR');
  assert.ok(middleEarth);
  assert.equal(middleEarth.id, 'middle-earth');
  assert.deepEqual(middleEarth.setNamePatterns, ['middle-earth', 'the hobbit']);
  assert.ok(middleEarth.specialPrintingCount >= 25);
  assert.equal(middleEarth.specialReleaseCoverageAsOf, '2026-08-21');
  assert.equal(hasSelector('Middle Earth', 'Mirror of Galadriel', '1295'), true);
  assert.equal(hasSelector('Middle Earth', 'Gríma Wormtongue', '734'), true);
  assert.equal(hasSelector('Middle Earth', 'Diabolic Intent', '2563'), true);
  assert.equal(hasSelector('Middle Earth', 'Arcane Signet', '916'), true);
});

test('Middle-earth policy admits exact Hobbit Secret Lair and rejects unrelated SLD printing', () => {
  const policy = inspectedPolicy('Middle Earth', ['ltr', 'ltc', 'pltr', 'pltc', 'hob', 'hoc']);
  const themed = card({ name: 'Diabolic Intent', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '2563', promo: false });
  const unrelated = card({ name: 'Diabolic Intent', set: 'sld', set_name: 'Secret Lair Drop', collector_number: '9999', promo: false });
  assert.equal(printingMatchesPolicyV08(themed, policy), true);
  assert.equal(printingMatchesPolicyV08(unrelated, policy), false);
});

test('family discovery excludes non-playable product set types without excluding real promo/card-bearing products', () => {
  assert.equal(familySetTypeEligibleV08('expansion'), true);
  assert.equal(familySetTypeEligibleV08('commander'), true);
  assert.equal(familySetTypeEligibleV08('promo'), true);
  assert.equal(familySetTypeEligibleV08('eternal'), true);
  assert.equal(familySetTypeEligibleV08('masterpiece'), true);
  assert.equal(familySetTypeEligibleV08('token'), false);
  assert.equal(familySetTypeEligibleV08('memorabilia'), false);
  assert.equal(familySetTypeEligibleV08('minigame'), false);
  assert.equal(familySetTypeEligibleV08('expansion', true), false);
});
