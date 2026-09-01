import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { cedhMarginalCandidateScoreV14, winningComboCoreCountV14 } from './cedh-efficiency-v14.js';

function card(input: {
  name: string;
  typeLine: string;
  oracleText: string;
  cmc: number;
  manaCost: string;
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
    colors: [],
    color_identity: ['B'],
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
    scryfall_uri: 'https://scryfall.com',
  } as ScryfallCard;
}

const carrionFeeder = card({
  name: 'Carrion Feeder',
  typeLine: 'Creature — Zombie',
  oracleText: "Carrion Feeder can't block. Sacrifice a creature: Put a +1/+1 counter on Carrion Feeder.",
  cmc: 1,
  manaCost: '{B}',
});

const bloodArtist = card({
  name: 'Blood Artist',
  typeLine: 'Creature — Vampire',
  oracleText: 'Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.',
  cmc: 2,
  manaCost: '{1}{B}',
});

function comboEvidence(combos: Array<{ cards: string[]; results?: string[] }>): Record<string, unknown> {
  return {
    counts: { included: combos.length },
    included: combos.map((combo, index) => ({
      id: `combo-${index}`,
      cards: combo.cards.map((name) => ({ name, quantity: 1, mustBeCommander: false })),
      results: combo.results ?? ['Each opponent loses the game'],
      requirements: [],
    })),
  };
}

test('the ninth sacrifice outlet has much less marginal value than an outlet before saturation', () => {
  const unsaturated = cedhMarginalCandidateScoreV14(carrionFeeder, 220, { 'sacrifice outlet': 5 });
  const saturated = cedhMarginalCandidateScoreV14(carrionFeeder, 220, { 'sacrifice outlet': 8 });
  const verySaturated = cedhMarginalCandidateScoreV14(carrionFeeder, 220, { 'sacrifice outlet': 10 });

  assert.equal(unsaturated.score, 220);
  assert.ok(saturated.score <= 95, `expected saturated score <= 95, got ${saturated.score}`);
  assert.ok(verySaturated.score < saturated.score);
  assert.ok(saturated.penalties.some((reason) => reason.includes('sacrifice outlet already covered')));
});

test('a needed drain payoff is not penalized merely because sacrifice outlets are saturated', () => {
  const result = cedhMarginalCandidateScoreV14(bloodArtist, 150, {
    'sacrifice outlet': 10,
    'life drain': 3,
  });
  assert.equal(result.score, 150);
  assert.deepEqual(result.penalties, []);
});

test('transitive bridge combos do not collapse two pairwise-disjoint winning routes into one core', () => {
  const evidence = comboEvidence([
    { cards: ['A', 'B'] },
    { cards: ['B', 'C'] },
    { cards: ['C', 'D'] },
  ]);
  assert.equal(winningComboCoreCountV14(evidence), 2);
});

test('variants sharing the same lynchpin still count as one independent winning core', () => {
  const evidence = comboEvidence([
    { cards: ['Lynchpin', 'Finish A'] },
    { cards: ['Lynchpin', 'Finish B'] },
  ]);
  assert.equal(winningComboCoreCountV14(evidence), 1);
});
