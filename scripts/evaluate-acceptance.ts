import fs from 'node:fs';
import { evaluateAcceptance } from '../src/acceptance-gate.js';
import { loadAcceptancePolicy } from '../src/acceptance-state.js';

// Read-only. No evidence generation, state writes, promotion or network access.
try {
  const receiptPath = process.argv[2];
  if (!receiptPath) throw new Error('Usage: evaluate-acceptance <receipt.json>');
  const policy = loadAcceptancePolicy();
  const receipt: unknown = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const result = evaluateAcceptance(process.cwd(), receipt, policy.approvedContracts);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.outcome === 'pass' ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ outcome: 'unknown', error: String(error) }));
  process.exitCode = 1;
}
