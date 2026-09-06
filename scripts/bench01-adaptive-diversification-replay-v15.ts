import assert from 'node:assert/strict';
import { unlink, writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { fetchPreconDeckV10 } from '../src/services/precons-v10.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';

const FROZEN_PRODUCT_SHA = process.env.FROZEN_PRODUCT_SHA?.trim();
assert.ok(FROZEN_PRODUCT_SHA, 'FROZEN_PRODUCT_SHA must be supplied by the BENCH workflow');
const MAX_NZD_PER_CARD = 50;
const MAX_TOTAL_NZD = 250;
const MAX_SWAPS = 12;

const FIXTURES = [
  { id: 'quick-draw', reference: 'Quick Draw', family: 'spellslinger-control', targetBracket: 4, themeQuery: 'spellslinger card draw countermagic', breadth4Swaps: 8, breadth4Bracket: 3, breadth6Swaps: 8, breadth6Bracket: 3 },
  { id: 'virtue-and-valor', reference: 'Virtue and Valor', family: 'enchantment-combat', targetBracket: 4, themeQuery: 'enchantments combat card draw', breadth4Swaps: 4, breadth4Bracket: 2, breadth6Swaps: 4, breadth6Bracket: 2 },
  { id: 'explorers-of-the-deep', reference: 'Explorers of the Deep', family: 'typal-counters-combat', targetBracket: 4, themeQuery: 'Merfolk +1/+1 counters card draw combat', breadth4Swaps: 4, breadth4Bracket: 2, breadth6Swaps: 9, breadth6Bracket: 3 },
  { id: 'elven-empire', reference: 'Elven Empire', family: 'typal-tokens-combat', targetBracket: 4, themeQuery: 'Elves tokens combat', breadth4Swaps: null, breadth4Bracket: null, breadth6Swaps: null, breadth6Bracket: null },
  { id: 'animated-army', reference: 'Animated Army', family: 'artifact-enchantment-combat', targetBracket: 4, themeQuery: 'artifacts enchantments combat', breadth4Swaps: 9, breadth4Bracket: 2, breadth6Swaps: 12, breadth6Bracket: 3 },
] as const;

type Json = Record<string, unknown>;
function record(value: unknown): Json { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {}; }
function finite(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function identifiers(parsed: ParsedDeck): CardIdentifierInput[] { return [...parsed.commanders, ...parsed.main].map((entry) => ({ name: entry.name, ...(entry.set ? { set: entry.set } : {}), ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}) })); }

async function auditDeck(decklist: string): Promise<Json> {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every benchmark deck entry must resolve');
  const legality = validateCommanderDeck(parsed, resolved.cards);
  const evaluation = await evaluateCommanderBuildV15(decklist, { optimizedPlanEvidence: false, competitiveMetagameEvidence: false, constraintDescriptions: ['BENCH-01 adaptive diversification post-repair replay; target bracket is measured, not declared.'] });
  return {
    cardCount: parsed.totalCards,
    commanderLegal: legality.isLegal,
    unresolvedCount: resolved.notFound.length,
    commanderNames: parsed.commanders.map((entry) => entry.name).sort((a, b) => a.localeCompare(b)),
    assessedBracket: evaluation.actualBracket.assessedBracket,
    assessedBand: evaluation.actualBracket.assessedBand,
    metrics: {
      averageNonlandManaValue: evaluation.metrics.averageNonlandManaValue,
      earlyPlayCount: evaluation.metrics.earlyPlayCount,
      fastManaCount: evaluation.metrics.fastManaCount,
      cheapInteractionCount: evaluation.metrics.cheapInteractionCount,
      tutorCount: evaluation.metrics.tutorCount,
      recursionCount: evaluation.metrics.recursionCount,
      boardWipeCount: evaluation.metrics.boardWipeCount,
      rampCount: evaluation.metrics.rampCount,
      drawCount: evaluation.metrics.drawCount,
      interactionCount: evaluation.metrics.interactionCount,
      protectionCount: evaluation.metrics.protectionCount,
    },
    postBuildEvidence: evaluation.postBuildEvidence,
  };
}

function terminalRound(refinement: Json): Json | null { const rounds = Array.isArray(refinement.rounds) ? refinement.rounds.map(record) : []; return rounds.length > 0 ? rounds[rounds.length - 1] ?? null : null; }

