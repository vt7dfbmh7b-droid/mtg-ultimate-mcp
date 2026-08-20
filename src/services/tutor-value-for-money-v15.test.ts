import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { auditTutorValueForMoneyV15 } from './tutor-value-for-money-v15.js';

let collector = 1;
function card(
  name: string,
  typeLine: string,
  oracleText = '',
  options: {
    cmc?: number;
    prices?: Record<string, string | null>;
    finishes?: string[];
    collectorNumber?: string;
  } = {},
): ScryfallCard {
  const collectorNumber = options.collectorNumber ?? String(collector++);
  return {
    id: `id-${name}-${collectorNumber}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    mana_cost: '{1}',
    cmc: options.cmc ?? 1,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: collectorNumber,
    rarity: 'rare',
    finishes: options.finishes ?? ['nonfoil'],
    prices: options.prices ?? { usd: '2.00', usd_foil: null, usd_etched: null },
    scryfall_uri: 'https://scryfall.com',
  };
}

const route = {
  comboId: 'commander-piece-route',
  comboCardNames: ['Commander', 'Piece B'],
  dependencyCompleteness: 'explicit-cards-only' as const,
};

function baseCards(tutor: ScryfallCard): ScryfallCard[] {
  return [
    card('Commander', 'Legendary Creature — Wizard'),
    card('Piece B', 'Artifact'),
    tutor,
  ];
}

test('computes exact positive marginal route access by replacing one tutor with a neutral slot', () => {
  const tutor = card(
    'Universal Tutor',
    'Sorcery',
    'Search your library for a card, put that card into your hand, then shuffle.',
    { prices: { usd: '10.00', usd_foil: null, usd_etched: null } },
  );
  const parsed = parseDecklist([
    '// COMMANDER',
    '1 Commander',
    '// MAIN',
    '1 Piece B',
    '1 Universal Tutor',
    '97 Filler',
  ].join('\n'));
  const result = auditTutorValueForMoneyV15({ route, parsed, resolvedCards: baseCards(tutor) });

  assert.equal(result.status, 'exact-marginal-value');
  assert.equal(result.candidates.length, 1);
  const candidate = result.candidates[0]!;
  assert.equal(candidate.tutorName, 'Universal Tutor');
  assert.equal(candidate.price.priceUsd, 10);
  assert.equal(candidate.price.basis, 'exact-printing-cheapest-known-finish');
  assert.equal(candidate.zeroMarginalAtSelectedCheckpoints, false);
  for (const checkpoint of candidate.exactMarginalAccess) {
    assert.equal(BigInt(checkpoint.exactMarginalProbability.numerator) > 0n, true);
    assert.equal((checkpoint.marginalPercentagePointsPerUsd ?? 0) > 0, true);
  }
});

test('uses the requested exact printing finish instead of a cheaper finish when the deck line specifies foil', () => {
  const tutor = card(
    'Foil Tutor',
    'Sorcery',
    'Search your library for a card, put that card into your hand, then shuffle.',
    {
      prices: { usd: '2.00', usd_foil: '20.00', usd_etched: null },
      finishes: ['nonfoil', 'foil'],
      collectorNumber: '77',
    },
  );
  const parsed = parseDecklist([
    '// COMMANDER',
    '1 Commander',
    '// MAIN',
    '1 Piece B',
    '1 Foil Tutor (TST) 77 *F*',
    '97 Filler',
  ].join('\n'));
  const result = auditTutorValueForMoneyV15({ route, parsed, resolvedCards: baseCards(tutor) });
  const candidate = result.candidates[0]!;

  assert.equal(candidate.price.status, 'available');
  assert.equal(candidate.price.requestedFinish, 'foil');
  assert.equal(candidate.price.pricedFinish, 'foil');
  assert.equal(candidate.price.priceUsd, 20);
  assert.equal(candidate.price.basis, 'exact-printing-requested-finish');
});

test('a cheaper tutor Pareto-dominates an otherwise equivalent expensive tutor without inventing a weighted score', () => {
  const cheap = card(
    'Cheap Universal',
    'Sorcery',
    'Search your library for a card, put that card into your hand, then shuffle.',
    { prices: { usd: '2.00', usd_foil: null, usd_etched: null } },
  );
  const expensive = card(
    'Expensive Universal',
    'Sorcery',
    'Search your library for a card, put that card into your hand, then shuffle.',
    { prices: { usd: '40.00', usd_foil: null, usd_etched: null } },
  );
  const parsed = parseDecklist([
    '// COMMANDER',
    '1 Commander',
    '// MAIN',
    '1 Piece B',
    '1 Cheap Universal',
    '1 Expensive Universal',
    '96 Filler',
  ].join('\n'));
  const resolvedCards = [
    card('Commander', 'Legendary Creature — Wizard'),
    card('Piece B', 'Artifact'),
    cheap,
    expensive,
  ];
  const result = auditTutorValueForMoneyV15({ route, parsed, resolvedCards });
  const cheapResult = result.candidates.find((candidate) => candidate.tutorName === 'Cheap Universal')!;
  const expensiveResult = result.candidates.find((candidate) => candidate.tutorName === 'Expensive Universal')!;

  assert.deepEqual(cheapResult.dominatedByTutorNames, []);
  assert.deepEqual(expensiveResult.dominatedByTutorNames, ['Cheap Universal']);
  for (const label of ['opening-hand', 'turn-3', 'turn-5'] as const) {
    const cheapDelta = cheapResult.exactMarginalAccess.find((checkpoint) => checkpoint.label === label)!.exactMarginalProbability;
    const expensiveDelta = expensiveResult.exactMarginalAccess.find((checkpoint) => checkpoint.label === label)!.exactMarginalProbability;
    assert.equal(
      BigInt(cheapDelta.numerator) * BigInt(expensiveDelta.denominator),
      BigInt(expensiveDelta.numerator) * BigInt(cheapDelta.denominator),
    );
  }
});

test('unknown exact-printing price does not suppress exact marginal access or fabricate cost efficiency', () => {
  const tutor = card(
    'Priceless Tutor',
    'Sorcery',
    'Search your library for a card, put that card into your hand, then shuffle.',
    { prices: { usd: null, usd_foil: null, usd_etched: null } },
  );
  const parsed = parseDecklist([
    '// COMMANDER',
    '1 Commander',
    '// MAIN',
    '1 Piece B',
    '1 Priceless Tutor',
    '97 Filler',
  ].join('\n'));
  const result = auditTutorValueForMoneyV15({ route, parsed, resolvedCards: baseCards(tutor) });
  const candidate = result.candidates[0]!;

  assert.equal(candidate.price.status, 'price-unavailable');
  assert.equal(candidate.price.priceUsd, null);
  assert.equal(candidate.comparisonStatus, 'price-unknown');
  assert.equal(candidate.exactMarginalAccess.some((checkpoint) => BigInt(checkpoint.exactMarginalProbability.numerator) > 0n), true);
  assert.equal(candidate.exactMarginalAccess.every((checkpoint) => checkpoint.marginalPercentagePointsPerUsd === null), true);
});

test('a tutor that cannot directly find a route component is excluded rather than assigned fake value', () => {
  const creatureTutor = card(
    'Creature Tutor',
    'Sorcery',
    'Search your library for a creature card, put that card into your hand, then shuffle.',
    { prices: { usd: '5.00', usd_foil: null, usd_etched: null } },
  );
  const parsed = parseDecklist([
    '// COMMANDER',
    '1 Commander',
    '// MAIN',
    '1 Piece B',
    '1 Creature Tutor',
    '97 Filler',
  ].join('\n'));
  const result = auditTutorValueForMoneyV15({ route, parsed, resolvedCards: baseCards(creatureTutor) });

  assert.equal(result.status, 'no-qualifying-tutors');
  assert.deepEqual(result.candidates, []);
});
