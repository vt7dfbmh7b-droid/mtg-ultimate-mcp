import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { auditWinRouteAccessV15 } from './win-route-access-v15.js';

let collector = 1;
function card(
  name: string,
  typeLine: string,
  oracleText = '',
  cmc = 2,
  priceUsd: string | null = '1.00',
): ScryfallCard {
  return {
    id: `id-${collector}`,
    oracle_id: `oracle-${collector}`,
    name,
    lang: 'en',
    mana_cost: cmc > 0 ? `{${cmc}}` : '',
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: priceUsd },
    scryfall_uri: 'https://scryfall.com',
  };
}

function commander(): ScryfallCard {
  return card('Commander', 'Legendary Creature — Wizard', 'Whenever you cast a spell, scry 1.', 2);
}

function deck(entries: Array<[number, string]>) {
  const used = entries.reduce((sum, [quantity]) => sum + quantity, 0);
  if (used > 99) throw new Error('test deck has too many main-deck cards');
  const filler = 99 - used;
  return parseDecklist([
    '// COMMANDER',
    '1 Commander',
    '// MAIN',
    ...entries.map(([quantity, name]) => `${quantity} ${name}`),
    ...(filler > 0 ? [`${filler} Filler`] : []),
  ].join('\n'));
}

const universalTutorText = 'Search your library for a card, put that card into your hand, then shuffle.';
const creatureTutorText = 'Search your library for a creature card, put that card into your hand, then shuffle.';
const artifactTutorText = 'Search your library for an artifact card, put that card into your hand, then shuffle.';

test('one universal tutor cannot cover two simultaneously missing library pieces', () => {
  const parsed = deck([[1, 'Piece A'], [1, 'Piece B'], [1, 'Universal Tutor']]);
  const result = auditWinRouteAccessV15({
    route: { comboId: 'two-piece', comboCardNames: ['Piece A', 'Piece B'] },
    parsed,
    resolvedCards: [
      commander(),
      card('Piece A', 'Artifact'),
      card('Piece B', 'Creature — Wizard'),
      card('Universal Tutor', 'Sorcery', universalTutorText, 2, '55.00'),
    ],
  });

  assert.equal(result.status, 'exact-card-access');
  assert.equal(result.distinctTutorCoverage.requiredLibraryPieces, 2);
  assert.equal(result.distinctTutorCoverage.maxMissingLibraryPiecesFetchableByDistinctTutors, 1);
  assert.equal(result.distinctTutorCoverage.allLibraryPiecesFetchableFromDistinctTutors, false);
  assert.deepEqual(result.tutors[0]?.coversPieces, ['Piece A', 'Piece B']);
  assert.equal(result.tutors[0]?.observedUsd, 55);
  assert.ok(result.exactAccess);
  assert.deepEqual(result.exactAccess?.checkpoints.map((entry) => entry.label), ['opening-hand', 'turn-3', 'turn-5']);
});

test('a command-zone combo piece is guaranteed separately and is not charged as a library requirement', () => {
  const parsed = deck([[1, 'Piece B'], [1, 'Universal Tutor']]);
  const result = auditWinRouteAccessV15({
    route: { comboId: 'commander-plus-b', comboCardNames: ['Commander', 'Piece B'] },
    parsed,
    resolvedCards: [commander(), card('Piece B', 'Artifact'), card('Universal Tutor', 'Sorcery', universalTutorText)],
  });

  assert.deepEqual(result.commandZonePieces, ['Commander']);
  assert.deepEqual(result.libraryPieces, ['Piece B']);
  assert.equal(result.distinctTutorCoverage.requiredLibraryPieces, 1);
  assert.equal(result.distinctTutorCoverage.maxMissingLibraryPiecesFetchableByDistinctTutors, 1);
  assert.equal(result.distinctTutorCoverage.allLibraryPiecesFetchableFromDistinctTutors, true);
  assert.ok((result.exactAccess?.checkpoints[0]?.probability.decimal ?? 0) > 0);
});

test('universal plus restricted tutors use a distinct matching across different route pieces', () => {
  const parsed = deck([
    [1, 'Artifact Piece'],
    [1, 'Creature Piece'],
    [1, 'Universal Tutor'],
    [1, 'Creature Tutor'],
  ]);
  const result = auditWinRouteAccessV15({
    route: { comboId: 'mixed-route', comboCardNames: ['Artifact Piece', 'Creature Piece'] },
    parsed,
    resolvedCards: [
      commander(),
      card('Artifact Piece', 'Artifact'),
      card('Creature Piece', 'Creature — Wizard'),
      card('Universal Tutor', 'Sorcery', universalTutorText),
      card('Creature Tutor', 'Sorcery', creatureTutorText),
    ],
  });

  assert.equal(result.distinctTutorCoverage.maxMissingLibraryPiecesFetchableByDistinctTutors, 2);
  assert.equal(result.distinctTutorCoverage.allLibraryPiecesFetchableFromDistinctTutors, true);
  assert.deepEqual(result.pieces.find((entry) => entry.pieceName === 'Artifact Piece')?.qualifyingTutorNames, ['Universal Tutor']);
  assert.deepEqual(
    result.pieces.find((entry) => entry.pieceName === 'Creature Piece')?.qualifyingTutorNames,
    ['Creature Tutor', 'Universal Tutor'],
  );
});

