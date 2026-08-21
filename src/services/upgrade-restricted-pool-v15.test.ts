import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { restrictedUpgradeCandidatesForRoleV15 } from './upgrade.js';

function card(input: {
  name: string;
  oracleText?: string;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
}): ScryfallCard {
  return {
    id: input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${input.name}-oracle`,
    lang: 'en',
    name: input.name,
    set: 'tst',
    set_name: 'Restricted Test Family',
    collector_number: input.name.replace(/\D/g, '') || '999',
    released_at: '2026-01-01',
    type_line: input.typeLine ?? 'Creature — Test',
    oracle_text: input.oracleText ?? 'Vanilla test text.',
    mana_cost: input.manaCost ?? '{2}',
    cmc: input.cmc ?? 2,
    colors: [],
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'common',
    prices: { usd: '1.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: `https://scryfall.com/card/tst/${encodeURIComponent(input.name)}`,
  } as ScryfallCard;
}

test('restricted Upgrade role selection sees an eligible card beyond the old 40-result role-search window', () => {
  const filler = Array.from({ length: 80 }, (_, index) => card({ name: `Filler ${index + 1}` }));
  const lateFreeInteraction = card({
    name: 'Late Family Free Interaction',
    typeLine: 'Instant',
    manaCost: '{3}{B}',
    cmc: 4,
    oracleText: 'If you control a commander, you may cast this spell without paying its mana cost. Exile target creature.',
  });
  const pool = [...filler, lateFreeInteraction];

  const candidates = restrictedUpgradeCandidatesForRoleV15(pool, 'free-interaction');
  assert.deepEqual(candidates.map((candidate) => candidate.name), ['Late Family Free Interaction']);
  assert.equal(pool.indexOf(lateFreeInteraction) >= 40, true);
});

test('restricted Upgrade pool filtering preserves existing-card, exclusion, land, legality, and role boundaries', () => {
  const eligibleTutor = card({
    name: 'Eligible Tutor',
    typeLine: 'Sorcery',
    oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  });
  const existingTutor = card({
    name: 'Existing Tutor',
    typeLine: 'Sorcery',
    oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  });
  const excludedTutor = card({
    name: 'Excluded Tutor',
    typeLine: 'Sorcery',
    oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  });
  const landTutor = card({
    name: 'Tutor Land',
    typeLine: 'Land',
    oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  });
  const basicRamp = card({
    name: 'Basic Ramp',
    typeLine: 'Sorcery',
    oracleText: 'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
  });
  const illegalTutor = {
    ...eligibleTutor,
    id: 'illegal-tutor',
    oracle_id: 'illegal-tutor-oracle',
    name: 'Illegal Tutor',
    legalities: { ...eligibleTutor.legalities, commander: 'not_legal' },
  } as ScryfallCard;

  const candidates = restrictedUpgradeCandidatesForRoleV15(
    [eligibleTutor, existingTutor, excludedTutor, landTutor, basicRamp, illegalTutor],
    'tutor',
    new Set(['existing tutor']),
    new Set(['excluded tutor']),
  );

  assert.deepEqual(candidates.map((candidate) => candidate.name), ['Eligible Tutor']);
});
