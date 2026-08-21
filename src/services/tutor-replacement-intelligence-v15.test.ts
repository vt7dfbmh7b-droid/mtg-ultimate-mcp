import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import type { EligiblePrintingChoiceV08 } from './printing-policy-v08.js';
import {
  auditTutorReplacementsV15,
  type TutorReplacementDependenciesV15,
} from './tutor-replacement-intelligence-v15.js';
import type { WinRouteAccessInputV15 } from './win-route-access-v15.js';

function card(input: {
  name: string;
  typeLine?: string;
  oracleText?: string;
  colorIdentity?: string[];
  price?: string | null;
  set?: string;
  collectorNumber?: string;
}): ScryfallCard {
  const set = input.set ?? 'tst';
  const collectorNumber = input.collectorNumber ?? input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
  return {
    id: `${set}-${collectorNumber}`,
    oracle_id: `${input.name}-oracle`,
    lang: 'en',
    name: input.name,
    set,
    set_name: 'Test Set',
    collector_number: collectorNumber,
    released_at: '2026-01-01',
    type_line: input.typeLine ?? 'Sorcery',
    oracle_text: input.oracleText ?? '',
    mana_cost: '{1}{B}',
    cmc: 2,
    colors: input.colorIdentity ?? ['B'],
    color_identity: input.colorIdentity ?? ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'rare',
    prices: {
      usd: input.price === undefined ? '4.00' : input.price,
      usd_foil: null,
      usd_etched: null,
      eur: null,
      eur_foil: null,
      tix: null,
    },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: `https://scryfall.com/card/${set}/${collectorNumber}`,
  } as ScryfallCard;
}

const commander = card({
  name: 'Route Commander',
  typeLine: 'Legendary Creature — Human Wizard',
  oracleText: 'Test commander.',
  colorIdentity: ['B'],
  price: '1.00',
});
const pieceCreature = card({
  name: 'Combo Creature',
  typeLine: 'Creature — Zombie',
  oracleText: 'A combo component.',
  colorIdentity: ['B'],
  price: '1.00',
});
const pieceArtifact = card({
  name: 'Combo Artifact',
  typeLine: 'Artifact',
  oracleText: 'Another combo component.',
  colorIdentity: [],
  price: '1.00',
});
const sourceTutor = card({
  name: 'Premium Tutor',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  colorIdentity: ['B'],
  price: '40.00',
});
const swamp = card({
  name: 'Swamp',
  typeLine: 'Basic Land — Swamp',
  oracleText: '({T}: Add {B}.)',
  colorIdentity: [],
  price: '0.10',
});

function onePieceDeck(extra: ScryfallCard[] = []): { parsed: ParsedDeck; resolved: ScryfallCard[] } {
  const extraEntries = extra.map((value) => ({
    name: value.name,
    quantity: 1,
    set: value.set.toUpperCase(),
    collectorNumber: value.collector_number,
  }));
  const filler = 97 - extraEntries.length;
  const parsed: ParsedDeck = {
    commanders: [{ name: commander.name, quantity: 1, set: commander.set.toUpperCase(), collectorNumber: commander.collector_number }],
    main: [
      { name: pieceCreature.name, quantity: 1, set: pieceCreature.set.toUpperCase(), collectorNumber: pieceCreature.collector_number },
      { name: sourceTutor.name, quantity: 1, set: sourceTutor.set.toUpperCase(), collectorNumber: sourceTutor.collector_number },
      ...extraEntries,
      { name: swamp.name, quantity: filler, set: swamp.set.toUpperCase(), collectorNumber: swamp.collector_number },
    ],
    totalMain: 99,
    totalCommanders: 1,
    totalCards: 100,
  };
  return { parsed, resolved: [commander, pieceCreature, sourceTutor, swamp, ...extra] };
}

function twoPieceDeck(): { parsed: ParsedDeck; resolved: ScryfallCard[] } {
  const parsed: ParsedDeck = {
    commanders: [{ name: commander.name, quantity: 1, set: commander.set.toUpperCase(), collectorNumber: commander.collector_number }],
    main: [
      { name: pieceCreature.name, quantity: 1, set: pieceCreature.set.toUpperCase(), collectorNumber: pieceCreature.collector_number },
      { name: pieceArtifact.name, quantity: 1, set: pieceArtifact.set.toUpperCase(), collectorNumber: pieceArtifact.collector_number },
      { name: sourceTutor.name, quantity: 1, set: sourceTutor.set.toUpperCase(), collectorNumber: sourceTutor.collector_number },
      { name: swamp.name, quantity: 96, set: swamp.set.toUpperCase(), collectorNumber: swamp.collector_number },
    ],
    totalMain: 99,
    totalCommanders: 1,
    totalCards: 100,
  };
  return { parsed, resolved: [commander, pieceCreature, pieceArtifact, sourceTutor, swamp] };
}

