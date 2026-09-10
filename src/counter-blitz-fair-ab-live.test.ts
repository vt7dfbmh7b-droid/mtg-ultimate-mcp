import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from './server-v15.js';
import { validateCommanderDeck } from './services/commander-rules.js';
import { parseDecklist, type ParsedDeck } from './services/deck.js';
import { fetchPreconDeckV10 } from './services/precons-v10.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from './services/printing-policy-v08.js';
import { findDeckCombosEvidence } from './services/spellbook.js';
import { getCardOracleText, getCardsByIdentifiers, type CardIdentifierInput } from './services/scryfall.js';

const PRECON_REFERENCE = 'Counter Blitz';
const COMMANDER = "Tidus, Yuna's Guardian";
const REQUESTED_THEME = '+1/+1 counters and proliferate and countermagic and combat';
const SEED = 20260910;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

function quantityMap(parsed: ParsedDeck): Map<string, number> {
  return new Map([...parsed.commanders, ...parsed.main].map((entry) => [entry.name, entry.quantity]));
}

function diffNames(before: ParsedDeck, after: ParsedDeck): { additions: string[]; removals: string[] } {
  const a = quantityMap(before);
  const b = quantityMap(after);
  const additions: string[] = [];
  const removals: string[] = [];
  for (const [name, qty] of b) {
    const delta = qty - (a.get(name) ?? 0);
    for (let i = 0; i < delta; i += 1) additions.push(name);
  }
  for (const [name, qty] of a) {
    const delta = qty - (b.get(name) ?? 0);
    for (let i = 0; i < delta; i += 1) removals.push(name);
  }
  return { additions: additions.sort(), removals: removals.sort() };
}

