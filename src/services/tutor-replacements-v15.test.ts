import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import type { EligiblePrintingChoiceV08, ResolvedPrintingPolicyV08 } from './printing-policy-v08.js';
import {
  auditTutorReplacementCandidatesV15,
  discoverTutorReplacementsV15,
} from './tutor-replacements-v15.js';

function card(input: {
  name: string;
  typeLine?: string;
  oracleText?: string;
  cmc?: number;
  colorIdentity?: string[];
  set?: string;
  collectorNumber?: string;
  usd?: string | null;
}): ScryfallCard {
  const set = input.set ?? 'tst';
  const collectorNumber = input.collectorNumber ?? input.name.replace(/[^a-z0-9]/gi, '').slice(0, 8) || '1';
  return {
    id: `${set}-${collectorNumber}-${input.name}`,
    lang: 'en',
    oracle_id: `oracle-${input.name}`,
    name: input.name,
    set,
    set_name: 'Test Set',
    collector_number: collectorNumber,
    released_at: '2026-01-01',
    type_line: input.typeLine ?? 'Sorcery',
    oracle_text: input.oracleText ?? '',
    mana_cost: '{1}{B}',
    cmc: input.cmc ?? 2,
    colors: input.colorIdentity ?? ['B'],
    color_identity: input.colorIdentity ?? ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'rare',
    prices: { usd: input.usd ?? '1.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
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
  cmc: 3,
  collectorNumber: '1',
});
const pieceB = card({ name: 'Creature Piece', typeLine: 'Creature — Wizard', oracleText: 'Combo piece.', collectorNumber: '2' });
const pieceC = card({ name: 'Artifact Piece', typeLine: 'Artifact', oracleText: 'Combo piece.', colorIdentity: [], collectorNumber: '3' });
const incumbent = card({
  name: 'Expensive Universal Tutor',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  collectorNumber: '4',
  usd: '50.00',
});
const swamp = card({
  name: 'Swamp',
  typeLine: 'Basic Land — Swamp',
  oracleText: '({T}: Add {B}.)',
  cmc: 0,
  collectorNumber: '5',
  usd: '0.10',
});

const parsed: ParsedDeck = {
  commanders: [{ name: commander.name, quantity: 1, set: 'TST', collectorNumber: '1' }],
  main: [
    { name: pieceB.name, quantity: 1, set: 'TST', collectorNumber: '2' },
    { name: pieceC.name, quantity: 1, set: 'TST', collectorNumber: '3' },
    { name: incumbent.name, quantity: 1, set: 'TST', collectorNumber: '4', finish: 'nonfoil' },
    { name: swamp.name, quantity: 96, set: 'TST', collectorNumber: '5' },
  ],
  totalMain: 99,
  totalCommanders: 1,
  totalCards: 100,
};
const resolved = [commander, pieceB, pieceC, incumbent, swamp];
const route = {
  comboId: 'route-1',
  comboCardNames: [commander.name, pieceB.name, pieceC.name],
  seedNames: [pieceB.name, pieceC.name],
  dependencyCompleteness: 'explicit-cards-only' as const,
};

function choice(candidate: ScryfallCard, priceUsd: number | null): EligiblePrintingChoiceV08 {
  return { card: candidate, finish: priceUsd === null ? null : 'nonfoil', priceUsd, matchedBy: 'unrestricted' };
}

const cheapUniversal = card({
  name: 'Cheap Universal Tutor',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  collectorNumber: '10',
  usd: '5.00',
});
const creatureTutor = card({
  name: 'Cheap Creature Tutor',
  oracleText: 'Search your library for a creature card, put that card into your hand, then shuffle.',
  collectorNumber: '11',
  usd: '4.00',
});
const topTutor = card({
  name: 'Top Tutor',
  oracleText: 'Search your library for a card, then shuffle and put that card on top of your library.',
  collectorNumber: '12',
  usd: '2.00',
});
const offColorTutor = card({
  name: 'Blue Tutor',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  colorIdentity: ['U'],
  collectorNumber: '13',
  usd: '1.00',
});

function unrestrictedPolicy(): ResolvedPrintingPolicyV08 {
  return {
    family: null,
    familyPreset: null,
    allowedSetCodes: [],
    familyMatchedSetCodes: [],
    includePromos: true,
    includeSpecialReleases: true,
    exactSpecialPrintings: [],
    specialOracleNames: [],
    searchClause: '',
    explanation: 'unrestricted',
  };
}

test('a cheaper universal tutor is an exact-access-equivalent real one-card swap', () => {
  const audit = auditTutorReplacementCandidatesV15({
    route,
    parsed,
    resolvedCards: resolved,
    incumbentTutorName: incumbent.name,
    candidatePrintings: [choice(cheapUniversal, 5)],
  });
  assert.equal(audit.status, 'exact-replacements-audited');
  assert.equal(audit.candidates.length, 1);
  const candidate = audit.candidates[0]!;
  assert.equal(candidate.priceRelationship, 'cheaper');
  assert.equal(candidate.accessRelationship, 'exact-equivalent');
  assert.equal(candidate.recommendationClass, 'cheaper-no-worse');
  assert.equal(candidate.savingsUsd, 45);
  assert.equal(candidate.swappedDeckStillExactly100Cards, true);
  assert.equal(candidate.commanderRulesStillLegal, true);
  assert.ok(candidate.exactAccessComparison.every((checkpoint) => checkpoint.exactReplacementMinusIncumbent.numerator === '0'));
});

test('a cheaper restricted tutor exposes exact access loss instead of being called equivalent', () => {
  const audit = auditTutorReplacementCandidatesV15({
    route,
    parsed,
    resolvedCards: resolved,
    incumbentTutorName: incumbent.name,
    candidatePrintings: [choice(creatureTutor, 4)],
  });
  const candidate = audit.candidates[0]!;
  assert.equal(candidate.priceRelationship, 'cheaper');
  assert.equal(candidate.accessRelationship, 'loses');
  assert.equal(candidate.recommendationClass, 'cheaper-tradeoff');
  assert.ok(candidate.exactAccessComparison.some((checkpoint) => checkpoint.exactReplacementMinusIncumbent.decimal < 0));
});

test('top-of-library tutor is not promoted to direct hand/battlefield replacement', () => {
  const audit = auditTutorReplacementCandidatesV15({
    route,
    parsed,
    resolvedCards: resolved,
    incumbentTutorName: incumbent.name,
    candidatePrintings: [choice(topTutor, 2)],
  });
  assert.equal(audit.candidates.length, 0);
  assert.equal(audit.rejected[0]?.code, 'not-direct-route-access');
});

test('Commander color identity and singleton legality are rechecked after the literal swap', () => {
  const duplicatePieceTutor = card({
    name: pieceB.name,
    typeLine: 'Creature — Wizard',
    oracleText: 'Search your library for a creature card, put that card into your hand, then shuffle.',
    set: 'alt',
    collectorNumber: '21',
    usd: '1.00',
  });
  const audit = auditTutorReplacementCandidatesV15({
    route,
    parsed,
    resolvedCards: resolved,
    incumbentTutorName: incumbent.name,
    candidatePrintings: [choice(offColorTutor, 1), choice(duplicatePieceTutor, 1)],
  });
  assert.equal(audit.candidates.length, 0);
  assert.equal(audit.rejected.filter((item) => item.code === 'commander-rules-rejected').length, 2);
  assert.ok(audit.rejected.some((item) => item.reason.includes('color identity')));
  assert.ok(audit.rejected.some((item) => item.reason.includes('Singleton conflict')));
});

test('active printing policy and hard per-card budget are enforced on exact candidate printings', () => {
  const policy: ResolvedPrintingPolicyV08 = {
    ...unrestrictedPolicy(),
    family: 'Final Fantasy',
    familyPreset: 'final-fantasy',
    allowedSetCodes: ['fin'],
    familyMatchedSetCodes: ['fin'],
  };
  const wrongSet = { ...cheapUniversal, set: 'abc', collector_number: '30' } as ScryfallCard;
  const overBudget = { ...cheapUniversal, name: 'Over Budget Tutor', set: 'fin', collector_number: '31', prices: { ...cheapUniversal.prices, usd: '25.00' } } as ScryfallCard;
  const audit = auditTutorReplacementCandidatesV15({
    route,
    parsed,
    resolvedCards: resolved,
    incumbentTutorName: incumbent.name,
    candidatePrintings: [choice(wrongSet, 5), choice(overBudget, 25)],
    printingPolicy: policy,
    maxUsdPerCard: 20,
  });
  assert.equal(audit.candidates.length, 0);
  assert.equal(audit.rejected[0]?.code, 'printing-policy-rejected');
  assert.equal(audit.rejected[1]?.code, 'budget-or-price-rejected');
});

test('unknown incumbent price never turns a candidate into a fabricated cheaper claim', () => {
  const unpricedIncumbent = { ...incumbent, prices: { ...incumbent.prices, usd: null } } as ScryfallCard;
  const audit = auditTutorReplacementCandidatesV15({
    route,
    parsed,
    resolvedCards: [commander, pieceB, pieceC, unpricedIncumbent, swamp],
    incumbentTutorName: incumbent.name,
    candidatePrintings: [choice(cheapUniversal, 5)],
  });
  const candidate = audit.candidates[0]!;
  assert.equal(candidate.incumbentPriceUsd, null);
  assert.equal(candidate.priceRelationship, 'unknown');
  assert.equal(candidate.recommendationClass, 'price-comparison-unknown');
});

test('bounded discovery filters off-color Oracle candidates before exact printing selection and preserves policy', async () => {
  let selectCalls: string[] = [];
  const policy = unrestrictedPolicy();
  const result = await discoverTutorReplacementsV15(
    {
      route,
      parsed,
      resolvedCards: resolved,
      incumbentTutorName: incumbent.name,
      printingPolicy: {},
      maxUsdPerCard: 20,
    },
    {
      search: async () => [cheapUniversal, offColorTutor, topTutor, creatureTutor],
      resolvePolicy: async () => policy,
      selectPrinting: async (candidate) => {
        selectCalls.push(candidate.name);
        if (candidate.name === cheapUniversal.name) return choice(cheapUniversal, 5);
        if (candidate.name === creatureTutor.name) return choice(creatureTutor, 4);
        return null;
      },
    },
  );
  assert.ok(result.discovery.searchQueries.length >= 3);
  assert.equal(selectCalls.includes(offColorTutor.name), false, 'off-color candidate must be rejected before printing lookup');
  assert.equal(selectCalls.includes(topTutor.name), false, 'conditional top tutor should fail route relevance before printing lookup');
  assert.deepEqual(selectCalls.sort(), [cheapUniversal.name, creatureTutor.name].sort());
  assert.equal(result.candidates[0]?.recommendationClass, 'cheaper-no-worse');
  assert.equal(result.discovery.maxUsdPerCard, 20);
});