const onePieceRoute: WinRouteAccessInputV15 = {
  comboId: 'route-one',
  comboCardNames: [commander.name, pieceCreature.name],
  dependencyCompleteness: 'explicit-cards-only',
};

const twoPieceRoute: WinRouteAccessInputV15 = {
  comboId: 'route-two',
  comboCardNames: [commander.name, pieceCreature.name, pieceArtifact.name],
  dependencyCompleteness: 'explicit-cards-only',
};

function choice(value: ScryfallCard, priceUsd = 4): EligiblePrintingChoiceV08 {
  return { card: value, finish: 'nonfoil', priceUsd, matchedBy: 'unrestricted' };
}

function dependencies(candidates: ScryfallCard[], prices: Record<string, number | null> = {}): TutorReplacementDependenciesV15 {
  return {
    search: async () => candidates,
    selectEligiblePrinting: async (candidate) => choice(
      candidate,
      Object.hasOwn(prices, candidate.name) ? prices[candidate.name]! : 4,
    ),
  };
}

test('finds a cheaper exact-printing universal tutor with identical exact route access', async () => {
  const cheap = card({
    name: 'Budget Tutor',
    oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
    colorIdentity: ['B'],
    price: '4.00',
  });
  const deck = onePieceDeck();
  const result = await auditTutorReplacementsV15({
    route: onePieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
  }, dependencies([cheap]));

  assert.equal(result.status, 'replacement-options-evaluated');
  assert.equal(result.candidatePool.returnedSearchResults, 1);
  assert.equal(result.sources.length, 1);
  const replacement = result.sources[0]!.replacements[0]!;
  assert.equal(replacement.replacementTutorName, cheap.name);
  assert.equal(replacement.classification, 'access-equivalent-cheaper');
  assert.equal(replacement.priceSavingsUsd, 36);
  assert.equal(replacement.commanderRules.isLegal, true);
  assert.equal(replacement.exactAccess.every((checkpoint) => checkpoint.exactDifference.numerator === '0'), true);
});

test('accepts a cheaper restricted tutor when the existing matcher proves it finds the route piece', async () => {
  const restricted = card({
    name: 'Creature Finder',
    oracleText: 'Search your library for a creature card, reveal it, put it into your hand, then shuffle.',
    colorIdentity: ['B'],
    price: '3.00',
  });
  const deck = onePieceDeck();
  const result = await auditTutorReplacementsV15({
    route: onePieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
  }, dependencies([restricted], { [restricted.name]: 3 }));

  const replacement = result.sources[0]!.replacements[0]!;
  assert.equal(replacement.classification, 'access-equivalent-cheaper');
  assert.deepEqual(replacement.replacementCoversPieces, [pieceCreature.name]);
  assert.equal(replacement.priceSavingsUsd, 37);
});

test('rejects a graveyard-destination tutor rather than treating it as direct route access', async () => {
  const graveyardTutor = card({
    name: 'Burial Tutor',
    oracleText: 'Search your library for a creature card, put that card into your graveyard, then shuffle.',
    colorIdentity: ['B'],
    price: '1.00',
  });
  const deck = onePieceDeck();
  const result = await auditTutorReplacementsV15({
    route: onePieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
  }, dependencies([graveyardTutor], { [graveyardTutor.name]: 1 }));

  assert.equal(result.sources[0]!.replacements.length, 0);
  assert.equal(result.sources[0]!.rejected.some((item) => item.code === 'not-route-qualifying'), true);
});

test('filters a cheaper tutor outside commander color identity before exact-printing evaluation', async () => {
  const blueTutor = card({
    name: 'Blue Tutor',
    oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
    colorIdentity: ['U'],
    price: '1.00',
  });
  const deck = onePieceDeck();
  let printingCalls = 0;
  const result = await auditTutorReplacementsV15({
    route: onePieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
  }, {
    search: async () => [blueTutor],
    selectEligiblePrinting: async (candidate) => {
      printingCalls += 1;
      return choice(candidate, 1);
    },
  });

  assert.equal(printingCalls, 0);
  assert.equal(result.candidatePool.eligibleExactPrintings, 0);
  assert.equal(result.sources[0]!.replacements.length, 0);
});