async function runFixture(fixture: typeof FIXTURES[number]): Promise<Json> {
  const stock = await fetchPreconDeckV10(fixture.reference);
  const before = await auditDeck(stock.decklist);
  assert.equal(before.cardCount, 100, `${fixture.reference} stock fixture must contain 100 cards`);
  assert.equal(before.commanderLegal, true, `${fixture.reference} stock fixture must be Commander legal`);
  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client({ name: `bench01-adaptive-${fixture.id}`, version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StreamableHTTPClientTransport(new URL(`http://bench01-adaptive-${fixture.id}.local/mcp`), { fetch: (url, init) => handler.fetch(new Request(url, init)) });
  let rawResult: Json = {};
  try {
    await client.connect(transport);
    const response = await client.callTool({ name: 'refine_precon_v13', arguments: {
      reference: fixture.reference,
      profile: 'custom',
      targetBracket: fixture.targetBracket,
      maxNzdPerCard: MAX_NZD_PER_CARD,
      maxTotalNzd: MAX_TOTAL_NZD,
      maxSwaps: MAX_SWAPS,
      maxRounds: 4,
      swapsPerRound: 4,
      minimumImprovementScore: 0.1,
      themeQuery: fixture.themeQuery,
      simulationIterations: 400,
      simulationTurns: 7,
      seed: 20260906,
      detailLevel: 'detailed',
    } }, { timeout: 30 * 60_000 }) as unknown as { content: Array<{ type: string; text?: string }>; isError?: boolean };
    assert.notEqual(response.isError, true, `${fixture.reference} adaptive refinement must execute`);
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, `${fixture.reference} adaptive refinement must return JSON`);
    rawResult = JSON.parse(text) as Json;
  } finally { await client.close(); await handler.close(); }
  const preconResult = record(rawResult.result);
  const refinement = record(preconResult.refinement);
  const adaptiveContract = record(refinement.candidateDiversification);
  assert.equal(adaptiveContract.adaptive, true, `${fixture.reference} must execute with adaptive candidate diversification active`);
  assert.equal(adaptiveContract.minimumAttempts, 3, `${fixture.reference} must retain the historical three-attempt minimum`);
  assert.equal(adaptiveContract.hardLimit, 6, `${fixture.reference} must retain the bounded six-attempt hard ceiling`);
  const finalDecklist = typeof refinement.finalDecklist === 'string' && refinement.finalDecklist.trim() ? refinement.finalDecklist.trim() : stock.decklist.trim();
  const after = await auditDeck(finalDecklist);
  assert.deepEqual(after.commanderNames, before.commanderNames, `${fixture.reference} must preserve the command zone`);
  const rounds = Array.isArray(refinement.rounds) ? refinement.rounds.map(record) : [];
  return {
    fixture: `BENCH-01 adaptive diversification replay / ${fixture.reference}`,
    family: fixture.family,
    reference: fixture.reference,
    themeQuery: fixture.themeQuery,
    productRuntimeBaselineSha: FROZEN_PRODUCT_SHA,
    sourceFrozenWithinBatch: true,
    adaptiveContract,
    totalSwaps: finite(refinement.totalSwaps),
    assessedBracket: finite(after.assessedBracket),
    before,
    after,
    terminalRound: terminalRound(refinement),
    candidateWork: {
      rounds: rounds.map((round) => ({
        round: round.round ?? null,
        accepted: round.accepted ?? null,
        candidatePackagesGenerated: round.candidatePackagesGenerated ?? null,
        candidatePackagesGeneratedAcrossAttempts: round.candidatePackagesGeneratedAcrossAttempts ?? null,
        candidateAttemptSizes: round.candidateAttemptSizes ?? null,
        winningCandidate: round.winningCandidate ?? null,
        stopReason: round.stopReason ?? null,
      })),
      totalPackagesGeneratedAcrossAttempts: rounds.reduce((sum, round) => sum + finite(round.candidatePackagesGeneratedAcrossAttempts), 0),
    },
    priorBreadthEvidence: {
      breadth4: { totalSwaps: fixture.breadth4Swaps, assessedBracket: fixture.breadth4Bracket },
      breadth6: { totalSwaps: fixture.breadth6Swaps, assessedBracket: fixture.breadth6Bracket },
    },
    rawRefinement: refinement,
  };
}

async function main(): Promise<void> {
  await unlink('bench01-adaptive-diversification-replay-result.json').catch(() => undefined);
  const results: Json[] = [];
  for (const fixture of FIXTURES) results.push(await runFixture(fixture));
  const output = {
    schema: 'bench01-adaptive-diversification-replay-v2',
    batch: 'BENCH-01-ADAPTIVE-DIVERSIFICATION-REPLAY',
    productRuntimeBaselineSha: FROZEN_PRODUCT_SHA,
    sourceFrozenWithinBatch: true,
    noCommanderIntelligenceChangesBetweenFixtures: true,
    explicitCandidatePackagesPerRoundOmitted: true,
    adaptiveContractRequired: { minimumAttempts: 3, hardLimit: 6, adaptive: true },
    purpose: 'Validate whether the bounded adaptive diversification repair recovers broader-search quality on affected fixtures without regressing unrelated controls, while exposing actual candidate-work cost.',
    acceptanceRule: 'Affected fixtures Explorers of the Deep and Animated Army should recover meaningful breadth-6 quality without violating legality/theme/strategy gates; Quick Draw, Virtue and Valor, and Elven Empire must not materially regress. Whole-deck manual review remains required before product acceptance.',
    results,
  };
  await writeFile('bench01-adaptive-diversification-replay-result.json', `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  await writeFile('bench01-adaptive-diversification-replay-failure.txt', `${message}\n`).catch(() => undefined);
  console.error(message);
  process.exitCode = 1;
});
