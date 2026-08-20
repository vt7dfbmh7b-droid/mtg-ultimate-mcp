import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { neutralCommanderLookupNameV15 } from '../src/services/neutral-deck-builder-v15.js';
import {
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
} from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, getCardsByNames, type CardIdentifierInput } from '../src/services/scryfall.js';

const SETS = ['LTR', 'LTC', 'HOB', 'HOC'] as const;
const CANDIDATES: Array<{ label: string; commanderNames: string[] }> = [
  { label: 'Tom Bombadil', commanderNames: ['Tom Bombadil'] },
  { label: 'Aragorn, the Uniter', commanderNames: ['Aragorn, the Uniter'] },
  { label: 'Sauron, the Dark Lord', commanderNames: ['Sauron, the Dark Lord'] },
  { label: 'Frodo + Sam', commanderNames: ['Frodo, Adventurous Hobbit', 'Sam, Loyal Attendant'] },
  { label: 'Galadriel, Light of Valinor', commanderNames: ['Galadriel, Light of Valinor'] },
  { label: 'Éowyn, Shieldmaiden', commanderNames: ['Éowyn, Shieldmaiden'] },
  { label: 'Bilbo, Birthday Celebrant', commanderNames: ['Bilbo, Birthday Celebrant'] },
  { label: 'Saruman of Many Colors', commanderNames: ['Saruman of Many Colors'] },
  { label: 'Bilbo, Luckwearer // Burglar\'s Plot', commanderNames: ['Bilbo, Luckwearer // Burglar\'s Plot'] },
];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function ids(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}
async function policy() {
  return resolvePrintingPolicyV08({ allowedSets: [...SETS], includePromos: true, includeSpecialReleases: true });
}
async function refs(names: string[]): Promise<Array<{ name: string; set: string; collectorNumber: string }>> {
  const p = await policy();
  const lookups = names.map(neutralCommanderLookupNameV15);
  const resolved = await getCardsByNames(lookups);
  assert.deepEqual(resolved.notFound, [], `commander resolution failed for ${names.join(' + ')}`);
  const output: Array<{ name: string; set: string; collectorNumber: string }> = [];
  for (const requested of names) {
    const lookup = neutralCommanderLookupNameV15(requested).toLocaleLowerCase();
    const card = resolved.cards.find((candidate) => neutralCommanderLookupNameV15(candidate.name).toLocaleLowerCase() === lookup);
    assert.ok(card, `${requested} did not bind to Oracle data`);
    const printing = await selectEligiblePrintingV08(card, p);
    assert.ok(printing, `${requested} has no eligible LTR/LTC/HOB/HOC printing`);
    output.push({ name: printing.card.name, set: printing.card.set.toUpperCase(), collectorNumber: printing.card.collector_number });
  }
  return output;
}
async function verify(decklist: string) {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100);
  const resolved = await getCardsByIdentifiers(ids(parsed));
  assert.deepEqual(resolved.notFound, []);
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true);
  const p = await policy();
  const off = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, p));
  assert.deepEqual(off.map((card) => `${card.name} (${card.set}) ${card.collector_number}`), []);
  return {
    cardCount: parsed.totalCards,
    setCodes: [...new Set(resolved.cards.map((card) => card.set.toUpperCase()))].sort(),
  };
}

