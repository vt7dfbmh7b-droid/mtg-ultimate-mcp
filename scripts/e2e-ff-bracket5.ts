import assert from 'node:assert/strict';
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

async function main(): Promise<void> {
  const commander = 'Najeela, the Blade-Blossom';
  console.log('FF BRACKET 5 E2E: building a FINAL FANTASY-printings-only Commander deck...');
  console.log(`Commander Oracle identity: ${commander}`);
  console.log('Goal: Bracket 5 / maximum practical power under the FINAL FANTASY physical-printing restriction.');

  const result = await buildAndRefineCommanderDeckV12([commander], {
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

  assert.equal(result.status, 'built-and-refined', 'from-scratch FF build should complete before bracket evaluation');
  const finalDecklist = finalDecklistFrom(result);
  const parsed = parseDecklist(finalDecklist);
  assert.equal(parsed.totalCards, 100, 'final deck must contain exactly 100 cards');

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact card/printing identifier must resolve');
  assert.equal(resolved.cards.length, allEntries(parsed).length, 'every deck entry must resolve to an exact printing');

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

  const bracket = await estimateCommanderBracket(finalDecklist);
  const combos = await findDeckCombos(finalDecklist, 50);
  const refinement = asRecord(result.refinement);
  const initialDraft = asRecord(result.initialDraft);

  const commanderEntry = parsed.commanders[0];
  console.log(`\nCOMMANDER PRINTING: ${commanderEntry?.name ?? commander} (${commanderEntry?.set ?? '?'}) ${commanderEntry?.collectorNumber ?? '?'}`);
  console.log(`FINAL CARD COUNT: ${parsed.totalCards}`);
  console.log(`COMMANDER LEGAL: ${rules.isLegal}`);
  console.log(`FF PRINTING POLICY: PASS (${resolved.cards.length}/${resolved.cards.length} exact printings eligible)`);
  console.log(`TARGET BRACKET: 5`);
  console.log(`COMMANDER SPELLBOOK ESTIMATE: ${String(bracket.bracketTag ?? 'unknown')}`);
  console.log(`INITIAL SELECTED PRINTING USD REFERENCE: ${String(initialDraft.selectedPrintingEstimatedUsd ?? 'not reported')}`);
  console.log(`ACCEPTED REFINEMENT SWAPS: ${String(refinement.totalSwaps ?? 0)}`);
  console.log(`REFINEMENT STOP REASON: ${String(refinement.stopReason ?? 'not reported')}`);
  console.log(`FLAGGED CARDS: ${JSON.stringify(bracket.flaggedCards ?? [], null, 2)}`);
  console.log(`COMBO SUMMARY: ${JSON.stringify(asRecord(combos).counts ?? {}, null, 2)}`);
  console.log(`NEAR COMBOS: ${JSON.stringify(asRecord(combos).almostIncluded ?? [], null, 2)}`);
  console.log(`STRATEGICALLY RELEVANT COMBOS: ${JSON.stringify(bracket.strategicallyRelevantCombos ?? [], null, 2)}`);

  console.log('\nFINAL DECKLIST');
  console.log(finalDecklist.trim());

  const bracketText = String(bracket.bracketTag ?? '').toLocaleLowerCase();
  const reachedFive = bracketText.includes('5') || bracketText.includes('cedh');
  console.log(`\nBRACKET 5 GOAL: ${reachedFive ? 'REACHED' : 'NOT REACHED'}`);
  if (!reachedFive) {
    console.log('The test remains a PASS because legality and the FINAL FANTASY-only printing constraint succeeded; bracket classification is reported as an observed result rather than forced.');
  }
  console.log('FF BRACKET 5 E2E RESULT: PASS');
}

main().catch((error) => {
  console.error('\nFF BRACKET 5 E2E RESULT: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
