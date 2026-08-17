import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildCommanderDeckUnderWholeBudgetV15 } from './deck-whole-budget-v15.js';

function card(name: string, price: string | null): ScryfallCard {
  return {
    id: name,
    name,
    lang: 'en',
    cmc: 1,
    type_line: name === 'Commander' ? 'Legendary Creature — Human' : 'Creature — Human',
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: name === 'Commander' ? '1' : '2',
    rarity: 'common',
    prices: { usd: price },
    scryfall_uri: 'https://scryfall.com',
  };
}

const commander = card('Commander', '1.00');
const decklist = `// COMMANDER\n1 Commander (TST) 1\n\n// MAIN\n99 Filler (TST) 2`;

function draft(priceEstimate: number, deficits = 0): Record<string, unknown> {
  return {
    status: 'complete-draft',
    decklist,
    cardCount: 100,
    selectedPrintingEstimatedUsd: priceEstimate,
    remainingRoleDeficits: { ramp: deficits, draw: deficits },
  };
}

test('whole-deck wrapper accepts only an independently audited total at or below the hard cap', async () => {
  const caps: number[] = [];
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
  }, {
    buildDraft: async (_commanders, options) => {
      caps.push(Number(options.maxUsdPerCard));
      return caps.length === 1 ? draft(150, 0) : draft(90, 2);
    },
    resolveDeckCards: async () => ({
      cards: [commander, card('Filler', caps.length === 1 ? '1.60' : '0.80')],
      notFound: [],
    }),
  });

  assert.equal(result.status, 'budget-compliant');
  assert.equal((result.budgetAudit as Record<string, unknown>).withinBudget, true);
  assert.equal((result.budgetAudit as Record<string, unknown>).auditedTotalUsd, 80.2);
  assert.ok(caps.length >= 2, 'an over-budget first build must trigger a tighter rebuild');
});

test('unknown exact-printing prices never count as zero toward a hard whole-deck budget', async () => {
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    maxDeckUsd: 100,
  }, {
    buildDraft: async () => draft(20),
    resolveDeckCards: async () => ({ cards: [commander, card('Filler', null)], notFound: [] }),
  });

  assert.equal(result.status, 'budget-infeasible');
  const attempts = result.attempts as Array<Record<string, unknown>>;
  assert.ok(attempts.length > 0);
  assert.ok(attempts.every((attempt) => attempt.auditStatus === 'unknown-price'));
});

test('the wrapper never reports compliance when every complete attempt is genuinely over budget', async () => {
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    maxDeckUsd: 100,
  }, {
    buildDraft: async () => draft(120),
    resolveDeckCards: async () => ({ cards: [commander, card('Filler', '1.20')], notFound: [] }),
  });

  assert.equal(result.status, 'budget-infeasible');
  assert.equal(result.budgetAudit, null);
  assert.match(String(result.guidance), /cannot honestly claim/i);
});

test('required max-per-card cap is never loosened while searching for a whole-budget solution', async () => {
  const seen: number[] = [];
  await buildCommanderDeckUnderWholeBudgetV15([commander], {
    maxDeckUsd: 100,
    maxUsdPerCard: 2,
  }, {
    buildDraft: async (_commanders, options) => {
      seen.push(Number(options.maxUsdPerCard));
      return { status: 'incomplete-draft' };
    },
    resolveDeckCards: async () => ({ cards: [], notFound: [] }),
  });

  assert.ok(seen.length > 0);
  assert.ok(seen.every((cap) => cap <= 2));
});

test('invalid whole-deck budgets are rejected before any build attempt', async () => {
  await assert.rejects(() => buildCommanderDeckUnderWholeBudgetV15([commander], {
    maxDeckUsd: 0,
  }), /positive finite/i);
});
