import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { completeBestCedhComboV14 } from '../src/services/cedh-combo-completion-v14.js';
import { refineCedhEfficiencyV14 } from '../src/services/cedh-efficiency-v14.js';
import { parseDecklist } from '../src/services/deck.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
  const result = await refineCedhEfficiencyV14(comboDecklist, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxSwaps: 3,
    protectedCards: protectedComboCards,
  });
  assert.notEqual(result.status, 'invalid-starting-deck');
  assert.notEqual(result.status, 'starting-deck-violates-printing-policy');
  const finalDecklist = typeof result.finalDecklist === 'string' ? result.finalDecklist : comboDecklist;
  assert.equal(parseDecklist(finalDecklist).totalCards, 100);
  const afterBracket = await estimateCommanderBracket(finalDecklist);
  const afterCombos = await findDeckCombos(finalDecklist, 100);
  const afterCount = Number(record(afterCombos.counts).included ?? 0);

  console.log(`BEFORE: tag=${String(beforeBracket.bracketTag ?? 'unknown')} completeCombos=${beforeCount}`);
  console.log(`AFTER COMBO GATE: completeCombos=${afterGateCount}`);
  console.log(`STRICT EFFICIENCY STATUS: ${String(result.status)}`);
  console.log(`FINAL: tag=${String(afterBracket.bracketTag ?? 'unknown')} completeCombos=${afterCount}`);
  console.log(`COMBO SWAPS: ${JSON.stringify(comboGate.swaps ?? [], null, 2)}`);
  console.log(`STRICT EFFICIENCY SWAPS: ${JSON.stringify(result.swaps ?? [], null, 2)}`);
  console.log(`BEFORE METRICS: ${JSON.stringify(result.beforeMetrics ?? {}, null, 2)}`);
  console.log(`AFTER METRICS: ${JSON.stringify(result.afterMetrics ?? {}, null, 2)}`);
  console.log('\nFINAL DECKLIST');
  console.log(finalDecklist.trim());

  assert.ok(afterCount >= afterGateCount, 'later efficiency tuning must not remove the verified complete combo');
  const weakNames = new Set(['world map', 'magitek infantry']);
  const strictSwaps = Array.isArray(result.swaps) ? result.swaps.map(record) : [];
  assert.equal(
    strictSwaps.some((swap) => typeof swap.in === 'string' && weakNames.has(normalizeForTest(swap.in))),
    false,
    'strict cEDH efficiency tuning must not admit cards merely because they are cheap',
  );
  console.log('FAST FF cEDH REGRESSION: PASS');
}

function normalizeForTest(value: string): string {
  return value.trim().toLocaleLowerCase();
}

main().catch((error) => {
  console.error('FAST FF cEDH REGRESSION: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