async function main(): Promise<void> {
  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client({ name: 'middle-earth-expanded-b5', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StreamableHTTPClientTransport(new URL('http://middle-earth-expanded.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  const successes: Array<Record<string, unknown> & { decklist: string; scoreKey: [number, number, number] }> = [];
  const failures: Array<Record<string, unknown>> = [];
  try {
    await client.connect(transport);
    for (const candidate of CANDIDATES) {
      console.log(`BUILD ${candidate.label}`);
      try {
        const commanderRefs = await refs(candidate.commanderNames);
        const response = await client.callTool({
          name: 'build_commander_through_pipeline_v15',
          arguments: {
            commanders: commanderRefs,
            targetBracket: 5,
            allowedSets: [...SETS],
            includePromos: true,
            includeSpecialReleases: true,
            winPackageMode: 'prefer',
            maxWinPackageCards: 3,
            cedhIntent: true,
            optimizedPlanEvidence: true,
            competitiveMetagameEvidence: false,
          },
        }, { timeout: 12 * 60_000 }) as unknown as { content: Array<{ type: string; text?: string }>; isError?: boolean };
        assert.notEqual(response.isError, true);
        const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
        assert.ok(text);
        const result = JSON.parse(text) as Record<string, unknown>;
        if (result.status !== 'complete-evaluated-build') {
          failures.push({ candidate: candidate.label, status: result.status ?? null, guidance: result.guidance ?? null });
          continue;
        }
        const evaluation = record(result.evaluation);
        const actual = record(evaluation.actualBracket);
        const post = record(evaluation.postBuildEvidence);
        const built = record(result.built);
        const decklist = typeof built.decklist === 'string' ? built.decklist : '';
        assert.ok(decklist);
        const truth = await verify(decklist);
        const achievedBracket = finite(result.achievedBracket, -1);
        const construction = actual.bracket5ConstructionCandidate === true;
        const wins = finite(post.verifiedWinningCombos);
        successes.push({
          candidate: candidate.label,
          commanderNames: candidate.commanderNames,
          commanderRefs,
          achievedBracket,
          achievedBand: result.achievedBand ?? null,
          bracket5ConstructionCandidate: construction,
          bracket5Certified: actual.bracket5CertifiedByThisAssessment === true,
          verifiedWinningCombos: wins,
          thresholdChecks: actual.bracket5ThresholdChecks,
          metrics: evaluation.metrics,
          selectedPackage: result.selectedPackage ?? null,
          targetComparison: result.targetComparison ?? null,
          exactPrintingVerification: truth,
          decklist,
          scoreKey: [Number(construction), achievedBracket, wins],
        });
        console.log(`${candidate.label}: bracket=${achievedBracket} constructionB5=${construction} wins=${wins}`);
      } catch (error) {
        failures.push({ candidate: candidate.label, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } finally {
    await client.close();
    await handler.close();
  }
  assert.ok(successes.length > 0, JSON.stringify(failures));
  successes.sort((a, b) => b.scoreKey[0] - a.scoreKey[0] || b.scoreKey[1] - a.scoreKey[1] || b.scoreKey[2] - a.scoreKey[2] || String(a.candidate).localeCompare(String(b.candidate)));
  const selected = successes[0]!;

  const handler2 = createMcpHandler(createMtgServerV15);
  const client2 = new Client({ name: 'middle-earth-expanded-refine', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport2 = new StreamableHTTPClientTransport(new URL('http://middle-earth-expanded-refine.local/mcp'), {
    fetch: (url, init) => handler2.fetch(new Request(url, init)),
  });
  let refinement: Record<string, unknown> = {};
  try {
    await client2.connect(transport2);
    const response = await client2.callTool({
      name: 'refine_commander_deck_v12',
      arguments: {
        decklist: selected.decklist,
        targetBracket: 5,
        allowedSets: [...SETS],
        includePromos: true,
        includeSpecialReleases: true,
        maxSwaps: 20,
        maxRounds: 5,
        swapsPerRound: 5,
        candidatePackagesPerRound: 5,
        minimumImprovementScore: 0.1,
        simulationIterations: 750,
        simulationTurns: 7,
        seed: 20260821,
        detailLevel: 'detailed',
      },
    }, { timeout: 12 * 60_000 }) as unknown as { content: Array<{ type: string; text?: string }>; isError?: boolean };
    assert.notEqual(response.isError, true);
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text);
    refinement = JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client2.close();
    await handler2.close();
  }
  const finalDeck = typeof refinement.finalDecklist === 'string' && refinement.finalDecklist.trim() ? refinement.finalDecklist : selected.decklist;
  const finalTruth = await verify(finalDeck);
  const finalEvaluation = await evaluateCommanderBuildV15(finalDeck, {
    allowedSets: [...SETS], includePromos: true, includeSpecialReleases: true,
    cedhIntent: true, optimizedPlanEvidence: true, competitiveMetagameEvidence: false,
  });

  const output = {
    schema: 'middle-earth-bracket5-expanded-v15.1',
    allowedSets: [...SETS],
    successes: successes.map(({ decklist: _decklist, scoreKey: _scoreKey, ...item }) => item),
    failures,
    selected: (() => { const { decklist: _decklist, scoreKey: _scoreKey, ...item } = selected; return item; })(),
    refinement: {
      status: refinement.status ?? null,
      stopReason: refinement.stopReason ?? null,
      roundsAccepted: refinement.roundsAccepted ?? null,
      totalSwaps: refinement.totalSwaps ?? null,
      swaps: Array.isArray(refinement.swaps) ? refinement.swaps : [],
      finalBracket: finalEvaluation.actualBracket.assessedBracket,
      finalBand: finalEvaluation.actualBracket.assessedBand,
      finalBracket5ConstructionCandidate: finalEvaluation.actualBracket.bracket5ConstructionCandidate,
      finalBracket5Certified: finalEvaluation.actualBracket.bracket5CertifiedByThisAssessment,
      finalThresholdChecks: finalEvaluation.actualBracket.bracket5ThresholdChecks,
      finalMetrics: finalEvaluation.metrics,
      finalVerifiedWinningCombos: finalEvaluation.postBuildEvidence.verifiedWinningCombos,
      exactPrintingVerification: finalTruth,
    },
  };
  await writeFile('middle-earth-bracket5-expanded-result.json', `${JSON.stringify(output, null, 2)}\n`);
  await writeFile('middle-earth-bracket5-expanded-selected-deck.txt', `${selected.decklist.trim()}\n`);
  await writeFile('middle-earth-bracket5-expanded-refined-deck.txt', `${finalDeck.trim()}\n`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('middle-earth-bracket5-expanded-failure.txt', `${message}\n`).catch(() => undefined);
  process.exitCode = 1;
});
