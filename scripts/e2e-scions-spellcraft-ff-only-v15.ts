import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import {
  cardCommanderStrategyAffinityV15,
  deriveCommanderStrategyContextV15,
} from '../src/services/commander-strategy-affinity-v15.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { fetchPreconDeckV10 } from '../src/services/precons-v10.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { findDeckCombosEvidence } from '../src/services/spellbook.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';

const PRECON_REFERENCE = 'ScionsSpellcraftFinalFantasyXiv_FIC';
const TARGET_BRACKET = 4;
const COMMANDER = "Y'shtola, Night's Blessed";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

function infiniteComboKey(combo: Record<string, unknown>): string {
  if (typeof combo.id === 'string' && combo.id.trim()) return combo.id;
  const cards = Array.isArray(combo.cards)
    ? combo.cards.map(record).map((card) => String(card.name ?? '')).filter(Boolean).sort().join('|')
    : '';
  const results = Array.isArray(combo.results) ? combo.results.map(String).sort().join('|') : '';
  return `${cards}::${results}`;
}

function infiniteCombos(evidence: Record<string, unknown>): Record<string, unknown>[] {
  const included = Array.isArray(evidence.included) ? evidence.included.map(record) : [];
  return included.filter((combo) => {
    const results = Array.isArray(combo.results) ? combo.results.map(String).join(' | ') : '';
    const description = typeof combo.description === 'string' ? combo.description : '';
    return /\binfinite\b/i.test(`${results} | ${description}`);
  });
}

async function auditDeck(decklist: string): Promise<Record<string, unknown>> {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'Scions control must contain exactly 100 cards');
  assert.ok(
    parsed.commanders.some((entry) => entry.name.toLocaleLowerCase() === COMMANDER.toLocaleLowerCase()),
    `Scions control must keep ${COMMANDER} in the command zone`,
  );

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact Scions deck entry must resolve');
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, 'Scions control must pass Commander legality');

  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    'Scions control must use only FINAL FANTASY-family physical printings',
  );

  const strategyContext = deriveCommanderStrategyContextV15(parsed, resolved.cards);
  const spellsControlCommanderScore = strategyContext.strategies
    .find((strategy) => strategy.archetype === 'spells-control')?.score ?? 0;
  const cardByName = new Map(resolved.cards.map((card) => [card.name.toLocaleLowerCase(), card] as const));
  let spellsControlSupportCount = 0;
  let spellsControlAffinityTotal = 0;
  let yshtolaTriggerSpellCount = 0;
  let noncreatureSpellCount = 0;
  let lifeDrainRoleCount = 0;

  for (const entry of parsed.main) {
    const card = cardByName.get(entry.name.toLocaleLowerCase());
    if (!card) continue;
    const isCreature = card.type_line.toLocaleLowerCase().includes('creature');
    if (!isCreature) {
      noncreatureSpellCount += entry.quantity;
      if (card.cmc >= 3) yshtolaTriggerSpellCount += entry.quantity;
    }
    if (inferCardRoles(card).includes('life drain')) lifeDrainRoleCount += entry.quantity;
    const match = cardCommanderStrategyAffinityV15(card, strategyContext).matches
      .find((candidate) => candidate.archetype === 'spells-control');
    if (!match || match.overlapScore <= 0) continue;
    spellsControlSupportCount += entry.quantity;
    spellsControlAffinityTotal += match.overlapScore * entry.quantity;
  }

  const comboEvidence = await findDeckCombosEvidence(decklist, 100);
  assert.equal(
    comboEvidence.verificationComplete,
    true,
    'Commander Spellbook combo verification must be complete before claiming the no-infinite constraint passed',
  );
  const infinites = infiniteCombos(comboEvidence);

  const evaluation = await evaluateCommanderBuildV15(decklist, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    optimizedPlanEvidence: false,
    competitiveMetagameEvidence: false,
    constraintDescriptions: [
      'Exact Scions & Spellcraft stock-precon lineage.',
      'FINAL FANTASY physical printings only.',
      'No newly introduced infinite combo.',
      "Preserve Y'shtola's original noncreature-spell control/drain win plan.",
    ],
  });

  return {
    cardCount: parsed.totalCards,
    commanderLegal: rules.isLegal,
    printingPolicySatisfied: offPolicy.length === 0,
    commanderNames: parsed.commanders.map((entry) => entry.name),
    setCodes: [...new Set(resolved.cards.map((card) => card.set.toUpperCase()))].sort(),
    commanderStrategies: strategyContext.strategies,
    spellsControlCommanderScore,
    spellsControlSupportCount,
    spellsControlAffinityTotal,
    yshtolaTriggerSpellCount,
    noncreatureSpellCount,
    lifeDrainRoleCount,
    infiniteCombos: infinites,
    infiniteComboKeys: infinites.map(infiniteComboKey).sort(),
    comboSourceStatus: comboEvidence.sourceStatus ?? 'unknown',
    assessedBracket: evaluation.actualBracket.assessedBracket,
    assessedBand: evaluation.actualBracket.assessedBand,
    metrics: {
      averageNonlandManaValue: evaluation.metrics.averageNonlandManaValue,
      earlyPlayCount: evaluation.metrics.earlyPlayCount,
      cheapInteractionCount: evaluation.metrics.cheapInteractionCount,
      fastManaCount: evaluation.metrics.fastManaCount,
      tutorCount: evaluation.metrics.tutorCount,
      recursionCount: evaluation.metrics.recursionCount,
      boardWipeCount: evaluation.metrics.boardWipeCount,
      rampCount: evaluation.metrics.rampCount,
      drawCount: evaluation.metrics.drawCount,
      interactionCount: evaluation.metrics.interactionCount,
      protectionCount: evaluation.metrics.protectionCount,
      persistentColoredManaSourceCount: evaluation.metrics.persistentColoredManaSourceCount,
    },
  };
}

