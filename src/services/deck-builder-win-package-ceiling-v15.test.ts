import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Bracket-5 autonomous refinement uses the production four-card win-package ceiling', () => {
  const source = readFileSync(new URL('./deck-builder-v07.ts', import.meta.url), 'utf8');
  const discoveryCall = source.match(/discoverGeneralWinPackagesV15\(commanders, \{[\s\S]*?\n  \}\);/u)?.[0] ?? '';

  assert.notEqual(discoveryCall, '', 'expected autonomous discoverGeneralWinPackagesV15 caller to remain present');
  assert.match(discoveryCall, /maxPackageCards:\s*4,/u);
  assert.doesNotMatch(discoveryCall, /maxPackageCards:\s*[123],/u);
});
