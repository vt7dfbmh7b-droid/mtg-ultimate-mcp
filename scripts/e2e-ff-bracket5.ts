import assert from 'node:assert/strict';
import { buildCommanderForCedhV14 } from '../src/services/cedh-workflow-v14.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';

function record(value: unknown): Record<string, unknown> {
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
  console.log('Goal: strongest cEDH-oriented construction the current FF physical-printing pool can support.');

  const built = await buildCommanderForCedhV14([commander], {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    requireVerifiedCombo: true,
    maxMissingCards: 2,
    maxCandidatesToVerify: 8,
    maxEfficiencySwaps: 3,
    maxManaBaseSwaps: 5,
  });
  assert.notEqual(built.status, 'commander-resolution-failed');
  assert.notEqual(built.status, 'incomplete-first-draft');
  assert.notEqual(built.status, 'built-but-competitive-signals-incomplete', 'full V0.14 build must clear the competitive-construction gates');
  assert.equal(built.status, 'built-with-strong-competitive-signals');

  const finalDecklist = typeof built.finalDecklist === 'string' ? built.finalDecklist : '';
  assert.ok(finalDecklist.trim(), 'V0.14 build must return a complete final decklist');
  const verified = await verifyFinalDeck(finalDecklist);
  const [bracket, combos] = await Promise.all([
    estimateCommanderBracket(finalDecklist),
    findDeckCombos(finalDecklist, 100),
  ]);
  const comboCounts = record(combos.counts);
  const completeCombos = Number(comboCounts.included ?? 0);
  const ruthlessCombos = Array.isArray(combos.included)
    ? combos.included.map(record).filter((combo) => String(combo.bracketTag ?? '') === 'R').length
    : 0;
  const strategicallyRelevant = Array.isArray(bracket.strategicallyRelevantCombos) ? bracket.strategicallyRelevantCombos.length : 0;
  const refinement = record(built.refinement);
  const stages = record(refinement.stages);
  const comboStage = record(stages.comboCompletion);
  const efficiencyStage = record(stages.strictEfficiency);
  const manaStage = record(stages.manaBase);
  const finalAssessment = record(refinement.finalAssessment);

  assert.ok(completeCombos >= 1, 'full FF cEDH build must contain at least one independently verified complete combo');
  assert.ok(
    ruthlessCombos >= 1 || strategicallyRelevant >= 1 || String(bracket.bracketTag ?? '') === 'R',
    'full FF cEDH build must have a Ruthless/strategically relevant competitive combo signal',
  );
  assert.equal(finalAssessment.status, 'strong-competitive-construction-signals');
  assert.equal(refinement.comboWasPreserved, true, 'efficiency and mana-base tuning must preserve the verified win package');

  const commanderEntry = verified.parsed.commanders[0];
  console.log(`\nCOMMANDER PRINTING: ${commanderEntry?.name ?? commander} (${commanderEntry?.set ?? '?'}) ${commanderEntry?.collectorNumber ?? '?'}`);
  console.log(`FINAL CARD COUNT: ${verified.parsed.totalCards}`);
  console.log(`COMMANDER LEGAL: ${verified.rules.isLegal}`);
  console.log(`FF PRINTING POLICY: PASS (${verified.resolvedCount}/${verified.resolvedCount} exact printing entries eligible)`);
  console.log(`BUILD STATUS: ${String(built.status)}`);
  console.log(`FINAL SPELLBOOK TAG: ${String(bracket.bracketTag ?? 'unknown')}`);
  console.log(`COMPLETE COMBOS: ${completeCombos}`);
  console.log(`RUTHLESS COMBOS: ${ruthlessCombos}`);
  console.log(`STRATEGICALLY RELEVANT COMBOS: ${strategicallyRelevant}`);
  console.log(`COMBO STAGE: ${JSON.stringify(comboStage, null, 2)}`);
  console.log(`EFFICIENCY STAGE: ${JSON.stringify(efficiencyStage, null, 2)}`);
  console.log(`MANA STAGE: ${JSON.stringify(manaStage, null, 2)}`);
  console.log(`FINAL READINESS: ${JSON.stringify(finalAssessment, null, 2)}`);

  console.log('\nFINAL DECKLIST');
  console.log(finalDecklist.trim());
  console.log('\nBRACKET 5 / cEDH NOTE: this test proves strong competitive construction signals under the FF-only printing restriction; official Bracket 5 still also depends on cEDH intent, metagame awareness, pilot choices, and tournament-minded play.');
  console.log('FF BRACKET 5 E2E RESULT: PASS');
}

main().catch((error) => {
  console.error('\nFF BRACKET 5 E2E RESULT: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
