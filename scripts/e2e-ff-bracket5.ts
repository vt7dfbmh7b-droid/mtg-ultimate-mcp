import assert from 'node:assert/strict';
import { refineForCedhV14 } from '../src/services/cedh-refinement-v14.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { buildAndRefineCommanderDeckV12 } from '../src/services/refinement-workflows-v12.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function allEntries(parsed: ParsedDeck): DeckEntry[] {
  return [...parsed.commanders, ...parsed.main];
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return allEntries(parsed).map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

function finalDecklistFrom(result: Record<string, unknown>): string {
  const refinement = asRecord(result.refinement);
  if (typeof refinement.finalDecklist === 'string' && refinement.finalDecklist.trim()) return refinement.finalDecklist;
  const initialDraft = asRecord(result.initialDraft);
  if (typeof initialDraft.decklist === 'string' && initialDraft.decklist.trim()) return initialDraft.decklist;
  throw new Error('Builder did not return a complete final or initial decklist.');
}

async function verifyFinalDeck(decklist: string): Promise<{ parsed: ParsedDeck; rules: ReturnType<typeof validateCommanderDeck>; resolvedCount: number }> {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'final deck must contain exactly 100 cards');
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact card/printing identifier must resolve');
  assert.equal(resolved.cards.length, allEntries(parsed).length, 'every unique deck entry must resolve to an exact printing');
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, 'final deck must pass hard Commander legality');
  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    'every physical printing, including commander and basics, must belong to the active FINAL FANTASY printing family',
  );
  return { parsed, rules, resolvedCount: resolved.cards.length };
}

async function main(): Promise<void> {
  const commander = 'Najeela, the Blade-Blossom';
  console.log('FF BRACKET 5 E2E: building a FINAL FANTASY-printings-only Commander deck...');
  console.log(`Commander Oracle identity: ${commander}`);
  console.log('Goal: Bracket 5 / cEDH-oriented construction under the FINAL FANTASY physical-printing restriction.');

  const initialBuild = await buildAndRefineCommanderDeckV12([commander], {
    targetBracket: 5,
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxRefinementRounds: 5,
    maxRefinementSwaps: 30,
    swapsPerRound: 6,
    candidatePackagesPerRound: 6,
    minimumImprovementScore: -10,
    simulationIterations: 750,
    simulationTurns: 7,
    seed: 20_260_816,
    detailLevel: 'detailed',
  });
  assert.equal(initialBuild.status, 'built-and-refined', 'from-scratch FF build should complete before cEDH package refinement');
  const baselineDecklist = finalDecklistFrom(initialBuild);
  const baselineBracket = await estimateCommanderBracket(baselineDecklist);
  const baselineCombos = await findDeckCombos(baselineDecklist, 60);

  console.log(`BASELINE SPELLBOOK TAG: ${String(baselineBracket.bracketTag ?? 'unknown')}`);
  console.log(`BASELINE COMPLETE COMBOS: ${String(asRecord(baselineCombos.counts).included ?? 0)}`);
  console.log(`BASELINE NEAR COMBOS: ${String(asRecord(baselineCombos.counts).almostIncluded ?? 0)}`);

  const cedh = await refineForCedhV14(baselineDecklist, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxRounds: 4,
    maxSwaps: 18,
    candidatePackagesPerRound: 10,
  });
  assert.notEqual(cedh.status, 'invalid-starting-deck', 'V0.14 cEDH refinement should accept the legal FF baseline');
  const finalDecklist = typeof cedh.finalDecklist === 'string' ? cedh.finalDecklist : baselineDecklist;
  const verified = await verifyFinalDeck(finalDecklist);
  const bracket = await estimateCommanderBracket(finalDecklist);
  const combos = await findDeckCombos(finalDecklist, 80);

  const commanderEntry = verified.parsed.commanders[0];
  console.log(`\nCOMMANDER PRINTING: ${commanderEntry?.name ?? commander} (${commanderEntry?.set ?? '?'}) ${commanderEntry?.collectorNumber ?? '?'}`);
  console.log(`FINAL CARD COUNT: ${verified.parsed.totalCards}`);
  console.log(`COMMANDER LEGAL: ${verified.rules.isLegal}`);
  console.log(`FF PRINTING POLICY: PASS (${verified.resolvedCount}/${verified.resolvedCount} exact printings eligible)`);
  console.log(`V0.14 STATUS: ${String(cedh.status)}`);
  console.log(`V0.14 SWAPS: ${String(cedh.totalSwaps ?? 0)}`);
  console.log(`V0.14 SWAP DETAIL: ${JSON.stringify(cedh.swaps ?? [], null, 2)}`);
  console.log(`FINAL SPELLBOOK TAG: ${String(bracket.bracketTag ?? 'unknown')}`);
  console.log(`FINAL COMBO SUMMARY: ${JSON.stringify(asRecord(combos).counts ?? {}, null, 2)}`);
  console.log(`FINAL COMPETITIVE EVIDENCE: ${JSON.stringify(cedh.competitiveEvidence ?? {}, null, 2)}`);
  console.log(`STRATEGICALLY RELEVANT COMBOS: ${JSON.stringify(bracket.strategicallyRelevantCombos ?? [], null, 2)}`);

  const baselineIncluded = Number(asRecord(baselineCombos.counts).included ?? 0);
  const finalIncluded = Number(asRecord(combos.counts).included ?? 0);
  assert.ok(
    finalIncluded > baselineIncluded || String(bracket.bracketTag ?? '') === 'R' || Number(cedh.totalSwaps ?? 0) > 0,
    'V0.14 should produce at least one measurable competitive-construction improvement over the failed baseline',
  );

  console.log('\nFINAL DECKLIST');
  console.log(finalDecklist.trim());
  console.log('\nBRACKET 5 / cEDH NOTE: card composition can show competitive readiness, but official Bracket 5 also depends on cEDH intent, metagame awareness, and tournament-minded construction.');
  console.log('FF BRACKET 5 E2E RESULT: PASS');
}

main().catch((error) => {
  console.error('\nFF BRACKET 5 E2E RESULT: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