async function main(): Promise<void> {
  const stock = await fetchPreconDeckV10(PRECON_REFERENCE);
  assert.equal(stock.entry.fileName, PRECON_REFERENCE, 'control must bind the exact MTGJSON Scions & Spellcraft product');
  const before = await auditDeck(stock.decklist);
  assert.ok(
    finite(before.spellsControlCommanderScore) >= 6,
    "Y'shtola must expose a substantive spells-control command-zone signal before refinement",
  );

  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: 'scions-spellcraft-ff-only-v15', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://scions-spellcraft-ff-only.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  let result: Record<string, unknown> = {};
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'refine_precon_v13',
      arguments: {
        reference: PRECON_REFERENCE,
        profile: 'custom',
        targetBracket: TARGET_BRACKET,
        maxSwaps: 12,
        maxRounds: 4,
        swapsPerRound: 4,
        candidatePackagesPerRound: 5,
        minimumImprovementScore: 0.1,
        printingFamily: 'Final Fantasy',
        includePromos: true,
        includeSpecialReleases: true,
        simulationIterations: 750,
        simulationTurns: 7,
        seed: 20260823,
        detailLevel: 'detailed',
      },
    }, { timeout: 20 * 60_000 }) as unknown as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    assert.notEqual(response.isError, true, 'Scions refinement MCP call must execute');
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, 'Scions refinement MCP call must return JSON');
    result = JSON.parse(text) as Record<string, unknown>;
    await writeFile('scions-spellcraft-ff-only-raw-result.json', `${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
    await handler.close();
  }

  const preconResult = record(result.result);
  const refinement = record(preconResult.refinement);
  assert.equal(refinement.status, 'refined', 'addressable Scions precon must produce a supported refinement');
  assert.ok(finite(refinement.totalSwaps) > 0, 'Scions refinement must accept at least one swap');
  const finalDecklist = typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist : '';
  assert.ok(finalDecklist.trim(), 'Scions refinement must return the complete final decklist');

  await writeFile('scions-spellcraft-stock-deck.txt', `${stock.decklist.trim()}\n`);
  await writeFile('scions-spellcraft-refined-deck.txt', `${finalDecklist.trim()}\n`);

  const after = await auditDeck(finalDecklist);
  const beforeInfinite = new Set(Array.isArray(before.infiniteComboKeys) ? before.infiniteComboKeys.map(String) : []);
  const afterInfinite = Array.isArray(after.infiniteComboKeys) ? after.infiniteComboKeys.map(String) : [];
  const newInfinite = afterInfinite.filter((key) => !beforeInfinite.has(key));
  const candidateEvidence = {
    schema: 'scions-spellcraft-candidate-audit-v15.1',
    sourceBaseline: 'MTGJSON exact stock deck',
    precon: {
      name: stock.entry.name,
      fileName: stock.entry.fileName,
      releaseDate: stock.entry.releaseDate,
      commanders: (stock.deck.commander ?? []).map((card) => card.name),
    },
    request: {
      targetBracket: TARGET_BRACKET,
      printingFamily: 'Final Fantasy',
      maxSwaps: 12,
      infiniteComboPolicy: 'no-new-infinite-combos',
      strategyPolicy: "preserve Y'shtola noncreature-spell control/drain win plan",
    },
    before,
    refinement,
    after,
    validationPreview: {
      newInfiniteCombos: newInfinite,
      spellsControlAffinityDelta: finite(after.spellsControlAffinityTotal) - finite(before.spellsControlAffinityTotal),
      spellsControlSupportDelta: finite(after.spellsControlSupportCount) - finite(before.spellsControlSupportCount),
      yshtolaTriggerSpellDelta: finite(after.yshtolaTriggerSpellCount) - finite(before.yshtolaTriggerSpellCount),
      noncreatureSpellDelta: finite(after.noncreatureSpellCount) - finite(before.noncreatureSpellCount),
      lifeDrainRoleDelta: finite(after.lifeDrainRoleCount) - finite(before.lifeDrainRoleCount),
      assessedBracketDelta: finite(after.assessedBracket) - finite(before.assessedBracket),
    },
  };
  await writeFile('scions-spellcraft-candidate-audit.json', `${JSON.stringify(candidateEvidence, null, 2)}\n`);

  assert.ok(
    finite(after.assessedBracket) >= finite(before.assessedBracket),
    'Scions refinement must not lower the independently assessed bracket',
  );
  assert.ok(
    finite(after.spellsControlAffinityTotal) >= finite(before.spellsControlAffinityTotal),
    "Scions refinement must not reduce whole-deck affinity with Y'shtola's spells-control plan",
  );
  assert.ok(
    finite(after.spellsControlSupportCount) >= finite(before.spellsControlSupportCount),
    'Scions refinement must not reduce spells-control support density',
  );
  assert.ok(
    finite(after.yshtolaTriggerSpellCount) >= finite(before.yshtolaTriggerSpellCount),
    "Scions refinement must not reduce the number of MV3+ noncreature spells that directly trigger Y'shtola",
  );
  assert.deepEqual(newInfinite, [], 'Scions refinement must not introduce any new Commander Spellbook infinite combo');

  const detailedRounds = Array.isArray(refinement.detailedRounds)
    ? refinement.detailedRounds.map(record)
    : [];
  const acceptedRounds = detailedRounds.filter((round) => round.accepted === true);
  assert.ok(acceptedRounds.length > 0, 'Scions refinement must retain accepted-round evidence');
  for (const round of acceptedRounds) {
    const comparisons = Array.isArray(round.candidateComparisons)
      ? round.candidateComparisons.map(record)
      : [];
    const winner = comparisons.find((candidate) => candidate.candidate === round.winningCandidate);
    const strategy = record(winner?.strategyPreservation);
    assert.equal(strategy.evidenceComplete, true, `accepted round ${String(round.round)} must retain complete strategy evidence`);
    assert.equal(strategy.status, 'preserved', `accepted round ${String(round.round)} must preserve the commander strategy`);
    assert.deepEqual(strategy.meaningfulLosses, [], `accepted round ${String(round.round)} must not accept a meaningful strategy loss`);
    const provenance = record(winner?.planProvenance);
    assert.notEqual(
      provenance.winPackageOutcome,
      'verified-package-injected',
      `accepted round ${String(round.round)} must not inject a verified combo package at Bracket 4`,
    );
  }

  const output = {
    ...candidateEvidence,
    schema: 'scions-spellcraft-ff-only-v15.1',
    validation: candidateEvidence.validationPreview,
  };

  await writeFile('scions-spellcraft-ff-only-result.json', `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    precon: stock.entry.name,
    status: refinement.status,
    totalSwaps: refinement.totalSwaps,
    beforeBracket: before.assessedBracket,
    afterBracket: after.assessedBracket,
    beforeSpellsControlAffinity: before.spellsControlAffinityTotal,
    afterSpellsControlAffinity: after.spellsControlAffinityTotal,
    beforeYshTriggerSpells: before.yshtolaTriggerSpellCount,
    afterYshTriggerSpells: after.yshtolaTriggerSpellCount,
    newInfiniteCombos: newInfinite,
    swaps: refinement.swaps ?? [],
  }, null, 2));
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('scions-spellcraft-ff-only-failure.txt', `${message}\n`).catch(() => undefined);
  process.exitCode = 1;
});