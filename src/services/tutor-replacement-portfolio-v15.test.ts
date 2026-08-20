import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import type { TutorReplacementIntelligenceV15 } from './tutor-replacement-intelligence-v15.js';
import {
  auditTutorReplacementPortfolioV15,
  MAX_TUTOR_REPLACEMENT_PORTFOLIO_ROUTES_V15,
} from './tutor-replacement-portfolio-v15.js';
import type { WinRouteAccessInputV15 } from './win-route-access-v15.js';

function card(input: {
  name: string;
  typeLine?: string;
  oracleText?: string;
  colorIdentity?: string[];
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
    prices: { usd: '4.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
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
  name: 'Portfolio Commander',
  typeLine: 'Legendary Creature — Human Wizard',
  oracleText: 'Test commander.',
  colorIdentity: ['B'],
});
const creaturePiece = card({
  name: 'Portfolio Creature',
  typeLine: 'Creature — Zombie',
  oracleText: 'Combo piece.',
  colorIdentity: ['B'],
});
const artifactPiece = card({
  name: 'Portfolio Artifact',
  typeLine: 'Artifact',
  oracleText: 'Combo piece.',
  colorIdentity: [],
});
const premiumTutor = card({
  name: 'Portfolio Premium Tutor',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  colorIdentity: ['B'],
});
const creatureTutor = card({
  name: 'Portfolio Creature Tutor',
  oracleText: 'Search your library for a creature card, reveal it, put it into your hand, then shuffle.',
  colorIdentity: ['B'],
});
const universalTutor = card({
  name: 'Portfolio Budget Universal Tutor',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  colorIdentity: ['B'],
});
const swamp = card({
  name: 'Swamp',
  typeLine: 'Basic Land — Swamp',
  oracleText: '({T}: Add {B}.)',
  colorIdentity: [],
});

const parsed: ParsedDeck = {
  commanders: [{ name: commander.name, quantity: 1, set: commander.set.toUpperCase(), collectorNumber: commander.collector_number }],
  main: [
    { name: creaturePiece.name, quantity: 1, set: creaturePiece.set.toUpperCase(), collectorNumber: creaturePiece.collector_number },
    { name: artifactPiece.name, quantity: 1, set: artifactPiece.set.toUpperCase(), collectorNumber: artifactPiece.collector_number },
    { name: premiumTutor.name, quantity: 1, set: premiumTutor.set.toUpperCase(), collectorNumber: premiumTutor.collector_number },
    { name: swamp.name, quantity: 96, set: swamp.set.toUpperCase(), collectorNumber: swamp.collector_number },
  ],
  totalMain: 99,
  totalCommanders: 1,
  totalCards: 100,
};
const resolved = [commander, creaturePiece, artifactPiece, premiumTutor, swamp];

const creatureRoute: WinRouteAccessInputV15 = {
  comboId: 'creature-route',
  comboCardNames: [commander.name, creaturePiece.name],
  dependencyCompleteness: 'explicit-cards-only',
};
const artifactRoute: WinRouteAccessInputV15 = {
  comboId: 'artifact-route',
  comboCardNames: [commander.name, artifactPiece.name],
  dependencyCompleteness: 'explicit-cards-only',
};

function replacementAudit(replacement: ScryfallCard, threshold: number | null = null): TutorReplacementIntelligenceV15 {
  return {
    comboId: creatureRoute.comboId,
    status: 'replacement-options-evaluated',
    baselineValue: {} as TutorReplacementIntelligenceV15['baselineValue'],
    sourceTutorChoices: [premiumTutor.name],
    sources: [{
      sourceTutorName: premiumTutor.name,
      sourcePrice: {} as TutorReplacementIntelligenceV15['sources'][number]['sourcePrice'],
      sourceCoversPieces: [creaturePiece.name],
      replacements: [{
        sourceTutorName: premiumTutor.name,
        replacementTutorName: replacement.name,
        sourceMainEntryIndex: 2,
        sourceCoversPieces: [creaturePiece.name],
        replacementCoversPieces: [creaturePiece.name],
        replacementDestination: 'hand',
        sourcePrice: {} as TutorReplacementIntelligenceV15['sources'][number]['replacements'][number]['sourcePrice'],
        replacementPrice: {
          status: 'available',
          printing: { name: replacement.name, set: replacement.set.toUpperCase(), collectorNumber: replacement.collector_number },
          finish: 'nonfoil',
          priceUsd: 4,
          matchedBy: 'unrestricted',
          basis: 'eligible-exact-printing-finish-v15',
        },
        priceDeltaUsd: -36,
        priceSavingsUsd: 36,
        exactAccess: [],
        maximumAccessLossPercentagePoints: 0,
        classification: 'access-equivalent-cheaper',
        commanderRules: { status: 'legal', isLegal: true },
        caveat: 'test',
      }],
      rejected: [],
    }],
    candidatePool: {
      query: 'test',
      ordering: 'scryfall-edhrec',
      maximumSearchResults: 50,
      returnedSearchResults: 1,
      eligibleExactPrintings: 1,
      completeness: 'bounded-top-results-not-exhaustive',
    },
    threshold: {
      maxAccessLossPercentagePoints: threshold,
      semantics: 'applies-independently-to-opening-turn3-turn5',
    },
    guidance: 'test',
  };
}

test('a primary-route equivalent creature tutor is not portfolio-safe when it weakens a second artifact route', async () => {
  const result = await auditTutorReplacementPortfolioV15({
    routes: [creatureRoute, artifactRoute],
    parsed,
    resolvedCards: resolved,
    replacementAudit: replacementAudit(creatureTutor),
  }, {
    resolveCards: async () => ({ cards: [creatureTutor], notFound: [] }),
  });

  assert.equal(result.status, 'portfolio-evaluated');
  const candidate = result.candidates[0]!;
  assert.equal(candidate.primaryRouteClassification, 'access-equivalent-cheaper');
  assert.equal(candidate.status, 'access-loss');
  assert.equal(candidate.safeNoExactAccessLossAcrossPortfolio, false);
  assert.equal(candidate.routes.find((route) => route.comboId === creatureRoute.comboId)?.status, 'no-access-loss');
  assert.equal(candidate.routes.find((route) => route.comboId === artifactRoute.comboId)?.status, 'access-loss');
  assert.ok((candidate.maximumAccessLossPercentagePoints ?? 0) > 0);
});

test('a universal replacement that preserves both routes is explicitly portfolio-safe', async () => {
  const result = await auditTutorReplacementPortfolioV15({
    routes: [creatureRoute, artifactRoute],
    parsed,
    resolvedCards: resolved,
    replacementAudit: replacementAudit(universalTutor),
  }, {
    resolveCards: async () => ({ cards: [universalTutor], notFound: [] }),
  });

  const candidate = result.candidates[0]!;
  assert.equal(candidate.status, 'no-access-loss');
  assert.equal(candidate.safeNoExactAccessLossAcrossPortfolio, true);
  assert.equal(candidate.withinRequestedToleranceAcrossPortfolio, true);
  assert.equal(candidate.routes.every((route) => route.status === 'no-access-loss'), true);
});

test('near-equivalent portfolio safety only uses an explicit caller threshold', async () => {
  const result = await auditTutorReplacementPortfolioV15({
    routes: [creatureRoute, artifactRoute],
    parsed,
    resolvedCards: resolved,
    replacementAudit: replacementAudit(creatureTutor, 100),
  }, {
    resolveCards: async () => ({ cards: [creatureTutor], notFound: [] }),
  });

  const candidate = result.candidates[0]!;
  assert.equal(candidate.status, 'within-requested-access-loss');
  assert.equal(candidate.safeNoExactAccessLossAcrossPortfolio, false);
  assert.equal(candidate.withinRequestedToleranceAcrossPortfolio, true);
});

test('too many verified routes fails closed instead of labelling a partial portfolio safe', async () => {
  const routes = Array.from({ length: MAX_TUTOR_REPLACEMENT_PORTFOLIO_ROUTES_V15 + 1 }, (_, index) => ({
    ...creatureRoute,
    comboId: `route-${index}`,
  }));
  const result = await auditTutorReplacementPortfolioV15({
    routes,
    parsed,
    resolvedCards: resolved,
    replacementAudit: replacementAudit(universalTutor),
  }, {
    resolveCards: async () => { throw new Error('should not resolve candidates'); },
  });

  assert.equal(result.status, 'too-many-verified-routes');
  assert.equal(result.candidates.length, 0);
  assert.match(result.guidance, /No replacement was labelled portfolio-safe/i);
});

test('candidate printing resolution failure remains unknown rather than a safe replacement claim', async () => {
  const result = await auditTutorReplacementPortfolioV15({
    routes: [creatureRoute, artifactRoute],
    parsed,
    resolvedCards: resolved,
    replacementAudit: replacementAudit(universalTutor),
  }, {
    resolveCards: async () => { throw new Error('Scryfall unavailable'); },
  });

  assert.equal(result.status, 'candidate-resolution-unavailable');
  assert.equal(result.candidates.length, 0);
  assert.match(result.guidance, /No cross-route safety claim was fabricated/i);
});
