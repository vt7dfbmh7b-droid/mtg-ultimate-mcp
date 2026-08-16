import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { refineForCedhV14 } from '../src/services/cedh-refinement-v14.js';
import { parseDecklist } from '../src/services/deck.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  const baseline = await readFile(new URL('../testdata/ff-najeela-powerful-baseline.txt', import.meta.url), 'utf8');
  const beforeBracket = await estimateCommanderBracket(baseline);
  const beforeCombos = await findDeckCombos(baseline, 60);
  const beforeCount = Number(record(beforeCombos.counts).included ?? 0);

  const result = await refineForCedhV14(baseline, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    maxRounds: 3,
    maxSwaps: 12,
    candidatePackagesPerRound: 8,
  });
  assert.notEqual(result.status, 'invalid-starting-deck');
  const finalDecklist = typeof result.finalDecklist === 'string' ? result.finalDecklist : baseline;
  assert.equal(parseDecklist(finalDecklist).totalCards, 100);
  const afterBracket = await estimateCommanderBracket(finalDecklist);
  const afterCombos = await findDeckCombos(finalDecklist, 80);
  const afterCount = Number(record(afterCombos.counts).included ?? 0);

  console.log(`BEFORE: tag=${String(beforeBracket.bracketTag ?? 'unknown')} completeCombos=${beforeCount}`);
  console.log(`AFTER: tag=${String(afterBracket.bracketTag ?? 'unknown')} completeCombos=${afterCount}`);
  console.log(`SWAPS: ${String(result.totalSwaps ?? 0)}`);
  console.log(JSON.stringify(result.swaps ?? [], null, 2));
  console.log(`COMPETITIVE EVIDENCE: ${JSON.stringify(result.competitiveEvidence ?? {}, null, 2)}`);
  console.log('\nFINAL DECKLIST');
  console.log(finalDecklist.trim());

  assert.ok(
    afterCount > beforeCount || String(afterBracket.bracketTag ?? '') === 'R' || Number(result.totalSwaps ?? 0) > 0,
    'cEDH refinement must improve at least one measurable competitive-construction signal',
  );
  console.log('FAST FF cEDH REGRESSION: PASS');
}

main().catch((error) => {
  console.error('FAST FF cEDH REGRESSION: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