test('treats printing-policy or exact-budget failure as ineligible rather than weakening constraints', async () => {
  const cheap = card({
    name: 'Wrong Printing Tutor',
    oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
    colorIdentity: ['B'],
    price: '2.00',
  });
  const deck = onePieceDeck();
  const result = await auditTutorReplacementsV15({
    route: onePieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
    constraints: { printingFamily: 'final-fantasy', maxUsdPerCard: 20 },
  }, {
    search: async () => [cheap],
    resolvePrintingPolicy: async () => ({
      family: 'final-fantasy',
      familyPreset: 'final-fantasy',
      allowedSetCodes: ['fin'],
      familyMatchedSetCodes: ['fin'],
      includePromos: true,
      includeSpecialReleases: true,
      exactSpecialPrintings: [],
      specialOracleNames: [],
      specialReleaseCoverageAsOf: null,
      specialReleaseCoverageNote: null,
      searchClause: '(set:fin)',
      explanation: 'test policy',
    }),
    selectEligiblePrinting: async () => null,
  });

  assert.equal(result.candidatePool.query?.includes('(set:fin)'), true);
  assert.equal(result.candidatePool.eligibleExactPrintings, 0);
  assert.equal(result.sources[0]!.replacements.length, 0);
});

test('preserves singleton legality and rejects replacing a tutor with a second copy already in the deck', async () => {
  const existing = card({
    name: 'Existing Tutor',
    oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
    colorIdentity: ['B'],
    price: '3.00',
  });
  const deck = onePieceDeck([existing]);
  const result = await auditTutorReplacementsV15({
    route: onePieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
  }, dependencies([existing], { [existing.name]: 3 }));

  assert.equal(result.sources[0]!.replacements.length, 0);
  assert.equal(result.sources[0]!.rejected.some((item) => item.code === 'commander-rules-failed'), true);
});

test('exposes access loss when a cheaper restricted tutor cannot cover every piece the source can find', async () => {
  const creatureOnly = card({
    name: 'Narrow Creature Finder',
    oracleText: 'Search your library for a creature card, reveal it, put it into your hand, then shuffle.',
    colorIdentity: ['B'],
    price: '2.00',
  });
  const deck = twoPieceDeck();
  const result = await auditTutorReplacementsV15({
    route: twoPieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
  }, dependencies([creatureOnly], { [creatureOnly.name]: 2 }));

  const replacement = result.sources[0]!.replacements[0]!;
  assert.equal(replacement.classification, 'cheaper-with-access-loss');
  assert.equal(replacement.replacementCoversPieces.includes(pieceCreature.name), true);
  assert.equal(replacement.replacementCoversPieces.includes(pieceArtifact.name), false);
  assert.ok(replacement.maximumAccessLossPercentagePoints > 0);
});

test('near-equivalent classification appears only when an explicit access-loss threshold is supplied', async () => {
  const creatureOnly = card({
    name: 'Threshold Creature Finder',
    oracleText: 'Search your library for a creature card, reveal it, put it into your hand, then shuffle.',
    colorIdentity: ['B'],
    price: '2.00',
  });
  const deck = twoPieceDeck();
  const withoutThreshold = await auditTutorReplacementsV15({
    route: twoPieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
  }, dependencies([creatureOnly], { [creatureOnly.name]: 2 }));
  assert.equal(withoutThreshold.sources[0]!.replacements[0]!.classification, 'cheaper-with-access-loss');

  const withThreshold = await auditTutorReplacementsV15({
    route: twoPieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
    constraints: { maxAccessLossPercentagePoints: 100 },
  }, dependencies([creatureOnly], { [creatureOnly.name]: 2 }));
  assert.equal(withThreshold.sources[0]!.replacements[0]!.classification, 'cheaper-within-requested-access-loss');
});

test('candidate-search failure remains unknown availability rather than no replacement', async () => {
  const deck = onePieceDeck();
  const result = await auditTutorReplacementsV15({
    route: onePieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
  }, {
    search: async () => { throw new Error('provider unavailable'); },
  });

  assert.equal(result.status, 'candidate-search-unavailable');
  assert.match(result.guidance, /unknown availability/i);
});

test('an empty bounded Scryfall sample does not claim the source tutor is optimal', async () => {
  const deck = onePieceDeck();
  const result = await auditTutorReplacementsV15({
    route: onePieceRoute,
    parsed: deck.parsed,
    resolvedCards: deck.resolved,
    sourceTutorName: sourceTutor.name,
  }, dependencies([]));

  assert.equal(result.status, 'replacement-options-evaluated');
  assert.equal(result.sources[0]!.replacements.length, 0);
  assert.match(result.guidance, /not proof that no replacement exists/i);
});
