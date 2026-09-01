import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  criticalRoleFloorsPreservedV14,
  isBroadTutorV14,
  strictCedhQualityV14,
} from './cedh-efficiency-v14.js';
import { winPlanBlockedByExclusionsV14 } from './cedh-win-package-v14.js';

function card(input: {
  name: string;
  typeLine: string;
  oracleText: string;
  cmc: number;
  manaCost: string;
  edhrecRank?: number;
}): ScryfallCard {
  return {
    id: input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${input.name}-oracle`,
    lang: 'en',
    name: input.name,
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    released_at: '2026-01-01',
    type_line: input.typeLine,
    oracle_text: input.oracleText,
    mana_cost: input.manaCost,
    cmc: input.cmc,
    colors: ['B'],
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
    ...(input.edhrecRank !== undefined ? { edhrec_rank: input.edhrecRank } : {}),
  } as ScryfallCard;
}

const broadTutor = card({
  name: 'Generic Broad Tutor',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  cmc: 2,
  manaCost: '{1}{B}',
  edhrecRank: 500,
});

const restrictedTutor = card({
  name: 'Generic Pyre Tutor',
  typeLine: 'Artifact',
  oracleText: '2, T, Sacrifice a creature: Search your library for a creature card with the same creature type as the sacrificed creature and with mana value equal to 1 plus that creature’s mana value, put that card onto the battlefield, then shuffle. Activate only as a sorcery.',
  cmc: 2,
  manaCost: '{2}',
  edhrecRank: 500,
});

test('restricted search engines do not receive broad tutor truth', () => {
  assert.equal(isBroadTutorV14(broadTutor), true);
  assert.equal(isBroadTutorV14(restrictedTutor), false);
  const quality = strictCedhQualityV14(restrictedTutor, null);
  assert.equal(quality.reasons.includes('cheap broad tutor'), false);
  assert.equal(quality.reasons.includes('restricted tutor does not receive broad-tutor credit'), true);
});

test('critical role floors reject protection collapse and wipe removal', () => {
  const healthy = { protectionCount: 5, roleCounts: { 'board wipe': 2 } } as any;
  const reducedWipes = criticalRoleFloorsPreservedV14(healthy, {
    protectionCount: 4,
    roleCounts: { 'board wipe': 1 },
  } as any);
  assert.equal(reducedWipes.preserved, false);
  assert.match(reducedWipes.reasons.join('\n'), /board wipes fell below preserved floor 2: 2 -> 1/i);
  assert.equal(criticalRoleFloorsPreservedV14(healthy, {
    protectionCount: 4,
    roleCounts: { 'board wipe': 2 },
  } as any).preserved, true);
  assert.equal(criticalRoleFloorsPreservedV14(healthy, {
    protectionCount: 2,
    roleCounts: { 'board wipe': 1 },
  } as any).preserved, false);
  assert.equal(criticalRoleFloorsPreservedV14(healthy, {
    protectionCount: 5,
    roleCounts: { 'board wipe': 0 },
  } as any).preserved, false);
});

test('explicit exclusions block win-package plans even when the combo scores highly', () => {
  assert.equal(winPlanBlockedByExclusionsV14(
    ['Mirkwood Bats', 'Plague of Vermin'],
    ['Plague of Vermin'],
    ['Plague of Vermin'],
  ), true);
  assert.equal(winPlanBlockedByExclusionsV14(
    ['Warren Soultrader', 'Gravecrawler', 'Blood Artist'],
    [],
    ['Plague of Vermin'],
  ), false);
});
