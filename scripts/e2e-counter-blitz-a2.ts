import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMtgServerV15 } from '../src/server-v15.js';
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryThrottled<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const waits = [0, 20_000, 40_000];
  let last: unknown;
  for (let index = 0; index < waits.length; index += 1) {
    if (waits[index] > 0) {
      console.log(`${label}: throttled; retrying after ${waits[index] / 1000}s cooldown...`);
      await delay(waits[index]);
    }
    try {
      return await fn();
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('429') || index === waits.length - 1) throw error;
    }
  }
  throw last;
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
  console.log('COUNTER BLITZ A2 HARD OPTIMIZATION — THROTTLE-RESILIENT RERUN');
  console.log('Prior seed 20260829 already returned zero iterative swaps and independently found Archmage Emeritus -> The Earth Crystal for a second verified Ballista line.');
  console.log('This rerun completes the two remaining deterministic refinement seeds before one independently verified combo completion.');

  const seeds = [20260830, 20260831];
  const refinements: Array<Record<string, unknown>> = [];
  const finalDecks: string[] = [];

  for (const seed of seeds) {
    console.log(`\nA2 SEED ${seed}: iterative strategy-aware refinement...`);
    const refinement = await retryThrottled(`seed ${seed} refinement`, () => runRefinement(seed));
    const deck = typeof refinement.finalDecklist === 'string' ? refinement.finalDecklist : VERSION_A;
    const summary = {
      seed,
      status: refinement.status ?? null,
      stopReason: refinement.stopReason ?? null,
      roundsAccepted: refinement.roundsAccepted ?? null,
      totalSwaps: refinement.totalSwaps ?? null,
      swaps: Array.isArray(refinement.swaps) ? refinement.swaps.map(record) : [],
      rounds: Array.isArray(refinement.rounds) ? refinement.rounds.map(record) : [],
      constraints: refinement.constraints ?? null,
      winRouteProtection: refinement.winRouteProtection ?? null,
      finalDecklist: deck,
    };
    refinements.push(summary);
    finalDecks.push(deck.trim());
    await writeFile(`counter-blitz-a2-refinement-seed-${seed}.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    console.log(`SEED ${seed} STATUS: ${String(summary.status)}`);
    console.log(`SEED ${seed} TOTAL SWAPS: ${String(summary.totalSwaps)}`);
    console.log(`SEED ${seed} SWAPS: ${JSON.stringify(summary.swaps, null, 2)}`);
    await delay(20_000);
  }

  const distinctDecks = [...new Set(finalDecks)];
  console.log(`\nDISTINCT REFINED DECKS ACROSS REMAINING SEEDS: ${distinctDecks.length}`);
  const representative = distinctDecks[0] ?? VERSION_A;

  console.log('\nA2 independent backup-win completion on representative refined deck...');
  const comboCompletion = await retryThrottled('combo completion', () => completeBestCedhWinPackageV14(representative, {
    ...ff,
    protectedCards: ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
    maxMissingCards: 2,
    maxCandidatesToVerify: 12,
  }));
  const finalDeck = typeof comboCompletion.finalDecklist === 'string' ? comboCompletion.finalDecklist : representative;
  await delay(20_000);
  const finalReadiness = await retryThrottled('final readiness', () => assessCedhReadinessV14(finalDeck, ff));

  const result = {
    schema: 'counter-blitz-a2-hard-optimization-v2',
    sourceBaseline: '9487cd08aab76359db9bc44ee524fcc3221b0484',
    priorSeedEvidence: {
      seed: 20260829,
      iterativeSwaps: [],
      comboCompletion: 'Archmage Emeritus -> The Earth Crystal',
      winningCombosBefore: 1,
      winningCombosAfter: 2,
    },
    remainingSeedRefinements: refinements,
    distinctRefinedDeckCount: distinctDecks.length,
    allRemainingSeedsUnchangedFromA: finalDecks.every((deck) => deck === VERSION_A.trim()),
    comboCompletion,
    finalReadiness,
    finalDecklist: finalDeck,
    caveat: 'V0.15 full-table closure intentionally does not count generic Commander Spellbook result text "Infinite damage" as full-table closure when the result text omits multiplayer scope, even though this Ballista loop can retarget its repeatable any-target damage. That assessor disagreement is audited separately rather than hidden.',
    note: 'A2 is exploratory test-branch evidence only. No stable/current promotion or PR #29 merge is implied.',
  };

  await writeFile('counter-blitz-a2-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile('counter-blitz-a2-final-deck.txt', `${finalDeck.trim()}\n`, 'utf8');
  console.log(`\nCOMBO COMPLETION: ${JSON.stringify(comboCompletion, null, 2)}`);
  console.log(`FINAL READINESS: ${JSON.stringify(finalReadiness, null, 2)}`);
  console.log(`ALL REMAINING SEEDS UNCHANGED FROM VERSION A: ${result.allRemainingSeedsUnchangedFromA}`);
  console.log('\nA2 RERUN COMPLETE.');
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('counter-blitz-a2-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  process.exitCode = 1;
});