async function audit(decklist: string) {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  const rules = validateCommanderDeck(parsed, resolved.cards);
  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards
    .filter((card) => !printingMatchesPolicyV08(card, policy))
    .map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`);
  const commanderNames = parsed.commanders.map((entry) => entry.name);
  const mainNames = new Set(parsed.main.map((entry) => entry.name.toLocaleLowerCase()));
  const cardByName = new Map(resolved.cards.map((card) => [card.name.toLocaleLowerCase(), card] as const));
  let plusOneCounterCards = 0;
  let proliferateCards = 0;
  let countermagicCards = 0;
  let combatCards = 0;
  for (const entry of parsed.main) {
    const card = cardByName.get(entry.name.toLocaleLowerCase());
    if (!card) continue;
    const text = getCardOracleText(card).toLocaleLowerCase();
    if (text.includes('+1/+1 counter')) plusOneCounterCards += entry.quantity;
    if (text.includes('proliferate')) proliferateCards += entry.quantity;
    if (/counter (?:target|that) [^.]*spell|counter target spell/.test(text)) countermagicCards += entry.quantity;
    if (/attack|attacking|combat damage|additional combat|double strike/.test(text)) combatCards += entry.quantity;
  }
  const comboEvidence = await findDeckCombosEvidence(decklist, 100);
  const includedCombos = Array.isArray(comboEvidence.included) ? comboEvidence.included : [];
  return {
    parsed,
    cardCount: parsed.totalCards,
    commanderNames,
    commanderLegal: rules.isLegal,
    unresolved: resolved.notFound,
    printingPolicySatisfied: offPolicy.length === 0,
    offPolicy,
    plusOneCounterCards,
    proliferateCards,
    countermagicCards,
    combatCards,
    comboVerificationComplete: comboEvidence.verificationComplete,
    comboSourceStatus: comboEvidence.sourceStatus ?? 'unknown',
    verifiedComboCount: includedCombos.length,
    verifiedCombos: includedCombos,
    containsWalkingBallista: mainNames.has('walking ballista'),
    containsDestinedWhiteMage: mainNames.has('the destined white mage'),
  };
}

test('Counter Blitz fair A/B completed FF-only refinement workflow', { timeout: 55 * 60_000 }, async () => {
  const stock = await fetchPreconDeckV10(PRECON_REFERENCE);
  assert.equal(stock.entry.name, 'Counter Blitz');
  const before = await audit(stock.decklist);
  assert.equal(before.cardCount, 100);
  assert.equal(before.commanderLegal, true);
  assert.deepEqual(before.unresolved, []);
  assert.equal(before.printingPolicySatisfied, true);
  assert.ok(before.commanderNames.some((name) => name.toLocaleLowerCase() === COMMANDER.toLocaleLowerCase()));

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'counter-blitz-fair-ab', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://counter-blitz-fair-ab.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  let raw: Record<string, unknown> = {};
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'refine_precon_v13',
      arguments: {
        reference: PRECON_REFERENCE,
        profile: 'custom',
        targetBracket: 4,
        maxSwaps: 30,
        maxRounds: 5,
        swapsPerRound: 8,
        candidatePackagesPerRound: 6,
        minimumImprovementScore: 0.1,
        themeQuery: REQUESTED_THEME,
        printingFamily: 'Final Fantasy',
        includePromos: true,
        includeSpecialReleases: true,
        excludedCards: [],
        protectedCards: [],
        simulationIterations: 1000,
        simulationTurns: 8,
        seed: SEED,
        detailLevel: 'detailed',
      },
    }, { timeout: 50 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    assert.notEqual(response.isError, true, 'completed precon workflow must execute');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'completed precon workflow must return JSON');
    raw = JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
    await handler.close();
  }

  const preconResult = record(raw.result);
  const refinement = record(preconResult.refinement);
  const finalDecklist = typeof refinement.finalDecklist === 'string' && refinement.finalDecklist.trim()
    ? refinement.finalDecklist
    : stock.decklist;
  const after = await audit(finalDecklist);
  assert.equal(after.cardCount, 100, 'finished build must contain exactly 100 cards');
  assert.equal(after.commanderLegal, true, 'finished build must be Commander legal');
  assert.deepEqual(after.unresolved, [], 'every finished card must resolve exactly');
  assert.equal(after.printingPolicySatisfied, true, 'finished build must use only FF-family physical printings');
  assert.ok(after.commanderNames.some((name) => name.toLocaleLowerCase() === COMMANDER.toLocaleLowerCase()), 'Tidus must remain commander');

  const changes = diffNames(before.parsed, after.parsed);
  const output = {
    schema: 'counter-blitz-fair-ab-v1',
    sourceSha: process.env.GITHUB_SHA ?? null,
    precon: {
      name: stock.entry.name,
      fileName: stock.entry.fileName,
      releaseDate: stock.entry.releaseDate,
    },
    request: {
      commander: COMMANDER,
      targetBracket: 4,
      printingFamily: 'Final Fantasy',
      includePromos: true,
      includeSpecialReleases: true,
      maxSwaps: 30,
      maxRounds: 5,
      swapsPerRound: 8,
      candidatePackagesPerRound: 6,
      minimumImprovementScore: 0.1,
      themeQuery: REQUESTED_THEME,
      budgetCap: null,
      seed: SEED,
      simulationIterations: 1000,
      simulationTurns: 8,
    },
    refinementStatus: refinement.status ?? null,
    totalSwaps: refinement.totalSwaps ?? changes.additions.length,
    swaps: Array.isArray(refinement.swaps) ? refinement.swaps : [],
    additions: changes.additions,
    removals: changes.removals,
    before: {
      cardCount: before.cardCount,
      plusOneCounterCards: before.plusOneCounterCards,
      proliferateCards: before.proliferateCards,
      countermagicCards: before.countermagicCards,
      combatCards: before.combatCards,
      verifiedComboCount: before.verifiedComboCount,
    },
    after: {
      cardCount: after.cardCount,
      commanderNames: after.commanderNames,
      commanderLegal: after.commanderLegal,
      printingPolicySatisfied: after.printingPolicySatisfied,
      plusOneCounterCards: after.plusOneCounterCards,
      proliferateCards: after.proliferateCards,
      countermagicCards: after.countermagicCards,
      combatCards: after.combatCards,
      comboVerificationComplete: after.comboVerificationComplete,
      comboSourceStatus: after.comboSourceStatus,
      verifiedComboCount: after.verifiedComboCount,
      verifiedCombos: after.verifiedCombos,
      containsWalkingBallista: after.containsWalkingBallista,
      containsDestinedWhiteMage: after.containsDestinedWhiteMage,
    },
    finalDecklist,
    rawRefinement: refinement,
  };
  console.log(`COUNTER_BLITZ_AB_RESULT=${JSON.stringify(output)}`);
});
