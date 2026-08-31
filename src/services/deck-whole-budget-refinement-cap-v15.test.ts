import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildCommanderDeckUnderWholeBudgetV15 } from './deck-whole-budget-v15.js';

function card(name: string, price: string, collectorNumber: string): ScryfallCard {
  return {
    id: `${name}-${collectorNumber}`,
    name,
    lang: 'en',
    cmc: 1,
    type_line: name === 'Commander' ? 'Legendary Creature — Human' : 'Creature — Human',
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: collectorNumber,
    rarity: 'common',
    prices: { usd: price },
    scryfall_uri: 'https://scryfall.com',
  };
}

const commander = card('Commander', '1.00', '1');
const filler = card('Filler', '0.50', '2');
const decklist = `// COMMANDER\n1 Commander (TST) 1\n\n// MAIN\n99 Filler (TST) 2`;

function rejectedRefinement(): Record<string, unknown> {
  return {
    status: 'cedh-oriented-refinement-incomplete',
    comboWasPreserved: false,
    initialAssessment: {
      status: 'not-yet-strong-competitive-construction-signals',
      winningCombos: 1,
      metrics: { averageNonlandManaValue: 2.8, freeInteractionCount: 1, fastManaCount: 2, tutorCount: 3 },
    },
    finalAssessment: {
      status: 'not-yet-strong-competitive-construction-signals',
      winningCombos: 0,
      metrics: { averageNonlandManaValue: 2.7, freeInteractionCount: 1, fastManaCount: 2, tutorCount: 3 },
    },
    finalDecklist: decklist,
  };
}

test('Bracket-5 post-refinement inherits the selected compliant candidate price cap', async () => {
  let refinementCap: number | undefined;
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
  }, {
    discoverWinSeed: async () => ({ status: 'no-eligible-winning-seed-package' }),
    buildDraft: async () => ({
      status: 'complete-draft',
      decklist,
      remainingRoleDeficits: { ramp: 0, draw: 0 },
    }),
    resolveDeckCards: async () => ({ cards: [commander, filler], notFound: [] }),
    refineCandidate: async (_decklist, options) => {
      refinementCap = options.maxUsdPerCard;
      return rejectedRefinement();
    },
  });

  assert.equal(result.status, 'budget-compliant');
  assert.equal(refinementCap, result.chosenCandidateSearchCapUsd);
  assert.equal(
    (result.postBudgetRefinement as Record<string, unknown>).refinementSearchCapUsd,
    result.chosenCandidateSearchCapUsd,
  );
});

test('explicit user per-card limits remain authoritative during post-refinement', async () => {
  let refinementCap: number | undefined;
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
    maxUsdPerCard: 2,
  }, {
    discoverWinSeed: async () => ({ status: 'no-eligible-winning-seed-package' }),
    buildDraft: async () => ({
      status: 'complete-draft',
      decklist,
      remainingRoleDeficits: { ramp: 0, draw: 0 },
    }),
    resolveDeckCards: async () => ({ cards: [commander, filler], notFound: [] }),
    refineCandidate: async (_decklist, options) => {
      refinementCap = options.maxUsdPerCard;
      return rejectedRefinement();
    },
  });

  assert.equal(result.status, 'budget-compliant');
  assert.ok(refinementCap !== undefined && refinementCap <= 2);
  assert.equal(refinementCap, result.chosenCandidateSearchCapUsd);
});
