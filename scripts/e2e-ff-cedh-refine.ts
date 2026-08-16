import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { completeBestCedhComboV14 } from '../src/services/cedh-combo-completion-v14.js';
import { refineForCedhV14 } from '../src/services/cedh-refinement-v14.js';
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

  const result = await refineForCedhV14(comboDecklist, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxRounds: 1,
    maxSwaps: 3,
    candidatePackagesPerRound: 3,
    protectedCards: Array.isArray(record(comboGate.completedPlan).comboCardNames)
      ? (record(comboGate.completedPlan).comboCardNames as string[])
      : [],
  });
  assert.notEqual(result.status, 'invalid-starting-deck');
  const finalDecklist = typeof result.finalDecklist === 'string' ? result.finalDecklist : comboDecklist;
  assert.equal(parseDecklist(finalDecklist).totalCards, 100);
  const afterBracket = await estimateCommanderBracket(finalDecklist);
  const afterCombos = await findDeckCombos(finalDecklist, 100);
  const afterCount = Number(record(afterCombos.counts).included ?? 0);

  console.log(`BEFORE: tag=${String(beforeBracket.bracketTag ?? 'unknown')} completeCombos=${beforeCount}`);
  console.log(`AFTER COMBO GATE: completeCombos=${afterGateCount}`);
  console.log(`FINAL: tag=${String(afterBracket.bracketTag ?? 'unknown')} completeCombos=${afterCount}`);
  console.log(`COMBO SWAPS: ${JSON.stringify(comboGate.swaps ?? [], null, 2)}`);
  console.log(`EFFICIENCY SWAPS: ${JSON.stringify(result.swaps ?? [], null, 2)}`);
  console.log(`COMPETITIVE EVIDENCE: ${JSON.stringify(result.competitiveEvidence ?? {}, null, 2)}`);
  console.log('\nFINAL DECKLIST');
  console.log(finalDecklist.trim());

  assert.ok(afterCount >= afterGateCount, 'later efficiency tuning must not remove the verified complete combo');
  console.log('FAST FF cEDH REGRESSION: PASS');
}

main().catch((error) => {
  console.error('FAST FF cEDH REGRESSION: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
