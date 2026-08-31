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

function draft(priceEstimate: number, deficits = 0, marker?: string): Record<string, unknown> {
  return {
    status: 'complete-draft',
    decklist,
    cardCount: 100,
    selectedPrintingEstimatedUsd: priceEstimate,
    remainingRoleDeficits: { ramp: deficits, draw: deficits },
    ...(marker ? { marker } : {}),
  };
}

test('whole-deck wrapper accepts only an independently audited total at or below the hard cap', async () => {
  const caps: number[] = [];
  const userCaps: Array<number | undefined> = [];
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
  }, {
    discoverWinSeed: async () => ({ status: 'no-eligible-winning-seed-package' }),
    buildDraft: async (_commanders, options) => {
      caps.push(Number(options.candidateMaxUsdPerCard));
      userCaps.push(options.maxUsdPerCard);
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
  assert.ok(userCaps.every((cap) => cap === undefined), 'internal search pressure must not become a fake user per-card cap');
});

test('whole-deck wrapper compares every compliant search attempt instead of accepting the first cheap fit', async () => {
  let calls = 0;
  const caps: number[] = [];
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
  }, {
    discoverWinSeed: async () => ({ status: 'no-eligible-winning-seed-package' }),
    buildDraft: async (_commanders, options) => {
      calls += 1;
      caps.push(Number(options.candidateMaxUsdPerCard));
      if (calls === 1) return draft(40, 4, 'first-cheap-fit');
      if (calls === 2) return draft(50, 0, 'stronger-structure');
      return draft(60, 1, `later-${calls}`);
    },
    resolveDeckCards: async () => ({
      cards: [commander, card('Filler', '0.50')],
      notFound: [],
    }),
  });

  assert.equal(result.status, 'budget-compliant');
  assert.ok(calls > 2, 'a compliant first draft must not terminate the whole search');
  assert.equal((result.draft as Record<string, unknown>).marker, 'stronger-structure');
  assert.equal(result.compliantCandidateCount, calls);
  assert.equal(result.selectionBasis, 'fewest remaining structural deficits, then widest candidate search cap');
  assert.equal(result.chosenCandidateSearchCapUsd, caps[1]);
});

test('Bracket-5 whole-budget construction discovers one verified win seed and injects it into every search attempt', async () => {
  let discoveryCalls = 0;
  const seenMustIncludes: string[][] = [];
  await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
    mustInclude: ['User Card'],
  }, {
    discoverWinSeed: async () => {
      discoveryCalls += 1;
      return {
        status: 'eligible-winning-seed-package-found',
        seedNames: ['Combo A', 'Combo B'],
        comboCardNames: ['Combo A', 'Combo B'],
      };
    },
    buildDraft: async (_commanders, options) => {
      seenMustIncludes.push([...(options.mustInclude ?? [])]);
      return { status: 'incomplete-draft' };
    },
    resolveDeckCards: async () => ({ cards: [], notFound: [] }),
  });

  assert.equal(discoveryCalls, 1, 'win seed discovery should be shared across the whole budget search');
  assert.ok(seenMustIncludes.length > 1);
  assert.ok(seenMustIncludes.every((names) => names.includes('User Card') && names.includes('Combo A') && names.includes('Combo B')));
});

test('lower-bracket whole-budget construction does not force competitive win seeding', async () => {
  let discoveryCalls = 0;
  await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 4,
    maxDeckUsd: 100,
  }, {
    discoverWinSeed: async () => {
      discoveryCalls += 1;
      return { status: 'eligible-winning-seed-package-found', seedNames: ['Combo A', 'Combo B'] };
    },
    buildDraft: async () => ({ status: 'incomplete-draft' }),
    resolveDeckCards: async () => ({ cards: [], notFound: [] }),
  });

  assert.equal(discoveryCalls, 0);
});

test('an excluded combo piece blocks automatic seed injection rather than overriding the user exclusion', async () => {
  const seenMustIncludes: string[][] = [];
  const result = await buildCommanderDeckUnderWholeBudgetV15([commander], {
    targetBracket: 5,
    maxDeckUsd: 100,
    excludedCards: ['Combo B'],
  }, {
    discoverWinSeed: async () => ({
      status: 'eligible-winning-seed-package-found',
      seedNames: ['Combo A', 'Combo B'],
      comboCardNames: ['Combo A', 'Combo B'],
    }),
    buildDraft: async (_commanders, options) => {
      seenMustIncludes.push([...(options.mustInclude ?? [])]);
      return { status: 'incomplete-draft' };
    },
    resolveDeckCards: async () => ({ cards: [], notFound: [] }),
  });

  assert.ok(seenMustIncludes.every((names) => !names.includes('Combo A') && !names.includes('Combo B')));
  assert.equal((result.autoWinSeed as Record<string, unknown>).status, 'winning-seed-package-blocked-by-exclusions');
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

test('internal candidate cap may fall below commander price without inventing a commander price restriction', async () => {
  const expensiveCommander = card('Commander', '5.00');
  const seen: Array<{ userCap: number | undefined; candidateCap: number }> = [];
  await buildCommanderDeckUnderWholeBudgetV15([expensiveCommander], {
    maxDeckUsd: 100,
  }, {
    buildDraft: async (_commanders, options) => {
      seen.push({ userCap: options.maxUsdPerCard, candidateCap: Number(options.candidateMaxUsdPerCard) });
      return { status: 'incomplete-draft' };
    },
    resolveDeckCards: async () => ({ cards: [], notFound: [] }),
  });

  assert.ok(seen.length > 0);
  assert.ok(seen.every((entry) => entry.userCap === undefined));
  assert.ok(seen.some((entry) => entry.candidateCap < 5), 'search should be allowed to tighten optional cards below the fixed commander price');
});

test('explicit user max-per-card cap is preserved while candidate search may only tighten it', async () => {
  const seen: Array<{ userCap: number | undefined; candidateCap: number }> = [];
  await buildCommanderDeckUnderWholeBudgetV15([commander], {
    maxDeckUsd: 100,
    maxUsdPerCard: 2,
  }, {
    buildDraft: async (_commanders, options) => {
      seen.push({ userCap: options.maxUsdPerCard, candidateCap: Number(options.candidateMaxUsdPerCard) });
      return { status: 'incomplete-draft' };
    },
    resolveDeckCards: async () => ({ cards: [], notFound: [] }),
  });

  assert.ok(seen.length > 0);
  assert.ok(seen.every((entry) => entry.userCap === 2));
  assert.ok(seen.every((entry) => entry.candidateCap <= 2));
});

test('invalid whole-deck budgets are rejected before any build attempt', async () => {
  await assert.rejects(() => buildCommanderDeckUnderWholeBudgetV15([commander], {
    maxDeckUsd: 0,
  }), /positive finite/i);
});