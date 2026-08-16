import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { completeBestCedhComboV14 } from '../src/services/cedh-combo-completion-v14.js';
import { refineCedhEfficiencyV14 } from '../src/services/cedh-efficiency-v14.js';
import { optimizeCedhManaBaseV14 } from '../src/services/cedh-manabase-v14.js';
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
  const beforeCount = Number(record(beforeCombos.counts).included ?? 0);

  const comboGate = await completeBestCedhComboV14(baseline, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxMissingCards: 2,
    maxCandidatesToVerify: 8,
  });
  console.log(`COMBO GATE STATUS: ${String(comboGate.status)}`);
  console.log(`COMBO GATE AUDIT: ${JSON.stringify(comboGate.audit ?? [], null, 2)}`);
  assert.equal(comboGate.status, 'combo-completed', 'FF cEDH path must find and independently verify at least one eligible complete combo from the known Powerful baseline');

  const comboDecklist = typeof comboGate.finalDecklist === 'string' ? comboGate.finalDecklist : baseline;
  const afterGateCombos = await findDeckCombos(comboDecklist, 100);
  const afterGateCount = Number(record(afterGateCombos.counts).included ?? 0);
  assert.ok(afterGateCount > beforeCount, 'combo gate must increase the number of complete Spellbook combos');

  const protectedComboCards = Array.isArray(record(comboGate.completedPlan).comboCardNames)
    ? (record(comboGate.completedPlan).comboCardNames as string[])
    : [];
  const efficiency = await refineCedhEfficiencyV14(comboDecklist, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxSwaps: 3,
    protectedCards: protectedComboCards,
  });
  assert.notEqual(efficiency.status, 'invalid-starting-deck');
  assert.notEqual(efficiency.status, 'starting-deck-violates-printing-policy');
  const efficiencyDecklist = typeof efficiency.finalDecklist === 'string' ? efficiency.finalDecklist : comboDecklist;
  assert.equal(parseDecklist(efficiencyDecklist).totalCards, 100);
  const afterEfficiencyCombos = await findDeckCombos(efficiencyDecklist, 100);
  const afterEfficiencyCount = Number(record(afterEfficiencyCombos.counts).included ?? 0);
  assert.ok(afterEfficiencyCount >= afterGateCount, 'strict efficiency tuning must not remove the verified complete combo');

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
  const afterCount = Number(record(afterCombos.counts).included ?? 0);

  console.log(`BEFORE: tag=${String(beforeBracket.bracketTag ?? 'unknown')} completeCombos=${beforeCount}`);
  console.log(`AFTER COMBO GATE: completeCombos=${afterGateCount}`);
  console.log(`STRICT EFFICIENCY STATUS: ${String(efficiency.status)}`);
  console.log(`MANA-BASE STATUS: ${String(mana.status)}`);
  console.log(`FINAL: tag=${String(afterBracket.bracketTag ?? 'unknown')} completeCombos=${afterCount}`);
  console.log(`COMBO SWAPS: ${JSON.stringify(comboGate.swaps ?? [], null, 2)}`);
  console.log(`STRICT EFFICIENCY SWAPS: ${JSON.stringify(efficiency.swaps ?? [], null, 2)}`);
  console.log(`MANA-BASE SWAPS: ${JSON.stringify(mana.swaps ?? [], null, 2)}`);
  console.log(`BEFORE METRICS: ${JSON.stringify(efficiency.beforeMetrics ?? {}, null, 2)}`);
  console.log(`AFTER METRICS: ${JSON.stringify(efficiency.afterMetrics ?? {}, null, 2)}`);
  console.log('\nFINAL DECKLIST');
  console.log(finalDecklist.trim());

  assert.ok(afterCount >= afterGateCount, 'later efficiency/mana tuning must not remove the verified complete combo');
  const weakNames = new Set(['world map', 'magitek infantry']);
  const strictSwaps = Array.isArray(efficiency.swaps) ? efficiency.swaps.map(record) : [];
  assert.equal(
    strictSwaps.some((swap) => typeof swap.in === 'string' && weakNames.has(normalizeForTest(swap.in))),
    false,
    'strict cEDH efficiency tuning must not admit cards merely because they are cheap',
  );
  if (mana.status === 'cedh-mana-base-refined') {
    assert.equal(mana.beforeLandCount, mana.afterLandCount, 'mana-base refinement must be land-for-land with no land-count change');
  }
  console.log('FAST FF cEDH REGRESSION: PASS');
}

main().catch((error) => {
  console.error('FAST FF cEDH REGRESSION: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
