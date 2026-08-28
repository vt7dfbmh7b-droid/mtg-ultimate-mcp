import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { assessCedhReadinessV14 } from '../src/services/cedh-workflow-v14.js';
import { completeBestCedhWinPackageV14 } from '../src/services/cedh-win-package-v14.js';

const VERSION_A = `// COMMANDER
1 Tidus, Yuna's Guardian (FIC) 5

// MAIN
1 Esper Origins // Summon: Esper Maduin (FIN) 185
1 Bugenhagen, Wise Elder (FIC) 66
1 Mind Stone (FIC) 353
1 Arcane Denial (RFIN) J2
1 Kinnan, Bonder Prodigy (FCA) 55
1 Sidequest: Raise a Chocobo // Black Chocobo (FIN) 201
1 Lunatic Pandora (FIN) 262
1 Dreams of Laguna (FIN) 50
1 Sol Ring (FIC) 356
1 Walking Ballista (FIC) 371
1 Blitzball Stadium (FIC) 34
1 From Father to Son (FIN) 20
1 Birds of Paradise (FIC) 483
1 Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal (FIN) 39
1 Cyclonic Rift (SLD) 1869
1 Summoner's Sending (FIC) 29
1 Swords to Plowshares (FIC) 256
1 Loran of the Third Path (FCA) 24
1 Zack Fair (FIN) 45
1 Path to Exile (FIC) 248
1 Cloud, Midgar Mercenary (FIN) 10
1 Swiftfoot Boots (FIC) 361
1 Cryptic Command (FCA) 29
1 Sword of Truth and Justice (SLD) 1867
1 Ranger-Captain of Eos (FCA) 2
1 Force of Negation (RFIN) J1
1 Lightning Greaves (FIC) 349
1 Tireless Tracker (FIC) 316
1 Tidus, Blitzball Star (FIN) 246
1 Heroic Intervention (SLD) 1872
1 An Offer You Can't Refuse (FIC) 267
1 Chasm Skulker (FIC) 262
1 Bred for the Hunt (FIC) 321
1 Conformer Shuriken (FIC) 98
1 Fathom Mage (FIC) 325
1 Warrior's Resolve (FIC) 465
1 Gyre Sage (FIC) 306
1 Inspiring Call (FIC) 310
1 Generous Patron (FIC) 305
1 Campsite Cuisine (FIC) 464
1 Tome of Legends (FIC) 369
1 Rhystic Study (FCA) 31
1 Hardened Scales (FIC) 307
1 Retrieve the Esper (FIN) 68
1 Mask of Memory (FIC) 350
1 Collective Effort (FIC) 237
1 Sram, Senior Edificer (FCA) 3
1 Fight Rigging (FIC) 303
1 Smuggler's Copter (FCA) 62
1 Puresteel Paladin (FIC) 250
1 Buster Sword (FIN) 255
1 Staff of the Storyteller (SLD) 1863
1 Mangara, the Diplomat (FCA) 25
1 Champions from Beyond (FIC) 11
1 Sphere Grid (FIC) 70
1 Key to the City (FIC) 348
1 Archmage Emeritus (FIC) 261
1 Torgal, A Fine Hound (FIN) 208
1 Sazh's Chocobo (FIN) 200
1 Garnet, Princess of Alexandria (FIN) 222
1 Skullclamp (FIC) 355
1 Lord Jyscal Guado (FIC) 23
1 Command Tower (FIC) 382
1 Exotic Orchard (FIC) 390
1 Spire of Industry (FIC) 426
1 Path of Ancestry (FIC) 411
1 Capital City (FIN) 274
1 Starting Town (FIN) 289
1 Overflowing Basin (FIC) 410
1 Balamb Garden, SeeD Academy // Balamb Garden, Airborne (FIN) 272
1 Brushland (FIC) 377
1 Flooded Grove (FIC) 393
1 Skycloud Expanse (FIC) 423
1 Sungrass Prairie (FIC) 428
7 Forest (FIC) 482
6 Island (FIC) 479
6 Plains (FIC) 478
1 Gatta and Luzzu (FIC) 19
1 Silence (SLD) 7003
1 Counterspell (FCA) 4
1 Conqueror's Flail (FIC) 340
1 Syncopate (FIN) 80
1 Nature's Claim (FCA) 47`;

const ff = {
  printingFamily: 'Final Fantasy',
  includePromos: true,
  includeSpecialReleases: true,
} as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function conciseEvaluation(evaluation: Awaited<ReturnType<typeof evaluateCommanderBuildV15>>) {
  return {
    hardGatesPassed: evaluation.hardGatesPassed,
    printingPolicySatisfied: evaluation.printingPolicySatisfied,
    cardCount: evaluation.parsed.totalCards,
    commanderLegal: evaluation.commanderRules.isLegal,
    assessedBracket: evaluation.actualBracket.assessedBracket,
    assessedBand: evaluation.actualBracket.assessedBand,
    bracket5ConstructionCandidate: evaluation.actualBracket.bracket5ConstructionCandidate,
    failedBracket5Checks: evaluation.actualBracket.bracket5ThresholdChecks.filter((check) => !check.passed).map((check) => check.key),
    metrics: evaluation.metrics,
    verifiedWinningCombos: evaluation.postBuildEvidence.verifiedWinningCombos,
  };
}

