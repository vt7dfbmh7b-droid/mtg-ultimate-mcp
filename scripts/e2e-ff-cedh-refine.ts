import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { refineCedhEfficiencyV14 } from '../src/services/cedh-efficiency-v14.js';
import { optimizeCedhManaBaseV14 } from '../src/services/cedh-manabase-v14.js';
import { completeBestCedhWinPackageV14, countWinningCombosV14 } from '../src/services/cedh-win-package-v14.js';
import { assessCedhReadinessV14 } from '../src/services/cedh-workflow-v14.js';
import { parseDecklist } from '../src/services/deck.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeForTest(value: string): string {
  return value.trim().toLocaleLowerCase();
}

async function main(): Promise<void> {
  const baseline = await readFile(new URL('../testdata/ff-najeela-powerful-baseline.txt', import.meta.url), 'utf8');
  const beforeBracket = await estimateCommanderBracket(baseline);
  const beforeCombos = await findDeckCombos(baseline, 100);
  const beforeComplete = Number(record(beforeCombos.counts).included ?? 0);
  const beforeWins = countWinningCombosV14(beforeCombos);

  const winGate = await completeBestCedhWinPackageV14(baseline, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxMissingCards: 2,
    maxCandidatesToVerify: 8,
  });
  console.log(`WIN GATE STATUS: ${String(winGate.status)}`);
  console.log(`WIN GATE AUDIT: ${JSON.stringify(winGate.audit ?? [], null, 2)}`);

  if (winGate.status !== 'winning-combo-completed') {
    assert.equal(
      winGate.status,
      'no-verifiable-eligible-winning-combo',
      'a restricted FF build may stop below cEDH, but it must do so through the explicit no-win-package gate',
    );
    const assessment = await assessCedhReadinessV14(baseline, {
      printingFamily: 'Final Fantasy',
      includePromos: true,
      includeSpecialReleases: true,
    });
    assert.notEqual(
      assessment.status,
      'strong-competitive-construction-signals',
      'the restricted regression must never turn a missing deterministic win package into strong cEDH construction signals',
    );
    console.log(`BEFORE: tag=${String(beforeBracket.bracketTag ?? 'unknown')} completeCombos=${beforeComplete} winningCombos=${beforeWins}`);
    console.log(`HONEST CEILING: ${String(assessment.status)}; verifiedWinningCombos=${String(assessment.winningCombos ?? 0)}`);
    console.log('FAST FF cEDH REGRESSION: PASS (truthful restricted ceiling)');
    return;
  }

  const winDecklist = typeof winGate.finalDecklist === 'string' ? winGate.finalDecklist : baseline;
  const afterWinCombos = await findDeckCombos(winDecklist, 100);
  const afterWinCount = countWinningCombosV14(afterWinCombos);
  assert.ok(afterWinCount > beforeWins, 'win-package gate must increase the number of verified deterministic winning Spellbook combos');

  const protectedComboCards = Array.isArray(record(winGate.completedPlan).comboCardNames)
    ? (record(winGate.completedPlan).comboCardNames as string[])
    : [];
  const efficiency = await refineCedhEfficiencyV14(winDecklist, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxSwaps: 3,
    protectedCards: protectedComboCards,
  });
  assert.notEqual(efficiency.status, 'invalid-starting-deck');
  assert.notEqual(efficiency.status, 'starting-deck-violates-printing-policy');
  const efficiencyDecklist = typeof efficiency.finalDecklist === 'string' ? efficiency.finalDecklist : winDecklist;
  assert.equal(parseDecklist(efficiencyDecklist).totalCards, 100);
  const afterEfficiencyCombos = await findDeckCombos(efficiencyDecklist, 100);
  const afterEfficiencyWins = countWinningCombosV14(afterEfficiencyCombos);
  assert.ok(afterEfficiencyWins >= afterWinCount, 'strict efficiency tuning must not remove the verified win package');

  const mana = await optimizeCedhManaBaseV14(efficiencyDecklist, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxSwaps: 5,
    minImprovement: 18,
  });
  assert.notEqual(mana.status, 'invalid-starting-deck');
  assert.notEqual(mana.status, 'starting-deck-violates-printing-policy');
  const finalDecklist = typeof mana.finalDecklist === 'string' ? mana.finalDecklist : efficiencyDecklist;
  assert.equal(parseDecklist(finalDecklist).totalCards, 100);
  const afterBracket = await estimateCommanderBracket(finalDecklist);
  const afterCombos = await findDeckCombos(finalDecklist, 100);
  const afterComplete = Number(record(afterCombos.counts).included ?? 0);
  const afterWins = countWinningCombosV14(afterCombos);

  console.log(`BEFORE: tag=${String(beforeBracket.bracketTag ?? 'unknown')} completeCombos=${beforeComplete} winningCombos=${beforeWins}`);
  console.log(`AFTER WIN GATE: winningCombos=${afterWinCount}`);
  console.log(`STRICT EFFICIENCY STATUS: ${String(efficiency.status)}`);
  console.log(`MANA-BASE STATUS: ${String(mana.status)}`);
  console.log(`FINAL: tag=${String(afterBracket.bracketTag ?? 'unknown')} completeCombos=${afterComplete} winningCombos=${afterWins}`);
  console.log(`WIN PACKAGE: ${JSON.stringify(winGate.completedPlan ?? {}, null, 2)}`);
  console.log(`WIN SWAPS: ${JSON.stringify(winGate.swaps ?? [], null, 2)}`);
  console.log(`STRICT EFFICIENCY SWAPS: ${JSON.stringify(efficiency.swaps ?? [], null, 2)}`);
  console.log(`MANA-BASE SWAPS: ${JSON.stringify(mana.swaps ?? [], null, 2)}`);
  console.log(`BEFORE METRICS: ${JSON.stringify(efficiency.beforeMetrics ?? {}, null, 2)}`);
  console.log(`AFTER METRICS: ${JSON.stringify(efficiency.afterMetrics ?? {}, null, 2)}`);
  console.log('\nFINAL DECKLIST');
  console.log(finalDecklist.trim());

  assert.ok(afterWins >= afterWinCount, 'later efficiency/mana tuning must preserve the verified winning combo');
  const weakNames = new Set(['world map', 'magitek infantry']);
  const strictSwaps = Array.isArray(efficiency.swaps) ? efficiency.swaps.map(record) : [];
  assert.equal(
    strictSwaps.some((swap) => typeof swap.in === 'string' && weakNames.has(normalizeForTest(swap.in))),
    false,
    'strict cEDH efficiency tuning must not admit cards merely because they are cheap',
  );
  if (mana.status === 'cedh-mana-base-refined') {
    assert.equal(mana.beforeLandCount, mana.afterLandCount, 'mana-base refinement must be land-for-land with no land-count change');
    const manaSwaps = Array.isArray(mana.swaps) ? mana.swaps.map(record) : [];
    assert.equal(
      manaSwaps.some((swap) => normalizeForTest(String(swap.in ?? '')) === 'evolving wilds'),
      false,
      'cEDH mana-base tuning must not treat Evolving Wilds as a premium untapped upgrade',
    );
  }
  console.log('FAST FF cEDH REGRESSION: PASS (verified winning package)');
}

main().catch((error) => {
  console.error('FAST FF cEDH REGRESSION: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
