import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildCommanderDeckUnderWholeBudgetV15 } from './deck-whole-budget-v15.js';

function card(name: string, price: string, collector: string): ScryfallCard {
  return {
    id: name,
    name,
    lang: 'en',
    cmc: 1,
    type_line: name === 'Commander' ? 'Legendary Creature — Human' : 'Creature — Zombie',
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: collector,
    rarity: 'common',
    prices: { usd: price },
    scryfall_uri: 'https://scryfall.com',
  } as ScryfallCard;
}

const commander = card('Commander', '1.00', '1');
const filler = card('Filler', '0.50', '2');
const zombie = card('Better Zombie', '0.60', '3');
const baseDeck = '// COMMANDER\n1 Commander (TST) 1\n\n// MAIN\n99 Filler (TST) 2';
const refinedDeck = '// COMMANDER\n1 Commander (TST) 1\n\n// MAIN\n99 Better Zombie (TST) 3';

function draft(): Record<string, unknown> {
  return {
    status: 'complete-draft',
    decklist: baseDeck,
    cardCount: 100,
    remainingRoleDeficits: { ramp: 0, draw: 0 },
  };
}

function refinement(initialCores: number, finalCores: number, comboWasPreserved: boolean): Record<string, unknown> {
  return {
    status: 'cedh-oriented-refinement-complete',
    comboWasPreserved,
    initialAssessment: {
      status: 'strong-competitive-construction-signals',
      winningCombos: 2,
      winningComboCoreCount: initialCores,
      metrics: { averageNonlandManaValue: 2.4, freeInteractionCount: 1, fastManaCount: 2, tutorCount: 3 },
    },
    finalAssessment: {
      status: 'strong-competitive-construction-signals',
      winningCombos: 1,
      winningComboCoreCount: finalCores,
      metrics: { averageNonlandManaValue: 2.4, freeInteractionCount: 1, fastManaCount: 2, tutorCount: 3 },
    },
    stages: {
      strictEfficiency: {
        creatureTypeCoherenceImproved: true,
        recursionSaturationImproved: false,
      },
    },
    finalDecklist: refinedDeck,
  };
}

const dependencies = (refined: Record<string, unknown>) => ({
  discoverWinSeed: async () => ({ status: 'no-eligible-winning-seed-package' }),
  buildDraft: async () => draft(),
  refineCandidate: async () => refined,
  resolveDeckCards: async (identifiers: Array<{ name?: string }>) => ({
    cards: identifiers.some((identifier) => identifier.name === 'Better Zombie')
      ? [commander, zombie]
      : [commander, filler],
    notFound: [],
  }),
});

test('whole-budget refinement may drop a duplicate winning variant when the independent win core survives and cohesion improves', async () => {
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
  }, dependencies(refinement(1, 1, true)));

  assert.equal(result.status, 'budget-compliant');
  assert.equal(result.decklist, refinedDeck);
  const post = result.postBudgetRefinement as Record<string, unknown>;
  assert.equal(post.status, 'accepted');
  const quality = post.quality as Record<string, unknown>;
  assert.equal(quality.winningComboCountPreserved, false, 'raw variant count is allowed to fall');
  assert.equal(quality.winningComboCoreCountPreserved, true, 'independent win core must survive');
  assert.equal(quality.creatureTypeCoherenceImproved, true);
});

test('whole-budget refinement rejects losing an independent winning core even if raw output claims preservation', async () => {
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
  }, dependencies(refinement(2, 1, true)));

  assert.equal(result.decklist, baseDeck);
  const post = result.postBudgetRefinement as Record<string, unknown>;
  assert.equal(post.status, 'rejected-no-material-safe-improvement');
  const quality = post.quality as Record<string, unknown>;
  assert.equal(quality.winningComboCoreCountPreserved, false);
});