async function runRefinement(seed: number): Promise<Record<string, unknown>> {
  const handler = createMcpHandler(createMtgServerV15);
  const client = new Client(
    { name: `mtg-ultimate-counter-blitz-a2-${seed}`, version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL(`http://counter-blitz-a2-${seed}.local/mcp`), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'refine_commander_deck_v12',
      arguments: {
        decklist: VERSION_A,
        targetBracket: 5,
        printingFamily: 'Final Fantasy',
        includePromos: true,
        includeSpecialReleases: true,
        maxSwaps: 20,
        maxRounds: 5,
        swapsPerRound: 5,
        candidatePackagesPerRound: 5,
        minimumImprovementScore: 0.1,
        simulationIterations: 750,
        simulationTurns: 7,
        seed,
        detailLevel: 'detailed',
      },
    }, { timeout: 15 * 60_000 }) as unknown as { content: Array<{ type: string; text?: string }>; isError?: boolean };
    assert.notEqual(response.isError, true, `A2 refinement must execute for seed ${seed}`);
    const text = response.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
    assert.ok(text, `A2 refinement must return JSON for seed ${seed}`);
    return JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
    await handler.close();
  }
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A2 HARD OPTIMIZATION');
  console.log('Baseline: corrected unrestricted FF-only Tidus Version A.');
  console.log('Method: iterative strategy-aware refinement + simulation across three deterministic seeds, then independent verified win-package completion/evaluation.');

  const baselineEval = await evaluateCommanderBuildV15(VERSION_A, { ...ff, cedhIntent: true, optimizedPlanEvidence: true, competitiveMetagameEvidence: false });
  const baselineReadiness = await assessCedhReadinessV14(VERSION_A, ff);
  assert.equal(baselineEval.hardGatesPassed, true, 'Version A must pass hard gates');
  assert.equal(baselineEval.printingPolicySatisfied, true, 'Version A must remain FF printing-family compliant');

  const seeds = [20260829, 20260830, 20260831];
  const runs: Array<Record<string, unknown>> = [];

  for (const seed of seeds) {
    console.log(`\nA2 SEED ${seed}: iterative refinement...`);
    const refinement = await runRefinement(seed);
    const refinedDeck = typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist : VERSION_A;
    const refinedEval = await evaluateCommanderBuildV15(refinedDeck, { ...ff, cedhIntent: true, optimizedPlanEvidence: true, competitiveMetagameEvidence: false });
    assert.equal(refinedEval.hardGatesPassed, true, `seed ${seed} refined deck must pass hard gates`);
    assert.equal(refinedEval.printingPolicySatisfied, true, `seed ${seed} refined deck must remain FF-only`);

    console.log(`A2 SEED ${seed}: independent backup-win completion...`);
    const comboCompletion = await completeBestCedhWinPackageV14(refinedDeck, {
      ...ff,
      protectedCards: ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
      maxMissingCards: 2,
      maxCandidatesToVerify: 12,
    });
    const comboDeck = typeof comboCompletion.finalDecklist === 'string' ? comboCompletion.finalDecklist : refinedDeck;
    const comboEval = await evaluateCommanderBuildV15(comboDeck, { ...ff, cedhIntent: true, optimizedPlanEvidence: true, competitiveMetagameEvidence: false });
    const comboReadiness = await assessCedhReadinessV14(comboDeck, ff);
    assert.equal(comboEval.hardGatesPassed, true, `seed ${seed} combo-completed deck must pass hard gates`);
    assert.equal(comboEval.printingPolicySatisfied, true, `seed ${seed} combo-completed deck must remain FF-only`);

    const run = {
      seed,
      refinement: {
        status: refinement.status ?? null,
        stopReason: refinement.stopReason ?? null,
        roundsAccepted: refinement.roundsAccepted ?? null,
        totalSwaps: refinement.totalSwaps ?? null,
        swaps: Array.isArray(refinement.swaps) ? refinement.swaps.map(record) : [],
        rounds: Array.isArray(refinement.rounds) ? refinement.rounds.map(record) : [],
        detailedRounds: Array.isArray(refinement.detailedRounds) ? refinement.detailedRounds.map(record) : [],
        constraints: refinement.constraints ?? null,
        winRouteProtection: refinement.winRouteProtection ?? null,
      },
      refinedEvaluation: conciseEvaluation(refinedEval),
      comboCompletion,
      finalEvaluation: conciseEvaluation(comboEval),
      finalReadiness: comboReadiness,
      finalDecklist: comboDeck,
    };
    runs.push(run);
    await writeFile(`counter-blitz-a2-seed-${seed}.txt`, `${comboDeck.trim()}\n`, 'utf8');
    console.log(`SEED ${seed} SWAPS: ${JSON.stringify(run.refinement.swaps, null, 2)}`);
    console.log(`SEED ${seed} COMBO STAGE: ${JSON.stringify(comboCompletion, null, 2)}`);
    console.log(`SEED ${seed} FINAL EVAL: ${JSON.stringify(run.finalEvaluation, null, 2)}`);
    console.log(`SEED ${seed} FINAL READINESS: ${JSON.stringify(comboReadiness, null, 2)}`);
  }

  const result = {
    schema: 'counter-blitz-a2-hard-optimization-v1',
    sourceBaseline: '9487cd08aab76359db9bc44ee524fcc3221b0484',
    baseline: {
      evaluation: conciseEvaluation(baselineEval),
      readiness: baselineReadiness,
      decklist: VERSION_A,
    },
    runs,
    note: 'A2 is exploratory test-branch evidence only. No stable/current promotion or PR #29 merge is implied.',
  };
  await writeFile('counter-blitz-a2-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`\nBASELINE EVAL: ${JSON.stringify(result.baseline.evaluation, null, 2)}`);
  console.log(`BASELINE READINESS: ${JSON.stringify(baselineReadiness, null, 2)}`);
  console.log('\nA2 COMPLETE: inspect all three seed outputs; do not accept a candidate solely because a scalar metric increased.');
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('counter-blitz-a2-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
