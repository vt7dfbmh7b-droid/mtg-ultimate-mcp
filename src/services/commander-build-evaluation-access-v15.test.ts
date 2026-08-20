import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import {
  derivePostBuildEvidenceV15,
  deriveWinRouteAccessAuditsV15,
  type PostBuildEvidenceInputV15,
} from './commander-build-evaluation-v15.js';

let collector = 1;
function card(name: string, typeLine: string, oracleText = ''): ScryfallCard {
  return {
    id: `id-${collector}`,
    oracle_id: `oracle-${collector}`,
    name,
    lang: 'en',
    mana_cost: '{2}',
    cmc: 2,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

function baseEvidence(combos: Record<string, unknown>): PostBuildEvidenceInputV15 {
  return {
    commanderLegal: true,
    exactCardCount: true,
    fullyResolved: true,
    printingPolicyCompliant: true,
    averageNonlandManaValue: 2.3,
    earlyPlayCount: 35,
    fastManaCount: 4,
    freeInteractionCount: 2,
    cheapInteractionCount: 9,
    tutorCount: 1,
    gameChangerNames: [],
    commanderNames: ['Commander'],
    spellbookBracket: { sourceStatus: 'available', bracketTag: 'R', strategicallyRelevantCombos: [] },
    combos,
    efficientWinPlanSupported: false,
  };
}

test('finished-deck winning evidence feeds commander-aware exact tutor access without changing closure truth', () => {
  const evidence = derivePostBuildEvidenceV15(baseEvidence({
    sourceStatus: 'available',
    verificationComplete: true,
    counts: { included: 1 },
    included: [{
      id: 'commander-line',
      bracketTag: 'R',
      cards: [
        { name: 'Commander', quantity: 1, mustBeCommander: true },
        { name: 'Piece B', quantity: 1, mustBeCommander: false },
      ],
      results: ['Each opponent loses the game'],
      requirements: [],
    }],
  }));
  assert.equal(evidence.verifiedWinningCombos, 1);

  const parsed = parseDecklist([
    '// COMMANDER',
    '1 Commander',
    '// MAIN',
    '1 Piece B',
    '1 Universal Tutor',
    '97 Filler',
  ].join('\n'));
  const audits = deriveWinRouteAccessAuditsV15(evidence.verifiedWinningComboDetails, parsed, [
    card('Commander', 'Legendary Creature — Wizard'),
    card('Piece B', 'Artifact'),
    card('Universal Tutor', 'Sorcery', 'Search your library for a card, put that card into your hand, then shuffle.'),
  ]);

  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0]?.commandZonePieces, ['Commander']);
  assert.deepEqual(audits[0]?.libraryPieces, ['Piece B']);
  assert.equal(audits[0]?.distinctTutorCoverage.allLibraryPiecesFetchableFromDistinctTutors, true);
  assert.ok(audits[0]?.exactAccess);
});

test('non-winning Spellbook rows never enter the route-access layer', () => {
  const evidence = derivePostBuildEvidenceV15(baseEvidence({
    sourceStatus: 'available',
    verificationComplete: true,
    counts: { included: 1 },
    included: [{
      id: 'mana-only',
      bracketTag: 'R',
      cards: [{ name: 'Piece A', quantity: 1, mustBeCommander: false }],
      results: ['Infinite mana'],
      requirements: [],
    }],
  }));
  const parsed = parseDecklist('// COMMANDER\n1 Commander\n// MAIN\n1 Piece A\n98 Filler');
  const audits = deriveWinRouteAccessAuditsV15(evidence.verifiedWinningComboDetails, parsed, [
    card('Commander', 'Legendary Creature — Wizard'),
    card('Piece A', 'Artifact'),
  ]);

  assert.equal(evidence.verifiedWinningCombos, 0);
  assert.deepEqual(audits, []);
});
