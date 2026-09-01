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
    type_line: name === 'Commander' ? 'Legendary Creature — Human' : 'Instant',
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
const premium = card('Premium Protection', '20.00', '3');
const baseDecklist = `// COMMANDER\n1 Commander (TST) 1\n\n// MAIN\n99 Filler (TST) 2`;
const premiumDecklist = `// COMMANDER\n1 Commander (TST) 1\n\n// MAIN\n98 Filler (TST) 2\n1 Premium Protection (TST) 3`;

function noMaterialRefinement(): Record<string, unknown> {
  return {
    status: 'cedh-oriented-refinement-complete',
    comboWasPreserved: true,
    initialAssessment: {
      status: 'strong-competitive-construction-signals',
      winningCombos: 1,
      winningComboCoreCount: 1,
      metrics: {
        averageNonlandManaValue: 2,
        protectionCount: 2,
        cheapInteractionCount: 10,
        freeInteractionCount: 2,
        fastManaCount: 3,
        tutorCount: 5,
      },
    },
    finalAssessment: {
      status: 'strong-competitive-construction-signals',
      winningCombos: 1,
      winningComboCoreCount: 1,
      metrics: {
        averageNonlandManaValue: 2,
        protectionCount: 2,
        cheapInteractionCount: 10,
        freeInteractionCount: 2,
        fastManaCount: 3,
        tutorCount: 5,
      },
    },
    finalDecklist: baseDecklist,
  };
}

function protectionImprovement(): Record<string, unknown> {
  return {
    status: 'cedh-oriented-refinement-complete',
    comboWasPreserved: true,
    initialAssessment: {
      status: 'strong-competitive-construction-signals',
      winningCombos: 1,
      winningComboCoreCount: 1,
      metrics: {
        averageNonlandManaValue: 2,
        protectionCount: 2,
        cheapInteractionCount: 10,
        freeInteractionCount: 2,
        fastManaCount: 3,
        tutorCount: 5,
      },
    },
    finalAssessment: {
      status: 'strong-competitive-construction-signals',
      winningCombos: 1,
      winningComboCoreCount: 1,
      metrics: {
        averageNonlandManaValue: 2,
        protectionCount: 4,
        cheapInteractionCount: 10,
        freeInteractionCount: 2,
        fastManaCount: 3,
        tutorCount: 5,
      },
    },
    finalDecklist: premiumDecklist,
  };
}

test('unused whole-deck headroom enables a separate tightly bounded premium refinement pass', async () => {
  let premiumCalls = 0;
  let premiumCap = 0;
  let premiumSwaps = 0;
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
  }, {
    discoverWinSeed: async () => ({ status: 'no-eligible-winning-seed-package' }),
    buildDraft: async (_commanders, options) => Number(options.candidateMaxUsdPerCard) <= 2
      ? { status: 'complete-draft', decklist: baseDecklist, remainingRoleDeficits: { protection: 0 } }
      : { status: 'incomplete-draft' },
    resolveDeckCards: async () => ({ cards: [commander, filler, premium], notFound: [] }),
    refineCandidate: async () => noMaterialRefinement(),
    refinePremiumCandidate: async (_decklist, options) => {
      premiumCalls += 1;
      premiumCap = Number(options.maxUsdPerCard);
      premiumSwaps = Number(options.maxEfficiencySwaps);
      return protectionImprovement();
    },
  });

  assert.equal(result.status, 'budget-compliant');
  assert.equal(result.chosenCandidateSearchCapUsd, 1.5);
  assert.equal(premiumCalls, 1);
  assert.equal(premiumCap, 51);
  assert.equal(premiumSwaps, 2);
  assert.equal(result.decklist, premiumDecklist);
  assert.equal((result.budgetAudit as Record<string, unknown>).auditedTotalUsd, 70);

  const premiumStage = result.premiumHeadroomRefinement as Record<string, unknown>;
  assert.equal(premiumStage.status, 'accepted');
  assert.equal(premiumStage.remainingHeadroomUsd, 49.5);
  assert.equal(premiumStage.premiumMaxUsdPerCard, 51);
  const quality = premiumStage.quality as Record<string, unknown>;
  assert.equal(quality.materialQualityImprovement, true);
  assert.equal(quality.initialProtectionCount, 2);
  assert.equal(quality.finalProtectionCount, 4);
});

test('an explicit user per-card cap remains authoritative over premium headroom', async () => {
  let premiumCalls = 0;
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
    maxUsdPerCard: 2,
  }, {
    discoverWinSeed: async () => ({ status: 'no-eligible-winning-seed-package' }),
    buildDraft: async () => ({
      status: 'complete-draft',
      decklist: baseDecklist,
      remainingRoleDeficits: { protection: 0 },
    }),
    resolveDeckCards: async () => ({ cards: [commander, filler, premium], notFound: [] }),
    refineCandidate: async () => noMaterialRefinement(),
    refinePremiumCandidate: async () => {
      premiumCalls += 1;
      return protectionImprovement();
    },
  });

  assert.equal(result.status, 'budget-compliant');
  assert.equal(premiumCalls, 0);
  const premiumStage = result.premiumHeadroomRefinement as Record<string, unknown>;
  assert.equal(premiumStage.status, 'not-needed-user-per-card-cap-blocks-headroom');
  assert.equal(premiumStage.premiumMaxUsdPerCard, 2);
});
