import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildDeckMetrics, parseDecklist } from './deck.js';
import { effectiveCardRolesV15, tutorRoleTruthV15 } from './card-role-truth-v15.js';
import { inferCardRoles } from './scryfall.js';

function card(name: string, oracleText: string, cmc = 2, typeLine = 'Sorcery'): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${name}-oracle`,
    lang: 'en',
    name,
    set: 'tst',
    set_name: 'Tutor Truth Test',
    collector_number: '1',
    released_at: '2026-01-01',
    type_line: typeLine,
    oracle_text: oracleText,
    mana_cost: cmc === 0 ? '{0}' : `{${cmc}}`,
    cmc,
    colors: [],
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'uncommon',
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

const deterministicTutor = card(
  'Unnamed Deterministic Tutor',
  'Search your library for a card, put that card into your hand, then shuffle.',
  2,
);

const lotteryTutor = card(
  'Unnamed Lottery Tutor',
  '{4}, {T}, Sacrifice this artifact: Roll a d20.\n1–9 | You lose 3 life.\n10–19 | Draw two cards.\n20 | Search your library for a card, put that card into your hand, then shuffle.',
  3,
  'Artifact',
);

const deterministicCreatureTutor = card(
  'Unnamed Creature Tutor',
  'Search your library for a creature card, reveal it, put it into your hand, then shuffle.',
  2,
);

test('lottery-gated library searches remain descriptively visible but do not count as structural tutors', () => {
  assert.equal(inferCardRoles(lotteryTutor).includes('tutor'), true, 'raw text inference may still describe the search ability');
  const truth = tutorRoleTruthV15(lotteryTutor);
  assert.equal(truth.searchesLibrary, true);
  assert.equal(truth.randomOutcomeGated, true);
  assert.equal(truth.reliableStructuralTutor, false);

  const roles = effectiveCardRolesV15(lotteryTutor);
  assert.equal(roles.includes('tutor'), false);
  assert.equal(roles.includes('random tutor'), true);
});

test('deterministic generic and broad creature tutors retain structural tutor truth', () => {
  for (const candidate of [deterministicTutor, deterministicCreatureTutor]) {
    const truth = tutorRoleTruthV15(candidate);
    assert.equal(truth.randomOutcomeGated, false);
    assert.equal(truth.reliableStructuralTutor, true);
    assert.equal(effectiveCardRolesV15(candidate).includes('tutor'), true);
  }
});

test('deck tutor metrics count reliable access but not lottery outcomes', () => {
  const parsed = parseDecklist([
    '1 Unnamed Deterministic Tutor',
    '1 Unnamed Lottery Tutor',
  ].join('\n'));
  const metrics = buildDeckMetrics(parsed, [deterministicTutor, lotteryTutor]);
  assert.equal(metrics.tutorCount, 1);
  assert.equal(metrics.roleCounts.tutor, 1);
  assert.equal(metrics.roleCounts['random tutor'], 1);
});