test('two restricted tutors that both find only the same piece cannot cover a two-piece route', () => {
  const parsed = deck([
    [1, 'Artifact Piece'],
    [1, 'Creature Piece'],
    [1, 'Creature Tutor One'],
    [1, 'Creature Tutor Two'],
  ]);
  const result = auditWinRouteAccessV15({
    route: { comboId: 'scarce-artifact', comboCardNames: ['Artifact Piece', 'Creature Piece'] },
    parsed,
    resolvedCards: [
      commander(),
      card('Artifact Piece', 'Artifact'),
      card('Creature Piece', 'Creature — Wizard'),
      card('Creature Tutor One', 'Sorcery', creatureTutorText),
      card('Creature Tutor Two', 'Sorcery', creatureTutorText),
    ],
  });

  assert.equal(result.distinctTutorCoverage.maxMissingLibraryPiecesFetchableByDistinctTutors, 1);
  assert.equal(result.distinctTutorCoverage.allLibraryPiecesFetchableFromDistinctTutors, false);
});

test('graveyard and top-deck tutors are audited but excluded from conservative direct access', () => {
  const parsed = deck([
    [1, 'Creature Piece'],
    [1, 'Grave Tutor'],
    [1, 'Top Tutor'],
  ]);
  const result = auditWinRouteAccessV15({
    route: { comboId: 'zone-sensitive', comboCardNames: ['Creature Piece'] },
    parsed,
    resolvedCards: [
      commander(),
      card('Creature Piece', 'Creature — Wizard'),
      card('Grave Tutor', 'Sorcery', 'Search your library for a creature card, put that card into your graveyard, then shuffle.'),
      card('Top Tutor', 'Sorcery', 'Search your library for a creature card, put that card on top of your library, then shuffle.'),
    ],
  });

  assert.deepEqual(result.tutors.map((entry) => [entry.tutorName, entry.destination, entry.use]), [
    ['Grave Tutor', 'graveyard', 'conditional-destination'],
    ['Top Tutor', 'top', 'conditional-destination'],
  ]);
  assert.equal(result.distinctTutorCoverage.maxMissingLibraryPiecesFetchableByDistinctTutors, 0);
  assert.deepEqual(
    result.pieces.find((entry) => entry.pieceName === 'Creature Piece')?.conditionalTutorNames,
    ['Grave Tutor', 'Top Tutor'],
  );
});

test('unsupported tutor restrictions fail closed instead of becoming fake universal access', () => {
  const parsed = deck([
    [1, 'Creature Piece'],
    [1, 'Power Tutor'],
    [1, 'Named Tutor'],
  ]);
  const result = auditWinRouteAccessV15({
    route: { comboId: 'unsupported-restrictions', comboCardNames: ['Creature Piece'] },
    parsed,
    resolvedCards: [
      commander(),
      card('Creature Piece', 'Creature — Wizard'),
      card('Power Tutor', 'Sorcery', 'Search your library for a creature card with power 2 or less, reveal it, put it into your hand, then shuffle.'),
      card('Named Tutor', 'Sorcery', 'Search your library for a card named Creature Piece, reveal it, put it into your hand, then shuffle.'),
    ],
  });

  assert.equal(result.distinctTutorCoverage.maxMissingLibraryPiecesFetchableByDistinctTutors, 0);
  assert.deepEqual(result.tutors.map((entry) => entry.use), ['unsupported-or-ambiguous', 'unsupported-or-ambiguous']);
  assert.deepEqual(result.tutors.map((entry) => entry.coversPieces), [[], []]);
});

test('artifact tutor does not fabricate coverage for a creature piece', () => {
  const parsed = deck([[1, 'Creature Piece'], [1, 'Artifact Tutor']]);
  const result = auditWinRouteAccessV15({
    route: { comboId: 'wrong-type', comboCardNames: ['Creature Piece'] },
    parsed,
    resolvedCards: [commander(), card('Creature Piece', 'Creature — Wizard'), card('Artifact Tutor', 'Sorcery', artifactTutorText)],
  });

  assert.equal(result.tutors[0]?.use, 'not-route-relevant');
  assert.equal(result.distinctTutorCoverage.maxMissingLibraryPiecesFetchableByDistinctTutors, 0);
});

test('an unresolved verified route piece stays unknown rather than becoming zero-access evidence', () => {
  const parsed = deck([[1, 'Known Piece'], [1, 'Missing Piece'], [1, 'Universal Tutor']]);
  const result = auditWinRouteAccessV15({
    route: { comboId: 'missing-oracle', comboCardNames: ['Known Piece', 'Missing Piece'] },
    parsed,
    resolvedCards: [commander(), card('Known Piece', 'Artifact'), card('Universal Tutor', 'Sorcery', universalTutorText)],
  });

  assert.equal(result.status, 'unknown-missing-piece');
  assert.deepEqual(result.missingPieces, ['Missing Piece']);
  assert.equal(result.exactAccess, null);
});

test('template requirements remain explicitly outside the card-only exact probability', () => {
  const parsed = deck([[1, 'Piece A']]);
  const result = auditWinRouteAccessV15({
    route: {
      comboId: 'templated',
      comboCardNames: ['Piece A'],
      dependencyCompleteness: 'template-requirements-present',
    },
    parsed,
    resolvedCards: [commander(), card('Piece A', 'Artifact')],
  });

  assert.ok(result.exactAccess?.caveat.includes('Provider template requirements'));
});
